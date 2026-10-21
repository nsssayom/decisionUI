import type { Response } from './types';
import { isError } from './types';
import { isDataUrl, load, store, uid } from './util';

export interface HistoryRow {
  id: string;
  t: number;
  endpoint?: string;
  model?: string;
  ms: number;
  title: string;
  brief: string;
  mediaCut: boolean;
}
export interface HistoryFull extends HistoryRow {
  request: Record<string, unknown>;
  response: Response;
}
export type NewRun = Omit<HistoryFull, 'id'>;

/** Where past runs live: the decisionUI server's SQLite file, or this browser when the app is hosted without the server. */
export interface HistoryStore {
  /** Longest data: URL kept in a saved request; longer media is dropped and the row is marked. */
  maxMedia: number;
  list(q: string): Promise<HistoryRow[]>;
  get(id: string): Promise<HistoryFull | null>;
  add(run: NewRun): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

const json = { 'Content-Type': 'application/json' };
const ok = (r: globalThis.Response) => {
  if (!r.ok) throw new Error(`history: HTTP ${r.status}`);
  return r;
};

export const serverStore: HistoryStore = {
  maxMedia: 4_000_000,
  async list(q) {
    const rows = await ok(await fetch(`/api/history${q ? `?q=${encodeURIComponent(q)}` : ''}`, { cache: 'no-store' })).json();
    return rows.map((r: any): HistoryRow => ({ id: String(r.id), t: r.t, endpoint: r.endpoint, model: r.model, ms: r.ms, title: r.title, brief: r.brief, mediaCut: !!r.media_cut }));
  },
  async get(id) {
    const r = await fetch(`/api/history/${id}`, { cache: 'no-store' });
    if (r.status === 404) return null;
    const d = await ok(r).json();
    return { id: String(d.id), t: d.t, endpoint: d.endpoint, model: d.model, ms: d.ms, title: d.title, brief: d.brief, mediaCut: !!d.media_cut, request: d.request, response: d.response };
  },
  async add(run) {
    await ok(await fetch('/api/history', { method: 'POST', headers: json, body: JSON.stringify(run) }));
  },
  async remove(id) {
    await ok(await fetch(`/api/history/${id}`, { method: 'DELETE' }));
  },
  async clear() {
    await ok(await fetch('/api/history', { method: 'DELETE' }));
  },
};

const KEY = 'dui.history2';
const KEEP = 30;
export const localStore: HistoryStore = {
  maxMedia: 2000,
  async list(q) {
    const n = q.trim().toLowerCase();
    return load<HistoryFull[]>(KEY, [])
      .filter((r) => !n || `${r.title} ${r.brief}`.toLowerCase().includes(n))
      .map(({ request: _a, response: _b, ...row }) => row);
  },
  async get(id) {
    return load<HistoryFull[]>(KEY, []).find((r) => r.id === id) ?? null;
  },
  async add(run) {
    let rows = [{ ...run, id: uid() }, ...load<HistoryFull[]>(KEY, [])].slice(0, KEEP);
    while (rows.length > 1 && !store(KEY, rows)) rows = rows.slice(0, -1); // storage full: drop the oldest
  },
  async remove(id) {
    store(KEY, load<HistoryFull[]>(KEY, []).filter((r) => r.id !== id));
  },
  async clear() {
    store(KEY, []);
  },
};

/** The request with large inline media removed (it would not fit), and whether anything was removed. */
export function trimMedia(req: Record<string, unknown>, max: number): { request: Record<string, unknown>; cut: boolean } {
  let cut = false;
  const keep = (v: unknown) => (isDataUrl(v) && v.length > max ? ((cut = true), null) : v);
  const r = JSON.parse(JSON.stringify(req));
  for (const k of ['images', 'videos']) if (Array.isArray(r[k])) r[k] = r[k].map(keep).filter(Boolean);
  if (r.assets) r.assets = Object.fromEntries(Object.entries(r.assets).map(([k, v]) => [k, keep(v)]).filter(([, v]) => v));
  return { request: r, cut };
}

export const titleOf = (req: Record<string, unknown>): string => {
  const s = typeof req.state === 'string' ? req.state : JSON.stringify(req.state ?? '');
  return s.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Untitled';
};

/** "team: returns · receipt: yes": the answers at a glance. */
export function briefOf(resp: Response): string {
  return Object.entries(resp.answers ?? {})
    .slice(0, 3)
    .map(([name, a]) => {
      const v = isError(a) ? 'error' : 'choice' in a ? a.choice : 'noul' in a ? (a.noul >= 0.65 ? 'yes' : a.noul <= 0.35 ? 'no' : 'unsure') : 'score' in a ? a.score.toFixed(1) : a.type;
      return `${name}: ${v}`;
    })
    .join(' · ');
}
