import { describe, expect, it } from 'vitest';
import { briefOf, titleOf, trimMedia } from './history';

describe('history helpers', () => {
  it('summarises answers at a glance', () => {
    const resp = {
      answers: {
        team: { type: 'choice', choice: 'returns', probabilities: {}, confidence: 1 },
        receipt: { type: 'noul', noul: 0.97 },
        mood: { type: 'noul', noul: 0.5 },
        level: { type: 'score', score: 1.87, confidence: 1, legend: {}, probabilities: {} },
        bad: { type: 'choice', error: 'invalid_question' },
      },
    } as any;
    expect(briefOf(resp)).toBe('team: returns · receipt: yes · mood: unsure');
    expect(briefOf({ answers: { x: { type: 'noul', noul: 0.1 }, y: { type: 'box', error: 'e' } } } as any)).toBe('x: no · y: error');
  });

  it('titles a run by its input', () => {
    expect(titleOf({ state: '  The order\n arrived   damaged. ' })).toBe('The order arrived damaged.');
    expect(titleOf({ state: { a: 1 } })).toBe('{"a":1}');
    expect(titleOf({ state: '' })).toBe('Untitled');
    expect(titleOf({ state: 'x'.repeat(500) }).length).toBe(120);
  });

  it('drops only media that is too large, and says so', () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(100);
    const small = 'data:image/png;base64,AA';
    const { request, cut } = trimMedia({ state: 's', images: [big, small], assets: { '<a>': big, '<b>': small } }, 50);
    expect(cut).toBe(true);
    expect(request.images).toEqual([small]);
    expect(request.assets).toEqual({ '<b>': small });
    expect(trimMedia({ state: 's', images: [small] }, 50).cut).toBe(false);
  });
});
