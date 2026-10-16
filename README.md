<div align="center">

<img src="brand/logo.svg" alt="ptero-bulk-9router" width="460">

# ptero-bulk-9router

**Bulk-create [ptero.pro](https://ptero.pro/) anonymous accounts, auto-harvest their
tokens & session cookies, and serve them to [9Router](https://9router.com) as a
self-healing, load-balanced OpenAI-compatible pool.**

Zero dependencies · Node 18+ · MIT

[![License](https://img.shields.io/badge/license-MIT-19c37d?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-19c37d?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-19c37d?style=flat-square)](#)
[![9Router](https://img.shields.io/badge/9Router-openai--compatible-58a6ff?style=flat-square)](https://9router.com)
[![ptero.pro](https://img.shields.io/badge/ptero.pro-anonymous%20guest-19c37d?style=flat-square)](https://ptero.pro)
[![Models](https://img.shields.io/badge/models-6-d29922?style=flat-square)](#models)
[![Status](https://img.shields.io/badge/status-verified%20e2e-19c37d?style=flat-square)](#verified)

[English](README.md) · [Indonesia](README.id.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)

</div>

---

## What is this?

[ptero.pro](https://ptero.pro/) is a free, fully **anonymous** AI chat site. A "user" is
just a random 32-character hex token the browser generates locally — there is **no
signup, no email, no password**, and the token is not IP-bound. This toolkit:

1. **Bulk-creates** any number of ptero identities (pure HTTP, instant).
2. **Harvests** each token and the `mlp_ai_guest_token` session cookie.
3. **Pools** them into a self-healing, round-robin, failover adapter.
4. **Connects** that adapter to **9Router** as an OpenAI-compatible provider.

Each identity gets its own **1,000,000 tokens/hour** bucket, so pooling multiplies your
free throughput.

> Verified end-to-end against a live 9Router: model listing, streaming, non-streaming,
> round-robin and failover all pass. See [`docs/PROTOCOL.md`](docs/PROTOCOL.md).

## Features

- **Zero dependencies** — only Node's built-in `fetch`, `http`, `crypto`.
- **Instant bulk provisioning** — no browser required for the core flow.
- **Self-healing pool** — round-robin selection, automatic cooldown & failover.
- **Streaming + non-streaming** OpenAI chat completions.
- **Optional browser harvest** — drive a locally launched Chromium to prove a session.
- **One-command connect** — registers the provider node, provider and API key in 9Router.
- **Works local or hosted** — point it at `http://127.0.0.1:20128` or `https://9router.com`.

## Models

All six ptero models are exposed (prefix `ptero/` in 9Router):

| Model id | Label | 9Router id | Images |
|----------|-------|------------|:------:|
| `ling-3.0-flash:free` | Ling 3.0 Flash (default) | `ptero/ling-3.0-flash:free` | |
| `deepseek-v4.1-flash:free` | Deepseek v4.1 Flash | `ptero/deepseek-v4.1-flash:free` | ✅ |
| `mistral-nemo:minirouter` | Mistral Nemo 12B | `ptero/mistral-nemo:minirouter` | |
| `glm-5.3-flash` | GLM 5.3 Flash | `ptero/glm-5.3-flash` | |
| `gpt-oss-20b` | GPT-OSS 20B | `ptero/gpt-oss-20b` | |
| `apodex-1.1-mini:free` | Apodex 1.1 Mini | `ptero/apodex-1.1-mini:free` | |

Short aliases work too: `ling`, `deepseek`, `mistral`, `glm`, `gpt-oss`, `apodex`.

## Quick start

```bash
# 0. Requirements: Node 18+  (no npm install needed)

# 1. Create 5 accounts and save them
node src/cli.js create --count 5 --out accounts.json

# 2. (optional) health-check them
node src/cli.js verify --file accounts.json

# 3. Start the OpenAI-compatible adapter
node src/cli.js serve --port 8791 --file accounts.json

# 4. Register the adapter inside 9Router
ROUTER_URL=http://127.0.0.1:20128 ROUTER_PASSWORD=123456 \
  node src/cli.js connect --adapter http://127.0.0.1:8791

# 5. Chat through 9Router
curl http://127.0.0.1:20128/v1/chat/completions \
  -H "Authorization: Bearer sk-..." -H "Content-Type: application/json" \
  -d '{"model":"ptero/ling-3.0-flash:free","messages":[{"role":"user","content":"hi"}]}'
```

Or do it all at once:

```bash
COUNT=5 ROUTER_URL=http://127.0.0.1:20128 ROUTER_PASSWORD=123456 bash run.sh
```

## CLI reference

| Command | Description |
|---------|-------------|
| `create --count N [--out accounts.json] [--no-verify]` | Bulk-create accounts |
| `verify --file accounts.json` | Live health-check every account |
| `list` | List available models |
| `serve [--port 8791] [--file accounts.json] [--pool 3]` | Run the adapter |
| `connect [--router URL] [--password PW] [--adapter URL]` | Register in 9Router |
| `chat --file accounts.json [--model M] [--text "..."]` | One-shot chat through the pool |

## Connecting to 9router.com (hosted)

The connector works against the hosted service too. Since the adapter runs on the same
machine, expose it first (e.g. a tunnel or the 9Router "custom base URL" that can reach
your host), then:

```bash
ROUTER_URL=https://9router.com ROUTER_PASSWORD='<your-password>' \
  node src/cli.js connect --adapter https://<your-adapter-host>/v1
```

## Optional: harvest via a real browser

By default tokens are minted offline (instant). To prove a real session and harvest the
identity from cookies + `localStorage`, set:

```bash
HARVEST_VIA_BROWSER=1 CHROME_PATH=/path/to/chrome node src/cli.js create --count 1
```

This launches a **local** Chromium (auto-detected, or set `CHROME_PATH`). It never
touches your everyday browser profile and needs no hosted infrastructure.

## How it works

```
9Router (/v1/chat/completions, model "ptero/*")
        │
        ▼
adapter.js  :8791  ── round-robin ──▶  pool of ptero identities
  • /v1/models                            (each = 1M tokens/hour)
  • /v1/chat/completions                  │
  • /pool, /health                        ▼
                                  ptero.pro /wp-json/mlp/v1/chat-stream (SSE)
```

1. **provision** mints a random 32-hex token + username per account.
2. **pool** rotates identities and cools down failing ones.
3. **adapter** translates OpenAI ⇄ ptero's SSE protocol.
4. **connect-9router** registers the adapter as an `openai-compatible` provider node.

## Project structure

See [`STRUCTURE.md`](STRUCTURE.md) for the full diagram.

## Security & privacy notes

- Accounts are anonymous; there is no personal data involved.
- Tokens are random and disposable; treat `accounts.json` as a credential file.
- Only use this against services you are permitted to automate and in line with their
  terms of service.

## License

[MIT](LICENSE) © ptero-bulk-9router contributors
