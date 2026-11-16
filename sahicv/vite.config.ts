import { readFileSync, existsSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Reads KEY=value pairs from .dev.vars (the same file Cloudflare's tools use). */
function devVars(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync('.dev.vars')) return out;
  for (const line of readFileSync('.dev.vars', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Runs the API (worker/api.ts) inside the Vite dev server, so `npm run dev` is the whole app. */
function apiDev(): Plugin {
  return {
    name: 'sahicv-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const { handleApi } = await server.ssrLoadModule('/worker/api.ts');
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, body: body ? new Uint8Array(body) : undefined });
          const response: Response = await handleApi(request, { ...devVars(), ...process.env });
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          console.error(err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'dev_error', message: String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDev()],
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  server: { port: 5173, host: true },
});
