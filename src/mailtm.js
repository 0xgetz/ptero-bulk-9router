"use strict";

/**
 * mailtm.js — optional mailbox helper (mail.tm).
 *
 * ptero.pro does NOT require email, so this is only used to attach a contact
 * address to each generated account for bookkeeping or future features. It is
 * entirely optional; bulk provisioning works without it.
 *
 * Zero dependencies. Requires Node 18+.
 */

const API = "https://api.mail.tm";

async function _json(res) {
  const t = await res.text();
  let j = null;
  try {
    j = JSON.parse(t);
  } catch (_) {}
  if (!res.ok) {
    const msg = (j && (j["hydra:description"] || j.message || j.detail)) || "HTTP " + res.status;
    throw new Error(msg);
  }
  return j;
}

function randomString(n = 12) {
  return Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
}

/** Get the first available mail.tm domain. */
async function getDomain() {
  const j = await _json(await fetch(`${API}/domains?page=1`));
  const list = j["hydra:member"] || j;
  const active = list.find((d) => d.isActive !== false);
  return (active || list[0]).domain;
}

/** Create a mailbox: returns { address, password, id, token }. */
async function createMailbox({ domain, password } = {}) {
  const host = domain || (await getDomain());
  const address = `ptero.${randomString(10)}@${host}`;
  const pw = password || randomString(16);
  const account = await _json(
    await fetch(`${API}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password: pw }),
    })
  );
  const login = await _json(
    await fetch(`${API}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password: pw }),
    })
  );
  return { address, password: pw, id: account.id, token: login.token };
}

/** List messages in a mailbox. Handles both bare-array and hydra responses. */
async function listMessages(mailbox) {
  const res = await fetch(`${API}/messages?page=1`, { headers: { Authorization: `Bearer ${mailbox.token}` } });
  const t = await res.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch (_) {
    return [];
  }
  return Array.isArray(j) ? j : j["hydra:member"] || [];
}

module.exports = { getDomain, createMailbox, listMessages, randomString };
