import { config } from 'dotenv'
import { createRequire } from 'node:module'

config({ path: ['.env.local', '.env'] })
const require = createRequire(import.meta.url)

async function main() {
  const { Client } = require('pg')
  const { getDbConfig } = await import('../src/db/config.ts')
  const c = new Client(getDbConfig())
  await c.connect()
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const persons = (
    await c.query('select * from persons order by created_at')
  ).rows.map((p: any) => ({
    id: p.id,
    fullName: p.full_name,
    gender: p.gender,
    birthDate: p.birth_date ? new Date(p.birth_date).toISOString().slice(0, 10) : null,
    deathDate: null,
    photoUrl: p.photo_url,
    notes: p.notes,
    createdAt: p.created_at,
  }))
  const parentLinks = (await c.query('select id, parent_id as "parentId", child_id as "childId" from parent_links')).rows
  const partnerships = (await c.query('select id, partner_a_id as "partnerAId", partner_b_id as "partnerBId", status from partnerships')).rows
  await c.end()

  const nameOf: Record<string, string> = Object.fromEntries(
    persons.map((p: any) => [p.id, p.fullName]),
  )
  const { layoutFamily } = await import('../src/components/family/layout.ts')
  const { nodes, edges } = layoutFamily({ persons, parentLinks, partnerships })

  console.log('--- POSISI (baris per generasi) ---')
  const rows: Record<number, any[]> = {}
  for (const n of nodes) {
    const k = Math.round(n.position.y)
    ;(rows[k] ??= []).push(n)
  }
  for (const k of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
    console.log(
      rows[k]
        .slice()
        .sort((a, b) => a.position.x - b.position.x)
        .map((n: any) => `${nameOf[n.id.split('#').pop()]}@x=${Math.round(n.position.x)}`)
        .join('  '),
    )
  }
  console.log('--- EDGES ---')
  for (const e of edges) {
    if (e.id.startsWith('ps:'))
      console.log(
        `pasangan ${nameOf[e.source.split('#').pop()!]} ↔ ${nameOf[e.target.split('#').pop()!]}`,
      )
  }
}
main()
