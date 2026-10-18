import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { ingestFiles, isUnsafePath, loadZip } from './ingest';
import { detectTechnologies, detectProjectName } from './detect';
import { extractEndpoints, extractDbModels, extractSymbols, buildImportEdges } from './structure';
import { missingCategories } from './graph';
import { analyzeProject } from './index';
import { redactSecrets } from './redact';
import { exportMarkdown } from './export';
import { buildSearchIndex, searchIndex, traceConnections } from './search';
import { SAMPLE_PROJECT } from '@/lib/sampleProject';
import type { SourceFile } from './types';

const mk = (entries: Record<string, string>): SourceFile[] => {
  const res = ingestFiles(Object.entries(entries).map(([path, content]) => ({ path, content })));
  return res.files;
};

describe('ingest safety', () => {
  it('rejects path traversal segments', () => {
    expect(isUnsafePath('../evil.txt')).toBe(true);
    expect(isUnsafePath('a/../../evil')).toBe(true);
    expect(isUnsafePath('/abs/path')).toBe(true);
    expect(isUnsafePath('C:/win/path')).toBe(true);
    expect(isUnsafePath('src/main.ts')).toBe(false);
  });

  it('skips generated directories and strips common root', () => {
    const res = ingestFiles([
      { path: 'proj/src/index.ts', content: 'x' },
      { path: 'proj/node_modules/react/index.js', content: 'x' },
      { path: 'proj/.git/config', content: 'x' },
      { path: 'proj/README.md', content: 'x' },
    ]);
    expect(res.files.map((f) => f.path)).toEqual(['README.md', 'src/index.ts']);
    expect(res.ignoredCount).toBe(2);
  });

  it('refuses zip traversal entries', async () => {
    // Note: JSZip normalizes "../" on creation, so traversal names never
    // survive extraction; the guard is enforced at ingest level too.
    const zip = new JSZip();
    zip.file('../evil.txt', 'bad');
    zip.file('ok.txt', 'fine');
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const res = await loadZip(buf);
    expect(res.files.every((f) => !isUnsafePath(f.path))).toBe(true);
    expect(res.files.map((f) => f.path)).toContain('ok.txt');
    const res2 = ingestFiles([{ path: '../evil.txt', content: 'x' }, { path: 'ok.txt', content: 'y' }]);
    expect(res2.files.map((f) => f.path)).toEqual(['ok.txt']);
  });

  it('reports malformed zips gracefully', async () => {
    const res = await loadZip(new TextEncoder().encode('not a zip').buffer as ArrayBuffer);
    expect(res.files).toEqual([]);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});

describe('technology detection', () => {
  it('detects React+Express from package.json as declared', () => {
    const files = mk({
      'package.json': JSON.stringify({
        name: 'web', dependencies: { react: '^18.0.0', express: '^4.19.0' },
        devDependencies: { jest: '^29.0.0' },
      }),
    });
    const techs = detectTechnologies(files);
    const names = techs.map((t) => t.name);
    expect(names).toContain('React');
    expect(names).toContain('Express');
    expect(names).toContain('Jest');
    const react = techs.find((t) => t.name === 'React')!;
    expect(react.confidence).toBe('confirmed');
    expect(react.version).toBe('^18.0.0');
  });

  it('detects FastAPI + SQLAlchemy + PostgreSQL from Python manifests', () => {
    const files = mk({
      'requirements.txt': 'fastapi==0.111.0\nsqlalchemy==2.0.30\npsycopg2-binary==2.9.9\n',
      'main.py': 'from fastapi import FastAPI\napp = FastAPI()',
    });
    const names = detectTechnologies(files).map((t) => t.name);
    expect(names).toContain('FastAPI');
    expect(names).toContain('SQLAlchemy');
    expect(names).toContain('PostgreSQL');
  });

  it('does NOT flag technologies that only appear in comments', () => {
    const files = mk({
      'notes.py': '# we used to use react and django here\n# import flask\nprint("hi")',
    });
    const names = detectTechnologies(files).map((t) => t.name);
    expect(names).not.toContain('React');
    expect(names).not.toContain('Django');
    expect(names).not.toContain('Flask');
  });

  it('detects database connection strings with redaction', () => {
    const files = mk({
      'db.py': 'import os\nURL = os.environ["DATABASE_URL"]  # postgres://u:secretpw123@host/db',
    });
    const techs = detectTechnologies(files);
    const pg = techs.find((t) => t.name === 'PostgreSQL');
    expect(pg).toBeDefined();
    expect(pg!.evidence[0].snippet).not.toContain('secretpw123');
  });
});

describe('structure extraction', () => {
  it('extracts Express and FastAPI endpoints with prefixes', () => {
    const files = mk({
      'server.js': "app.get('/users', listUsers); app.post('/users', createUser);",
      'main.py': 'from fastapi import FastAPI\nfrom app.routers import auth\napp = FastAPI()\napp.include_router(auth.router, prefix="/api/auth")',
      'app/routers/auth.py': 'from fastapi import APIRouter\nrouter = APIRouter()\n@router.post("/login")\ndef login(): pass',
    });
    const eps = extractEndpoints(files);
    const keys = eps.map((e) => `${e.method} ${e.path}`);
    expect(keys).toContain('GET /users');
    expect(keys).toContain('POST /api/auth/login');
  });

  it('extracts SQLAlchemy models and symbols', () => {
    const files = mk({
      'models.py': 'from sqlalchemy.orm import declarative_base\nBase = declarative_base()\nclass User(Base):\n    __tablename__ = "users"\n',
      'util.py': 'def helper(x):\n    return x\n',
    });
    const models = extractDbModels(files);
    expect(models.map((m) => m.name)).toContain('User');
    const syms = extractSymbols(files);
    expect(syms.map((s) => s.name)).toContain('helper');
    expect(syms.map((s) => s.name)).toContain('User');
  });

  it('builds import edges between files', () => {
    const files = mk({
      'a.ts': "import { b } from './b';\nconsole.log(b);",
      'b.ts': 'export const b = 1;',
    });
    const edges = buildImportEdges(files);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('file:a.ts');
    expect(edges[0].target).toBe('file:b.ts');
  });
});

describe('sample project end-to-end', () => {
  const files = mk(SAMPLE_PROJECT);
  const result = analyzeProject(files);

  it('identifies the project name', () => {
    expect(result.projectName).toBe('taskflow');
  });

  it('finds the expected categories', () => {
    const cats = result.nodes.filter((n) => n.level === 1).map((n) => n.category);
    expect(cats).toContain('frontend');
    expect(cats).toContain('backend');
    expect(cats).toContain('database');
    expect(cats).toContain('apis');
    expect(cats).toContain('auth');
    expect(cats).toContain('testing');
    expect(cats).toContain('deployment');
  });

  it('detects key technologies with evidence', () => {
    const names = result.technologies.map((t) => t.name);
    for (const expected of ['React', 'Vite', 'FastAPI', 'SQLAlchemy', 'PostgreSQL', 'JWT auth', 'pytest', 'Docker', 'GitHub Actions']) {
      expect(names).toContain(expected);
    }
  });

  it('traces frontend calls to backend endpoints', () => {
    const calls = result.edges.filter((e) => e.kind === 'calls-api');
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((c) => c.target === 'ep:POST:/api/auth/login')).toBe(true);
  });

  it('includes endpoints with router prefixes and DB models', () => {
    expect(result.endpoints.map((e) => e.path)).toContain('/api/auth/login');
    expect(result.dbModels.map((m) => m.name)).toEqual(expect.arrayContaining(['User', 'Task']));
  });

  it('traceConnections resolves the login flow', () => {
    const steps = traceConnections(result, 'login');
    const titles = steps.map((s) => s.title).join(' | ');
    expect(titles).toContain('/api/auth/login');
    expect(steps.some((s) => s.resolved)).toBe(true);
  });

  it('search finds nodes, files and env vars', () => {
    const idx = buildSearchIndex(result);
    expect(searchIndex(idx, 'LoginPage')[0]?.nodeId).toBeDefined();
    expect(searchIndex(idx, 'JWT_SECRET')[0]?.type).toBe('env-var');
    expect(searchIndex(idx, 'fastapi').length).toBeGreaterThan(0);
  });

  it('exports a Markdown report without secrets', () => {
    const md = exportMarkdown(result);
    expect(md).toContain('taskflow');
    expect(md).toContain('/api/auth/login');
    expect(md).not.toContain('supersecret123');
    expect(md).not.toContain('do-not-share-me');
    expect(md).toContain('Not Detected');
  });

  it('marks missing categories instead of inventing nodes', () => {
    const missing = missingCategories(result);
    expect(missing).toContain('storage');
    const cats = new Set(result.nodes.filter((n) => n.level === 1).map((n) => n.category));
    expect(cats.has('storage')).toBe(false);
  });

  it('nodes carry beginner explanations grounded in files', () => {
    const react = result.nodes.find((n) => n.id === 'tech:React');
    expect(react?.explanations?.beginner.length).toBeGreaterThan(20);
    const pg = result.nodes.find((n) => n.id === 'tech:PostgreSQL');
    expect(pg?.explanations?.beginner).toContain('database');
  });
});

describe('projects with incomplete configuration', () => {
  it('analyzes a single static HTML file without crashing', () => {
    const files = mk({ 'index.html': '<html><body>Hello</body></html>' });
    const result = analyzeProject(files);
    expect(result.nodes.some((n) => n.category === 'frontend')).toBe(true);
    expect(result.endpoints).toEqual([]);
    expect(result.projectName).toBe('index.html');
  });

  it('detects project name from pyproject.toml', () => {
    const files = mk({ 'pyproject.toml': '[project]\nname = "mylib"\nversion = "0.1.0"' });
    expect(detectProjectName(files)).toBe('mylib');
  });
});

describe('redaction', () => {
  it('redacts passwords, tokens and URL credentials', () => {
    expect(redactSecrets('password = "hunter2secret"')).toContain('<REDACTED>');
    expect(redactSecrets('postgres://user:p4ssw0rd@db:5432/app')).not.toContain('p4ssw0rd');
    expect(redactSecrets('Authorization: Bearer abcdefghijklmnop12345')).toContain('<REDACTED>');
    expect(redactSecrets('AKIAIOSFODNN7EXAMPLE')).toContain('<REDACTED_AWS_KEY>');
  });
});

describe('edge-case projects', () => {
  it('handles project with no identifiable database by marking it missing', () => {
    const files = mk({
      'package.json': JSON.stringify({ name: 'pure-frontend', dependencies: { react: '^18.0.0' } }),
      'src/App.tsx': 'export default function App() { return <h1>Hello</h1>; }',
    });
    const result = analyzeProject(files);
    const dbNode = result.nodes.find((n) => n.id === 'cat:database');
    expect(dbNode).toBeUndefined();
    expect(missingCategories(result)).toContain('database');
  });

  it('marks unresolved API calls and routes as unresolved rather than inventing links', () => {
    const files = mk({
      'main.py': 'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/api/uncalled")\ndef uncalled(): return {"ok": True}',
      'src/client.ts': 'fetch("/api/ghost-endpoint")',
    });
    const result = analyzeProject(files);
    const steps = traceConnections(result, 'uncalled');
    expect(steps.some((s) => !s.resolved && s.title.includes('Frontend caller'))).toBe(true);
    // ghost endpoint not matching backend is not falsely linked
    const ghostCall = result.edges.find((e) => e.target.includes('ghost-endpoint'));
    expect(ghostCall).toBeUndefined();
  });
});

