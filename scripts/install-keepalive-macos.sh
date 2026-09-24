#!/usr/bin/env bash
#
# Installs a launchd agent on macOS that pings Supabase once a day, keeping a
# free-tier project from pausing. launchd is used rather than cron because it
# catches up on a run the Mac slept through, which cron does not.
#
#   bash scripts/install-keepalive-macos.sh
#
# Undo with scripts/uninstall-keepalive-macos.sh.

set -euo pipefail

LABEL="local.investment-tracker.keepalive"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
CONFIG_DIR="$HOME/.config/investment-tracker"
CONFIG="$CONFIG_DIR/keepalive.env"
LOG="$HOME/Library/Logs/investment-tracker-keepalive.log"
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/keepalive.sh"

# The hour is configurable so the ping lands when the Mac is usually awake.
HOUR="${KEEPALIVE_HOUR:-12}"
MINUTE="${KEEPALIVE_MINUTE:-30}"

if [ "$(uname)" != "Darwin" ]; then
  echo "This installer is for macOS. On Linux, add a cron line instead:"
  echo "  30 12 * * * $SCRIPT_PATH >> ~/investment-tracker-keepalive.log 2>&1"
  exit 1
fi

mkdir -p "$CONFIG_DIR" "$(dirname "$PLIST")" "$(dirname "$LOG")"

if [ -f "$CONFIG" ]; then
  echo "Using existing credentials at $CONFIG"
else
  echo "Paste the two values from Supabase → Project Settings → API."
  echo
  read -r -p "Project URL (https://xxxx.supabase.co): " url
  read -r -p "Anon public key: " key
  umask 077
  cat > "$CONFIG" <<EOF
SUPABASE_URL=$url
SUPABASE_ANON_KEY=$key
EOF
  chmod 600 "$CONFIG"
  echo "Saved to $CONFIG (readable only by you)."
fi

echo
echo "Testing the ping before scheduling it…"
if ! bash "$SCRIPT_PATH"; then
  echo
  echo "The test failed, so nothing was scheduled. Check the URL and key in $CONFIG."
  exit 1
fi

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SCRIPT_PATH</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>$HOUR</integer>
    <key>Minute</key>
    <integer>$MINUTE</integer>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
</dict>
</plist>
EOF

# bootout first so re-running the installer updates a previous version cleanly.
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if ! launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null; then
  # Fall back to the older API on macOS versions that lack bootstrap.
  launchctl load -w "$PLIST"
fi

echo
echo "Scheduled. It runs daily at $(printf '%02d:%02d' "$HOUR" "$MINUTE"), and at login."
echo "  Log:      $LOG"
echo "  Status:   launchctl list | grep investment-tracker"
echo "  Run now:  launchctl kickstart gui/$(id -u)/$LABEL"
echo "  Remove:   bash scripts/uninstall-keepalive-macos.sh"
