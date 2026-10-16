<div align="center">

<img src="brand/logo.svg" alt="ptero-bulk-9router" width="460">

# ptero-bulk-9router

**[ptero.pro](https://ptero.pro/) の匿名アカウントを一括作成し、token とセッション Cookie を
自動収集して、自己修復・負荷分散された OpenAI 互換プールとして
[9Router](https://9router.com) に接続します。**

依存ゼロ · Node 18+ · MIT

[![License](https://img.shields.io/badge/license-MIT-19c37d?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-19c37d?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-19c37d?style=flat-square)](#)
[![9Router](https://img.shields.io/badge/9Router-openai--compatible-58a6ff?style=flat-square)](https://9router.com)
[![ptero.pro](https://img.shields.io/badge/ptero.pro-anonymous%20guest-19c37d?style=flat-square)](https://ptero.pro)
[![Models](https://img.shields.io/badge/models-6-d29922?style=flat-square)](#モデル)
[![Status](https://img.shields.io/badge/status-verified%20e2e-19c37d?style=flat-square)](#検証済み)

[English](README.md) · [Indonesia](README.id.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)

</div>

---

## これは何？

[ptero.pro](https://ptero.pro/) は無料で完全に**匿名**の AI チャットサイトです。「アカウント」は
ブラウザがローカルで生成する 32 文字のランダムな hex トークンにすぎません —— **登録・メール・
パスワードは一切不要**で、トークンは IP に紐づきません。このツールキットは：

1. 任意個の ptero アイデンティティを**一括作成**（純粋な HTTP、即時）。
2. 各トークンと `mlp_ai_guest_token` セッション Cookie を**収集**。
3. 自己修復・ラウンドロビン・フェイルオーバーなアダプタに**プール**。
4. それを OpenAI 互換プロバイダとして **9Router に接続**。

各アイデンティティは独自の **1,000,000 token/時** バケットを持ち、プール化で無料スループットが
倍増します。

> 実際の 9Router でエンドツーエンド検証済み：モデル一覧、ストリーミング、非ストリーミング、
> ラウンドロビン、フェイルオーバーすべて合格。詳細は [`docs/PROTOCOL.md`](docs/PROTOCOL.md)。

## 特徴

- **依存ゼロ** —— Node 内蔵の `fetch`、`http`、`crypto` のみ。
- **即時の一括作成** —— コアフローにブラウザ不要。
- **自己修復プール** —— ラウンドロビン、自動クールダウン、フェイルオーバー。
- **ストリーミング + 非ストリーミング** の OpenAI チャット補完。
- **任意のブラウザ収集** —— ローカル Chromium を起動して実セッションを検証。
- **コマンド 1 つで接続** —— provider ノード、provider、API キーを自動登録。
- **ローカル / ホスト** —— `http://127.0.0.1:20128` または `https://9router.com` に対応。

## モデル

ptero の 6 モデルすべてを公開（9Router ではプレフィックス `ptero/`）：

| モデル id | ラベル | 9Router id | 画像 |
|-----------|--------|------------|:----:|
| `ling-3.0-flash:free` | Ling 3.0 Flash（既定） | `ptero/ling-3.0-flash:free` | |
| `deepseek-v4.1-flash:free` | Deepseek v4.1 Flash | `ptero/deepseek-v4.1-flash:free` | ✅ |
| `mistral-nemo:minirouter` | Mistral Nemo 12B | `ptero/mistral-nemo:minirouter` | |
| `glm-5.3-flash` | GLM 5.3 Flash | `ptero/glm-5.3-flash` | |
| `gpt-oss-20b` | GPT-OSS 20B | `ptero/gpt-oss-20b` | |
| `apodex-1.1-mini:free` | Apodex 1.1 Mini | `ptero/apodex-1.1-mini:free` | |

短縮エイリアスも可：`ling`、`deepseek`、`mistral`、`glm`、`gpt-oss`、`apodex`。

## クイックスタート

```bash
# 0. 必要環境: Node 18+  (npm install 不要)

# 1. アカウントを 5 個作成
node src/cli.js create --count 5 --out accounts.json

# 2. (任意) ヘルスチェック
node src/cli.js verify --file accounts.json

# 3. OpenAI 互換アダプタを起動
node src/cli.js serve --port 8791 --file accounts.json

# 4. 9Router に登録
ROUTER_URL=http://127.0.0.1:20128 ROUTER_PASSWORD=123456 \
  node src/cli.js connect --adapter http://127.0.0.1:8791

# 5. 9Router 経由でチャット
curl http://127.0.0.1:20128/v1/chat/completions \
  -H "Authorization: Bearer sk-..." -H "Content-Type: application/json" \
  -d '{"model":"ptero/ling-3.0-flash:free","messages":[{"role":"user","content":"hi"}]}'
```

まとめて実行：

```bash
COUNT=5 ROUTER_URL=http://127.0.0.1:20128 ROUTER_PASSWORD=123456 bash run.sh
```

## CLI リファレンス

| コマンド | 説明 |
|----------|------|
| `create --count N [--out accounts.json] [--no-verify]` | アカウント一括作成 |
| `verify --file accounts.json` | 全アカウントのヘルスチェック |
| `list` | モデル一覧 |
| `serve [--port 8791] [--file accounts.json] [--pool 3]` | アダプタ起動 |
| `connect [--router URL] [--password PW] [--adapter URL]` | 9Router に登録 |
| `chat --file accounts.json [--model M] [--text "..."]` | プール経由で単発チャット |

## 9router.com（ホスト）への接続

コネクタはホスト版でも動作します。アダプタはあなたのマシンで動くので、まず公開し
（トンネル、またはあなたのホストに到達できる 9Router の "custom base URL" など）、次に：

```bash
ROUTER_URL=https://9router.com ROUTER_PASSWORD='<あなたのパスワード>' \
  node src/cli.js connect --adapter https://<あなたのアダプタホスト>/v1
```

## 任意：実ブラウザで収集

既定ではトークンをオフライン生成（即時）。実セッションを検証し、Cookie + `localStorage` から
アイデンティティを収集するには：

```bash
HARVEST_VIA_BROWSER=1 CHROME_PATH=/path/to/chrome node src/cli.js create --count 1
```

**ローカル** Chromium を起動します（自動検出、または `CHROME_PATH` を設定）。日常使いの
ブラウザプロファイルには触れず、ホスト型インフラも不要です。

## 仕組み

```
9Router (/v1/chat/completions, モデル "ptero/*")
        │
        ▼
adapter.js  :8791  ── ラウンドロビン ──▶  ptero アイデンティティプール
  • /v1/models                             (各 = 100 万 token/時)
  • /v1/chat/completions                   │
  • /pool, /health                         ▼
                                  ptero.pro /wp-json/mlp/v1/chat-stream (SSE)
```

1. **provision** が 32 文字のランダム hex トークン + ユーザー名を生成。
2. **pool** がアイデンティティをローテーションし、失敗したものをクールダウン。
3. **adapter** が OpenAI ⇄ ptero の SSE プロトコルを変換。
4. **connect-9router** がアダプタを `openai-compatible` provider ノードとして登録。

## プロジェクト構成

完全な図は [`STRUCTURE.md`](STRUCTURE.md) を参照。

## セキュリティとプライバシー

- アカウントは匿名で、個人データは関与しません。
- トークンはランダムで使い捨て。`accounts.json` は認証情報ファイルとして扱ってください。
- 自動化が許可されたサービスにのみ、利用規約に従って使用してください。

## ライセンス

[MIT](LICENSE) © ptero-bulk-9router contributors
