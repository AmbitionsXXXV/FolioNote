import { RefreshIcon } from "@hugeicons-pro/core-stroke-rounded"
import { HugeiconsIcon } from "@hugeicons/react"
import { useNavigate } from "@tanstack/react-router"
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow
} from "@xyflow/react"

import "@xyflow/react/dist/style.css"
import "./graph.css"
import type { Connection } from "@xyflow/react"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

import { GraphDetailPanel } from "./graph-detail-panel"
import { EntryEdge } from "./graph-edge"
import { GraphLegend } from "./graph-legend"
import { EntryNode } from "./graph-node"
import { computeDegrees, forceLayout } from "./layout"
import type {
  EntryFlowEdge,
  EntryFlowNode,
  GraphEdgeType,
  GraphNodeData
} from "./types"
import { GRAPH_EDGE_TYPES } from "./types"

interface ApiGraphNode {
  id: string
  title: string
  isInbox: boolean
  isStarred: boolean
  isPinned: boolean
  tags: Array<{ id: string; name: string; color: string | null }>
  updatedAt: string
}

interface ApiGraphEdge {
  id: string
  source: string
  target: string
  linkType: string
  label?: string
}

interface GraphCanvasProps {
  graphNodes: ApiGraphNode[]
  graphEdges: ApiGraphEdge[]
  searchHighlight: string
  isConnecting: boolean
  onConnect: (sourceId: string, targetId: string) => void
}

const nodeTypes = { entry: EntryNode } as const
const edgeTypes = { entry: EntryEdge } as const

const VALID_EDGE_TYPES = new Set<string>(GRAPH_EDGE_TYPES)

/** Coerce an API link type to a known type so styling/filtering never break. */
function normalizeLinkType(value: string): GraphEdgeType {
  return VALID_EDGE_TYPES.has(value) ? (value as GraphEdgeType) : "ref"
}

function toNodeData(node: ApiGraphNode, degree: number): GraphNodeData {
  return {
    title: node.title,
    isInbox: node.isInbox,
    isStarred: node.isStarred,
    isPinned: node.isPinned,
    tags: node.tags,
    updatedAt: node.updatedAt,
    degree
  }
}

function buildNodes(
  apiNodes: ApiGraphNode[],
  apiEdges: ApiGraphEdge[]
): EntryFlowNode[] {
  const ids = apiNodes.map((node) => node.id)
  const positions = forceLayout(ids, apiEdges)
  const degrees = computeDegrees(ids, apiEdges)

  return apiNodes.map((node) => ({
    id: node.id,
    type: "entry",
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: toNodeData(node, degrees.get(node.id) ?? 0)
  }))
}

function toFlowEdges(apiEdges: ApiGraphEdge[]): EntryFlowEdge[] {
  return apiEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "entry",
    data: {
      linkType: normalizeLinkType(edge.linkType),
      label: edge.label
    }
  }))
}

/**
 * Stable key for graph topology. When only node content changes (title, flags),
 * this stays the same so we refresh node data in place and keep the user's
 * dragged positions; it only changes when nodes/edges are added or removed,
 * which is when a fresh layout is warranted.
 */
function topologyKey(
  apiNodes: ApiGraphNode[],
  apiEdges: ApiGraphEdge[]
): string {
  const nodePart = apiNodes.map((node) => node.id).join(",")
  const edgePart = apiEdges
    .map((edge) => `${edge.source}>${edge.target}:${edge.linkType}`)
    .join(",")
  return `${nodePart}|${edgePart}`
}

