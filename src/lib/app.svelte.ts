import * as api from './api';
import { blankDoc, buildRequest, fromRequest, newQuestion, RequestError } from './request';
import { EXAMPLES, type Example } from './examples';
import type { Doc, Endpoint, QType, Response, Tools } from './types';
import { debounce, isDataUrl, load, readDataURL, store, uid } from './util';

interface HistoryItem {
  t: number;
  endpoint?: string;
  model?: string;
  ms: number;
  req: Record<string, unknown>;
  mediaCut: boolean;
  brief: string;
}

const MAX_PERSISTED_CTX = 40_000;

class App {
  doc = $state<Doc>(blankDoc());
  endpoints = $state<Endpoint[]>([]);
  tools = $state<Tools>({ convert: true, convertAll: false, search: false, read: false });
  endpointId = $state<string>(load('dui.ep', ''));
  models = $state<string[]>([]);
  model = $state<string>(load('dui.model', ''));
  status = $state<'idle' | 'busy' | 'ok' | 'bad'>('idle');
  statusText = $state('');
  running = $state(false);
  result = $state<{ resp: Response; ms: number; req: string } | null>(null);
  error = $state('');
  drawer = $state<null | 'request' | 'code' | 'history'>(null);
  theme = $state<'system' | 'light' | 'dark'>(load('dui.theme', 'system'));
  history = $state<HistoryItem[]>(load('dui.history', []));
  toastText = $state('');

  endpoint = $derived(this.endpoints.find((e) => e.id === this.endpointId) ?? null);
  request = $derived(buildRequest(this.doc, this.model, false));
  stale = $derived(this.result ? JSON.stringify(this.request) !== this.result.req : false);
  pristine = $derived(!this.doc.state.trim() && !this.doc.media.length && !this.doc.contexts.length);

  #abort: AbortController | null = null;
  #toastTimer: ReturnType<typeof setTimeout> | undefined;

  // ── lifecycle ────────────────────────────────────────────────────────────────────────────────────────────────
  async init(): Promise<void> {
    const saved = load<Partial<Doc> | null>('dui.doc', null);
    if (saved?.questions?.length) this.doc = { ...blankDoc(), ...saved, media: [] };
    this.applyTheme();
    await this.refreshEndpoints();
  }

  persist = debounce(() => {
    const d = $state.snapshot(this.doc) as Doc;
    store('dui.doc', { ...d, media: [], contexts: d.contexts.filter((c) => c.text.length < MAX_PERSISTED_CTX) });
  }, 500);

  applyTheme(): void {
    const el = document.documentElement;
    if (this.theme === 'system') delete el.dataset.theme;
    else el.dataset.theme = this.theme;
    store('dui.theme', this.theme);
  }
  toggleTheme(): void {
    const dark = this.theme === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : this.theme === 'dark';
    this.theme = dark ? 'light' : 'dark';
    this.applyTheme();
  }

