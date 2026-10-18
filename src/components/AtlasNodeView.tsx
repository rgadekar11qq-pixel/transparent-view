import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Category } from '@/lib/analyze/types';
import { CATEGORY_COLORS } from '@/lib/categoryColors';
import { ChevronRight } from 'lucide-react';

export type AtlasFlowNode = Node<{
  label: string;
  category: Category;
  level: number;
  confidence: string;
  childCount?: number;
  expanded?: boolean;
  dimmed?: boolean;
  highlighted?: boolean;
}, 'atlas'>;

function AtlasNodeView({ data, selected }: NodeProps<AtlasFlowNode>) {
  const color = CATEGORY_COLORS[data.category];
  const base: React.CSSProperties = {
    opacity: data.dimmed ? 0.25 : 1,
    transition: 'opacity 150ms ease',
    transform: data.highlighted ? 'scale(1.06)' : undefined,
  };
  if (data.level === 0) {
    return (
      <div style={base} className="relative">
        <Handle type="source" position={Position.Right} className="!opacity-0" />
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
        <Handle type="source" position={Position.Top} className="!opacity-0" />
        <Handle type="source" position={Position.Left} className="!opacity-0" />
        <div
          className="px-6 py-4 rounded-2xl text-white font-bold text-lg shadow-xl text-center max-w-[220px]"
          style={{ background: color.fill, boxShadow: selected || data.highlighted ? `0 0 0 3px ${color.ring}, 0 20px 40px -12px ${color.fill}` : undefined }}
        >
          {data.label}
          <div className="text-[10px] font-normal opacity-80 mt-0.5">project</div>
        </div>
      </div>
    );
  }
  if (data.level === 1) {
    return (
      <div style={base} className="relative">
        <Handle type="target" position={Position.Left} className="!opacity-0" />
        <Handle type="target" position={Position.Top} className="!opacity-0" />
        <Handle type="source" position={Position.Right} className="!opacity-0" />
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
        <div
          className="px-4 py-2.5 rounded-xl border-2 bg-background font-semibold text-sm shadow-md flex items-center gap-2 max-w-[200px]"
          style={{ borderColor: color.fill, color: color.fill, boxShadow: selected || data.highlighted ? `0 0 0 3px ${color.ring}` : undefined }}
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color.fill }} />
          <span className="truncate">{data.label}</span>
          {typeof data.childCount === 'number' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${color.fill}22`, color: color.fill }}>
              {data.childCount}
            </span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div style={base} className="relative">
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <div
        className="px-3 py-1.5 rounded-lg border bg-background text-xs shadow-sm flex items-center gap-1.5 max-w-[190px]"
        style={{ borderColor: `${color.fill}88`, boxShadow: selected || data.highlighted ? `0 0 0 2px ${color.ring}` : undefined }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color.fill }} />
        <span className="truncate font-medium">{data.label}</span>
        {typeof data.childCount === 'number' && data.childCount > 0 && (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" style={{ transform: data.expanded ? 'rotate(90deg)' : undefined, transition: 'transform 150ms' }} />
        )}
      </div>
    </div>
  );
}

export default memo(AtlasNodeView);
