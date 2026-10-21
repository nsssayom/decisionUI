<script lang="ts">
  import { app } from '../lib/app.svelte';
  import * as api from '../lib/api';
  import Icon from './Icon.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let q = $state('');
  let hits = $state<api.SearchHit[]>([]);
  let busy = $state<string | null>(null);
  let note = $state('');

  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

  async function go(e: Event) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    note = '';
    if (/^https?:\/\//i.test(v)) return read(v, v);
    busy = 'search';
    try {
      hits = await api.webSearch(v);
      if (!hits.length) note = 'No results';
    } catch (err) {
      hits = [];
      note = (err as Error).message;
    } finally {
      busy = null;
    }
  }

  async function read(url: string, key: string) {
    busy = key;
    try {
      const r = await api.readPage(url);
      if (!r.text.trim()) throw new Error('No readable text');
      app.addContext(r.title || host(url), `Source: ${url}\n\n${r.text}`, 'web');
      app.toast(`Added ${host(url)}`);
      q = '';
      hits = [];
    } catch (err) {
      note = (err as Error).message;
    } finally {
      busy = null;
    }
  }
</script>

<div class="web">
  <form onsubmit={go}>
    <Icon name="search" size={16} />
    <!-- svelte-ignore a11y_autofocus -->
    <input bind:value={q} placeholder={app.tools.search ? 'Search or paste a URL' : 'Paste a URL'} autocomplete="off" autofocus aria-label="Search or URL" />
    {#if busy === 'search'}<span class="spin"></span>{/if}
    <button type="button" class="x" aria-label="Close" onclick={onclose}><Icon name="x" size={14} /></button>
  </form>
  {#if note}<div class="note">{note}</div>{/if}
  {#if hits.length}
    <ul>
      {#each hits as h (h.url)}
        <li>
          <div class="b"><b>{h.title}</b><span>{host(h.url)}</span></div>
          <button title="Add the snippet" aria-label="Add snippet" onclick={() => { app.addContext(h.title, `${h.url}\n${h.snippet}`, 'web'); app.toast('Added'); }}><Icon name="plus" size={15} /></button>
          <button title="Read the page" aria-label="Read page" disabled={busy === h.url} onclick={() => read(h.url, h.url)}>{#if busy === h.url}<span class="spin"></span>{:else}<Icon name="arrow" size={15} />{/if}</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .web { margin-top: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--sunken); overflow: hidden; }
  form { display: flex; align-items: center; gap: 10px; padding: 0 8px 0 12px; height: 42px; color: var(--ink-3); }
  input { color: var(--ink); font-size: 14.5px; }
  .x { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: var(--ink-3); }
  .x:hover { background: var(--line); color: var(--ink); }
  ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); max-height: 320px; overflow: auto; }
  li { display: flex; align-items: center; gap: 4px; padding: 8px 8px 8px 14px; }
  li + li { border-top: 1px solid var(--line); }
  .b { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  b { font-weight: 550; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .b span { color: var(--ink-3); font-size: 12.5px; }
  li button { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--ink-2); }
  li button:hover:not(:disabled) { background: var(--line); color: var(--ink); }
  .note { padding: 9px 14px; color: var(--ink-3); font-size: 13.5px; border-top: 1px solid var(--line); }
  .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-strong); border-top-color: var(--accent); animation: sp 0.7s linear infinite; }
  @keyframes sp { to { transform: rotate(360deg); } }
</style>
