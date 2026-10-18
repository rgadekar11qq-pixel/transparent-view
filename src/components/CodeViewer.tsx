import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import type { SourceFile } from '@/lib/analyze/types';
import { highlightCode } from '@/lib/highlight';

interface Props {
  file: SourceFile | null;
  highlightLine?: number;
  onClose: () => void;
}

export default function CodeViewer({ file, highlightLine, onClose }: Props) {
  const [query, setQuery] = useState('');
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const lines = useMemo(() => file?.content.split('\n') ?? [], [file]);
  const matches = useMemo(() => {
    if (!query || !file) return [];
    const out: number[] = [];
    lines.forEach((l, i) => { if (l.toLowerCase().includes(query.toLowerCase())) out.push(i + 1); });
    return out;
  }, [query, lines, file]);

  useEffect(() => {
    if (highlightLine && lineRefs.current[highlightLine - 1]) {
      lineRefs.current[highlightLine - 1]!.scrollIntoView({ block: 'center' });
    }
  }, [highlightLine, file]);

  useEffect(() => { setQuery(''); }, [file?.path]);

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="text-sm font-mono truncate">{file?.path}</DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search in file…"
                  className="h-7 w-40 pl-7 text-xs"
                />
              </div>
              {query && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {matches.length} match{matches.length === 1 ? '' : 'es'}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-muted/30 font-mono text-xs leading-5 py-2">
          {lines.map((line, i) => {
            const n = i + 1;
            const isHl = n === highlightLine;
            const inMatch = matches.includes(n);
            return (
              <div
                key={n}
                ref={(el) => { lineRefs.current[i] = el; }}
                className={`flex px-3 ${isHl ? 'bg-primary/15 border-l-2 border-primary' : inMatch ? 'bg-amber-500/10' : 'hover:bg-muted/60'}`}
              >
                <span className="w-10 shrink-0 text-right pr-3 text-muted-foreground/50 select-none">{n}</span>
                <span className="whitespace-pre-wrap break-all">{highlightCode(line, file?.language ?? '')}</span>
              </div>
            );
          })}
          {file && file.content === '' && (
            <div className="p-4 text-muted-foreground text-xs font-sans">
              This file's content is not stored in the exported view — re-scan the project to browse code.
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{file?.language} · {file?.size.toLocaleString()} bytes · read-only (never executed)</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onClose}>
            <X className="h-3 w-3 mr-1" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
