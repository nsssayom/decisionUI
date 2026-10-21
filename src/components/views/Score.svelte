<script lang="ts">
  import type { AnswerOk } from '../../lib/types';
  import { pct } from '../../lib/util';
  let { a }: { a: Extract<AnswerOk, { type: 'score' }> } = $props();
  const ids = $derived(Object.keys(a.probabilities ?? {}).sort((x, y) => Number(x) - Number(y)));
  const top = $derived(Math.max(...ids.map((k) => a.probabilities[k]), 0.0001));
  // `score` is the expected value Σ i·p, so the label is the most likely level, and a split distribution is called out
  const mode = $derived(ids.reduce((m, k) => (a.probabilities[k] > (a.probabilities[m] ?? -1) ? k : m), ids[0] ?? '0'));
  const label = $derived(a.legend?.[mode] ?? mode);
  const split = $derived(a.probabilities[mode] < 0.5 && ids.filter((k) => a.probabilities[k] > 0.25).some((k) => Math.abs(Number(k) - Number(mode)) > 1));
</script>

<div class="head">
  <span class="v">{label}</span>
  <span class="c" title="Expected level on a scale of 0 to {ids.length - 1}">{a.score.toFixed(2)} of {ids.length - 1}</span>
  {#if split}<span class="chip" title="Two distant levels are both likely">split</span>{/if}
</div>
<div class="bars">
  {#each ids as k (k)}
    {@const p = a.probabilities[k]}
    <div class="col" class:best={k === mode} title="{a.legend?.[k] ?? k} · {pct(p)}">
      <span class="v2">{pct(p)}</span>
      <i style:height="{Math.max((p / top) * 100, 3)}%"></i>
      <span class="lab">{a.legend?.[k] ?? k}</span>
    </div>
  {/each}
</div>

<style>
  .head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
  .v { font-size: 22px; font-weight: 640; letter-spacing: -0.02em; }
  .c { color: var(--ink-3); font-size: 13px; font-variant-numeric: tabular-nums; }
  .chip { align-self: center; font-size: 12px; padding: 1px 8px; border-radius: 99px; background: var(--sunken); color: var(--ink-2); }
  .bars { display: flex; align-items: flex-end; gap: 8px; height: 132px; }
  .col { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 5px; }
  .col i { display: block; width: 100%; border-radius: 8px 8px 3px 3px; background: var(--line-strong); transition: height 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .col.best i { background: var(--accent); }
  .v2 { flex: none; font-size: 11.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; opacity: 0; transition: opacity 0.12s; }
  .col.best .v2, .col:hover .v2 { opacity: 1; }
  .lab { font-size: 12px; line-height: 1.5; color: var(--ink-3); max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 2px 0 1px; flex: none; }
  .col i { flex: none; }
</style>
