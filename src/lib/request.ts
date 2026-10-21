import type { Doc, Media, Question, QType } from './types';
import { QLABEL } from './types';
import { mediaKind, uid } from './util';

export function newQuestion(type: QType = 'choice', n = 1): Question {
  const q: Question = { id: uid(), name: `q${n}`, type, instructions: '', options: [], levels: [], rate: 2 };
  if (type === 'choice') q.options = [{ key: '', desc: '' }, { key: '', desc: '' }];
  if (type === 'score') q.levels = ['', '', ''];
  return q;
}

export const blankDoc = (): Doc => ({ stateMode: 'text', state: '', contexts: [], media: [], questions: [newQuestion('choice', 1)], extra: {} });

const filled = (s: unknown): s is string => typeof s === 'string' && s.trim() !== '';

export function questionJson(q: Question): Record<string, unknown> {
  const o: Record<string, unknown> = { type: q.type, instructions: q.instructions };
  if (q.type === 'choice') {
    const criteria: Record<string, string | null> = {};
    for (const { key, desc } of q.options) if (filled(key)) criteria[key.trim()] = filled(desc) ? desc : null;
    o.criteria = criteria;
  } else if (q.type === 'score') o.criteria = q.levels.filter(filled);
  else if (q.type === 'track') o.rate = q.rate;
  return o;
}

export class RequestError extends Error {}

/** The System One request for a document. `strict` throws a user-facing error when the form is not ready to send. */
export function buildRequest(doc: Doc, model: string, strict = true): Record<string, unknown> {
  const req: Record<string, unknown> = {};
  if (filled(model)) req.model = model.trim();

  const ctx = doc.contexts.map((c) => ({ title: c.title, text: c.text }));
  let state: unknown;
  if (doc.stateMode === 'json') {
    let v: unknown = null;
    if (filled(doc.state)) {
      try {
        v = JSON.parse(doc.state);
      } catch (e) {
        if (strict) throw new RequestError(`Input is not valid JSON (${(e as Error).message})`);
        v = doc.state;
      }
    }
    state = ctx.length ? (v && typeof v === 'object' && !Array.isArray(v) ? { ...v, context: ctx } : { state: v, context: ctx }) : v;
  } else state = doc.state + ctx.map((c) => `\n\n--- ${c.title} ---\n${c.text}`).join('');
  if (strict && (state == null || state === '')) throw new RequestError('Add some input first.');
  req.state = state;

  const questions: Record<string, unknown> = {};
  const plain = (k: 'image' | 'video') => doc.media.filter((m) => !m.tag && m.kind === k);
  for (const q of doc.questions) {
    const name = q.name.trim();
    if (!name) {
      if (strict) throw new RequestError('Every question needs a name.');
      continue;
    }
    if (strict && name in questions) throw new RequestError(`Two questions are named “${name}”.`);
    const o = questionJson(q);
    if (strict) {
      if (!filled(q.instructions)) throw new RequestError(`“${name}” needs a question.`);
      if (q.type === 'choice' && Object.keys(o.criteria as object).length < 2) throw new RequestError(`“${name}” needs two or more options.`);
      if (q.type === 'score' && (o.criteria as unknown[]).length < 2) throw new RequestError(`“${name}” needs two or more levels.`);
      if (q.type === 'box' && !doc.media.some((m) => m.kind === 'image')) throw new RequestError(`“${name}” (box) needs an image.`);
      if (q.type === 'track' && !doc.media.some((m) => m.kind === 'video')) throw new RequestError(`“${name}” (track) needs a video.`);
    }
    questions[name] = o;
  }
  if (strict && !Object.keys(questions).length) throw new RequestError('Add a question.');
  req.questions = questions;

  if (plain('image').length) req.images = plain('image').map((m) => m.src);
  if (plain('video').length) req.videos = plain('video').map((m) => m.src);
  const tagged = doc.media.filter((m) => filled(m.tag));
  if (tagged.length) req.assets = Object.fromEntries(tagged.map((m) => [m.tag!.trim(), m.src]));

  return { ...req, ...doc.extra };
}

const KNOWN = new Set(['model', 'state', 'questions', 'images', 'videos', 'assets']);

/** The inverse of buildRequest: a document (and model id) from a request object. */
export function fromRequest(req: unknown): { doc: Doc; model: string } {
  if (!req || typeof req !== 'object' || Array.isArray(req)) throw new RequestError('The request must be a JSON object.');
  const r = req as Record<string, any>;
  const doc = blankDoc();
  doc.questions = [];
  if (typeof r.state === 'string') doc.state = r.state;
  else {
    doc.stateMode = 'json';
    doc.state = r.state == null ? '' : JSON.stringify(r.state, null, 2);
  }
  let n = 0;
  for (const [name, q] of Object.entries<any>(r.questions ?? {})) {
    const type: QType = q?.type in QLABEL ? q.type : 'choice';
    const o = newQuestion(type, ++n);
    o.name = name;
    o.instructions = typeof q?.instructions === 'string' ? q.instructions : q?.instructions == null ? '' : JSON.stringify(q.instructions);
    const c = q?.criteria;
    if (type === 'choice') o.options = c && typeof c === 'object' ? Object.entries<any>(c).map(([key, d]) => ({ key, desc: d == null ? '' : String(d) })) : [];
    if (type === 'score') o.levels = Array.isArray(c) ? c.map(String) : [];
    if (type === 'track') o.rate = q.rate === 1 ? 1 : 2;
    doc.questions.push(o);
  }
  if (!doc.questions.length) doc.questions.push(newQuestion('choice', 1));
  const media = (arr: unknown, kind: 'image' | 'video'): Media[] => (Array.isArray(arr) ? arr : []).map((src, i) => ({ id: uid(), kind, name: `${kind} ${i + 1}`, src: String(src) }));
  doc.media = [...media(r.images, 'image'), ...media(r.videos, 'video')];
  for (const [tag, src] of Object.entries<any>(r.assets ?? {})) doc.media.push({ id: uid(), kind: mediaKind(String(src)), name: tag, src: String(src), tag });
  doc.extra = Object.fromEntries(Object.entries(r).filter(([k]) => !KNOWN.has(k)));
  return { doc, model: typeof r.model === 'string' ? r.model : '' };
}
