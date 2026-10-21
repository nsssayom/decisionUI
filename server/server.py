#!/usr/bin/env python3
"""decisionUI server — serves the web app and (optionally) proxies System One requests to configured endpoints.

    python3 server.py [--host 127.0.0.1] [--port 8890]
                      [--endpoint NAME=URL ...] [--key NAME=SECRET | NAME=@/path/to/keyfile ...]

Standard library only. The browser never sees proxied endpoints' API keys; endpoints given here are the only
ones the proxy will talk to (no open relay). The app can also call any CORS-enabled endpoint directly from the
browser (added in its Endpoints dialog); then this server only hosts the static files.

  GET  /                       the app
  GET  /api/endpoints          [{name, url, key: bool}] configured for proxying
  *    /proxy/<name>/<path>    forwarded to <url>/<path> with the endpoint's key (GET /v1/models, POST /v1/systemone, ...)
  GET  /api/tools              {convert, search, read}: which context tools are available
  POST /tools/convert          raw file bytes (X-Filename, Content-Type) → {text, parts}; --docs converter, or built-in for text
  GET  /tools/search?q=&n=     web search through --search (a SearXNG base URL) → [{title, url, snippet}]
  GET  /tools/read?url=        fetch a public web page / file and convert it to text (private addresses are refused)
  GET  /health                 liveness
  GET/POST/DELETE /api/history[/<id>]   past questions and answers, kept in SQLite (--db)

--docs URL [--docs-key KEY|@FILE]   a document converter speaking `PUT /process` (raw bytes + X-Filename → [{page_content}])
--search URL                        a SearXNG instance with the JSON format enabled
--db FILE                           history database (default ~/.local/share/decisionui/history.db; `--db ''` turns history off)
"""
import argparse, html.parser, ipaddress, json, mimetypes, os, socket, sqlite3, sys, threading, time, urllib.error, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

WEB = Path(os.environ.get("DECISIONUI_DIST") or Path(__file__).resolve().parent.parent / "dist")
MAX_BODY = 256 * 2**20                  # videos arrive as base64 data URLs
ALLOWED_PATHS = ("v1/systemone", "v1/models", "health")
CSP = ("default-src 'self'; img-src 'self' data: blob: https: http:; media-src 'self' blob: data: https: http:; "
       "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http: https:; frame-ancestors 'none'; "
       "base-uri 'none'; form-action 'none'")
ENDPOINTS = {}                           # name -> {"url": str, "key": str|None}
TOOLS = {"docs": None, "docs_key": None, "search": None}
LOCKS = {}
HISTORY = {"db": None}                   # path of the SQLite file, or None when history is off
HISTORY_KEEP = 500                       # newest rows kept
MAX_ROW = 64 * 2**20
TEXT_TYPES = ("text/", "application/json", "application/xml", "application/x-yaml", "application/toml",
              "application/javascript", "application/x-sh")
TEXT_EXT = {".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".jsonl", ".yaml", ".yml", ".toml", ".xml", ".log", ".ini",
            ".py", ".js", ".ts", ".tsx", ".jsx", ".c", ".h", ".cpp", ".go", ".rs", ".java", ".sh", ".sql", ".html", ".css", ".rst"}
MAX_FILE = 64 * 2**20


class _Text(html.parser.HTMLParser):
    """Minimal readable-text extractor for the no-converter fallback."""
    SKIP = {"script", "style", "noscript", "svg", "head", "template"}
    BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "pre", "table"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self.skip += 1
        elif tag in self.BLOCK:
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        elif tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)


def html_to_text(raw):
    p = _Text(); p.feed(raw)
    lines = [" ".join(l.split()) for l in "".join(p.out).splitlines()]
    out, blank = [], 0
    for l in lines:
        blank = 0 if l else blank + 1
        if l or blank == 1:
            out.append(l)
    return "\n".join(out).strip()


