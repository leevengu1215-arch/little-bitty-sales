#!/bin/bash
cd "$(dirname "$0")" || exit 1
NODE="/Users/leevengu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
"$NODE" server.js &
SERVER_PID=$!
sleep 1
open "http://localhost:3000"
wait "$SERVER_PID"
