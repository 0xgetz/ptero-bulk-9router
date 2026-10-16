"use strict";

/**
 * cdp.js — a tiny, zero-dependency Chrome DevTools Protocol client.
 *
 * Speaks the CDP over a hand-rolled RFC 6455 WebSocket so the toolkit needs no
 * npm packages at all. Used by browser.js to harvest identities from a locally
 * launched Chromium.
 */

const http = require("http");
const https = require("https");
const crypto = require("crypto");

function wsHandshake(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const lib = u.protocol === "wss:" ? https : http;
    const key = crypto.randomBytes(16).toString("base64");
    const r = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === "wss:" ? 443 : 80),
      path: u.pathname + u.search,
      method: "GET",
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": key,
      },
    });
    r.on("upgrade", (res, socket) => resolve({ socket, res }));
    r.on("response", (res) => reject(new Error("no websocket upgrade: HTTP " + res.statusCode)));
    r.on("error", reject);
    r.end();
  });
}

function encodeFrame(obj) {
  const data = Buffer.from(JSON.stringify(obj));
  const mask = crypto.randomBytes(4);
  let header;
  if (data.length < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | data.length;
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  header[0] = 0x81;
  const masked = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i % 4];
  return Buffer.concat([header, mask, masked]);
}

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    this.buf = Buffer.alloc(0);
    socket.on("data", (d) => this._onData(d));
  }

  _onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 2) {
      const b1 = this.buf[1];
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        len = Number(this.buf.readBigUInt64BE(2));
        off = 10;
      }
      if (this.buf.length < off + len) return;
      const payload = this.buf.subarray(off, off + len);
      this.buf = this.buf.subarray(off + len);
      try {
        const msg = JSON.parse(payload.toString("utf8"));
        if (msg.id && this.pending.has(msg.id)) {
          this.pending.get(msg.id)(msg);
          this.pending.delete(msg.id);
        }
      } catch (_) {}
    }
  }

  send(method, params, sessionId) {
    const id = ++this.id;
    const obj = { id, method, params: params || {} };
    if (sessionId) obj.sessionId = sessionId;
    this.socket.write(encodeFrame(obj));
    return new Promise((resolve) => this.pending.set(id, resolve));
  }

  close() {
    try {
      this.socket.destroy();
    } catch (_) {}
  }
}

async function connect(wsUrl) {
  const { socket } = await wsHandshake(wsUrl);
  return new CDP(socket);
}

module.exports = { CDP, connect, wsHandshake };
