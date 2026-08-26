import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Baby, Eye, Heart, Search, Table2, ArrowUp } from 'lucide-react'

import { getFamily } from '#/lib/family'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  PersonDialog,
  type PersonDialogState,
} from '#/components/family/PersonDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import type { Person } from '#/db/schema'

function validateSearch(search: Record<string, unknown>) {
  return { id: (search.id as string) || undefined }
}

export const Route = createFileRoute('/tabel')({
  validateSearch,
  component: TabelPage,
})

function TabelPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['family'],
    queryFn: () => getFamily(),
  })
  const { id: anchorId } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [q, setQ] = useState('')
  const [dialog, setDialog] = useState<PersonDialogState>(null)
  const [dialogKey, setDialogKey] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)

  const openDialog = (next: PersonDialogState) => {
    setDialog(next)
    setDialogKey((k) => k + 1)
  }

  const persons = data?.persons ?? []
  const query = q.trim().toLowerCase()
  const results = query
    ? persons
        .filter((p) => p.fullName.toLowerCase().includes(query))
        .slice(0, 7)
    : []
  const anchor = persons.find((p) => p.id === anchorId) ?? null

  const setAnchorId = (id: string | null) => {
    navigate({ search: { id: id || undefined } })
  }

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
    return [...ortu, ...pasangan, ...anak]
      .map((r) => ({
        ...r,
        nama: nama(r.id),
        lahir: tahun(r.id),
      }))
      .sort((a, b) => (a.lahir === '—' ? 1 : b.lahir === '—' ? -1 : a.lahir.localeCompare(b.lahir)))
  })()

  const spouseIdOf = (person: Person) => {
    const ps = data?.partnerships.find(
      (x) => x.partnerAId === person.id || x.partnerBId === person.id,
    )
    return ps ? (ps.partnerAId === person.id ? ps.partnerBId : ps.partnerAId) : null
  }

  return (
    <main className="px-4 pb-16 pt-8 max-w-[1080px] mx-auto">
      <section className="mb-6 rounded-2xl border border-border bg-card px-6 py-8 shadow-sm sm:px-8">
        <p className="mb-2 text-xs text-muted-foreground uppercase tracking-wide">Tabel Keluarga</p>
        <h1 className="mb-2 text-3xl font-bold text-card-foreground sm:text-4xl">
          Telusuri Per Relasi
        </h1>
        <p className="m-0 max-w-2xl text-sm text-muted-foreground">
          Masukkan nama sebagai titik acuan, lalu lihat orang tua, pasangan, dan
          anaknya dalam bentuk tabel. Klik nama lain untuk menjadikannya acuan baru.
        </p>
      </section>

      {isPending && (
        <p className="text-center text-sm text-muted-foreground">Memuat data…</p>
      )}
      {isError && (
        <p className="text-center text-sm text-destructive">Gagal memuat data silsilah.</p>
      )}

      {!isPending && !isError && !anchor && (
        <section className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
          <label htmlFor="cari-anchor" className="mb-2 block text-sm font-semibold text-card-foreground">
            Nama acuan
          </label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="cari-anchor"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="cth. Muh Sinun"
              className="pl-9"
            />
          </div>
          {results.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setAnchorId(p.id)
                    setQ('')
                  }}
                  className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm text-card-foreground transition hover:bg-secondary"
                >
                  {p.fullName}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.birthDate?.slice(0, 4) ?? '—'}
                  </span>
                </button>
              ))}
            </div>
          )}
          {query && results.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Tidak ada nama yang cocok.
            </p>
          )}
        </section>
      )}

      {!isPending && !isError && anchor && (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Table2 size={18} />
              </div>
              <div>
                <p className="m-0 text-xs text-muted-foreground uppercase tracking-wide">Acuan saat ini</p>
                <p className="m-0 text-base font-bold text-card-foreground">
                  {anchor.fullName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailId(anchor.id)}
              >
                <Eye size={14} /> Detail
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAnchorId(null)
                  setQ('')
                }}
              >
                Ganti Acuan
              </Button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                openDialog({
                  mode: 'create',
                  relation: {
                    kind: 'child',
                    person: anchor,
                    parentIds: [anchor.id, ...(spouseIdOf(anchor) ? [spouseIdOf(anchor)!] : [])],
                  },
                })
              }
            >
              <Baby size={14} /> Tambah Anak
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openDialog({ mode: 'create', relation: { kind: 'partner', person: anchor } })}
            >
              <Heart size={14} /> Tambah Pasangan
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openDialog({ mode: 'create', relation: { kind: 'parent', person: anchor } })}
            >
              <ArrowUp size={14} /> Tambah Orang Tua
            </Button>
          </div>

          {rows.length === 0 ? (
            <p className="m-0 py-8 text-center text-sm text-muted-foreground">
              Belum ada relasi tercatat untuk {anchor.fullName}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Relasi</th>
                    <th className="px-3 py-2.5">Nama</th>
                    <th className="px-3 py-2.5">Tahun Lahir</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={`${r.relasi}-${r.id}`}
                      className="border-b border-border transition last:border-0 hover:bg-secondary/50"
                    >
                      <td className="px-3 py-2.5 font-medium text-primary">{r.relasi}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          title={`Jadikan ${r.nama} sebagai acuan`}
                          onClick={() => setAnchorId(r.id)}
                          className="cursor-pointer font-semibold text-card-foreground underline underline-offset-4 decoration-primary decoration-2 transition hover:text-primary/80"
                        >
                          {r.nama}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.lahir}</td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          title={`Lihat detail ${r.nama}`}
                          onClick={() => setDetailId(r.id)}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Klik nama untuk menjadikannya acuan, klik tombol <b>Detail</b> untuk melihat informasi lengkap.
            </p>
          )}
        </section>
      )}

      {dialog && (
        <PersonDialog
          key={dialogKey}
          state={dialog}
          persons={persons}
          onClose={() => setDialog(null)}
        />
      )}

      {detailId && (() => {
        const person = persons.find((p) => p.id === detailId)
        if (!person || !data) return null
        const nama = (id: string) => persons.find((p) => p.id === id)?.fullName ?? '—'
        const ortu = data.parentLinks.filter((l) => l.childId === person.id)
        const anak = data.parentLinks.filter((l) => l.parentId === person.id)
        const pasangan = data.partnerships
          .filter((ps) => ps.partnerAId === person.id || ps.partnerBId === person.id)
          .map((ps) => ({
            orang: ps.partnerAId === person.id ? ps.partnerBId : ps.partnerAId,
            status: ps.status,
          }))
        return (
          <Dialog open onOpenChange={() => setDetailId(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {person.photoUrl ? (
                    <img src={person.photoUrl} alt={person.fullName} className="h-12 w-12 rounded-full border border-border object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                      {person.fullName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                    </div>
                  )}
                  <div>
                    <DialogTitle>{person.fullName}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      {person.gender === 'L' ? 'Laki-laki' : person.gender === 'P' ? 'Perempuan' : '—'}
                    </p>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {(person.birthDate || person.deathDate) && (
                  <div className="grid gap-1">
                    {person.birthDate && (
                      <div className="flex gap-2">
                        <span className="w-20 text-muted-foreground">Lahir</span>
                        <span className="font-medium">{person.birthDate}</span>
                      </div>
                    )}
                    {person.deathDate && (
                      <div className="flex gap-2">
                        <span className="w-20 text-muted-foreground">Wafat</span>
                        <span className="font-medium">{person.deathDate}</span>
                      </div>
                    )}
                  </div>
                )}
                {ortu.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground uppercase tracking-wide">Orang Tua</p>
                    <ul className="list-none space-y-0.5 p-0">
                      {ortu.map((l) => <li key={l.id}>{nama(l.parentId)}</li>)}
                    </ul>
                  </div>
                )}
                {pasangan.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground uppercase tracking-wide">Pasangan</p>
                    <ul className="list-none space-y-0.5 p-0">
                      {pasangan.map((ps, i) => (
                        <li key={i}>
                          {nama(ps.orang)}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({ps.status === 'cerai' ? 'cerai' : 'menikah'})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {anak.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground uppercase tracking-wide">Anak</p>
                    <ul className="list-none space-y-0.5 p-0">
                      {anak.map((l) => <li key={l.id}>{nama(l.childId)}</li>)}
                    </ul>
                  </div>
                )}
                {person.notes && (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground uppercase tracking-wide">Catatan</p>
                    <p className="whitespace-pre-wrap text-card-foreground">{person.notes}</p>
                  </div>
                )}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setDetailId(null)}>
                Tutup
              </Button>
            </DialogContent>
          </Dialog>
        )
      })()}
    </main>
  )
}
