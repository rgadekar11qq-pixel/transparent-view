// Deterministic, beginner-friendly explanations. These require no external
// AI service. Templates are grounded in the detected evidence for each node.

import type { AtlasNode, TechItem } from './types';

const TECH_EXPLANATIONS: Record<string, { beginner: string; intermediate: string; advanced: string }> = {
  React: {
    beginner: 'React is a library for building the visual parts of a website (buttons, pages, forms). This project uses it for its user interface.',
    intermediate: 'React organizes the UI into reusable components. When data changes, React updates only the parts of the page that depend on that data, instead of redrawing everything.',
    advanced: 'React uses a virtual DOM and a unidirectional data flow. Components re-render when state or props change; hooks like useState/useEffect manage local state and side effects.',
  },
  'Next.js': {
    beginner: 'Next.js is a framework built on top of React. It adds page routing, server-side rendering, and API routes to a React project.',
    intermediate: 'Next.js decides how each page is built: ahead of time (static), on each request (server-rendered), or in the browser (client-side). The app/ or pages/ directory maps URLs to files.',
    advanced: 'Next.js supports SSR, SSG, ISR and React Server Components. API routes in pages/api or route handlers in app/ run on the server.',
  },
  Vue: {
    beginner: 'Vue is a library for building website interfaces. It lets developers describe the page with HTML-like templates that react to data changes.',
    intermediate: 'Vue apps are built from components with reactive state. Directives like v-if and v-for control rendering in templates.',
    advanced: 'Vue 3 uses a proxy-based reactivity system and a composition API. Builds are typically handled by Vite.',
  },
  Express: {
    beginner: 'Express is a web server framework for Node.js. It receives browser requests and decides which function answers each URL.',
    intermediate: 'Express apps register routes (method + path) with handler functions. Middleware functions run in order and can modify requests/responses before the handler.',
    advanced: 'Express is a thin routing/middleware layer over Node\'s http module. Request flows: middleware chain -> route handler -> response. Error-handling middleware has 4 arguments.',
  },
  FastAPI: {
    beginner: 'FastAPI is a Python framework for building web APIs — programs that receive requests over the internet and send back data, usually JSON.',
    intermediate: 'FastAPI uses Python type hints to validate request data automatically. Routes are functions decorated with @app.get/@app.post; Pydantic models define request/response shapes.',
    advanced: 'FastAPI is built on Starlette (ASGI) and Pydantic. It supports dependency injection, async endpoints, OpenAPI schema generation, and automatic request validation.',
  },
  Flask: {
    beginner: 'Flask is a lightweight Python framework for building websites and APIs. It maps URLs to Python functions.',
    intermediate: 'Flask uses decorators like @app.route("/path") to bind URLs to view functions. Extensions add databases, auth, and forms.',
    advanced: 'Flask is a WSGI micro-framework. Request context and application context are thread-local proxies; the app is typically served by gunicorn/uwsgi in production.',
  },
  Django: {
    beginner: 'Django is a full Python web framework: it includes an admin panel, an ORM for the database, user accounts, and URL routing out of the box.',
    intermediate: 'Django splits code into apps. Models define database tables, views handle requests, and urls.py maps URLs to views.',
    advanced: 'Django follows MTV architecture with a mature ORM, middleware pipeline, and request/response cycle. Migrations are auto-generated from model changes.',
  },
  PostgreSQL: {
    beginner: 'PostgreSQL is a database. It stores information (users, orders, posts...) so the application can retrieve it later. It is reliable and widely used in production.',
    intermediate: 'PostgreSQL is a relational database: data is organized in tables with rows and columns, and tables can reference each other. The app talks to it through an ORM or SQL queries.',
    advanced: 'PostgreSQL supports ACID transactions, complex queries, joins, indexes, JSONB columns, and extensions like PostGIS. Connections are usually pooled in web apps.',
  },
  MySQL: {
    beginner: 'MySQL is a database — software that stores the application\'s data in tables so it can be searched and updated quickly.',
    intermediate: 'MySQL is a relational database. The project accesses it through a driver (e.g. mysql2 for Node, PyMySQL for Python) or an ORM.',
    advanced: 'MySQL uses InnoDB by default with ACID transactions. Web apps typically pool connections and use parameterized queries or an ORM.',
  },
  SQLite: {
    beginner: 'SQLite is a simple database stored in a single file on disk. It needs no separate server, which makes it popular for small apps, prototypes, and tests.',
    intermediate: 'SQLite is embedded in the app process itself. It supports standard SQL but with a single-writer model, so it suits low-to-medium traffic.',
    advanced: 'SQLite is a serverless, zero-config, transactional engine. In Python it ships as the sqlite3 stdlib module.',
  },
  MongoDB: {
    beginner: 'MongoDB is a database that stores data as flexible documents (similar to JSON) instead of rigid tables. It suits data whose shape changes often.',
    intermediate: 'MongoDB stores documents in collections. Queries filter by field values. Mongoose (Node) or Motor/PyMongo (Python) are typical client libraries.',
    advanced: 'MongoDB scales horizontally via sharding and replica sets. Indexes support efficient queries; aggregation pipelines enable data processing in the database.',
  },
  Redis: {
    beginner: 'Redis is a very fast in-memory data store. Projects typically use it for caching (remembering recent results) or temporary data like login sessions.',
    intermediate: 'Redis keeps data in memory with optional persistence. Common uses: session store, cache, rate limiting, message queues (pub/sub, streams).',
    advanced: 'Redis is single-threaded with an event loop, supporting strings, hashes, lists, sets, sorted sets, and streams. Eviction policies (LRU/LFU) control memory use.',
  },
  SQLAlchemy: {
    beginner: 'SQLAlchemy is a Python library that lets the code talk to databases using Python classes instead of raw SQL text.',
    intermediate: 'SQLAlchemy\'s ORM maps Python classes to tables and class attributes to columns. create_engine(...) opens the connection; sessions run transactions.',
    advanced: 'SQLAlchemy Core compiles Python expressions to SQL with bind parameters. The ORM uses the unit-of-work pattern via Session; alembic handles migrations.',
  },
  Prisma: {
    beginner: 'Prisma is a toolkit that connects the app to a database. The database structure is declared in schema.prisma, and Prisma generates type-safe code to query it.',
    intermediate: 'Prisma Client is generated from the schema and replaces hand-written SQL. Migrations are SQL files generated and applied with "prisma migrate".',
    advanced: 'Prisma supports PostgreSQL, MySQL, SQLite, MongoDB, and SQL Server. The query engine is a Rust binary; relation queries use include/select rather than joins.',
  },
  JWT: {
    beginner: 'JWT (JSON Web Token) is a signed string that proves a user is logged in. After login, the app gives the browser a token, which it sends with later requests.',
    intermediate: 'A JWT has three parts (header.payload.signature), usually sent in the Authorization: Bearer header. The server verifies the signature instead of storing sessions.',
    advanced: 'JWTs are signed (HMAC/RS256/EdDSA) but NOT encrypted — payload is readable base64. Risks: alg confusion, none-alg, long expiry, storing sensitive data in claims.',
  },
  Docker: {
    beginner: 'Docker packages the application and everything it needs into a container — a box that runs the same way on any machine.',
    intermediate: 'A Dockerfile describes how to build the image: base image, dependencies, build steps, start command. docker-compose.yml wires multiple containers together.',
    advanced: 'Docker images are layered filesystems built from a Dockerfile; containers are isolated processes sharing the host kernel. Compose handles networking, volumes, and env per service.',
  },
  Vite: {
    beginner: 'Vite is a build tool: it bundles the project\'s many source files into a small number of files the browser can load, and provides instant dev-server reloads.',
    intermediate: 'Vite uses esbuild for dependency pre-bundling and Rollup for production builds. Its dev server serves modules natively via native ESM.',
    advanced: 'Vite plugins hook into its Rollup-compatible plugin container. HMR is file-level via WebSocket; build target and chunking are configured in vite.config.',
  },
  TypeScript: {
    beginner: 'TypeScript is JavaScript with type annotations. It helps catch mistakes (like passing text where a number is expected) before the code runs.',
    intermediate: 'TypeScript compiles to plain JavaScript. Types are erased at runtime; interfaces and generics document the shapes of data flowing through the app.',
    advanced: 'The tsc compiler performs static analysis with structural typing. tsconfig controls strictness, module resolution, and emit targets.',
  },
  Jest: {
    beginner: 'Jest is a testing framework for JavaScript. It runs automated checks so developers know the code still works after changes.',
    intermediate: 'Tests describe expected behavior with describe/it blocks and assertions. Jest includes mocking, snapshots, and code coverage.',
    advanced: 'Jest runs tests in parallel workers with a jsdom environment for DOM tests. Module mocking uses jest.mock; coverage uses V8/istanbul instrumentation.',
  },
  pytest: {
    beginner: 'pytest is a Python testing tool. Developers write small functions named test_* and pytest runs them all, reporting failures.',
    intermediate: 'pytest discovers test_*.py files, runs fixtures for setup/teardown, and supports parametrization and plugins (e.g. pytest-asyncio).',
    advanced: 'pytest\'s fixture system is dependency-injection based via function arguments. conftest.py shares fixtures; hooks customize collection and reporting.',
  },
  'Tailwind CSS': {
    beginner: 'Tailwind CSS is a styling system where you add small class names (like text-red-500 or flex) directly in the HTML to style elements.',
    intermediate: 'Tailwind provides utility classes mapped to CSS properties. Its build step removes unused classes (purging) so production CSS stays small.',
    advanced: 'Tailwind v3+ scans content files with a JIT engine. Configuration (tailwind.config.js) extends the theme; plugins add variants and components.',
  },
};

