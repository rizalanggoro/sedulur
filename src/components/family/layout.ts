import Dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'

import type { FamilyData } from '#/lib/family'
import type { Person } from '#/db/schema'

export const CARD_W = 224
export const CARD_H = 96

const SPOUSE_GAP = 48
const UNIT_GAP = 64
const RANK_GAP = 110

export type NodeActionKind = 'edit' | 'child' | 'partner' | 'parent'

export type PersonFlowData = {
  person: Person
  onAction?: (kind: NodeActionKind, person: Person) => void
}
export type ChildEdgeData = { anchorIds: string[] }

export type PersonNode = Node<PersonFlowData, 'person'>
export type ChildEdge = Edge<ChildEdgeData, 'child'>

/**
 * Transform data DB menjadi nodes/edges React Flow.
 * Pasangan digabung menjadi satu "unit" saat layout dagre (top-to-bottom),
 * lalu diposisikan berdampingan. Anak menggantung dari titik tengah unit
 * orangtuanya (lihat ChildEdge).
 */
export function layoutFamily(data: FamilyData): {
  nodes: PersonNode[]
  edges: Edge[]
} {
  const { persons, parentLinks, partnerships } = data
  if (persons.length === 0) return { nodes: [], edges: [] }

  // Union-find: setiap pasangan (dan rantai pernikahan) jadi satu unit
  const parentOf = new Map<string, string>()
  for (const p of persons) parentOf.set(p.id, p.id)
  const find = (id: string): string => {
    let root = id
    while (parentOf.get(root) !== root) root = parentOf.get(root)!
    while (parentOf.get(id) !== root) {
      const next = parentOf.get(id)!
      parentOf.set(id, root)
      id = next
    }
    return root
  }
  const union = (a: string, b: string) => {
    parentOf.set(find(a), find(b))
  }

  const partnersOf = new Map<string, string[]>()
  for (const ps of partnerships) {
    union(ps.partnerAId, ps.partnerBId)
    ;(partnersOf.get(ps.partnerAId) ?? partnersOf.set(ps.partnerAId, []).get(ps.partnerAId)!).push(
      ps.partnerBId,
    )
    ;(partnersOf.get(ps.partnerBId) ?? partnersOf.set(ps.partnerBId, []).get(ps.partnerBId)!).push(
      ps.partnerAId,
    )
  }

  const unitsMap = new Map<string, string[]>()
  for (const p of persons) {
    const root = find(p.id)
    ;(unitsMap.get(root) ?? unitsMap.set(root, []).get(root)!).push(p.id)
  }

  // Urutkan anggota unit agar pasangan selalu bersebelahan
  const orderedUnits = new Map<string, string[]>()
  for (const [root, members] of unitsMap) {
    const placed = new Set<string>()
    const out: string[] = []
    const walk = (id: string) => {
      if (placed.has(id)) return
      placed.add(id)
      out.push(id)
      for (const partner of partnersOf.get(id) ?? []) {
        if (members.includes(partner)) walk(partner)
      }
    }
    for (const m of members) walk(m)
    out.push(...members.filter((m) => !placed.has(m)))
    orderedUnits.set(root, out)
  }

  // Layout dagre pada level unit
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: UNIT_GAP, ranksep: RANK_GAP })
  for (const [root, members] of orderedUnits) {
    g.setNode(root, {
      width: members.length * CARD_W + (members.length - 1) * SPOUSE_GAP,
      height: CARD_H,
    })
  }
  const seenUnitEdges = new Set<string>()
  for (const link of parentLinks) {
    const from = find(link.parentId)
    const to = find(link.childId)
    if (!g.hasNode(from) || !g.hasNode(to) || from === to) continue
    const key = `${from}->${to}`
    if (seenUnitEdges.has(key)) continue
    seenUnitEdges.add(key)
    g.setEdge(from, to)
  }
  Dagre.layout(g)

  // Posisi person di dalam unit-nya
  const posById = new Map<string, { x: number; y: number }>()
  for (const [root, members] of orderedUnits) {
    const unit = g.node(root)
    let x = unit.x - unit.width / 2
    const y = unit.y - CARD_H / 2
    for (const id of members) {
      posById.set(id, { x, y })
      x += CARD_W + SPOUSE_GAP
    }
  }

  const byIndex = new Map(persons.map((p) => [p.id, p]))
  const nodes: PersonNode[] = persons.map((p) => ({
    id: p.id,
    type: 'person',
    position: posById.get(p.id)!,
    data: { person: p },
  }))

  const edges: Edge[] = []

  // Garis pasangan (horizontal antar kartu yang bersebelahan)
  for (const ps of partnerships) {
    const a = posById.get(ps.partnerAId)
    const b = posById.get(ps.partnerBId)
    if (!a || !b) continue
    const aIdx = orderedUnits.get(find(ps.partnerAId))!.indexOf(ps.partnerAId)
    const bIdx = orderedUnits.get(find(ps.partnerAId))!.indexOf(ps.partnerBId)
    if (Math.abs(aIdx - bIdx) !== 1) continue
    const [left, right] = a.x < b.x ? [ps.partnerAId, ps.partnerBId] : [ps.partnerBId, ps.partnerAId]
    edges.push({
      id: `ps:${ps.id}`,
      source: left,
      target: right,
      sourceHandle: 'r',
      targetHandle: 'l',
      type: 'straight',
      style:
        ps.status === 'cerai'
          ? { stroke: '#b0aca6', strokeWidth: 1.5, strokeDasharray: '6 4' }
          : { stroke: '#8fb8a8', strokeWidth: 2 },
    })
  }

  // Garis ke anak: satu garis dari titik tengah para orangtua
  const parentsByChild = new Map<string, string[]>()
  for (const link of parentLinks) {
    ;(parentsByChild.get(link.childId) ??
      parentsByChild.set(link.childId, []).get(link.childId)!).push(link.parentId)
  }
  for (const [childId, parents] of parentsByChild) {
    if (!byIndex.has(childId)) continue
    const source = parents.find((p) => posById.has(p))
    if (!source) continue
    edges.push({
      id: `pc:${childId}`,
      source,
      target: childId,
      sourceHandle: 'b',
      targetHandle: 't',
      type: 'child',
      data: { anchorIds: parents.filter((p) => posById.has(p)) },
    } as Edge)
  }

  return { nodes, edges }
}
