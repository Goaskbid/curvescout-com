/* CurveScout pass status on Cloudflare (r70, inactive until the Cloudflare move).
   Scheduled every 3 hours: reads the open DATEX II feed (Open Data Hub, South Tyrol) with the SAME code the GitHub
   job uses today (.github/scripts/pass-core.mjs) and stores the result in KV only when the reported status changed.
   Requests: the site asks for /data/live/passes.json, this script answers from KV; if KV is empty or fails, the
   static copy shipped with the site is served instead, so the page never breaks. Budget: 8 runs a day, at most
   41 outside reads each; KV at most 8 writes a day. */
import { collect } from '../.github/scripts/pass-core.mjs';
const KEY = 'passes.json', strip = o => JSON.stringify({ ...o, updated: undefined });
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate', 'x-content-type-options': 'nosniff' };
async function refresh(env) {
  const list = await env.ASSETS.fetch('https://assets.local/data/passes.json');
  const passes = list.ok ? ((await list.json()).passes || []) : [];
  const body = await collect(passes, () => {});
  const old = await env.LIVE.get(KEY);
  if (old && strip(JSON.parse(old)) === strip(body)) return 'unchanged';
  await env.LIVE.put(KEY, JSON.stringify({ updated: new Date().toISOString(), ...body }));
  return 'written';
}
export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(refresh(env).catch(() => null)); },
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/data/live/passes.json' && (req.method === 'GET' || req.method === 'HEAD')) {
      try { const v = await env.LIVE.get(KEY); if (v) return new Response(req.method === 'HEAD' ? null : v, { headers }); } catch (e) {}
    }
    return env.ASSETS.fetch(req);   // static copy, or the real 404 page
  }
};
