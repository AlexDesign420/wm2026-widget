#!/usr/bin/env python3
"""WM2026 Server: Live-Audio via mpv, Stream-Finder, Ticker, Kommentare, Desktop-Shift."""

import json
import os
import re
import shutil
import socket
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request


DIR = os.path.expanduser("~/.wm2026")
MPV_SOCKET = os.path.join(DIR, "mpv.sock")
SOURCES_PATH = os.path.join(DIR, "sources.json")
STREAMS_PATH = os.path.join(DIR, "streams.json")
AUDIO_STATE_PATH = os.path.join(DIR, "audio_state.json")
TICKER_PATH = os.path.join(DIR, "ticker.json")
COMMENTS_PATH = os.path.join(DIR, "comments.json")
COMMENTARY_PATH = os.path.join(DIR, "commentary.json")
SHIFT_STATE_PATH = os.path.join(DIR, "desktop_shift_state.json")
SHIFT_CONFIG_PATH = os.path.join(DIR, "shift_config.json")

os.makedirs(DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# mpv helpers
# ---------------------------------------------------------------------------

def _resolve_mpv():
    """Find the mpv binary regardless of the server process's PATH.

    Übersicht launches the server with a minimal PATH that excludes
    /opt/homebrew/bin, so we search known locations explicitly.
    """
    for candidate in ("/opt/homebrew/bin/mpv", "/usr/local/bin/mpv", "/usr/bin/mpv"):
        if os.path.exists(candidate):
            return candidate
    return shutil.which("mpv") or "mpv"


MPV_BIN = _resolve_mpv()

_mpv_lock = threading.RLock()
_requested_url = None  # original URL before HLS resolution, returned to the widget


def resolve_hls_audio(url, timeout=6):
    """Resolve an HLS master playlist to a directly playable audio URL.

    Many ARD/ZDF/MDR streams include broken '-b' backup renditions that cause
    ffmpeg (and thus mpv) to 404 on the master playlist. We resolve a pure
    audio rendition (or the lowest-bandwidth video variant) ourselves to
    hand a clean URL to mpv.  Non-HLS URLs (Icecast mp3/aac) pass through.
    """
    if ".m3u8" not in url.lower():
        return url
    try:
        resp = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        text = resp.text
    except Exception:
        return url

    if "#EXT-X-STREAM-INF" not in text and "#EXT-X-MEDIA" not in text:
        return url

    def good(u):
        return "-b/" not in u and "-b." not in u

    audio_default = re.findall(r'#EXT-X-MEDIA:TYPE=AUDIO[^\n]*?DEFAULT=YES[^\n]*?URI="([^"]+)"', text)
    audio_any = re.findall(r'#EXT-X-MEDIA:TYPE=AUDIO[^\n]*?URI="([^"]+)"', text)
    for cand in audio_default + audio_any:
        full = urljoin(url, cand)
        if good(full):
            return full

    variants = []
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.startswith("#EXT-X-STREAM-INF"):
            m = re.search(r'BANDWIDTH=(\d+)', line)
            bw = int(m.group(1)) if m else 0
            for j in range(i + 1, len(lines)):
                cand = lines[j].strip()
                if cand and not cand.startswith("#"):
                    variants.append((bw, urljoin(url, cand)))
                    break
    good_variants = [(bw, u) for bw, u in variants if good(u)]
    pool = good_variants or variants
    if pool:
        pool.sort(key=lambda x: x[0])
        return pool[0][1]
    return url


def mpv_is_running():
    try:
        result = subprocess.run(["pgrep", "-x", "mpv"], capture_output=True, text=True)
        return result.returncode == 0 and result.stdout.strip() != ""
    except Exception:
        return False


def mpv_command(cmd_list):
    if not os.path.exists(MPV_SOCKET):
        return None
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
            sock.settimeout(2)
            sock.connect(MPV_SOCKET)
            payload = json.dumps({"command": cmd_list}) + "\n"
            sock.sendall(payload.encode())
            response = sock.recv(4096).decode().strip()
            try:
                return json.loads(response)
            except Exception:
                return response
    except Exception as e:
        return {"error": str(e)}


def mpv_start(url, volume=50):
    global _requested_url
    with _mpv_lock:
        mpv_stop()
        time.sleep(0.3)
        if os.path.exists(MPV_SOCKET):
            try:
                os.remove(MPV_SOCKET)
            except Exception:
                pass
        play_url = resolve_hls_audio(url)
        cmd = [
            MPV_BIN, "--no-video", "--force-window=no",
            "--input-ipc-server=" + MPV_SOCKET,
            "--volume=" + str(volume),
            "--cache=yes", "--cache-secs=10",
            play_url,
        ]
        _requested_url = url
        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            return False
        time.sleep(1.5)
        return mpv_is_running()


def mpv_stop():
    global _requested_url
    with _mpv_lock:
        _requested_url = None
        if mpv_is_running():
            mpv_command(["quit"])
            time.sleep(0.3)
        if mpv_is_running():
            try:
                subprocess.run(
                    ["pkill", "-f", f"input-ipc-server={MPV_SOCKET}"],
                    capture_output=True,
                )
                time.sleep(0.2)
            except Exception:
                pass
        if os.path.exists(MPV_SOCKET):
            try:
                os.remove(MPV_SOCKET)
            except Exception:
                pass


def mpv_set_volume(level):
    level = max(0, min(100, int(level)))
    mpv_command(["set_property", "volume", level])
    return level


def mpv_get_status():
    if not mpv_is_running():
        return {"playing": False, "url": None, "volume": 50}
    vol_resp = mpv_command(["get_property", "volume"])
    path_resp = mpv_command(["get_property", "path"])
    pause_resp = mpv_command(["get_property", "pause"])
    volume = 50
    url = None
    paused = False
    if isinstance(vol_resp, dict) and vol_resp.get("data") is not None:
        volume = int(vol_resp["data"])
    if isinstance(path_resp, dict) and path_resp.get("data") is not None:
        url = path_resp["data"]
    if isinstance(pause_resp, dict) and pause_resp.get("data") is not None:
        paused = bool(pause_resp["data"])
    if _requested_url:
        url = _requested_url
    return {"playing": not paused, "url": url, "volume": volume}


# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------

app = Flask(__name__)


@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response


def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        app.logger.warning("Failed to load %s: %s", path, exc)
        return default


def save_json(path, data):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except OSError as exc:
        app.logger.error("Failed to save %s: %s", path, exc)


# ---------------------------------------------------------------------------
# Desktop icon shift (optional — requires shift_config.json)
# ---------------------------------------------------------------------------

def run_applescript(script):
    return subprocess.run(
        ["osascript"], input=script, capture_output=True, text=True, timeout=10,
    )


def get_shift_positions(direction):
    """Load positions for the given direction from shift_config.json.

    Returns an empty dict if the config file is missing — the shift feature
    is simply disabled in that case (graceful degradation).
    """
    cfg = load_json(SHIFT_CONFIG_PATH, {"icons": {}})
    icons = cfg.get("icons", {})
    positions = {}
    for name, data in icons.items():
        key = "open" if direction == "right" else "closed"
        if key in data:
            positions[name] = data[key]
    return positions


def apply_desktop_positions(positions):
    if not positions:
        return {"moved": 0, "missing": []}

    lines = ['tell application "Finder"', 'set missingItems to {}', 'set movedCount to 0']
    for name, pos in positions.items():
        x_pos, y_pos = int(pos[0]), int(pos[1])
        escaped = name.replace("\\", "\\\\").replace('"', '\\"')
        lines.extend([
            'try',
            f'  set position of item "{escaped}" of desktop to {{{x_pos}, {y_pos}}}',
            '  set movedCount to movedCount + 1',
            'on error',
            f'  set end of missingItems to "{escaped}"',
            'end try',
        ])
    lines.extend([
        "set AppleScript's text item delimiters to \"||\"",
        'return (movedCount as text) & linefeed & (missingItems as text)',
        'end tell',
    ])

    result = run_applescript("\n".join(lines))
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "failed to update desktop positions")

    output_lines = result.stdout.splitlines()
    moved = 0
    missing = []
    if output_lines:
        try:
            moved = int(output_lines[0].strip())
        except ValueError:
            moved = 0
    if len(output_lines) > 1 and output_lines[1].strip():
        missing = [item for item in output_lines[1].split("||") if item]
    return {"moved": moved, "missing": missing}


