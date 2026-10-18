import { useCallback, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Compass, Download, FileJson, FileText, FolderSearch, Moon, Sun,
  Waypoints, X, Search, ShieldCheck,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import type { AnalysisResult, Category, SourceFile } from '@/lib/analyze/types';
import { analyzeProject } from '@/lib/analyze';
import { buildSearchIndex, searchIndex, type SearchEntry } from '@/lib/analyze/search';
import { exportJson, exportMarkdown, downloadText } from '@/lib/analyze/export';
import { CATEGORY_LABELS } from '@/lib/analyze/graph';
import { CATEGORY_COLORS } from '@/lib/categoryColors';
import UploadScreen from '@/components/UploadScreen';
import GraphCanvas from '@/components/GraphCanvas';
import Sidebar from '@/components/Sidebar';
import DetailPanel from '@/components/DetailPanel';
import CodeViewer from '@/components/CodeViewer';
import BottomPanel from '@/components/BottomPanel';
import TraceDialog from '@/components/TraceDialog';

type Screen = 'upload' | 'analyzing' | 'graph';

export default function App() {
  const [screen, setScreen] = useState<Screen>('upload');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [ingestWarnings, setIngestWarnings] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [filterCategories, setFilterCategories] = useState<Set<Category>>(new Set());
  const [query, setQuery] = useState('');
  const [viewer, setViewer] = useState<{ file: SourceFile; line?: number } | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const { theme, setTheme } = useTheme();
  const analyzeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLoaded = useCallback((files: SourceFile[], label: string, warnings: string[]) => {
    setScreen('analyzing');
    setSourceLabel(label);
    setIngestWarnings(warnings);
    // yield to the UI so the analyzing state paints before the (synchronous) analysis
    analyzeTimer.current = setTimeout(() => {
      const res = analyzeProject(files);
      setResult(res);
      // auto-expand small categories for a pleasant first view
      const auto = new Set<string>();
      for (const n of res.nodes) {
        if (n.level === 1 && (n.childCount ?? 0) > 0 && (n.childCount ?? 0) <= 8) auto.add(n.id);
      }
      setExpanded(auto);
      setSelectedId(null);
      setFilterCategories(new Set());
      setScreen('graph');
    }, 60);
  }, []);

  const index = useMemo(() => (result ? buildSearchIndex(result) : []), [result]);
  const searchResults = useMemo(() => searchIndex(index, query), [index, query]);

  const selectedNode = useMemo(
    () => result?.nodes.find((n) => n.id === selectedId) ?? null,
    [result, selectedId],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleFilter = useCallback((c: Category) => {
    if ((c as string) === '__reset__') { setFilterCategories(new Set()); return; }
    setFilterCategories((prev) => {
      // start from "all on" semantics: an empty set means no filtering
      const next = new Set(prev.size ? prev : (result?.nodes.filter((n) => n.level === 1).map((n) => n.category) as Category[]));
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }, [result]);

  const locate = useCallback((nodeId: string) => {
    setSelectedId(nodeId);
    setHighlightIds(new Set([nodeId]));
    // make sure parent chain is visible
    const node = result?.nodes.find((n) => n.id === nodeId);
    if (node?.parentId) {
      setExpanded((prev) => new Set(prev).add(node.parentId!));
    }
    setTimeout(() => setHighlightIds(new Set()), 2400);
  }, [result]);

  const openFile = useCallback((path: string, line?: number) => {
    const f = result?.files.find((x) => x.path === path);
    if (f) setViewer({ file: f, line });
  }, [result]);

  const pickSearchResult = useCallback((r: SearchEntry) => {
    setQuery('');
    if (r.nodeId) locate(r.nodeId);
    if (r.file) openFile(r.file, r.line);
  }, [locate, openFile]);

  const reset = useCallback(() => {
    if (analyzeTimer.current) clearTimeout(analyzeTimer.current);
    setResult(null);
    setScreen('upload');
    setSelectedId(null);
    setExpanded(new Set());
  }, []);

  if (screen === 'upload') {
    return (
      <TooltipProvider>
        <UploadScreen onLoaded={onLoaded} />
      </TooltipProvider>
    );
  }

  if (screen === 'analyzing' || !result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Compass className="h-10 w-10 text-primary animate-spin" style={{ animationDuration: '2.5s' }} />
        <p className="text-muted-foreground text-sm">Scanning project structure, dependencies, routes and models…</p>
        <p className="text-xs text-muted-foreground/60">All analysis runs locally in your browser.</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-background">
        {/* top navigation */}
        <header className="flex items-center gap-3 px-4 h-14 border-b shrink-0">
          <div className="flex items-center gap-2 font-bold">
            <Compass className="h-5 w-5 text-primary" />
            Transparent <span className="text-primary">View</span>
          </div>
          <Badge variant="outline" className="text-[10px] hidden sm:inline-flex" title={sourceLabel}>
            {result.projectName}
          </Badge>

          <div className="relative flex-1 max-w-md">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files, tech, endpoints, functions, env vars…"
              className="h-8 pl-8 text-xs"
            />
            {query && (
              <div className="absolute top-9 left-0 right-0 z-50 bg-popover border rounded-md shadow-lg max-h-72 overflow-auto">
                {searchResults.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
                )}
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2"
                    onClick={() => pickSearchResult(r)}
                  >
                    <Badge variant="secondary" className="text-[9px] shrink-0">{r.type}</Badge>
                    <span className="truncate">{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setTraceOpen(true)}>
                <Waypoints className="h-4 w-4 mr-1.5" /><span className="hidden lg:inline text-xs">Trace</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Trace how a feature flows through the code</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8">
                    <Download className="h-4 w-4 mr-1.5" /><span className="hidden lg:inline text-xs">Export</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Export graph data and reports</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadText(`${result.projectName}-graph.json`, exportJson(result), 'application/json')}>
                <FileJson className="h-4 w-4 mr-2" /> Graph data (JSON)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadText(`${result.projectName}-report.md`, exportMarkdown(result), 'text/markdown')}>
                <FileText className="h-4 w-4 mr-2" /> Analysis report (Markdown)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 px-0" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>

          <Button variant="outline" size="sm" className="h-8" onClick={reset}>
            <FolderSearch className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline text-xs">Scan project</span>
          </Button>
        </header>

        {/* legend */}
        <div className="flex items-center gap-3 px-4 py-1.5 border-b text-[10px] text-muted-foreground overflow-x-auto shrink-0">
          <span className="flex items-center gap-1 shrink-0"><ShieldCheck className="h-3 w-3 text-emerald-500" /> local-only, secrets redacted</span>
          {result.nodes.filter((n) => n.level === 1).map((n) => (
            <span key={n.id} className="flex items-center gap-1 shrink-0">
              <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[n.category].fill }} />
              {CATEGORY_LABELS[n.category]}
            </span>
          ))}
        </div>

        {/* main workspace */}
        <div className="flex-1 flex min-h-0">
          <aside className="w-64 shrink-0 hidden md:block min-h-0">
            <Sidebar
              result={result}
              filterCategories={filterCategories}
              onToggleFilter={toggleFilter}
              onOpenFile={openFile}
              onLocate={locate}
            />
          </aside>

          <main className="flex-1 min-w-0 relative min-h-0">
            <ReactFlowProvider>
              <GraphCanvas
                key={result.projectName}
                result={result}
                expanded={expanded}
                selectedId={selectedId}
                highlightIds={highlightIds}
                filterCategories={filterCategories}
                onSelect={setSelectedId}
                onToggleExpand={toggleExpand}
              />
            </ReactFlowProvider>
            {/* expand-all hint overlay */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex gap-2">
              <Button size="sm" variant="secondary" className="h-7 text-xs shadow"
                onClick={() => setExpanded(new Set(result.nodes.filter((n) => n.level === 1).map((n) => n.id)))}>
                Expand all
              </Button>
              <Button size="sm" variant="secondary" className="h-7 text-xs shadow" onClick={() => setExpanded(new Set())}>
                Collapse all
              </Button>
            </div>
          </main>

          {panelOpen ? (
            <aside className="w-80 shrink-0 hidden lg:block min-h-0 relative">
              <button
                className="absolute -left-3 top-3 z-20 h-6 w-6 rounded-full border bg-background shadow flex items-center justify-center hover:border-primary"
                onClick={() => setPanelOpen(false)}
                title="Hide details"
              >
                <X className="h-3 w-3" />
              </button>
              <DetailPanel
                result={result}
                node={selectedNode}
                onClose={() => setSelectedId(null)}
                onOpenFile={openFile}
                onSelect={setSelectedId}
              />
            </aside>
          ) : (
            <button
              className="shrink-0 w-8 border-l flex items-center justify-center hover:bg-accent text-muted-foreground"
              onClick={() => setPanelOpen(true)}
              title="Show details"
            >
              <Search className="h-3.5 w-3.5 rotate-90" />
            </button>
          )}
        </div>

        <BottomPanel result={result} ingestWarnings={ingestWarnings} />

        <CodeViewer file={viewer?.file ?? null} highlightLine={viewer?.line} onClose={() => setViewer(null)} />
        <TraceDialog
          result={result}
          open={traceOpen}
          onClose={() => setTraceOpen(false)}
          onOpenFile={openFile}
          onSelect={(id) => { locate(id); setPanelOpen(true); }}
        />
      </div>
    </TooltipProvider>
  );
}
