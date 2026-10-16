"use strict";

/**
 * connect-9router.js — register the ptero adapter inside 9Router.
 *
 * Works against a local 9Router (http://127.0.0.1:20128) or the hosted
 * https://9router.com. Creates:
 *   1. an "openai-compatible" provider node pointing at the adapter base URL,
 *   2. a provider (connection) bound to that node,
 *   3. a router API key for /v1 access.
 *
 * Zero dependencies. Requires Node 18+.
 *
 * Env:
 *   ROUTER_URL       default http://127.0.0.1:20128  (or https://9router.com)
 *   ROUTER_PASSWORD  default 123456                  (or your 9router.com password)
 *   ADAPTER_URL      default http://127.0.0.1:8791
 *   PROVIDER_PREFIX  default ptero
 *   PROVIDER_NAME    default Ptero.pro
 */

const http = require("http");
const https = require("https");

const ROUTER_URL = (process.env.ROUTER_URL || "http://127.0.0.1:20128").replace(/\/$/, "");
const PASSWORD = process.env.ROUTER_PASSWORD || process.env.INITIAL_PASSWORD || "123456";
const ADAPTER_URL = process.env.ADAPTER_URL || "http://127.0.0.1:8791";
const PREFIX = process.env.PROVIDER_PREFIX || "ptero";
const NAME = process.env.PROVIDER_NAME || "Ptero.pro";

function req(method, url, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const r = lib.request(
      {
        method,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers: Object.assign(
          { "Content-Type": "application/json", Accept: "application/json" },
          headers || {},
          data ? { "Content-Length": Buffer.byteLength(data) } : {}
        ),
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: b }));
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function cookieFrom(res) {
  const sc = res.headers["set-cookie"];
  if (!sc) return "";
  return sc.map((c) => c.split(";")[0]).join("; ");
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

async function main() {
  console.log(`[connect] router  : ${ROUTER_URL}`);
  console.log(`[connect] adapter : ${ADAPTER_URL}  prefix=${PREFIX}`);

  // 1. login with the router password
  const login = await req("POST", `${ROUTER_URL}/api/auth/login`, { body: { password: PASSWORD } });
  const cookie = cookieFrom(login);
  console.log(`[connect] login   : ${login.status} ${cookie ? "ok" : login.text.slice(0, 120)}`);
  if (login.status >= 400) throw new Error("login failed: " + login.text);
  const auth = cookie ? { Cookie: cookie } : {};

  // 2. provider node (openai-compatible, chat)
  const nodeBody = { name: NAME, prefix: PREFIX, type: "openai-compatible", apiType: "chat", baseUrl: ADAPTER_URL + "/v1" };
  const node = await req("POST", `${ROUTER_URL}/api/provider-nodes`, { body: nodeBody, headers: auth });
  let nodeId = null;
  const nj = parse(node.text);
  if (nj) nodeId = nj.id || (nj.node && nj.node.id) || null;
  if (!nodeId) {
    const list = await req("GET", `${ROUTER_URL}/api/provider-nodes`, { headers: auth });
    const lj = parse(list.text);
    const found = (lj && lj.nodes ? lj.nodes : []).find((n) => n.prefix === PREFIX);
    if (found) nodeId = found.id;
  }
  console.log(`[connect] node    : ${node.status} id=${nodeId}`);
  if (!nodeId) throw new Error("could not resolve provider node id: " + node.text.slice(0, 200));

  // 3. provider bound to the node
  const provBody = {
    provider: nodeId,
    name: NAME,
    apiKey: process.env.PTERO_TOKEN || "anonymous",
    priority: 1,
    defaultModel: `${PREFIX}/ling-3.0-flash:free`,
    allowOverwrite: true,
  };
  const prov = await req("POST", `${ROUTER_URL}/api/providers`, { body: provBody, headers: auth });
  console.log(`[connect] provider: ${prov.status} ${prov.text.slice(0, 200)}`);

  // 4. router client key
  const key = await req("POST", `${ROUTER_URL}/api/keys`, { body: { name: `${PREFIX}-${Date.now()}` }, headers: auth });
  const kj = parse(key.text);
  const routerKey = kj && (kj.key || kj.apiKey);
  console.log(`[connect] key     : ${key.status} ${routerKey || key.text.slice(0, 200)}`);

  console.log("\n[connect] DONE");
  if (routerKey) {
    console.log(`[connect] test    : curl ${ROUTER_URL}/v1/chat/completions \\`);
    console.log(`                      -H "Authorization: Bearer ${routerKey}" -H "Content-Type: application/json" \\`);
    console.log(`                      -d '{"model":"${PREFIX}/ling-3.0-flash:free","messages":[{"role":"user","content":"hi"}]}'`);
  }
  return { nodeId, routerKey };
}

if (require.main === module) {
  main().catch((e) => {
    console.error("[connect] FATAL:", e.message);
    process.exit(1);
  });
}

module.exports = { main };
