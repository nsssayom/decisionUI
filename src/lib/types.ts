/** System One: typed questions about a state, answered with probabilities. */

export type QType = 'choice' | 'noul' | 'score' | 'box' | 'track';
export const QTYPES: QType[] = ['choice', 'noul', 'score', 'box', 'track'];
export const QLABEL: Record<QType, string> = { choice: 'choice', noul: 'yes / no', score: 'score', box: 'box', track: 'track' };

export interface Question {
  id: string;
  name: string;
  type: QType;
  instructions: string;
  options: { key: string; desc: string }[]; // choice
  levels: string[]; // score, lowest → highest
  rate: 1 | 2; // track: updates per second
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

export type Answer =
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'noul'; noul: number }
  | { type: 'score'; score: number; confidence: number; legend: Record<string, string>; probabilities: Record<string, number> }
  | { type: 'box'; box: Box | null; confidence: number }
  | { type: 'track'; track: { time: number; box: Box | null; confidence?: number; visible?: number }[] };

export interface Response {
  answers: Record<string, Answer>;
  model?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
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
}
