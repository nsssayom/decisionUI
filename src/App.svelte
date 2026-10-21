<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/app.svelte';
  import { CORE, EXT, QLABEL } from './lib/types';
  import Header from './components/Header.svelte';
  import InputCard from './components/InputCard.svelte';
  import QuestionCard from './components/QuestionCard.svelte';
  import RunBar from './components/RunBar.svelte';
  import Drawer from './components/Drawer.svelte';
  import Icon from './components/Icon.svelte';

  onMount(() => void app.init());

  // persist the document (media excluded) whenever anything that is saved changes
  $effect(() => {
    JSON.stringify([app.doc.state, app.doc.stateMode, app.doc.questions, app.doc.contexts.map((c) => c.id), app.doc.extra]);
    app.persist();
  });

  function onkey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void app.run();
    }
  }
</script>

<svelte:window onkeydown={onkey} />

<Header />

<main>
  <InputCard />

  <section class="questions" aria-label="Questions">
    {#each app.doc.questions as q (q.id)}
      <QuestionCard {q} />
    {/each}
  </section>

  <div class="add" role="group" aria-label="Add a question">
    {#each app.caps.ext ? [...CORE, ...EXT] : CORE as t}
      <button onclick={() => app.addQuestion(t)}><Icon name={t} size={15} />{QLABEL[t]}</button>
    {/each}
  </div>
</main>

<RunBar />
<Drawer />

{#if app.toastText}
  <div class="toast" role="status">{app.toastText}</div>
{/if}

<style>
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 20px 20px 150px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .questions { display: flex; flex-direction: column; gap: 14px; }
  .add { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding-top: 4px; }
  .add button {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 13px; border-radius: 99px; color: var(--ink-2);
    border: 1px solid var(--line); background: var(--surface); font-size: 13.5px;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .add button:hover { border-color: var(--line-strong); color: var(--ink); background: var(--sunken); }
  .toast {
    position: fixed; left: 50%; top: 68px; transform: translateX(-50%); z-index: 60;
    background: var(--ink); color: var(--bg); padding: 8px 16px; border-radius: 99px; font-size: 13.5px; box-shadow: var(--shadow-pop);
    max-width: calc(100vw - 32px);
  }
</style>
