#!/usr/bin/env bash
# run.sh — one-shot: create accounts, start the adapter, connect to 9Router.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

COUNT="${COUNT:-5}"
ADAPTER_PORT="${ADAPTER_PORT:-8791}"
POOL_SIZE="${POOL_SIZE:-3}"
ROUTER_URL="${ROUTER_URL:-http://127.0.0.1:20128}"
ROUTER_PASSWORD="${ROUTER_PASSWORD:-123456}"
ACCOUNTS_FILE="${ACCOUNTS_FILE:-$DIR/accounts.json}"

echo "==> [1/4] creating $COUNT accounts"
node src/cli.js create --count "$COUNT" --out "$ACCOUNTS_FILE"

echo "==> [2/4] verifying accounts"
node src/cli.js verify --file "$ACCOUNTS_FILE" || true

echo "==> [3/4] starting adapter on :$ADAPTER_PORT"
setsid nohup env ADAPTER_PORT="$ADAPTER_PORT" ACCOUNTS_FILE="$ACCOUNTS_FILE" POOL_SIZE="$POOL_SIZE" \
  node src/adapter.js >> /tmp/ptero_adapter.log 2>&1 < /dev/null &
sleep 2
curl -s "http://127.0.0.1:$ADAPTER_PORT/health" && echo

echo "==> [4/4] connecting to 9Router at $ROUTER_URL"
ROUTER_URL="$ROUTER_URL" ROUTER_PASSWORD="$ROUTER_PASSWORD" ADAPTER_URL="http://127.0.0.1:$ADAPTER_PORT" \
  node src/connect-9router.js

echo "==> done."