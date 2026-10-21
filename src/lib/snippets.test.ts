import { describe, expect, it } from 'vitest';
import { snippet } from './snippets';

const req = { model: 'd3', state: "it's fine", questions: { q: { type: 'noul', instructions: '?' } }, images: ['data:image/png;base64,' + 'A'.repeat(5000)], flag: true };

describe('snippet', () => {
  it('shortens big media and says so', () => {
    for (const l of ['curl', 'python', 'js'] as const) {
      const s = snippet(l, req, 'http://h:1/');
      expect(s).toContain('<base64>');
      expect(s).toContain('http://h:1/v1/systemone');
      expect(s).not.toContain('AAAAAAAAAA');
    }
  });
  it('escapes single quotes for the shell and uses Python literals', () => {
    expect(snippet('curl', req, 'http://h')).toContain(`it'\\''s fine`);
    expect(snippet('python', req, 'http://h')).toContain('"flag": True');
  });
});
