import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FolderOpen, FileArchive, Sparkles, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { loadZip, loadDirectoryList, loadDirectoryHandle, ingestFiles } from '@/lib/analyze/ingest';
import type { SourceFile } from '@/lib/analyze/types';
import { SAMPLE_PROJECT } from '@/lib/sampleProject';

interface Props {
  onLoaded: (files: SourceFile[], sourceLabel: string, warnings: string[]) => void;
}

export default function UploadScreen({ onLoaded }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const zipInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);

  const handleZip = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const res = await loadZip(buf);
      if (!res.files.length) {
        setError(res.warnings[0] ?? 'No readable text files found in that archive.');
      } else {
        onLoaded(res.files, file.name, res.warnings);
      }
    } catch {
      setError('Failed to read the file. Please provide a .zip archive.');
    } finally {
      setBusy(false);
    }
  }, [onLoaded]);

  const handleBrowseFolder = useCallback(async () => {
    if (busy) return;
    setError(null);
    if ('showDirectoryPicker' in window) {
      try {
        // Native Chromium directory picker
        // @ts-expect-error showDirectoryPicker is supported in modern browsers
        const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
        setBusy(true);
        const res = await loadDirectoryHandle(handle);
        if (!res.files.length) {
          setError(res.warnings[0] ?? 'No readable source files found in that directory.');
        } else {
          onLoaded(res.files, handle.name || 'selected folder', res.warnings);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          // If permission issue, fallback to file input
          dirInput.current?.click();
        }
      } finally {
        setBusy(false);
      }
    } else {
      dirInput.current?.click();
    }
  }, [busy, onLoaded]);

  const handleDirInputFallback = useCallback(async (list: FileList) => {
    setBusy(true);
    setError(null);
    const res = await loadDirectoryList(list);
    if (!res.files.length) {
      setError('No readable text files found in that directory.');
    } else {
      onLoaded(res.files, 'local directory', res.warnings);
    }
    setBusy(false);
  }, [onLoaded]);

  const handleScanPath = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = pathInput.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scan-local?path=${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP error ${res.status}`);
      }
      const data = await res.json();
      if (!data.files || data.files.length === 0) {
        throw new Error('No readable code files found in that directory.');
      }
      const ingested = ingestFiles(data.files);
      onLoaded(ingested.files, data.folderName || trimmed, ingested.warnings);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to scan the specified directory.');
    } finally {
      setBusy(false);
    }
  }, [pathInput, busy, onLoaded]);

  const loadSample = useCallback(() => {
    const raw = Object.entries(SAMPLE_PROJECT).map(([path, content]) => ({ path, content }));
    const res = ingestFiles(raw);
    onLoaded(res.files, 'sample project "taskflow"', res.warnings);
  }, [onLoaded]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 text-primary font-semibold text-sm uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4" /> 100% local analysis
          </div>
          <h1 className="text-5xl font-bold tracking-tight">Transparent <span className="text-primary">View</span></h1>
          <p className="text-lg text-muted-foreground">
            Understand any codebase visually. Choose any project folder on your computer to scan its architecture, components, routes, and connections.
          </p>
        </div>

        {/* Primary Action: Browse Folder */}
        <Card
          className="border-2 border-primary/40 bg-card hover:border-primary transition-all shadow-md cursor-pointer"
          onClick={handleBrowseFolder}
        >
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary">
              <FolderOpen className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl">Browse Local Project Folder</CardTitle>
            <CardDescription className="text-sm">
              Click to browse and select any software project folder on your computer.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 text-center">
            <Button size="lg" className="px-8 font-semibold shadow-sm" disabled={busy} onClick={(e) => { e.stopPropagation(); handleBrowseFolder(); }}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning…
                </>
              ) : (
                <>
                  <FolderOpen className="mr-2 h-5 w-5" /> Choose Folder (Browse)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Path Input Form */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
            Or enter a local path directly
          </div>
          <form onSubmit={handleScanPath} className="flex gap-2">
            <Input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="e.g. D:\Transparent view or C:\Users\...\my-project"
              disabled={busy}
              className="text-sm"
            />
            <Button type="submit" variant="secondary" disabled={!pathInput.trim() || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Scan</span>
            </Button>
          </form>
        </div>

        {/* Secondary options: ZIP & Sample */}
        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => !busy && zipInput.current?.click()}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm">Upload a ZIP</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Drop or select a .zip archive of a codebase.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Button variant="ghost" size="sm" className="w-full text-xs" disabled={busy}>Select ZIP archive…</Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => !busy && loadSample()}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-sm">Sample Project</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Instant React + FastAPI + PostgreSQL demo.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Button variant="ghost" size="sm" className="w-full text-xs" disabled={busy}>Try demo project</Button>
            </CardContent>
          </Card>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm text-center">
            {error}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground max-w-lg mx-auto">
          Privacy guarantee: Files are processed locally on your machine. No source code or secrets are ever sent to remote servers.
        </p>

        {/* Hidden inputs */}
        <input
          ref={zipInput}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleZip(f);
            e.target.value = '';
          }}
        />
        <input
          ref={dirInput}
          type="file"
          className="hidden"
          // @ts-expect-error non-standard but widely supported attribute
          webkitdirectory=""
          onChange={(e) => {
            if (e.target.files?.length) void handleDirInputFallback(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
