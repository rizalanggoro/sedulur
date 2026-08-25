import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Tentang</p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Sedulur — Silsilah Keluarga
        </h1>
        <div className="m-0 max-w-3xl space-y-3 text-base leading-8 text-[var(--sea-ink-soft)]">
          <p>
            Sedulur membantu Anda membangun dan melihat silsilah keluarga secara
            interaktif: tambahkan anggota, hubungkan relasi orangtua–anak dan
            pasangan, lalu jelajahi seluruh pohon keluarga dengan pan dan zoom.
          </p>
          <p>
            Klik kartu anggota untuk mengubah datanya, atau gunakan tombol aksi
            pada kartu untuk menambah anak, pasangan, maupun orangtua secara
            cepat.
          </p>
        </div>
      </section>
    </main>
  )
}
