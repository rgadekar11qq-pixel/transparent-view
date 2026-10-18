// Project ingestion: ZIP archives and directory uploads, with safety limits.
// Everything runs locally in the browser. Analyzed files are treated as
// untrusted input: no path traversal, no execution, strict size limits.

import JSZip from 'jszip';
import type { SourceFile } from './types';

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.venv',
  'venv',
  'env',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  'target',
  'vendor',
  '.idea',
  '.vscode',
  '.cache',
  'tmp',
  'temp',
  'bin',
  'obj',
]);

export const MAX_FILES = 2000;
export const MAX_FILE_BYTES = 512 * 1024; // 512 KB per text file
export const MAX_TOTAL_BYTES = 40 * 1024 * 1024; // 40 MB total

const EXT_TO_LANG: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  mjs: 'JavaScript', cjs: 'JavaScript', py: 'Python', java: 'Java', go: 'Go',
  cs: 'C#', php: 'PHP', rb: 'Ruby', rs: 'Rust', html: 'HTML', htm: 'HTML',
  css: 'CSS', scss: 'CSS', sass: 'CSS', less: 'CSS', sql: 'SQL',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', md: 'Markdown',
  dockerfile: 'Dockerfile', sh: 'Shell', bash: 'Shell', vue: 'Vue',
  svelte: 'Svelte', prisma: 'Prisma', xml: 'XML', kt: 'Kotlin', swift: 'Swift',
  c: 'C', h: 'C', cpp: 'C++', env: 'Env', ini: 'INI', txt: 'Text',
};

const TEXTUAL_EXT = new Set(Object.keys(EXT_TO_LANG));

export function languageForPath(path: string): string {
  const base = path.split('/').pop() ?? '';
  if (/^dockerfile/i.test(base)) return 'Dockerfile';
  if (base.endsWith('.env') || base.startsWith('.env')) return 'Env';
  const ext = base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
  return EXT_TO_LANG[ext] ?? 'Unknown';
}

export function isTextualPath(path: string): boolean {
  const base = path.split('/').pop() ?? '';
  if (/^dockerfile/i.test(base)) return true;
  if (base.startsWith('.env')) return true;
  if (!base.includes('.')) return true; // extensionless scripts (Makefile, etc.)
  const ext = base.split('.').pop()!.toLowerCase();
  return TEXTUAL_EXT.has(ext);
}

/** Reject paths that could escape the extraction root. */
export function isUnsafePath(path: string): boolean {
  if (path.includes('\\0')) return true;
  const parts = path.split('/');
  if (parts.some((p) => p === '..')) return true;
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return true;
  return false;
}

function isIgnored(path: string): boolean {
  return path.split('/').some((part) => IGNORED_DIRS.has(part));
}

export interface IngestResult {
  files: SourceFile[];
  ignoredCount: number;
  skippedOversize: number;
  warnings: string[];
}

