<script lang="ts">
  import type { AnswerOk } from '../../lib/types';
  import { clamp } from '../../lib/util';
  let { src, track }: { src: string; track: Extract<AnswerOk, { type: 'track' }>['track'] } = $props();
  let video: HTMLVideoElement;
  let cv: HTMLCanvasElement;
  let raf = 0;

  function paint() {
    if (!video || !cv) return;
    cv.width = video.videoWidth || 640;
    cv.height = video.videoHeight || 360;
    const g = cv.getContext('2d')!;
    let cur: (typeof track)[number] | null = null;
    for (const e of track) if (e.time <= video.currentTime + 1e-6) cur = e;
    if (!cur?.box) return;
    const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5b5bf0';
    const b = cur.box;
    g.lineWidth = Math.max(3, cv.width / 180);
    g.strokeStyle = c;
    g.fillStyle = c + '22';
    const x = b.left * cv.width, y = b.top * cv.height, w = (b.right - b.left) * cv.width, h = (b.bottom - b.top) * cv.height;
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
  }
  const loop = () => { paint(); raf = requestAnimationFrame(loop); };
  $effect(() => () => cancelAnimationFrame(raf));
</script>

<div class="stage">
  <video bind:this={video} {src} controls muted playsinline
    onplay={() => { cancelAnimationFrame(raf); loop(); }} onpause={() => { cancelAnimationFrame(raf); paint(); }}
    onseeked={paint} onloadeddata={paint}></video>
  <canvas bind:this={cv}></canvas>
</div>
<div class="line" aria-hidden="true">
  {#each track as e}<i style:height="{clamp((e.visible ?? 1) * 100, 6, 100)}%" title="{e.time}s"></i>{/each}
</div>

<style>
  .stage { position: relative; display: inline-block; max-width: 100%; border-radius: 12px; overflow: hidden; line-height: 0; background: #000; }
  video { max-width: 100%; max-height: 320px; display: block; }
  canvas { position: absolute; inset: 0 0 44px 0; width: 100%; height: calc(100% - 44px); pointer-events: none; }
  .line { display: flex; align-items: flex-end; gap: 3px; height: 30px; margin-top: 10px; }
  .line i { flex: 1; background: var(--accent); opacity: 0.7; border-radius: 3px; min-width: 2px; }
</style>
