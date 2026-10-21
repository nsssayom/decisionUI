import type { Doc, Question } from './types';
import { blankDoc, newQuestion } from './request';
import { uid } from './util';

/** A small picture drawn on a canvas, so the vision example needs no assets. */
function scene(): string {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 400;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#dfeaf7');
  sky.addColorStop(1, '#f6f1e6');
  g.fillStyle = sky;
  g.fillRect(0, 0, 640, 400);
  g.fillStyle = '#c9d6c0';
  g.fillRect(0, 300, 640, 100);
  g.fillStyle = '#e5484d';
  g.beginPath();
  g.arc(150, 160, 62, 0, 7);
  g.fill();
  g.fillStyle = '#3e63dd';
  g.fillRect(360, 90, 130, 130);
  g.fillStyle = '#30a46c';
  g.beginPath();
  g.moveTo(520, 330);
  g.lineTo(600, 330);
  g.lineTo(560, 250);
  g.fill();
  g.fillStyle = '#f5a524';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 22 : 46;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    g.lineTo(250 + r * Math.cos(a), 330 + r * Math.sin(a));
  }
  g.fill();
  return c.toDataURL('image/png');
}

const choice = (name: string, instructions: string, opts: Record<string, string>): Question => ({
  ...newQuestion('choice'),
  name,
  instructions,
  options: Object.entries(opts).map(([key, desc]) => ({ key, desc })),
});
const yesNo = (name: string, instructions: string): Question => ({ ...newQuestion('noul'), name, instructions });
const score = (name: string, instructions: string, levels: string[]): Question => ({ ...newQuestion('score'), name, instructions, levels });

export interface Example {
  name: string;
  build: () => Doc;
}

export const EXAMPLES: Example[] = [
  {
    name: 'Routing',
    build: () => ({
      ...blankDoc(),
      state: 'The order arrived damaged yesterday. I have the receipt and would like a replacement today.',
      questions: [
        choice('team', 'Which team should handle this?', { returns: 'Refunds, replacements, damaged deliveries', billing: 'Payments and invoices', technical: 'Setup, bugs and faults' }),
        yesNo('receipt', 'Does the customer have proof of purchase?'),
        score('urgency', 'How urgent is this?', ['not urgent', 'somewhat urgent', 'urgent', 'critical']),
      ],
    }),
  },
  {
    name: 'Moderation',
    build: () => ({
      ...blankDoc(),
      state: 'You people are idiots and I hope your whole team gets fired.',
      questions: [yesNo('abusive', 'Is this message abusive toward people?'), choice('action', 'What should a moderator do?', { allow: 'Publish', warn: 'Publish with a warning', remove: 'Remove' })],
    }),
  },
  {
    name: 'Rating',
    build: () => ({
      ...blankDoc(),
      state: 'Setup took five minutes and it just works. Battery life is a bit short, though.',
      questions: [
        choice('sentiment', 'Overall sentiment?', { positive: 'Mostly favourable', mixed: 'Both good and bad', negative: 'Mostly unfavourable' }),
        score('stars', 'What rating does this review deserve?', ['1 star', '2 stars', '3 stars', '4 stars', '5 stars']),
      ],
    }),
  },
  {
    name: 'Vision',
    build: () => ({
      ...blankDoc(),
      state: 'A test scene with coloured shapes.',
      media: [{ id: uid(), kind: 'image', name: 'scene.png', src: scene() }],
      questions: ['The red circle', 'The blue square', 'The green triangle', 'The yellow star'].map((t, i) => ({ ...newQuestion('box', i + 1), name: t.split(' ').pop()!, instructions: t })),
    }),
  },
];
