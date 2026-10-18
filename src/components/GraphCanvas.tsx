import { useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, type Edge, type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { AnalysisResult } from '@/lib/analyze/types';
import { layoutVisible } from '@/lib/analyze/layout';
import { neighborsOf } from '@/lib/analyze/search';
import { CATEGORY_COLORS } from '@/lib/categoryColors';
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
  const neighborSet = useMemo(
    () => (selectedId ? neighborsOf(result, selectedId) : null),
    [result, selectedId],
  );

  const { nodes, edges } = useMemo(() => {
    const positioned = layoutVisible(result.nodes, result.edges, expanded);
    const visibleIds = new Set(positioned.map((p) => p.node.id));

    const nodes: Node[] = positioned
      .filter((p) => filterCategories.size === 0 || filterCategories.has(p.node.category))
      .map((p): AtlasFlowNode => ({
        id: p.node.id,
        type: 'atlas',
        position: { x: p.x, y: p.y },
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
      }));

    const edges: Edge[] = result.edges
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
          id: e.id, source: e.source, target: e.target,
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

    return { nodes, edges };
  }, [result, expanded, neighborSet, highlightIds, filterCategories]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => {
        if (node.id === selectedId && node.id.startsWith('cat:')) {
          onToggleExpand(node.id);
        } else {
          onSelect(node.id);
        }
      }}
      onPaneClick={() => onSelect(null)}
      minZoom={0.15}
      maxZoom={2.2}
      fitView
      fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
      proOptions={{ hideAttribution: true }}
      colorMode="system"
      nodesDraggable
      nodesConnectable={false}
    >
      <Background gap={28} size={1.5} />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        nodeColor={(n) => CATEGORY_COLORS[(n.data as { category?: keyof typeof CATEGORY_COLORS })?.category ?? 'project']?.fill ?? '#888'}
        className="!w-40 !h-28 hidden md:block"
      />
    </ReactFlow>
  );
}
