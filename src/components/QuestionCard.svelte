<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { autosize, clickOutside } from '../lib/actions';
  import { QLABEL, QTYPES, type Question } from '../lib/types';
  import Icon from './Icon.svelte';
  import Answer from './Answer.svelte';

  let { q }: { q: Question } = $props();
  let menu = $state(false);

  const answer = $derived(app.result?.resp.answers?.[q.name.trim()]);
  const needs = $derived(
    q.type === 'box' && !app.doc.media.some((m) => m.kind === 'image') ? 'Needs an image' : q.type === 'track' && !app.doc.media.some((m) => m.kind === 'video') ? 'Needs a video' : '',
  );

  function setType(t: Question['type']) {
    q.type = t;
    if (t === 'choice' && !q.options.length) q.options = [{ key: '', desc: '' }, { key: '', desc: '' }];
    if (t === 'score' && !q.levels.length) q.levels = ['', '', ''];
    menu = false;
  }
</script>

<article class="q">
  <header>
    <div class="type" use:clickOutside={() => (menu = false)}>
      <button class="glyph" title={QLABEL[q.type]} aria-label="Type: {QLABEL[q.type]}" aria-haspopup="true" onclick={() => (menu = !menu)}><Icon name={q.type} size={17} /></button>
      {#if menu}
        <div class="pop" role="menu">
          {#each QTYPES as t}
            <button role="menuitem" class:on={t === q.type} onclick={() => setType(t)}><Icon name={t} size={16} />{QLABEL[t]}</button>
          {/each}
        </div>
      {/if}
    </div>
    <input class="name mono" bind:value={q.name} placeholder="name" spellcheck="false" autocomplete="off" aria-label="Question name" />
    {#if needs}<span class="needs">{needs}</span>{/if}
    <button class="rm" aria-label="Remove question" title="Remove" onclick={() => app.removeQuestion(q.id)}><Icon name="x" size={16} /></button>
  </header>

  <textarea rows="1" class="ask" placeholder="Question" bind:value={q.instructions} use:autosize={q.instructions} aria-label="Question"></textarea>

  {#if q.type === 'choice'}
    <div class="list">
      {#each q.options as o, i}
        <div class="opt">
          <input class="k mono" placeholder="option" bind:value={o.key} spellcheck="false" aria-label="Option {i + 1}" />
          <input class="d" placeholder="meaning" bind:value={o.desc} spellcheck="false" aria-label="Meaning of option {i + 1}" />
          <button aria-label="Remove option" onclick={() => q.options.splice(i, 1)}><Icon name="x" size={14} /></button>
        </div>
      {/each}
      <button class="more" onclick={() => q.options.push({ key: '', desc: '' })}><Icon name="plus" size={14} />option</button>
    </div>
  {:else if q.type === 'score'}
    <div class="list">
      {#each q.levels as l, i}
        <div class="opt">
          <span class="n">{i}</span>
          <input class="d" placeholder={i === 0 ? 'lowest' : i === q.levels.length - 1 ? 'highest' : 'level'} bind:value={q.levels[i]} spellcheck="false" aria-label="Level {i}" />
          <button aria-label="Remove level" onclick={() => q.levels.splice(i, 1)}><Icon name="x" size={14} /></button>
        </div>
      {/each}
      <button class="more" onclick={() => q.levels.push('')}><Icon name="plus" size={14} />level</button>
    </div>
  {:else if q.type === 'track'}
    <div class="seg" role="group" aria-label="Updates per second">
      {#each [1, 2] as r}<button class:on={q.rate === r} onclick={() => (q.rate = r as 1 | 2)}>{r}/s</button>{/each}
    </div>
  {/if}

  {#if answer}
    <div class="ans" class:stale={app.stale}><Answer {answer} /></div>
  {/if}
</article>

<style>
  .q { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r); box-shadow: var(--shadow); padding: 14px 18px 16px; }
  header { display: flex; align-items: center; gap: 8px; margin: 0 -6px 4px -6px; }
  .type { position: relative; }
  .glyph { width: 32px; height: 32px; border-radius: 10px; display: grid; place-items: center; color: var(--accent); background: var(--accent-soft); transition: filter 0.12s; }
  .glyph:hover { filter: brightness(0.96); }
  .pop { position: absolute; left: 0; top: 38px; z-index: 20; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow-pop); padding: 5px; min-width: 150px; animation: in 0.1s ease-out; }
  @keyframes in { from { opacity: 0; transform: translateY(-3px); } }
  .pop button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border-radius: 8px; font-size: 14px; color: var(--ink-2); }
  .pop button:hover { background: var(--sunken); color: var(--ink); }
  .pop button.on { color: var(--accent); }
  .name { flex: 1; font-size: 13.5px; color: var(--ink-2); min-width: 0; }
  .name:focus { color: var(--ink); }
  .needs { font-size: 12.5px; color: var(--warn); white-space: nowrap; }
  .rm { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; color: var(--ink-3); opacity: 0; transition: opacity 0.12s; }
  .q:hover .rm, .rm:focus-visible { opacity: 1; }
  .rm:hover { background: var(--sunken); color: var(--bad); }
  .ask { font-size: 16px; line-height: 1.5; font-weight: 500; padding: 4px 0 2px; max-height: 30vh; overflow: auto; }
  .list { display: flex; flex-direction: column; gap: 2px; margin-top: 10px; }
  .opt { display: flex; align-items: center; gap: 10px; padding: 3px 0; border-bottom: 1px solid var(--line); }
  .opt:last-of-type { border-bottom: 0; }
  .k { flex: 0 0 34%; font-size: 13.5px; font-weight: 500; }
  .d { flex: 1; color: var(--ink-2); font-size: 14px; }
  .n { flex: 0 0 18px; color: var(--ink-3); font-size: 12.5px; text-align: right; font-variant-numeric: tabular-nums; }
  .opt button { width: 24px; height: 24px; display: grid; place-items: center; border-radius: 7px; color: var(--ink-3); opacity: 0; }
  .opt:hover button, .opt button:focus-visible { opacity: 1; }
  .opt button:hover { background: var(--sunken); color: var(--bad); }
  .more { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; padding: 4px 8px 4px 4px; font-size: 13px; color: var(--ink-3); border-radius: 8px; }
  .more:hover { color: var(--accent); background: var(--accent-soft); }
  .seg { display: inline-flex; margin-top: 10px; padding: 3px; border-radius: 10px; background: var(--sunken); }
  .seg button { padding: 4px 14px; border-radius: 8px; font-size: 13px; color: var(--ink-2); }
  .seg button.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgb(0 0 0 / 0.08); font-weight: 600; }
  .ans { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); transition: opacity 0.2s; }
  .ans.stale { opacity: 0.45; }
  @media (hover: none) { .rm, .opt button { opacity: 1; } }
</style>
