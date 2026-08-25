import { useEffect, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useInternalNode,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { PersonNode } from './PersonNode'
import { CARD_H, CARD_W, type ChildEdge, type NodeActionKind, type PersonNode as PersonNodeType } from './layout'

const nodeTypes = { person: PersonNode }

function ChildEdgeView({ id, targetX, targetY, data }: EdgeProps<ChildEdge>) {
  // Titik tengah para orangtua dihitung dinamis agar garis tetap menempel
  // saat node berpindah (drag tidak dipersistenkan di MVP).
  const anchorIds = data?.anchorIds ?? []
  const first = useInternalNode(anchorIds[0] ?? '')
  const second = useInternalNode(anchorIds[1] ?? '')

  const bottoms = [first, second]
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .map((n) => ({
      x: n.internals.positionAbsolute.x + n.measured.width! / 2,
      y: n.internals.positionAbsolute.y + n.measured.height!,
    }))
  if (bottoms.length === 0) return null

  const anchorX = bottoms.reduce((s, p) => s + p.x, 0) / bottoms.length
  const startY = Math.max(...bottoms.map((p) => p.y))
  const midY = startY + (targetY - startY) / 2
  const path = `M ${anchorX} ${startY} L ${anchorX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`

  return <BaseEdge id={id} path={path} stroke="#8fb8a8" strokeWidth={1.5} />
}

const edgeTypes = { child: ChildEdgeView }

const defaultViewport = { x: 0, y: 0, zoom: 1 }

function FlowInner({
  nodes,
  edges,
  onNodeAction,
}: {
  nodes: PersonNodeType[]
  edges: Parameters<typeof ReactFlow>[0]['edges']
  onNodeAction: (kind: NodeActionKind, person: PersonNodeType['data']['person']) => void
}) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (nodes.length === 0) return
    const t = setTimeout(() => {
      void fitView({ padding: 0.15, duration: 250, maxZoom: 1.25 })
    }, 60)
    return () => clearTimeout(t)
  }, [nodes, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, node) =>
        onNodeAction('edit', (node.data as PersonNodeType['data']).person)
      }
      defaultViewport={defaultViewport}
      minZoom={0.15}
      maxZoom={2}
      nodesConnectable={false}
      deleteKeyCode={null}
      proOptions={{ hideAttribution: false }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#b9d4c4" />
      <Controls position="bottom-left" showInteractive={false} />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        className="!bg-white/80"
        nodeColor={() => '#8fb8a8'}
      />
    </ReactFlow>
  )
}

export function FamilyCanvas({
  nodes,
  edges,
  onNodeAction,
}: {
  nodes: PersonNodeType[]
  edges: Parameters<typeof ReactFlow>[0]['edges']
  onNodeAction: (kind: NodeActionKind, person: PersonNodeType['data']['person']) => void
}) {
  // React Flow hanya dirender di client agar aman terhadap SSR.
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-3xl border border-[var(--line)] bg-[var(--foam)] text-sm text-[var(--sea-ink-soft)]">
        Memuat silsilah…
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--foam)]">
      <ReactFlowProvider>
        <FlowInner nodes={nodes} edges={edges} onNodeAction={onNodeAction} />
      </ReactFlowProvider>
    </div>
  )
}

export { CARD_W, CARD_H }
