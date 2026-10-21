<script lang="ts">
  import type { Box } from '../../lib/types';
  let { src, box, label = '' }: { src: string; box: Box; label?: string } = $props();
  let img: HTMLImageElement;
  let cv: HTMLCanvasElement;

  function draw() {
    if (!img || !cv || !img.naturalWidth) return;
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const g = cv.getContext('2d')!;
    const w = cv.width;
    const x = box.left * w, y = box.top * cv.height, bw = (box.right - box.left) * w, bh = (box.bottom - box.top) * cv.height;
    const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5b5bf0';
    g.fillStyle = c + '22';
    g.fillRect(x, y, bw, bh);
    g.lineWidth = Math.max(3, w / 180);
    g.strokeStyle = c;
    g.strokeRect(x, y, bw, bh);
    if (label) {
      const fs = Math.max(13, w / 34);
      g.font = `600 ${fs}px -apple-system, system-ui, sans-serif`;
      const tw = g.measureText(label).width + 14, th = fs + 10;
      g.fillStyle = c;
      g.fillRect(x, Math.max(0, y - th), tw, th);
      g.fillStyle = '#fff';
      g.fillText(label, x + 7, Math.max(th - 8, y - 8));
    }
  }
  $effect(() => { box; label; src; draw(); });
</script>

<div class="stage">
  <img bind:this={img} {src} alt="" onload={draw} />
  <canvas bind:this={cv}></canvas>
</div>

<style>
  .stage { position: relative; display: inline-block; max-width: 100%; border-radius: 12px; overflow: hidden; line-height: 0; border: 1px solid var(--line); }
  img { max-width: 100%; max-height: 320px; display: block; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
</style>
