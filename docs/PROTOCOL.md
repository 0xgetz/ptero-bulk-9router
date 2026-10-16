# Protocol reference

Reverse-engineered from the public ptero.pro web bundle and the 9Router admin API.
Everything below was verified live on **16 October 2026**.

---

## 1. ptero.pro

### 1.1 Identity model — anonymous guest

ptero.pro has **no registration**. When a visitor names themselves, the site runs:

```js
function saveIdentity(username, existingToken) {
  var token = existingToken || crypto.randomUUID().replace(/-/g, "");
  localStorage.setItem("mlp_ai_chat_identity", JSON.stringify({ username, token }));
  return { username, token };
}
```

The token is a **random 32-character lowercase hex string** (a UUID with dashes removed).
It is sent to the server as a header; the server accepts any token and grants it its own
rate-limit bucket. Consequences:

- Any fresh random token works **immediately** — no signup request is made.
- The token is **not IP-bound** (verified from a datacenter IP).
- The token is **not a server-issued secret**; it can be fabricated freely.

Storage:

| Where | Key | Notes |
|-------|-----|-------|
| `localStorage` | `mlp_ai_chat_identity` | `{"username":"…","token":"…"}` |
| Cookie | `mlp_ai_guest_token` | `HttpOnly`, `Secure`, ~1 year, domain `ptero.pro` |

> A second cookie, `crisp-client/session/…`, belongs to the live-chat widget and is **not**
> used for authentication.

### 1.2 REST API

```
Base URL : https://ptero.pro/wp-json/mlp/v1     (WordPress namespace "mlp")
```

Required headers on every call:

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-WP-Nonce` | current nonce (rotates — see below) |
| `X-MLP-Guest-Token` | the 32-hex token |
| `X-MLP-Guest-Username` | display name |

**Nonce rotation:** every response returns a fresh nonce in the `x-wp-nonce` response
header. Clients should update their stored nonce from it. The initial page nonce observed
was `d6b0728eb4`.

Endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/chat-stream` | Streamed chat completion (SSE) |
| `POST` | `/chat` | Non-stream JSON (used for auto-titling) |
| `GET` | `/status` | Availability + disabled models |
| `GET` | `/usage` | Token quota for this identity |
| `GET` | `/api-keys` | `{verified, keys}` |
| `GET` | `/github/status` | `{configured, github_verified, repo}` |
| `POST` | `/verify-turnstile` | Gate the "Start Chatting" button |
| `GET` | `/news`, `/projects/cloud`, `/projects/files` | Other features |
| `POST` | `/feedback` | Feedback |

### 1.3 Chat stream

Request body:

```json
{
  "message": "hi",
  "model": "ling-3.0-flash:free",
  "conversation_id": "4a6d2f3c-81ed-4b42-9982-0f77e7e8e67a",
  "attachments": [],
  "history": [],
  "lang": "en",
  "mode": "chat"
}
```

Response: `text/event-stream`, one JSON object per `data:` line:

```
data: {"phase":"preparing","activity":{...}}
data: {"phase":"connecting","activity":{...}}
data: {"phase":"generating","progress":{...}}
: keepalive
data: {"thinking":"…","progress":{...}}          (reasoning models only)
data: {"token":"Hel","progress":{...}}
data: {"token":"lo","progress":{...}}
data: {"done":true,"conversation_id":"…","model_used":"ling-3.0-flash:free",
       "usage_tokens":2,"sources":[],"code_index":{...}}
```

Accumulate `token` fields for the assistant text; the terminal `done` frame carries
`model_used` and `usage_tokens`.

### 1.4 Models

There is **no `/models` endpoint** — the catalogue is hardcoded in the page bundle
(`jsModels`):

| id | label | supports_images |
|----|-------|:---------------:|
| `ling-3.0-flash:free` | Ling 3.0 Flash (Free) | no |
| `deepseek-v4.1-flash:free` | Deepseek v4.1 Flash (Free) | yes |
| `mistral-nemo:minirouter` | Mistral Nemo 12B | no |
| `glm-5.3-flash` | GLM 5.3 Flash | no |
| `gpt-oss-20b` | GPT-OSS 20B | no |
| `apodex-1.1-mini:free` | Apodex 1.1 Mini (Free) | no |

Default: `ling-3.0-flash:free`. The `Smart (Auto)` / `Fast Task` / `Complex` labels are
client-side prompt modes, not server models. Server-disabled (as observed):
`minimax-m3`, `muse-spark-1.3-contributor`.

### 1.5 Quota

`GET /usage` returns:

```json
{"used":3497,"max":1000000,"base_max":1000000,"bonus_tokens":0,
 "remaining":996503,"reset_seconds":3600,"window_seconds":3600,"unlimited":false}
```

1,000,000 tokens per rolling 3600-second window, **per identity**. Pooling N identities
multiplies this.

---

## 2. OpenAI-compatible adapter

The adapter (`src/adapter.js`) presents:

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/v1/models` | Returns `ptero/<id>` entries |
| `POST` | `/v1/chat/completions` | `stream: true` → SSE; else JSON |
| `GET` | `/health` | `{ok, pool}` |
| `GET` | `/pool` | Per-member health snapshot |
| `POST` | `/pool/reload` | Reload accounts file |

Message handling: the last message becomes ptero's `message`; earlier messages become the
`history` array as `{role, text}`.

---

## 3. 9Router admin API

Used by `src/connect-9router.js`. Works against `http://127.0.0.1:20128` and the hosted
`https://9router.com`.

```
POST /api/auth/login        {password}          → sets a session cookie
POST /api/provider-nodes    {name, prefix, type:"openai-compatible",
                             apiType:"chat", baseUrl}
POST /api/providers         {provider:<nodeId>, name, apiKey, priority,
                             defaultModel, allowOverwrite:true}
POST /api/keys              {name}              → {key:"sk-…"}
```

Notes:

- `apiType` must be `chat` or `responses`.
- The `provider` field of `/api/providers` must be the **node id**
  (`openai-compatible-chat-<uuid>`), not the prefix.
- 9Router relays non-stream client calls to `openai-compatible` nodes with
  `Accept: text/event-stream` and expects SSE back, so the adapter must speak SSE.

### Verified end-to-end (16 Oct 2026)

| Test | Result |
|------|--------|
| `GET /v1/models` | 6 `ptero/*` models listed |
| non-stream chat | `ROUTER_PTERO_OK` |
| stream chat | SSE chunks + `[DONE]` |
| round-robin over pool of 3 | requests distributed 1 / 2 / 3 |
| model failover | multiple models answered |
