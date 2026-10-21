<script lang="ts">
  export type IconName =
    | 'attach' | 'globe' | 'braces' | 'sun' | 'moon' | 'plus' | 'x' | 'tag' | 'check' | 'chevron' | 'search' | 'link'
    | 'copy' | 'trash' | 'choice' | 'noul' | 'score' | 'box' | 'track' | 'file' | 'play' | 'stop' | 'arrow' | 'history';
  let { name, size = 18 }: { name: IconName; size?: number } = $props();

  // 24×24 stroke icons
  const P: Record<IconName, string> = {
    attach: 'M21 11.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l8.6-8.6a3.7 3.7 0 015.2 5.2l-8.6 8.6a1.8 1.8 0 01-2.6-2.6l7.9-7.9',
    globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z',
    braces: 'M8 4C6 4 5 5 5 7v2c0 1.2-.7 2.3-2 3 1.3.7 2 1.8 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.2.7 2.3 2 3-1.3.7-2 1.8-2 3v2c0 2-1 3-3 3',
    sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    moon: 'M20.5 14.5A8.5 8.5 0 119.5 3.5a7 7 0 0011 11z',
    plus: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6L6 18',
    tag: 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    chevron: 'M6 9l6 6 6-6',
    search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-4.3-4.3',
    link: 'M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1',
    copy: 'M9 9h10v10H9zM5 15V5h10',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    choice: 'M5 7h14M5 12h14M5 17h9',
    noul: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 3v18',
    score: 'M5 20v-5M10 20V9M15 20v-8M20 20V4',
    box: 'M5 5h14v14H5z',
    track: 'M4 17c3-9 6 3 9-6s4-3 7-5M20 6h.01',
    file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5',
    play: 'M7 4.5v15l12-7.5z',
    stop: 'M6 6h12v12H6z',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    history: 'M12 7v5l3.5 2M3.5 12a8.5 8.5 0 108.5-8.5A8.4 8.4 0 005.8 6M3.5 4v3.5H7',
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={P[name]} stroke-dasharray={name === 'box' ? '3 2.6' : undefined} />
</svg>
