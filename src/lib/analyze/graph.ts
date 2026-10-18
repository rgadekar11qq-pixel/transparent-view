// Graph generation: turns detected technologies, endpoints, models, files
// and relationships into the AtlasNode / AtlasEdge model.

import type {
  AnalysisResult, AtlasEdge, AtlasNode, ApiEndpoint, Category, SourceFile, TechItem,
} from './types';
import { attachExplanations } from './explain';

export const ALL_CATEGORIES: Exclude<Category, 'project'>[] = [
  'frontend', 'backend', 'database', 'apis', 'auth', 'storage',
  'dependencies', 'config', 'testing', 'deployment', 'external',
];

export const CATEGORY_LABELS: Record<Category, string> = {
  project: 'Project',
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Database',
  apis: 'APIs',
  auth: 'Authentication',
  storage: 'File Storage',
  dependencies: 'Dependencies',
  config: 'Configuration',
  testing: 'Testing',
  deployment: 'Deployment',
  external: 'External Services',
};

const CAPS = { endpoints: 60, models: 40, packages: 30, configFiles: 30, files: 20 };

function fileCategory(f: SourceFile): Category | null {
  const base = f.path.split('/').pop()!;
  const ext = base.split('.').pop()?.toLowerCase();
  if (/test|spec/i.test(base) || f.path.includes('__tests__') || f.path.includes('/tests/')) return 'testing';
  if (['json', 'yaml', 'yml', 'toml', 'ini', 'env', 'xml'].includes(ext ?? '') || base.startsWith('.')) return 'config';
  if (/dockerfile|docker-compose|\.github\/workflows|vercel|fly\.toml|render\.yaml/i.test(f.path)) return 'deployment';
  if (['html', 'htm', 'css', 'scss', 'sass', 'less', 'vue', 'svelte'].includes(ext ?? '')) return 'frontend';
  if (['sql'].includes(ext ?? '')) return 'database';
  if (['tsx', 'jsx'].includes(ext ?? '')) return 'frontend';
  if (['ts', 'js', 'mjs', 'cjs', 'py', 'go', 'java', 'cs', 'php', 'rb', 'rs'].includes(ext ?? '')) return 'backend';
  if (['md'].includes(ext ?? '')) return null;
  return null;
}

export function categorizeFile(f: SourceFile): Category | null {
  return fileCategory(f);
}

/** Detect frontend API calls like fetch('/api/users'), axios.get('/users') */
export function extractApiCalls(files: SourceFile[]): { file: string; line: number; method: string; path: string }[] {
  const out: { file: string; line: number; method: string; path: string }[] = [];
  const re = /(?:fetch|axios\.(get|post|put|patch|delete)|\.(get|post|put|patch|delete))\(\s*\(?\s*[`'"]([^`'"?]+)/g;
  for (const f of files) {
    if (!/\.(ts|tsx|js|jsx|vue|svelte)$/.test(f.path)) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content))) {
      const line = f.content.slice(0, m.index).split('\n').length;
      out.push({ file: f.path, line, method: (m[1] ?? m[2] ?? 'GET').toUpperCase(), path: m[3] });
    }
  }
  return out;
}

function normalizePath(p: string): string {
  return p.replace(/^\/?(api\/)?/, '/').replace(/\/+$/, '') || '/';
}

export interface GraphInput {
  projectName: string;
  files: SourceFile[];
  technologies: TechItem[];
  endpoints: ApiEndpoint[];
  dbModels: { name: string; file: string; line?: number }[];
  entryPoints: string[];
  envVars: { name: string; file: string }[];
  importEdges: AtlasEdge[];
}

