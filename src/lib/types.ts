/** System One: typed questions about a state, answered with probabilities. */

/** The System One standard: every implementation answers these three. */
export type CoreType = 'choice' | 'noul' | 'score';
/** Extensions (d3-turbo): only some servers know them, so they are shown only when the endpoint has extensions on. */
export type ExtType = 'box' | 'track';
export type QType = CoreType | ExtType;
export const CORE: CoreType[] = ['choice', 'noul', 'score'];
export const EXT: ExtType[] = ['box', 'track'];
export const QTYPES: QType[] = [...CORE, ...EXT];
export const QLABEL: Record<QType, string> = { choice: 'choice', noul: 'yes / no', score: 'score', box: 'box', track: 'track' };
export const isExt = (t: QType): t is ExtType => t === 'box' || t === 'track';

/** What d3 accepts: 1–255 options, 2–10 score levels. */
export const LIMITS = { options: 255, levels: [2, 10] as const };

export interface Question {
  id: string;
  name: string;
  type: QType;
  instructions: string;
  options: { key: string; desc: string }[]; // choice
  levels: string[]; // score, lowest → highest
  sides: { true: string; false: string }; // noul: optional descriptions of the two answers
  rate: 1 | 2; // track: updates per second
  at?: number; // box on a video: the moment, in seconds
}

export interface Media {
  id: string;
  kind: 'image' | 'video';
  name: string;
  src: string; // data: URL or http(s) URL
  tag?: string; // set → sent as a named asset (`<tag>`) instead of a plain input
  size?: number;
}

export interface Context {
  id: string;
  title: string;
  text: string;
  source: 'file' | 'web';
}

export interface Doc {
  stateMode: 'text' | 'json';
  state: string;
  contexts: Context[];
  media: Media[];
  questions: Question[];
  extra: Record<string, unknown>; // any other request fields (long_context, truncate, …)
}

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** A question the server could not answer; the other questions in the same response are fine. */
export interface AnswerError {
  type: QType;
  error: 'invalid_question' | 'max_length_exceeded' | 'invalid_model_output' | string;
  message?: string;
}

export type AnswerOk =
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'noul'; noul: number }
  | { type: 'score'; score: number; confidence: number; legend: Record<string, string>; probabilities: Record<string, number> }
  | { type: 'box'; box: Box | null; confidence: number }
  | { type: 'track'; track: { time: number; box: Box | null; confidence?: number; visible?: number }[] };
export type Answer = AnswerOk | AnswerError;
export const isError = (a: Answer): a is AnswerError => 'error' in a;

export interface Response {
  answers: Record<string, Answer>;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** What a server says about one of its models. `modalities` is absent when the server does not say (oMLX). */
export interface ModelInfo {
  id: string;
  modalities?: string[];
  maxTokens?: number;
}

/** What the UI may use right now. `'unknown'` is never treated as "no". */
export interface Caps {
  image: boolean | 'unknown';
  video: boolean | 'unknown';
  ext: boolean; // box, track, tagged images, long context: the endpoint's "Extensions" switch
  maxTokens?: number;
}

export interface Endpoint {
  id: string;
  name: string;
  url: string;
  key?: string;
  mode: 'proxy' | 'direct';
}

export interface Tools {
  convert: boolean; // browser-side text + server-side converters
  convertAll: boolean; // a document converter (PDF, Office, …) is configured
  search: boolean;
  read: boolean;
  history: boolean; // the server keeps past runs in SQLite
}
