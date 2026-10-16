"use strict";

/**
 * launcher.js — launch (or reuse) a local Chromium and expose its CDP URL.
 *
 * Open-source friendly, zero npm dependencies: point it at any Chromium/Chrome
 * binary with CHROME_PATH, or let it auto-detect common install locations. It
 * starts a dedicated instance on a private debug port with its own throwaway
 * profile, so it never touches the user's everyday browser profile.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
].filter(Boolean);

function findChrome() {
  for (const c of CANDIDATES) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return null;
}

async function waitForVersion(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return await r.json();
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error("Chromium did not expose a debug port in time");
}

/**
 * Launch Chromium.
 * @returns {Promise<{wsUrl:string, proc:object, port:number, profileDir:string, bin:string, close:Function}>}
 */
async function launch({ port = 0, headless = true, chromePath, extraArgs = [] } = {}) {
  const bin = chromePath || findChrome();
  if (!bin) throw new Error("No Chromium/Chrome found. Set CHROME_PATH to your browser binary.");

  const realPort = port || 9000 + Math.floor(Math.random() * 900);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "ptero-chrome-"));
  const args = [
    headless ? "--headless=new" : "--start-maximized",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${realPort}`,
    `--user-data-dir=${profileDir}`,
    ...extraArgs,
    "about:blank",
  ];
  const proc = spawn(bin, args, { stdio: "ignore", detached: false });
  proc.on("error", () => {});
  const info = await waitForVersion(realPort);

  return {
    wsUrl: info.webSocketDebuggerUrl,
    proc,
    port: realPort,
    profileDir,
    bin,
    close() {
      try {
        proc.kill("SIGKILL");
      } catch (_) {}
      try {
        fs.rmSync(profileDir, { recursive: true, force: true });
      } catch (_) {}
    },
  };
}

module.exports = { launch, findChrome };