def shift_desktop_icons(direction):
    if direction not in ("left", "right"):
        raise ValueError(f"unsupported direction: {direction}")
    positions = get_shift_positions(direction)
    result = apply_desktop_positions(positions)
    shifted = direction == "right"
    save_json(SHIFT_STATE_PATH, {"shifted": shifted})
    return {"ok": True, "shifted": shifted, **result}


# ---------------------------------------------------------------------------
# Stream finder
# ---------------------------------------------------------------------------

def check_stream_reachable(url, timeout=3):
    try:
        resp = requests.head(url, timeout=timeout, allow_redirects=True)
        if resp.status_code < 400:
            return True
        resp = requests.get(url, timeout=timeout, stream=True, allow_redirects=True)
        return resp.status_code < 400
    except Exception:
        return False


def scrape_sportschau():
    urls = []
    try:
        resp = requests.get("https://www.sportschau.de/streams", timeout=8)
        resp.raise_for_status()
        found = re.findall(r'https?://[^\s"\'<>]+\.m3u8', resp.text)
        for u in found:
            if u not in urls:
                urls.append(u)
    except Exception:
        pass
    return urls


def find_streams():
    config = load_json(SOURCES_PATH, {"sources": []})
    tasks = []
    for src in config.get("sources", []):
        sid = src.get("id")
        name = src.get("name", sid)
        lang = src.get("language", "?")
        country = src.get("country", "?")
        stype = src.get("type", "static")
        if stype == "static":
            u = src.get("url")
            if u:
                tasks.append((u, name, lang, country, sid))
        elif stype == "scrape" and sid == "ard-sportschau":
            for idx, u in enumerate(scrape_sportschau()):
                display = f"{name} #{idx + 1}" if idx > 0 else name
                tasks.append((u, display, lang, country, sid))

    results = []
    with ThreadPoolExecutor(max_workers=12) as executor:
        future_map = {
            executor.submit(check_stream_reachable, url): (url, name, lang, country, sid)
            for url, name, lang, country, sid in tasks
        }
        for future in as_completed(future_map):
            url, name, lang, country, sid = future_map[future]
            try:
                online = future.result()
            except Exception:
                online = False
            results.append({
                "id": sid, "name": name, "url": url,
                "language": lang, "country": country, "online": online,
            })

    lang_order = {"de": 0, "en": 1}
    results.sort(key=lambda s: (0 if s["online"] else 1, lang_order.get(s["language"], 9), s["name"]))
    save_json(STREAMS_PATH, results)
    return results


