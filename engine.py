#!/usr/bin/env python3
# WM2026 Engine: Tor-Erkennung, deutscher Audio-Kommentator, Text-Feed.
# Liest today.json (Scoreboard von heute), vergleicht mit gespeichertem Stand,
# erzeugt deutsche Kommentare zu Toren / Karten / An- und Abpfiff,
# spricht sie per `say -v Anna`, spielt bei Toren einen Sound, und
# schreibt feed.json (Text-Liste) fuer die Anzeige im Widget.
# Robust: faengt alle Fehler ab, damit das Widget nie blockiert.

import json, os, subprocess, sys, time

DIR = os.path.expanduser("~/.wm2026")
VOICE = "Anna"
GOAL_SOUND = "/System/Library/Sounds/Hero.aiff"
WHISTLE_SOUND = "/System/Library/Sounds/Submarine.aiff"

def load(name, default):
    try:
        with open(os.path.join(DIR, name)) as f:
            return json.load(f)
    except Exception:
        return default

def save(name, data):
    try:
        with open(os.path.join(DIR, name), "w") as f:
            json.dump(data, f)
    except Exception:
        pass

def speak(text):
    try:
        subprocess.Popen(["say", "-v", VOICE, text],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def play(path):
    try:
        subprocess.Popen(["afplay", path],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def main():
    today = load("today.json", {"events": []})
    prev = load("state.json", {})
    feed = load("feed.json", [])

    audio_on = os.path.exists(os.path.join(DIR, "audio_on"))
    first_run = not prev  # beim allerersten Lauf nichts vorlesen (kein Spam)

    new_state = {}
    spoken = []   # (typ, text) -> typ steuert Sound

    for ev in today.get("events", []):
        try:
            comp = ev["competitions"][0]
            status = comp["status"]["type"]["state"]   # pre | in | post
            clock = comp["status"].get("displayClock", "") or ""
            cs = comp["competitors"]
            home = next((c for c in cs if c.get("homeAway") == "home"), cs[0])
            away = next((c for c in cs if c.get("homeAway") == "away"), cs[1])
            hn = home["team"].get("shortDisplayName", "Heim")
            an = away["team"].get("shortDisplayName", "Gast")
            hs = int(home.get("score", 0) or 0)
            as_ = int(away.get("score", 0) or 0)
            gid = str(ev.get("id"))
        except Exception:
            continue

        new_state[gid] = {"h": hs, "a": as_, "state": status, "clock": clock}
        p = prev.get(gid)

        if first_run or p is None:
            continue

        # --- Tore ---
        if status == "in" and p.get("state") == "in":
            if hs > p.get("h", hs):
                spoken.append(("goal",
                    f"Tooor fuer {hn}! Es steht jetzt {hs} zu {as_} gegen {an}."))
                feed.insert(0, {"t": clock, "txt": f"TOR {hn} — {hs}:{as_}", "kind": "goal"})
            if as_ > p.get("a", as_):
                spoken.append(("goal",
                    f"Tooor fuer {an}! Es steht jetzt {hs} zu {as_}."))
                feed.insert(0, {"t": clock, "txt": f"TOR {an} — {hs}:{as_}", "kind": "goal"})

        # --- Statuswechsel ---
        if p.get("state") != status:
            if status == "in" and p.get("state") == "pre":
                spoken.append(("whistle", f"Anpfiff! {hn} gegen {an}."))
                feed.insert(0, {"t": clock or "1'", "txt": f"Anpfiff: {hn} vs {an}", "kind": "start"})
            elif status == "post":
                erg = "Unentschieden" if hs == as_ else (f"{hn} gewinnt" if hs > as_ else f"{an} gewinnt")
                spoken.append(("whistle", f"Abpfiff. {hn} {hs}, {an} {as_}. {erg}."))
                feed.insert(0, {"t": "FT", "txt": f"Ende: {hn} {hs}:{as_} {an}", "kind": "end"})

    feed = feed[:40]
    save("state.json", new_state)
    save("feed.json", feed)

    if audio_on and not first_run:
        # Tor-Sound zuerst, dann Sprache (leicht versetzt fuer Verstaendlichkeit)
        for kind, text in spoken:
            if kind == "goal":
                play(GOAL_SOUND)
            elif kind == "whistle":
                play(WHISTLE_SOUND)
            speak(text)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # niemals failen
        sys.stderr.write(str(e))
