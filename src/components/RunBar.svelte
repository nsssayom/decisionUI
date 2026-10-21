<script lang="ts">
  import { app } from '../lib/app.svelte';
  import Icon from './Icon.svelte';

  const meta = $derived.by(() => {
    const r = app.result;
    if (!r || app.running) return '';
    const t = r.resp.usage?.input_tokens;
    return `${(r.ms / 1000).toFixed(r.ms < 10_000 ? 2 : 1)} s${t ? ` · ${t.toLocaleString()} tok` : ''}`;
  });
</script>

<div class="bar">
  {#if app.error}
    <div class="err" role="alert">{app.error}</div>
  {/if}
  <div class="cluster">
    {#if meta}<span class="meta" class:stale={app.stale}>{meta}</span>{/if}
    {#if app.running}
      <button class="go busy" onclick={() => app.stop()}><span class="spin"></span>Stop</button>
    {:else}
      <button class="go" onclick={() => app.run()} disabled={!app.endpoint}>Decide<kbd>⌘↵</kbd></button>
    {/if}
  </div>
</div>

<style>
  .bar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 25; display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 28px 16px calc(18px + env(safe-area-inset-bottom)); pointer-events: none;
    background: linear-gradient(to top, var(--bg) 35%, transparent);
  }
  .bar > * { pointer-events: auto; }
  .cluster { display: flex; align-items: center; gap: 14px; }
  .meta { color: var(--ink-3); font-size: 13px; font-variant-numeric: tabular-nums; transition: opacity 0.2s; }
  .meta.stale { opacity: 0.45; }
  .go {
    display: inline-flex; align-items: center; gap: 10px; height: 46px; padding: 0 26px; border-radius: 99px;
    background: var(--accent); color: var(--accent-ink); font-weight: 620; font-size: 15.5px; letter-spacing: -0.01em;
    box-shadow: 0 6px 20px color-mix(in srgb, var(--accent) 38%, transparent); transition: transform 0.12s, box-shadow 0.15s, filter 0.15s;
  }
  .go:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
  .go:active:not(:disabled) { transform: translateY(0) scale(0.98); }
  .go.busy { background: var(--ink); color: var(--bg); box-shadow: var(--shadow-pop); }
  kbd { font-size: 11.5px; opacity: 0.6; font-family: inherit; }
  .err { background: var(--surface); color: var(--bad); border: 1px solid color-mix(in srgb, var(--bad) 40%, var(--line)); padding: 8px 14px; border-radius: 12px; font-size: 13.5px; max-width: 560px; box-shadow: var(--shadow); }
  .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid color-mix(in srgb, currentColor 30%, transparent); border-top-color: currentColor; animation: sp 0.7s linear infinite; }
  @keyframes sp { to { transform: rotate(360deg); } }
</style>
