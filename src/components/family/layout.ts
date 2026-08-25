import Dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'

import type { FamilyData } from '#/lib/family'
import type { Partnership, Person } from '#/db/schema'

export const CARD_W = 224
export const CARD_H = 96

const RANK_GAP = 110
const NODE_GAP = 56

export type NodeActionKind = 'view' | 'edit' | 'child' | 'partner' | 'parent'
export type NodeActionHandler = (
  kind: NodeActionKind,
  person: Person,
) => void

/** Urutan kelahiran di antara saudara sekandang. */
export type BirthOrder = { rank: number; total: number }

/** Urutan pernikahan seorang pasangan (konteks: pasangan yang menikah >1 kali). */
export type SpouseOrder = { rank: number; total: number }

/** Kelompokkan saudara sekandang, terurut tanggal lahir (fallback: urutan data). */
export function groupSiblings(
  parentsByChild: Map<string, string[]>,
  byId: Map<string, Person>,
): { id: string; key: string }[][] {
  const groups = new Map<string, { id: string; key: string }[]>()
  for (const [childId, parents] of parentsByChild) {
    const person = byId.get(childId)
    if (!person) continue
    const gk = [...parents].sort().join('|')
    const created =
      person.createdAt instanceof Date ? person.createdAt.toISOString().slice(0, 10) : ''
    const key = person.birthDate ?? (created || '9999')
    ;(groups.get(gk) ?? groups.set(gk, []).get(gk)!).push({ id: childId, key })
  }
  return [...groups.values()]
    .map((list) => [...list].sort((a, b) => a.key.localeCompare(b.key)))
    .filter((list) => list.length >= 2)
}

/** Hitung "anak ke-N" per kelompok saudara sekandang (set orangtua identik). */
export function computeBirthOrders(
  parentsByChild: Map<string, string[]>,
  byId: Map<string, Person>,
): Map<string, BirthOrder> {
  const orders = new Map<string, BirthOrder>()
  for (const list of groupSiblings(parentsByChild, byId)) {
    list.forEach((item, i) => orders.set(item.id, { rank: i + 1, total: list.length }))
  }
  return orders
}

/**
 * Peringkat pernikahan tiap orang yang menikah >1 kali:
 * hub -> (partnershipId -> nomor urut). Urutan: tanggal menikah, lalu urutan data.
 */
export function computeMarriageRanks(partnerships: Partnership[]): {
  degree: Map<string, number>
  rankByHub: Map<string, Map<string, SpouseOrder>>
} {
  const degree = new Map<string, number>()
  for (const ps of partnerships) {
    degree.set(ps.partnerAId, (degree.get(ps.partnerAId) ?? 0) + 1)
    degree.set(ps.partnerBId, (degree.get(ps.partnerBId) ?? 0) + 1)
  }
  const rankByHub = new Map<string, Map<string, SpouseOrder>>()
  const lists = new Map<string, { psId: string; key: string }[]>()
  partnerships.forEach((ps, i) => {
    for (const pid of [ps.partnerAId, ps.partnerBId]) {
      if ((degree.get(pid) ?? 0) <= 1) continue
      ;(lists.get(pid) ?? lists.set(pid, []).get(pid)!).push({
        psId: ps.id,
        key: ps.marriedDate ?? String(i).padStart(6, '0'),
      })
    }
  })
  for (const [hub, list] of lists) {
    list.sort((a, b) => a.key.localeCompare(b.key))
    rankByHub.set(
      hub,
      new Map(list.map((item, i) => [item.psId, { rank: i + 1, total: list.length }])),
    )
  }
  return { degree, rankByHub }
}

export type PersonFlowData = {
  person: Person
  birthOrder?: BirthOrder
  /** Urutan pernikahan pasangan ini (untuk badge "Istri/Suami ke-N"). */
  spouseOrder?: SpouseOrder
  onAction?: NodeActionHandler
}

export type PersonNode = Node<PersonFlowData, 'person'>

/**
 * Transform data DB menjadi nodes/edges React Flow.
 *
 * Model hierarki: istri berada DI BAWAH suami (garis pernikahan vertikal),
 * dan anak menggantung di bawah IBU-nya (garis lurus satu jangkar).
 * Setiap orang tepat satu kartu; jumlah istri tidak mempengaruhi geometri.
 */