export function explainTech(name: string): { beginner: string; intermediate?: string; advanced?: string } | undefined {
  const hit = Object.entries(TECH_EXPLANATIONS).find(([k]) => name.toLowerCase().includes(k.toLowerCase()));
  if (!hit) return undefined;
  const v = hit[1];
  return { beginner: v.beginner, intermediate: v.intermediate, advanced: v.advanced };
}

const KIND_EXPLANATIONS: Record<string, string> = {
  frontend: 'This is the part of the application users see and interact with in the browser.',
  backend: 'This is the server-side part: code that runs on a server, receives requests, and applies the project\'s logic.',
  database: 'This covers how the application stores and retrieves its data.',
  apis: 'API endpoints are doorways: one part of the application sends a request to a URL, and another part answers it.',
  auth: 'Authentication checks who a user is (login); authorization decides what they may do.',
  dependencies: 'Third-party packages the project reuses instead of writing everything from scratch.',
  config: 'Configuration tells the application how to run: environment variables, build settings, and config files.',
  testing: 'Automated tests verify that the code behaves as expected.',
  deployment: 'Everything needed to run the application on a server: containers, CI/CD, hosting config.',
  external: 'External services the project talks to over the network (payment, cloud storage, AI APIs...).',
  storage: 'Where files (images, uploads) are kept — either on disk or in a cloud storage service.',
  project: 'The root of the analyzed project.',
};

