// Deterministic collision-free radial-branch layout for the visible node set.
// Level 0 = center, level 1 = inner ring, level 2 = multi-tier branches + collision resolution.

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

  // Level-1 nodes on an inner ring, sorted for stability
  const l1 = visNodes.filter((n) => n.level === 1).sort((a, b) => a.id.localeCompare(b.id));
  const numCats = Math.max(l1.length, 1);
  const R1 = Math.max(480, numCats * 85);
  const pos = new Map<string, { x: number; y: number }>();
  pos.set('project', { x: 0, y: 0 });

  l1.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / numCats - Math.PI / 2;
    pos.set(n.id, {
      x: Math.round(Math.cos(angle) * R1),
      y: Math.round(Math.sin(angle) * R1),
    });
  });

  // Group level-2 nodes by parent category
  const groups = new Map<string, AtlasNode[]>();
  for (const n of visNodes) {
    if (n.level === 2 && n.parentId) {
      if (!groups.has(n.parentId)) groups.set(n.parentId, []);
      groups.get(n.parentId)!.push(n);
    }
  }

  const sectorAngle = (2 * Math.PI) / numCats;
  const maxSpread = sectorAngle * 0.85;

  for (const [pid, children] of groups) {
    const p = pos.get(pid);
    if (!p) continue;

    const centerAngle = Math.atan2(p.y, p.x);
    children.sort((a, b) => a.label.localeCompare(b.label));

    // Place children in radial tiers (staggered rings) so they don't jam together
    const itemsPerTier = 4;
    const tierStepDistance = 240;

    children.forEach((c, idx) => {
      const tierIndex = Math.floor(idx / itemsPerTier);
      const indexInTier = idx % itemsPerTier;
      const countInThisTier = Math.min(itemsPerTier, children.length - tierIndex * itemsPerTier);

      const t = countInThisTier === 1 ? 0 : (indexInTier / (countInThisTier - 1)) * 2 - 1;
      const tierSpread = maxSpread * (0.6 + 0.3 * Math.min(tierIndex, 2));
      const angle = centerAngle + t * (tierSpread / 2);

      const r = R1 + 250 + tierIndex * tierStepDistance;
      pos.set(c.id, {
        x: Math.round(Math.cos(angle) * r),
        y: Math.round(Math.sin(angle) * r),
      });
    });
  }

  // --- Collision Avoidance Relaxation Pass ---
  // Node card typical dimensions: 210px width x 60px height
  const MIN_DX = 230;
  const MIN_DY = 75;
  const iterations = 35;

  for (let step = 0; step < iterations; step++) {
    for (let i = 0; i < visNodes.length; i++) {
      const idA = visNodes[i].id;
      if (idA === 'project') continue;
      const posA = pos.get(idA);
      if (!posA) continue;

      for (let j = i + 1; j < visNodes.length; j++) {
        const idB = visNodes[j].id;
        if (idB === 'project') continue;
        const posB = pos.get(idB);
        if (!posB) continue;

        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX < MIN_DX && absY < MIN_DY) {
          const overlapX = MIN_DX - absX;
          const overlapY = MIN_DY - absY;

          const signX = dx >= 0 ? 1 : -1;
          const signY = dy >= 0 ? 1 : -1;

          // Push nodes apart proportionally
          const shiftX = Math.round((overlapX / 2) * 0.4) * signX;
          const shiftY = Math.round((overlapY / 2) * 0.5) * signY;

          posA.x += shiftX;
          posA.y += shiftY;
          posB.x -= shiftX;
          posB.y -= shiftY;
        }
      }
    }
  }

  return visNodes
    .filter((n) => pos.has(n.id))
    .map((n) => ({ node: n, ...pos.get(n.id)! }));
}
