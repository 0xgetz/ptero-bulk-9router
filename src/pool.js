"use strict";

/**
 * pool.js — a self-healing pool of ptero identities.
 *
 * Holds N accounts, exposes round-robin selection with automatic failover,
 * tracks per-account health, and can reload from disk.
 *
 * Zero dependencies.
 */

const fs = require("fs");
const { Ptero } = require("./ptero.js");

class Pool {
  /**
   * @param {object[]} accounts  array of { username, token, ... }
   * @param {{ cooldownMs?: number }} opts
   */
  constructor(accounts = [], { cooldownMs = 60_000 } = {}) {
    this.cooldownMs = cooldownMs;
    this.members = accounts.map((a) => ({
      username: a.username,
      token: a.token,
      client: new Ptero({ token: a.token, username: a.username }),
      healthy: true,
      failures: 0,
      lastError: null,
      cooldownUntil: 0,
      requests: 0,
    }));
    this.rr = 0;
  }

  get size() {
    return this.members.length;
  }

  /** Load accounts from a JSON file (array of { username, token }). */
  static fromFile(path, opts) {
    const raw = JSON.parse(fs.readFileSync(path, "utf8"));
    const arr = Array.isArray(raw) ? raw : raw.accounts || [];
    return new Pool(arr, opts);
  }

  /** Pick the next healthy member (round-robin), skipping ones in cooldown. */
  pick() {
    const n = this.members.length;
    if (n === 0) throw new Error("pool is empty");
    const now = Date.now();
    for (let i = 0; i < n; i++) {
      const m = this.members[(this.rr + i) % n];
      if (m.cooldownUntil <= now) {
        this.rr = (this.rr + i + 1) % n;
        return m;
      }
    }
    // everyone cooling down: return the soonest-to-recover member
    return this.members.reduce((a, b) => (a.cooldownUntil <= b.cooldownUntil ? a : b));
  }

  /** Record a success for a member. */
  ok(member) {
    member.healthy = true;
    member.failures = 0;
    member.lastError = null;
    member.cooldownUntil = 0;
    member.requests++;
  }

  /** Record a failure; puts the member in cooldown after repeated errors. */
  fail(member, err) {
    member.failures++;
    member.lastError = err ? String(err.message || err) : "unknown";
    if (member.failures >= 3) {
      member.healthy = false;
      member.cooldownUntil = Date.now() + this.cooldownMs;
    }
  }

  /** Execute fn(member) with up to `retries` failovers across the pool. */
  async withFailover(fn, retries = this.members.length) {
    let lastErr;
    for (let i = 0; i < retries; i++) {
      const m = this.pick();
      try {
        const out = await fn(m);
        this.ok(m);
        return out;
      } catch (e) {
        lastErr = e;
        this.fail(m, e);
      }
    }
    throw lastErr || new Error("all pool members failed");
  }

  /** Health snapshot for the /pool endpoint. */
  snapshot() {
    const now = Date.now();
    return this.members.map((m) => ({
      username: m.username,
      token: m.token.slice(0, 8) + "…",
      healthy: m.healthy && m.cooldownUntil <= now,
      requests: m.requests,
      failures: m.failures,
      lastError: m.lastError,
      cooldownMs: Math.max(0, m.cooldownUntil - now),
    }));
  }

  /** Live-health-check every member. */
  async healthCheckAll() {
    const results = await Promise.all(
      this.members.map(async (m) => {
        const v = await m.client.verify();
        if (v.ok) this.ok(m);
        else this.fail(m, new Error(v.error));
        return { username: m.username, ok: v.ok, error: v.error || null };
      })
    );
    return results;
  }
}

module.exports = { Pool };
