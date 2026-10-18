// Structural analysis: file tree, entry points, API routes, symbols,
// database models, env var references, and file-to-file import edges.

import type {
  ApiEndpoint, DbModel, Evidence, SourceFile, SymbolInfo, AtlasEdge, TreeNode,
} from './types';
import { extractEnvVarNames } from './redact';

export function buildTree(files: SourceFile[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();
  for (const f of files) {
    const parts = f.path.split('/');
    let siblings = roots;
    let prefix = '';
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      prefix = prefix ? `${prefix}/${name}` : name;
      let node = siblings.find((n) => n.name === name && !isFile === !n.file);
      if (!node) {
        node = { name, path: prefix };
        if (isFile) node.file = f;
        siblings.push(node);
        siblings.sort((a, b) => (a.file ? 1 : 0) - (b.file ? 1 : 0) || a.name.localeCompare(b.name));
        if (!isFile) dirMap.set(prefix, node);
      }
      siblings = node.children ?? (node.children = []);
    }
  }
  return roots;
}

const ENTRY_PATTERNS = [
  /(^|\/)index\.(ts|tsx|js|jsx)$/, /(^|\/)main\.(ts|tsx|js|jsx|py)$/,
  /(^|\/)app\.(ts|js|py)$/, /(^|\/)server\.(ts|js)$/, /(^|\/)manage\.py$/,
  /(^|\/)Program\.cs$/, /(^|\/)main\.go$/, /(^|\/)Application\.(java|kt)$/,
];

export function findEntryPoints(files: SourceFile[]): string[] {
  return files.filter((f) => ENTRY_PATTERNS.some((re) => re.test(f.path))).map((f) => f.path);
}

// ---------------- API endpoints ----------------

const ENDPOINT_PATTERNS: {
  re: RegExp;
  framework: string;
  method: (m: RegExpExecArray) => string;
  path: (m: RegExpExecArray) => string;
  handler?: (m: RegExpExecArray, line: string) => string | undefined;
}[] = [
  {
    re: /\b(?:app|router|route)\.(get|post|put|patch|delete|options|head)\(\s*['"`]([^'"`]+)['"`]/g,
    framework: 'Express-style',
    method: (m) => m[1].toUpperCase(),
    path: (m) => m[2],
    handler: (_m, line) => line.match(/(?:async\s+)?(\w+)\s*(?:,\s*async)?\s*\(/)?.[1],
  },
  {
    re: /@(?:app|router)\.(get|post|put|patch|delete|options)\(\s*["']([^"']+)["']/g,
    framework: 'FastAPI/Flask-style',
    method: (m) => m[1].toUpperCase(),
    path: (m) => m[2],
    handler: () => undefined,
  },
  {
    re: /@(?:Get|Post|Put|Patch|Delete)\(\s*['"]([^'"]+)['"]/g,
    framework: 'NestJS',
    method: (m) => m[0].match(/@(\w+)\(/)![1].replace(/Mapping$/, '').toUpperCase(),
    path: (m) => m[1],
  },
  {
    re: /path\(\s*['"]([^'"]+)['"]/g,
    framework: 'Django',
    method: () => 'ANY',
    path: (m) => m[1],
  },
];

export function extractEndpoints(files: SourceFile[]): ApiEndpoint[] {
  const out: ApiEndpoint[] = [];
  const seen = new Set<string>();

  // Pass 0: map router module -> URL prefix (e.g. FastAPI include_router(prefix="/api/auth"))
  const prefixByStem = new Map<string, string>();
  for (const f of files) {
    if (f.language !== 'Python') continue;
    let m: RegExpExecArray | null;
    const re = /include_router\(\s*([\w\.]+)\.router\s*,\s*prefix\s*=\s*["']([^"']+)["']/g;
    while ((m = re.exec(f.content))) {
      const stem = m[1].split('.').pop()!;
      if (!prefixByStem.has(stem)) prefixByStem.set(stem, m[2]);
    }
  }
  const stemOf = (path: string) => path.split('/').pop()!.replace(/\.py$/, '');

  for (const f of files) {
    const prefix = f.language === 'Python' ? (prefixByStem.get(stemOf(f.path)) ?? '') : '';
    const lines = f.content.split('\n');
    lines.forEach((line, i) => {
      for (const p of ENDPOINT_PATTERNS) {
        p.re.lastIndex = 0;
        const m = p.re.exec(line);
        if (!m) continue;
        const method = p.method(m);
        const rawPath = p.path(m);
        const path = prefix && rawPath !== '/' && !rawPath.startsWith(prefix)
          ? `${prefix}${rawPath.startsWith('/') ? rawPath : '/' + rawPath}`
          : rawPath;
        const key = `${method} ${path}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          id: `ep:${method}:${path}`,
          method,
          path,
          handler: p.handler?.(m, line),
          file: f.path,
          line: i + 1,
          framework: p.framework,
        });
      }
    });
  }
  return out;
}

// ---------------- Symbols ----------------

