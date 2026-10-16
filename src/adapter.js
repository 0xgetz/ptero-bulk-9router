"use strict";

/**
 * adapter.js — OpenAI-compatible HTTP server bridging to ptero.pro.
 *
 * Endpoints:
 *   GET  /v1/models                 list ptero models
 *   POST /v1/chat/completions       chat (stream + non-stream)
 *   GET  /health                    liveness
 *   GET  /pool                      pool health snapshot
 *   POST /pool/reload               reload accounts from the accounts file
 *
 * Zero dependencies. Requires Node 18+.
 */

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const { MODELS, DEFAULT_MODEL } = require("./ptero.js");
const { Pool } = require("./pool.js");

const PORT = parseInt(process.env.ADAPTER_PORT || process.env.PORT || "8791", 10);
const HOST = process.env.ADAPTER_HOST || "127.0.0.1";
const ACCOUNTS_FILE = process.env.ACCOUNTS_FILE || "";
const POOL_SIZE = parseInt(process.env.POOL_SIZE || "3", 10);

function buildPool() {
  if (ACCOUNTS_FILE && fs.existsSync(ACCOUNTS_FILE)) {
    try {
      const p = Pool.fromFile(ACCOUNTS_FILE);
      console.log(`[adapter] pool loaded ${p.size} account(s) from ${ACCOUNTS_FILE}`);
      return p;
    } catch (e) {
      console.log(`[adapter] failed to load ${ACCOUNTS_FILE}: ${e.message}; using generated pool`);
    }
  }
  const { provisionManySync } = require("./provision-sync.js");
  const accounts = [];
  for (let i = 0; i < POOL_SIZE; i++) accounts.push(provisionManySync());
  console.log(`[adapter] pool generated ${accounts.length} anonymous account(s) (no ACCOUNTS_FILE set)`);
  return new Pool(accounts);
}

let pool = buildPool();

// Map common OpenAI-ish names to ptero ids, and pass through raw ids.
const ALIAS = {
  "ling-3.0-flash": "ling-3.0-flash:free",
  ling: "ling-3.0-flash:free",
  "deepseek-v4.1-flash": "deepseek-v4.1-flash:free",
  deepseek: "deepseek-v4.1-flash:free",
  "mistral-nemo": "mistral-nemo:minirouter",
  mistral: "mistral-nemo:minirouter",
  "glm-5.3-flash": "glm-5.3-flash",
  glm: "glm-5.3-flash",
  "gpt-oss-20b": "gpt-oss-20b",
  "gpt-oss": "gpt-oss-20b",
  "apodex-1.1-mini": "apodex-1.1-mini:free",
  apodex: "apodex-1.1-mini:free",
};

function resolveModel(m) {
  if (!m) return DEFAULT_MODEL;
  if (MODELS.some((x) => x.id === m)) return m;
  const base = m.replace(/^ptero\//, "").replace(/:free$/, "");
  return ALIAS[m] || ALIAS[base] || DEFAULT_MODEL;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
    req.on("error", reject);
  });
}

function messagesToPrompt(messages, history) {
  const arr = Array.isArray(messages) ? messages : [];
  if (arr.length <= 1) return { message: (arr[0] && arr[0].content) || "", history: history || [] };
  const last = arr[arr.length - 1];
  const hist = arr.slice(0, -1).map((m) => ({
    role: m.role,
    text: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
  return { message: last.content || "", history: hist };
}

const cid = () => "chatcmpl-" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (code, obj, extra) => {
    res.writeHead(code, Object.assign({ "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, extra));
    res.end(JSON.stringify(obj));
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    });
    return res.end();
  }

  if (url.pathname === "/health") return send(200, { ok: true, pool: pool.size });
  if (url.pathname === "/pool") return send(200, { size: pool.size, members: pool.snapshot() });

  if (url.pathname === "/pool/reload") {
    if (ACCOUNTS_FILE && fs.existsSync(ACCOUNTS_FILE)) pool = Pool.fromFile(ACCOUNTS_FILE);
    return send(200, { ok: true, size: pool.size });
  }

  if (url.pathname === "/v1/models" || url.pathname === "/models") {
    const now = Math.floor(Date.now() / 1000);
    return send(200, {
      object: "list",
      data: MODELS.map((m) => ({ id: "ptero/" + m.id, object: "model", created: now, owned_by: "ptero", label: m.label })),
    });
  }

  if (url.pathname === "/v1/chat/completions" || url.pathname === "/chat/completions") {
    let payload;
    try {
      payload = JSON.parse((await readBody(req)) || "{}");
    } catch (_) {
      return send(400, { error: { message: "invalid JSON body", type: "invalid_request_error" } });
    }
    const model = resolveModel(payload.model);
    const { message, history } = messagesToPrompt(payload.messages, payload.history);
    const stream = !!payload.stream;
    const convId = payload.conversation_id || crypto.randomUUID();
    const completionId = cid();
    const created = Math.floor(Date.now() / 1000);

    const runStream = async (member) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(
        "data: " +
          JSON.stringify({ id: completionId, object: "chat.completion.chunk", created, model: "ptero/" + model, choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }] }) +
          "\n\n"
      );
      for await (const ev of member.client.stream(message, { model, conversationId: convId, history })) {
        if (typeof ev.token === "string" && ev.token.length) {
          res.write(
            "data: " +
              JSON.stringify({ id: completionId, object: "chat.completion.chunk", created, model: "ptero/" + model, choices: [{ index: 0, delta: { content: ev.token }, finish_reason: null }] }) +
              "\n\n"
          );
        }
        if (ev.done) {
          res.write(
            "data: " +
              JSON.stringify({ id: completionId, object: "chat.completion.chunk", created, model: "ptero/" + model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }) +
              "\n\n"
          );
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    };

    try {
      if (stream) {
        try {
          await pool.withFailover(runStream);
        } catch (e) {
          if (!res.headersSent) return send(502, { error: { message: e.message, type: "upstream_error" } });
          res.write("data: " + JSON.stringify({ error: { message: e.message } }) + "\n\n");
          res.write("data: [DONE]\n\n");
          return res.end();
        }
        return;
      }

      const out = await pool.withFailover((m) => m.client.chat(message, { model, conversationId: convId, history }));
      return send(200, {
        id: completionId,
        object: "chat.completion",
        created,
        model: "ptero/" + model,
        choices: [{ index: 0, message: { role: "assistant", content: out.text }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: out.meta.usage_tokens || 0, total_tokens: out.meta.usage_tokens || 0 },
        ptero: { model_used: out.meta.model_used, conversation_id: out.meta.conversation_id },
      });
    } catch (e) {
      if (!res.headersSent) send(502, { error: { message: e.message, type: "upstream_error" } });
      else {
        try {
          res.end();
        } catch (_) {}
      }
    }
  }

  return send(404, { error: { message: "not found" } });
});

server.listen(PORT, HOST, () => {
  console.log(`[adapter] listening on http://${HOST}:${PORT}  pool=${pool.size}  models=${MODELS.length}`);
});

module.exports = { server };
