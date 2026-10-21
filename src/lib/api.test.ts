import { describe, expect, it } from 'vitest';
import { ApiError, blamesExtension, parseFailure, parseModels } from './api';

describe('parseModels', () => {
  it('reads the OpenAI-style list (oMLX)', () => {
    expect(parseModels({ data: [{ id: 'd3', max_model_len: 32768 }] })).toEqual([{ id: 'd3', modalities: undefined, maxTokens: 32768 }]);
  });
  it('reads the reference list, which names models by `name` and reports modalities', () => {
    const m = parseModels({ models: [{ name: 'd3', modalities: ['text', 'image'], max_input_tokens: 32768 }] });
    expect(m).toEqual([{ id: 'd3', modalities: ['text', 'image'], maxTokens: 32768 }]);
  });
  it('tolerates junk', () => {
    expect(parseModels(null)).toEqual([]);
    expect(parseModels({ data: [{}, 'x'] })).toEqual([{ id: 'x' }]);
  });
});

describe('parseFailure', () => {
  it('maps the reference server’s invalid_questions to cards', () => {
    const e = parseFailure(422, { detail: { invalid_questions: { a: 'needs two options' } } });
    expect(e.perQuestion).toEqual({ a: 'needs two options' });
    expect(e.message).toBe("1 question can't be answered");
  });
  it('maps oMLX 400 and 422 messages to the question', () => {
    expect(parseFailure(400, { error: { message: 'questions.route: choice needs options' } }).perQuestion).toEqual({ route: 'choice needs options' });
    const e = parseFailure(422, { error: { message: "body -> questions -> q -> type: Input should be 'noul', 'choice' or 'score'" } });
    expect(e.perQuestion.q).toMatch(/^type: Input should be/);
  });
  it('splits several oMLX problems into one entry per question', () => {
    const e = parseFailure(422, { error: { message: "body -> questions -> a -> type: Input should be 'noul'; body -> questions -> b -> type: Input should be 'noul'" } });
    expect(Object.keys(e.perQuestion)).toEqual(['a', 'b']);
    expect(e.message).toBe("2 questions can't be answered");
    expect(blamesExtension(e)).toBe(true);
  });
  it('explains 413 and 401 and keeps other messages', () => {
    expect(parseFailure(413, {}).message).toMatch(/Too long/);
    expect(parseFailure(401, {}).message).toMatch(/key/);
    expect(parseFailure(500, { detail: 'boom' }).message).toBe('boom');
    expect(parseFailure(502, null, 'Bad Gateway').message).toBe('Bad Gateway');
  });
});

describe('blamesExtension', () => {
  it('spots a rejected extension type or field', () => {
    expect(blamesExtension(new ApiError("Input should be 'noul', 'choice' or 'score'", 422, { q: 'type: Input should be box' }))).toBe(true);
    expect(blamesExtension(new ApiError('Extra inputs are not permitted: assets', 422))).toBe(true);
    expect(blamesExtension(new ApiError('boom', 500))).toBe(false);
    expect(blamesExtension(new ApiError('score needs at least 2 levels', 400))).toBe(false);
    expect(blamesExtension(new ApiError('questions need two options', 400))).toBe(false);
  });
});
