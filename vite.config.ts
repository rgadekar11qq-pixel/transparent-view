import path from "path"
import fs from "fs"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

const IGNORED = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.venv', 'venv', 'env', '__pycache__',
  '.pytest_cache', '.mypy_cache', 'target', 'vendor', '.idea',
  '.vscode', '.cache', 'tmp', 'temp', 'bin', 'obj'
]);

const TEXT_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'java', 'go',
  'cs', 'php', 'rb', 'rs', 'html', 'htm', 'css', 'scss', 'sass',
  'less', 'sql', 'json', 'yaml', 'yml', 'toml', 'md', 'dockerfile',
  'sh', 'bash', 'vue', 'svelte', 'prisma', 'xml', 'kt', 'swift',
  'c', 'h', 'cpp', 'env', 'ini', 'txt'
]);

function localScannerPlugin(): Plugin {
  return {
    name: 'local-scanner',
    configureServer(server) {
      server.middlewares.use('/api/scan-local', (req, res) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const folder = url.searchParams.get('path');
        if (!folder || !fs.existsSync(folder)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid or non-existent directory path' }));
          return;
        }

        try {
          const stat = fs.statSync(folder);
          if (!stat.isDirectory()) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Path is not a directory' }));
            return;
          }
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Cannot access directory' }));
          return;
        }

        const files: { path: string; content: string }[] = [];

        function walk(dir: string, prefix = '') {
          if (files.length >= 2000) return;
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (IGNORED.has(entry.name) || entry.name.startsWith('.')) continue;
              const full = path.join(dir, entry.name);
              const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
              if (entry.isDirectory()) {
                walk(full, rel);
              } else if (entry.isFile()) {
                const ext = entry.name.includes('.') ? entry.name.split('.').pop()!.toLowerCase() : '';
                if (!TEXT_EXTS.has(ext) && !/^dockerfile/i.test(entry.name) && !entry.name.startsWith('.env')) continue;
                try {
                  const s = fs.statSync(full);
                  if (s.size <= 512 * 1024) {
                    const content = fs.readFileSync(full, 'utf-8');
                    files.push({ path: rel.replace(/\\/g, '/'), content });
                  }
                } catch {
                  // ignore unreadable
                }
              }
            }
          } catch {
            // ignore folder read permission errors
          }
        }

        try {
          walk(folder);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ files, folderName: path.basename(folder) }));
        } catch (err: unknown) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: (err as Error)?.message || 'Error scanning directory' }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react(), localScannerPlugin()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
