// Global search index and simple connection tracing.

import type { AnalysisResult, AtlasNode } from './types';

export interface SearchEntry {
  type: 'node' | 'file' | 'endpoint' | 'symbol' | 'tech' | 'env-var';
  label: string;
  nodeId?: string;
  file?: string;
  line?: number;
}

export function buildSearchIndex(result: AnalysisResult): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const v of result.envVars) out.push({ type: 'env-var', label: v.name, file: v.file });
  for (const n of result.nodes) {
    out.push({ type: 'node', label: n.label, nodeId: n.id });
    for (const s of n.symbols) out.push({ type: 'symbol', label: s, nodeId: n.id });
  }
  for (const f of result.files) out.push({ type: 'file', label: f.path, file: f.path });
  for (const e of result.endpoints) out.push({ type: 'endpoint', label: `${e.method} ${e.path}`, nodeId: e.id, file: e.file, line: e.line });
  for (const t of result.technologies) out.push({ type: 'tech', label: t.name, nodeId: `tech:${t.name}` });
  return out;
}

export function searchIndex(index: SearchEntry[], query: string, limit = 30): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return index
    .filter((e) => terms.every((t) => e.label.toLowerCase().includes(t)))
    .slice(0, limit);
}

export interface TraceStep {
  title: string;
  nodeId?: string;
  file?: string;
  line?: number;
  note?: string;
  resolved: boolean;
}

/** Keyword-based connection tracing. Only returns steps backed by code evidence. */
export function traceConnections(result: AnalysisResult, query: string): TraceStep[] {
  const q = query.toLowerCase();
  const steps: TraceStep[] = [];
  const adjacency = new Map<string, string[]>();
  for (const e of result.edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  }

  // find endpoints matching the query
  const matchedEps = result.endpoints.filter((e) => q.includes(e.path.toLowerCase().replace(/\//g, ' ')) || e.path.toLowerCase().split('/').some((p) => p && q.includes(p)));
  const files = result.files;

  if (matchedEps.length) {
    const ep = matchedEps[0];
    steps.push({ title: `API endpoint ${ep.method} ${ep.path}`, nodeId: ep.id, file: ep.file, line: ep.line, resolved: true, note: 'Route registered here' });
    if (ep.handler) {
      steps.push({ title: `Handler function "${ep.handler}"`, nodeId: ep.id, file: ep.file, line: ep.line, resolved: true, note: 'Handles the request' });
    } else {
      steps.push({ title: 'Handler function', resolved: false, note: 'Could not statically resolve the handler function name.' });
    }
    // callers
    const callers = result.edges.filter((e) => e.target === ep.id && e.kind === 'calls-api');
    if (callers.length) {
      for (const c of callers.slice(0, 3)) {
        steps.push({ title: `Called by ${c.source.replace('file:', '')}`, nodeId: c.source, file: c.source.replace('file:', ''), resolved: true, note: `Evidence: ${c.evidence[0]?.path}` });
      }
    } else {
      steps.push({ title: 'Frontend caller', resolved: false, note: 'No frontend code calling this endpoint was detected.' });
    }
    // what the handler touches (symbols in same file)
    const syms = result.symbols.filter((s) => s.file === ep.file).slice(0, 3);
    for (const s of syms) {
      steps.push({ title: `Uses ${s.kind} "${s.name}"`, file: s.file, line: s.line, resolved: true });
    }
    return steps;
  }

  // symbol / component trace
  const sym = result.symbols.find((s) => q.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(q));
  if (sym) {
    steps.push({ title: `${sym.name} (${sym.kind})`, file: sym.file, line: sym.line, resolved: true });
    const importers = result.edges.filter((e) => e.target === `file:${sym.file}` && e.kind === 'imports');
    for (const imp of importers.slice(0, 5)) {
      steps.push({ title: `Imported by ${imp.source.replace('file:', '')}`, nodeId: imp.source.replace('file:', '') === sym.file ? undefined : imp.source, file: imp.source.replace('file:', ''), resolved: true });
    }
    if (!importers.length) steps.push({ title: 'Importers', resolved: false, note: 'No importing files found.' });
    return steps;
  }

  // file search
  const file = files.find((f) => f.path.toLowerCase().includes(q));
  if (file) {
    steps.push({ title: `File ${file.path}`, file: file.path, resolved: true });
    const importers = result.edges.filter((e) => e.target === `file:${file.path}`);
    for (const imp of importers.slice(0, 5)) {
      steps.push({ title: `Imported by ${imp.source.replace('file:', '')}`, file: imp.source.replace('file:', ''), resolved: true });
    }
    if (!importers.length) steps.push({ title: 'Importers', resolved: false, note: 'No importing files found.' });
    return steps;
  }

  steps.push({ title: 'No traceable match', resolved: false, note: 'Try an endpoint path (e.g. "/login"), a function name, or a file name.' });
  return steps;
}

export function neighborsOf(result: AnalysisResult, nodeId: string): Set<string> {
  const set = new Set<string>([nodeId]);
  for (const e of result.edges) {
    if (e.source === nodeId) set.add(e.target);
    if (e.target === nodeId) set.add(e.source);
  }
  return set;
}

export function nodeById(result: AnalysisResult, id: string): AtlasNode | undefined {
  return result.nodes.find((n) => n.id === id);
}
