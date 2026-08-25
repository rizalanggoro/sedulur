// ONE-OFF: tandai migrasi yang sudah diterapkan via `db:push` sebagai baseline,
// agar `migrate` tidak mencoba membuat tabel yang sudah ada.
// Cara pakai: node --env-file=.env.local scripts/baseline.mjs
import crypto from 'node:crypto'
import fs from 'node:fs'
import pg from 'pg'

const journal = JSON.parse(fs.readFileSync('./drizzle/meta/_journal.json', 'utf8'))
const pool = new pg.Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

try {
  await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle')
  await pool.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id serial PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`)
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations')
  if (rows[0].n > 0) {
    console.log('jurnal migrasi sudah ada, baseline dilewati')
  } else {
    for (const entry of journal.entries) {
      const query = fs.readFileSync(`./drizzle/${entry.tag}.sql`, 'utf8')
      const hash = crypto.createHash('sha256').update(query).digest('hex')
      await pool.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [hash, entry.when],
      )
      console.log('baseline:', entry.tag)
    }
  }
} finally {
  await pool.end()
}
