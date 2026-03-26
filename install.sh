#!/usr/bin/env bash
# ClawDesk installer — macOS (Apple Silicon + Intel), Linux, Windows (Git Bash)
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/lucvpgs/ClawDesk/main/install.sh)

set -euo pipefail

REPO="lucvpgs/ClawDesk"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64)  ASSET_PATTERN="aarch64.dmg" ;;
      x86_64) ASSET_PATTERN="x64.dmg" ;;
      *)      echo "Unsupported macOS architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      x86_64) ASSET_PATTERN="amd64.AppImage" ;;
      aarch64) ASSET_PATTERN="aarch64.AppImage" ;;
      *)      echo "Unsupported Linux architecture: $ARCH"; exit 1 ;;
    esac
    ;;
  MINGW*|MSYS*|CYGWIN*)
    ASSET_PATTERN=".exe"
    ;;
  *)
    echo "Unsupported OS: $OS"
    exit 1
    ;;
esac

echo "Detected: $OS / $ARCH"
echo "Fetching latest ClawDesk release..."

ASSET_URL=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
assets = data.get('assets', [])
pattern = '${ASSET_PATTERN}'
match = next((a['browser_download_url'] for a in assets if pattern in a['name']), None)
if not match:
    print('Available assets:', [a['name'] for a in assets], file=sys.stderr)
    raise SystemExit('No matching asset found for pattern: ' + pattern)
print(match)
")

echo "Downloading: $ASSET_URL"

case "$OS" in
  Darwin)
    TMP="/tmp/ClawDesk-install.dmg"
    curl -fL -o "$TMP" "$ASSET_URL"
    echo "Mounting..."
    MOUNT_OUTPUT=$(hdiutil attach "$TMP" -nobrowse -quiet)
    MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep -oE '/Volumes/[^\t]+' | tail -1 | tr -d '[:space:]')
    echo "Installing to /Applications..."
    cp -R "${MOUNT_POINT}/ClawDesk.app" /Applications/
    echo "Unmounting..."
    hdiutil detach "$MOUNT_POINT" -quiet
    rm -f "$TMP"
    echo "Re-signing for local execution..."
    codesign --force --deep --sign - /Applications/ClawDesk.app
    echo "Done. Launch ClawDesk from /Applications."
    ;;
  Linux)
    DEST="$HOME/.local/bin/ClawDesk.AppImage"
    mkdir -p "$HOME/.local/bin"
    curl -fL -o "$DEST" "$ASSET_URL"
    chmod +x "$DEST"
    echo "Done. Run: $DEST"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    TMP="$TEMP/ClawDesk-install.exe"
    curl -fL -o "$TMP" "$ASSET_URL"
    echo "Launching installer..."
    start "" "$TMP"
    ;;
esac
