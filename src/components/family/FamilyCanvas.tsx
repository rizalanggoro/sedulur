import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
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
  edges: Edge[]
}) {
  const { fitView } = useReactFlow()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return null
    const ids = new Set<string>()
    ids.add(selectedNodeId)
    for (const e of edges) {
      if (e.source === selectedNodeId) ids.add(e.target)
      if (e.target === selectedNodeId) ids.add(e.source)
    }
    return ids
  }, [selectedNodeId, edges])

  const highlightedEdges = useMemo(() => {
    if (!connectedIds) return edges
    return edges.map((e) => ({
      ...e,
      style: {
        ...e.style,
        opacity: connectedIds.has(e.source) && connectedIds.has(e.target) ? 1 : 0.15,
      },
    }))
  }, [edges, connectedIds])

  const dimmedNodes = useMemo(() => {
    if (!connectedIds) return nodes.map((n) => ({ ...n, selected: false }))
    return nodes.map((n) => ({
      ...n,
      selected: n.id === selectedNodeId,
      style: { ...n.style, opacity: connectedIds.has(n.id) ? 1 : 0.25 },
    }))
  }, [nodes, connectedIds, selectedNodeId])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId((prev) => {
        const next = prev === node.id ? null : node.id
        if (!next) {
          window.dispatchEvent(new CustomEvent('sedulur:deselect'))
        } else {
          void fitView({ nodes: [{ id: next }], duration: 300, maxZoom: 1, padding: 0.7 })
        }
        return next
      })
    },
    [fitView],
  )

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    window.dispatchEvent(new CustomEvent('sedulur:deselect'))
  }, [])

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
      setSelectedNodeId(personId)
      void fitView({ nodes: [{ id: personId }], duration: 400, maxZoom: 1.25, padding: 0.9 })
    }
    window.addEventListener('sedulur:focus-person', handler)
    return () => window.removeEventListener('sedulur:focus-person', handler)
  }, [fitView])

  return (
    <ReactFlow
      nodes={dimmedNodes}
      edges={highlightedEdges}
      nodeTypes={nodeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
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
  edges: Edge[]
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
