<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { autosize } from '../lib/actions';
  import { bytes } from '../lib/util';
  import { normTag } from '../lib/request';
  import Icon from './Icon.svelte';
  import WebPanel from './WebPanel.svelte';

  let over = $state(false);
  let web = $state(false);
  let picker: HTMLInputElement;
  let tagging = $state<string | null>(null);
  const unread = (kind: 'image' | 'video') => app.caps[kind] === false;

  const isJson = $derived(app.doc.stateMode === 'json');
  const jsonBad = $derived.by(() => {
    if (!isJson || !app.doc.state.trim()) return false;
    try { JSON.parse(app.doc.state); return false; } catch { return true; }
  });

  function toggleJson() {
    const d = app.doc;
    if (!isJson) {
      try { JSON.parse(d.state); } catch { if (d.state.trim()) d.state = JSON.stringify(d.state); }
      d.stateMode = 'json';
    } else {
      try { const v = JSON.parse(d.state); if (typeof v === 'string') d.state = v; } catch { /* keep the text */ }
      d.stateMode = 'text';
    }
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    over = false;
    void app.attach([...(e.dataTransfer?.files ?? [])]);
  }
  function paste(e: ClipboardEvent) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) { e.preventDefault(); void app.attach(files); }
  }
  const media = $derived(app.doc.media);
</script>

<svelte:window onpaste={paste} />

<section
  class="card"
  class:over
  ondragover={(e) => { e.preventDefault(); over = true; }}
  ondragleave={(e) => { if (e.currentTarget === e.target) over = false; }}
  ondrop={drop}
  aria-label="Input"
>
  <textarea
    class:mono={isJson}
    class:bad={jsonBad}
    rows="3"
    placeholder={isJson ? '{ "ticket": "…" }' : 'Input'}
    spellcheck="false"
    bind:value={app.doc.state}
    use:autosize={app.doc.state}
    aria-label="Input"
  ></textarea>

  {#if media.length || app.doc.contexts.length}
    <div class="attached">
      {#each media as m (m.id)}
        <div class="thumb" class:unread={unread(m.kind)} title={unread(m.kind) ? 'Not read by this model' : ''}>
          {#if m.kind === 'video'}<video src={m.src} muted preload="metadata"></video>{:else}<img src={m.src} alt={m.name} />{/if}
          <button class="rm" aria-label="Remove {m.name}" onclick={() => (app.doc.media = app.doc.media.filter((x) => x.id !== m.id))}><Icon name="x" size={12} /></button>
          {#if !app.caps.ext}
            <!-- tags need extensions: without them the file goes as a plain image -->
          {:else if tagging === m.id}
            <!-- svelte-ignore a11y_autofocus -->
            <input class="tagin mono" placeholder="&lt;tag&gt;" value={m.tag ?? ''} autofocus
              onblur={(e) => { m.tag = e.currentTarget.value.trim() ? normTag(e.currentTarget.value) : undefined; tagging = null; }}
              onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          {:else}
            <button class="tag mono" class:set={m.tag} title="Name it to use it as <tag> in a question" onclick={() => (tagging = m.id)}>
              {#if m.tag}{m.tag}{:else}<Icon name="tag" size={12} />{/if}
            </button>
          {/if}
          {#if m.size}<span class="size">{bytes(m.size)}</span>{/if}
        </div>
      {/each}
      {#each app.doc.contexts as c (c.id)}
        <div class="chip">
          <Icon name={c.source === 'web' ? 'link' : 'file'} size={15} />
          <span class="t" title={c.title}>{c.title}</span>
          <span class="n">{c.text.length > 999 ? `${(c.text.length / 1000).toFixed(1)}k` : c.text.length}</span>
          <button aria-label="Remove {c.title}" onclick={() => (app.doc.contexts = app.doc.contexts.filter((x) => x.id !== c.id))}><Icon name="x" size={13} /></button>
        </div>
      {/each}
    </div>
  {/if}

  {#if web}<WebPanel onclose={() => (web = false)} />{/if}

  <div class="bar">
    <div class="acts">
      <button class="icon" title="Attach files" aria-label="Attach files" onclick={() => picker.click()}><Icon name="attach" /></button>
      <button class="icon" class:on={web} title="Web" aria-label="Web search" onclick={() => (web = !web)} disabled={!app.tools.search && !app.tools.read}><Icon name="globe" /></button>
      <button class="icon" class:on={isJson} title="JSON" aria-label="JSON input" onclick={toggleJson}><Icon name="braces" /></button>
    </div>
  </div>
  <input type="file" multiple hidden bind:this={picker} onchange={(e) => { void app.attach([...(e.currentTarget.files ?? [])]); e.currentTarget.value = ''; }} />

  {#if over}<div class="drop">Drop to attach</div>{/if}
</section>

<style>
  .card { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); box-shadow: var(--shadow); padding: 18px 18px 10px; transition: border-color 0.15s; }
  .card:focus-within { border-color: var(--line-strong); }
  .card.over { border-color: var(--accent); }
  textarea { font-size: 16.5px; line-height: 1.55; min-height: 80px; max-height: 46vh; overflow: auto; }
  textarea.mono { font-size: 13.5px; }
  textarea.bad { color: var(--bad); }
  .attached { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0 4px; }
  .thumb { position: relative; width: 84px; height: 84px; border-radius: 12px; overflow: hidden; background: var(--sunken); border: 1px solid var(--line); }
  .thumb img, .thumb video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb.unread { opacity: 0.4; filter: grayscale(1); }
  .rm { position: absolute; top: 5px; right: 5px; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: rgb(0 0 0 / 0.55); opacity: 0; transition: opacity 0.12s; }
  .thumb:hover .rm, .rm:focus-visible { opacity: 1; }
  .tag, .tagin { position: absolute; left: 5px; bottom: 5px; max-width: calc(100% - 10px); font-size: 11px; color: #fff; background: rgb(0 0 0 / 0.55); border-radius: 7px; padding: 2px 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-flex; align-items: center; }
  .tag:not(.set) { opacity: 0; transition: opacity 0.12s; }
  .thumb:hover .tag { opacity: 1; }
  .tag.set { background: var(--accent); color: var(--accent-ink); }
  .tagin { width: calc(100% - 10px); background: rgb(0 0 0 / 0.75); }
  .size { position: absolute; right: 6px; bottom: 5px; font-size: 10.5px; color: #fff; text-shadow: 0 1px 2px rgb(0 0 0 / 0.6); }
  .chip { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 6px 0 11px; border-radius: 11px; background: var(--sunken); border: 1px solid var(--line); font-size: 13.5px; max-width: 260px; }
  .chip .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chip .n { color: var(--ink-3); font-size: 12px; font-variant-numeric: tabular-nums; }
  .chip button { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; color: var(--ink-3); }
  .chip button:hover { background: var(--line); color: var(--ink); }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 8px; min-height: 40px; }
  .acts { display: flex; gap: 2px; margin-left: -8px; }
  .icon { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: var(--ink-3); transition: background 0.12s, color 0.12s; }
  .icon:hover:not(:disabled) { background: var(--sunken); color: var(--ink); }
  .icon.on { background: var(--accent-soft); color: var(--accent); }
  .drop { position: absolute; inset: 0; border-radius: var(--r); display: grid; place-items: center; background: color-mix(in srgb, var(--accent-soft) 90%, transparent); color: var(--accent); font-weight: 600; border: 2px dashed var(--accent); pointer-events: none; }
</style>
