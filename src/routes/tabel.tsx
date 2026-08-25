import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Search, Table2 } from 'lucide-react'

import { getFamily } from '#/lib/family'
import { Button } from '#/components/ui/button'

export const Route = createFileRoute('/tabel')({ component: TabelPage })

function TabelPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['family'],
    queryFn: () => getFamily(),
  })
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const persons = data?.persons ?? []
  const query = q.trim().toLowerCase()
  const results = query
    ? persons
        .filter((p) => p.fullName.toLowerCase().includes(query))
        .slice(0, 7)
    : []
  const anchor = persons.find((p) => p.id === anchorId) ?? null

  const nama = (id: string) => persons.find((p) => p.id === id)?.fullName ?? '—'
  const tahun = (id: string) => persons.find((p) => p.id === id)?.birthDate?.slice(0, 4) ?? '—'

  const rows = (() => {
    if (!data || !anchor) return []
    const ortu = data.parentLinks
      .filter((l) => l.childId === anchor.id)
      .map((l) => ({ relasi: 'Orang Tua', id: l.parentId }))
    const pasangan = data.partnerships
      .filter((ps) => ps.partnerAId === anchor.id || ps.partnerBId === anchor.id)
      .map((ps) => ({
        relasi: 'Pasangan',
        id: ps.partnerAId === anchor.id ? ps.partnerBId : ps.partnerAId,
      }))
    const anak = data.parentLinks
      .filter((l) => l.parentId === anchor.id)
      .map((l) => ({ relasi: 'Anak', id: l.childId }))
    return [...ortu, ...pasangan, ...anak].map((r) => ({
      ...r,
      nama: nama(r.id),
      lahir: tahun(r.id),
    }))
  })()

  return (
    <main className="page-wrap px-4 pb-16 pt-8">
      <section className="island-shell rise-in mb-6 rounded-[2rem] px-6 py-8 sm:px-8">
        <p className="island-kicker mb-2">Tabel Keluarga</p>
        <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          Telusuri Per Relasi
        </h1>
        <p className="m-0 max-w-2xl text-sm text-[var(--sea-ink-soft)]">
          Masukkan nama sebagai titik acuan, lalu lihat orang tua, pasangan, dan
          anaknya dalam bentuk tabel. Klik nama lain untuk menjadikannya acuan baru.
        </p>
      </section>

      {isPending && (
        <p className="text-center text-sm text-[var(--sea-ink-soft)]">Memuat data…</p>
      )}
      {isError && (
        <p className="text-center text-sm text-red-700">Gagal memuat data silsilah.</p>
      )}

      {!isPending && !isError && !anchor && (
        <section className="island-shell mx-auto max-w-xl rounded-2xl p-6">
          <label htmlFor="cari-anchor" className="mb-2 block text-sm font-semibold text-[var(--sea-ink)]">
            Nama acuan
          </label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sea-ink-soft)]"
            />
            <input
              id="cari-anchor"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="cth. Muh Sinun"
              className="w-full rounded-full border border-[var(--line)] bg-white/70 py-2.5 pl-9 pr-3 text-sm text-[var(--sea-ink)] outline-none focus:ring-2 focus:ring-[var(--lagoon)]"
            />
          </div>
          {results.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-[var(--line)] bg-white/80">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setAnchorId(p.id)
                    setQ('')
                  }}
                  className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm text-[var(--sea-ink)] transition hover:bg-[var(--sand)]"
                >
                  {p.fullName}
                  <span className="ml-2 text-xs text-[var(--sea-ink-soft)]">
                    {p.birthDate?.slice(0, 4) ?? '—'}
                  </span>
                </button>
              ))}
            </div>
          )}
          {query && results.length === 0 && (
            <p className="mt-2 text-sm text-[var(--sea-ink-soft)]">
              Tidak ada nama yang cocok.
            </p>
          )}
        </section>
      )}

      {!isPending && !isError && anchor && (
        <section className="island-shell rounded-2xl p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sand)] text-[var(--palm)]">
                <Table2 size={18} />
              </div>
              <div>
                <p className="island-kicker m-0 text-xs">Acuan saat ini</p>
                <p className="m-0 text-base font-bold text-[var(--sea-ink)]">
                  {anchor.fullName}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setAnchorId(null)
                setQ('')
              }}
            >
              Ganti Acuan
            </Button>
          </div>

          {rows.length === 0 ? (
            <p className="m-0 py-8 text-center text-sm text-[var(--sea-ink-soft)]">
              Belum ada relasi tercatat untuk {anchor.fullName}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-wide text-[var(--sea-ink-soft)]">
                    <th className="px-3 py-2.5">Relasi</th>
                    <th className="px-3 py-2.5">Nama</th>
                    <th className="px-3 py-2.5">Tahun Lahir</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={`${r.relasi}-${r.id}`}
                      className="border-b border-[var(--line)] transition last:border-0 hover:bg-[var(--foam)]"
                    >
                      <td className="px-3 py-2.5 font-medium text-[var(--palm)]">{r.relasi}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          title={`Jadikan ${r.nama} sebagai acuan`}
                          onClick={() => setAnchorId(r.id)}
                          className="cursor-pointer font-semibold text-[var(--sea-ink)] underline decoration-[var(--lagoon)] decoration-2 underline-offset-4 transition hover:text-[var(--lagoon-deep)]"
                        >
                          {r.nama}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--sea-ink-soft)]">{r.lahir}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
