<div align="center">

<img src="brand/logo.svg" alt="ptero-bulk-9router" width="460">

# ptero-bulk-9router

**批量创建 [ptero.pro](https://ptero.pro/) 匿名账号，自动抓取其 token 与会话 Cookie，
并以自愈、负载均衡的 OpenAI 兼容池接入 [9Router](https://9router.com)。**

零依赖 · Node 18+ · MIT

[![License](https://img.shields.io/badge/license-MIT-19c37d?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-19c37d?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-19c37d?style=flat-square)](#)
[![9Router](https://img.shields.io/badge/9Router-openai--compatible-58a6ff?style=flat-square)](https://9router.com)
[![ptero.pro](https://img.shields.io/badge/ptero.pro-anonymous%20guest-19c37d?style=flat-square)](https://ptero.pro)
[![Models](https://img.shields.io/badge/models-6-d29922?style=flat-square)](#模型)
[![Status](https://img.shields.io/badge/status-verified%20e2e-19c37d?style=flat-square)](#验证)

[English](README.md) · [Indonesia](README.id.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)

</div>

---

## 这是什么？

[ptero.pro](https://ptero.pro/) 是一个免费、完全**匿名**的 AI 聊天站点。"账号"只是浏览器
本地生成的 32 位十六进制随机 token —— **无需注册、无需邮箱、无需密码**，且 token 不绑定 IP。
本工具包可以：

1. **批量创建**任意数量的 ptero 身份（纯 HTTP，瞬时完成）。
2. **抓取**每个 token 及 `mlp_ai_guest_token` 会话 Cookie。
3. **聚合**为自愈、轮询、故障转移的适配器。
4. **接入** 9Router，作为 OpenAI 兼容的 provider。

每个身份拥有独立的 **1,000,000 token/小时** 配额，池化后免费吞吐量成倍提升。

> 已在实时 9Router 上完成端到端验证：模型列表、流式、非流式、轮询与故障转移全部通过。
> 详见 [`docs/PROTOCOL.md`](docs/PROTOCOL.md)。

## 特性

- **零依赖** —— 仅使用 Node 内置的 `fetch`、`http`、`crypto`。
- **瞬时批量创建** —— 核心流程无需浏览器。
- **自愈池** —— 轮询选择、自动冷却与故障转移。
- **流式 + 非流式** OpenAI 聊天补全。
- **可选浏览器抓取** —— 驱动本地 Chromium 以验证真实会话。
- **一条命令接入** —— 自动注册 provider 节点、provider 与 API key。
- **本地或托管** —— 指向 `http://127.0.0.1:20128` 或 `https://9router.com`。

## 模型

六个 ptero 模型全部可用（9Router 中前缀 `ptero/`）：

| 模型 id | 名称 | 9Router id | 图片 |
|---------|------|------------|:----:|
| `ling-3.0-flash:free` | Ling 3.0 Flash（默认） | `ptero/ling-3.0-flash:free` | |
| `deepseek-v4.1-flash:free` | Deepseek v4.1 Flash | `ptero/deepseek-v4.1-flash:free` | ✅ |
| `mistral-nemo:minirouter` | Mistral Nemo 12B | `ptero/mistral-nemo:minirouter` | |
| `glm-5.3-flash` | GLM 5.3 Flash | `ptero/glm-5.3-flash` | |
| `gpt-oss-20b` | GPT-OSS 20B | `ptero/gpt-oss-20b` | |
| `apodex-1.1-mini:free` | Apodex 1.1 Mini | `ptero/apodex-1.1-mini:free` | |

也支持短别名：`ling`、`deepseek`、`mistral`、`glm`、`gpt-oss`、`apodex`。

## 快速开始

```bash
# 0. 需要 Node 18+  （无需 npm install）

# 1. 创建 5 个账号
node src/cli.js create --count 5 --out accounts.json

# 2. （可选）健康检查
node src/cli.js verify --file accounts.json

# 3. 启动 OpenAI 兼容适配器
node src/cli.js serve --port 8791 --file accounts.json

# 4. 在 9Router 中注册
ROUTER_URL=http://127.0.0.1:20128 ROUTER_PASSWORD=123456 \
  node src/cli.js connect --adapter http://127.0.0.1:8791

# 5. 通过 9Router 聊天
curl http://127.0.0.1:20128/v1/chat/completions \
  -H "Authorization: Bearer sk-..." -H "Content-Type: application/json" \
  -d '{"model":"ptero/ling-3.0-flash:free","messages":[{"role":"user","content":"hi"}]}'
```

或一步到位：

```bash
COUNT=5 ROUTER_URL=http://127.0.0.1:20128 ROUTER_PASSWORD=123456 bash run.sh
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `create --count N [--out accounts.json] [--no-verify]` | 批量创建账号 |
| `verify --file accounts.json` | 健康检查所有账号 |
| `list` | 列出模型 |
| `serve [--port 8791] [--file accounts.json] [--pool 3]` | 运行适配器 |
| `connect [--router URL] [--password PW] [--adapter URL]` | 注册到 9Router |
| `chat --file accounts.json [--model M] [--text "..."]` | 通过池单次聊天 |

## 接入 9router.com（托管）

连接器同样支持托管服务。由于适配器运行在你的机器上，请先暴露它（例如隧道，或使用能访问
你主机的 9Router "custom base URL"），然后：

```bash
ROUTER_URL=https://9router.com ROUTER_PASSWORD='<你的密码>' \
  node src/cli.js connect --adapter https://<你的适配器主机>/v1
```

## 可选：通过真实浏览器抓取

默认离线生成 token（瞬时）。若要验证真实会话并从 Cookie + `localStorage` 抓取身份：

```bash
HARVEST_VIA_BROWSER=1 CHROME_PATH=/路径/chrome node src/cli.js create --count 1
```

会启动**本地** Chromium（自动检测，或设置 `CHROME_PATH`）。绝不触碰你的日常浏览器配置，
也不依赖任何托管基础设施。

## 工作原理

```
9Router (/v1/chat/completions, 模型 "ptero/*")
        │
        ▼
adapter.js  :8791  ── 轮询 ──▶  ptero 身份池
  • /v1/models                     （每个 = 100 万 token/小时）
  • /v1/chat/completions           │
  • /pool, /health                 ▼
                          ptero.pro /wp-json/mlp/v1/chat-stream (SSE)
```

1. **provision** 为每个账号生成 32 位随机十六进制 token + 用户名。
2. **pool** 轮换身份，并冷却失败的成员。
3. **adapter** 在 OpenAI 与 ptero 的 SSE 协议之间转换。
4. **connect-9router** 将适配器注册为 `openai-compatible` provider 节点。

## 项目结构

完整图示见 [`STRUCTURE.md`](STRUCTURE.md)。

## 安全与隐私

- 账号完全匿名，不涉及任何个人数据。
- Token 随机且一次性；请把 `accounts.json` 视为凭据文件。
- 仅在你获准自动化的服务上使用，并遵守其服务条款。

## 许可证

[MIT](LICENSE) © ptero-bulk-9router 贡献者
