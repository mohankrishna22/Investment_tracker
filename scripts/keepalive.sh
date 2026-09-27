#!/usr/bin/env bash
#
# Pings the Supabase project so a free-tier project never pauses for inactivity.
# Reads credentials from a config file kept outside the repository, so nothing
# secret is ever committed.
#
# Run it by hand to test:   bash scripts/keepalive.sh
# Scheduled by:             scripts/install-keepalive-macos.sh (launchd), or cron.
#
# On macOS it posts a notification banner so a scheduled run is visible without
# going to look for it. Set KEEPALIVE_NOTIFY in the config file or environment:
#   always   (default) banner on every run, success or failure
#   failure  banner only when something is wrong
#   never    stay silent; the log still records every run

set -euo pipefail

CONFIG="${INVESTMENT_TRACKER_CONFIG:-$HOME/.config/investment-tracker/keepalive.env}"

if [ ! -f "$CONFIG" ]; then
  echo "No config at $CONFIG"
  echo "Run scripts/install-keepalive-macos.sh, or create it with:"
  echo "  SUPABASE_URL=https://xxxx.supabase.co"
  echo "  SUPABASE_ANON_KEY=eyJhbGci..."
  if [ "$(uname)" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
    osascript -e 'display notification "Keep-alive has no saved credentials. Re-run the installer." with title "Investment Tracker" sound name "Basso"' >/dev/null 2>&1 || true
  fi
  exit 1
fi

# shellcheck disable=SC1090
. "$CONFIG"

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "$CONFIG is missing SUPABASE_URL or SUPABASE_ANON_KEY"
  if [ "$(uname)" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
    osascript -e 'display notification "Keep-alive config is incomplete. Re-run the installer." with title "Investment Tracker" sound name "Basso"' >/dev/null 2>&1 || true
  fi
  exit 1
fi

NOTIFY="${KEEPALIVE_NOTIFY:-always}"

# AppleScript needs its own quotes and backslashes escaped, and notifications
# only exist on macOS — everywhere else this is a no-op.
notify() {
  local title="$1" message="$2" sound="${3:-}"
  [ "$(uname)" = "Darwin" ] || return 0
  command -v osascript >/dev/null 2>&1 || return 0
  local script="display notification \"${message//\"/\\\"}\" with title \"${title//\"/\\\"}\""
  if [ -n "$sound" ]; then
    script="$script sound name \"$sound\""
  fi
  osascript -e "$script" >/dev/null 2>&1 || true
}

should_notify() {
  # $1 is "success" or "failure"
  case "$NOTIFY" in
    never) return 1 ;;
    failure) [ "$1" = "failure" ] ;;
    *) return 0 ;;
  esac
}

fail() {
  echo "$1"
  if should_notify failure; then
    notify "Investment Tracker" "$2" "Basso"
  fi
  exit 1
}

url="${SUPABASE_URL%/}"
stamp=$(date '+%Y-%m-%d %H:%M:%S')
clock=$(date '+%H:%M')
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
  fail "$stamp  FAILED to reach $url (no network?)" \
    "Could not reach Supabase at $clock — no network, or the project is gone."
}

if [ "$status" = "200" ]; then
  echo "$stamp  OK — project is awake"
  if should_notify success; then
    notify "Investment Tracker" "Supabase pinged at $clock — sync stays awake."
  fi
else
  echo "$stamp  HTTP $status — project did not answer properly"
  cat "$body"
  if should_notify failure; then
    notify "Investment Tracker" \
      "Supabase answered HTTP $status at $clock. Check the project is not paused." "Basso"
  fi
  exit 1
fi
