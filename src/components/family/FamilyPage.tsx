import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Edge } from '@xyflow/react'
import { Pencil, Plus, Users, X } from 'lucide-react'

import { getFamily, linkParentToChild } from '#/lib/family'
import type { ParentLink, Partnership, Person } from '#/db/schema'
import { layoutFamily, computeBirthOrders, type PersonNode } from './layout'
import type { NodeActionHandler } from './layout'
import { FamilyCanvas } from './FamilyCanvas'
import { PersonDialog, type PersonDialogState } from './PersonDialog'
import { Button } from '#/components/ui/button'

export function FamilyPage() {
  const qc = useQueryClient()
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['family'],
    queryFn: () => getFamily(),
  })

  useEffect(() => {
    const open = () => openDialog({ mode: 'create' })
    window.addEventListener('sedulur:tambah-anggota', open)
    return () => window.removeEventListener('sedulur:tambah-anggota', open)
  }, [])

  const [dialog, setDialog] = useState<PersonDialogState>(null)
  const [dialogKey, setDialogKey] = useState(0)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeDetail = useCallback(() => {
    setClosing(true)
    closingTimerRef.current = setTimeout(() => {
      setDetailId(null)
      setClosing(false)
    }, 300)
  }, [])

  useEffect(() => {
    return () => {
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current)
    }
  }, [])

  const openDialog = (next: PersonDialogState) => {
    setDialog(next)
    setDialogKey((k) => k + 1)
  }

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

  const [flowNodes, setFlowNodes] = useState<PersonNode[]>([])
  const [flowEdges, setFlowEdges] = useState<Edge[]>([])

  useEffect(() => {
    if (!data) return
    let cancelled = false
    layoutFamily(data, handleNodeAction).then(({ nodes, edges }) => {
      if (!cancelled) {
        setFlowNodes(nodes)
        setFlowEdges(edges)
      }
    })
    return () => { cancelled = true }
  }, [data, handleNodeAction])

  useEffect(() => {
    const handler = () => closeDetail()
    window.addEventListener('sedulur:deselect', handler)
    return () => window.removeEventListener('sedulur:deselect', handler)
  }, [closeDetail])

  const isEmpty = !isPending && data !== undefined && data.persons.length === 0

  return (
    <TreeShell>
      {isPending && (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Memuat silsilah…
        </div>
      )}

      {isError && (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-destructive">
          <p>Gagal memuat data silsilah.</p>
          <p className="m-0 text-xs opacity-70">{error.message}</p>
        </div>
      )}

      {isEmpty && (
        <div className="flex h-full items-center justify-center p-6">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Users size={26} />
            </div>
            <h2 className="mb-2 text-xl font-bold text-card-foreground">
              Mulai Silsilah Keluarga Anda
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
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
        <FamilyCanvas nodes={flowNodes} edges={flowEdges} />
      )}

      {dialog && (
        <PersonDialog
          key={dialogKey}
          state={dialog}
          persons={data?.persons ?? []}
          onClose={() => setDialog(null)}
        />
      )}

      {(detailId || closing) && (
        <DetailPanel
          key={detailId ?? closing ? 'open' : 'closed'}
          person={data?.persons.find((p) => p.id === detailId)}
          family={data ?? null}
          onEdit={(p) => handleNodeAction('edit', p)}
          onClose={closeDetail}
          onFocusPerson={(id) => {
            setDetailId(id)
            setClosing(false)
            window.dispatchEvent(new CustomEvent('sedulur:focus-person', { detail: id }))
          }}
          onLinkParent={async (parentId, childId) => {
            await linkParentToChild({ data: { parentId, childId } })
            await qc.invalidateQueries({ queryKey: ['family'] })
          }}
          closing={closing}
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
  onFocusPerson,
  onLinkParent,
  closing = false,
}: {
  person?: Person
  family: { persons: Person[]; parentLinks: ParentLink[]; partnerships: Partnership[] } | null
  onEdit: (p: Person) => void
  onClose: () => void
  onFocusPerson: (id: string) => void
  onLinkParent?: (parentId: string, childId: string) => Promise<void>
  closing?: boolean
}) {
  const [linkPending, setLinkPending] = useState(false)
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

  const myLinks = family.parentLinks.filter((l) => l.childId === person.id)
  let missingParent: Person | null = null
  if (onLinkParent && myLinks.length === 1) {
    const p = myLinks[0].parentId
    const ps = family.partnerships.find(
      (x) => x.partnerAId === p || x.partnerBId === p,
    )
    if (ps) {
      const partnerId = ps.partnerAId === p ? ps.partnerBId : ps.partnerAId
      if (!myLinks.some((l) => l.parentId === partnerId)) {
        missingParent = family.persons.find((x) => x.id === partnerId) ?? null
      }
    }
  }

  return (
    <aside
      className="absolute right-4 top-4 z-20 max-h-[calc(100%-2rem)] w-80 overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl backdrop-blur"
      style={{ animation: closing ? 'detail-slide-out 300ms ease-in forwards' : 'detail-slide-in 300ms ease-out' }}
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {person.photoUrl ? (
            <img
              src={person.photoUrl}
              alt={person.fullName}
              className="h-14 w-14 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-base font-bold text-secondary-foreground">
              {person.fullName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
            </div>
          )}
          <div>
            <h3 className="m-0 text-base font-bold leading-tight text-card-foreground">
              {person.fullName}
            </h3>
            <p className="m-0 text-xs text-muted-foreground">
              {person.gender === 'L' ? 'Laki-laki' : person.gender === 'P' ? 'Perempuan' : '—'}
            </p>
            {order && (
              <p className="m-0 text-xs font-medium text-primary">
                Anak ke-{order.rank} dari {order.total} bersaudara
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      <dl className="m-0 grid gap-1 text-sm">
        {lahir && (
          <div className="flex gap-2">
            <dt className="w-16 flex-shrink-0 text-muted-foreground">Lahir</dt>
            <dd className="m-0 font-medium text-card-foreground">{lahir}</dd>
          </div>
        )}
        {wafat && (
          <div className="flex gap-2">
            <dt className="w-16 flex-shrink-0 text-muted-foreground">Wafat</dt>
            <dd className="m-0 font-medium text-card-foreground">{wafat}</dd>
          </div>
        )}
      </dl>

      {(ortu.length > 0 || pasangan.length > 0 || anak.length > 0) && (
        <div className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
          {ortu.length > 0 && (
            <div>
              <p className="m-0 mb-1 text-xs text-muted-foreground uppercase tracking-wide">Orangtua</p>
              <ul className="m-0 list-none space-y-0.5 p-0 text-card-foreground">
                {ortu.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => onFocusPerson(l.parentId)}
                      className="cursor-pointer underline underline-offset-2 decoration-primary/40 transition-colors hover:text-primary"
                    >
                      {nama(l.parentId)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pasangan.length > 0 && (
            <div>
              <p className="m-0 mb-1 text-xs text-muted-foreground uppercase tracking-wide">Pasangan</p>
              <ul className="m-0 list-none space-y-0.5 p-0 text-card-foreground">
                {pasangan.map((ps, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => onFocusPerson(ps.orang)}
                      className="cursor-pointer underline underline-offset-2 decoration-primary/40 transition-colors hover:text-primary"
                    >
                      {nama(ps.orang)}
                    </button>
                    <span className="text-xs text-muted-foreground">
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
              <p className="m-0 mb-1 text-xs text-muted-foreground uppercase tracking-wide">Anak</p>
              <ul className="m-0 list-none space-y-0.5 p-0 text-card-foreground">
                {anak.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => onFocusPerson(l.childId)}
                      className="cursor-pointer underline underline-offset-2 decoration-primary/40 transition-colors hover:text-primary"
                    >
                      {nama(l.childId)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {missingParent && (
        <div className="mt-4 rounded-xl border border-border bg-secondary p-3 text-sm">
          <p className="m-0 text-card-foreground">
            Saat ini hanya tertaut ke <b>{nama(myLinks[0].parentId)}</b>.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            disabled={linkPending}
            onClick={async () => {
              setLinkPending(true)
              try {
                await onLinkParent?.(missingParent.id, person.id)
              } finally {
                setLinkPending(false)
              }
            }}
          >
            {linkPending
              ? 'Menautkan…'
              : `Tautkan ${missingParent.fullName} sebagai orangtua juga`}
          </Button>
        </div>
      )}

      {person.notes && (
        <p className="mb-0 mt-4 whitespace-pre-wrap rounded-xl bg-secondary p-3 text-sm leading-relaxed text-muted-foreground">
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
