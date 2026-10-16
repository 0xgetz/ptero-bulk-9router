"use strict";

/**
 * provision-sync.js — synchronous identity minting (no network).
 *
 * Used by adapter.js when no ACCOUNTS_FILE is provided so the adapter can start
 * with a working pool without waiting on any I/O. ptero identities are pure
 * random tokens, so nothing needs to be fetched.
 */

const { newToken, randomUsername } = require("./ptero.js");

function provisionManySync() {
  const token = newToken();
  const username = randomUsername();
  return { username, token, cookie: `mlp_ai_guest_token=${token}`, identity: { username, token } };
}

module.exports = { provisionManySync };
