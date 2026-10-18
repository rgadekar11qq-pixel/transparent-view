import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileCode2, Folder, FolderOpen, ChevronRight, Layers } from 'lucide-react';
import type { AnalysisResult, TreeNode, Category } from '@/lib/analyze/types';
import { CATEGORY_LABELS, missingCategories, ALL_CATEGORIES } from '@/lib/analyze/graph';
import { CATEGORY_COLORS } from '@/lib/categoryColors';

interface Props {
  result: AnalysisResult;
  filterCategories: Set<string>;
  onToggleFilter: (c: Category) => void;
  onOpenFile: (path: string, line?: number) => void;
  onLocate: (nodeId: string) => void;
}

function TreeItem({ node, depth, onOpenFile }: { node: TreeNode; depth: number; onOpenFile: (p: string) => void }) {
  const [open, setOpen] = useState(depth < 2);
  if (node.file) {
    return (
      <button
        className="flex items-center gap-1.5 w-full text-left text-xs px-2 py-1 rounded hover:bg-accent truncate"
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={() => onOpenFile(node.path)}
        title={node.path}
      >
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }
  return (
    <div>
      <button
        className="flex items-center gap-1.5 w-full text-left text-xs font-medium px-2 py-1 rounded hover:bg-accent"
        style={{ paddingLeft: depth * 14 + 8 }}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        {open ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="truncate">{node.name}</span>
      </button>
      {open && node.children?.map((c) => (
        <TreeItem key={c.path} node={c} depth={depth + 1} onOpenFile={onOpenFile} />
      ))}
    </div>
  );
}

export default function Sidebar({ result, filterCategories, onToggleFilter, onOpenFile, onLocate }: Props) {
  const missing = useMemo(() => missingCategories(result), [result]);
  const catNodes = useMemo(
    () => result.nodes.filter((n) => n.level === 1).sort((a, b) => a.label.localeCompare(b.label)),
    [result],
  );

  return (
    <div className="h-full flex flex-col border-r bg-card/50">
      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1 text-xs">Overview</TabsTrigger>
            <TabsTrigger value="files" className="flex-1 text-xs">Files ({result.files.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Architecture categories
                </h3>
                <div className="space-y-1">
                  {catNodes.map((n) => {
                    const active = !filterCategories.size || filterCategories.has(n.category);
                    return (
                      <button
                        key={n.id}
                        onClick={() => onLocate(n.id)}
                        className={`flex items-center justify-between w-full text-xs px-2 py-1.5 rounded border transition-colors ${active ? 'bg-background border-border hover:border-primary/50' : 'opacity-40 bg-background border-border'}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[n.category].fill }} />
                          <span className="truncate">{n.label}</span>
                        </span>
                        {typeof n.childCount === 'number' && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">{n.childCount}</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Technologies ({result.technologies.length})</h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.technologies.map((t) => (
                    <Badge
                      key={t.name + t.kind}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:border-primary"
                      title={`${t.name} — ${t.confidence} (${t.kind})`}
                      onClick={() => onLocate(`tech:${t.name}`)}
                    >
                      {t.name}{t.version ? ` ${t.version}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Filter categories</h3>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_CATEGORIES.map((c) => {
                    const on = !filterCategories.size || filterCategories.has(c);
                    return (
                      <button
                        key={c}
                        onClick={() => onToggleFilter(c)}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-all ${on ? 'text-white' : 'opacity-35 bg-transparent'}`}
                        style={on ? { background: CATEGORY_COLORS[c].fill, borderColor: CATEGORY_COLORS[c].fill } : { borderColor: CATEGORY_COLORS[c].fill, color: CATEGORY_COLORS[c].fill }}
                      >
                        {CATEGORY_LABELS[c]}
                      </button>
                    );
                  })}
                </div>
                {filterCategories.size > 0 && (
                  <button className="text-[10px] text-primary mt-1.5 hover:underline" onClick={() => { filterCategories.forEach(() => {}); onToggleFilter('__reset__' as Category); }}>
                    Reset filters
                  </button>
                )}
              </div>

              {missing.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Not detected</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.map((c) => (
                      <span key={c} className="text-[10px] px-2 py-1 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground">
                        {CATEGORY_LABELS[c]}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">No evidence found — shown honestly instead of inventing nodes.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="files" className="flex-1 min-h-0 m-0">
          <ScrollArea className="h-full">
            <div className="p-2">
              {result.tree.map((n) => (
                <TreeItem key={n.path} node={n} depth={0} onOpenFile={onOpenFile} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <Separator />
      <div className="p-3 text-[10px] text-muted-foreground space-y-0.5">
        <div>{result.stats.analyzedFiles} files · {Object.keys(result.stats.languages).length} languages</div>
        <div>Scanned {new Date(result.scannedAt).toLocaleString()}</div>
      </div>
    </div>
  );
}