def public_host(host):
    """True when every address the host resolves to is public (no loopback / private / link-local / reserved)."""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    for *_, sa in infos:
        ip = ipaddress.ip_address(sa[0].split("%")[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            return False
    return bool(infos)


class _SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        u = urlsplit(newurl)
        if u.scheme not in ("http", "https") or not public_host(u.hostname or ""):
            raise urllib.error.URLError("redirect to a non-public address refused")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_public(url, limit=MAX_FILE, timeout=25):
    u = urlsplit(url)
    if u.scheme not in ("http", "https") or not u.hostname or not public_host(u.hostname):
        raise ValueError("only public http(s) URLs can be read")
    opener = urllib.request.build_opener(_SafeRedirect)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (decisionUI)", "Accept": "*/*"})
    with opener.open(req, timeout=timeout) as r:
        data = r.read(limit + 1)
        if len(data) > limit:
            raise ValueError("file too large")
        return data, (r.headers.get_content_type() or "application/octet-stream"), (r.headers.get_content_charset() or "utf-8")


def convert_bytes(data, name, mime):
    """bytes → {"text", "parts"} via the --docs converter; text-like files and HTML are handled without it."""
    ext = os.path.splitext(name)[1].lower()
    texty = mime.startswith(TEXT_TYPES) or ext in TEXT_EXT
    if TOOLS["docs"] and not (texty and ext != ".html" and mime != "text/html"):
        req = urllib.request.Request(TOOLS["docs"].rstrip("/") + "/process", data=data, method="PUT",
                                     headers={"Content-Type": mime or "application/octet-stream", "X-Filename": quote(name)})
        if TOOLS["docs_key"]:
            req.add_header("Authorization", f"Bearer {TOOLS['docs_key']}")
        with urllib.request.urlopen(req, timeout=900) as r:
            parts = json.loads(r.read())
        return {"text": "\n\n".join(p.get("page_content", "") for p in parts).strip(), "parts": len(parts)}
    if mime == "text/html" or ext in (".html", ".htm"):
        return {"text": html_to_text(data.decode("utf-8", "replace")), "parts": 1}
    if texty:
        return {"text": data.decode("utf-8", "replace"), "parts": 1}
    raise ValueError(f"no document converter is configured for {mime or ext or 'this file type'} (start the server with --docs URL)")


def load_key(spec):
    if spec and spec.startswith("@"):
        return Path(spec[1:]).expanduser().read_text().strip()
    return spec


def db():
    """One short-lived connection per call: the server is threaded and SQLite connections are not shared."""
    path = Path(HISTORY["db"])
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("""CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER NOT NULL, endpoint TEXT, model TEXT, ms INTEGER,
        title TEXT, brief TEXT, media_cut INTEGER DEFAULT 0, request TEXT NOT NULL, response TEXT NOT NULL)""")
    return con


def history_list(q=""):
    with db() as con:
        like = f"%{q.replace('%', '').replace('_', '')}%"
        rows = con.execute("SELECT id, t, endpoint, model, ms, title, brief, media_cut FROM runs "
                           "WHERE ?='%%' OR title LIKE ? OR brief LIKE ? ORDER BY t DESC, id DESC LIMIT 200", (like, like, like)).fetchall()
    con.close()
    return [dict(r) for r in rows]


def history_get(rid):
    with db() as con:
        r = con.execute("SELECT * FROM runs WHERE id=?", (rid,)).fetchone()
    con.close()
    if not r:
        return None
    d = dict(r)
    d["request"], d["response"] = json.loads(d["request"]), json.loads(d["response"])
    return d


def history_add(d):
    req, resp = d.get("request"), d.get("response")
    if not isinstance(req, dict) or not isinstance(resp, dict):
        raise ValueError("request and response must be objects")
    with db() as con:
        cur = con.execute("INSERT INTO runs (t, endpoint, model, ms, title, brief, media_cut, request, response) VALUES (?,?,?,?,?,?,?,?,?)",
                          (int(d.get("t") or time.time() * 1000), str(d.get("endpoint") or "")[:200], str(d.get("model") or "")[:200],
                           int(d.get("ms") or 0), str(d.get("title") or "")[:300], str(d.get("brief") or "")[:300], int(bool(d.get("mediaCut"))),
                           json.dumps(req), json.dumps(resp)))
        con.execute("DELETE FROM runs WHERE id NOT IN (SELECT id FROM runs ORDER BY t DESC, id DESC LIMIT ?)", (HISTORY_KEEP,))
        rid = cur.lastrowid
    con.close()
    return rid


def history_delete(rid=None):
    con = db()
    with con:
        con.execute("DELETE FROM runs WHERE id=?", (rid,)) if rid is not None else con.execute("DELETE FROM runs")
    if rid is None:
        con.execute("VACUUM")                     # give the space of a cleared history back
    con.close()


class Handler(BaseHTTPRequestHandler):
    server_version = "decisionui"
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    # -- helpers
    def _send(self, code, body=b"", ctype="application/json", extra=None):
        data = body if isinstance(body, bytes) else body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", CSP)
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _err(self, code, msg):
        self.close_connection = True            # the request body may be unread
        self._send(code, json.dumps({"error": {"message": msg}}))

    def _same_site(self):
        """Loopback host + no foreign Origin: blocks DNS rebinding and cross-site requests against proxied keys."""
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
        origin = self.headers.get("Origin")
        ok_host = host in ("127.0.0.1", "localhost", "::1") or self.server.allow_any_host
        return ok_host and (origin is None or urlsplit(origin).hostname == host)

    # -- routes
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, '{"ok":true}')
        if not self._same_site():
            return self._err(403, "forbidden")
        path = urlsplit(self.path).path
        if path == "/api/tools":
            return self._send(200, json.dumps({"convert": True, "convertAll": bool(TOOLS["docs"]), "search": bool(TOOLS["search"]), "read": True, "history": bool(HISTORY["db"])}))
        if path == "/tools/search":
            return self._search(parts_q=urlsplit(self.path).query)
        if path == "/tools/read":
            return self._read(urlsplit(self.path).query)
        if path == "/api/endpoints":
            return self._send(200, json.dumps([{"name": n, "url": e["url"], "key": bool(e["key"])} for n, e in ENDPOINTS.items()]))
        if path.startswith("/proxy/"):
            return self._proxy("GET")
        if path.startswith("/api/history"):
            return self._history("GET", path)
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        f = (WEB / rel).resolve()
        if WEB not in f.parents or not f.is_file():
            return self._err(404, "not found")
        ctype = mimetypes.guess_type(f.name)[0] or "application/octet-stream"
        if f.suffix == ".js":
            ctype = "text/javascript"
        self._send(200, f.read_bytes(), ctype + ("; charset=utf-8" if ctype.startswith("text/") else ""))

    def do_POST(self):
        if not self._same_site():
            return self._err(403, "forbidden")
        if urlsplit(self.path).path == "/tools/convert":
            return self._convert()
        if urlsplit(self.path).path.startswith("/proxy/"):
            return self._proxy("POST")
        if urlsplit(self.path).path == "/api/history":
            return self._history("POST", "/api/history")
        self._err(404, "not found")

    def do_DELETE(self):
        if not self._same_site():
            return self._err(403, "forbidden")
        path = urlsplit(self.path).path
        if path.startswith("/api/history"):
            return self._history("DELETE", path)
        self._err(404, "not found")

    def _history(self, method, path):
        if not HISTORY["db"]:
            return self._err(501, "history is off (start the server with --db FILE)")
        rid = path[len("/api/history"):].strip("/")
        if rid and not rid.isdigit():
            return self._err(404, "not found")
        try:
            if method == "GET" and not rid:
                from urllib.parse import parse_qs
                return self._send(200, json.dumps(history_list((parse_qs(urlsplit(self.path).query).get("q") or [""])[0].strip())))
            if method == "GET":
                row = history_get(int(rid))
                return self._send(200, json.dumps(row)) if row else self._err(404, "not found")
            if method == "POST":
                n = int(self.headers.get("Content-Length") or 0)
                if n <= 0 or n > MAX_ROW:
                    return self._err(413, "bad body size")
                return self._send(200, json.dumps({"id": history_add(json.loads(self.rfile.read(n)))}))
            history_delete(int(rid) if rid else None)
            return self._send(200, '{"ok":true}')
        except (ValueError, json.JSONDecodeError) as e:
            return self._err(400, str(e))
        except sqlite3.Error as e:
            return self._err(500, f"history database error: {e}")

    def _convert(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_FILE:
            return self._err(413, "bad file size")
        data = self.rfile.read(n)
        name = unquote(self.headers.get("X-Filename") or "upload")
        mime = (self.headers.get("Content-Type") or "").split(";")[0]
        try:
            return self._send(200, json.dumps(convert_bytes(data, name, mime)))
        except ValueError as e:
            return self._err(415, str(e))
        except urllib.error.HTTPError as e:
            try:
                body = json.loads(e.read())
                msg = body.get("error") if isinstance(body, dict) else None
                msg = msg.get("message") if isinstance(msg, dict) else msg
            except Exception:
                msg = None
            return self._err(422 if e.code == 422 else 502, msg or f"conversion failed (HTTP {e.code})")
        except Exception as e:
            return self._err(502, f"conversion failed: {e}")

    def _search(self, parts_q):
        from urllib.parse import parse_qs
        q = (parse_qs(parts_q).get("q") or [""])[0].strip()
        n = min(int((parse_qs(parts_q).get("n") or ["8"])[0]), 20)
        if not TOOLS["search"]:
            return self._err(501, "web search is not configured (start the server with --search URL)")
        if not q:
            return self._err(400, "empty query")
        try:
            with urllib.request.urlopen(f"{TOOLS['search'].rstrip('/')}/search?format=json&q={quote(q)}", timeout=20) as r:
                res = json.loads(r.read()).get("results", [])
        except Exception as e:
            return self._err(502, f"search failed: {e}")
        seen, out = set(), []
        for it in res:
            u = it.get("url")
            if u and u not in seen:
                seen.add(u); out.append({"title": it.get("title") or u, "url": u, "snippet": it.get("content") or "", "engine": it.get("engine")})
            if len(out) >= n:
                break
        return self._send(200, json.dumps(out))

    def _read(self, query):
        from urllib.parse import parse_qs
        url = (parse_qs(query).get("url") or [""])[0].strip()
        try:
            data, mime, _ = fetch_public(url)
            name = os.path.basename(urlsplit(url).path) or "page.html"
            if mime == "text/html" and "." not in name:
                name += ".html"
            res = convert_bytes(data, name, mime)
            return self._send(200, json.dumps({**res, "title": name, "mime": mime, "url": url}))
        except ValueError as e:
            return self._err(400 if "public" in str(e) or "large" in str(e) else 415, str(e))
        except Exception as e:
            return self._err(502, f"could not read the page: {e}")

    def _proxy(self, method):
        parts = urlsplit(self.path)
        _, _, name, *rest = parts.path.split("/", 3)
        sub = (rest[0] if rest else "").strip("/")
        ep = ENDPOINTS.get(name)
        if not ep:
            return self._err(404, f"unknown endpoint '{name}'")
        if sub not in ALLOWED_PATHS:
            return self._err(404, "path not proxied")
        body = None
        if method == "POST":
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > MAX_BODY:
                return self._err(413, "bad body size")
            body = self.rfile.read(n)
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if ep["key"]:
            headers["Authorization"] = f"Bearer {ep['key']}"
        req = urllib.request.Request(f"{ep['url']}/{sub}" + (f"?{parts.query}" if parts.query else ""), data=body,
                                     headers=headers, method=method)
        lock = LOCKS.setdefault(name, threading.Lock())      # most local model servers answer one request at a time
        with lock:
            try:
                with urllib.request.urlopen(req, timeout=900) as r:
                    return self._send(r.status, r.read())
            except urllib.error.HTTPError as e:
                return self._send(e.code, e.read() or b"{}")
            except Exception as e:
                return self._err(502, f"endpoint '{name}' unreachable: {e}")


class Server(ThreadingHTTPServer):
    allow_any_host = False
    daemon_threads = True


def main(argv=None):
    ap = argparse.ArgumentParser(description="decisionUI — web UI for System One decision models")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8890)
    ap.add_argument("--endpoint", action="append", default=[], metavar="NAME=URL", help="endpoint to proxy (repeatable)")
    ap.add_argument("--key", action="append", default=[], metavar="NAME=KEY|@FILE", help="API key for an endpoint")
    ap.add_argument("--docs", metavar="URL", help="document converter base URL (PUT /process)")
    ap.add_argument("--docs-key", metavar="KEY|@FILE", help="bearer token for the converter")
    ap.add_argument("--search", metavar="URL", help="SearXNG base URL (JSON format enabled)")
    ap.add_argument("--db", default=os.environ.get("DECISIONUI_DB", str(Path.home() / ".local/share/decisionui/history.db")),
                    metavar="FILE", help="history database ('' turns history off)")
    ap.add_argument("--allow-any-host", action="store_true", help="accept non-loopback Host headers (when you bind a LAN address)")
    a = ap.parse_args(argv)
    keys = dict(k.split("=", 1) for k in a.key)
    for e in a.endpoint:
        name, url = e.split("=", 1)
        ENDPOINTS[name] = {"url": url.rstrip("/"), "key": load_key(keys.get(name))}
    HISTORY["db"] = a.db or None
    TOOLS.update(docs=a.docs, docs_key=load_key(a.docs_key), search=a.search)
    srv = Server((a.host, a.port), Handler)
    srv.allow_any_host = a.allow_any_host
    print(f"decisionUI on http://{a.host}:{a.port}  endpoints: {', '.join(ENDPOINTS) or 'none (direct mode only)'}"
          f" · convert: {'docs' if TOOLS['docs'] else 'text only'} · search: {'on' if TOOLS['search'] else 'off'}"
          f" · history: {HISTORY['db'] or 'off'}", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    sys.exit(main())
