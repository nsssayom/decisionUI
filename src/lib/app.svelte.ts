import * as api from './api';
import { blankDoc, buildRequest, fromRequest, newQuestion, RequestError } from './request';
import { EXAMPLES, type Example } from './examples';
import type { Caps, Doc, Endpoint, ModelInfo, QType, Response, Tools } from './types';
import { isError } from './types';
import { briefOf, localStore, serverStore, titleOf, trimMedia, type HistoryRow, type HistoryStore } from './history';
import { load, readDataURL, store, uid } from './util';

const WIDE = 1100; // px: below this the sidebar collapses by itself

class App {
  doc = $state<Doc>(blankDoc());
  endpoints = $state<Endpoint[]>([]);
  tools = $state<Tools>({ convert: true, convertAll: false, search: false, read: false, history: false });
  endpointId = $state<string>(load('dui.ep', ''));
  models = $state<ModelInfo[]>([]);
  /** per endpoint: has the user (or a rejected request) said its server knows the extensions? */
  ext = $state<Record<string, boolean>>(load('dui.ext', {}));
  model = $state<string>(load('dui.model', ''));
  status = $state<'idle' | 'busy' | 'ok' | 'bad'>('idle');
  statusText = $state('');
  running = $state(false);
  result = $state<{ resp: Response; ms: number; req: string } | null>(null);
  error = $state('');
  qerrors = $state<Record<string, string>>({}); // question name → what the server said about it
  drawer = $state<null | 'request' | 'code'>(null);
  theme = $state<'system' | 'light' | 'dark'>(load('dui.theme', 'system'));
  history = $state<HistoryRow[]>([]);
  historyId = $state<string | null>(null); // the past run on screen
  /** the sidebar's width class: wide screens push the page aside, narrow ones float it over the page */
  wide = $state(typeof innerWidth === 'number' ? innerWidth >= WIDE : true);
  #histPref = $state<boolean>(load('dui.hist', true)); // what the user chose for wide screens
  #histOverlay = $state(false); // narrow screens: open only while asked for
  historyOpen = $derived(this.wide ? this.#histPref : this.#histOverlay);
  toastText = $state('');

  endpoint = $derived(this.endpoints.find((e) => e.id === this.endpointId) ?? null);
  modelInfo = $derived(this.models.find((m) => m.id === this.model));
  caps = $derived.by((): Caps => {
    const m = this.modelInfo?.modalities;
    const known = (k: string) => (m ? m.includes(k) : 'unknown' as const);
    return { image: known('image'), video: known('video'), ext: !!this.ext[this.endpointId], maxTokens: this.modelInfo?.maxTokens };
  });
  request = $derived(buildRequest(this.doc, this.model, false, this.caps));
  stale = $derived(this.result ? JSON.stringify(this.request) !== this.result.req : false);
  pristine = $derived(!this.doc.state.trim() && !this.doc.media.length && !this.doc.contexts.length);

  #abort: AbortController | null = null;
  #query = '';
  get #store(): HistoryStore {
    return this.tools.history ? serverStore : localStore;
  }
  #toastTimer: ReturnType<typeof setTimeout> | undefined;

  // ── lifecycle ────────────────────────────────────────────────────────────────────────────────────────────────
  async init(): Promise<void> {
    this.applyTheme();
    try {
      localStorage.removeItem('dui.doc'); // an old version restored the last document on load; every visit now starts blank
    } catch {
      /* storage unavailable */
    }
    await this.refreshEndpoints();
  }

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
    void this.refreshHistory();
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
      if (!this.models.some((m) => m.id === this.model)) this.model = (this.models.find((m) => /d3|decision/i.test(m.id)) ?? this.models[0])?.id ?? this.model;
      store('dui.model', this.model);
      this.status = 'ok';
    } catch (e) {
      this.models = [];
      const s = (e as api.ApiError).status;
      this.status = 'bad';
      this.statusText = s === 401 || s === 403 ? 'key rejected' : s ? `error ${s}` : 'unreachable';
    }
  }

  setExtensions(on: boolean): void {
    this.ext = { ...this.ext, [this.endpointId]: on };
    store('dui.ext', this.ext);
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
    this.qerrors = {};
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
      req = buildRequest(this.doc, this.model, true, this.caps);
    } catch (e) {
      this.error = e instanceof RequestError ? e.message : String(e);
      return;
    }
    if (!this.endpoint) {
      this.error = 'No endpoint.';
      return;
    }
    this.error = '';
    this.qerrors = {};
    this.running = true;
    this.#abort = new AbortController();
    try {
      const { data, ms } = await api.ask(this.endpoint, req, this.#abort.signal);
      this.result = { resp: data, ms, req: JSON.stringify(this.request) };
      this.historyId = null;
      void this.#remember(req, data, ms);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        const err = e as api.ApiError;
        this.error = err.message;
        this.qerrors = err.perQuestion ?? {};
        if (this.caps.ext && api.blamesExtension(err)) {
          this.setExtensions(false); // learn from the rejection instead of retrying silently
          this.error = `This server doesn't accept extensions, so they are off now. ${err.message}`;
        }
      }
    } finally {
      this.running = false;
      this.#abort = null;
    }
  }
  stop(): void {
    this.#abort?.abort();
  }

  // ── history ──────────────────────────────────────────────────────────────────────────────────────────────────
  toggleHistory(): void {
    if (this.wide) {
      this.#histPref = !this.#histPref;
      store('dui.hist', this.#histPref);
    } else this.#histOverlay = !this.#histOverlay;
  }
  /** Called on every window resize: crossing into a narrow window collapses the sidebar, and widening restores the choice. */
  setWidth(px: number): void {
    const wide = px >= WIDE;
    if (wide !== this.wide) this.#histOverlay = false;
    this.wide = wide;
  }
  async refreshHistory(q = this.#query): Promise<void> {
    this.#query = q;
    try {
      this.history = await this.#store.list(q);
    } catch {
      this.history = [];
    }
  }
  async #remember(req: Record<string, unknown>, data: Response, ms: number): Promise<void> {
    const { request, cut } = trimMedia(req, this.#store.maxMedia);
    try {
      await this.#store.add({ t: Date.now(), endpoint: this.endpoint?.name, model: this.model, ms: Math.round(ms), title: titleOf(request), brief: briefOf(data), mediaCut: cut, request, response: data });
      await this.refreshHistory();
      this.historyId = this.history[0]?.id ?? null;
    } catch {
      /* history is a convenience; a failed save must not fail the run */
    }
  }
  /** Bring a past question and its answer back. */
  async openHistory(id: string): Promise<void> {
    const run = await this.#store.get(id);
    if (!run) return void this.refreshHistory();
    this.applyRequest(run.request);
    this.result = { resp: run.response, ms: run.ms, req: JSON.stringify(this.request) };
    this.error = '';
    this.qerrors = {};
    this.historyId = id;
    if (run.mediaCut) this.toast('Large media was not kept');
  }
  async deleteHistory(id: string): Promise<void> {
    await this.#store.remove(id).catch(() => {});
    if (this.historyId === id) this.historyId = null;
    await this.refreshHistory();
  }
  async clearHistory(): Promise<void> {
    await this.#store.clear().catch(() => {});
    this.historyId = null;
    await this.refreshHistory();
  }
  /** A blank page for the next question. */
  newDoc(): void {
    this.doc = blankDoc();
    this.result = null;
    this.error = '';
    this.qerrors = {};
    this.historyId = null;
  }
}

export const app = new App();
export { EXAMPLES };
