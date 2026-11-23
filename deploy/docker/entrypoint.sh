#!/bin/sh
set -eu

exec node /opt/wcode/bin/wcode.mjs --web \
  --host "${WCODE_SERVER_HOST:-0.0.0.0}" \
  --port "${PORT:-3030}" \
  --workspace "${WCODE_SERVER_WORKSPACE:-/workspace}" \
  --no-open "$@"
