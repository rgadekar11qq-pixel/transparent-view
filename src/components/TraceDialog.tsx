import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDown, FileCode2, HelpCircle, CheckCircle2, Waypoints } from 'lucide-react';
import type { AnalysisResult } from '@/lib/analyze/types';
import { traceConnections, type TraceStep } from '@/lib/analyze/search';

interface Props {
  result: AnalysisResult;
  open: boolean;
  onClose: () => void;
  onOpenFile: (path: string, line?: number) => void;
  onSelect: (nodeId: string) => void;
}

const SUGGESTIONS = ['login', 'tasks', '/api/auth/login', 'create_task', 'Dashboard'];

export default function TraceDialog({ result, open, onClose, onOpenFile, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [steps, setSteps] = useState<TraceStep[] | null>(null);

  const run = (q: string) => {
    setQuery(q);
    setSteps(traceConnections(result, q));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Waypoints className="h-4 w-4 text-primary" /> Trace connections
          </DialogTitle>
          <DialogDescription>
            Ask how a feature flows through the code — e.g. "login". Only steps backed by code evidence are shown.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); run(query); }}
        >
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='e.g. "login", "/api/tasks", a function name…' />
          <Button type="submit">Trace</Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="text-[10px] px-2 py-1 rounded-full border hover:border-primary text-muted-foreground" onClick={() => run(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto space-y-0 mt-2">
          {steps?.map((s, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${s.resolved ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {s.resolved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <HelpCircle className="h-3.5 w-3.5" />}
                </div>
                {i < steps.length - 1 && <ArrowDown className="h-4 w-3 text-muted-foreground/40 my-0.5" />}
              </div>
              <div className="pb-4 min-w-0">
                <div className="text-sm font-medium">{s.title}</div>
                {s.note && <div className="text-xs text-muted-foreground">{s.note}</div>}
                {s.file && (
                  <button
                    className="text-xs text-primary hover:underline font-mono flex items-center gap-1 mt-0.5"
                    onClick={() => { onOpenFile(s.file!, s.line); }}
                  >
                    <FileCode2 className="h-3 w-3" />{s.file}{s.line ? `:${s.line}` : ''}
                  </button>
                )}
                {s.nodeId && (
                  <button className="text-xs text-primary hover:underline mt-0.5 block" onClick={() => { onSelect(s.nodeId!); onClose(); }}>
                    Show in graph →
                  </button>
                )}
              </div>
            </div>
          ))}
          {steps && steps.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing found for that query.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
