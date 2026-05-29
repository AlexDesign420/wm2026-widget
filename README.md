# ⚽ WM 2026 — macOS Desktop Widget

> A real-time FIFA World Cup 2026 sidebar widget for [Übersicht](https://tracesof.net/uebersicht/) on macOS.  
> Live scores · Full schedule · 20+ radio streams · German TTS commentary — all in one slick dark panel.

![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)
![Übersicht](https://img.shields.io/badge/Übersicht-widget-blue)
![Python](https://img.shields.io/badge/python-3.9%2B-yellow?logo=python)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

| | |
|---|---|
| 🔴 **Live scores** | Updates every 3 seconds via the ESPN API |
| 📅 **Full schedule** | All 104 games grouped by day, with venues and round labels |
| 📻 **20+ radio streams** | ARD, ZDF, BBC, NPR and more — played via mpv |
| 🗣 **German TTS** | macOS `say` announces goals, kick-offs and final whistles |
| 📊 **Play-by-play** | ESPN event feed with goal / card / substitution highlights |
| 📺 **Live ticker panel** | Slide-out side panel with real-time scores for all live games |
| ⏳ **Countdown** | Days · Hours · Minutes until the tournament kicks off |
| 🙈 **Hide / show** | Collapse the whole widget to a minimal notch — one click to restore |
| 🖥 **Responsive** | Adapts width for 1440p · 1920p · 2560p · 4K displays |
| ⚙️ **Configurable streams** | Add or swap radio sources in `sources.json` |
| 🖱 **Desktop icon shift** | Optionally moves Finder desktop icons aside when the ticker panel opens |

---

## Screenshot

> _Add a screenshot here — `docs/screenshot.png` — after installing._  
> Tip: `screencapture -x docs/screenshot.png` while the widget is visible.

---

## Architecture

```
wm2026.jsx          ← Übersicht widget (JSX / React-like)
  │  shell command every 3 s
  │    └─ curl ESPN API  →  today.json / schedule.json
  │    └─ python3 engine.py  →  feed.json, state.json
  │
  └─ fetch() every 3 s  →  wm2026_server.py  (Flask, port 9876)
       ├─ /api/status        current mpv state
       ├─ /api/play          start a stream
       ├─ /api/stop          stop mpv
       ├─ /api/volume        adjust volume
       ├─ /api/streams       available / reachable streams
       ├─ /api/ticker        live scoreboard (ESPN, 30 s cache)
       ├─ /api/commentary    ESPN play-by-play (live games only)
       ├─ /api/comments      kicker.de live-ticker scrape (45 s)
       └─ /api/shift         move Finder desktop icons (optional)
```

Data files live in `~/.wm2026/` and are **never** committed (see `.gitignore`).

---

## Requirements

| Tool | Notes |
|------|-------|
| **macOS 12+** | Uses `say`, `afplay`, AppleScript |
| **[Übersicht](https://tracesof.net/uebersicht/)** | Free macOS widget host |
| **Python 3.9+** | Comes with macOS, or via `brew install python` |
| **[mpv](https://mpv.io)** | Audio playback · `brew install mpv` |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/AlexDesign420/wm2026-widget.git
cd wm2026-widget

# 2. Install
./install.sh

# 3. Restart Übersicht (or "Refresh All Widgets")
```

The server starts automatically the first time the widget loads.

---

## Manual Install

If you prefer to install step by step:

```bash
# Create data directory
mkdir -p ~/.wm2026

# Copy backend
cp engine.py wm2026_server.py sources.json ~/.wm2026/

# Copy widget
cp wm2026.jsx ~/Library/Application\ Support/Übersicht/widgets/

# Install Python deps
pip3 install flask requests beautifulsoup4
```

---

## Configuration

### Adding or changing streams

Edit `sources.json` (or `~/.wm2026/sources.json` after install).  
Each entry is either a `static` URL or a `scrape` target:

```jsonc
{
  "id": "my-station",
  "name": "My Radio",
  "country": "DE",
  "language": "de",
  "type": "static",
  "url": "https://example.com/stream.mp3"
}
```

The server checks all streams in parallel every 2 minutes and only shows reachable ones in the widget.

### Goal sound + TTS

Toggle "Tor-Sound" in the widget to enable/disable the `engine.py` commentary.  
To change the voice, edit `VOICE = "Anna"` in `engine.py` (run `say -v ?` for a list).

### Desktop icon shift (optional)

When the ticker side-panel slides open, the server can move your Finder desktop icons to make room. To enable this:

```bash
cp shift_config.example.json ~/.wm2026/shift_config.json
```

Then edit `~/.wm2026/shift_config.json` — set the icon names and pixel positions to match **your** desktop layout. The feature is silently disabled if the file is missing.

---

## File Reference

| File | Purpose |
|------|---------|
| `wm2026.jsx` | Übersicht widget — copy to Übersicht widgets folder |
| `wm2026_server.py` | Flask backend — runs on `127.0.0.1:9876` |
| `engine.py` | Runs every 3 s via the widget command; detects goals/events, triggers TTS |
| `sources.json` | Radio/TV stream sources |
| `shift_config.example.json` | Template for the optional desktop icon shift feature |
| `install.sh` | One-command installer |
| `requirements.txt` | Python dependencies |

---

## API Endpoints

The local server exposes a simple REST API (CORS enabled, localhost only):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Server + audio state |
| `POST` | `/api/play` | `{"url": "...", "volume": 80}` — start stream |
| `POST` | `/api/stop` | Stop current stream |
| `POST` | `/api/volume` | `{"level": 70}` — adjust volume |
| `GET` | `/api/streams` | All stream sources with online status |
| `GET` | `/api/ticker` | Live scoreboard from ESPN |
| `GET` | `/api/commentary` | Play-by-play events (live games only) |
| `GET` | `/api/comments` | kicker.de live ticker snippets |
| `POST` | `/api/shift` | `{"dir": "right" | "left"}` — shift desktop icons |

---

## Data Sources

- **Scores & schedule** — [ESPN public API](https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard) — no API key required
- **Play-by-play** — ESPN summary endpoint
- **Live-ticker text** — kicker.de (scraped)
- **Streams** — Public broadcaster HLS/Icecast streams (ARD, ZDF, BBC, NPR, …)

---

## Troubleshooting

**Widget shows "Streams werden geprüft…"**  
The server needs a moment to probe all streams on first launch. Wait ~10 seconds.

**No audio / "failed to start audio"**  
Make sure mpv is installed: `brew install mpv`. The server looks for it at `/opt/homebrew/bin/mpv` and `/usr/local/bin/mpv`.

**Server doesn't start**  
Check `~/.wm2026/server.log`. You can start it manually:  
```bash
python3 ~/.wm2026/wm2026_server.py
```

**Widget is blank**  
Übersicht sometimes needs a full restart after installing a new widget. Use `⌘Q` and reopen.

---

## License

MIT — see [LICENSE](LICENSE).
