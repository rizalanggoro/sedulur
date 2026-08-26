import ELK from 'elkjs/lib/elk.bundled.js'
import type { Edge, Node } from '@xyflow/react'

import type { FamilyData } from '#/lib/family'
import type { Partnership, Person } from '#/db/schema'

export const CARD_W = 224
export const CARD_H = 96

const RANK_GAP = 110
const NODE_GAP = 56

const elk = new ELK()

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

export async function layoutFamily(
  data: FamilyData,
  onAction?: PersonFlowData['onAction'],
): Promise<{
  nodes: PersonNode[]
  edges: Edge[]
}> {
  const { persons, parentLinks, partnerships } = data
  if (persons.length === 0) return { nodes: [], edges: [] }

  const byIndex = new Map(persons.map((p) => [p.id, p]))

  const parentsByChild = new Map<string, string[]>()
  for (const link of parentLinks) {
    ;(parentsByChild.get(link.childId) ??
      parentsByChild.set(link.childId, []).get(link.childId)!).push(link.parentId)
  }

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

  // ---- Build ELK graph ----
  const elkNodes: { id: string; width: number; height: number }[] = []
  for (const p of persons) {
    elkNodes.push({ id: p.id, width: CARD_W, height: CARD_H })
  }

  const elkEdges: { id: string; sources: string[]; targets: string[] }[] = []

  const seenPair = new Set<string>()
  for (const ps of partnerships) {
    const s = spouseSourceOf(ps)
    const t = s === ps.partnerAId ? ps.partnerBId : ps.partnerAId
    if (!byIndex.has(s) || !byIndex.has(t) || s === t) continue
    const key = `${s}->${t}`
    if (seenPair.has(key)) continue
    seenPair.add(key)
    elkEdges.push({ id: `ps:${ps.id}`, sources: [s], targets: [t] })
  }

  for (const [childId, parents] of parentsByChild) {
    const m = anchorOf(parents)
    if (m && byIndex.has(childId) && m !== childId) {
      elkEdges.push({ id: `pc:${childId}`, sources: [m], targets: [childId] })
    }
  }

  // ---- Layout with ELK ----
  const result = await elk.layout(
    {
      id: 'root',
      children: elkNodes,
      edges: elkEdges,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': String(NODE_GAP),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(RANK_GAP),
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.cycleBreaking.strategy': 'GREEDY',
      },
    },
    { logging: false },
  )

  const posById = new Map<string, { x: number; y: number }>()
  for (const child of result.children ?? []) {
    posById.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
  }

  // ---- Nodes ----------
  const { degree, rankByHub } = computeMarriageRanks(partnerships)
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
      position: posById.get(p.id) ?? { x: 0, y: 0 },
      data: { person: p, birthOrder: orders.get(p.id), spouseOrder, onAction },
    }
  })

  // ---------- Edges ----------
  const edges: Edge[] = []
  const styleOf = (status: string) =>
    status === 'cerai'
      ? { stroke: '#b0aca6', strokeWidth: 2, strokeDasharray: '6 4' }
      : { stroke: '#d66f9e', strokeWidth: 2 }

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
