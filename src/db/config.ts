// Konfigurasi koneksi PostgreSQL — dipakai aplikasi & drizzle-kit.
// Fungsi (bukan konstanta) agar dibaca SETELAH dotenv memuat .env.
export function getDbConfig() {
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
  }
}
