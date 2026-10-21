<script lang="ts">
  import type { AnswerOk } from '../../lib/types';
  import { pct } from '../../lib/util';
  let { a }: { a: Extract<AnswerOk, { type: 'choice' }> } = $props();
  const rows = $derived(Object.entries(a.probabilities ?? {}).sort((x, y) => y[1] - x[1]));
  const p = $derived(a.probabilities?.[a.choice]);
  const runner = $derived(rows.find(([k]) => k !== a.choice));
  const close = $derived(rows.length > 1 && runner != null && (p ?? 0) - runner[1] < 0.15);
  // `confidence` is 1 − normalised entropy on d3 and oMLX, not a chance of being right, so it stays in a tooltip
  const certainty = $derived(a.confidence != null ? `certainty ${a.confidence.toFixed(2)} (how peaked the distribution is, not accuracy)` : '');
</script>

<div class="head" title={certainty}>
  <span class="v">{a.choice}</span>
  {#if p != null}<span class="c">{pct(p)}</span>{/if}
  {#if close}<span class="chip" title="Close to {runner?.[0]} ({pct(runner?.[1] ?? 0)})">close call</span>{/if}
</div>
<div class="rows">
  {#each rows as [k, q] (k)}
    <div class="r" class:best={k === a.choice}>
      <span class="l" title={k}>{k}</span>
      <span class="t"><i style:width="{Math.max(q * 100, 0.6)}%"></i></span>
      <span class="p">{pct(q)}</span>
    </div>
  {/each}
</div>

<style>
  .head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
  .v { font-size: 22px; font-weight: 640; letter-spacing: -0.02em; }
  .c { color: var(--ink-3); font-size: 13px; font-variant-numeric: tabular-nums; }
  .chip { align-self: center; font-size: 12px; padding: 1px 8px; border-radius: 99px; background: var(--sunken); color: var(--ink-2); }
  .rows { display: flex; flex-direction: column; gap: 7px; }
  .r { display: grid; grid-template-columns: minmax(70px, 30%) 1fr 52px; align-items: center; gap: 12px; font-size: 13.5px; color: var(--ink-2); }
  .l { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .t { height: 8px; border-radius: 99px; background: var(--sunken); overflow: hidden; }
  .t i { display: block; height: 100%; border-radius: 99px; background: var(--line-strong); transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .p { text-align: right; font-variant-numeric: tabular-nums; color: var(--ink-3); }
  .best { color: var(--ink); font-weight: 560; }
  .best .t i { background: var(--accent); }
  .best .p { color: var(--ink); }
</style>
