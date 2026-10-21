import { describe, expect, it } from 'vitest';
import { blankDoc, buildRequest, estimateTokens, fromRequest, newQuestion, normTag, RequestError, type Send } from './request';

const EXT: Send = { ext: true, image: true, video: true };

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
    const r = buildRequest(d, '', true, EXT);
    expect(r.images).toEqual(['data:image/png;base64,AA']);
    expect(r.videos).toEqual(['data:video/mp4;base64,BB']);
    expect(r.assets).toEqual({ '<animal>': 'data:image/png;base64,CC' });
  });

  it('validates when strict', () => {
    const d = doc();
    d.state = '';
    expect(() => buildRequest(d, '')).toThrow(/Add an input/);
    d.media = [{ id: 'a', kind: 'image', name: 'a', src: 'data:image/png;base64,AA' }];
    expect(buildRequest(d, '').state).toBe(''); // an image alone is enough
    expect(() => buildRequest(d, '', true, { ext: false, image: false, video: true })).toThrow(/Add an input/); // …unless the model can't read it
    d.media = [];
    d.state = 'x';
    d.questions[0].options = [{ key: 'only', desc: '' }];
    expect(() => buildRequest(d, '')).toThrow(/two or more options/);
    d.questions[0].options = [{ key: 'a', desc: '' }, { key: 'a', desc: '' }];
    expect(() => buildRequest(d, '')).toThrow(/same name/);
    d.questions = [{ ...newQuestion('score', 1), name: 's', levels: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'] }];
    expect(() => buildRequest(d, '')).toThrow(/2 to 10 levels/);
    d.questions = [{ ...newQuestion('box', 1), name: 'b', instructions: 'the dog' }];
    expect(() => buildRequest(d, '')).toThrow(/needs an endpoint with extensions/);
    expect(() => buildRequest(d, '', true, EXT)).toThrow(/needs an image/);
    expect(() => buildRequest(d, '', false)).not.toThrow();
  });

  it('treats the question text as optional and sends yes/no descriptions', () => {
    const d = doc();
    d.questions = [{ ...newQuestion('noul', 1), name: 'u', sides: { true: 'urgent', false: '' } }];
    expect(buildRequest(d, '').questions).toEqual({ u: { type: 'noul', criteria: { true: 'urgent' } } });
  });

  it('never sends extension fields to an endpoint without extensions', () => {
    const d = doc();
    d.media = [
      { id: 'c', kind: 'image', name: 'c', src: 'data:image/png;base64,CC', tag: 'animal' },
      { id: 'v', kind: 'video', name: 'v', src: 'data:video/mp4;base64,VV' },
    ];
    d.questions = [{ ...newQuestion('track', 1), name: 't', instructions: 'the dog', rate: 1 }, { ...newQuestion('box', 2), name: 'b', instructions: 'the dog', at: 2 }];
    const off = buildRequest(d, '', false);
    expect(off.assets).toBeUndefined();
    expect(off.images).toEqual(['data:image/png;base64,CC']); // the tagged file goes as a plain image
    expect(off.questions).toEqual({ t: { type: 'track', instructions: 'the dog' }, b: { type: 'box', instructions: 'the dog' } });
    const on = buildRequest(d, '', false, EXT);
    expect(on.assets).toEqual({ '<animal>': 'data:image/png;base64,CC' });
    expect(on.images).toBeUndefined();
    expect((on.questions as any).t.rate).toBe(1);
    expect((on.questions as any).b.at).toBe(2);
  });

  it('skips media the model cannot read', () => {
    const d = doc();
    d.media = [{ id: 'v', kind: 'video', name: 'v', src: 'data:video/mp4;base64,VV' }, { id: 'a', kind: 'image', name: 'a', src: 'data:image/png;base64,AA' }];
    const r = buildRequest(d, '', false, { ext: false, image: true, video: false });
    expect(r.videos).toBeUndefined();
    expect(r.images).toEqual(['data:image/png;base64,AA']);
  });

  it('normalises tags to <name>', () => {
    expect(['animal', '<animal>', ' animal ', '<animal'].map(normTag)).toEqual(['<animal>', '<animal>', '<animal>', '<animal>']);
  });

  it('estimates tokens as state × questions', () => {
    const one = estimateTokens({ state: 'x'.repeat(3600), questions: { a: { type: 'noul' } } });
    const three = estimateTokens({ state: 'x'.repeat(3600), questions: { a: { type: 'noul' }, b: { type: 'noul' }, c: { type: 'noul' } } });
    expect(three).toBeGreaterThan(one * 2.9);
    expect(one).toBeGreaterThan(1000);
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
    d.questions[1].sides = { true: 'now', false: '' };
    const req = buildRequest(d, 'm', true, EXT);
    const back = fromRequest(JSON.parse(JSON.stringify(req)));
    expect(back.model).toBe('m');
    expect(buildRequest(back.doc, back.model, true, EXT)).toEqual(req);
  });

  it('keeps JSON state as JSON and rejects non-objects', () => {
    const { doc: d } = fromRequest({ state: { a: [1, 2] }, questions: { q: { type: 'noul', instructions: '?' } } });
    expect(d.stateMode).toBe('json');
    expect(JSON.parse(d.state)).toEqual({ a: [1, 2] });
    expect(() => fromRequest([])).toThrow(RequestError);
  });
});
