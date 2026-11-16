import { handleApi } from './api.ts';
import type { Env } from './env.ts';

// Cloudflare Worker entry point. API requests are handled here; everything
// else is the static website, served by Cloudflare from the build output.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
