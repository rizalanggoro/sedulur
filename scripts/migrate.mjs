// Menjalankan migrasi drizzle sebelum aplikasi start (dipakai entrypoint Docker).
// Idempoten: migrasi yang sudah jalan dilewati (dicatat di tabel __drizzle_migrations).
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'

const pool = new pg.Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
  console.log('[migrate] migrasi database selesai')
} finally {
  await pool.end()
}
