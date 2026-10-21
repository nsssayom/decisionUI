export type Lang = 'curl' | 'python' | 'js';
const ELIDE = 3000;

function slim(req: Record<string, any>): { out: Record<string, any>; elided: boolean } {
  let elided = false;
  const cut = (s: unknown) => (typeof s === 'string' && s.startsWith('data:') && s.length > ELIDE ? ((elided = true), `${s.slice(0, s.indexOf(',') + 1)}<base64>`) : s);
  const out = JSON.parse(JSON.stringify(req));
  for (const k of ['images', 'videos']) if (out[k]) out[k] = out[k].map(cut);
  if (out.assets) out.assets = Object.fromEntries(Object.entries(out.assets).map(([k, v]) => [k, cut(v)]));
  return { out, elided };
}

export function snippet(lang: Lang, req: Record<string, unknown>, baseUrl: string): string {
  const { out, elided } = slim(req);
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/systemone`;
  const note = elided ? 'media is shortened here; send the full data: URL (or an http(s) URL)' : '';
  const json = JSON.stringify(out, null, 2);
  if (lang === 'python') {
    const body = json.replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None');
    return `${note ? `# ${note}\n` : ''}import json, os, urllib.request

body = ${body}
req = urllib.request.Request(
    "${url}",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json", "Authorization": "Bearer " + os.environ["API_KEY"]},
)
print(json.dumps(json.load(urllib.request.urlopen(req)), indent=2))`;
  }
  if (lang === 'js') {
    return `${note ? `// ${note}\n` : ''}const res = await fetch("${url}", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: \`Bearer \${process.env.API_KEY}\` },
  body: JSON.stringify(${json.replace(/\n/g, '\n  ')}),
});
console.log(await res.json());`;
  }
  return `${note ? `# ${note}\n` : ''}curl -s ${url} \\
  -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \\
  -d '${JSON.stringify(out).replace(/'/g, `'\\''`)}'`;
}
