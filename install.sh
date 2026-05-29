#!/usr/bin/env bash
# WM 2026 Widget — one-shot installer
set -euo pipefail

WIDGET_DIR="$HOME/.wm2026"
UEBERSICHT_DIR="$HOME/Library/Application Support/Übersicht/widgets"

echo "⚽  WM 2026 Widget Installer"
echo "----------------------------"

# 1. Check for Übersicht
if [ ! -d "$UEBERSICHT_DIR" ]; then
  echo "❌  Übersicht not found at: $UEBERSICHT_DIR"
  echo "    Download it from https://tracesof.net/uebersicht/ and try again."
  exit 1
fi

# 2. Check for mpv
if ! command -v mpv &>/dev/null && [ ! -f /opt/homebrew/bin/mpv ]; then
  echo "⚠️   mpv not found. Install it with: brew install mpv"
  echo "    (Live audio streams will not work without mpv)"
fi

# 3. Create data directory
mkdir -p "$WIDGET_DIR"

# 4. Copy backend files
echo "→  Copying backend files to $WIDGET_DIR …"
cp engine.py          "$WIDGET_DIR/engine.py"
cp wm2026_server.py   "$WIDGET_DIR/wm2026_server.py"
cp sources.json       "$WIDGET_DIR/sources.json"

# 5. Copy shift config example (only if not already customised)
if [ ! -f "$WIDGET_DIR/shift_config.json" ]; then
  cp shift_config.example.json "$WIDGET_DIR/shift_config.example.json"
fi

# 6. Copy widget to Übersicht
echo "→  Copying widget to Übersicht …"
cp wm2026.jsx "$UEBERSICHT_DIR/wm2026.jsx"

# 7. Install Python dependencies
echo "→  Installing Python dependencies …"
pip3 install --quiet -r requirements.txt

echo ""
echo "✅  Done! Now:"
echo "   1. Restart Übersicht (or run 'Refresh All Widgets')"
echo "   2. The server starts automatically on first widget load"
echo ""
echo "Optional — desktop icon shift:"
echo "   cp $WIDGET_DIR/shift_config.example.json $WIDGET_DIR/shift_config.json"
echo "   then edit the icon names and pixel positions to match your desktop."
