#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# ClawDesk release script
# Usage: ./scripts/release.sh
#
# Workflow:
#   1. Read version from tauri.conf.json
#   2. Build Next.js + Tauri .app
#   3. Pack .app → .tar.gz, sign with Ed25519 key
#   4. Generate latest.json for updater endpoint
#   5. Create GitHub release with all assets
#
# Requirements:
#   - ~/.tauri/clawdesk.key  (generated with: npx @tauri-apps/cli signer generate)
#   - gh CLI authenticated   (gh auth login)
#   - pnpm + cargo in PATH
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

REPO="lucvpgs/ClawDesk"
CONF="src-tauri/tauri.conf.json"
KEY="$HOME/.tauri/clawdesk.key"

# ── Version ───────────────────────────────────────────────────────────────────
VERSION=$(node -e "console.log(require('./$CONF').version)")
TAG="v$VERSION"
echo "▶ Building ClawDesk $TAG"

if git tag -l | grep -q "^$TAG$"; then
  echo "✗ Tag $TAG already exists. Bump the version in $CONF and Cargo.toml first."
  exit 1
fi

# ── Build ─────────────────────────────────────────────────────────────────────
echo "▶ Building Next.js..."
pnpm build

echo "▶ Building Tauri .app..."
PATH="$HOME/.cargo/bin:$PATH" pnpm tauri build --bundles app

BUNDLE_DIR="src-tauri/target/release/bundle/macos"
APP="$BUNDLE_DIR/ClawDesk.app"

# ── Pack + sign ───────────────────────────────────────────────────────────────
ARCH=$(uname -m)   # arm64 or x86_64
[ "$ARCH" = "arm64" ] && PLATFORM="darwin-aarch64" || PLATFORM="darwin-x86_64"

ASSET="ClawDesk_${VERSION}_${ARCH}.app.tar.gz"

echo "▶ Packing $ASSET..."
COPYFILE_DISABLE=1 tar -czf "$BUNDLE_DIR/$ASSET" -C "$BUNDLE_DIR" "ClawDesk.app"

echo "▶ Signing..."
TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
  npx @tauri-apps/cli signer sign "$BUNDLE_DIR/$ASSET"

SIG=$(cat "$BUNDLE_DIR/$ASSET.sig")
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── latest.json ───────────────────────────────────────────────────────────────
DIST="dist-release"
rm -rf "$DIST" && mkdir -p "$DIST"

cp "$BUNDLE_DIR/$ASSET"      "$DIST/$ASSET"
cp "$BUNDLE_DIR/$ASSET.sig"  "$DIST/$ASSET.sig"

cat > "$DIST/latest.json" <<JSON
{
  "version": "$VERSION",
  "notes": "See https://github.com/$REPO/blob/main/CHANGELOG.md",
  "pub_date": "$PUB_DATE",
  "platforms": {
    "$PLATFORM": {
      "signature": "$SIG",
      "url": "https://github.com/$REPO/releases/download/$TAG/$ASSET"
    }
  }
}
JSON

echo ""
echo "▶ latest.json:"
cat "$DIST/latest.json"
echo ""

# ── Git tag + push ────────────────────────────────────────────────────────────
echo "▶ Committing + tagging $TAG..."
git add -A
git diff --cached --quiet || git commit -m "chore: release $TAG"
git tag "$TAG"
git push origin main --tags

# ── GitHub release ────────────────────────────────────────────────────────────
# Extract changelog section for this version
NOTES=$(node -e "
  const fs = require('fs');
  const log = fs.readFileSync('CHANGELOG.md','utf8');
  const m = log.match(/## \[${VERSION}\][^\n]*\n([\s\S]*?)(?=\n## \[|\$)/);
  console.log(m ? m[1].trim() : 'See CHANGELOG.md');
")

echo "▶ Creating GitHub release $TAG..."
gh release create "$TAG" \
  --repo "$REPO" \
  --title "ClawDesk $TAG" \
  --notes "$NOTES" \
  "$DIST/$ASSET" \
  "$DIST/$ASSET.sig" \
  "$DIST/latest.json"

echo ""
echo "✅  ClawDesk $TAG released"
echo "    https://github.com/$REPO/releases/tag/$TAG"
echo ""
echo "    Updater endpoint:"
echo "    https://github.com/$REPO/releases/latest/download/latest.json"
