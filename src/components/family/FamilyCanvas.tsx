import { useEffect, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import { Search } from 'lucide-react'
import '@xyflow/react/dist/style.css'

import { PersonNode } from './PersonNode'
import { type PersonNode as PersonNodeType } from './layout'

const nodeTypes = { person: PersonNode }

function SearchBox({ nodes }: { nodes: PersonNodeType[] }) {
  const { fitView } = useReactFlow()
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const results = query
    ? nodes
        .filter((n) => n.data.person.fullName.toLowerCase().includes(query))
        .slice(0, 7)
    : []

  const focus = (id: string) => {
    void fitView({ nodes: [{ id }], duration: 400, maxZoom: 1.25, padding: 0.9 })
    setQ('')
  }

  return (
    <div className="absolute right-4 top-4 z-10 w-64">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) focus(results[0].id)
          }}
          placeholder="Cari nama…"
          className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-3 text-sm text-card-foreground shadow backdrop-blur outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {results.length > 0 && (
        <div className="mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg backdrop-blur">
          {results.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => focus(n.id)}
              className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-card-foreground transition hover:bg-secondary"
            >
              {n.data.person.fullName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FlowInner({
  nodes,
  edges,
}: {
  nodes: PersonNodeType[]
  edges: Parameters<typeof ReactFlow>[0]['edges']
}) {
  const { fitView } = useReactFlow()

  const signature = nodes.map((n) => n.id).join(',')
  useEffect(() => {
    if (!signature) return
    const t = setTimeout(() => {
      void fitView({ padding: 0.15, duration: 250, maxZoom: 1.25 })
    }, 60)
    return () => clearTimeout(t)
  }, [signature, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      minZoom={0.15}
      maxZoom={2}
      nodesConnectable={false}
      deleteKeyCode={null}
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} />
      <Controls position="bottom-left" showInteractive={false} />
      <SearchBox nodes={nodes} />
    </ReactFlow>
  )
}

export function FamilyCanvas({
  nodes,
  edges,
}: {
  nodes: PersonNodeType[]
  edges: Parameters<typeof ReactFlow>[0]['edges']
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted-foreground">
        Memuat silsilah…
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden bg-background">
      <ReactFlowProvider>
        <FlowInner nodes={nodes} edges={edges} />
      </ReactFlowProvider>
    </div>
  )
}