def stream_finder_loop():
    while True:
        try:
            find_streams()
        except Exception:
            pass
        time.sleep(120)


# ---------------------------------------------------------------------------
# ESPN ticker & commentary
# ---------------------------------------------------------------------------

def fetch_espn_ticker():
    try:
        today = datetime.utcnow().strftime("%Y%m%d")
        url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates={today}&limit=30"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        events = resp.json().get("events", [])
        ticker = []
        for ev in events:
            comp = ev.get("competitions", [{}])[0]
            status = comp.get("status", {})
            stype = status.get("type", {})
            cs = comp.get("competitors", [])
            home = next((c for c in cs if c.get("homeAway") == "home"), cs[0] if cs else {})
            away = next((c for c in cs if c.get("homeAway") == "away"), cs[1] if len(cs) > 1 else {})
            ticker.append({
                "id": ev.get("id"),
                "home": home.get("team", {}).get("shortDisplayName", "Heim"),
                "away": away.get("team", {}).get("shortDisplayName", "Gast"),
                "home_score": home.get("score", "0"),
                "away_score": away.get("score", "0"),
                "state": stype.get("state", "pre"),
                "clock": status.get("displayClock", ""),
                "detail": stype.get("shortDetail", ""),
            })
        return ticker
    except Exception:
        return []


def ticker_loop():
    while True:
        try:
            save_json(TICKER_PATH, fetch_espn_ticker())
        except Exception:
            pass
        time.sleep(30)


def fetch_espn_commentary():
    ticker = load_json(TICKER_PATH, [])
    live_games = [g for g in ticker if g.get("state") == "in"]
    all_events = []
    for game in live_games[:3]:
        game_id = game.get("id")
        if not game_id:
            continue
        try:
            url = f"https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event={game_id}"
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            match_label = f"{game.get('home','')} {game.get('home_score','0')}:{game.get('away_score','0')} {game.get('away','')}"
            for play in (data.get("plays") or data.get("commentary") or [])[-60:]:
                if not isinstance(play, dict):
                    continue
                clock_obj = play.get("clock", {})
                clock = clock_obj.get("displayValue", "") if isinstance(clock_obj, dict) else str(clock_obj or "")
                text = play.get("text") or play.get("description") or ""
                type_obj = play.get("type", {})
                etype = (type_obj.get("text") or type_obj.get("id") or "") if isinstance(type_obj, dict) else str(type_obj or "")
                if text:
                    all_events.append({"match": match_label, "clock": clock, "type": etype, "text": text, "game_id": game_id})
            for sp in (data.get("scoringPlays") or []):
                if not isinstance(sp, dict):
                    continue
                clock_obj = sp.get("clock", {})
                clock = clock_obj.get("displayValue", "") if isinstance(clock_obj, dict) else str(clock_obj or "")
                text = sp.get("text") or sp.get("description") or ""
                if text:
                    all_events.append({"match": match_label, "clock": clock, "type": "goal", "text": "⚽ " + text, "game_id": game_id})
        except Exception:
            pass
    return all_events


