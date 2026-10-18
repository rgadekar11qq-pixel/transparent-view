// Technology detection. Uses multiple independent evidence sources:
// dependency manifests, lockfiles, imports, config files, connection strings.
// Distinguishes declared / imported / active / config / inference evidence.

import type { Confidence, Evidence, SourceFile, TechItem, Category } from './types';
import { redactSecrets } from './redact';

interface Detector {
  name: string;
  category: Exclude<Category, 'project'>;
  /** known package/module names that indicate this technology */
  packages?: string[];
  /** version check only applies to manifests; keep it simple */
}

const DETECTORS: Detector[] = [
  // frontend frameworks
  { name: 'React', category: 'frontend', packages: ['react'] },
  { name: 'Next.js', category: 'frontend', packages: ['next'] },
  { name: 'Vue', category: 'frontend', packages: ['vue', 'nuxt'] },
  { name: 'Angular', category: 'frontend', packages: ['@angular/core'] },
  { name: 'Svelte', category: 'frontend', packages: ['svelte', '@sveltejs/kit'] },
  { name: 'Tailwind CSS', category: 'frontend', packages: ['tailwindcss'] },
  // backend frameworks
  { name: 'Express', category: 'backend', packages: ['express'] },
  { name: 'NestJS', category: 'backend', packages: ['@nestjs/core'] },
  { name: 'Fastify', category: 'backend', packages: ['fastify'] },
  { name: 'FastAPI', category: 'backend', packages: ['fastapi'] },
  { name: 'Flask', category: 'backend', packages: ['flask'] },
  { name: 'Django', category: 'backend', packages: ['django'] },
  { name: 'Spring Boot', category: 'backend', packages: ['spring-boot'] },
  { name: 'ASP.NET Core', category: 'backend', packages: ['Microsoft.AspNetCore'] },
  { name: 'Laravel', category: 'backend', packages: ['laravel/framework'] },
  { name: 'Rails', category: 'backend', packages: ['rails'] },
  // databases / ORMs
  { name: 'PostgreSQL', category: 'database', packages: ['pg', 'psycopg2', 'psycopg', 'asyncpg'] },
  { name: 'MySQL', category: 'database', packages: ['mysql', 'mysql2', 'pymysql', 'mysql-connector-python'] },
  { name: 'SQLite', category: 'database', packages: ['sqlite3', 'better-sqlite3'] },
  { name: 'MongoDB', category: 'database', packages: ['mongodb', 'mongoose', 'pymongo', 'motor', 'beanie'] },
  { name: 'Redis', category: 'database', packages: ['redis', 'ioredis', 'aioredis'] },
  { name: 'SQLAlchemy', category: 'database', packages: ['sqlalchemy'] },
  { name: 'Prisma', category: 'database', packages: ['prisma', '@prisma/client'] },
  { name: 'TypeORM', category: 'database', packages: ['typeorm'] },
  { name: 'Sequelize', category: 'database', packages: ['sequelize'] },
  { name: 'Mongoose', category: 'database', packages: ['mongoose'] },
  // auth
  { name: 'JWT auth', category: 'auth', packages: ['jsonwebtoken', 'pyjwt', 'python-jose', 'jose'] },
  { name: 'Passport.js', category: 'auth', packages: ['passport'] },
  { name: 'Auth.js / NextAuth', category: 'auth', packages: ['next-auth', '@auth/core'] },
  { name: 'bcrypt', category: 'auth', packages: ['bcrypt', 'bcryptjs', 'passlib'] },
  // testing
  { name: 'Jest', category: 'testing', packages: ['jest', '@types/jest'] },
  { name: 'Vitest', category: 'testing', packages: ['vitest'] },
  { name: 'pytest', category: 'testing', packages: ['pytest'] },
  { name: 'Cypress', category: 'testing', packages: ['cypress'] },
  { name: 'Playwright', category: 'testing', packages: ['@playwright/test', 'playwright'] },
  { name: 'Supertest', category: 'testing', packages: ['supertest'] },
  // build / tooling (config category)
  { name: 'Vite', category: 'config', packages: ['vite'] },
  { name: 'TypeScript', category: 'config', packages: ['typescript'] },
  { name: 'Webpack', category: 'config', packages: ['webpack'] },
  // storage / external
  { name: 'AWS SDK', category: 'external', packages: ['@aws-sdk/client-s3', 'aws-sdk', 'boto3'] },
  { name: 'Stripe', category: 'external', packages: ['stripe'] },
  { name: 'OpenAI SDK', category: 'external', packages: ['openai'] },
];

/** Map a detected tech name to evidence strength heuristics. */
function confidenceFor(kind: TechItem['kind'], found: string[]): Confidence {
  if (kind === 'declared' && found.length > 0) return 'confirmed';
  if (kind === 'imported' || kind === 'active' || kind === 'config') return 'confirmed';
  return 'likely';
}

