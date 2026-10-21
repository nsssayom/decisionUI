#!/usr/bin/env python3
"""A tiny mock of the System One API (GET /v1/models, POST /v1/systemone) for developing and testing decisionUI.
Answers every question type deterministically from a hash of the question, so the UI can be exercised without a model.
    python3 server/mock_systemone.py [--port 8999] [--key secret] [--cors]"""
import argparse, hashlib, json, math
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def rnd(*parts):
    h = hashlib.sha256("|".join(map(str, parts)).encode()).digest()
    return [b / 255 for b in h]


def softmax(xs):
    m = max(xs); e = [math.exp(3 * (x - m)) for x in xs]; t = sum(e)
    return [x / t for x in e]


def answer(name, q, req):
    r = rnd(name, q.get("instructions"), req.get("state"))
    t = q.get("type")
    if t == "choice":
        keys = list(q.get("criteria") or {}); p = softmax(r[:len(keys)])
        i = max(range(len(keys)), key=p.__getitem__)
        return {"type": "choice", "choice": keys[i], "probabilities": {k: round(v, 4) for k, v in zip(keys, p)},
                "confidence": round(p[i], 4)}
    if t == "noul":
        return {"type": "noul", "noul": round(r[0], 4)}
    if t == "score":
        lv = q.get("criteria") or []; p = softmax(r[:len(lv)])
        return {"type": "score", "score": round(sum(i * x for i, x in enumerate(p)), 4), "confidence": round(max(p), 4),
                "legend": {str(i): l for i, l in enumerate(lv)}, "probabilities": {str(i): round(x, 4) for i, x in enumerate(p)}}
    if t == "box":
        top, left = r[1] * .5, r[2] * .5
        return {"type": "box", "box": {"top": round(top, 3), "left": round(left, 3), "bottom": round(top + .25 + r[3] * .2, 3),
                                       "right": round(left + .25 + r[4] * .2, 3)}, "confidence": round(.6 + r[5] * .4, 3)}
    if t == "track":
        rate = q.get("rate", 1); out = []
        for k in range(int(5 * rate) + 1):
            tt = k / rate; x = .1 + .6 * tt / 5
            out.append({"time": round(tt, 2), "box": {"top": .3, "bottom": .5, "left": round(x, 3), "right": round(x + .2, 3)},
                        "confidence": .9, "visible": round(.95 - .1 * (k % 3), 2)})
        return {"type": "track", "track": out}
    raise ValueError(f"unknown question type {t!r}")


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _s(self, code, obj):
        d = json.dumps(obj).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(d)))
        if self.server.cors:
            self.send_header("Access-Control-Allow-Origin", "*"); self.send_header("Access-Control-Allow-Headers", "authorization,content-type")
        self.end_headers(); self.wfile.write(d)

    def _auth(self):
        k = self.server.key
        if k and self.headers.get("Authorization") != f"Bearer {k}":
            self._s(401, {"error": {"message": "invalid API key", "type": "authentication_error", "code": "invalid_api_key"}}); return False
        return True

    def do_OPTIONS(self): self._s(204, {})

    def do_GET(self):
        if self.path.startswith("/v1/models") and self._auth():
            self._s(200, {"object": "list", "data": [{"id": "mock-d3", "object": "model"}, {"id": "mock-d3-turbo", "object": "model"}]})
        elif self.path != "/v1/models":
            self._s(404, {"error": {"message": "not found"}})

    def do_POST(self):
        if self.path != "/v1/systemone" or not self._auth():
            return
        req = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        try:
            ans = {n: answer(n, q, req) for n, q in (req.get("questions") or {}).items()}
        except Exception as e:
            return self._s(400, {"error": {"message": str(e), "type": "invalid_request_error"}})
        self._s(200, {"answers": ans, "model": req.get("model"), "usage": {"input_tokens": len(json.dumps(req.get("state", ""))) // 4, "output_tokens": 0}})


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--port", type=int, default=8999); ap.add_argument("--key"); ap.add_argument("--cors", action="store_true")
    a = ap.parse_args(); s = ThreadingHTTPServer(("127.0.0.1", a.port), H); s.key, s.cors = a.key, a.cors
    print(f"mock System One on http://127.0.0.1:{a.port}", flush=True); s.serve_forever()
