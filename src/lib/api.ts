import type { Endpoint, Response, Tools } from './types';
import { load, store, uid } from './util';

export class ApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

const NO_TOOLS: Tools = { convert: true, convertAll: false, search: false, read: false };
let proxied: Endpoint[] = [];
let direct: Endpoint[] = load<Endpoint[]>('dui.direct', []);

/** Endpoints configured on the decisionUI server (keys stay there) plus the ones added in the browser. */
export async function loadEndpoints(): Promise<{ endpoints: Endpoint[]; tools: Tools }> {
  let tools = NO_TOOLS;
  try {
    const r = await fetch('/api/endpoints', { cache: 'no-store' });
    const ok = r.ok && (r.headers.get('content-type') ?? '').includes('json');
    proxied = ok ? (await r.json()).map((e: { name: string; url: string }) => ({ id: `p:${e.name}`, name: e.name, url: e.url, mode: 'proxy' as const })) : [];
    const t = await fetch('/api/tools', { cache: 'no-store' });
    if (t.ok && ok) tools = await t.json();
  } catch {
    proxied = [];
  }
  return { endpoints: [...proxied, ...direct], tools };
}

export function addEndpoint(name: string, url: string, key: string): Endpoint {
  const u = new URL(url);
  const e: Endpoint = { id: `d:${uid()}`, name: name.trim() || u.host, url: url.replace(/\/+$/, ''), key: key || undefined, mode: 'direct' };
  direct = [...direct, e];
  store('dui.direct', direct);
  return e;
}
export function removeEndpoint(id: string): void {
  direct = direct.filter((e) => e.id !== id);
  store('dui.direct', direct);
}

function target(ep: Endpoint, path: string): { url: string; headers: Record<string, string> } {
  if (ep.mode === 'proxy') return { url: `/proxy/${encodeURIComponent(ep.name)}${path}`, headers: {} };
  return { url: ep.url + path, headers: ep.key ? { Authorization: `Bearer ${ep.key}` } : {} };
}

async function failure(res: Response | globalThis.Response): Promise<ApiError> {
  let body: any = null;
  try {
    body = await (res as globalThis.Response).json();
  } catch {
    /* not JSON */
  }
  const m = body?.error?.message ?? body?.detail ?? body?.message ?? (res as globalThis.Response).statusText ?? 'request failed';
  return new ApiError(typeof m === 'string' ? m : JSON.stringify(m), (res as globalThis.Response).status);
}

export async function listModels(ep: Endpoint, signal?: AbortSignal): Promise<string[]> {
  const t = target(ep, '/v1/models');
  const res = await fetch(t.url, { headers: t.headers, signal });
  if (!res.ok) throw await failure(res);
  const j = await res.json();
  return ((j.data ?? j.models ?? []) as (string | { id: string })[]).map((m) => (typeof m === 'string' ? m : m.id)).filter(Boolean);
}

export async function ask(ep: Endpoint, body: unknown, signal?: AbortSignal): Promise<{ data: Response; ms: number }> {
  const t = target(ep, '/v1/systemone');
  const t0 = performance.now();
  let res: globalThis.Response;
  try {
    res = await fetch(t.url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...t.headers }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(ep.mode === 'direct' ? `Can't reach ${ep.url}. Is it running, and does it allow CORS?` : `Can't reach the server.`);
  }
  if (!res.ok) throw await failure(res);
  return { data: await res.json(), ms: performance.now() - t0 };
}

// ── context tools (served by decisionUI's own server) ────────────────────────────────────────────────────────────
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|ya?ml|toml|xml|log|ini|py|js|ts|tsx|jsx|c|h|cpp|go|rs|java|sh|sql|css|rst)$/i;
export const isTextFile = (f: File): boolean => !/\.html?$/i.test(f.name) && (f.type.startsWith('text/') || /^application\/(json|xml|x-yaml|toml)/.test(f.type) || TEXT_EXT.test(f.name));

export async function fileToText(file: File): Promise<string> {
  if (isTextFile(file)) return file.text();
  let res: globalThis.Response;
  try {
    res = await fetch('/tools/convert', { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) } });
  } catch {
    throw new ApiError('Needs the decisionUI server to convert this file.');
  }
  if (!res.ok) throw await failure(res);
  return (await res.json()).text as string;
}

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}
export async function webSearch(q: string): Promise<SearchHit[]> {
  const res = await fetch(`/tools/search?q=${encodeURIComponent(q)}&n=8`);
  if (!res.ok) throw await failure(res);
  return res.json();
}
export async function readPage(url: string): Promise<{ title: string; text: string }> {
  const res = await fetch(`/tools/read?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw await failure(res);
  return res.json();
}
