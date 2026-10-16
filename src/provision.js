"use strict";

/**
 * provision.js — bulk account (identity) provisioning for ptero.pro.
 *
 * ptero.pro has no registration endpoint, so "creating an account" means
 * minting a fresh, valid guest identity: a random 32-hex token plus a display
 * username. The token is immediately usable. Each identity gets its own
 * 1,000,000-token/hour bucket.
 *
 * Provisioning here is therefore instant and offline; the only network step is
 * an optional verification call to confirm the token is accepted live.
 */

const { Ptero, newToken, randomUsername } = require("./ptero.js");

const HARVEST_VIA_BROWSER = String(process.env.HARVEST_VIA_BROWSER || "").toLowerCase();
const useBrowser = ["1", "true", "yes"].includes(HARVEST_VIA_BROWSER);

/**
 * Create one ptero account.
 * @param {{ verify?: boolean, onLog?: Function }} opts
 * @returns {Promise<object>} account record
 */
async function provisionAccount({ verify = true, onLog } = {}) {
  let token;
  let username;

  if (useBrowser) {
    // Optional: drive a LOCAL Chromium to prove a real session and harvest the
    // identity from cookies + localStorage. Requires a Chromium binary.
    const { harvestOne } = require("./browser.js");
    const h = await harvestOne({ onLog });
    token = h.token;
    username = h.username;
  } else {
    token = newToken();
    username = randomUsername();
  }

  const client = new Ptero({ token, username });

  const account = {
    username,
    token,
    cookie: `mlp_ai_guest_token=${token}`,
    identity: { username, token },
    created_at: new Date().toISOString(),
  };

  if (verify) {
    const v = await client.verify();
    account.verified = v.ok;
    if (v.ok) {
      account.default_model = v.default_model;
      account.disabled_models = v.disabled_models;
    } else {
      account.error = v.error;
    }
  } else {
    account.verified = null;
  }

  account.client = client;
  return account;
}

/**
 * Create `count` accounts in bulk.
 * @param {number} count
 * @param {{ verify?: boolean, concurrency?: number, onProgress?: Function }} opts
 * @returns {Promise<object[]>}
 */
async function provisionMany(count, { verify = true, concurrency = 5, onProgress } = {}) {
  const results = [];
  let next = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= count) return;
      let acct;
      try {
        acct = await provisionAccount({ verify });
      } catch (e) {
        acct = { error: e.message, created_at: new Date().toISOString() };
      }
      results[i] = acct;
      done++;
      if (onProgress) onProgress(done, count, acct);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, count) }, () => worker());
  await Promise.all(workers);

  // strip transient client objects before returning persisted shape
  return results.map((a) => {
    if (!a) return a;
    const { client, ...rest } = a;
    return rest;
  });
}

module.exports = { provisionAccount, provisionMany };