export function GraphCanvas({
  graphNodes: apiNodes,
  graphEdges: apiEdges,
  searchHighlight,
  isConnecting,
  onConnect
}: GraphCanvasProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const navigate = useNavigate()
  const rfInstance = useReactFlow<EntryFlowNode, EntryFlowEdge>()
  const [nodes, setNodes, onNodesChange] = useNodesState<EntryFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<EntryFlowEdge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hiddenTypes, setHiddenTypes] = useState<Set<GraphEdgeType>>(
    () => new Set()
  )

  const topologyRef = useRef("")

  useEffect(() => {
    const key = topologyKey(apiNodes, apiEdges)
    if (key === topologyRef.current) {
      // Same topology, possibly refreshed content: update node data in place
      // and keep the user's dragged positions.
      const degrees = computeDegrees(
        apiNodes.map((node) => node.id),
        apiEdges
      )
      setNodes((previous) => {
        const byId = new Map(previous.map((node) => [node.id, node]))
        return apiNodes.map((node) => {
          const existing = byId.get(node.id)
          return {
            id: node.id,
            type: "entry" as const,
            position: existing?.position ?? { x: 0, y: 0 },
            selected: existing?.selected,
            data: toNodeData(node, degrees.get(node.id) ?? 0)
          }
        })
      })
    } else {
      topologyRef.current = key
      setNodes(buildNodes(apiNodes, apiEdges))
    }
    setEdges(toFlowEdges(apiEdges))
  }, [apiNodes, apiEdges, setNodes, setEdges])

  useEffect(() => {
    const query = searchHighlight.trim().toLowerCase()
    if (!query) {
      // Clearing the search also clears the search-driven focus selection.
      setSelectedNodeId(null)
      return
    }
    const target = rfInstance
      .getNodes()
      .find((node) => node.data.title.toLowerCase().includes(query))
    if (target) {
      rfInstance.fitView({
        nodes: [{ id: target.id }],
        duration: 400,
        padding: 0.5
      })
      setSelectedNodeId(target.id)
    }
  }, [searchHighlight, rfInstance])

  const handleRelayout = useCallback(() => {
    setNodes(buildNodes(apiNodes, apiEdges))
    window.requestAnimationFrame(() => rfInstance.fitView({ duration: 400 }))
  }, [apiNodes, apiEdges, setNodes, rfInstance])

  const handleToggleType = useCallback((type: GraphEdgeType) => {
    setHiddenTypes((previous) => {
      const next = new Set(previous)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: EntryFlowNode) => {
      navigate({ to: "/entries/$id", params: { id: node.id } })
    },
    [navigate]
  )

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: EntryFlowNode[] }) => {
      setSelectedNodeId(selectedNodes[0]?.id ?? null)
    },
    []
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isConnecting && connection.source && connection.target) {
        onConnect(connection.source, connection.target)
      }
    },
    [isConnecting, onConnect]
  )

  const visibleEdges = useMemo(
    () =>
      edges.filter((edge) => !hiddenTypes.has(edge.data?.linkType ?? "ref")),
    [edges, hiddenTypes]
  )

  // 1-hop neighborhood of the selected node (across currently-visible edges).
  const neighborIds = useMemo(() => {
    if (!selectedNodeId) {
      return null
    }
    const ids = new Set<string>([selectedNodeId])
    for (const edge of visibleEdges) {
      if (edge.source === selectedNodeId) {
        ids.add(edge.target)
      }
      if (edge.target === selectedNodeId) {
        ids.add(edge.source)
      }
    }
    return ids
  }, [selectedNodeId, visibleEdges])

  const displayNodes = useMemo(() => {
    if (!neighborIds) {
      return nodes
    }
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        dimmed: !neighborIds.has(node.id),
        focused: node.id === selectedNodeId
      }
    }))
  }, [nodes, neighborIds, selectedNodeId])

  const displayEdges = useMemo(() => {
    if (!neighborIds) {
      return visibleEdges
    }
    return visibleEdges.map((edge) => {
      const connected =
        edge.source === selectedNodeId || edge.target === selectedNodeId
      return {
        ...edge,
        data: { ...edge.data, highlighted: connected, dimmed: !connected }
      } as EntryFlowEdge
    })
  }, [visibleEdges, neighborIds, selectedNodeId])

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null
    }
    const node = nodes.find((item) => item.id === selectedNodeId)
    return node ? { id: node.id, data: node.data } : null
  }, [selectedNodeId, nodes])

  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNodeData>()
    for (const node of nodes) {
      map.set(node.id, node.data)
    }
    return map
  }, [nodes])

  const typeCounts = useMemo(() => {
    const counts = { ref: 0, manual: 0, "shared-tag": 0, "shared-source": 0 }
    for (const edge of edges) {
      const linkType = edge.data?.linkType
      if (linkType && linkType in counts) {
        counts[linkType] += 1
      }
    }
    return counts
  }, [edges])

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        className={cn("graph-flow", isConnecting && "connectable-mode")}
        colorMode={resolvedTheme === "light" ? "light" : "dark"}
        connectOnClick={isConnecting}
        edges={displayEdges}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.2}
        nodes={displayNodes}
        nodeTypes={nodeTypes}
        onConnect={handleConnect}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodesChange={onNodesChange}
        onSelectionChange={handleSelectionChange}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="var(--color-border)"
          gap={22}
          size={1.5}
          variant={BackgroundVariant.Dots}
        />
        <Controls showInteractive={false} />
        <MiniMap
          maskColor="color-mix(in oklch, var(--color-background) 62%, transparent)"
          nodeColor={(node) => {
            const data = node.data as GraphNodeData | undefined
            if (data?.isStarred) {
              return "var(--color-primary)"
            }
            if (data?.isInbox) {
              return "var(--color-muted-foreground)"
            }
            return "var(--color-foreground)"
          }}
          nodeStrokeWidth={0}
          pannable
          zoomable
        />

        <Panel position="top-left">
          <div className="flex flex-col gap-2">
            <button
              className="flex items-center gap-1.5 self-start rounded-lg border border-border/60 bg-card/85 px-2.5 py-1.5 text-xs font-medium text-secondary-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              onClick={handleRelayout}
              title={t("graph.relayout")}
              type="button"
            >
              <HugeiconsIcon className="size-3.5" icon={RefreshIcon} />
              {t("graph.relayout")}
            </button>
            <GraphLegend
              hiddenTypes={hiddenTypes}
              onToggleType={handleToggleType}
              typeCounts={typeCounts}
            />
          </div>
        </Panel>

        <svg aria-hidden="true" className="pointer-events-none absolute">
          <defs>
            <marker
              id="arrow-ref"
              markerHeight="7"
              markerWidth="7"
              orient="auto-start-reverse"
              refX="7"
              refY="3.5"
              viewBox="0 0 8 8"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--color-primary)" />
            </marker>
            <marker
              id="arrow-manual"
              markerHeight="7"
              markerWidth="7"
              orient="auto-start-reverse"
              refX="7"
              refY="3.5"
              viewBox="0 0 8 8"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--color-foreground)" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>

      <GraphDetailPanel
        edges={edges}
        nodeMap={nodeMap}
        onClose={() => setSelectedNodeId(null)}
        selectedNode={selectedNode}
      />
    </div>
  )
}
