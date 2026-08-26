import { tree as d3tree, hierarchy, type HierarchyPointNode } from 'd3-hierarchy'
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

type TreeNode = { id: string; children: TreeNode[] }

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

  // ---- Build parent→child tree from anchorOf ----
  const childrenOf = new Map<string, string[]>()
  const hasParent = new Set<string>()
  for (const [childId, parents] of parentsByChild) {
    const anchor = anchorOf(parents)
    if (!anchor || anchor === childId || !byIndex.has(childId)) continue
    const list = childrenOf.get(anchor) ?? []
    list.push(childId)
    childrenOf.set(anchor, list)
    hasParent.add(childId)
  }

  // ---- Partnership wives as tree children of their husband ----
  // For each partnership where the source (husband) is in the tree,
  // add the target (wife) as a child so d3 positions her below him.
  const seenPair = new Set<string>()
  const wifeChildrenOf = new Map<string, string[]>()
  for (const ps of partnerships) {
    const s = spouseSourceOf(ps)
    const t = s === ps.partnerAId ? ps.partnerBId : ps.partnerAId
    if (!byIndex.has(s) || !byIndex.has(t) || s === t) continue
    const key = [s, t].sort().join('->')
    if (seenPair.has(key)) continue
    seenPair.add(key)

    // Only add wife as tree child if she's NOT already in the tree
    // (not a parent in any parent-child link, and not a child of anyone)
    if (!hasParent.has(t) && !parentsByChild.has(t)) {
      const list = wifeChildrenOf.get(s) ?? []
      list.push(t)
      wifeChildrenOf.set(s, list)
    }
  }

  // Merge wife children into childrenOf
  for (const [sId, wives] of wifeChildrenOf) {
    const list = childrenOf.get(sId) ?? []
    list.push(...wives)
    childrenOf.set(sId, list)
  }

  // ---- Forest: roots = nodes with no parent in tree ----
  const treeIds = new Set([...childrenOf.keys(), ...hasParent])
  const roots: string[] = []
  for (const id of treeIds) {
    if (!hasParent.has(id)) roots.push(id)
  }
  // Orphan nodes (no parent-child links at all)
  for (const p of persons) {
    if (!treeIds.has(p.id)) roots.push(p.id)
  }

  // ---- Build d3 hierarchy nodes ----
  const build = (id: string): TreeNode => ({
    id,
    children: (childrenOf.get(id) ?? []).map(build),
  })

  const forest: TreeNode = { id: '__root__', children: roots.map(build) }
  const root = hierarchy(forest)

  // ---- Run d3 tree layout ----
  const nodeSize = [CARD_W + NODE_GAP, CARD_H + RANK_GAP] as [number, number]
  const treeLayout = d3tree<TreeNode>().nodeSize(nodeSize)
  const laid = treeLayout(root) as HierarchyPointNode<TreeNode>

  // ---- Map positions (d3 center → top-left) ----
  const posById = new Map<string, { x: number; y: number }>()
  for (const n of laid.descendants()) {
    if (n.data.id === '__root__') continue
    posById.set(n.data.id, {
      x: n.x - CARD_W / 2,
      y: n.y - CARD_H / 2,
    })
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
