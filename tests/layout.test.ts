import assert from 'node:assert'
import type { Edge } from '@xyflow/react'
import { CARD_W, layoutFamily } from '#/components/family/layout'

const SPOUSE_GAP = 48

const persons = [
  { id: 'A', fullName: 'Kakek', gender: 'L', birthDate: '1940-01-01', deathDate: null, photoUrl: null, notes: null, createdAt: new Date() },
  { id: 'B', fullName: 'Nenek', gender: 'P', birthDate: '1942-01-01', deathDate: null, photoUrl: null, notes: null, createdAt: new Date() },
  { id: 'C', fullName: 'Anak 1', gender: 'L', birthDate: '1965-01-01', deathDate: null, photoUrl: null, notes: null, createdAt: new Date() },
  { id: 'D', fullName: 'Anak 2', gender: 'P', birthDate: '1968-01-01', deathDate: null, photoUrl: null, notes: null, createdAt: new Date() },
  { id: 'E', fullName: 'Mantan Suami C', gender: 'L', birthDate: '1964-01-01', deathDate: null, photoUrl: null, notes: null, createdAt: new Date() },
  { id: 'F', fullName: 'Cucu', gender: 'P', birthDate: '1990-01-01', deathDate: null, photoUrl: null, notes: null, createdAt: new Date() },
  { id: 'G', fullName: 'Anak Tunggal D', gender: 'L', birthDate: '1995-01-01', deathDate: null, photoUrl: null, notes: null, createdAt: new Date() },
  { id: 'H', fullName: 'H', gender: 'L', birthDate: '2000-01-01', deathDate: null, photoUrl: null, notes: null, createdAt: new Date() },
  { id: 'I', fullName: 'I', gender: 'P', birthDate: '2001-01-01', deathDate: null, photoUrl: null, notes: null, createdAt: new Date() },
  { id: 'J', fullName: 'J', gender: 'L', birthDate: '2002-01-01', deathDate: null, photoUrl: null, notes: null, createdAt: new Date() },
] as const

const data = {
  persons,
  parentLinks: [
    { id: 'l1', childId: 'C', parentId: 'A' },
    { id: 'l2', childId: 'C', parentId: 'B' },
    { id: 'l3', childId: 'D', parentId: 'A' },
    { id: 'l4', childId: 'D', parentId: 'B' },
    { id: 'l5', childId: 'F', parentId: 'C' },
    { id: 'l6', childId: 'F', parentId: 'E' },
    { id: 'l7', childId: 'G', parentId: 'D' },
    { id: 'l8', childId: 'I', parentId: 'A' },
  ],
  partnerships: [
    { id: 'pab', partnerAId: 'A', partnerBId: 'B', status: 'menikah', marriedDate: null },
    { id: 'pce', partnerAId: 'C', partnerBId: 'E', status: 'cerai', marriedDate: null },
    { id: 'phi', partnerAId: 'H', partnerBId: 'I', status: 'menikah', marriedDate: null },
    { id: 'pij', partnerAId: 'I', partnerBId: 'J', status: 'menikah', marriedDate: null },
  ],
} as any

const { nodes, edges } = layoutFamily(data)
const pos = Object.fromEntries(nodes.map((n) => [n.id, n.position]))

assert.equal(nodes.length, 10)

// Pasangan berdampingan & sejajar
const gap = CARD_W + SPOUSE_GAP
assert.ok(Math.abs(pos.A.x - pos.B.x) === gap && pos.A.y === pos.B.y, 'A–B berdampingan')
assert.ok(Math.abs(pos.C.x - pos.E.x) === gap && pos.C.y === pos.E.y, 'C–E berdampingan')

// Generasi turun: kakek-nenek < anak-anak < cucu
assert.ok(pos.A.y < pos.C.y && pos.C.y === pos.D.y && pos.C.y < pos.F.y, 'urutan generasi')

// Rantai pernikahan H–I–J satu baris, tiap pasangan bersebelahan
assert.equal(pos.H.y, pos.I.y)
assert.equal(pos.I.y, pos.J.y)
assert.ok(Math.abs(pos.H.x - pos.I.x) === gap || Math.abs(pos.J.x - pos.I.x) === gap)

const psAB = edges.find((e) => e.id === 'ps:pab')!
assert.equal(psAB.type, 'straight')
assert.ok(['r', 'l'].includes(psAB.sourceHandle!) && ['r', 'l'].includes(psAB.targetHandle!))

const psCE = edges.find((e) => e.id === 'ps:pce')!
assert.deepEqual(psCE.style!.strokeDasharray, '6 4', 'cerai bergaris putus')

const pcF = edges.find((e) => e.id === 'pc:F') as Edge & {
  data: { anchorIds: string[] }
}
assert.equal(pcF.sourceHandle, 'b')
assert.deepEqual([...pcF.data.anchorIds].sort(), ['C', 'E'], 'F menggantung di tengah C+E')

const pcG = edges.find((e) => e.id === 'pc:G') as Edge & {
  data: { anchorIds: string[] }
}
assert.deepEqual(pcG.data.anchorIds, ['D'], 'G dari orangtua tunggal')

// Kosong aman
assert.deepEqual(layoutFamily({ persons: [], parentLinks: [], partnerships: [] }), {
  nodes: [],
  edges: [],
})

console.log('layout OK:', nodes.length, 'nodes,', edges.length, 'edges')
