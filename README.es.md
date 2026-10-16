<div align="center">

<img src="brand/logo.svg" alt="ptero-bulk-9router" width="460">

# ptero-bulk-9router

**Crea cuentas anónimas de [ptero.pro](https://ptero.pro/) en masa, recoge automáticamente sus
tokens y cookies de sesión, y sírvelas a [9Router](https://9router.com) como un pool
OpenAI-compatible auto-reparable y con balanceo de carga.**

Cero dependencias · Node 18+ · MIT

[![License](https://img.shields.io/badge/license-MIT-19c37d?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-19c37d?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/dependencies-0-19c37d?style=flat-square)](#)
[![9Router](https://img.shields.io/badge/9Router-openai--compatible-58a6ff?style=flat-square)](https://9router.com)
[![ptero.pro](https://img.shields.io/badge/ptero.pro-anonymous%20guest-19c37d?style=flat-square)](https://ptero.pro)
[![Models](https://img.shields.io/badge/models-6-d29922?style=flat-square)](#modelos)
[![Status](https://img.shields.io/badge/status-verified%20e2e-19c37d?style=flat-square)](#verificado)

[English](README.md) · [Indonesia](README.id.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [Español](README.es.md)

</div>

---

## ¿Qué es esto?

[ptero.pro](https://ptero.pro/) es un sitio de chat con IA gratuito y totalmente
**anónimo**. Una "cuenta" es solo un token hexadecimal aleatorio de 32 caracteres que el
navegador genera localmente — **sin registro, sin email, sin contraseña**, y el token no
está ligado a la IP. Este toolkit:

1. **Crea en masa** cualquier número de identidades ptero (HTTP puro, instantáneo).
2. **Recoge** cada token y la cookie de sesión `mlp_ai_guest_token`.
3. **Agrupa** todo en un adaptador auto-reparable, round-robin y con failover.
4. **Conecta** ese adaptador a **9Router** como proveedor OpenAI-compatible.

Cada identidad obtiene su propio cupo de **1,000,000 tokens/hora**, así que agrupar
multiplica tu rendimiento gratuito.

> Verificado de extremo a extremo contra un 9Router real: listado de modelos, streaming,
> no-streaming, round-robin y failover, todo pasa. Ver [`docs/PROTOCOL.md`](docs/PROTOCOL.md).

## Características

- **Cero dependencias** — solo `fetch`, `http`, `crypto` nativos de Node.
- **Provisionamiento masivo instantáneo** — el flujo central no necesita navegador.
- **Pool auto-reparable** — rotación round-robin, enfriamiento automático y failover.
- **Streaming + no-streaming** de chat completions OpenAI.
- **Recogida opcional por navegador** — lanza un Chromium local para probar la sesión.
- **Conexión en un comando** — registra el provider node, el provider y la API key.
- **Local u hospedado** — apúntalo a `http://127.0.0.1:20128` o `https://9router.com`.

## Modelos

Los seis modelos de ptero están expuestos (prefijo `ptero/` en 9Router):

| Model id | Etiqueta | 9Router id | Imágenes |
|----------|----------|------------|:--------:|
| `ling-3.0-flash:free` | Ling 3.0 Flash (por defecto) | `ptero/ling-3.0-flash:free` | |
| `deepseek-v4.1-flash:free` | Deepseek v4.1 Flash | `ptero/deepseek-v4.1-flash:free` | ✅ |
| `mistral-nemo:minirouter` | Mistral Nemo 12B | `ptero/mistral-nemo:minirouter` | |
| `glm-5.3-flash` | GLM 5.3 Flash | `ptero/glm-5.3-flash` | |
| `gpt-oss-20b` | GPT-OSS 20B | `ptero/gpt-oss-20b` | |
| `apodex-1.1-mini:free` | Apodex 1.1 Mini | `ptero/apodex-1.1-mini:free` | |

También funcionan alias cortos: `ling`, `deepseek`, `mistral`, `glm`, `gpt-oss`, `apodex`.

## Inicio rápido

```bash
# 0. Requisito: Node 18+  (no necesitas npm install)

# 1. Crea 5 cuentas
node src/cli.js create --count 5 --out accounts.json

# 2. (opcional) comprueba su estado
node src/cli.js verify --file accounts.json

# 3. Inicia el adaptador OpenAI-compatible
node src/cli.js serve --port 8791 --file accounts.json

# 4. Registra el adaptador en 9Router
ROUTER_URL=http://127.0.0.1:20128 ROUTER_PASSWORD=123456 \
  node src/cli.js connect --adapter http://127.0.0.1:8791

# 5. Chatea a través de 9Router
curl http://127.0.0.1:20128/v1/chat/completions \
  -H "Authorization: Bearer sk-..." -H "Content-Type: application/json" \
  -d '{"model":"ptero/ling-3.0-flash:free","messages":[{"role":"user","content":"hi"}]}'
```

O todo de una vez:

```bash
COUNT=5 ROUTER_URL=http://127.0.0.1:20128 ROUTER_PASSWORD=123456 bash run.sh
```

## Referencia de la CLI

| Comando | Descripción |
|---------|-------------|
| `create --count N [--out accounts.json] [--no-verify]` | Crear cuentas en masa |
| `verify --file accounts.json` | Comprobar el estado de todas |
| `list` | Listar modelos |
| `serve [--port 8791] [--file accounts.json] [--pool 3]` | Ejecutar el adaptador |
| `connect [--router URL] [--password PW] [--adapter URL]` | Registrar en 9Router |
| `chat --file accounts.json [--model M] [--text "..."]` | Chat puntual vía pool |

## Conectar a 9router.com (hospedado)

El conector también funciona con el servicio hospedado. Como el adaptador corre en tu
máquina, expórtalo primero (p. ej. un túnel o la "custom base URL" de 9Router que alcance
tu host) y luego:

```bash
ROUTER_URL=https://9router.com ROUTER_PASSWORD='<tu-contraseña>' \
  node src/cli.js connect --adapter https://<host-de-tu-adaptador>/v1
```

## Opcional: recogida con navegador real

Por defecto los tokens se generan offline (instantáneo). Para probar una sesión real y
recoger la identidad desde cookies + `localStorage`:

```bash
HARVEST_VIA_BROWSER=1 CHROME_PATH=/ruta/a/chrome node src/cli.js create --count 1
```

Lanza un Chromium **local** (autodetectado, o define `CHROME_PATH`). Nunca toca tu perfil
de navegador habitual y no necesita infraestructura hospedada.

## Cómo funciona

```
9Router (/v1/chat/completions, modelo "ptero/*")
        │
        ▼
adapter.js  :8791  ── round-robin ──▶  pool de identidades ptero
  • /v1/models                           (cada = 1M tokens/hora)
  • /v1/chat/completions                 │
  • /pool, /health                       ▼
                                ptero.pro /wp-json/mlp/v1/chat-stream (SSE)
```

1. **provision** genera un token hex aleatorio de 32 caracteres + usuario por cuenta.
2. **pool** rota identidades y enfría las que fallan.
3. **adapter** traduce OpenAI ⇄ el protocolo SSE de ptero.
4. **connect-9router** registra el adaptador como provider node `openai-compatible`.

## Estructura del proyecto

Consulta [`STRUCTURE.md`](STRUCTURE.md) para el diagrama completo.

## Notas de seguridad y privacidad

- Las cuentas son anónimas; no hay datos personales.
- Los tokens son aleatorios y desechables; trata `accounts.json` como un archivo de
  credenciales.
- Úsalo solo contra servicios que tengas permitido automatizar y conforme a sus términos.

## Licencia

[MIT](LICENSE) © contribuidores de ptero-bulk-9router
