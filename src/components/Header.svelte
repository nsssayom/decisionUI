<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { clickOutside } from '../lib/actions';
  import Icon from './Icon.svelte';

  let open = $state(false);
  let adding = $state(false);
  let f = $state({ name: '', url: '', key: '' });

  const host = (u: string) => {
    try { return new URL(u).host; } catch { return u; }
  };
  function add() {
    try {
      app.addEndpoint(f.name, f.url, f.key);
      f = { name: '', url: '', key: '' };
      adding = false;
    } catch {
      app.toast('Enter a full URL, like http://127.0.0.1:8080');
    }
  }
</script>

<header>
  <div class="brand">
    <svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#5b5bf0" /><circle cx="49.5" cy="19.5" r="3.6" fill="#fff" fill-opacity="0.42" /><path d="M15.5 33L27 44.5L43.65 26" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
    <span><b>decision</b>UI</span>
  </div>

  <div class="menu" use:clickOutside={() => (open = false)}>
    <button class="pill" onclick={() => (open = !open)} aria-haspopup="true" aria-expanded={open}>
      <span class="dot {app.status}" title={app.statusText}></span>
      <span class="label">{app.endpoint?.name ?? 'no endpoint'}{app.model ? ` · ${app.model}` : ''}</span>
      <Icon name="chevron" size={14} />
    </button>

    {#if open}
      <div class="pop" role="dialog" aria-label="Endpoint and model">
        <div class="group">
          {#each app.endpoints as e (e.id)}
            <div class="row" class:on={e.id === app.endpointId}>
              <button class="grow" onclick={() => app.selectEndpoint(e.id)}>
                <span class="name">{e.name}</span><span class="sub">{host(e.url)}{e.mode === 'proxy' ? '' : ' · direct'}</span>
              </button>
              {#if e.id === app.endpointId}<span class="tick"><Icon name="check" size={15} /></span>{/if}
              {#if e.mode === 'direct'}<button class="x" aria-label="Remove {e.name}" onclick={() => app.removeEndpoint(e.id)}><Icon name="x" size={14} /></button>{/if}
            </div>
          {/each}
          {#if !adding}
            <button class="row add" onclick={() => (adding = true)}><Icon name="plus" size={15} />Endpoint</button>
          {:else}
            <form class="new" onsubmit={(e) => { e.preventDefault(); add(); }}>
              <input placeholder="Name" bind:value={f.name} autocomplete="off" aria-label="Name" />
              <input placeholder="https://host:port" bind:value={f.url} autocomplete="off" aria-label="URL" required />
              <input placeholder="API key" type="password" bind:value={f.key} autocomplete="off" aria-label="API key" />
              <button class="go" type="submit">Add</button>
            </form>
          {/if}
        </div>

        {#if app.models.length}
          <div class="group models">
            {#each app.models as m (m.id)}
              <button class="row" class:on={m.id === app.model} onclick={() => { app.setModel(m.id); open = false; }}>
                <span class="name mono">{m.id}</span>{#if m.id === app.model}<span class="tick"><Icon name="check" size={15} /></span>{/if}
              </button>
            {/each}
          </div>
          <div class="group">
            <label class="row sw" title="Box, track, tagged images and long context. Turn on only if this server knows them: some ignore them silently, others reject the request.">
              <span class="name">Extensions</span>
              <input type="checkbox" checked={app.caps.ext} onchange={(e) => app.setExtensions(e.currentTarget.checked)} />
            </label>
          </div>
        {:else if app.status === 'bad'}
          <div class="group"><div class="row err">{app.statusText}</div></div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="tools">
    <button class="icon" class:on={app.historyOpen} aria-label="History" title="History" aria-pressed={app.historyOpen} onclick={() => app.toggleHistory()}><Icon name="history" /></button>
    <button class="icon" aria-label="Request and code" title="Request · code" onclick={() => (app.drawer = app.drawer ? null : 'request')}><Icon name="braces" /></button>
    <button class="icon" aria-label="Toggle theme" title="Theme" onclick={() => app.toggleTheme()}><Icon name={document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches) ? 'sun' : 'moon'} /></button>
  </div>
</header>

<style>
  header {
    position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px;
    height: 56px; padding: 0 18px;
    background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(14px) saturate(1.4);
    border-bottom: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  }
  .brand { display: flex; align-items: center; gap: 9px; font-size: 15.5px; letter-spacing: -0.02em; margin-right: auto; white-space: nowrap; }
  .brand b { font-weight: 650; }
  .mark { width: 22px; height: 22px; flex: none; }
  .menu { position: relative; }
  .pill {
    display: flex; align-items: center; gap: 9px; max-width: min(56vw, 420px);
    height: 34px; padding: 0 12px 0 11px; border-radius: 99px; border: 1px solid var(--line); background: var(--surface);
    font-size: 13.5px; transition: border-color 0.15s;
  }
  .pill:hover { border-color: var(--line-strong); }
  .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line-strong); flex: none; }
  .dot.ok { background: var(--good); }
  .dot.bad { background: var(--bad); }
  .dot.busy { background: var(--warn); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; } }
  .pop {
    position: absolute; right: 0; top: 42px; width: 340px; max-width: calc(100vw - 24px); z-index: 40;
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-pop); padding: 6px;
    animation: in 0.12s ease-out;
  }
  @keyframes in { from { opacity: 0; transform: translateY(-4px); } }
  .group + .group { border-top: 1px solid var(--line); margin-top: 6px; padding-top: 6px; }
  .models { max-height: 240px; overflow: auto; }
  .row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border-radius: 9px; text-align: left; font-size: 14px; }
  .row:hover { background: var(--sunken); }
  .row.on .name { font-weight: 600; }
  .row .grow { flex: 1; display: flex; flex-direction: column; text-align: left; min-width: 0; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .sub { color: var(--ink-3); font-size: 12px; }
  .tick { color: var(--accent); display: flex; }
  .x { color: var(--ink-3); display: flex; padding: 3px; border-radius: 6px; }
  .x:hover { color: var(--bad); background: var(--sunken); }
  .row.add { color: var(--ink-2); }
  .row.err { color: var(--bad); cursor: default; }
  .new { display: flex; flex-direction: column; gap: 6px; padding: 6px; }
  .new input { background: var(--sunken); border-radius: 9px; padding: 8px 10px; font-size: 14px; }
  .go { align-self: flex-end; padding: 6px 14px; border-radius: 9px; background: var(--accent); color: var(--accent-ink); font-weight: 600; font-size: 13.5px; }
  .sw { cursor: pointer; }
  .sw input { accent-color: var(--accent); width: 16px; height: 16px; }
  .tools { display: flex; gap: 2px; }
  .icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: var(--ink-2); }
  .icon:hover { background: var(--sunken); color: var(--ink); }
  .icon.on { color: var(--accent); }
  @media (max-width: 520px) { .brand span:last-child { display: none; } .brand { margin-right: 0; } .menu { margin-right: auto; } }
</style>
