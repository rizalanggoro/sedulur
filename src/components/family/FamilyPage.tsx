import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Users, X } from 'lucide-react'

import { getFamily } from '#/lib/family'
import type { ParentLink, Partnership, Person } from '#/db/schema'
import { layoutFamily, computeBirthOrders } from './layout'
import type { NodeActionHandler } from './layout'
import { FamilyCanvas } from './FamilyCanvas'
import { PersonDialog, type PersonDialogState } from './PersonDialog'
import { Button } from '#/components/ui/button'

export function FamilyPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['family'],
    queryFn: () => getFamily(),
  })

  // Tombol "Tambah Anggota" di header (tampil saat silsilah masih kosong)
  useEffect(() => {
    const open = () => openDialog({ mode: 'create' })
    window.addEventListener('sedulur:tambah-anggota', open)
    return () => window.removeEventListener('sedulur:tambah-anggota', open)
  }, [])

  const [dialog, setDialog] = useState<PersonDialogState>(null)
  const [dialogKey, setDialogKey] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)

  const openDialog = (next: PersonDialogState) => {
    setDialog(next)
    setDialogKey((k) => k + 1)
  }

  // Stabil: dibuat sekali agar identitasnya aman dipakai di dalam node data.
  const dataRef = useRef(data)
  dataRef.current = data
  const handleNodeAction = useCallback<NodeActionHandler>((kind, person) => {
    const d = dataRef.current
    if (!d) return
    if (kind === 'view') {
      setDetailId(person.id)
      return
    }
    if (kind === 'edit') {
      setDetailId(null)
      openDialog({ mode: 'edit', person })
      return
    }
    if (kind === 'child') {
      // Sertakan pasangan pertama sebagai orangtua kedua bila ada.
      const partnership = d.partnerships.find(
        (ps) => ps.partnerAId === person.id || ps.partnerBId === person.id,
      )
      const spouseId =
        partnership?.partnerAId === person.id
          ? partnership?.partnerBId
          : partnership?.partnerAId
      openDialog({
        mode: 'create',
        relation: {
          kind: 'child',
          person,
          parentIds: spouseId ? [person.id, spouseId] : [person.id],
        },
      })
      return
    }
    openDialog({ mode: 'create', relation: { kind, person } })
  }, [])

  const { nodes, edges } = useMemo(
    () => (data ? layoutFamily(data, handleNodeAction) : { nodes: [], edges: [] }),
    [data, handleNodeAction],
  )

  const isEmpty = !isPending && data !== undefined && data.persons.length === 0

  return (
    <TreeShell>
      {isPending && (
        <div className="flex h-full items-center justify-center text-sm text-[var(--sea-ink-soft)]">
          Memuat silsilah…
        </div>
      )}

      {isError && (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-red-700">
          <p>Gagal memuat data silsilah.</p>
          <p className="m-0 text-xs opacity-70">{error.message}</p>
        </div>
      )}

      {isEmpty && (
        <div className="flex h-full items-center justify-center p-6">
          <div className="island-shell rise-in max-w-md rounded-[2rem] px-8 py-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sand)] text-[var(--palm)]">
              <Users size={26} />
            </div>
            <h2 className="mb-2 text-xl font-bold text-[var(--sea-ink)]">
              Mulai Silsilah Keluarga Anda
            </h2>
            <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
              Belum ada anggota keluarga. Tambahkan anggota pertama untuk mulai
              membangun silsilah.
            </p>
            <Button onClick={() => openDialog({ mode: 'create' })}>
              <Plus size={16} /> Tambah Anggota Pertama
            </Button>
          </div>
        </div>
      )}

      {!isPending && !isError && !isEmpty && (
        <FamilyCanvas nodes={nodes} edges={edges} />
      )}

      {dialog && (
        <PersonDialog
          key={dialogKey}
          state={dialog}
          persons={data?.persons ?? []}
          onClose={() => setDialog(null)}
        />
      )}

      {detailId && (
        <DetailPanel
          person={data?.persons.find((p) => p.id === detailId)}
          family={data ?? null}
          onEdit={(p) => handleNodeAction('edit', p)}
          onClose={() => setDetailId(null)}
        />
      )}
    </TreeShell>
  )
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function formatTanggal(iso: string | null | undefined) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${BULAN[m - 1]} ${y}`
}

function DetailPanel({
  person,
  family,
  onEdit,
  onClose,
}: {
  person?: Person
  family: { persons: Person[]; parentLinks: ParentLink[]; partnerships: Partnership[] } | null
  onEdit: (p: Person) => void
  onClose: () => void
}) {
  if (!person || !family) return null

  const byId = new Map(family.persons.map((p) => [p.id, p]))
  const parentsByChild = new Map<string, string[]>()
  for (const l of family.parentLinks) {
    ;(parentsByChild.get(l.childId) ?? parentsByChild.set(l.childId, []).get(l.childId)!).push(
      l.parentId,
    )
  }
  const order = computeBirthOrders(parentsByChild, byId).get(person.id)
  const nama = (id: string) => family.persons.find((p) => p.id === id)?.fullName ?? '—'
  const ortu = family.parentLinks.filter((l) => l.childId === person.id)
  const anak = family.parentLinks.filter((l) => l.parentId === person.id)
  const pasangan = family.partnerships
    .filter((ps) => ps.partnerAId === person.id || ps.partnerBId === person.id)
    .map((ps) => ({
      orang: ps.partnerAId === person.id ? ps.partnerBId : ps.partnerAId,
      status: ps.status,
    }))

  const lahir = formatTanggal(person.birthDate)
  const wafat = formatTanggal(person.deathDate)

  return (
    <aside className="absolute right-4 top-4 z-20 max-h-[calc(100%-2rem)] w-80 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-5 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {person.photoUrl ? (
            <img
              src={person.photoUrl}
              alt={person.fullName}
              className="h-14 w-14 rounded-full border border-[var(--line)] object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sand)] text-base font-bold text-[var(--palm)]">
              {person.fullName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
            </div>
          )}
          <div>
            <h3 className="m-0 text-base font-bold leading-tight text-[var(--sea-ink)]">
              {person.fullName}
            </h3>
            <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
              {person.gender === 'L' ? 'Laki-laki' : person.gender === 'P' ? 'Perempuan' : '—'}
            </p>
            {order && (
              <p className="m-0 text-xs font-medium text-[var(--palm)]">
                Anak ke-{order.rank} dari {order.total} bersaudara
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="rounded-full p-1.5 text-[var(--sea-ink-soft)] transition hover:bg-[var(--sand)] hover:text-[var(--sea-ink)]"
        >
          <X size={16} />
        </button>
      </div>

      <dl className="m-0 grid gap-1 text-sm">
        {lahir && (
          <div className="flex gap-2">
            <dt className="w-16 flex-shrink-0 text-[var(--sea-ink-soft)]">Lahir</dt>
            <dd className="m-0 font-medium text-[var(--sea-ink)]">{lahir}</dd>
          </div>
        )}
        {wafat && (
          <div className="flex gap-2">
            <dt className="w-16 flex-shrink-0 text-[var(--sea-ink-soft)]">Wafat</dt>
            <dd className="m-0 font-medium text-[var(--sea-ink)]">{wafat}</dd>
          </div>
        )}
      </dl>

      {(ortu.length > 0 || pasangan.length > 0 || anak.length > 0) && (
        <div className="mt-4 grid gap-2 border-t border-[var(--line)] pt-4 text-sm">
          {ortu.length > 0 && (
            <div>
              <p className="island-kicker m-0 mb-1 text-xs">Orangtua</p>
              <ul className="m-0 list-none space-y-0.5 p-0 text-[var(--sea-ink)]">
                {ortu.map((l) => (
                  <li key={l.id}>{nama(l.parentId)}</li>
                ))}
              </ul>
            </div>
          )}
          {pasangan.length > 0 && (
            <div>
              <p className="island-kicker m-0 mb-1 text-xs">Pasangan</p>
              <ul className="m-0 list-none space-y-0.5 p-0 text-[var(--sea-ink)]">
                {pasangan.map((ps, i) => (
                  <li key={i}>
                    {nama(ps.orang)}
                    <span className="text-xs text-[var(--sea-ink-soft)]">
                      {' '}
                      ({ps.status === 'cerai' ? 'cerai' : 'menikah'})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {anak.length > 0 && (
            <div>
              <p className="island-kicker m-0 mb-1 text-xs">Anak</p>
              <ul className="m-0 list-none space-y-0.5 p-0 text-[var(--sea-ink)]">
                {anak.map((l) => (
                  <li key={l.id}>{nama(l.childId)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {person.notes && (
        <p className="mb-0 mt-4 whitespace-pre-wrap rounded-xl bg-[var(--foam)] p-3 text-sm leading-relaxed text-[var(--sea-ink-soft)]">
          {person.notes}
        </p>
      )}

      <Button
        variant="outline"
        className="mt-4 w-full"
        onClick={() => onEdit(person)}
      >
        <Pencil size={14} /> Ubah Data
      </Button>
    </aside>
  )
}

/** Kontainer kanvas memenuhi seluruh layar di bawah header. */
function TreeShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const calc = () => {
      const header = document.querySelector('header')?.getBoundingClientRect().height ?? 0
      el.style.height = `calc(100dvh - ${Math.round(header)}px)`
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  return (
    <main className="relative w-full overflow-hidden" ref={ref}>
      {children}
    </main>
  )
}
