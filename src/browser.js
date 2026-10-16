"use strict";

/**
 * browser.js — browser-based identity harvester.
 *
 * The pure-HTTP path already yields fully working tokens, so a browser is never
 * required. This module exists for parity and for scenarios where you want to
 * prove a real session: it launches a LOCAL Chromium (see launcher.js), drives
 * ptero.pro through its welcome → consent → username flow, then harvests the
 * resulting identity from localStorage and cookies.
 *
 * It has no external dependencies and only ever drives a Chromium process you
 * control locally.
 *
 * Enable with: HARVEST_VIA_BROWSER=1 node src/cli.js create --count 1
 */

const { launch } = require("./launcher.js");
const { connect } = require("./cdp.js");

const ACCEPT_TEXTS = ["everything fine", "accept & continue", "accept and continue"];
const SKIP_TEXTS = ["skip tour"];

async function evalIn(session, sid, expression) {
  const r = await session.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sid);
  const res = r.result && r.result.result;
  return res ? res.value : undefined;
}

async function clickByText(session, sid, texts) {
  const expr = `(() => {
    const texts = ${JSON.stringify(texts)};
    const els = [...document.querySelectorAll('button,a,span,div,p')];
    for (const el of els) {
      const t = (el.innerText || '').trim().toLowerCase();
      if (texts.some(x => t === x || t.startsWith(x))) { el.click(); return t; }
    }
    return null;
  })()`;
  return evalIn(session, sid, expr);
}

async function harvestOne({ headless = true, chromePath, onLog = () => {} } = {}) {
  const chrome = await launch({ headless, chromePath });
  const session = await connect(chrome.wsUrl);
  try {
    await session.send("Page.enable");
    await session.send("Network.enable");

    const targets = await session.send("Target.getTargets");
    const page = targets.result.targetInfos.find((t) => t.type === "page" && !t.url.startsWith("chrome://"));
    const attach = await session.send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
    const sid = attach.result.sessionId;

    onLog("navigating to ptero.pro");
    await session.send("Page.navigate", { url: "https://ptero.pro/" }, sid);
    await new Promise((r) => setTimeout(r, 6000));

    // dismiss welcome/consent modals if present
    await clickByText(session, sid, ACCEPT_TEXTS);
    await new Promise((r) => setTimeout(r, 1000));
    await clickByText(session, sid, SKIP_TEXTS);

    // submit a username to create the identity
    const username = require("./ptero.js").randomUsername();
    await evalIn(
      session,
      sid,
      `(() => {
        const inp = document.querySelector('#chat-username-input');
        if (!inp) return null;
        const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        set.call(inp, ${JSON.stringify(username)});
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        const btn = document.querySelector('button.chat-username-submit');
        if (btn) btn.click();
        return inp.value;
      })()`
    );
    await new Promise((r) => setTimeout(r, 3000));

    const raw = await evalIn(session, sid, 'localStorage.getItem("mlp_ai_chat_identity")');
    const cookies = await session.send("Network.getCookies", {});
    const guest = (cookies.result.cookies || []).find((c) => c.name === "mlp_ai_guest_token");

    const identity = raw ? JSON.parse(raw) : null;
    const token = guest ? guest.value : identity ? identity.token : null;
    if (!token) throw new Error("harvest failed: no guest token found");

    return {
      username: identity ? identity.username : username,
      token,
      cookie: `mlp_ai_guest_token=${token}`,
      identity: identity || { username, token },
    };
  } finally {
    session.close();
    chrome.close();
  }
}

module.exports = { harvestOne };
