<script lang="ts">
  import type { AnswerError } from '../lib/types';
  import Icon from './Icon.svelte';
  let { a }: { a: AnswerError } = $props();
  const text = $derived(
    a.error === 'max_length_exceeded' ? 'Too long for this model.' : a.error === 'invalid_model_output' ? 'The model gave no usable answer.' : a.message || a.error.replace(/_/g, ' '),
  );
</script>

<p role="alert"><Icon name="x" size={15} />{text}</p>

<style>
  p { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--bad); font-size: 14px; }
</style>
