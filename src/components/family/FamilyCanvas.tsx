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
import { CARD_H, CARD_W, type ChildEdge, type PersonNode as PersonNodeType } from './layout'

const nodeTypes = { person: PersonNode }

function ChildEdgeView({ id, targetX, targetY, data }: EdgeProps<ChildEdge>) {
  // Titik tengah para orangtua dihitung dinamis agar garis tetap menempel
  // saat node berpindah (drag tidak dipersistenkan di MVP).
  const anchorIds = data?.anchorIds ?? []
  const first = useInternalNode(anchorIds[0] ?? '')
  const second = useInternalNode(anchorIds[1] ?? '')

  const nodes = [first, second].filter(
    (n): n is NonNullable<typeof n> => Boolean(n),
  )
  if (nodes.length === 0) return null

  const centerX = (n: NonNullable<typeof first>) =>
    n.internals.positionAbsolute.x + n.measured.width! / 2
  const centerY = (n: NonNullable<typeof first>) =>
    n.internals.positionAbsolute.y + n.measured.height! / 2
  const bottomY = (n: NonNullable<typeof first>) =>
    n.internals.positionAbsolute.y + n.measured.height!

  const anchorX = nodes.reduce((s, n) => s + centerX(n), 0) / nodes.length
  // Pasangan: garis turun dari tengah garis penghubung keduanya (gaya ┬).
  // Orangtua tunggal: turun dari bawah kartunya.
  const startY =
    nodes.length >= 2
      ? nodes.reduce((s, n) => s + centerY(n), 0) / nodes.length
      : Math.max(...nodes.map((n) => bottomY(n)))
  const midY = startY + (targetY - startY) / 2
  const path = `M ${anchorX} ${startY} L ${anchorX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`

  return <BaseEdge id={id} path={path} stroke="#8fb8a8" strokeWidth={1.5} />
}

const edgeTypes = { child: ChildEdgeView }

const defaultViewport = { x: 0, y: 0, zoom: 1 }

function FlowInner({
  nodes,
  edges,
}: {
  nodes: PersonNodeType[]
  edges: Parameters<typeof ReactFlow>[0]['edges']
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
        nodeColor={() => '#8fb8a8'}
      />
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
      <div className="flex h-full w-full items-center justify-center rounded-3xl border border-[var(--line)] bg-[var(--foam)] text-sm text-[var(--sea-ink-soft)]">
        Memuat silsilah…
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--foam)]">
      <ReactFlowProvider>
        <FlowInner nodes={nodes} edges={edges} />
      </ReactFlowProvider>
    </div>
  )
}

export { CARD_W, CARD_H }