export function extractSymbols(files: SourceFile[]): SymbolInfo[] {
  const out: SymbolInfo[] = [];
  for (const f of files) {
    const lines = f.content.split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // Python / general
      let m = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
      if (m && f.language === 'Python') return out.push({ name: m[1], kind: 'function', file: f.path, line: i + 1 });
      m = trimmed.match(/^class\s+(\w+)/);
      if (m && f.language === 'Python') return out.push({ name: m[1], kind: 'class', file: f.path, line: i + 1 });
      // JS/TS
      m = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (m) return out.push({ name: m[1], kind: 'function', file: f.path, line: i + 1 });
      m = trimmed.match(/^(?:export\s+)?class\s+(\w+)/);
      if (m) return out.push({ name: m[1], kind: 'class', file: f.path, line: i + 1 });
      m = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
      if (m) return out.push({ name: m[1], kind: 'function', file: f.path, line: i + 1 });
      m = trimmed.match(/^(?:export\s+)?interface\s+(\w+)/);
      if (m) return out.push({ name: m[1], kind: 'interface', file: f.path, line: i + 1 });
      m = trimmed.match(/^(?:export\s+)?(?:const|function)\s+([A-Z]\w+)\s*(?:=\s*\(|=\s*function|<|\()/);
      if (m) return out.push({ name: m[1], kind: 'component', file: f.path, line: i + 1 });
      m = trimmed.match(/^(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*\(\s*(?:props|\{)/);
      if (m) return out.push({ name: m[1], kind: 'component', file: f.path, line: i + 1 });
    });
  }
  return out;
}

// ---------------- Database models ----------------

export function extractDbModels(files: SourceFile[]): DbModel[] {
  const out: DbModel[] = [];
  for (const f of files) {
    const lines = f.content.split('\n');
    // SQLAlchemy: class User(Base): __tablename__ = "users"
    if (f.language === 'Python') {
      lines.forEach((line, i) => {
        const m = line.match(/^class\s+(\w+)\s*\((?:Base|db\.Model|models?\.Model)\)/);
        if (m) out.push({ name: m[1], file: f.path, line: i + 1 });
      });
    }
    // Mongoose: const UserSchema = new mongoose.Schema({ ... })
    if (/\.(ts|js)$/.test(f.path)) {
      const m = f.content.match(/(?:const|let|var)\s+(\w+)(?:Schema|Model)?\s*=\s*(?:new\s+)?(?:mongoose\.)?Schema\s*\(/);
      if (m) out.push({ name: m[1], file: f.path });
      // TypeORM entity
      f.content.split('\n').forEach((line, i) => {
        const em = line.match(/@Entity\(\s*['"]?([\w-]+)?/);
        if (em) {
          const nm = f.content.slice(0, f.content.indexOf(line)).match(/class\s+(\w+)/g);
          out.push({ name: nm?.length ? nm[nm.length - 1].replace('class ', '') : (em[1] ?? 'Entity'), file: f.path, line: i + 1 });
        }
      });
    }
    // Prisma schema: model User { ... }
    if (f.path.endsWith('schema.prisma')) {
      lines.forEach((line, i) => {
        const m = line.match(/^model\s+(\w+)\s*\{/);
        if (m) out.push({ name: m[1], file: f.path, line: i + 1 });
      });
    }
  }
  return out;
}

// ---------------- Env vars ----------------

export function collectEnvVars(files: SourceFile[]): { name: string; file: string }[] {
  const map = new Map<string, string>();
  for (const f of files) {
    for (const name of extractEnvVarNames(f.content)) {
      if (!map.has(name)) map.set(name, f.path);
    }
  }
  return [...map.entries()].map(([name, file]) => ({ name, file }));
}

// ---------------- Import edges between files ----------------

const IMPORT_FROM_RE = [
  /from\s+['"](\.[^'"]+)['"]/g,
  /import\s+['"](\.[^'"]+)['"]/g,
  /require\(\s*['"](\.[^'"]+)['"]\s*\)/g,
  /from\s+(\.[\w\.]+)\s+import/g, // python relative
  /import\s+(\.[\w\.]+)/g,
];

function resolveImport(fromPath: string, spec: string, allPaths: Set<string>): string | null {
  const dir = fromPath.split('/').slice(0, -1).join('/');
  const base = (dir ? dir + '/' : '') + spec.replace(/^\.?\//, '').replace(/\./g, '/');
  const candidates = [
    base,
    base + '.ts', base + '.tsx', base + '.js', base + '.jsx',
    base + '.py', base + '.vue', base + '.svelte',
    base + '/index.ts', base + '/index.tsx', base + '/index.js',
    base + '/__init__.py', base.replace(/\/$/, '') + '.py',
  ];
  for (const c of candidates) if (allPaths.has(c)) return c;
  return null;
}

export function buildImportEdges(files: SourceFile[]): AtlasEdge[] {
  const allPaths = new Set(files.map((f) => f.path));
  const edges: AtlasEdge[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    for (const re of IMPORT_FROM_RE) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.content))) {
        const target = resolveImport(f.path, m[1], allPaths);
        if (!target || target === f.path) continue;
        const key = `${f.path}->${target}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({
          id: `imp:${key}`,
          source: `file:${f.path}`,
          target: `file:${target}`,
          kind: 'imports',
          confidence: 'confirmed',
          evidence: [{ kind: 'import', path: f.path }],
        });
      }
    }
  }
  return edges;
}

// group helper for file-level evidence
export function evidence(path: string, kind = 'code'): Evidence {
  return { kind, path };
}
