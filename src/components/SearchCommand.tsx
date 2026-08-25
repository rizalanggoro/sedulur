import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Search, TreePine, Table2 } from 'lucide-react'

import { getFamily } from '#/lib/family'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '#/components/ui/command'

export function SearchCommand() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { data } = useQuery({ queryKey: ['family'], queryFn: () => getFamily() })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const persons = data?.persons ?? []

  const handleSelectPerson = useCallback(
    (personId: string) => {
      setOpen(false)
      window.dispatchEvent(new CustomEvent('sedulur:focus-person', { detail: personId }))
      if (window.location.pathname !== '/') {
        navigate({ to: '/' })
      }
    },
    [navigate],
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Cari nama atau halaman..." />
      <CommandList>
        <CommandEmpty>Tidak ada hasil.</CommandEmpty>

        {persons.length > 0 && (
          <CommandGroup heading="Anggota Keluarga">
            {persons.map((p) => (
              <CommandItem
                key={p.id}
                value={p.fullName}
                onSelect={() => handleSelectPerson(p.id)}
              >
                <Search className="size-4" />
                <span>{p.fullName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Halaman">
          <CommandItem asChild>
            <Link to="/">
              <TreePine className="size-4" />
              <span>Silsilah</span>
              <CommandShortcut>⌘1</CommandShortcut>
            </Link>
          </CommandItem>
          <CommandItem asChild>
            <Link to="/tabel">
              <Table2 className="size-4" />
              <span>Tabel</span>
              <CommandShortcut>⌘2</CommandShortcut>
            </Link>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
