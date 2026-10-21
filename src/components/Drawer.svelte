<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { clickOutside } from '../lib/actions';
  import { snippet, type Lang } from '../lib/snippets';
  import { isDataUrl } from '../lib/util';
  import Icon from './Icon.svelte';

  let text = $state('');
  let focused = $state(false);
  let err = $state('');
  let lang = $state<Lang>('curl');

  const pretty = (req: unknown) =>
    JSON.stringify(req, (_k, v) => (isDataUrl(v) && v.length > 200 ? `<media ${Math.round(v.length / 1365)} KB>` : v), 2);

  $effect(() => {
    if (app.drawer === 'request' && !focused) text = pretty(app.request);
  });

  function apply() {
    focused = false;
    if (text === pretty(app.request)) return;
    try {
      if (/<media \d+ KB>/.test(text)) throw new Error('Inline media is shortened here. Change it in the form.');
      app.applyRequest(JSON.parse(text));
      err = '';
    } catch (e) {
      err = (e as Error).message;
    }
  }

  const code = $derived(snippet(lang, app.request, app.endpoint?.url ?? 'http://127.0.0.1:8080'));
  async function copy() {
    try { await navigator.clipboard.writeText(code); app.toast('Copied'); } catch { app.toast('Copy failed'); }
  }
  const tabs = [['request', 'Request'], ['code', 'Code']] as const;
</script>

{#if app.drawer}
  <aside use:clickOutside={() => (app.drawer = null)} aria-label="Request and code">
    <header>
      <div class="tabs" role="tablist">
        {#each tabs as [id, label]}<button role="tab" aria-selected={app.drawer === id} class:on={app.drawer === id} onclick={() => (app.drawer = id)}>{label}</button>{/each}
      </div>
      <button class="x" aria-label="Close" onclick={() => (app.drawer = null)}><Icon name="x" /></button>
    </header>

    {#if app.drawer === 'request'}
      <textarea class="code" spellcheck="false" bind:value={text} onfocus={() => (focused = true)} onblur={apply} aria-label="Request JSON"></textarea>
      {#if err}<p class="err">{err}</p>{/if}
    {:else if app.drawer === 'code'}
      <div class="bar">
        <div class="seg">{#each ['curl', 'python', 'js'] as l}<button class:on={lang === l} onclick={() => (lang = l as Lang)}>{l === 'js' ? 'JS' : l === 'python' ? 'Python' : 'curl'}</button>{/each}</div>
        <button class="copy" onclick={copy}><Icon name="copy" size={15} />Copy</button>
      </div>
      <pre class="code">{code}</pre>
    {/if}
  </aside>
{/if}

<style>
  aside {
    position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); z-index: 50; display: flex; flex-direction: column; gap: 12px;
    background: var(--surface); border-left: 1px solid var(--line); box-shadow: var(--shadow-pop); padding: 14px 16px 16px;
    animation: slide 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes slide { from { transform: translateX(24px); opacity: 0; } }
  header { display: flex; align-items: center; justify-content: space-between; }
  .tabs { display: flex; gap: 2px; padding: 3px; background: var(--sunken); border-radius: 11px; }
  .tabs button { padding: 5px 14px; border-radius: 8px; font-size: 13.5px; color: var(--ink-2); }
  .tabs button.on { background: var(--surface); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgb(0 0 0 / 0.08); }
  .x { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; color: var(--ink-2); }
  .x:hover { background: var(--sunken); }
  .code { flex: 1; min-height: 0; width: 100%; font: 12.5px/1.6 var(--mono); background: var(--sunken); border-radius: 12px; padding: 14px; overflow: auto; margin: 0; white-space: pre-wrap; word-break: break-all; }
  textarea.code { white-space: pre; word-break: normal; }
  .err { margin: 0; color: var(--bad); font-size: 13px; }
  .bar { display: flex; justify-content: space-between; align-items: center; }
  .seg { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--sunken); }
  .seg button { padding: 4px 12px; border-radius: 8px; font-size: 13px; color: var(--ink-2); }
  .seg button.on { background: var(--surface); color: var(--ink); font-weight: 600; box-shadow: 0 1px 2px rgb(0 0 0 / 0.08); }
  .copy { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 10px; font-size: 13.5px; color: var(--ink-2); border: 1px solid var(--line); }
  .copy:hover { background: var(--sunken); color: var(--ink); }
</style>
