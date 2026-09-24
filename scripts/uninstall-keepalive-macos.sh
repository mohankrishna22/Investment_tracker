#!/usr/bin/env bash
# Removes the daily Supabase ping. Leaves the saved credentials in place unless
# you pass --purge.

set -euo pipefail

LABEL="local.investment-tracker.keepalive"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
CONFIG="$HOME/.config/investment-tracker/keepalive.env"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload -w "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Unscheduled and removed $PLIST"

if [ "${1:-}" = "--purge" ]; then
  rm -f "$CONFIG"
  echo "Deleted $CONFIG"
else
  echo "Credentials left at $CONFIG (pass --purge to delete them too)."
fi
