import assert from 'node:assert'
import type { Edge } from '@xyflow/react'
import { layoutFamily, type PersonNode } from '#/components/family/layout'

const mkP = (id: string, gender = 'L', birthDate: string | null = null): PersonNode['data']['person'] =>
  ({
    id,
    fullName: id,
    gender,
    birthDate,
    deathDate: null,
    photoUrl: null,
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }) as PersonNode['data']['person']

const persons = [
  mkP('A', 'L', '1940-01-01'), // ayah
  mkP('B', 'P', '1942-01-01'), // ibu
  mkP('C', 'L', '1965-01-01'),
  mkP('D', 'P', '1968-01-01'),
  mkP('E', 'L', '1964-01-01'),
  mkP('F', 'P', '1990-01-01'),
  mkP('G', 'L', '1995-01-01'),
]

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
  ],
  partnerships: [
    { id: 'pab', partnerAId: 'A', partnerBId: 'B', status: 'menikah', marriedDate: null },
    { id: 'pce', partnerAId: 'C', partnerBId: 'E', status: 'cerai', marriedDate: null },
  ],
} as any

const { nodes, edges } = layoutFamily(data)
const pos = Object.fromEntries(nodes.map((n) => [n.id, n.position]))
const cardOf = (id: string) => nodes.find((n) => n.id === id)!

// Setiap orang tepat satu kartu
assert.equal(nodes.length, persons.length)

// Istri di bawah suami (garis pernikahan vertikal)
assert.equal(pos.B.x, pos.A.x, 'B tepat di bawah A')
assert.ok(pos.B.y > pos.A.y)

// Anak di bawah ibu
assert.ok(pos.C.y > pos.B.y && pos.D.y > pos.B.y, 'anak di bawah ibu')

// Generasi berurutan
assert.ok(pos.B.y < pos.C.y && pos.C.y < pos.F.y, 'generasi turun')

// Garis pernikahan ada & gaya cerai putus-putus
assert.ok(edges.some((e) => e.id === 'ps:pab'))
const psCE = edges.find((e) => e.id === 'ps:pce')!
assert.deepEqual(psCE.style!.strokeDasharray, '6 4', 'cerai bergaris putus')

// Garis anak bercabang dari IBU
const pcC = edges.find((e) => e.id === 'pc:C')!
assert.equal(pcC.source, 'B', 'C menggantung di ibunya')

// G anak tunggal dari D (ibu) → jangkar D
const pcG = edges.find((e) => e.id === 'pc:G')!
assert.equal(pcG.source, 'D')

// Urutan saudara: badge anak ke-N tetap dari tanggal lahir (posisi x diserahkan ke dagre)
assert.deepEqual(cardOf('C').data.birthOrder, { rank: 1, total: 2 })
assert.deepEqual(cardOf('D').data.birthOrder, { rank: 2, total: 2 })

console.log('layout OK:', nodes.length, 'nodes,', edges.length, 'edges')

// ============ Pasangan bebas menggantung DI BAWAH anak yang berakar ============
const mData = {
  persons: [mkP('A', 'L'), mkP('B', 'P'), mkP('C', 'P', '1990-01-01'), mkP('M', 'L')],
  parentLinks: [
    { id: 'r1', childId: 'C', parentId: 'A' },
    { id: 'r2', childId: 'C', parentId: 'B' },
  ],
  partnerships: [
    { id: 'pab', partnerAId: 'A', partnerBId: 'B', status: 'menikah', marriedDate: null },
    { id: 'pcm', partnerAId: 'M', partnerBId: 'C', status: 'menikah', marriedDate: null },
  ],
} as any
const mLayout = layoutFamily(mData)
const mPos = Object.fromEntries(mLayout.nodes.map((n) => [n.id, n.position]))
const mEdge = mLayout.edges.find((e) => e.id === 'ps:pcm')!
assert.equal(mEdge.source, 'C', 'yang berakar (C) menjadi sumber garis')
assert.equal(mEdge.target, 'M')
assert.ok(mPos.M.y > mPos.C.y, 'Misal/pasangan bebas di bawah C')
console.log('pasangan bebas OK')

// ================= KASUS POLIGAMI: H + 3 istri, tiap istri 1 anak =================
const polyData = {
  persons: [mkP('H'), mkP('W1', 'P'), mkP('W2', 'P'), mkP('W3', 'P'), mkP('K1', 'P'), mkP('K2'), mkP('K3')],
  parentLinks: [
    { id: 'q1', childId: 'K1', parentId: 'H' },
    { id: 'q2', childId: 'K1', parentId: 'W1' },
    { id: 'q3', childId: 'K2', parentId: 'H' },
    { id: 'q4', childId: 'K2', parentId: 'W2' },
    { id: 'q5', childId: 'K3', parentId: 'H' },
    { id: 'q6', childId: 'K3', parentId: 'W3' },
  ],
  partnerships: [
    { id: 'm1', partnerAId: 'H', partnerBId: 'W1', status: 'menikah', marriedDate: null },
    { id: 'm2', partnerAId: 'H', partnerBId: 'W2', status: 'menikah', marriedDate: null },
    { id: 'm3', partnerAId: 'H', partnerBId: 'W3', status: 'menikah', marriedDate: null },
  ],
} as any

const poly = layoutFamily(polyData)
const ppos = Object.fromEntries(poly.nodes.map((n) => [n.id, n.position]))

// Satu kartu per orang
assert.equal(poly.nodes.filter((n) => n.data.person.id === 'H').length, 1)

// Ketiga garis pernikahan tergambar, semuanya H → istri
const psEdges = poly.edges.filter((e) => e.id.startsWith('ps:'))
assert.equal(psEdges.length, 3)
for (const e of psEdges as Edge[]) assert.equal(e.source, 'H')

// Ketiga istri sejajar di bawah H (full auto dagre — tanpa jaminan urutan x)
for (const w of ['W1', 'W2', 'W3']) {
  assert.ok(ppos[w].y > ppos.H.y, `${w} di bawah H`)
}
assert.equal(ppos.W1.y, ppos.W2.y)
assert.equal(ppos.W2.y, ppos.W3.y)

// Tiap anak bergantung di ibunya masing-masing
for (const [kid, wife] of [
  ['K1', 'W1'],
  ['K2', 'W2'],
  ['K3', 'W3'],
] as const) {
  const e = poly.edges.find((x) => x.id === `pc:${kid}`)!
  assert.equal(e.source, wife, `${kid} bergantung di ${wife}`)
  assert.ok(ppos[kid].y > ppos[wife].y)
}

console.log('poligami OK:', poly.nodes.length, 'nodes,', poly.edges.length, 'edges')

// Kosong aman
assert.deepEqual(layoutFamily({ persons: [], parentLinks: [], partnerships: [] }), {
  nodes: [],
  edges: [],
})

console.log('semua tes layout lolos')
