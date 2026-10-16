"use strict";

/**
 * ptero.js — client for the ptero.pro chat API.
 *
 * ptero.pro grants access to a purely anonymous "guest" identity. The identity
 * token is a random 32-character hex string generated client-side; there is no
 * registration, email, password or server-issued secret. Any valid-looking
 * token is accepted immediately and receives its own rate-limit bucket.
 *
 * This client can:
 *   - mint fresh identities (accounts) locally,
 *   - call the ptero REST API (status / usage / chat),
 *   - stream chat completions via Server-Sent Events.
 *
 * Zero dependencies. Requires Node 18+ (global fetch).
 */

const crypto = require("crypto");

const BASE = "https://ptero.pro/wp-json/mlp/v1";
const DEFAULT_NONCE = "d6b0728eb4";

/** The six models ptero.pro exposes (hardcoded in the site bundle — no /models route). */
const MODELS = [
  { id: "ling-3.0-flash:free", label: "Ling 3.0 Flash (Free)", supports_images: false, default: true },
  { id: "deepseek-v4.1-flash:free", label: "Deepseek v4.1 Flash (Free)", supports_images: true, default: false },
  { id: "mistral-nemo:minirouter", label: "Mistral Nemo 12B", supports_images: false, default: false },
  { id: "glm-5.3-flash", label: "GLM 5.3 Flash", supports_images: false, default: false },
  { id: "gpt-oss-20b", label: "GPT-OSS 20B", supports_images: false, default: false },
  { id: "apodex-1.1-mini:free", label: "Apodex 1.1 Mini (Free)", supports_images: false, default: false },
];

const DEFAULT_MODEL = "ling-3.0-flash:free";

/** Generate a fresh ptero guest token: 32 lowercase hex characters. */
function newToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Generate a random display username. */
const FIRST = ["Alex", "Jordan", "Sky", "Milo", "Nova", "Riley", "Casey", "Kai", "Luna", "Theo", "Ivy", "Mason", "Zara", "Leo", "Ava", "Finn", "Maya", "Noah", "Ruby", "Ezra"];
const LAST = ["Reed", "Stone", "Vale", "Brooks", "Hart", "Wells", "Kings", "Lane", "Cross", "Frost", "Parker", "Hale", "Marsh", "Quinn", "Rowe", "Blake", "Dane", "Fenn", "Grove", "Sawyer"];
function randomUsername() {
  const a = FIRST[Math.floor(Math.random() * FIRST.length)];
  const b = LAST[Math.floor(Math.random() * LAST.length)];
  return `${a} ${b}`;
}

class Ptero {
  constructor({ token, username, nonce } = {}) {
    this.token = token || newToken();
    this.username = username || randomUsername();
    this.nonce = nonce || DEFAULT_NONCE;
    this.base = BASE;
  }

  headers(extra) {
    return Object.assign(
      {
        "Content-Type": "application/json",
        "X-WP-Nonce": this.nonce,
        "X-MLP-Guest-Token": this.token,
        "X-MLP-Guest-Username": this.username,
        Accept: "application/json, text/event-stream",
      },
      extra || {}
    );
  }

  async _json(path, opts) {
    const res = await fetch(this.base + path, opts);
    const fresh = res.headers.get("x-wp-nonce");
    if (fresh) this.nonce = fresh; // the nonce rotates on every response
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try {
        const j = await res.json();
        msg = j.message || msg;
      } catch (_) {}
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  /** GET /status — live availability + disabled models. */
  status() {
    return this._json("/status", { headers: this.headers() });
  }

  /** GET /usage — token quota for this identity. */
  usage() {
    return this._json("/usage", { headers: this.headers() });
  }

  /** GET /api-keys — {verified, keys}. */
  apiKeys() {
    return this._json("/api-keys", { headers: this.headers() });
  }

  /**
   * Stream a chat completion. Async-generates parsed SSE event objects:
   *   { phase } | { thinking } | { token } | { done, ... }
   */
  async *stream(message, { model, conversationId, history, lang, mode, signal } = {}) {
    const body = {
      message,
      model: model || DEFAULT_MODEL,
      conversation_id: conversationId || crypto.randomUUID(),
      attachments: [],
      history: history || [],
      lang: lang || "en",
      mode: mode || "chat",
    };
    const res = await fetch(this.base + "/chat-stream", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    });
    const fresh = res.headers.get("x-wp-nonce");
    if (fresh) this.nonce = fresh;
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try {
        const j = await res.json();
        msg = j.message || msg;
      } catch (_) {}
      throw new Error(msg);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t || t.startsWith(":")) continue;
        if (t.startsWith("data:")) {
          const payload = t.slice(5).trim();
          if (!payload) continue;
          try {
            yield JSON.parse(payload);
          } catch (_) {}
        }
      }
    }
  }

  /** Non-stream convenience: returns { text, meta }. */
  async chat(message, opts) {
    let text = "";
    let meta = {};
    for await (const ev of this.stream(message, opts)) {
      if (typeof ev.token === "string") text += ev.token;
      if (ev.done) meta = ev;
    }
    return { text, meta };
  }

  /** Verify this identity is live (used by provisioning). */
  async verify() {
    try {
      const st = await this.status();
      return { ok: true, default_model: st.default_model, disabled_models: st.disabled_models || [] };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

module.exports = { Ptero, newToken, randomUsername, MODELS, DEFAULT_MODEL, BASE };
