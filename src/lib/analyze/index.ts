// Pipeline orchestrator: files in -> full AnalysisResult out.

import type { AnalysisResult, SourceFile } from './types';
import { detectProjectName, detectTechnologies } from './detect';
import {
  buildTree, findEntryPoints, extractEndpoints, extractSymbols,
  extractDbModels, collectEnvVars, buildImportEdges,
} from './structure';
import { buildGraph } from './graph';

export const LIMITATIONS = [
  'Analysis is purely static: no code is executed, so runtime-only behavior (dependency injection, dynamic imports with variables, decorators) may be missed.',
  'Detection is evidence-based but not perfect: a package declared in a manifest may be unused, and an actively used package may be missed.',
  'Comments and strings are not fully distinguished from real code during symbol extraction.',
  'Frontend-to-backend tracing matches URL paths textually; dynamic URLs and environment-based base URLs may produce unresolved connections.',
  'Secret redaction is best-effort and must not be relied on as a security guarantee.',
  'Monorepos are analyzed as a single project; per-package boundaries are not modeled yet.',
];

export function analyzeProject(files: SourceFile[]): AnalysisResult {
  const projectName = detectProjectName(files);
  const technologies = detectTechnologies(files);
  const tree = buildTree(files);
  const entryPoints = findEntryPoints(files);
  const endpoints = extractEndpoints(files);
  const symbols = extractSymbols(files);
  const dbModels = extractDbModels(files);
  const envVars = collectEnvVars(files);
  const importEdges = buildImportEdges(files);

  const { nodes, edges } = buildGraph({
    projectName, files, technologies, endpoints, dbModels, entryPoints, envVars, importEdges,
  });

  const languages: Record<string, number> = {};
  for (const f of files) languages[f.language] = (languages[f.language] ?? 0) + 1;

  return {
    projectName,
    scannedAt: new Date().toISOString(),
    files, tree, technologies, nodes, edges,
    endpoints, dbModels, symbols, entryPoints, envVars,
    warnings: [],
    ignoredCount: 0,
    stats: {
      totalFiles: files.length,
      analyzedFiles: files.length,
      skippedOversize: 0,
      languages,
    },
    limitations: LIMITATIONS,
  };
}
