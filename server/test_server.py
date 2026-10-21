"""Server tests: static files, proxy, key isolation, SSRF guard, converters, origin checks.
Run: python3 -m unittest discover -s server"""
import json, os, sys, tempfile, threading, unittest, urllib.error, urllib.request
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.dirname(__file__))
import server, mock_systemone


def serve(handler, **attrs):
    s = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    for k, v in attrs.items():
        setattr(s, k, v)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def call(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dist = Path(tempfile.mkdtemp())
        (dist / "assets").mkdir()
        (dist / "index.html").write_text("<!doctype html><title>decisionUI</title>")
        (dist / "assets" / "app.js").write_text("console.log(1)")
        server.WEB = dist.resolve()
        cls.mock = serve(mock_systemone.H, key="sekret", cors=False)
        server.ENDPOINTS["m"] = {"url": f"http://127.0.0.1:{cls.mock.server_port}", "key": "sekret"}
        server.TOOLS.update(docs=None, docs_key=None, search=None)
        cls.srv = serve(server.Handler, allow_any_host=False)
        cls.base = f"http://127.0.0.1:{cls.srv.server_port}"

    def test_static_and_headers(self):
        st, body, h = call(self.base + "/")
        self.assertEqual(st, 200); self.assertIn(b"decisionUI", body)
        self.assertIn("default-src 'self'", h["Content-Security-Policy"])
        self.assertEqual(call(self.base + "/assets/app.js")[0], 200)
        self.assertEqual(call(self.base + "/../server.py")[0], 404)       # no path traversal
        self.assertEqual(call(self.base + "/%2e%2e/server.py")[0], 404)

    def test_proxy_adds_key_and_hides_it(self):
        st, body, _ = call(self.base + "/proxy/m/v1/models")
        self.assertEqual(st, 200); self.assertIn(b"mock-d3", body)
        st, body, _ = call(self.base + "/api/endpoints")
        self.assertNotIn(b"sekret", body)
        req = {"model": "x", "state": "hello", "questions": {"q": {"type": "choice", "instructions": "?", "criteria": {"a": None, "b": None}}}}
        st, body, _ = call(self.base + "/proxy/m/v1/systemone", json.dumps(req).encode(), {"Content-Type": "application/json"})
        self.assertEqual(st, 200); self.assertIn("choice", json.loads(body)["answers"]["q"])

    def test_proxy_is_not_an_open_relay(self):
        self.assertEqual(call(self.base + "/proxy/nope/v1/models")[0], 404)
        self.assertEqual(call(self.base + "/proxy/m/admin/api/models")[0], 404)         # only whitelisted paths

    def test_origin_checks(self):
        self.assertEqual(call(self.base + "/api/endpoints", headers={"Origin": "http://evil.example"})[0], 403)
        self.assertEqual(call(self.base + "/api/endpoints", headers={"Host": "evil.example"})[0], 403)
        self.assertEqual(call(self.base + "/proxy/m/v1/systemone", b"{}", {"Origin": "http://evil.example"})[0], 403)

    def test_ssrf_guard(self):
        for u in ("http://127.0.0.1:1/", "http://localhost/", "http://169.254.169.254/latest/meta-data", "http://10.0.0.1/", "file:///etc/passwd", "http://[::1]/"):
            st, body, _ = call(self.base + "/tools/read?url=" + urllib.request.quote(u, safe=""))
            self.assertEqual(st, 400, u)

    def test_convert_text_and_html_without_docs(self):
        st, body, _ = call(self.base + "/tools/convert", b"a,b\n1,2\n", {"X-Filename": "t.csv", "Content-Type": "text/csv"})
        self.assertEqual(json.loads(body)["text"], "a,b\n1,2\n")
        html = b"<html><head><style>x{}</style></head><body><h1>Title</h1><p>Hello <b>world</b></p><script>bad()</script></body></html>"
        st, body, _ = call(self.base + "/tools/convert", html, {"X-Filename": "p.html", "Content-Type": "text/html"})
        t = json.loads(body)["text"]
        self.assertIn("Title", t); self.assertIn("Hello world", t); self.assertNotIn("bad()", t)
        st, body, _ = call(self.base + "/tools/convert", b"%PDF-1.4", {"X-Filename": "a.pdf", "Content-Type": "application/pdf"})
        self.assertEqual(st, 415); self.assertIn("converter", json.loads(body)["error"]["message"])

    def test_search_not_configured(self):
        self.assertEqual(call(self.base + "/tools/search?q=x")[0], 501)

    def test_tools_with_fake_docs_and_search(self):
        class Docs(mock_systemone.H):
            def do_PUT(s):
                n = int(s.headers["Content-Length"]); s.rfile.read(n)
                assert s.headers["X-Filename"] == "r.pdf" and s.headers["Authorization"] == "Bearer dk"
                s._s(200, [{"page_content": "page one"}, {"page_content": "page two"}])
        class Search(mock_systemone.H):
            def do_GET(s):
                s._s(200, {"results": [{"title": "T", "url": "https://a.example/x", "content": "snip"}, {"title": "dup", "url": "https://a.example/x"}]})
        d, sr = serve(Docs, key=None, cors=False), serve(Search, key=None, cors=False)
        server.TOOLS.update(docs=f"http://127.0.0.1:{d.server_port}", docs_key="dk", search=f"http://127.0.0.1:{sr.server_port}")
        try:
            st, body, _ = call(self.base + "/tools/convert", b"%PDF", {"X-Filename": "r.pdf", "Content-Type": "application/pdf"})
            self.assertEqual(json.loads(body), {"text": "page one\n\npage two", "parts": 2})
            st, body, _ = call(self.base + "/tools/search?q=hello")
            self.assertEqual(json.loads(body), [{"title": "T", "url": "https://a.example/x", "snippet": "snip", "engine": None}])
        finally:
            server.TOOLS.update(docs=None, docs_key=None, search=None)


if __name__ == "__main__":
    unittest.main()
