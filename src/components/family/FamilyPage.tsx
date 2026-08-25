import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Users } from 'lucide-react'

import { getFamily } from '#/lib/family'
import { layoutFamily } from './layout'
import type { NodeActionHandler } from './layout'
import { FamilyCanvas } from './FamilyCanvas'
import { PersonDialog, type PersonDialogState } from './PersonDialog'
import { Button } from '#/components/ui/button'

export function FamilyPage() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['family'],
    queryFn: () => getFamily(),
  })

  const [dialog, setDialog] = useState<PersonDialogState>(null)
  const [dialogKey, setDialogKey] = useState(0)

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
    if (kind === 'edit') {
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
      {!isEmpty && (
        <div className="pointer-events-auto absolute left-4 top-4 z-10">
          <Button onClick={() => openDialog({ mode: 'create' })} disabled={isPending}>
            <Plus size={16} /> Tambah Anggota
          </Button>
        </div>
      )}

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
    </TreeShell>
  )
}

/** Kontainer setinggi viewport dikurangi header & footer aplikasi. */
function TreeShell({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const calc = () => {
      const header = document.querySelector('header')?.getBoundingClientRect().height ?? 0
      const footer = document.querySelector('footer')?.getBoundingClientRect().height ?? 0
      el.style.height = `calc(100dvh - ${Math.round(header + footer)}px)`
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  return (
    <main className="page-wrap relative w-full px-4 pb-0 pt-4" ref={ref}>
      {children}
    </main>
  )
}
