// Core data model for CodeAtlas analysis results.

export type Category =
  | 'project'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'apis'
  | 'auth'
  | 'storage'
  | 'dependencies'
  | 'config'
  | 'testing'
  | 'deployment'
  | 'external';

export type Confidence = 'confirmed' | 'likely' | 'uncertain';

export interface Evidence {
  kind: string; // e.g. "manifest", "import", "config", "code"
  path: string;
  line?: number;
  snippet?: string; // already redacted
}

export interface SourceFile {
  path: string; // relative, forward slashes
  content: string;
  size: number;
  language: string;
}

export interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
  file?: SourceFile;
}

export interface TechItem {
  name: string;
  category: Exclude<Category, 'project'>;
  version?: string;
  confidence: Confidence;
  kind: 'declared' | 'imported' | 'active' | 'config' | 'inference';
  evidence: Evidence[];
}

export interface ApiEndpoint {
  id: string;
  method: string;
  path: string;
  handler?: string; // function name
  file: string;
  line: number;
  framework: string;
}

export interface DbModel {
  name: string;
  file: string;
  line?: number;
  fields?: { name: string; type?: string }[];
}

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'class' | 'component' | 'interface';
  file: string;
  line: number;
}

export interface AtlasNode {
  id: string;
  label: string;
  category: Category;
  parentId?: string;
  level: number;
  description?: string;
  technology?: string;
  filePaths: string[];
  symbols: string[];
  evidence: Evidence[];
  confidence: Confidence;
  explanations?: {
    beginner: string;
    intermediate?: string;
    advanced?: string;
  };
  // deeper levels are generated lazily from `childrenData`
  childCount?: number;
}

export interface AtlasEdge {
  id: string;
  source: string;
  target: string;
  kind:
    | 'contains'
    | 'imports'
    | 'calls-api'
    | 'handles-route'
    | 'uses'
    | 'tests'
    | 'configures'
    | 'possible';
  confidence: Confidence;
  evidence: Evidence[];
}

export interface AnalysisResult {
  projectName: string;
  scannedAt: string;
  files: SourceFile[];
  tree: TreeNode[];
  technologies: TechItem[];
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  endpoints: ApiEndpoint[];
  dbModels: DbModel[];
  symbols: SymbolInfo[];
  entryPoints: string[];
  envVars: { name: string; file: string }[];
  warnings: string[];
  ignoredCount: number;
  stats: {
    totalFiles: number;
    analyzedFiles: number;
    skippedOversize: number;
    languages: Record<string, number>;
  };
  limitations: string[];
}
