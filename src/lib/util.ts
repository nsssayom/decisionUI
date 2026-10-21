export const uid = (): string => Math.random().toString(36).slice(2, 9);
export const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
export const pct = (p: number): string => `${(p * 100).toFixed(p > 0 && p < 0.001 ? 2 : p >= 0.9995 ? 0 : 1)}%`;
export const isDataUrl = (s: unknown): s is string => typeof s === 'string' && s.startsWith('data:');

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function mediaKind(src: string, mime = ''): 'image' | 'video' {
  const m = mime || (isDataUrl(src) ? src.slice(5, src.indexOf(';')) : '');
  return m.startsWith('video') || /\.(mp4|webm|mov|mkv)(\?|$)/i.test(src) ? 'video' : 'image';
}

export function readDataURL(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms = 300): (...a: A) => void {
  let t: ReturnType<typeof setTimeout>;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function store(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
