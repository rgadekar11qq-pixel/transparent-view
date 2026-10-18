# Transparent View

> **Tagline:** Understand Any Codebase Visually.

Transparent View is a developer tool and architecture visualization engine that transforms real software repositories into interactive, expandable, node-based knowledge graphs. It explains project structure, frameworks, routes, database models, dependencies, and configuration in beginner-friendly language while grounding every insight in actual source code.

---

## Features

- **Safe Local Analysis**: Supports uploading project ZIP archives, selecting local folders (via Chromium Directory Picker API), or analyzing an instant embedded sample application. All scanning runs locally without sending source code to external servers.
- **Interactive Spider-Web Architecture Canvas**: Central project node connects to detected first-level architectural pillars (`Frontend`, `Backend`, `Database`, `APIs`, `Authentication`, `Dependencies`, `Configuration`, `Testing`, `Deployment`, etc.).
- **Dynamic Node Expansion & Lazy Exploration**: Expand and collapse individual category nodes to reveal framework details, routes, database models, components, packages, and configuration files.
- **Node Detail & Explanation Panel**: Every node features:
  - Three-tiered explanations: **Beginner**, **Intermediate**, and **Advanced**.
  - Direct file references with clickable links and line numbers.
  - Confidence indicators (`confirmed`, `inferred`, `uncertain`).
  - Code evidence and relationship connections.
- **Grounded Connection Tracing**: Trace features from frontend components and callers down to backend API endpoints, handlers, services, and database queries.
- **Code Explorer**: Integrated code viewer with syntax highlighting and jump-to-line navigation.
- **Automatic Secret Redaction**: Masks passwords, bearer tokens, AWS keys, connection string credentials, and API secrets.
- **Export Capabilities**: Export architecture graph structure as JSON or generate a comprehensive Markdown architecture report.

---

## Technology Stack

- **Frontend Framework**: React 19 + TypeScript + Vite
- **Graph Visualization**: `@xyflow/react` (React Flow)
- **UI Components & Styling**: Tailwind CSS, Radix UI, Lucide React icons
- **Static Analysis & Parsing Engine**: Custom client-side static parser supporting AST heuristics, regex pattern matching, import resolution, and framework detection
- **Testing**: Vitest 5.0.5

---

## Directory Structure

```
d:/Transparent view/
├── index.html                  # HTML entry point
├── package.json                # Project dependencies and npm scripts
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite configuration
├── vitest.config.ts            # Vitest unit test configuration
├── src/
│   ├── main.tsx                # Application mounting entry point
│   ├── App.tsx                 # Core UI coordinator, header, navigation & state
│   ├── index.css               # Global Tailwind CSS and styling variables
│   ├── components/             # UI Components
│   │   ├── AtlasNodeView.tsx   # Custom React Flow graph node with category badges
│   │   ├── BottomPanel.tsx     # Scan progress, warnings, and missing categories
│   │   ├── CodeViewer.tsx      # Code preview with syntax and line highlighting
│   │   ├── DetailPanel.tsx     # Side panel with 3-tier beginner-to-advanced explanations
│   │   ├── GraphCanvas.tsx     # Force-directed / radial React Flow graph canvas
│   │   ├── Sidebar.tsx         # File tree, category filter pills, tech inventory
│   │   ├── TraceDialog.tsx     # End-to-end connection and request flow tracer
│   │   ├── UploadScreen.tsx    # Drag-and-drop ZIP upload, local directory picker, sample loader
│   │   └── ui/                 # Accessible Radix UI component library
│   └── lib/
│       ├── categoryColors.ts   # Category visual themes and accent colors
│       ├── highlight.tsx       # Keyword and syntax highlighting helper
│       ├── sampleProject.ts    # Embedded multi-tier sample application (React + FastAPI + PG)
│       └── analyze/            # Codebase Scanning and Analysis Engine
│           ├── types.ts        # Graph nodes, edges, file metadata, category definitions
│           ├── ingest.ts       # ZIP extraction, directory traversal guard, binary filter
│           ├── detect.ts       # Technology detection across 20+ frameworks & DB engines
│           ├── structure.ts    # Route extraction, model discovery, import resolution
│           ├── graph.ts        # Graph generation, parent-child linking, missing category check
│           ├── layout.ts       # Radial/spider-web graph layout algorithm
│           ├── redact.ts       # Secret masking and environment variable detection
│           ├── search.ts       # Global search index and connection tracing
│           ├── explain.ts      # Deterministic explanations (Beginner, Intermediate, Advanced)
│           ├── export.ts       # Markdown and JSON export generator
│           └── engine.test.ts  # Automated test suite (26 comprehensive test cases)
```

---

## Getting Started

### Prerequisites

- Node.js 18+ (tested with Node.js 20+)
- npm or pnpm

### Installation

```bash
# Navigate to the project directory
cd "d:\Transparent view"

# Dependencies are already installed in node_modules, but if reinstalling:
npm install
```

### Running the Development Server

```bash
npm run dev
```

The development server starts at `http://localhost:5173/`. Open this URL in any modern browser.

### Running Automated Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
```

The compiled assets will be emitted into `dist/`.

---

## How Codebase Scanning Works

1. **Ingestion & Sanitization (`ingest.ts`)**:
   - Safely parses ZIP archives or directory entries.
   - Prevents path traversal vulnerabilities (`../`, absolute paths, Windows drive letters).
   - Skips generated/cache folders (`node_modules`, `.git`, `dist`, `__pycache__`, `.venv`).
   - Rejects binary assets and enforces file size limits.
2. **Technology Detection (`detect.ts`)**:
   - Inspects manifests (`package.json`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`, etc.).
   - Distinguishes between declared packages, imported modules, and active connections.
   - Ignores misleading comments or variable names.
3. **Structure & Endpoint Extraction (`structure.ts`)**:
   - Extracts Express, FastAPI, Flask, NestJS, and Django routes with router prefixes.
   - Discovers ORM schemas and database models (SQLAlchemy, Prisma, TypeORM, Django ORM).
   - Resolves intra-project file import dependencies.
4. **Graph Construction & Radial Layout (`graph.ts`, `layout.ts`)**:
   - Constructs a central project node with category clusters.
   - Places first-level pillars on an inner radial orbit and fans out child nodes on an outer orbit.
   - Unverified categories are left out of the graph and displayed under "Not Detected" to avoid hallucinating false architecture.
5. **Secret Redaction (`redact.ts`)**:
   - Redacts credentials, tokens, AWS keys, and connection strings prior to UI rendering or report export.

---

## Known Limitations

- Monorepo package-to-package workspace resolution is supported for standard configurations, but customized package manager symlinks may require direct scanning of individual packages.
- Deep static data flow analysis across dynamic runtime reflection or dynamically constructed URL strings is best-effort.
