import { describe, expect, it } from 'vitest';
import { blankDoc, buildRequest, fromRequest, newQuestion, RequestError } from './request';

const doc = () => {
  const d = blankDoc();
  d.state = 'The order arrived damaged.';
  d.questions = [
    { ...newQuestion('choice', 1), name: 'route', instructions: 'Which team?', options: [{ key: 'returns', desc: 'Refunds' }, { key: 'billing', desc: '' }] },
    { ...newQuestion('noul', 2), name: 'urgent', instructions: 'Urgent?' },
    { ...newQuestion('score', 3), name: 'level', instructions: 'How urgent?', levels: ['low', 'mid', 'high'] },
  ];
  return d;
};

describe('buildRequest', () => {
  it('builds the System One shape', () => {
    expect(buildRequest(doc(), 'd3')).toEqual({
      model: 'd3',
      state: 'The order arrived damaged.',
      questions: {
        route: { type: 'choice', instructions: 'Which team?', criteria: { returns: 'Refunds', billing: null } },
        urgent: { type: 'noul', instructions: 'Urgent?' },
        level: { type: 'score', instructions: 'How urgent?', criteria: ['low', 'mid', 'high'] },
      },
    });
  });

  it('appends file and web context to text state, or a context key to JSON state', () => {
    const d = doc();
    d.contexts = [{ id: '1', title: 'notes.md', text: 'hello', source: 'file' }];
    expect(buildRequest(d, '').state).toBe('The order arrived damaged.\n\n--- notes.md ---\nhello');
    d.stateMode = 'json';
    d.state = '{"a":1}';
    expect(buildRequest(d, '').state).toEqual({ a: 1, context: [{ title: 'notes.md', text: 'hello' }] });
  });

  it('splits media into images, videos and assets', () => {
    const d = doc();
    d.media = [
      { id: 'a', kind: 'image', name: 'a', src: 'data:image/png;base64,AA' },
      { id: 'b', kind: 'video', name: 'b', src: 'data:video/mp4;base64,BB' },
      { id: 'c', kind: 'image', name: 'c', src: 'data:image/png;base64,CC', tag: '<animal>' },
    ];
    const r = buildRequest(d, '');
    expect(r.images).toEqual(['data:image/png;base64,AA']);
    expect(r.videos).toEqual(['data:video/mp4;base64,BB']);
    expect(r.assets).toEqual({ '<animal>': 'data:image/png;base64,CC' });
  });

  it('validates when strict', () => {
    const d = doc();
    d.state = '';
    expect(() => buildRequest(d, '')).toThrow(RequestError);
    d.state = 'x';
    d.questions[0].options = [{ key: 'only', desc: '' }];
    expect(() => buildRequest(d, '')).toThrow(/two or more options/);
    d.questions = [{ ...newQuestion('box', 1), name: 'b', instructions: 'the dog' }];
    expect(() => buildRequest(d, '')).toThrow(/needs an image/);
    expect(() => buildRequest(d, '', false)).not.toThrow();
  });

  it('merges extra fields', () => {
    const d = doc();
    d.extra = { long_context: true };
    expect(buildRequest(d, 'd3').long_context).toBe(true);
  });
});

describe('fromRequest', () => {
  it('round-trips', () => {
    const d = doc();
    d.media = [{ id: 'c', kind: 'image', name: 'c', src: 'https://x/y.png', tag: '<t>' }];
    d.extra = { truncate: false };
    const req = buildRequest(d, 'm');
    const back = fromRequest(JSON.parse(JSON.stringify(req)));
    expect(back.model).toBe('m');
    expect(buildRequest(back.doc, back.model)).toEqual(req);
  });

  it('keeps JSON state as JSON and rejects non-objects', () => {
    const { doc: d } = fromRequest({ state: { a: [1, 2] }, questions: { q: { type: 'noul', instructions: '?' } } });
    expect(d.stateMode).toBe('json');
    expect(JSON.parse(d.state)).toEqual({ a: [1, 2] });
    expect(() => fromRequest([])).toThrow(RequestError);
  });
});
