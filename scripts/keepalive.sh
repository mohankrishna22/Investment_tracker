#!/usr/bin/env bash
#
# Pings the Supabase project so a free-tier project never pauses for inactivity.
# Reads credentials from a config file kept outside the repository, so nothing
# secret is ever committed.
#
# Run it by hand to test:   bash scripts/keepalive.sh
# Scheduled by:             scripts/install-keepalive-macos.sh (launchd), or cron.

set -euo pipefail

CONFIG="${INVESTMENT_TRACKER_CONFIG:-$HOME/.config/investment-tracker/keepalive.env}"

if [ ! -f "$CONFIG" ]; then
  echo "No config at $CONFIG"
  echo "Run scripts/install-keepalive-macos.sh, or create it with:"
  echo "  SUPABASE_URL=https://xxxx.supabase.co"
  echo "  SUPABASE_ANON_KEY=eyJhbGci..."
  exit 1
fi

# shellcheck disable=SC1090
. "$CONFIG"

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "$CONFIG is missing SUPABASE_URL or SUPABASE_ANON_KEY"
  exit 1
fi

url="${SUPABASE_URL%/}"
stamp=$(date '+%Y-%m-%d %H:%M:%S')
body=$(mktemp)
trap 'rm -f "$body"' EXIT

# A read for a sync id that does not exist: returns an empty list, writes
# nothing, and still counts as activity — so the real sync id is never needed
# here and never has to be stored on disk.
status=$(curl -sS --max-time 30 -o "$body" -w '%{http_code}' \
  -X POST "$url/rest/v1/rpc/pull_snapshot" \
  -H 'Content-Type: application/json' \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"p_id":"local-keepalive"}' 2>&1) || {
  echo "$stamp  FAILED to reach $url (no network?)"
  exit 1
}

if [ "$status" = "200" ]; then
  echo "$stamp  OK — project is awake"
else
  echo "$stamp  HTTP $status — project did not answer properly"
  cat "$body"
  exit 1
fi
