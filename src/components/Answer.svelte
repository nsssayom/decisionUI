<script lang="ts">
  import { isError, type Answer } from '../lib/types';
  import { app } from '../lib/app.svelte';
  import Choice from './views/Choice.svelte';
  import YesNo from './views/YesNo.svelte';
  import Score from './views/Score.svelte';
  import Overlay from './views/Overlay.svelte';
  import Track from './views/Track.svelte';
  import ErrorRow from './ErrorRow.svelte';
  import { pct } from '../lib/util';

  let { answer }: { answer: Answer } = $props();
  const image = $derived(app.doc.media.find((m) => m.kind === 'image')?.src);
  const video = $derived(app.doc.media.find((m) => m.kind === 'video')?.src);
</script>

{#if isError(answer)}
  <ErrorRow a={answer} />
{:else if answer.type === 'choice'}
  <Choice a={answer} />
{:else if answer.type === 'noul'}
  <YesNo p={answer.noul} />
{:else if answer.type === 'score'}
  <Score a={answer} />
{:else if answer.type === 'box'}
  <!-- a box is always returned; a low confidence means the target is probably not there -->
  {#if answer.box && image}
    {@const unlikely = (answer.confidence ?? 1) < 0.3}
    <Overlay src={image} box={answer.box} label={pct(answer.confidence ?? 1)} faint={unlikely} />
    {#if unlikely}<p class="none">Probably not in the image</p>{/if}
  {:else}
    <p class="none">{answer.box ? 'Add an image to see the box' : 'Probably not in the image'}</p>
  {/if}
{:else if answer.type === 'track'}
  {#if video}<Track src={video} track={answer.track} />{:else}<p class="none">Add a video to see the track</p>{/if}
{:else}
  <pre>{JSON.stringify(answer, null, 2)}</pre>
{/if}

<style>
  .none { margin: 8px 0 0; color: var(--ink-3); font-size: 14px; }
  pre { margin: 0; font: 12.5px/1.5 var(--mono); overflow: auto; }
</style>
