<script lang="ts">
  import { pct } from '../../lib/util';
  let { p }: { p: number } = $props();
  const unsure = $derived(p > 0.35 && p < 0.65);
  const yes = $derived(p >= 0.5);
</script>

<div class="head">
  <span class="v" class:yes={yes && !unsure} class:unsure>{unsure ? 'Unsure' : yes ? 'Yes' : 'No'}</span>
  <span class="c" title="Probability of yes">{pct(p)} yes</span>
</div>
<div class="gauge" role="img" aria-label="Probability of yes {pct(p)}">
  <span class="band"></span>
  <i style:width="{p * 100}%"></i>
  <b style:left="{p * 100}%"></b>
</div>
<div class="ends"><span>No</span><span>Yes</span></div>

<style>
  .head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; }
  .v { font-size: 22px; font-weight: 640; letter-spacing: -0.02em; }
  .v.yes { color: var(--good); }
  .v.unsure { color: var(--ink-2); }
  .c { color: var(--ink-3); font-size: 13px; font-variant-numeric: tabular-nums; }
  .gauge { position: relative; height: 8px; border-radius: 99px; background: var(--sunken); }
  .band { position: absolute; left: 35%; width: 30%; top: -3px; bottom: -3px; border-radius: 6px; border: 1px dashed var(--line-strong); opacity: 0.7; }
  .gauge i { position: absolute; inset: 0 auto 0 0; border-radius: 99px; background: linear-gradient(90deg, var(--line-strong), var(--accent)); transition: width 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .gauge b { position: absolute; top: -4px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: var(--surface); border: 2px solid var(--accent); box-shadow: 0 1px 4px rgb(0 0 0 / 0.2); transition: left 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .ends { display: flex; justify-content: space-between; margin-top: 8px; color: var(--ink-3); font-size: 12.5px; }
</style>
