#!/usr/bin/env bash
# ClawDesk — macOS installer
# Usage: bash install.sh
# Fetches the latest release from GitHub and installs ClawDesk to /Applications.

set -euo pipefail

REPO="lucvpgs/ClawDesk"
TMP="/tmp/ClawDesk-install.dmg"

echo "Fetching latest ClawDesk release..."
DMG_URL=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
assets = data.get('assets', [])
dmg = next((a['browser_download_url'] for a in assets if a['name'].endswith('.dmg')), None)
if not dmg:
    raise SystemExit('No .dmg found in latest release')
print(dmg)
")

echo "Downloading: $DMG_URL"
curl -fL -o "$TMP" "$DMG_URL"

echo "Mounting..."
hdiutil attach "$TMP" -nobrowse -quiet

echo "Installing to /Applications..."
cp -R /Volumes/ClawDesk/ClawDesk.app /Applications/

echo "Unmounting..."
hdiutil detach /Volumes/ClawDesk -quiet

echo "Cleaning up..."
rm -f "$TMP"

echo "Re-signing for local execution..."
codesign --force --deep --sign - /Applications/ClawDesk.app

echo "Done. Launch ClawDesk from /Applications."
