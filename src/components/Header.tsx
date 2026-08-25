import { Link, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'

import ThemeToggle from './ThemeToggle'
import { SearchCommand } from './SearchCommand'
import { getFamily } from '#/lib/family'
import { Button } from '#/components/ui/button'

export default function Header() {
  const { data } = useQuery({ queryKey: ['family'], queryFn: () => getFamily() })
  const kosong = data !== undefined && data.persons.length === 0
  const pathname = useLocation().pathname

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1080px] items-center px-4">
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <span className="inline-block font-bold text-primary">Sedulur</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Silsilah</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tabel" search={{ id: undefined }}>Tabel</Link>
          </Button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {pathname !== '/tabel' && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-muted-foreground"
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            >
              <Search size={14} />
              <span className="hidden sm:inline">Cari...</span>
              <kbd className="pointer-events-none hidden select-none rounded border border-border bg-muted px-1.5 text-[10px] font-medium sm:inline">⌘K</kbd>
            </Button>
          )}
          <ThemeToggle />
          {kosong && (
            <Button
              size="sm"
              onClick={() => window.dispatchEvent(new Event('sedulur:tambah-anggota'))}
            >
              <Plus size={16} /> Tambah Anggota
            </Button>
          )}
        </div>
      </div>
      <SearchCommand />
    </header>
  )
}
