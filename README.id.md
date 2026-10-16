<div align="center">

<img src="brand/logo.svg" alt="ptero-bulk-9router" width="460">

# ptero-bulk-9router

**Buat akun anonim [ptero.pro](https://ptero.pro/) secara massal, ambil otomatis token
&amp; cookie sesinya, lalu sajikan ke [9Router](https://9router.com) sebagai pool
OpenAI-compatible yang self-healing dan load-balanced.**

Tanpa dependensi · Node 18+ · MIT

[![License](https://img.shields.io/badge/license-MIT-19c37d?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-19c37d?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-19c37d?style=flat-square)](#)
[![9Router](https://img.shields.io/badge/9Router-openai--compatible-58a6ff?style=flat-square)](https://9router.com)
[![ptero.pro](https://img.shields.io/badge/ptero.pro-anonymous%20guest-19c37d?style=flat-square)](https://ptero.pro)
[![Models](https://img.shields.io/badge/models-6-d29922?style=flat-square)](#model)
[![Status](https://img.shields.io/badge/status-verified%20e2e-19c37d?style=flat-square)](#verifikasi)

[English](README.md) · [Indonesia](README.id.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)

</div>

---

## Apa ini?

[ptero.pro](https://ptero.pro/) adalah situs chat AI gratis yang sepenuhnya
**anonim**. Sebuah "akun" hanyalah token hex acak 32 karakter yang dibuat di browser —
**tanpa daftar, tanpa email, tanpa password**, dan token tidak terikat IP. Toolkit ini:

1. **Membuat massal** identitas ptero sebanyak apa pun (HTTP murni, instan).
2. **Mengambil** setiap token dan cookie sesi `mlp_ai_guest_token`.
3. **Menggabungkan** semuanya menjadi adapter round-robin + failover yang self-healing.
4. **Menghubungkan** adapter itu ke **9Router** sebagai provider OpenAI-compatible.

Setiap identitas punya jatah **1.000.000 token/jam** sendiri, jadi pooling melipatgandakan
throughput gratis Anda.

> Terverifikasi end-to-end pada 9Router live: daftar model, streaming, non-streaming,
> round-robin, dan failover semuanya lulus. Lihat [`docs/PROTOCOL.md`](docs/PROTOCOL.md).

## Fitur

- **Tanpa dependensi** — hanya `fetch`, `http`, `crypto` bawaan Node.
- **Provisioning massal instan** — inti alur tidak butuh browser.
- **Pool self-healing** — rotasi round-robin, cooldown otomatis & failover.
- **Streaming + non-streaming** chat completions OpenAI.
- **Harvest via browser opsional** — jalankan Chromium lokal untuk membuktikan sesi.
- **Konek satu perintah** — mendaftarkan provider node, provider, dan API key di 9Router.
- **Lokal atau hosted** — arahkan ke `http://127.0.0.1:20128` atau `https://9router.com`.

## Model

Enam model ptero semuanya tersedia (prefiks `ptero/` di 9Router):

| Model id | Label | 9Router id | Gambar |
|----------|-------|------------|:------:|
| `ling-3.0-flash:free` | Ling 3.0 Flash (default) | `ptero/ling-3.0-flash:free` | |
| `deepseek-v4.1-flash:free` | Deepseek v4.1 Flash | `ptero/deepseek-v4.1-flash:free` | ✅ |
| `mistral-nemo:minirouter` | Mistral Nemo 12B | `ptero/mistral-nemo:minirouter` | |
| `glm-5.3-flash` | GLM 5.3 Flash | `ptero/glm-5.3-flash` | |
| `gpt-oss-20b` | GPT-OSS 20B | `ptero/gpt-oss-20b` | |
| `apodex-1.1-mini:free` | Apodex 1.1 Mini | `ptero/apodex-1.1-mini:free` | |

Alias pendek juga jalan: `ling`, `deepseek`, `mistral`, `glm`, `gpt-oss`, `apodex`.

## Mulai cepat

```bash
# 0. Syarat: Node 18+  (tidak perlu npm install)

# 1. Buat 5 akun
node src/cli.js create --count 5 --out accounts.json

# 2. (opsional) cek kesehatan
node src/cli.js verify --file accounts.json

# 3. Jalankan adapter OpenAI-compatible
node src/cli.js serve --port 8791 --file accounts.json

# 4. Daftarkan adapter ke 9Router
ROUTER_URL=http://127.0.0.1:20128 ROUTER_PASSWORD=123456 \
  node src/cli.js connect --adapter http://127.0.0.1:8791

# 5. Chat lewat 9Router
curl http://127.0.0.1:20128/v1/chat/completions \
  -H "Authorization: Bearer sk-..." -H "Content-Type: application/json" \
  -d '{"model":"ptero/ling-3.0-flash:free","messages":[{"role":"user","content":"hi"}]}'
```

Atau sekaligus:

```bash
COUNT=5 ROUTER_URL=http://127.0.0.1:20128 ROUTER_PASSWORD=123456 bash run.sh
```

## Referensi CLI

| Perintah | Keterangan |
|----------|------------|
| `create --count N [--out accounts.json] [--no-verify]` | Buat akun massal |
| `verify --file accounts.json` | Cek kesehatan semua akun |
| `list` | Daftar model |
| `serve [--port 8791] [--file accounts.json] [--pool 3]` | Jalankan adapter |
| `connect [--router URL] [--password PW] [--adapter URL]` | Daftarkan ke 9Router |
| `chat --file accounts.json [--model M] [--text "..."]` | Chat satu kali lewat pool |

## Menghubungkan ke 9router.com (hosted)

Konektor juga bekerja dengan layanan hosted. Karena adapter berjalan di mesin Anda,
ekspos dulu (mis. tunnel atau "custom base URL" 9Router yang bisa menjangkau host Anda),
lalu:

```bash
ROUTER_URL=https://9router.com ROUTER_PASSWORD='<password-anda>' \
  node src/cli.js connect --adapter https://<host-adapter-anda>/v1
```

## Opsional: harvest via browser asli

Secara default token dibuat offline (instan). Untuk membuktikan sesi asli dan mengambil
identitas dari cookie + `localStorage`:

```bash
HARVEST_VIA_BROWSER=1 CHROME_PATH=/path/ke/chrome node src/cli.js create --count 1
```

Ini menjalankan Chromium **lokal** (terdeteksi otomatis, atau set `CHROME_PATH`). Tidak
menyentuh profil browser harian Anda dan tanpa infrastruktur hosted.

## Cara kerjanya

```
9Router (/v1/chat/completions, model "ptero/*")
        │
        ▼
adapter.js  :8791  ── round-robin ──▶  pool identitas ptero
  • /v1/models                            (tiap akun = 1 juta token/jam)
  • /v1/chat/completions                  │
  • /pool, /health                        ▼
                                  ptero.pro /wp-json/mlp/v1/chat-stream (SSE)
```

1. **provision** membuat token hex acak 32 karakter + username tiap akun.
2. **pool** merotasi identitas dan menonaktifkan sementara yang gagal.
3. **adapter** menerjemahkan OpenAI ⇄ protokol SSE ptero.
4. **connect-9router** mendaftarkan adapter sebagai provider node `openai-compatible`.

## Struktur proyek

Lihat [`STRUCTURE.md`](STRUCTURE.md) untuk diagram lengkap.

## Catatan keamanan & privasi

- Akun bersifat anonim; tidak ada data pribadi.
- Token acak dan sekali pakai; perlakukan `accounts.json` sebagai file kredensial.
- Gunakan hanya pada layanan yang boleh Anda otomatiskan dan sesuai ketentuan layanannya.

## Lisensi

[MIT](LICENSE) © kontributor ptero-bulk-9router
