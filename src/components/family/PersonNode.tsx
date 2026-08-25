import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ArrowUp, Baby, Heart, Pencil } from 'lucide-react'

import type { PersonNode } from './layout'

const genderAccent: Record<string, string> = {
  L: '#5b8fd6',
  P: '#d66f9e',
  '-': '#8fb8a8',
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function years(person: PersonNode['data']['person']) {
  const birth = person.birthDate?.slice(0, 4)
  const death = person.deathDate?.slice(0, 4)
  if (!birth && !death) return null
  return `${birth ?? '?'} – ${death ?? '?'}`
}

export function PersonNode({ data, selected }: NodeProps<PersonNode>) {
  const { person, onAction } = data
  const lifeYears = years(person)

  return (
    <div className="group relative" style={{ width: 224, height: 96 }}>
      <div
        className={`flex h-full w-full cursor-pointer items-center gap-3 rounded-2xl border bg-[var(--surface-strong)] px-3 shadow-sm backdrop-blur transition ${
          selected
            ? 'border-[var(--lagoon-deep)] ring-2 ring-[var(--lagoon)]'
            : 'border-[var(--line)]'
        }`}
        style={{
          borderLeftColor: genderAccent[person.gender] ?? genderAccent['-'],
          borderLeftWidth: 4,
        }}
        onClick={() => onAction?.('edit', person)}
      >
        {person.photoUrl ? (
          <img
            src={person.photoUrl}
            alt={person.fullName}
            className="h-12 w-12 flex-shrink-0 rounded-full border border-[var(--line)] object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--sand)] text-sm font-bold text-[var(--palm)]">
            {initials(person.fullName)}
          </div>
        )}
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-bold text-[var(--sea-ink)]">
            {person.fullName}
          </p>
          <p className="m-0 text-xs text-[var(--sea-ink-soft)]">{lifeYears ?? '—'}</p>
        </div>
      </div>

      {/* Aksi cepat konteks node (tampil saat hover / terpilih) */}
      <div
        className={`absolute -bottom-10 left-1/2 z-10 flex -translate-x-1/2 gap-1 whitespace-nowrap rounded-full border border-[var(--line)] bg-white px-1.5 py-1 shadow-lg transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <NodeActionButton label="Ubah" onClick={() => onAction?.('edit', person)}>
          <Pencil size={13} />
        </NodeActionButton>
        <NodeActionButton label="Tambah Anak" onClick={() => onAction?.('child', person)}>
          <Baby size={13} />
        </NodeActionButton>
        <NodeActionButton label="Tambah Pasangan" onClick={() => onAction?.('partner', person)}>
          <Heart size={13} />
        </NodeActionButton>
        <NodeActionButton label="Tambah Orangtua" onClick={() => onAction?.('parent', person)}>
          <ArrowUp size={13} />
        </NodeActionButton>
      </div>

      <Handle id="t" type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <Handle id="b" type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
      <Handle id="r" type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
      <Handle id="l" type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
    </div>
  )
}

function NodeActionButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="nodrag nopan pointer flex h-7 w-7 items-center justify-center rounded-full text-[var(--sea-ink)] transition hover:bg-[var(--sand)] hover:text-[var(--palm)]"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}
