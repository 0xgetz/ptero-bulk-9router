# Project structure

```
ptero-bulk-9router/
├── README.md                 Main docs (English)
├── README.id.md              Bahasa Indonesia
├── README.zh.md              Chinese (简体)
├── README.ja.md              Japanese (日本語)
├── README.es.md              Spanish (Español)
├── STRUCTURE.md              This file
├── LICENSE                   MIT
├── run.sh                    One-shot: create → serve → connect
├── package.json              Metadata (no dependencies)
├── .gitignore
│
├── brand/
│   ├── logo.svg              Wordmark (used in README headers)
│   └── icon.svg              Square icon
│
├── docs/
│   └── PROTOCOL.md           Reverse-engineered ptero.pro + 9Router API
│
└── src/
    ├── ptero.js              ptero.pro client: token minting, REST, SSE chat
    ├── provision.js          Bulk account (identity) provisioning
    ├── provision-sync.js     Synchronous identity minting (adapter bootstrap)
    ├── pool.js               Self-healing identity pool (round-robin + failover)
    ├── adapter.js            OpenAI-compatible HTTP server (:8791)
    ├── connect-9router.js    Registers adapter in 9Router (local or hosted)
    ├── cli.js                Command-line interface
    ├── mailtm.js             Optional mail.tm mailbox helper
    ├── launcher.js           Launch a local Chromium (optional)
    ├── cdp.js                Zero-dep Chrome DevTools Protocol client (optional)
    └── browser.js            Optional browser-based identity harvester
```

## Data flow

```
┌────────────────┐        ┌─────────────────────────────────────────────┐
│   9Router      │        │              this toolkit                   │
│  (local/host)  │        │                                             │
│                │        │   ┌───────────────┐                         │
│  POST /v1/chat │        │   │  src/cli.js   │  create / verify /      │
│  /completions  │        │   └──────┬────────┘  serve / connect / chat │
│  model:        │        │          │                                  │
│  "ptero/*"     │        │          ▼                                  │
└───────┬────────┘        │   ┌───────────────┐   ┌──────────────────┐  │
        │                 │   │ provision.js  │──▶│  accounts.json   │  │
        │  OpenAI HTTP    │   └──────┬────────┘   └──────────────────┘  │
        ▼                 │          │                                 │
┌────────────────┐        │          ▼                                 │
│  adapter.js    │◀───────┼───┌───────────────┐                        │
│  :8791         │        │   │    pool.js    │  round-robin+failover  │
│  /v1/models    │        │   └──────┬────────┘                        │
│  /v1/chat/...  │        │          │                                 │
│  /pool /health │        │          ▼                                 │
└────────────────┘        │   ┌───────────────┐                        │
                          │   │   ptero.js    │  token + SSE client    │
                          │   └──────┬────────┘                        │
                          └──────────┼─────────────────────────────────┘
                                     │  HTTPS SSE
                                     ▼
                        ┌─────────────────────────────────┐
                        │  ptero.pro                      │
                        │  /wp-json/mlp/v1/chat-stream    │
                        └─────────────────────────────────┘
```

## Identity lifecycle

```
 newToken()             provision.js          pool.js              adapter.js
 ─────────              ────────────          ───────              ──────────
 32-hex UUID   ──▶  { username, token,  ──▶  member{healthy,  ──▶  pick() selects,
                    cookie, identity }       requests, ... }      chat() streams
                          │                       │                     │
                          ▼                       ▼                     ▼
                    accounts.json          cooldown on fail      OpenAI SSE
                                           (3 fails → 60s)       response
```

## Model catalogue

The six models exposed through the adapter (9Router prefix `ptero/`). Defined in
`src/ptero.js` (`MODELS`).

| id | label | 9Router id | supports_images | alias |
|----|-------|------------|:---------------:|-------|
| `ling-3.0-flash:free` | Ling 3.0 Flash (default) | `ptero/ling-3.0-flash:free` | no | `ling` |
| `deepseek-v4.1-flash:free` | Deepseek v4.1 Flash | `ptero/deepseek-v4.1-flash:free` | yes | `deepseek` |
| `mistral-nemo:minirouter` | Mistral Nemo 12B | `ptero/mistral-nemo:minirouter` | no | `mistral` |
| `glm-5.3-flash` | GLM 5.3 Flash | `ptero/glm-5.3-flash` | no | `glm` |
| `gpt-oss-20b` | GPT-OSS 20B | `ptero/gpt-oss-20b` | no | `gpt-oss` |
| `apodex-1.1-mini:free` | Apodex 1.1 Mini | `ptero/apodex-1.1-mini:free` | no | `apodex` |

## Module responsibilities

| Module | Depends on | Responsibility |
|--------|-----------|----------------|
| `ptero.js` | `crypto` | Mint tokens, call ptero REST + SSE |
| `provision.js` | `ptero.js`, `browser.js` | Create one/many accounts, verify |
| `provision-sync.js` | `ptero.js` | Offline synchronous minting |
| `pool.js` | `ptero.js` | Selection, health, failover |
| `adapter.js` | `pool.js`, `ptero.js` | OpenAI-compatible server |
| `connect-9router.js` | `http`/`https` | Register provider in 9Router |
| `cli.js` | all of the above | User-facing commands |
| `mailtm.js` | `fetch` | Optional mailbox helper |
| `launcher.js` | `child_process` | Optional local Chromium |
| `cdp.js` | `net`/`crypto` | Optional CDP WebSocket client |
| `browser.js` | `launcher.js`, `cdp.js` | Optional browser harvest |
