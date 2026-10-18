import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Info, ChevronUp, ChevronDown } from 'lucide-react';
import type { AnalysisResult } from '@/lib/analyze/types';

interface Props {
  result: AnalysisResult;
  ingestWarnings: string[];
}

export default function BottomPanel({ result, ingestWarnings }: Props) {
  const [open, setOpen] = useState(false);
  const warnings = [...ingestWarnings, ...result.warnings];

  return (
    <div className="border-t bg-card/60">
      <button
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs hover:bg-accent/50"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            {result.stats.analyzedFiles} files analyzed · {result.endpoints.length} endpoints · {result.dbModels.length} models · {result.technologies.length} technologies
          </span>
          {warnings.length > 0 && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {warnings.length} warning{warnings.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open && (
        <ScrollArea className="max-h-44 border-t">
          <div className="p-4 grid md:grid-cols-3 gap-4 text-xs">
            <div>
              <h4 className="font-semibold mb-1.5">Languages</h4>
              <div className="flex flex-wrap gap-1">
                {Object.entries(result.stats.languages).sort((a, b) => b[1] - a[1]).map(([lang, count]) => (
                  <Badge key={lang} variant="secondary" className="text-[10px]">{lang} ×{count}</Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-1.5">Warnings</h4>
              {warnings.length === 0 ? (
                <p className="text-muted-foreground">None. Analysis completed within all safety limits.</p>
              ) : (
                <ul className="space-y-1 text-muted-foreground">
                  {warnings.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              )}
            </div>
            <div>
              <h4 className="font-semibold mb-1.5">Limitations</h4>
              <ul className="space-y-1 text-muted-foreground">
                {result.limitations.slice(0, 4).map((l, i) => <li key={i}>• {l}</li>)}
              </ul>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
