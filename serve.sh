#!/usr/bin/env bash
# Ruleaza demo-ul local fara Docker. Nu are nevoie de nimic instalat in plus.
set -euo pipefail
cd "$(dirname "$0")/site"
PORT="${1:-8080}"

echo ""
echo "  MedClyn demo  ->  http://localhost:${PORT}"
echo "  Ctrl+C ca sa opresti."
echo ""

# deschide browserul dupa ce serverul a pornit
( sleep 1; command -v open >/dev/null && open "http://localhost:${PORT}" ) &

exec python3 -m http.server "$PORT" --bind 127.0.0.1