export function layoutFamily(
  data: FamilyData,
  onAction?: PersonFlowData['onAction'],
): {
  nodes: PersonNode[]
  edges: Edge[]
} {
  const { persons, parentLinks, partnerships } = data
  if (persons.length === 0) return { nodes: [], edges: [] }

  const byIndex = new Map(persons.map((p) => [p.id, p]))

  const parentsByChild = new Map<string, string[]>()
  for (const link of parentLinks) {
    ;(parentsByChild.get(link.childId) ??
      parentsByChild.set(link.childId, []).get(link.childId)!).push(link.parentId)
  }

  // Sumber garis pernikahan:
  // 1) Person yang sudah berakar di pohon (punya orangtua) di atas —
  //    pasangan bebas menggantung di bawahnya, tidak masuk baris istri lain.
  // 2) Fallback: suami (L) di atas istri (P).
  const spouseSourceOf = (ps: Partnership): string => {
    const aRooted = parentsByChild.has(ps.partnerAId)
    const bRooted = parentsByChild.has(ps.partnerBId)
    if (aRooted !== bRooted) return aRooted ? ps.partnerAId : ps.partnerBId
    const ga = byIndex.get(ps.partnerAId)?.gender
    const gb = byIndex.get(ps.partnerBId)?.gender
    if (gb === 'P' && ga !== 'P') return ps.partnerAId
    if (ga === 'P' && gb !== 'P') return ps.partnerBId
    return ps.partnerAId
  }

  // Jangkar garis anak (dulu "ibu"):
  // 1) orangtua ber-gender P;
  // 2) bila dua orangtua berpasangan → target pernikahan (sisi istri),
  //    konsisten tanpa peduli urutan klik saat menambahkan anak;
  // 3) fallback: orangtua pertama.
  const anchorOf = (parents: string[]): string | undefined => {
    const valid = parents.filter((p) => byIndex.has(p))
    if (valid.length === 0) return undefined
    const female = valid.find((p) => byIndex.get(p)?.gender === 'P')
    if (female) return female
    if (valid.length === 2) {
      const ps = partnerships.find(
        (x) =>
          (x.partnerAId === valid[0] && x.partnerBId === valid[1]) ||
          (x.partnerAId === valid[1] && x.partnerBId === valid[0]),
      )
      if (ps) {
        const s = spouseSourceOf(ps)
        return s === ps.partnerAId ? ps.partnerBId : ps.partnerAId
      }
    }
    return valid[0]
  }

  // ---------- Layout dagre langsung pada person ----------
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: NODE_GAP, ranksep: RANK_GAP })
  for (const p of persons) g.setNode(p.id, { width: CARD_W, height: CARD_H })

  const seenPair = new Set<string>()
  for (const ps of partnerships) {
    const s = spouseSourceOf(ps)
    const t = s === ps.partnerAId ? ps.partnerBId : ps.partnerAId
    if (!byIndex.has(s) || !byIndex.has(t) || s === t) continue
    const key = `${s}->${t}`
    if (seenPair.has(key)) continue
    seenPair.add(key)
    g.setEdge(s, t)
  }
  for (const [childId, parents] of parentsByChild) {
    const m = anchorOf(parents)
    if (m && byIndex.has(childId) && m !== childId) g.setEdge(m, childId)
  }
  Dagre.layout(g)

  // Posisi person (top-left)
  const posById = new Map<string, { x: number; y: number }>()
  for (const p of persons) {
    const n = g.node(p.id)
    posById.set(p.id, { x: n.x - CARD_W / 2, y: n.y - CARD_H / 2 })
  }

  const { degree, rankByHub } = computeMarriageRanks(partnerships)

  // ---------- Nodes ----------
  const orders = computeBirthOrders(parentsByChild, byIndex)
  const nodes: PersonNode[] = persons.map((p) => {
    let spouseOrder: SpouseOrder | undefined
    for (const ps of partnerships) {
      if (ps.partnerAId !== p.id && ps.partnerBId !== p.id) continue
      const other = ps.partnerAId === p.id ? ps.partnerBId : ps.partnerAId
      if ((degree.get(other) ?? 0) > 1) {
        const r = rankByHub.get(other)?.get(ps.id)
        if (r) {
          spouseOrder = r
          break
        }
      }
    }
    return {
      id: p.id,
      type: 'person',
      position: posById.get(p.id)!,
      data: { person: p, birthOrder: orders.get(p.id), spouseOrder, onAction },
    }
  })

  // ---------- Edges ----------
  const edges: Edge[] = []
  const styleOf = (status: string) =>
    status === 'cerai'
      ? { stroke: '#b0aca6', strokeWidth: 2, strokeDasharray: '6 4' }
      : { stroke: '#d66f9e', strokeWidth: 2 }

  // Garis pernikahan: bezier dari bawah suami/berakar ke atas pasangannya
  for (const ps of partnerships) {
    const s = spouseSourceOf(ps)
    const t = s === ps.partnerAId ? ps.partnerBId : ps.partnerAId
    if (!posById.has(s) || !posById.has(t) || s === t) continue
    edges.push({
      id: `ps:${ps.id}`,
      source: s,
      target: t,
      sourceHandle: 'b',
      targetHandle: 't',
      type: 'default',
      style: styleOf(ps.status),
    })
  }

  // Garis anak: bezier dari bawah ibu ke atas anak
  for (const [childId, parents] of parentsByChild) {
    if (!byIndex.has(childId)) continue
    const anchor = anchorOf(parents)
    if (!anchor) continue
    edges.push({
      id: `pc:${childId}`,
      source: anchor,
      target: childId,
      sourceHandle: 'b',
      targetHandle: 't',
      type: 'default',
    })
  }

  return { nodes, edges }
}