function attachNodeExplanation(node: AtlasNode): void {
  const base = KIND_EXPLANATIONS[node.category];
  const techExplain = node.technology ? explainTech(node.technology) : undefined;

  if (techExplain) {
    node.explanations = techExplain;
  } else if (node.technology) {
    node.explanations = {
      beginner: `${node.technology}: ${base}`,
      intermediate: `Detected in this project with ${node.evidence.length} piece(s) of evidence. ${node.description ?? ''}`,
    };
  } else {
    node.explanations = {
      beginner: `${node.label} — ${base}`,
      intermediate: node.description,
    };
  }

  // ground explanations in evidence
  if (node.explanations && node.filePaths.length > 0) {
    node.explanations.beginner += ` You can find the relevant code in: ${node.filePaths.slice(0, 3).join(', ')}.`;
    if (node.explanations.intermediate) {
      node.explanations.intermediate += `\n\nEvidence: ${node.evidence.slice(0, 5).map((e) => e.path + (e.line ? `:${e.line}` : '')).join(', ')}.`;
    }
  }
}

export function attachExplanations(nodes: AtlasNode[]): void {
  for (const n of nodes) attachNodeExplanation(n);
}

export function techConfidenceLabel(t: TechItem): string {
  return `${t.confidence} (${t.kind})`;
}
