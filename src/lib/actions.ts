/** Grow a textarea with its content. Pass the bound value so programmatic changes refit it too. */
export function autosize(node: HTMLTextAreaElement, _value?: unknown) {
  const fit = () => {
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  };
  node.addEventListener('input', fit);
  const ro = new ResizeObserver(fit);
  ro.observe(node);
  queueMicrotask(fit);
  return {
    update: () => queueMicrotask(fit),
    destroy: () => {
      node.removeEventListener('input', fit);
      ro.disconnect();
    },
  };
}

export function clickOutside(node: HTMLElement, handler: () => void) {
  const on = (e: MouseEvent) => {
    if (!node.contains(e.target as Node)) handler();
  };
  const esc = (e: KeyboardEvent) => e.key === 'Escape' && handler();
  document.addEventListener('mousedown', on, true);
  document.addEventListener('keydown', esc);
  return {
    destroy: () => {
      document.removeEventListener('mousedown', on, true);
      document.removeEventListener('keydown', esc);
    },
  };
}
