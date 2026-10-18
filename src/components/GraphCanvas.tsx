import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, type Edge, type Node,
  useNodesState, useEdgesState, ControlButton,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AnalysisResult } from '@/lib/analyze/types';
import { layoutVisible } from '@/lib/analyze/layout';
import { neighborsOf } from '@/lib/analyze/search';
import { CATEGORY_COLORS } from '@/lib/categoryColors';
import { RefreshCw } from 'lucide-react';
import AtlasNodeView, { type AtlasFlowNode } from './AtlasNodeView';

interface Props {
  result: AnalysisResult;
  expanded: Set<string>;
  selectedId: string | null;
  highlightIds: Set<string>;
  filterCategories: Set<string>;
  onSelect: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
}

const nodeTypes = { atlas: AtlasNodeView };

export default function GraphCanvas({
  result, expanded, selectedId, highlightIds, filterCategories, onSelect, onToggleExpand,
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const customPositions = useRef<Map<string, { x: number; y: number }>>(new Map());

  const neighborSet = useMemo(
    () => (selectedId ? neighborsOf(result, selectedId) : null),
    [result, selectedId],
  );

  // Compute positioned graph layout
  const { calculatedNodes, calculatedEdges } = useMemo(() => {
    const positioned = layoutVisible(result.nodes, result.edges, expanded);
    const visibleIds = new Set(positioned.map((p) => p.node.id));

    const calculatedNodes: Node[] = positioned
      .filter((p) => filterCategories.size === 0 || filterCategories.has(p.node.category))
      .map((p): AtlasFlowNode => {
        const savedPos = customPositions.current.get(p.node.id);
        return {
          id: p.node.id,
          type: 'atlas',
          position: savedPos ? { ...savedPos } : { x: p.x, y: p.y },
          draggable: true,
          data: {
            label: p.node.label,
            category: p.node.category,
            level: p.node.level,
            confidence: p.node.confidence,
            childCount: p.node.childCount,
            expanded: expanded.has(p.node.id),
            dimmed: neighborSet ? !neighborSet.has(p.node.id) : false,
            highlighted: highlightIds.has(p.node.id),
          },
        };
      });

    const calculatedEdges: Edge[] = result.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .filter((e) => {
        const s = result.nodes.find((n) => n.id === e.source);
        const t = result.nodes.find((n) => n.id === e.target);
        if (!s || !t) return false;
        if (filterCategories.size && !filterCategories.has(s.category) && !filterCategories.has(t.category)) return false;
        return true;
      })
      .map((e) => {
        const dim = neighborSet ? !(neighborSet.has(e.source) && neighborSet.has(e.target)) : false;
        const base: Edge = {
          id: e.id,
          source: e.source,
          target: e.target,
          animated: e.kind === 'calls-api',
          style: {
            opacity: dim ? 0.12 : e.kind === 'contains' ? 0.55 : 0.85,
            stroke: e.kind === 'calls-api' ? '#8b5cf6' : e.kind === 'imports' ? '#94a3b8' : '#cbd5e1',
            strokeWidth: e.kind === 'calls-api' ? 2 : 1.25,
            strokeDasharray: e.kind === 'possible' ? '5 4' : undefined,
          },
        };
        return base;
      });

    return { calculatedNodes, calculatedEdges };
  }, [result, expanded, neighborSet, highlightIds, filterCategories]);

  // Synchronize with state while keeping nodes draggable
  useEffect(() => {
    setNodes(calculatedNodes);
    setEdges(calculatedEdges);
  }, [calculatedNodes, calculatedEdges, setNodes, setEdges]);

  // Remember dragged positions
  const onNodeDragStop = useCallback((_: MouseEvent | TouchEvent, node: Node) => {
    customPositions.current.set(node.id, { x: node.position.x, y: node.position.y });
  }, []);

  // Reset custom dragged positions back to auto-layout
  const handleResetPositions = useCallback(() => {
    customPositions.current.clear();
    setNodes((prev) => {
      const fresh = layoutVisible(result.nodes, result.edges, expanded);
      const posMap = new Map(fresh.map((f) => [f.node.id, { x: f.x, y: f.y }]));
      return prev.map((n) => ({
        ...n,
        position: posMap.get(n.id) ?? n.position,
      }));
    });
  }, [result, expanded, setNodes]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, node) => {
          if (node.id === selectedId && node.id.startsWith('cat:')) {
            onToggleExpand(node.id);
          } else {
            onSelect(node.id);
          }
        }}
        onPaneClick={() => onSelect(null)}
        minZoom={0.08}
        maxZoom={2.4}
        fitView
        fitViewOptions={{ padding: 0.35, maxZoom: 1.0 }}
        proOptions={{ hideAttribution: true }}
        colorMode="system"
        nodesDraggable={true}
        nodesConnectable={false}
      >
        <Background gap={28} size={1.5} />
        <Controls position="bottom-left">
          <ControlButton onClick={handleResetPositions} title="Reset Node Positions">
            <RefreshCw className="h-4 w-4" />
          </ControlButton>
        </Controls>
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(n) => CATEGORY_COLORS[(n.data as { category?: keyof typeof CATEGORY_COLORS })?.category ?? 'project']?.fill ?? '#888'}
          className="!w-44 !h-32 hidden md:block"
        />
      </ReactFlow>
    </div>
  );
}