  toast(text: string, ms = 3200): void {
    this.toastText = text;
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => (this.toastText = ''), ms);
  }

  // ── endpoints and models ─────────────────────────────────────────────────────────────────────────────────────
  async refreshEndpoints(): Promise<void> {
    const { endpoints, tools } = await api.loadEndpoints();
    this.endpoints = endpoints;
    this.tools = tools;
    if (!endpoints.some((e) => e.id === this.endpointId)) this.endpointId = endpoints[0]?.id ?? '';
    await this.loadModels();
  }

  async selectEndpoint(id: string): Promise<void> {
    this.endpointId = id;
    store('dui.ep', id);
    await this.loadModels();
  }

  async loadModels(): Promise<void> {
    const ep = this.endpoint;
    if (!ep) {
      this.status = 'bad';
      this.statusText = 'no endpoint';
      this.models = [];
      return;
    }
    this.status = 'busy';
    this.statusText = '';
    try {
      this.models = await api.listModels(ep);
      if (!this.models.includes(this.model)) this.model = this.models.find((m) => /d3|decision/i.test(m)) ?? this.models[0] ?? this.model;
      store('dui.model', this.model);
      this.status = 'ok';
    } catch (e) {
      this.models = [];
      const s = (e as api.ApiError).status;
      this.status = 'bad';
      this.statusText = s === 401 || s === 403 ? 'key rejected' : s ? `error ${s}` : 'unreachable';
    }
  }

  setModel(m: string): void {
    this.model = m;
    store('dui.model', m);
  }

  addEndpoint(name: string, url: string, key: string): void {
    const e = api.addEndpoint(name, url, key);
    this.endpoints = [...this.endpoints, e];
    void this.selectEndpoint(e.id);
  }
  removeEndpoint(id: string): void {
    api.removeEndpoint(id);
    this.endpoints = this.endpoints.filter((e) => e.id !== id);
    if (this.endpointId === id) void this.selectEndpoint(this.endpoints[0]?.id ?? '');
  }

  // ── document ─────────────────────────────────────────────────────────────────────────────────────────────────
  loadExample(ex: Example): void {
    this.doc = ex.build();
    this.result = null;
    this.error = '';
  }
  addQuestion(type: QType): void {
    const n = Math.max(0, ...this.doc.questions.map((q) => Number(/^q(\d+)$/.exec(q.name)?.[1]) || 0)) + 1;
    this.doc.questions.push(newQuestion(type, n));
  }
  removeQuestion(id: string): void {
    this.doc.questions = this.doc.questions.filter((q) => q.id !== id);
  }

  async attach(files: File[]): Promise<void> {
    for (const f of files) {
      try {
        if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
          this.doc.media.push({ id: uid(), kind: f.type.startsWith('video/') ? 'video' : 'image', name: f.name, src: await readDataURL(f), size: f.size });
        } else {
          this.toast(`Reading ${f.name}…`, 15_000);
          const text = await api.fileToText(f);
          if (!text.trim()) throw new Error('no text found');
          this.doc.contexts.push({ id: uid(), title: f.name, text, source: 'file' });
          this.toast('');
        }
      } catch (e) {
        this.toast(`${f.name}: ${(e as Error).message}`, 6000);
      }
    }
  }
  addContext(title: string, text: string, source: 'file' | 'web'): void {
    this.doc.contexts.push({ id: uid(), title, text, source });
  }

  /** Replace the document from a request object (JSON editor, history). */
  applyRequest(req: unknown): void {
    const { doc, model } = fromRequest(req);
    this.doc = doc;
    if (model) this.setModel(model);
  }

  // ── run ──────────────────────────────────────────────────────────────────────────────────────────────────────
  async run(): Promise<void> {
    if (this.running) return;
    let req: Record<string, unknown>;
    try {
      req = buildRequest(this.doc, this.model, true);
    } catch (e) {
      this.error = e instanceof RequestError ? e.message : String(e);
      return;
    }
    if (!this.endpoint) {
      this.error = 'No endpoint.';
      return;
    }
    this.error = '';
    this.running = true;
    this.#abort = new AbortController();
    try {
      const { data, ms } = await api.ask(this.endpoint, req, this.#abort.signal);
      this.result = { resp: data, ms, req: JSON.stringify(this.request) };
      this.#remember(req, data, ms);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') this.error = (e as Error).message;
    } finally {
      this.running = false;
      this.#abort = null;
    }
  }
  stop(): void {
    this.#abort?.abort();
  }

  #remember(req: Record<string, unknown>, data: Response, ms: number): void {
    let cut = false;
    const strip = (v: unknown) => (isDataUrl(v) && v.length > 2000 ? ((cut = true), null) : v);
    const r = JSON.parse(JSON.stringify(req));
    for (const k of ['images', 'videos']) if (r[k]) r[k] = r[k].map(strip).filter(Boolean);
    if (r.assets) r.assets = Object.fromEntries(Object.entries(r.assets).map(([k, v]) => [k, strip(v)]).filter(([, v]) => v));
    const [name, a] = Object.entries(data.answers ?? {})[0] ?? [];
    const brief = a ? `${name}: ${'choice' in a ? a.choice : 'noul' in a ? (a.noul >= 0.5 ? 'yes' : 'no') : 'score' in a ? a.score.toFixed(2) : a.type}` : '';
    this.history = [{ t: Date.now(), endpoint: this.endpoint?.name, model: this.model, ms: Math.round(ms), req: r, mediaCut: cut, brief }, ...this.history].slice(0, 30);
    while (this.history.length && !store('dui.history', this.history)) this.history.pop();
  }
  clearHistory(): void {
    this.history = [];
    store('dui.history', []);
  }
}

export const app = new App();
export { EXAMPLES };