def commentary_loop():
    while True:
        try:
            ticker = load_json(TICKER_PATH, [])
            if any(g.get("state") == "in" for g in ticker):
                save_json(COMMENTARY_PATH, fetch_espn_commentary())
        except Exception:
            pass
        time.sleep(30)


# ---------------------------------------------------------------------------
# Kicker comments scraper
# ---------------------------------------------------------------------------

COMMENTS_ENABLED = True


def fetch_kicker_comments():
    if not COMMENTS_ENABLED:
        return []
    comments = []
    try:
        resp = requests.get(
            "https://www.kicker.de/fifa-weltmeisterschaft-2026/spieltag",
            timeout=10, headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for elem in soup.find_all(["p", "div"]):
            txt = elem.get_text(strip=True)
            if 20 < len(txt) < 300 and any(x in txt for x in ["'", "Minute", "Tor", "Foul", "Ecke", "Abseits"]):
                comments.append({"time": "", "text": txt, "source": "kicker"})
            if len(comments) >= 20:
                break
    except Exception:
        pass
    return comments


def comments_loop():
    while True:
        try:
            save_json(COMMENTS_PATH, fetch_kicker_comments())
        except Exception:
            pass
        time.sleep(45)


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.route("/api/status", methods=["GET"])
def api_status():
    audio = load_json(AUDIO_STATE_PATH, {"playing": False, "url": None, "volume": 50})
    return jsonify({"ok": True, "server": "wm2026", "audio": audio})


@app.route("/api/play", methods=["POST"])
def api_play():
    data = request.get_json(force=True) or {}
    url = data.get("url")
    volume = data.get("volume", 50)
    if not url:
        return jsonify({"error": "url required"}), 400
    if not mpv_start(url, volume):
        return jsonify({"error": "failed to start audio"}), 503
    state = mpv_get_status()
    save_json(AUDIO_STATE_PATH, state)
    return jsonify({"ok": True, "audio": state})


@app.route("/api/stop", methods=["POST"])
def api_stop():
    mpv_stop()
    state = {"playing": False, "url": None, "volume": 50}
    save_json(AUDIO_STATE_PATH, state)
    return jsonify({"ok": True, "audio": state})


@app.route("/api/volume", methods=["POST"])
def api_volume():
    data = request.get_json(force=True) or {}
    level = data.get("level")
    if level is None:
        return jsonify({"error": "level required"}), 400
    try:
        level = int(level)
    except (ValueError, TypeError):
        return jsonify({"error": "level must be a number"}), 400
    mpv_set_volume(level)
    state = mpv_get_status()
    save_json(AUDIO_STATE_PATH, state)
    return jsonify({"ok": True, "audio": state})


@app.route("/api/shift", methods=["POST"])
def api_shift():
    data = request.get_json(force=True, silent=True) or {}
    direction = data.get("dir", "right")
    try:
        result = shift_desktop_icons(direction)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/streams", methods=["GET"])
def api_streams():
    return jsonify({"streams": load_json(STREAMS_PATH, [])})


@app.route("/api/ticker", methods=["GET"])
def api_ticker():
    return jsonify({"ticker": load_json(TICKER_PATH, [])})


@app.route("/api/comments", methods=["GET"])
def api_comments():
    return jsonify({"enabled": COMMENTS_ENABLED, "comments": load_json(COMMENTS_PATH, [])})


@app.route("/api/comments/toggle", methods=["POST"])
def api_comments_toggle():
    global COMMENTS_ENABLED
    data = request.get_json(force=True) or {}
    COMMENTS_ENABLED = bool(data.get("enabled", True))
    if not COMMENTS_ENABLED:
        save_json(COMMENTS_PATH, [])
    return jsonify({"enabled": COMMENTS_ENABLED})


@app.route("/api/commentary", methods=["GET"])
def api_commentary():
    return jsonify({"commentary": load_json(COMMENTARY_PATH, [])})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    for target in (stream_finder_loop, ticker_loop, comments_loop, commentary_loop):
        threading.Thread(target=target, daemon=True).start()
    app.run(host="127.0.0.1", port=9876, debug=False)
