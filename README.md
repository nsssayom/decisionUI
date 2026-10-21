<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/logo-wordmark-dark.svg">
    <img src="docs/logo-wordmark.svg" height="56" alt="decisionUI">
  </picture>
</p>

<p align="center">A web UI for <a href="https://github.com/vllm-project/semantic-router">System One</a> decision models.<br>Give it an input and some questions; get a probability for every option.</p>

<p align="center">
  <a href="https://github.com/nsssayom/decisionUI/actions/workflows/ci.yml"><img src="https://github.com/nsssayom/decisionUI/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT"></a>
</p>

<p align="center">
  <img src="docs/light.png" width="420" alt="decisionUI, light theme">
  <img src="docs/dark.png" width="420" alt="decisionUI, dark theme">
</p>

Decision models such as d3 don't chat. You send an input (text, JSON, images, video) and typed questions to `POST /v1/systemone`, and each question comes back with probabilities, with no generated text. decisionUI is a front end for that API. It works with any server that speaks it, such as [oMLX](https://github.com/jundot/omlx), the d3 reference server or Rapid-MLX.

## Features

- **Typed questions:** choice, yes / no and score, the System One standard. Answers show probabilities, and call out close calls, unsure answers and split scores.
- **Multimodal input:** text or JSON, images and video, when the model reads them.
- **Context:** attach files (PDF, Office, text, code) or search the web; the text goes into the input.
- **History:** every run is saved in SQLite and listed on the right. Click one to bring the question and answers back. The panel collapses by itself below 1100 px wide.
- **A clean page every visit:** the app opens blank; past work is in the history, not restored behind your back.
- **Any endpoint:** proxied by the bundled server (keys stay server-side), or called straight from the browser.
- **Nothing hidden:** the exact request as editable JSON, plus curl, Python and JavaScript snippets.
- **Extensions, opt-in:** box, track and tagged images, which only some models understand (see [Extensions](#extensions)).

## Quick start

Requirements: Node 20+ with [pnpm](https://pnpm.io), and Python 3 for the server (standard library only; CI runs 3.12).

```sh
git clone https://github.com/nsssayom/decisionUI.git
cd decisionUI
pnpm install
pnpm build

python3 server/server.py --endpoint local=http://127.0.0.1:8080 --key local=@/path/to/api.key
```

Open <http://127.0.0.1:8890>. The endpoint appears in the header menu once the server can reach it.

No model yet? `python3 server/mock_systemone.py` serves a fake System One API on `:8999`. Try the UI with `--endpoint mock=http://127.0.0.1:8999`.

## Connecting a model

| Server | Notes |
|---|---|
| [oMLX](https://github.com/jundot/omlx) | Serve a decision model such as `d3`, and pass its API key. It ignores extension fields silently, so leave Extensions off. |
| d3 reference server (`d3_server.py`, shipped with the weights) | Strict: unknown request fields get a 422. Reports modalities and limits in `/v1/models`. |
| Rapid-MLX | Strict. Videos are frame lists, which decisionUI does not send. |

Two ways to connect:

- **Through the server (recommended):** `--endpoint NAME=URL` with `--key NAME=KEY` or `NAME=@FILE`. The browser never sees the key, and only `/v1/systemone`, `/v1/models` and `/health` are forwarded.
- **From the browser:** header menu → *Endpoint*. The endpoint must allow CORS, and its key is kept in your browser's `localStorage`. Use this when you host `dist/` as plain static files.

## Configuration

Everything is a flag on `server/server.py`:

| Flag | Default | |
|---|---|---|
| `--endpoint NAME=URL` | none | System One endpoint to proxy. Repeatable. |
| `--key NAME=KEY` or `NAME=@FILE` | none | Bearer key for that endpoint. |
| `--docs URL`, `--docs-key KEY` | off | A document converter (`PUT /process`: raw bytes + `X-Filename` → `[{page_content}]`) for PDF, Office and more. Text, CSV, JSON and HTML work without it. |
| `--search URL` | off | A [SearXNG](https://github.com/searxng/searxng) instance with the JSON format enabled. Turns on web search. |
| `--db FILE` | `~/.local/share/decisionui/history.db` | History database. `--db ''` turns history off. |
| `--host`, `--port` | `127.0.0.1`, `8890` | Where to listen. |
| `--allow-any-host` | off | Accept non-loopback `Host` headers. Needed behind a reverse proxy or on a LAN address; see [Security](#security). |

Environment: `DECISIONUI_DB` sets the history file and `DECISIONUI_DIST` the folder of built files (default `./dist`).

Capabilities follow what is configured. Web search needs `--search` (reading a page by URL always works), more file types need `--docs`, and the history sidebar uses the server's database (without the server, the browser keeps the last 30 runs).

## Using it

1. **Input:** type, paste, or drop in text, JSON (the `{ }` button in the input), images, video and files.
2. **Questions:** pick a type and fill it in. Choice needs two or more options, score needs 2 to 10 levels, and yes / no can describe each side. The question text is optional.
3. **Decide** (`⌘↵` or `Ctrl+↵`). Each answer appears under its question.

| Type | Shows | Notes |
|---|---|---|
| choice | The most probable option and P(option) | "close call" when the top two are within 15 points |
| yes / no | P(yes) on a gauge | "Unsure" between 35% and 65% |
| score | The most likely level, and the expected value | The server's `score` is the mean over levels, not the top level. "split" when two distant levels are both likely |

`confidence` appears only in a tooltip. Its meaning differs by server (1 − normalized entropy on d3 and oMLX), and it is not the chance of being right.

The `{ }` button in the header opens the exact request as editable JSON, and snippets you can run. The clock button toggles the history.

### Extensions

Box (where is it in the image), track (follow it in a video), tagged images and long context come from d3-turbo and are not part of the core standard. Servers differ: oMLX **silently ignores** these fields, and strict servers answer **422**. So decisionUI never sends them unless you switch **Extensions** on for that endpoint (header menu). If a server rejects one, decisionUI turns Extensions off again and shows which question was refused.

## The API

```jsonc
POST /v1/systemone
{
  "model": "d3",
  "state": "The order arrived damaged and I have the receipt.",
  "questions": {
    "team":    { "type": "choice", "instructions": "Who handles this?", "criteria": { "returns": "Damaged goods", "billing": null } },
    "receipt": { "type": "noul",   "instructions": "Is there proof of purchase?" },
    "urgency": { "type": "score",  "instructions": "How urgent?", "criteria": ["low", "medium", "high"] }
  },
  "images": ["data:image/png;base64,..."]   // optional, when the model reads images
}
```

```jsonc
{
  "answers": {
    "team":    { "type": "choice", "choice": "returns", "probabilities": { "returns": 0.97, "billing": 0.03 }, "confidence": 0.9 },
    "receipt": { "type": "noul", "noul": 0.99 },                                  // P(yes)
    "urgency": { "type": "score", "score": 1.87, "probabilities": { "0": 0.01, "1": 0.2, "2": 0.77, "3": 0.02 }, "legend": { "0": "low", "1": "medium", "2": "high" } }
  }
}
```

A question the server can't answer comes back as `{ "type": "…", "error": "invalid_question" | "max_length_exceeded" | "invalid_model_output", "message": … }` inside a normal 200, and decisionUI shows it on that question. Request errors (4xx) are parsed down to the question that caused them.

## Deploying

- **Locally:** the quick start is enough. It listens on loopback only.
- **Static hosting:** upload `dist/` anywhere and add endpoints in the browser. There is no file conversion, web search or shared history.
- **Behind a reverse proxy or on a LAN:** run the server with `--allow-any-host`, and put an access check in front. decisionUI has no login, and the proxy can spend your model's key. Restrict it by network, or with an authenticating proxy.

## Development

```sh
pnpm install
pnpm dev                                    # app on :5173; /api, /proxy and /tools go to the server on :8890
python3 server/server.py --endpoint ...     # the server, in another terminal
python3 server/mock_systemone.py --cors     # a model-less System One API on :8999

pnpm check                                  # svelte-check, TypeScript
pnpm test                                   # unit tests (vitest)
python3 -m unittest discover -s server      # server tests
```

```
src/lib/          request building, answer types, API client, history
src/components/   the UI (Svelte 5)
server/           the optional Python server, and the mock model
docs/             screenshots and the logo
design/           logo sources (design/make_logo.py regenerates them)
```

Vite, Svelte 5 and TypeScript, with no runtime dependencies. CI runs the type check, the unit tests, the build and the server tests on every push.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Header dot is red, "unreachable" | The server can't reach the endpoint URL, or (direct mode) the browser can't, for example because of CORS. |
| "The endpoint needs a valid key." | `--key` is missing or wrong. |
| "Too long for this model" | The input times the number of questions exceeds the model's context. The run bar shows an estimate. |
| Box and track are missing | Extensions is off, by design. See [Extensions](#extensions). |
| A page shows another app at the same address | The browser cached an old page. Hard reload (⇧⌘R). |
| History is empty after a restart | The server was started with `--db ''`, or with a different `--db` path. |

## Security

- The server binds to loopback, refuses requests from other origins and hosts, and forwards only to the endpoints you configure, and only for `/v1/systemone`, `/v1/models` and `/health`.
- API keys given to the server never reach the browser. Keys entered in the browser stay in its `localStorage`.
- The page reader and web search refuse private and loopback addresses, including after redirects.
- There is no authentication. Don't expose it to an untrusted network (see [Deploying](#deploying)).
- History holds your inputs in plain text in the SQLite file. Delete the file, or use *Clear all*, to remove them.

## Contributing

Issues and pull requests are welcome. Please run `pnpm check`, `pnpm test` and the server tests first, and keep the UI minimal: every word and control should earn its place.

## License

[MIT](LICENSE)