function findFile(files: SourceFile[], name: string): SourceFile | undefined {
  const lower = name.toLowerCase();
  return files.find((f) => f.path.toLowerCase() === name.toLowerCase() || f.path.toLowerCase().endsWith('/' + lower));
}

function parseJsonSafe(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function detectProjectName(files: SourceFile[]): string {
  const pkg = findFile(files, 'package.json');
  if (pkg) {
    const j = parseJsonSafe(pkg.content);
    if (j && typeof j.name === 'string' && j.name) return j.name;
  }
  const py = findFile(files, 'pyproject.toml');
  if (py) {
    const m = py.content.match(/^name\s*=\s*["']([^"']+)["']/m);
    if (m) return m[1];
  }
  // fallback: common root directory name
  const roots = new Set(files.map((f) => f.path.split('/')[0]).filter(Boolean));
  if (roots.size === 1) return [...roots][0];
  return 'analyzed-project';
}

interface RawTech {
  item: Omit<TechItem, 'confidence'>;
  found: string[];
}

export function detectTechnologies(files: SourceFile[]): TechItem[] {
  const out = new Map<string, RawTech>();

  const add = (
    name: string,
    category: Exclude<Category, 'project'>,
    kind: TechItem['kind'],
    evidence: Evidence,
    version?: string,
  ) => {
    const existing = out.get(name);
    if (existing) {
      existing.item.evidence.push(evidence);
      if (kind === 'declared') existing.item.kind = 'declared';
      if (version && !existing.item.version) existing.item.version = version;
    } else {
      out.set(name, {
        item: { name, category, kind, version, evidence: [evidence] },
        found: [name],
      });
    }
  };

  // ---------- 1. package.json (declared) ----------
  for (const f of files) {
    if (f.path.split('/').pop() !== 'package.json') continue;
    const j = parseJsonSafe(f.content);
    if (!j) continue;
    const deps: Record<string, string> = {
      ...((j.dependencies as Record<string, string>) ?? {}),
      ...((j.devDependencies as Record<string, string>) ?? {}),
    };
    for (const d of DETECTORS) {
      for (const pkg of d.packages ?? []) {
        if (deps[pkg]) {
          add(d.name, d.category, 'declared', { kind: 'manifest', path: f.path, snippet: `"${pkg}": "${deps[pkg]}"` }, deps[pkg]);
        }
      }
    }
  }

  // ---------- 2. Python manifests ----------
  for (const f of files) {
    const base = f.path.split('/').pop()!;
    if (base === 'requirements.txt') {
      for (const line of f.content.split('\n')) {
        const m = line.trim().match(/^([A-Za-z0-9_\-\.]+)(\[.*\])?\s*(==|>=|~=)?\s*([\w.\-]+)?/);
        if (!m) continue;
        const pkg = m[1].toLowerCase();
        const version = m[4];
        for (const d of DETECTORS) {
          for (const p of d.packages ?? []) {
            if (pkg === p || pkg.startsWith(p + '[') || pkg.startsWith(p + '-')) {
              add(d.name, d.category, 'declared', { kind: 'manifest', path: f.path, snippet: line.trim() }, version);
            }
          }
        }
      }
    }
    if (base === 'pyproject.toml') {
      const m = f.content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
      if (m) {
        for (const dep of m[1].matchAll(/["']([^"']+)["']/g)) {
          const pkg = dep[1].toLowerCase();
          for (const d of DETECTORS) {
            for (const p of d.packages ?? []) {
              if (pkg.startsWith(p)) {
                add(d.name, d.category, 'declared', { kind: 'manifest', path: f.path, snippet: dep[1] });
              }
            }
          }
        }
      }
    }
  }

  // ---------- 3. Lockfiles -> package manager (config evidence) ----------
  const lockEvidence = (file: string, manager: string) =>
    add(manager, 'config', 'config', { kind: 'lockfile', path: file, snippet: 'lockfile present' });
  if (files.some((f) => f.path.endsWith('package-lock.json'))) lockEvidence('package-lock.json', 'npm');
  if (files.some((f) => f.path.endsWith('yarn.lock'))) lockEvidence('yarn.lock', 'Yarn');
  if (files.some((f) => f.path.endsWith('pnpm-lock.yaml'))) lockEvidence('pnpm-lock.yaml', 'pnpm');
  if (files.some((f) => f.path.endsWith('poetry.lock'))) lockEvidence('poetry.lock', 'Poetry');
  if (files.some((f) => f.path.endsWith('Pipfile.lock'))) lockEvidence('Pipfile.lock', 'Pipenv');

  // ---------- 4. Imports in source (imported / active) ----------
  const importReList = [
    /import\s+([a-zA-Z0-9_@\-\.]+)/g, // js/ts + python
    /from\s+([a-zA-Z0-9_@\-\.]+)\s+import/g, // python
    /require\(\s*['"]([^'"]+)['"]\s*\)/g, // cjs
    /from\s+['"]([^'"]+)['"]/g, // esm
    /import\s+['"]([^'"]+)['"]/g,
    /use\s+([a-zA-Z0-9_]+)::/g, // rust
    /import\s+\(?"?([\w\.\-]+)"?\)/g, // go
  ];
  for (const f of files) {
    if (!/\.(ts|tsx|js|jsx|mjs|cjs|py|rs|go)$/.test(f.path)) continue;
    for (const re of importReList) {
      let m: RegExpExecArray | null;
      const src = re.source;
      while ((m = re.exec(f.content))) {
        const mod = m[1];
        if (!mod || mod.startsWith('.')) continue;
        const root = mod.replace(/^@/, '').split(/[\/:]/)[0].toLowerCase();
        for (const d of DETECTORS) {
          for (const p of d.packages ?? []) {
            const pr = p.replace(/^@/, '').split('/')[0].toLowerCase();
            if (root === pr || mod.toLowerCase() === p.toLowerCase()) {
              // only count real import lines as code evidence
              const lineNo = f.content.slice(0, m.index).split('\n').length;
              const line = f.content.split('\n')[lineNo - 1]?.trim() ?? '';
              if (!/^\s*(import|from|require|use)\b/.test(line) && !line.includes('require(')) continue;
              add(d.name, d.category, 'imported', {
                kind: 'import', path: f.path, line: lineNo,
                snippet: redactSecrets(line.slice(0, 120)),
              });
            }
          }
        }
        // import-like evidence for python stdlib sqlite
        if (src.includes('from') && /^(sqlite3)$/.test(root)) {
          add('SQLite', 'database', 'imported', { kind: 'import', path: f.path });
        }
      }
    }
  }

  // ---------- 5. Connection strings & DB clients (active) ----------
  const connRe: { re: RegExp; name: string }[] = [
    { re: /postgres(?:ql)?:\/\//i, name: 'PostgreSQL' },
    { re: /mysql:\/\/|mysql\+pymysql:\/\//i, name: 'MySQL' },
    { re: /mongodb(\+srv)?:\/\//i, name: 'MongoDB' },
    { re: /redis:\/\//i, name: 'Redis' },
    { re: /sqlite:\/\/|DATABASE_URL.*sqlite/i, name: 'SQLite' },
  ];
  for (const f of files) {
    for (const { re, name } of connRe) {
      const m = re.exec(f.content);
      if (m) {
        const lineNo = f.content.slice(0, m.index).split('\n').length;
        add(name, 'database', 'active', {
          kind: 'connection-string', path: f.path, line: lineNo,
          snippet: redactSecrets(f.content.split('\n')[lineNo - 1]?.trim() ?? ''),
        });
      }
    }
    if (/create_engine\(/.test(f.content)) {
      add('SQLAlchemy', 'database', 'active', { kind: 'code', path: f.path, snippet: 'create_engine(...)' });
    }
  }
  if (files.some((f) => f.path.endsWith('schema.prisma'))) {
    add('Prisma', 'database', 'active', { kind: 'config', path: files.find((f) => f.path.endsWith('schema.prisma'))!.path, snippet: 'Prisma schema file' });
  }

  // ---------- 6. Config / deployment files (config) ----------
  const configDetect: { test: (f: SourceFile) => boolean; name: string; category: Exclude<Category, 'project'> }[] = [
    { test: (f) => /(^|\/)Dockerfile$/.test(f.path), name: 'Docker', category: 'deployment' },
    { test: (f) => /docker-compose.*\.(yml|yaml)$/.test(f.path), name: 'Docker Compose', category: 'deployment' },
    { test: (f) => f.path.includes('.github/workflows/'), name: 'GitHub Actions', category: 'deployment' },
    { test: (f) => f.path.split('/').pop() === 'vercel.json', name: 'Vercel', category: 'deployment' },
    { test: (f) => f.path.split('/').pop() === 'fly.toml', name: 'Fly.io', category: 'deployment' },
    { test: (f) => f.path.split('/').pop() === 'render.yaml', name: 'Render', category: 'deployment' },
    { test: (f) => f.path.split('/').pop() === 'tailwind.config.js' || f.path.split('/').pop() === 'tailwind.config.ts', name: 'Tailwind CSS', category: 'frontend' },
  ];
  for (const f of files) {
    for (const c of configDetect) {
      if (c.test(f)) add(c.name, c.category, 'config', { kind: 'config', path: f.path });
    }
  }

  // ---------- 7. Language-level inference ----------
  const langCount: Record<string, number> = {};
  for (const f of files) langCount[f.language] = (langCount[f.language] ?? 0) + 1;
  if ((langCount['TypeScript'] ?? 0) > 0) add('TypeScript', 'config', 'inference', { kind: 'inference', path: files.find((f) => f.language === 'TypeScript')!.path });
  if ((langCount['Python'] ?? 0) > 0) add('Python', 'backend', 'inference', { kind: 'inference', path: files.find((f) => f.language === 'Python')!.path });

  return [...out.values()].map((r) => ({
    ...r.item,
    confidence: confidenceFor(r.item.kind, r.found),
  }));
}
