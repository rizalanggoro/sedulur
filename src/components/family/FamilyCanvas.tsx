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

  const signature = nodes.map((n) => n.id).join(',')
  useEffect(() => {
    if (!signature) return
    const t = setTimeout(() => {
      void fitView({ padding: 0.15, duration: 250, maxZoom: 1.25 })
    }, 60)
    return () => clearTimeout(t)
  }, [signature, fitView])

  useEffect(() => {
    const handler = (e: Event) => {
      const personId = (e as CustomEvent).detail as string
      void fitView({ nodes: [{ id: personId }], duration: 400, maxZoom: 1.25, padding: 0.9 })
    }
    window.addEventListener('sedulur:focus-person', handler)
    return () => window.removeEventListener('sedulur:focus-person', handler)
  }, [fitView])

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
