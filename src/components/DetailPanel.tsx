import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, FileCode2, Link2, Quote, GraduationCap } from 'lucide-react';
import type { AnalysisResult, AtlasNode, Confidence } from '@/lib/analyze/types';
import { CATEGORY_COLORS } from '@/lib/categoryColors';

interface Props {
  result: AnalysisResult;
  node: AtlasNode | null;
  onClose: () => void;
  onOpenFile: (path: string, line?: number) => void;
  onSelect: (id: string) => void;
}

const CONF_STYLE: Record<Confidence, string> = {
  confirmed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  likely: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  uncertain: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
};

export default function DetailPanel({ result, node, onClose, onOpenFile, onSelect }: Props) {
  const connections = useMemo(() => {
    if (!node) return [];
    return result.edges.filter((e) => e.source === node.id || e.target === node.id);
  }, [result, node]);

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 border-l bg-card/30">
        <GraduationCap className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground max-w-[220px]">
          Click any node in the graph to see what it does, why it exists, and where the code lives.
        </p>
      </div>
    );
  }

  const color = CATEGORY_COLORS[node.category];

  return (
    <div className="h-full flex flex-col border-l bg-card/50">
      <div className="p-4 border-b space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: color.fill }}>
              {node.category}
            </div>
            <h2 className="font-bold text-base leading-tight break-words">{node.label}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${CONF_STYLE[node.confidence]}`}>
            {node.confidence}
          </span>
          {node.technology && (
            <Badge variant="outline" className="text-[10px]">{node.technology}</Badge>
          )}
        </div>
        {node.description && <p className="text-xs text-muted-foreground">{node.description}</p>}
      </div>

      <Tabs defaultValue="explain" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="explain" className="flex-1 text-xs">Explain</TabsTrigger>
            <TabsTrigger value="files" className="flex-1 text-xs">Files ({node.filePaths.length})</TabsTrigger>
            <TabsTrigger value="evidence" className="flex-1 text-xs">Evidence</TabsTrigger>
            <TabsTrigger value="links" className="flex-1 text-xs">Links ({connections.length})</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0">
          <TabsContent value="explain" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4 text-sm">
                {node.explanations?.beginner && (
                  <section>
                    <h3 className="text-xs font-semibold text-primary mb-1">Beginner</h3>
                    <p className="text-muted-foreground leading-relaxed">{node.explanations.beginner}</p>
                  </section>
                )}
                {node.explanations?.intermediate && (
                  <section>
                    <h3 className="text-xs font-semibold mb-1">Intermediate</h3>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{node.explanations.intermediate}</p>
                  </section>
                )}
                {node.explanations?.advanced && (
                  <section>
                    <h3 className="text-xs font-semibold mb-1">Advanced</h3>
                    <p className="text-muted-foreground leading-relaxed">{node.explanations.advanced}</p>
                  </section>
                )}
                {!node.explanations && (
                  <p className="text-muted-foreground">No explanation available for this node.</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="files" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-1.5">
                {node.filePaths.length === 0 && <p className="text-xs text-muted-foreground">No source files associated with this node.</p>}
                {node.filePaths.map((p) => (
                  <button
                    key={p}
                    onClick={() => onOpenFile(p)}
                    className="flex items-center gap-2 w-full text-left text-xs px-2.5 py-2 rounded border hover:border-primary/60 hover:bg-accent transition-colors"
                  >
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate font-mono">{p}</span>
                  </button>
                ))}
                {node.symbols.length > 0 && (
                  <div className="pt-2">
                    <h3 className="text-xs font-semibold mb-1.5 text-muted-foreground">Symbols</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {node.symbols.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px] font-mono">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="evidence" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2.5">
                {node.evidence.length === 0 && <p className="text-xs text-muted-foreground">No direct evidence recorded (inferred or root node).</p>}
                {node.evidence.map((e, i) => (
                  <div key={i} className="text-xs border rounded-md p-2.5 space-y-1 bg-background">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px]">{e.kind}</Badge>
                      <button className="text-primary hover:underline truncate font-mono" onClick={() => onOpenFile(e.path, e.line)}>
                        {e.path}{e.line ? `:${e.line}` : ''}
                      </button>
                    </div>
                    {e.snippet && (
                      <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all font-mono"><Quote className="inline h-3 w-3 mr-1" />{e.snippet}</pre>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="links" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-1.5">
                {connections.length === 0 && <p className="text-xs text-muted-foreground">No connections to other nodes.</p>}
                {connections.map((e) => {
                  const otherId = e.source === node.id ? e.target : e.source;
                  const other = result.nodes.find((n) => n.id === otherId);
                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(otherId)}
                      className="flex items-center gap-2 w-full text-left text-xs px-2.5 py-2 rounded border hover:border-primary/60 hover:bg-accent transition-colors"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        <span className="text-muted-foreground">{e.kind}</span>
                        {' → '}
                        <span className="font-medium">{other?.label ?? otherId}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
      <Separator />
      <div className="p-2.5 text-[10px] text-muted-foreground">
        Tip: click this node again on the graph to {node.level === 1 ? 'collapse/expand its children' : 'keep exploring'}.
      </div>
    </div>
  );
}