export function buildGraph(input: GraphInput): { nodes: AtlasNode[]; edges: AtlasEdge[] } {
  const nodes: AtlasNode[] = [];
  const edges: AtlasEdge[] = [];
  const nodeById = new Map<string, AtlasNode>();

  const addNode = (n: AtlasNode) => {
    nodes.push(n);
    nodeById.set(n.id, n);
  };
  const addEdge = (e: AtlasEdge) => {
    if (!nodeById.has(e.source) || !nodeById.has(e.target)) return;
    edges.push(e);
  };

  // ---- root ----
  addNode({
    id: 'project', label: input.projectName, category: 'project', level: 0,
    filePaths: [], symbols: [],
    evidence: [{ kind: 'root', path: input.projectName }],
    confidence: 'confirmed',
    description: `Root of the analyzed project "${input.projectName}".`,
    childCount: 0,
  });

  const techByCat = new Map<Category, TechItem[]>();
  for (const t of input.technologies) {
    if (!techByCat.has(t.category)) techByCat.set(t.category, []);
    techByCat.get(t.category)!.push(t);
  }

  // ---- categories present ----
  const present = new Set<Category>(techByCat.keys());
  if (input.endpoints.length) present.add('apis');
  if (input.dbModels.length) present.add('database');
  if (input.envVars.length || input.files.some((f) => f.path.split('/').pop()!.startsWith('.') || ['json','yaml','yml','toml','env'].includes(f.path.split('.').pop() ?? ''))) present.add('config');
  if (input.files.some((f) => /test|spec/i.test(f.path))) present.add('testing');
  if (input.entryPoints.length) { present.add('backend'); present.add('frontend'); }
  for (const f of input.files) { const c = categorizeFile(f); if (c) present.add(c); }

  const catNodes = new Map<Category, AtlasNode>();
  for (const cat of ALL_CATEGORIES) {
    if (!present.has(cat)) continue;
    const n: AtlasNode = {
      id: `cat:${cat}`, label: CATEGORY_LABELS[cat], category: cat, parentId: 'project', level: 1,
      filePaths: [], symbols: [], evidence: [], confidence: 'confirmed',
      description: `Everything CodeAtlas discovered about the ${CATEGORY_LABELS[cat].toLowerCase()} of this project.`,
    };
    addNode(n);
    catNodes.set(cat, n);
    addEdge({ id: `e:project:${cat}`, source: 'project', target: n.id, kind: 'contains', confidence: 'confirmed', evidence: [] });
  }
  nodeById.get('project')!.childCount = catNodes.size;

  // ---- technology nodes ----
  for (const [cat, techs] of techByCat) {
    const catNode = catNodes.get(cat);
    if (!catNode) continue;
    for (const t of techs) {
      const id = `tech:${t.name}`;
      if (nodeById.has(id)) continue;
      addNode({
        id, label: t.version ? `${t.name} ${t.version}` : t.name, category: cat, parentId: catNode.id, level: 2,
        technology: t.name, filePaths: t.evidence.map((e) => e.path), symbols: [],
        evidence: t.evidence, confidence: t.confidence,
        description: `${t.name} (${t.kind} evidence, ${t.confidence}).`,
      });
      addEdge({ id: `e:${catNode.id}:${id}`, source: catNode.id, target: id, kind: 'uses', confidence: t.confidence, evidence: t.evidence });
    }
    catNode.childCount = (catNode.childCount ?? 0) + techs.length;
  }

  // ---- API endpoints ----
  const apisCat = catNodes.get('apis');
  if (apisCat) {
    const eps = input.endpoints.slice(0, CAPS.endpoints);
    for (const ep of eps) {
      addNode({
        id: ep.id, label: `${ep.method} ${ep.path}`, category: 'apis', parentId: apisCat.id, level: 2,
        filePaths: [ep.file], symbols: ep.handler ? [ep.handler] : [],
        evidence: [{ kind: 'route', path: ep.file, line: ep.line }],
        confidence: 'confirmed',
        description: `${ep.framework} route: handles ${ep.method} requests to ${ep.path}${ep.handler ? ` via function "${ep.handler}"` : ''}.`,
      });
      addEdge({ id: `e:${apisCat.id}:${ep.id}`, source: apisCat.id, target: ep.id, kind: 'contains', confidence: 'confirmed', evidence: [] });
    }
    if (input.endpoints.length > CAPS.endpoints) {
      addNode({
        id: 'apis:overflow', label: `… and ${input.endpoints.length - CAPS.endpoints} more endpoints`, category: 'apis', parentId: apisCat.id, level: 2,
        filePaths: [], symbols: [], evidence: [], confidence: 'confirmed',
      });
    }
    apisCat.childCount = input.endpoints.length;
  }

  // ---- database models ----
  const dbCat = catNodes.get('database');
  if (dbCat && input.dbModels.length) {
    for (const m of input.dbModels.slice(0, CAPS.models)) {
      const id = `model:${m.name}`;
      addNode({
        id, label: m.name, category: 'database', parentId: dbCat.id, level: 2,
        filePaths: [m.file], symbols: [m.name],
        evidence: [{ kind: 'model', path: m.file, line: m.line }],
        confidence: 'confirmed',
        description: `Data model "${m.name}" defined in ${m.file}${m.line ? `:${m.line}` : ''}.`,
      });
      addEdge({ id: `e:${dbCat.id}:${id}`, source: dbCat.id, target: id, kind: 'contains', confidence: 'confirmed', evidence: [] });
    }
    dbCat.childCount = (dbCat.childCount ?? 0) + input.dbModels.length;
  }

  // ---- entry point file nodes ----
  const fileCatCounts = new Map<Category, number>();
  for (const f of input.files) {
    if (!input.entryPoints.includes(f.path)) continue;
    const cat = categorizeFile(f) ?? 'backend';
    const catNode = catNodes.get(cat);
    if (!catNode) continue;
    const id = `file:${f.path}`;
    if (nodeById.has(id)) continue;
    addNode({
      id, label: f.path.split('/').pop()!, category: cat, parentId: catNode.id, level: 2,
      filePaths: [f.path], symbols: [],
      evidence: [{ kind: 'entry-point', path: f.path }],
      confidence: 'confirmed',
      description: `Application entry point: ${f.path}.`,
    });
    addEdge({ id: `e:${catNode.id}:${id}`, source: catNode.id, target: id, kind: 'contains', confidence: 'confirmed', evidence: [] });
    fileCatCounts.set(cat, (fileCatCounts.get(cat) ?? 0) + 1);
    catNode.childCount = (catNode.childCount ?? 0) + 1;
  }

  // ---- packages (dependencies category) ----
  const depCat = catNodes.get('dependencies');
  if (depCat) {
    const pkgs: { name: string; version?: string; path: string }[] = [];
    for (const f of input.files) {
      const base = f.path.split('/').pop()!;
      if (base === 'package.json') {
        try {
          const j = JSON.parse(f.content);
          for (const k of Object.keys({ ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) })) {
            pkgs.push({ name: k, version: j.dependencies?.[k] ?? j.devDependencies?.[k], path: f.path });
          }
        } catch { /* ignore */ }
      }
      if (base === 'requirements.txt') {
        for (const line of f.content.split('\n')) {
          const m = line.trim().match(/^([A-Za-z0-9_\-\.]+)/);
          if (m && !line.trim().startsWith('#')) pkgs.push({ name: m[1], path: f.path });
        }
      }
    }
    for (const p of pkgs.slice(0, CAPS.packages)) {
      const id = `dep:${p.name}`;
      addNode({
        id, label: p.version ? `${p.name}@${p.version}` : p.name, category: 'dependencies', parentId: depCat.id, level: 2,
        filePaths: [p.path], symbols: [], evidence: [{ kind: 'manifest', path: p.path }],
        confidence: 'confirmed', description: `Declared package ${p.name}${p.version ? ` (${p.version})` : ''}.`,
      });
      addEdge({ id: `e:${depCat.id}:${id}`, source: depCat.id, target: id, kind: 'contains', confidence: 'confirmed', evidence: [] });
    }
    if (pkgs.length > CAPS.packages) {
      addNode({
        id: 'dep:overflow', label: `… and ${pkgs.length - CAPS.packages} more packages`, category: 'dependencies', parentId: depCat.id, level: 2,
        filePaths: [], symbols: [], evidence: [], confidence: 'confirmed',
      });
    }
    depCat.childCount = pkgs.length;
  }

  // ---- config files ----
  const cfgCat = catNodes.get('config');
  if (cfgCat) {
    const cfgFiles = input.files.filter((f) => categorizeFile(f) === 'config').slice(0, CAPS.configFiles);
    for (const f of cfgFiles) {
      const id = `file:${f.path}`;
      if (nodeById.has(id)) continue;
      addNode({
        id, label: f.path.split('/').pop()!, category: 'config', parentId: cfgCat.id, level: 2,
        filePaths: [f.path], symbols: [], evidence: [{ kind: 'config', path: f.path }],
        confidence: 'confirmed', description: `Configuration file: ${f.path}.`,
      });
      addEdge({ id: `e:${cfgCat.id}:${id}`, source: cfgCat.id, target: id, kind: 'contains', confidence: 'confirmed', evidence: [] });
    }
    if (input.envVars.length) {
      addNode({
        id: 'config:envvars', label: `Environment variables (${input.envVars.length})`, category: 'config', parentId: cfgCat.id, level: 2,
        filePaths: [...new Set(input.envVars.map((v) => v.file))], symbols: input.envVars.map((v) => v.name),
        evidence: input.envVars.slice(0, 10).map((v) => ({ kind: 'env-var', path: v.file })),
        confidence: 'confirmed', description: 'Environment variables the code reads. Values are never displayed.',
      });
      addEdge({ id: `e:${cfgCat.id}:envvars`, source: cfgCat.id, target: 'config:envvars', kind: 'contains', confidence: 'confirmed', evidence: [] });
    }
    cfgCat.childCount = cfgFiles.length + (input.envVars.length ? 1 : 0);
  }

  // ---- file import edges ----
  for (const e of input.importEdges) {
    if (nodeById.has(e.source) && nodeById.has(e.target)) edges.push(e);
  }

  // ---- frontend -> API tracing ----
  const apiCalls = extractApiCalls(input.files);
  const epByNorm = new Map<string, ApiEndpoint>();
  for (const ep of input.endpoints) epByNorm.set(`${ep.method}:${normalizePath(ep.path)}`, ep);
  for (const call of apiCalls) {
    const norm = normalizePath(call.path);
    const ep = epByNorm.get(`${call.method}:${norm}`) ?? epByNorm.get(`ANY:${norm}`);
    if (!ep) continue;
    // only create a frontend file node if absent
    const srcId = `file:${call.file}`;
    if (!nodeById.has(srcId)) {
      const cat = categorizeFile(input.files.find((f) => f.path === call.file)!) ?? 'frontend';
      const catNode = catNodes.get(cat);
      if (!catNode) continue;
      addNode({
        id: srcId, label: call.file.split('/').pop()!, category: cat, parentId: catNode.id, level: 2,
        filePaths: [call.file], symbols: [], evidence: [{ kind: 'api-call', path: call.file, line: call.line }],
        confidence: 'confirmed', description: `Source file ${call.file} — calls API endpoints.`,
      });
      addEdge({ id: `e:${catNode.id}:${srcId}`, source: catNode.id, target: srcId, kind: 'contains', confidence: 'confirmed', evidence: [] });
    }
    addEdge({
      id: `trace:${call.file}:${call.line}->${ep.id}`,
      source: srcId, target: ep.id, kind: 'calls-api', confidence: 'confirmed',
      evidence: [{ kind: 'api-call', path: call.file, line: call.line }],
    });
  }

  attachExplanations(nodes);
  return { nodes, edges };
}

/** Categories from the standard list that were NOT detected. */
export function missingCategories(result: AnalysisResult): Exclude<Category, 'project'>[] {
  const present = new Set(result.nodes.filter((n) => n.level === 1).map((n) => n.category));
  return ALL_CATEGORIES.filter((c) => !present.has(c));
}
