<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { debounce } from '../lib/util';
  import type { HistoryRow } from '../lib/history';
  import Icon from './Icon.svelte';

  let q = $state('');
  const search = debounce((v: string) => void app.refreshHistory(v), 250);
  const narrow = () => innerWidth < 1100;

  const day = (t: number): string => {
    const d = new Date(t);
    const a = new Date().setHours(0, 0, 0, 0);
    const days = Math.round((a - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
    return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? 'This week' : d.toLocaleDateString([], { month: 'short', year: 'numeric' });
  };
  const groups = $derived.by(() => {
    const out: { label: string; rows: HistoryRow[] }[] = [];
    for (const r of app.history) {
      const label = day(r.t);
      (out.at(-1)?.label === label ? out.at(-1)! : out[out.push({ label, rows: [] }) - 1]).rows.push(r);
    }
    return out;
  });

  function open(r: HistoryRow) {
    void app.openHistory(r.id);
    if (narrow()) app.toggleHistory();
  }
</script>

{#if app.historyOpen}
  {#if narrow()}<button class="scrim" aria-label="Close history" onclick={() => app.toggleHistory()}></button>{/if}
  <aside aria-label="History">
    <div class="top">
      <label class="find"><Icon name="search" size={15} /><input placeholder="Search" bind:value={q} oninput={() => search(q)} aria-label="Search history" /></label>
      <button class="new" title="New" aria-label="New question" onclick={() => app.newDoc()}><Icon name="plus" size={17} /></button>
    </div>

    <div class="list">
      {#each groups as g (g.label)}
        <h3>{g.label}</h3>
        {#each g.rows as r (r.id)}
          <div class="item" class:on={r.id === app.historyId}>
            <button class="body" onclick={() => open(r)}>
              <b>{r.title}</b>
              <span>{r.brief || '—'}</span>
            </button>
            <button class="rm" aria-label="Delete" title="Delete" onclick={() => app.deleteHistory(r.id)}><Icon name="x" size={14} /></button>
          </div>
        {/each}
      {/each}
      {#if !app.history.length}<p class="empty">{q ? 'No matches' : 'Nothing yet'}</p>{/if}
    </div>

    {#if app.history.length && !q}
      <button class="clear" onclick={() => confirm('Delete all history?') && app.clearHistory()}>Clear all</button>
    {/if}
  </aside>
{/if}

<style>
  aside {
    position: fixed; top: 56px; right: 0; bottom: 0; width: var(--hist-w); z-index: 28; display: flex; flex-direction: column; gap: 8px;
    padding: 12px 8px 10px 12px; background: var(--bg); border-left: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  }
  .scrim { position: fixed; inset: 56px 0 0 0; z-index: 27; background: rgb(0 0 0 / 0.35); }
  @media (max-width: 1099px) { aside { background: var(--surface); box-shadow: var(--shadow-pop); z-index: 29; } }
  .top { display: flex; gap: 6px; align-items: center; padding-right: 4px; }
  .find { flex: 1; display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 10px; border-radius: 10px; background: var(--sunken); color: var(--ink-3); }
  .find input { flex: 1; min-width: 0; font-size: 13.5px; color: var(--ink); }
  .new { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; color: var(--ink-2); }
  .new:hover { background: var(--sunken); color: var(--accent); }
  .list { flex: 1; min-height: 0; overflow: auto; padding-right: 4px; }
  h3 { margin: 14px 8px 4px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em; color: var(--ink-3); }
  .item { position: relative; border-radius: 10px; }
  .item:hover { background: var(--sunken); }
  .item.on { background: var(--accent-soft); }
  .body { display: flex; flex-direction: column; gap: 1px; width: 100%; text-align: left; padding: 8px 30px 8px 10px; min-width: 0; }
  .body b { font-weight: 520; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item.on .body b { color: var(--accent); }
  .body span { font-size: 12px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rm { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 24px; height: 24px; display: grid; place-items: center; border-radius: 7px; color: var(--ink-3); opacity: 0; }
  .item:hover .rm, .rm:focus-visible { opacity: 1; }
  .rm:hover { background: var(--line); color: var(--bad); }
  .empty { margin: 40px 0; text-align: center; color: var(--ink-3); font-size: 13.5px; }
  .clear { align-self: center; padding: 6px 12px; border-radius: 8px; font-size: 12.5px; color: var(--ink-3); }
  .clear:hover { background: var(--sunken); color: var(--bad); }
  @media (hover: none) { .rm { opacity: 1; } }
</style>
