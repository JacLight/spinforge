#!/bin/bash
# SpinBuild Mac runner installer
#
# Run on each Mac runner. Installs the agent at /opt/spinforge-runner,
# creates a config at ~/.spinforge-runner/config.json (from the example if
# missing), registers a LaunchAgent, and starts it.
#
# Prereqs on the target Mac:
#   - Node 20+ installed (brew install node)
#   - Tailscale installed and logged in on the cluster's tailnet
#   - Xcode installed + xcodebuild on PATH
#   - This repo checked out, or copy the building/runners/macos folder over

set -euo pipefail

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
INSTALL_DIR=${SPINFORGE_INSTALL_DIR:-/opt/spinforge-runner}
CONFIG_DIR="$HOME/.spinforge-runner"
CONFIG_FILE="$CONFIG_DIR/config.json"
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
PLIST_NAME="dev.spinforge.buildrunner.plist"
PLIST_DST="$LAUNCH_AGENT_DIR/$PLIST_NAME"

echo "==> Install dir: $INSTALL_DIR"
sudo mkdir -p "$INSTALL_DIR"
sudo chown "$USER" "$INSTALL_DIR"

echo "==> Copying runner sources..."
cp "$ROOT_DIR/agent.js" "$INSTALL_DIR/"
cp "$ROOT_DIR/package.json" "$INSTALL_DIR/"
rm -rf "$INSTALL_DIR/lib"
cp -R "$ROOT_DIR/lib" "$INSTALL_DIR/lib"

echo "==> Copying shared Fastfile..."
rm -rf "$INSTALL_DIR/fastlane"
mkdir -p "$INSTALL_DIR/fastlane"
cp "$ROOT_DIR/../../fastlane/Fastfile" "$INSTALL_DIR/fastlane/Fastfile"

echo "==> npm install..."
(cd "$INSTALL_DIR" && npm install --production)

echo "==> Ensuring fastlane gem is installed..."
if ! command -v fastlane >/dev/null 2>&1; then
  echo "    fastlane not found on PATH — installing via Homebrew..."
  brew install fastlane || {
    echo "    Homebrew install failed. Install fastlane manually before starting the runner:"
    echo "      sudo gem install fastlane -NV"
    exit 1
  }
fi

echo "==> Config dir: $CONFIG_DIR"
mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_FILE" ]; then
  cp "$ROOT_DIR/install/config.example.json" "$CONFIG_FILE"
  echo "    Created $CONFIG_FILE from example. EDIT IT before starting."
fi

echo "==> LaunchAgent: $PLIST_DST"
mkdir -p "$LAUNCH_AGENT_DIR"
# Render the plist with the actual install dir.
sed \
  -e "s|/opt/spinforge-runner|$INSTALL_DIR|g" \
  -e "s|/Users/runner/.spinforge-runner|$CONFIG_DIR|g" \
  "$ROOT_DIR/install/$PLIST_NAME" > "$PLIST_DST"

echo "==> Loading LaunchAgent..."
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo ""
echo "Done. Logs:"
echo "  tail -f /var/log/spinforge-runner.log /var/log/spinforge-runner.err"
echo ""
echo "To stop:"
echo "  launchctl unload $PLIST_DST"
