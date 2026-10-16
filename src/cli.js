#!/usr/bin/env node
"use strict";

/**
 * cli.js — command-line interface for ptero-bulk-9router.
 *
 *   node src/cli.js create --count 5 [--out accounts.json] [--verify]
 *   node src/cli.js verify --file accounts.json
 *   node src/cli.js list
 *   node src/cli.js connect [--router http://127.0.0.1:20128] [--password 123456]
 *   node src/cli.js serve [--port 8791]
 *   node src/cli.js chat --file accounts.json --model ling-3.0-flash --text "hi"
 */

const fs = require("fs");
const { provisionMany } = require("./provision.js");
const { Pool } = require("./pool.js");
const { MODELS } = require("./ptero.js");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      args[k] = v;
    } else args._.push(a);
  }
  return args;
}

function save(accounts, out) {
  const payload = { generated_at: new Date().toISOString(), count: accounts.length, accounts };
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  return out;
}

function loadAccounts(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(raw) ? raw : raw.accounts || [];
}

async function cmdCreate(args) {
  const count = parseInt(args.count || args.c || "1", 10);
  const out = args.out || args.o || "accounts.json";
  const verify = args.verify !== false && args["no-verify"] !== true;
  console.log(`[cli] provisioning ${count} account(s)  verify=${verify}`);
  const accounts = await provisionMany(count, {
    verify,
    concurrency: parseInt(args.concurrency || "5", 10),
    onProgress: (done, total, acct) =>
      console.log(`[cli] ${done}/${total}  ${acct.token ? acct.token.slice(0, 10) + "…" : "ERR"}  ${acct.verified ? "✓" : acct.error ? "✗ " + acct.error : ""}`),
  });
  save(accounts, out);
  const okCount = accounts.filter((a) => a.verified).length;
  console.log(`[cli] saved ${accounts.length} account(s) to ${out}  (verified ${okCount}/${accounts.length})`);
}

async function cmdVerify(args) {
  const file = args.file || args.f || "accounts.json";
  const pool = new Pool(loadAccounts(file));
  console.log(`[cli] verifying ${pool.size} account(s) from ${file}`);
  const results = await pool.healthCheckAll();
  const ok = results.filter((r) => r.ok).length;
  results.forEach((r) => console.log(`  ${r.ok ? "✓" : "✗"} ${r.username}${r.error ? "  " + r.error : ""}`));
  console.log(`[cli] ${ok}/${results.length} healthy`);
}

function cmdList() {
  console.log("[cli] available models:");
  MODELS.forEach((m) => console.log(`  ${m.id.padEnd(30)} ${m.label}${m.supports_images ? "  [images]" : ""}`));
}

async function cmdConnect(args) {
  if (args.router) process.env.ROUTER_URL = args.router;
  if (args.password) process.env.ROUTER_PASSWORD = args.password;
  if (args.adapter) process.env.ADAPTER_URL = args.adapter;
  const { main } = require("./connect-9router.js");
  await main();
}

function cmdServe(args) {
  if (args.port) process.env.ADAPTER_PORT = args.port;
  if (args.file) process.env.ACCOUNTS_FILE = args.file;
  if (args.pool) process.env.POOL_SIZE = args.pool;
  require("./adapter.js");
}

async function cmdChat(args) {
  const file = args.file || args.f || "accounts.json";
  const pool = new Pool(loadAccounts(file));
  const text = args.text || "Hello!";
  const model = args.model || "ling-3.0-flash:free";
  console.log(`[cli] chat via pool (${pool.size}) model=${model}`);
  const out = await pool.withFailover((m) => m.client.chat(text, { model }));
  console.log("[cli] reply:", out.text);
  console.log("[cli] meta :", JSON.stringify(out.meta));
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const args = parseArgs(rest);
  switch (cmd) {
    case "create":
      return cmdCreate(args);
    case "verify":
      return cmdVerify(args);
    case "list":
      return cmdList();
    case "connect":
      return cmdConnect(args);
    case "serve":
      return cmdServe(args);
    case "chat":
      return cmdChat(args);
    default:
      console.log(`ptero-bulk-9router

Usage:
  node src/cli.js create  --count 5 [--out accounts.json] [--no-verify]
  node src/cli.js verify  --file accounts.json
  node src/cli.js list
  node src/cli.js connect [--router https://9router.com] [--password <pw>] [--adapter http://127.0.0.1:8791]
  node src/cli.js serve   [--port 8791] [--file accounts.json] [--pool 3]
  node src/cli.js chat    --file accounts.json [--model ling-3.0-flash] [--text "hi"]`);
  }
}

main().catch((e) => {
  console.error("[cli] FATAL:", e.message);
  process.exit(1);
});