/** Normalize an array of (path, content) pairs into SourceFile[], applying limits. */
export function ingestFiles(
  raw: { path: string; content: string }[],
  opts?: { includeIgnored?: boolean },
): IngestResult {
  const warnings: string[] = [];
  let ignoredCount = 0;
  let skippedOversize = 0;
  let totalBytes = 0;
  const files: SourceFile[] = [];

  const cleaned = raw.map((r) => ({
    path: r.path.replace(/\\/g, '/').replace(/^\.?\//, ''),
    content: r.content,
  }));

  // If every path shares a common first directory (e.g. "myproj-main/src/..."),
  // strip it so the project root is clean.
  const firstSegs = cleaned.map((c) => c.path.split('/')[0]);
  if (cleaned.length > 1 && firstSegs.every((s) => s === firstSegs[0] && s !== '')) {
    const prefix = firstSegs[0] + '/';
    for (const c of cleaned) c.path = c.path.slice(prefix.length);
  }

  for (const { path, content } of cleaned) {
    if (!path || isUnsafePath(path)) {
      warnings.push(`Skipped unsafe path: ${path.slice(0, 80)}`);
      continue;
    }
    if (!opts?.includeIgnored && isIgnored(path)) {
      ignoredCount++;
      continue;
    }
    if (!isTextualPath(path)) continue; // skip binaries
    const size = content.length;
    if (size > MAX_FILE_BYTES) {
      skippedOversize++;
      continue;
    }
    if (files.length >= MAX_FILES) {
      warnings.push(`File limit reached (${MAX_FILES}); remaining files skipped.`);
      break;
    }
    if (totalBytes + size > MAX_TOTAL_BYTES) {
      warnings.push(`Total size limit reached (${MAX_TOTAL_BYTES / 1024 / 1024} MB); remaining files skipped.`);
      break;
    }
    totalBytes += size;
    files.push({ path, content, size, language: languageForPath(path) });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, ignoredCount, skippedOversize, warnings };
}

/** Load and safely extract a ZIP archive entirely in the browser. */
export async function loadZip(data: ArrayBuffer): Promise<IngestResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return {
      files: [],
      ignoredCount: 0,
      skippedOversize: 0,
      warnings: ['Could not read the ZIP archive. It may be corrupted or not a ZIP file.'],
    };
  }

  const raw: { path: string; content: string }[] = [];
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  // hard cap on entries before any processing (zip bomb protection)
  if (entries.length > MAX_FILES * 3) {
    return {
      files: [],
      ignoredCount: 0,
      skippedOversize: 0,
      warnings: [`Archive contains ${entries.length} entries, exceeding the safety limit. Refusing to analyze.`],
    };
  }
  for (const entry of entries) {
    if (isUnsafePath(entry.name)) continue; // zip path traversal attempt
    try {
      const content = await entry.async('string');
      raw.push({ path: entry.name, content });
    } catch {
      // binary or unreadable entry — skip
    }
  }
  return ingestFiles(raw);
}

/** Load files from modern File System Access API (window.showDirectoryPicker). */
export async function loadDirectoryHandle(dirHandle: FileSystemDirectoryHandle): Promise<IngestResult> {
  const raw: { path: string; content: string }[] = [];

  async function walk(handle: FileSystemDirectoryHandle, prefix: string) {
    // @ts-expect-error entries() is standard in FileSystemDirectoryHandle
    for await (const [name, entry] of handle.entries()) {
      if (IGNORED_DIRS.has(name) || name.startsWith('.')) continue;
      const relPath = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === 'directory') {
        if (raw.length < MAX_FILES) {
          await walk(entry as FileSystemDirectoryHandle, relPath);
        }
      } else if (entry.kind === 'file') {
        if (!isTextualPath(name) || isUnsafePath(relPath)) continue;
        if (raw.length >= MAX_FILES) break;
        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          if (file.size <= MAX_FILE_BYTES) {
            const content = await file.text();
            raw.push({ path: relPath, content });
          }
        } catch {
          // ignore unreadable
        }
      }
    }
  }

  await walk(dirHandle, '');
  return ingestFiles(raw);
}

/** Load files from a browser directory selection (webkitdirectory input). */
export async function loadDirectoryList(fileList: FileList): Promise<IngestResult> {
  const raw: { path: string; content: string }[] = [];
  const validFiles: { file: File; path: string }[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const norm = path.replace(/\\/g, '/').replace(/^\.?\//, '');
    if (isIgnored(norm) || !isTextualPath(norm) || isUnsafePath(norm)) continue;
    validFiles.push({ file: f, path: norm });
    if (validFiles.length >= MAX_FILES) break;
  }

  for (const { file, path } of validFiles) {
    if (file.size > MAX_FILE_BYTES) continue;
    try {
      const content = await file.text();
      raw.push({ path, content });
    } catch {
      // skip unreadable
    }
  }
  return ingestFiles(raw);
}
