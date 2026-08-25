import { useEffect, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { PersonNode } from './PersonNode'
import { type PersonNode as PersonNodeType } from './layout'

const nodeTypes = { person: PersonNode }

function FlowInner({
  nodes,
  edges,
}: {
  nodes: PersonNodeType[]
  edges: Parameters<typeof ReactFlow>[0]['edges']
}) {
  const { fitView } = useReactFlow()

  // fitView hanya saat komposisi keluarga berubah — bukan saat refetch
  // menghasilkan array baru (mis. refetchOnWindowFocus), agar zoom tidak reset.
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
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#b9d4c4" />
      <Controls position="bottom-left" showInteractive={false} />
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
  // React Flow hanya dirender di client agar aman terhadap SSR.
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--foam)] text-sm text-[var(--sea-ink-soft)]">
        Memuat silsilah…
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden bg-[var(--foam)]">
      <ReactFlowProvider>
        <FlowInner nodes={nodes} edges={edges} />
      </ReactFlowProvider>
    </div>
  )
}
