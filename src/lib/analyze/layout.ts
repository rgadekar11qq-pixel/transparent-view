// Deterministic radial-ish layout for the visible node set.
// Level 0 = center, level 1 = ring, level 2 = outer ring, grouped by parent.

import type { AtlasEdge, AtlasNode } from './types';

export interface Positioned {
  node: AtlasNode;
  x: number;
  y: number;
}

export function layoutVisible(
  nodes: AtlasNode[],
  _edges: AtlasEdge[],
  expanded: Set<string>,
): Positioned[] {
  const visible = new Set<string>(['project']);
  for (const n of nodes) {
    if (n.level === 1) visible.add(n.id);
  }
  for (const n of nodes) {
    if (n.level === 2 && n.parentId && expanded.has(n.parentId)) visible.add(n.id);
  }

  const visNodes = nodes.filter((n) => visible.has(n.id));

  // level-1 nodes on a ring, sorted for stability
  const l1 = visNodes.filter((n) => n.level === 1).sort((a, b) => a.id.localeCompare(b.id));
  const R1 = Math.max(260, l1.length * 46);
  const pos = new Map<string, { x: number; y: number }>();
  pos.set('project', { x: 0, y: 0 });

  l1.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(l1.length, 1) - Math.PI / 2;
    pos.set(n.id, { x: Math.cos(angle) * R1, y: Math.sin(angle) * R1 });
  });

  // level-2 nodes fan out around their parent's ring position
  const groups = new Map<string, AtlasNode[]>();
  for (const n of visNodes) {
    if (n.level === 2 && n.parentId) {
      if (!groups.has(n.parentId)) groups.set(n.parentId, []);
      groups.get(n.parentId)!.push(n);
    }
  }
  for (const [pid, children] of groups) {
    const p = pos.get(pid);
    if (!p) continue;
    const centerAngle = Math.atan2(p.y, p.x);
    const spread = Math.min(Math.PI / 2.2, children.length * 0.16);
    const R2 = 240;
    children.sort((a, b) => a.label.localeCompare(b.label));
    children.forEach((c, i) => {
      const t = children.length === 1 ? 0 : (i / (children.length - 1)) * 2 - 1;
      const angle = centerAngle + t * spread;
      // push slightly outward radially too
      const r = R2 + (children.length > 8 ? 40 : 0);
      pos.set(c.id, { x: Math.cos(angle) * (Math.hypot(p.x, p.y) + r), y: Math.sin(angle) * (Math.hypot(p.x, p.y) + r) });
    });
  }

  return visNodes
    .filter((n) => pos.has(n.id))
    .map((n) => ({ node: n, ...pos.get(n.id)! }));
}
