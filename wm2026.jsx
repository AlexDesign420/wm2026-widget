export const refreshFrequency = 3000

export const command = `
  DIR="$HOME/.wm2026"; mkdir -p "$DIR"
  TODAY=$(date -u "+%Y%m%d")
  _AGE=9999
  if [ -f "$DIR/today.json" ]; then
    _MTIME=$(stat -f %m "$DIR/today.json" 2>/dev/null || echo 0)
    _AGE=$(( $(date +%s) - _MTIME ))
  fi
  if [ "$_AGE" -gt 30 ]; then
    curl -s --max-time 10 "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=\${TODAY}&limit=30" -H "Accept: application/json" > "$DIR/today.json.tmp" 2>/dev/null && mv "$DIR/today.json.tmp" "$DIR/today.json" || echo '{"events":[]}' > "$DIR/today.json"
  fi
  SCHED="$DIR/schedule.json"
  if [ ! -f "$SCHED" ] || [ $(( $(date +%s) - $(stat -f %m "$SCHED" 2>/dev/null || echo 0) )) -gt 600 ]; then
    curl -s --max-time 20 "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720&limit=120" -H "Accept: application/json" > "$SCHED.tmp" 2>/dev/null && mv "$SCHED.tmp" "$SCHED"
  fi
  python3 "$DIR/engine.py" 2>/dev/null
  echo "TODAY:$(cat "$DIR/today.json" 2>/dev/null)"
  echo "SCHED:$(cat "$SCHED" 2>/dev/null)"
  echo "FEED:$(cat "$DIR/feed.json" 2>/dev/null || echo '[]')"
  echo "AUDIO:$([ -f "$DIR/audio_on" ] && echo on || echo off)"
  grep -q '"shifted": true' "$DIR/desktop_shift_state.json" 2>/dev/null && echo "SHIFT:on" || echo "SHIFT:off"
`

export const className = `
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  user-select: none;
  z-index: 1;

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .widget {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #0b1f17 0%, #0d1117 14%, #0d1117 100%);
    border-right: 1px solid #1c2b22;
    box-shadow: 2px 0 24px rgba(0,0,0,0.45);
    transition: transform .35s cubic-bezier(.4,0,.2,1);
  }

  .wm2026-root.hidden .widget { transform: translateX(calc(-100% - 12px)); pointer-events: none; }
  .wm2026-root.hidden .side-panel { transform: translateX(-9999px); pointer-events: none; }

  .hide-btn {
    pointer-events: auto; cursor: pointer;
    font-size: 9px; color: #4b5563;
    padding: 3px 7px; margin-top: 5px; margin-left: 6px;
    background: #0f1724; border-radius: 5px; border: 1px solid #21262d;
    display: inline-block; transition: color .15s, background .15s;
  }
  .hide-btn:hover { color: #f87171; background: #1a1014; border-color: #5b2330; }

  .notch {
    position: fixed; left: 0; top: 50%;
    transform: translateY(-50%) translateX(-110%);
    transition: transform .35s cubic-bezier(.4,0,.2,1), filter .15s ease;
    z-index: 6; pointer-events: none;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 16px 9px 14px;
    background: linear-gradient(135deg, #0c3a22, #0a2236 75%);
    border: 1px solid #1c2b22; border-left: none;
    border-radius: 0 14px 14px 0;
    box-shadow: 3px 0 22px rgba(0,0,0,0.6);
  }
  .wm2026-root.hidden .notch { transform: translateY(-50%) translateX(0); pointer-events: auto; cursor: pointer; }
  .notch:hover { filter: brightness(1.18); }
  .notch:active { filter: brightness(0.95); }
  .notch-ball { font-size: 22px; display: inline-block; animation: spin 9s linear infinite; }
  .notch-label { font-size: 9px; font-weight: 800; color: #25c2a0; letter-spacing: 1px; writing-mode: vertical-rl; text-orientation: mixed; }
  .notch-live { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: pulse 1.2s infinite; }
  .notch-chev { font-size: 11px; color: #5b6b7d; }

  .hdr {
    position: relative; overflow: hidden;
    padding: 16px 20px;
    background: linear-gradient(120deg, #0c3a22, #0a2236 70%);
    border-bottom: 1px solid #1c2b22;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .hdr::after {
    content: ''; position: absolute; top: 0; bottom: 0; width: 40%;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,0.07), transparent);
    transform: translateX(-150%);
    animation: shine 6s ease-in-out infinite;
  }
  .hdr-l { display: flex; align-items: center; gap: 12px; z-index: 1; min-width: 0; flex-shrink: 1; }
  .ball { font-size: 26px; display: inline-block; animation: spin 9s linear infinite; transform-origin: 50% 50%; }
  .h-title { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 0.3px; }
  .h-sub { font-size: 11px; color: #7d8794; margin-top: 2px; }
  .h-sub b { color: #25c2a0; }
  .h-r { text-align: right; z-index: 1; }
  .h-badge { display: inline-block; background: #dc2626; color: #fff; font-size: 10px; font-weight: 800; padding: 3px 9px; border-radius: 6px; letter-spacing: 1.5px; animation: pulse 1.6s ease-in-out infinite; }
  .h-time { font-size: 9px; color: #3a4654; margin-top: 5px; }

  .ctl {
    flex-shrink: 0;
    background: #0f1724;
    border-bottom: 1px solid #1c2b22;
    padding: 10px 16px;
  }
  .ctl-row { display: flex; align-items: center; gap: 8px; }
  .btn {
    pointer-events: auto; cursor: pointer; flex: 1; text-align: center;
    font-size: 12px; font-weight: 700; padding: 9px 10px; border-radius: 9px;
    transition: transform .08s ease, filter .15s ease;
  }
  .btn:active { transform: scale(0.96); }
  .btn-magenta { background: linear-gradient(135deg,#e20074,#b8005d); color: #fff; }
  .btn-audio-on { background: #16352a; color: #34d399; border: 1px solid #1f7a5a; }
  .btn-audio-off { background: #1a1f2e; color: #6b7280; border: 1px solid #2d3748; }
  .btn-test { background: #1d4ed8; color: #fff; flex: 0 0 auto; padding: 9px 12px; }

  .wlbl { font-size: 9px; font-weight: 700; color: #4b5563; letter-spacing: 2px; text-transform: uppercase; margin: 9px 0 6px; }
  .wgame {
    display: flex; align-items: center; gap: 9px;
    background: #161b22; border: 1px solid #21262d; border-radius: 9px; padding: 7px 11px; margin-bottom: 5px;
  }
  .wgame-live { border-color: rgba(220,38,38,0.5); background: rgba(220,38,38,0.08); }
  .wg-teams { flex: 1; font-size: 12px; font-weight: 600; color: #c9d1d9; }
  .wg-score { font-size: 14px; font-weight: 800; color: #fff; }
  .wg-clock { font-size: 10px; color: #34d399; min-width: 30px; text-align: center; }
  .wg-btn { pointer-events: auto; cursor: pointer; font-size: 11px; font-weight: 800; color: #fff; background: linear-gradient(135deg,#e20074,#b8005d); padding: 5px 11px; border-radius: 7px; }

  .livewrap { flex-shrink: 0; background: #0a0e19; border-bottom: 1px solid #1c2b22; }
  .live-toggle { pointer-events: auto; cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 11px 16px; }
  .live-toggle:hover { background: #0d1422; }
  .lt-l { font-size: 11px; font-weight: 700; color: #9aa5c2; letter-spacing: 0.4px; display: flex; align-items: center; gap: 8px; }
  .lt-badge { background: #3a4654; color: #fff; font-size: 9px; font-weight: 800; padding: 1px 7px; border-radius: 8px; }
  .lt-live { background: #dc2626; color: #fff; font-size: 9px; font-weight: 800; padding: 1px 7px; border-radius: 8px; animation: pulse 1.6s infinite; }
  .chev { color: #4b5563; font-size: 11px; transition: transform .25s ease; }
  .livewrap.expanded .chev { transform: rotate(180deg); }
  .livepanel { max-height: 0; overflow: hidden; transition: max-height .3s ease; }
  .livewrap.expanded .livepanel { max-height: 480px; }
  .live-actions { display: flex; flex-direction: column; gap: 7px; padding: 2px 16px 11px; }
  .streams-scroll { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 2px; }
  .streams-scroll::-webkit-scrollbar { width: 5px; }
  .streams-scroll::-webkit-scrollbar-thumb { background: #21262d; border-radius: 3px; }
  .la-row { display: flex; gap: 7px; }
  .la-btn { pointer-events: auto; cursor: pointer; text-align: center; font-size: 11px; font-weight: 700; padding: 9px 10px; border-radius: 9px; transition: transform .08s ease; }
  .la-btn:active { transform: scale(0.97); }
  .la-flex { flex: 1; }
  .la-radio { background: linear-gradient(135deg, #1d4ed8, #0ea5e9); color: #fff; }
  .la-on { background: #16352a; color: #34d399; border: 1px solid #1f7a5a; }
  .la-off { background: #1a1f2e; color: #6b7280; border: 1px solid #2d3748; }
  .la-test { background: #312a55; color: #c4b5fd; border: 1px solid #4c3f86; flex: 0 0 auto; }
  .live-feed { max-height: 200px; overflow-y: auto; border-top: 1px solid #11161f; }
  .live-feed::-webkit-scrollbar { width: 6px; } .live-feed::-webkit-scrollbar-thumb { background: #21262d; border-radius: 3px; }
  .lf-empty { font-size: 11px; color: #5a647e; padding: 13px 16px; line-height: 1.65; }
  .comments-wrap { border-top: 1px solid #1c2b22; }
  .comments-toggle { pointer-events: auto; cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: #0a0e19; }
  .comments-toggle:hover { background: #0d1422; }
  .comments-panel { max-height: 0; overflow: hidden; transition: max-height .3s ease; }
  .comments-wrap.expanded .comments-panel { max-height: 250px; }
  .comments-list { max-height: 200px; overflow-y: auto; }
  .comment-item { padding: 6px 16px; border-top: 1px solid #11161f; font-size: 11px; color: #9aa5c2; line-height: 1.5; }
  .comment-item b { color: #c9d1d9; }
  .lf-empty b { color: #9aa5c2; }
  .tk-item { display: flex; align-items: center; gap: 9px; padding: 6px 16px; border-top: 1px solid #11161f; animation: slidein .3s ease; }
  .tk-t { font-size: 10px; color: #4b5563; min-width: 30px; font-variant-numeric: tabular-nums; }
  .tk-x { font-size: 12px; color: #c9d1d9; flex: 1; }
  .tk-goal .tk-x { color: #fbbf24; font-weight: 700; }
  .tk-goal .tk-t { color: #fbbf24; }

  .sbar { display: flex; background: #0a0e19; border-bottom: 1px solid #11161f; flex-shrink: 0; }
  .sb { flex: 1; text-align: center; padding: 8px 4px; border-right: 1px solid #11161f; }
  .sb:last-child { border-right: none; }
  .sb-v { font-size: 15px; font-weight: 800; color: #e5e7eb; }
  .sb-l { font-size: 8px; color: #3a4654; text-transform: uppercase; letter-spacing: 1px; margin-top: 1px; }
  .sb-live .sb-v { color: #34d399; }

  .scroll { flex: 1; overflow-y: auto; pointer-events: auto; }
  .scroll::-webkit-scrollbar { width: 8px; }
  .scroll::-webkit-scrollbar-thumb { background: #21262d; border-radius: 4px; }
  .scroll::-webkit-scrollbar-thumb:hover { background: #2d3748; }

  .sec { padding: 9px 20px 5px; font-size: 9px; font-weight: 700; color: #3a4654; letter-spacing: 2px; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
  .sec::after { content: ''; flex: 1; height: 1px; background: #161b22; }

  .game { padding: 12px 20px; border-bottom: 1px solid #11161f; }
  .game-live { background: rgba(220,38,38,0.05); border-left: 3px solid #dc2626; padding-left: 17px; }
  .g-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .g-status { font-size: 10px; font-weight: 700; display: flex; align-items: center; gap: 5px; }
  .g-live { color: #34d399; } .g-pre { color: #6b7280; } .g-post { color: #4b5563; }
  .ldot { width: 6px; height: 6px; border-radius: 50%; background: #ef4444; display: inline-block; animation: pulse 1.2s infinite; }
  .g-tag { font-size: 9px; color: #6b7280; background: #161b22; padding: 2px 6px; border-radius: 4px; border: 1px solid #21262d; }
  .g-teams { display: flex; align-items: center; gap: 10px; }
  .team { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
  .team-r { flex-direction: row-reverse; }
  .logo { width: 28px; height: 28px; object-fit: contain; border-radius: 50%; background: #161b22; flex-shrink: 0; border: 1px solid #21262d; padding: 2px; }
  .ti { min-width: 0; flex: 1; }
  .team-r .ti { text-align: right; }
  .tn { font-size: 13px; font-weight: 600; color: #c9d1d9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tn-w { color: #fff; font-weight: 800; } .tn-l { color: #374151; }
  .scorebox { flex-shrink: 0; min-width: 68px; }
  .snums { display: flex; align-items: center; justify-content: center; gap: 5px; background: #161b22; border: 1px solid #21262d; border-radius: 9px; padding: 5px 9px; }
  .sc { font-size: 21px; font-weight: 800; color: #fff; min-width: 16px; text-align: center; line-height: 1; }
  .ssep { font-size: 13px; color: #30363d; }
  .vs { font-size: 11px; color: #374151; font-weight: 700; padding: 5px 7px; }
  .venue { font-size: 10px; color: #6b7280; margin-top: 8px; }
  .vcity { font-size: 10px; color: #374151; }

  .day-hdr { padding: 7px 20px; font-size: 10px; font-weight: 700; color: #6b7280; background: #0a0e19; border-top: 1px solid #11161f; border-bottom: 1px solid #11161f; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; }
  .day-today { color: #fbbf24; background: rgba(251,191,36,0.07); }
  .day-cnt { font-size: 9px; color: #374151; font-weight: 400; }

  .sg { display: flex; align-items: center; padding: 8px 20px; border-bottom: 1px solid #0d1117; gap: 9px; }
  .sg-live { background: rgba(220,38,38,0.06); border-left: 3px solid #dc2626; padding-left: 17px; }
  .sg-t { font-size: 11px; color: #6b7280; font-weight: 600; min-width: 40px; flex-shrink: 0; font-variant-numeric: tabular-nums; }
  .sg-t-live { color: #34d399; } .sg-t-post { color: #374151; }
  .sg-flags { display: flex; gap: 3px; flex-shrink: 0; }
  .sg-flag { width: 16px; height: 16px; object-fit: contain; border-radius: 50%; background: #161b22; border: 1px solid #21262d; }
  .sg-info { flex: 1; min-width: 0; }
  .sg-match { font-size: 12px; color: #c9d1d9; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sg-match-live { color: #fff; font-weight: 700; } .sg-match-post { color: #6b7280; }
  .sg-meta { font-size: 9px; color: #374151; margin-top: 1px; }
  .sg-res { font-size: 13px; font-weight: 800; color: #9ca3af; min-width: 44px; text-align: center; font-variant-numeric: tabular-nums; }
  .sg-res-live { color: #fff; } .sg-dash { font-size: 12px; color: #21262d; min-width: 44px; text-align: center; }
  .sg-btn { pointer-events: auto; cursor: pointer; font-size: 11px; color: #e20074; flex-shrink: 0; }

  .empty { padding: 26px 20px 16px; text-align: center; }
  .ei { font-size: 40px; margin-bottom: 12px; display: inline-block; animation: spin 9s linear infinite; }
  .et { font-size: 15px; color: #c9d1d9; font-weight: 700; margin-bottom: 6px; }
  .es { font-size: 12px; color: #4b5563; line-height: 1.7; }
  .edate { color: #fbbf24; font-weight: 700; }
  .cdown { display: flex; margin: 6px 20px 16px; background: #0f1724; border-radius: 12px; border: 1px solid #21262d; }
  .cd { flex: 1; text-align: center; padding: 14px 6px; border-right: 1px solid #21262d; }
  .cd:last-child { border-right: none; }
  .cd-v { font-size: 26px; font-weight: 200; color: #fff; line-height: 1; }
  .cd-l { font-size: 8px; color: #3a4654; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }

  .foot { padding: 8px 20px; background: #0a0e19; border-top: 1px solid #1c2b22; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; }
  .ft { font-size: 9px; color: #2d3748; } .ft b { color: #3a4654; }

  .side-panel {
    position: fixed; top: 0;
    width: 0; overflow: hidden;
    transition: width .3s ease, transform .35s ease;
    background: #080c14;
    border-right: 1px solid #1c2b22;
    height: 100vh;
    z-index: 2;
  }
  .side-panel.open { width: 290px; }
  .sp-inner { width: 290px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  .sp-hdr { padding: 14px 14px 13px; background: #0c1422; border-bottom: 1px solid #1c2b22; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .sp-title { font-size: 12px; font-weight: 700; color: #c9d1d9; display: flex; align-items: center; gap: 7px; }
  .sp-close { pointer-events: auto; cursor: pointer; font-size: 13px; color: #4b5563; padding: 3px 8px; border-radius: 6px; border: 1px solid #21262d; }
  .sp-close:hover { color: #9aa5c2; background: #161b22; }
  .sp-scroll { flex: 1; overflow-y: auto; pointer-events: auto; }
  .sp-scroll::-webkit-scrollbar { width: 5px; }
  .sp-scroll::-webkit-scrollbar-thumb { background: #21262d; border-radius: 3px; }
  .sp-empty { padding: 24px 16px; font-size: 11px; color: #3a4654; text-align: center; line-height: 1.9; }
  .sp-sec { padding: 6px 14px; font-size: 9px; font-weight: 700; color: #3a4654; letter-spacing: 2px; text-transform: uppercase; background: #0a0d14; border-bottom: 1px solid #11161f; position: sticky; top: 0; }
  .sp-event { padding: 8px 14px; border-bottom: 1px solid #0e1218; animation: slidein .3s ease; }
  .sp-event-goal { background: rgba(251,191,36,0.07); border-left: 3px solid #fbbf24; padding-left: 11px; }
  .sp-event-card-r { border-left: 3px solid #ef4444; padding-left: 11px; }
  .sp-event-card-y { border-left: 3px solid #f59e0b; padding-left: 11px; }
  .sp-event-sub { border-left: 3px solid #3b82f6; padding-left: 11px; }
  .sp-clock { font-size: 9px; color: #4b5563; font-variant-numeric: tabular-nums; margin-bottom: 2px; }
  .sp-text { font-size: 11px; color: #c9d1d9; line-height: 1.55; }
  .sp-match { font-size: 9px; color: #25c2a0; margin-bottom: 3px; font-weight: 700; }
  .sp-ticker-item { padding: 10px 14px; border-bottom: 1px solid #0e1218; display: flex; align-items: center; gap: 10px; }
  .sp-ticker-live { background: rgba(220,38,38,0.06); border-left: 3px solid #dc2626; padding-left: 11px; }
  .sp-ticker-score { font-size: 15px; font-weight: 800; color: #fff; font-variant-numeric: tabular-nums; min-width: 44px; text-align: center; }
  .sp-ticker-teams { flex: 1; font-size: 11px; color: #c9d1d9; font-weight: 600; }
  .sp-ticker-clock { font-size: 10px; color: #34d399; min-width: 28px; text-align: right; }
  .sp-comment { padding: 8px 14px; border-bottom: 1px solid #0e1218; }
  .sp-comment-src { font-size: 9px; color: #3a4654; font-weight: 700; margin-bottom: 2px; }
  .sp-comment-txt { font-size: 11px; color: #9aa5c2; line-height: 1.55; }
  .sp-toggle { pointer-events: auto; cursor: pointer; font-size: 9px; color: #4b5563; padding: 3px 7px; background: #0f1724; border-radius: 5px; border: 1px solid #21262d; margin-top: 5px; display: inline-block; transition: color .15s; }
  .sp-toggle:hover { color: #9aa5c2; }

  .h-r-btns { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 3px; margin-top: 4px; }
  .h-r-btns .sp-toggle { margin-top: 0; }
  .h-r-btns .hide-btn { margin-top: 0; margin-left: 0; }

  .wm2026-sm .h-title { font-size: 14px; }
  .wm2026-sm .h-sub { font-size: 10px; }
  .wm2026-sm .btn { font-size: 11px; padding: 8px 6px; }
  .wm2026-sm .tn { font-size: 12px; }
  .wm2026-sm .sc { font-size: 18px; }
  .wm2026-sm .sg-match { font-size: 11px; }
  .wm2026-sm .sg-t { font-size: 10px; min-width: 34px; }
  .wm2026-sm .wg-teams { font-size: 11px; }
  .wm2026-sm .side-panel.open { width: 240px; }
  .wm2026-sm .sp-inner { width: 240px; }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes shine { 0%{transform:translateX(-150%)} 55%,100%{transform:translateX(320%)} }
  @keyframes slidein { from{opacity:0; transform:translateY(-5px)} to{opacity:1; transform:translateY(0)} }
`

let expanded = false
let commentsExpanded = false
let sidePanelOpen = false
let widgetHidden = false
try { sidePanelOpen = localStorage.getItem('wm2026SidePanelOpen') === '1' } catch (e) {}
try { widgetHidden = localStorage.getItem('wm2026Hidden') === '1' } catch (e) {}

// Country code → flag emoji; hoisted so it's not recreated on every 3s render
const COUNTRY_FLAGS = {
  DE:'🇩🇪',GB:'🇬🇧',CA:'🇨🇦',AT:'🇦🇹',CH:'🇨🇭',FR:'🇫🇷',IT:'🇮🇹',
  NL:'🇳🇱',BE:'🇧🇪',US:'🇺🇸',PT:'🇵🇹',IE:'🇮🇪',NO:'🇳🇴',SE:'🇸🇪',
  FI:'🇫🇮',DK:'🇩🇰',ES:'🇪🇸',JP:'🇯🇵',AU:'🇦🇺',AR:'🇦🇷',MX:'🇲🇽',
  BR:'🇧🇷',QA:'🇶🇦',TR:'🇹🇷',EU:'🇪🇺',
}

const SERVER_URL = "http://127.0.0.1:9876"

function toggleHidden() {
  widgetHidden = !widgetHidden
  try { localStorage.setItem('wm2026Hidden', widgetHidden ? '1' : '0') } catch (e) {}
  const root = document.querySelector('.wm2026-root')
  if (root) root.classList.toggle('hidden', widgetHidden)
}

function sh(cmd) {
  try { fetch('/run/', { method: 'POST', body: cmd }) } catch (e) {}
}
function openMagenta() {
  sh('open "https://web.magentatv.de"')
}
function toggleAudio(isOn) {
  sh(isOn ? 'rm -f "$HOME/.wm2026/audio_on"' : 'touch "$HOME/.wm2026/audio_on"')
}
function testAudio() {
  sh('afplay /System/Library/Sounds/Hero.aiff & sleep 0.15; say -v Anna "Tooor! Das ist ein Test des Live Kommentators. Die Audio Ausgabe funktioniert."')
}
function toggleExpand(e) {
  expanded = !expanded
  try { const w = e.target.closest('.livewrap'); if (w) w.classList.toggle('expanded', expanded) } catch (err) {}
}
function toggleCommentsExpand(e) {
  commentsExpanded = !commentsExpanded
  try { const w = e.target.closest('.comments-wrap'); if (w) w.classList.toggle('expanded', commentsExpanded) } catch (err) {}
}
function toggleSidePanel() {
  const el = document.querySelector('.side-panel')
  const isOpen = el ? el.classList.contains('open') : sidePanelOpen
  sidePanelOpen = !isOpen
  try { localStorage.setItem('wm2026SidePanelOpen', sidePanelOpen ? '1' : '0') } catch (e) {}
  if (el) el.classList.toggle('open', sidePanelOpen)
  const dir = sidePanelOpen ? 'right' : 'left'
  fetch(`${SERVER_URL}/api/shift`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dir })
  }).catch(() => {})
}

function ensureServer() {
  try {
    fetch(`${SERVER_URL}/api/status`, { method: 'GET' })
      .catch(() => {
        sh('nohup python3 "$HOME/.wm2026/wm2026_server.py" > "$HOME/.wm2026/server.log" 2>&1 &')
      })
  } catch (e) {}
}

let serverStreams = []
let serverAudio = { playing: false, url: null, volume: 50 }
let serverTicker = []
let serverComments = []
let serverCommentary = []
let commentsEnabled = true

function fetchServerData() {
  try {
    fetch(`${SERVER_URL}/api/streams`)
      .then(r => r.json())
      .then(data => { serverStreams = data.streams || [] })
      .catch(() => {})
    fetch(`${SERVER_URL}/api/status`)
      .then(r => r.json())
      .then(data => { if (data.audio) serverAudio = data.audio })
      .catch(() => {})
    fetch(`${SERVER_URL}/api/ticker`)
      .then(r => r.json())
      .then(data => { serverTicker = data.ticker || [] })
      .catch(() => {})
    fetch(`${SERVER_URL}/api/comments`)
      .then(r => r.json())
      .then(data => {
        commentsEnabled = data.enabled !== false
        serverComments = data.comments || []
      })
      .catch(() => {})
    fetch(`${SERVER_URL}/api/commentary`)
      .then(r => r.json())
      .then(data => { serverCommentary = data.commentary || [] })
      .catch(() => {})
  } catch (e) {}
}

function playStream(url) {
  serverAudio = { playing: true, url: url, volume: serverAudio.volume }
  try {
    fetch(`${SERVER_URL}/api/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, volume: serverAudio.volume })
    }).then(r => r.json()).then(d => { if (d.audio) serverAudio = d.audio }).catch(() => {})
  } catch (e) {}
}

function stopAudio() {
  serverAudio = { playing: false, url: null, volume: serverAudio.volume }
  try {
    fetch(`${SERVER_URL}/api/stop`, { method: 'POST' })
      .then(r => r.json()).then(d => { if (d.audio) serverAudio = d.audio }).catch(() => {})
  } catch (e) {}
}

function setVolume(level) {
  serverAudio = { ...serverAudio, volume: level }
  const el = document.getElementById('wm-vol-display')
  if (el) el.textContent = level + '%'
  try {
    fetch(`${SERVER_URL}/api/volume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level })
    }).then(r => r.json()).then(d => { if (d.audio) serverAudio = d.audio }).catch(() => {})
  } catch (e) {}
}

function toggleComments(enabled) {
  try {
    fetch(`${SERVER_URL}/api/comments/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    }).catch(() => {})
  } catch (e) {}
}

function parseOutput(raw) {
  let t = '', s = '', f = '[]', audio = 'off', shift = 'off'
  for (const line of (raw || '').split('\n')) {
    if (line.startsWith('TODAY:')) t = line.slice(6)
    else if (line.startsWith('SCHED:')) s = line.slice(6)
    else if (line.startsWith('FEED:')) f = line.slice(5)
    else if (line.startsWith('AUDIO:')) audio = line.slice(6).trim()
    else if (line.startsWith('SHIFT:')) shift = line.slice(6).trim()
  }
  const pe = x => { try { return JSON.parse(x).events || [] } catch (e) { return [] } }
  const pj = x => { try { return JSON.parse(x) } catch (e) { return [] } }
  return { today: pe(t), sched: pe(s), feed: pj(f), audio, shift }
}

function mapGame(ev) {
  const comp = (ev.competitions || [])[0] || {}
  const st = (comp.status || {}).type || {}
  const cs = comp.competitors || []
  const h = cs.find(c => c.homeAway === 'home') || cs[0] || {}
  const a = cs.find(c => c.homeAway === 'away') || cs[1] || {}
  return {
    id: ev.id, date: new Date(ev.date),
    state: st.state || 'pre', desc: st.shortDetail || '', clock: (comp.status || {}).displayClock || '',
    group: (ev.season || {}).slug || '',
    h: { short: (h.team || {}).shortDisplayName || '–', logo: (h.team || {}).logo || '', score: h.score || '0', w: h.winner || false },
    a: { short: (a.team || {}).shortDisplayName || '–', logo: (a.team || {}).logo || '', score: a.score || '0', w: a.winner || false },
    venue: ((comp.venue || {}).fullName) || '', city: (((comp.venue || {}).address) || {}).city || '',
  }
}

function slugLabel(s) {
  if (!s) return ''
  return s
    .replace('group-stage', 'Gruppe')
    .replace('group-', 'Gr.')
    .replace('round-of-16', 'Achtelfinale')
    .replace('quarterfinal', 'Viertelfinale')
    .replace('semifinal', 'Halbfinale')
    .replace('final', 'Finale')
}
function countdown(t) {
  const d = t - new Date(); if (d <= 0) return null
  return { d: Math.floor(d / 86400000), h: Math.floor((d % 86400000) / 3600000), m: Math.floor((d % 3600000) / 60000) }
}
function groupByDay(games) {
  const map = {}, keys = []
  games.forEach(g => {
    const k = g.date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!map[k]) { map[k] = []; keys.push(k) }
    map[k].push(g)
  })
  return keys.map(k => [k, map[k]])
}

export const render = ({ output }) => {
  ensureServer()
  fetchServerData()
  const { today, sched, feed, audio, shift } = parseOutput(output)
  sidePanelOpen = shift === 'on'
  const tg = today.map(mapGame)
  const sg = sched.map(mapGame)
  const live = tg.filter(g => g.state === 'in')
  const pre = tg.filter(g => g.state === 'pre')
  const post = tg.filter(g => g.state === 'post')
  const totalPlayed = sg.filter(g => g.state === 'post').length
  const now = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const cd = countdown(new Date('2026-06-11T18:00:00'))
  const todayKey = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const audioOn = audio === 'on'

  const sw = typeof window !== 'undefined' ? window.screen.width : 2560
  const W = sw < 1280 ? 340 : sw < 1440 ? 380 : sw < 1920 ? 420 : sw < 2560 ? 470 : sw < 3840 ? 520 : 580

  const GameCard = ({ g }) => {
    const isLive = g.state === 'in', isPost = g.state === 'post'
    return (
      <div className={`game ${isLive ? 'game-live' : ''}`}>
        <div className="g-top">
          <div className={`g-status ${isLive ? 'g-live' : isPost ? 'g-post' : 'g-pre'}`}>
            {isLive && <span className="ldot" />}
            {isLive ? `LIVE · ${g.clock}` : isPost ? `✓ ${g.desc}` : g.desc}
          </div>
          {g.group && <div className="g-tag">{slugLabel(g.group)}</div>}
        </div>
        <div className="g-teams">
          <div className="team">
            {g.h.logo && <img className="logo" src={g.h.logo} />}
            <div className="ti"><div className={`tn ${isPost && g.h.w ? 'tn-w' : isPost && !g.h.w ? 'tn-l' : ''}`}>{g.h.short}</div></div>
          </div>
          <div className="scorebox">
            {g.state !== 'pre'
              ? <div className="snums"><span className="sc">{g.h.score}</span><span className="ssep">:</span><span className="sc">{g.a.score}</span></div>
              : <div className="snums"><span className="vs">vs</span></div>}
          </div>
          <div className="team team-r">
            {g.a.logo && <img className="logo" src={g.a.logo} />}
            <div className="ti"><div className={`tn ${isPost && g.a.w ? 'tn-w' : isPost && !g.a.w ? 'tn-l' : ''}`}>{g.a.short}</div></div>
          </div>
        </div>
        {g.venue && <div className="venue">🏟 {g.venue}{g.city ? ` · ${g.city}` : ''}</div>}
      </div>
    )
  }

  const days = groupByDay(sg)
  const liveGames = serverTicker.filter(g => g.state === 'in')

  const SidePanel = () => (
    <div className={`side-panel ${sidePanelOpen ? 'open' : ''}`} style={{left: W + 'px'}}>
      <div className="sp-inner">
        <div className="sp-hdr">
          <span className="sp-title">
            {liveGames.length > 0 ? <span style={{color:'#ef4444',animation:'pulse 1.6s infinite',display:'inline-block'}}>●</span> : '📺'}
            &nbsp;Live-Ticker
            {serverCommentary.length > 0 && <span style={{background:'#21262d',color:'#9aa5c2',fontSize:'9px',padding:'1px 6px',borderRadius:'6px',fontWeight:'800'}}>{serverCommentary.length}</span>}
          </span>
          <span className="sp-close" onClick={toggleSidePanel}>✕</span>
        </div>
        <div className="sp-scroll">
          {liveGames.length === 0 && serverCommentary.length === 0 && serverComments.length === 0 ? (
            <div className="sp-empty">
              Kein Spiel aktiv.<br />
              Der Ticker erscheint sobald<br />
              ein Spiel läuft.
            </div>
          ) : null}

          {liveGames.length > 0 && (
            <div>
              <div className="sp-sec">🔴 Jetzt live</div>
              {liveGames.map((g, i) => (
                <div key={i} className="sp-ticker-item sp-ticker-live">
                  <div style={{flex:1}}>
                    <div className="sp-ticker-teams">{g.home} – {g.away}</div>
                    {g.detail && <div style={{fontSize:'9px',color:'#34d399',marginTop:'2px'}}>{g.detail}</div>}
                  </div>
                  <div className="sp-ticker-score">{g.home_score}:{g.away_score}</div>
                  <div className="sp-ticker-clock">{g.clock}</div>
                </div>
              ))}
            </div>
          )}

          {serverCommentary.length > 0 && (
            <div>
              <div className="sp-sec">📝 Ereignisse</div>
              {serverCommentary.slice().reverse().map((ev, i) => {
                const t = (ev.type || '').toLowerCase()
                const isGoal = t.includes('goal') || t.includes('tor') || ev.text.includes('⚽')
                const isRedCard = t.includes('red') || t.includes('rot')
                const isYellowCard = t.includes('yellow') || t.includes('gelb')
                const isSub = t.includes('sub') || t.includes('wechsel')
                let cls = 'sp-event'
                if (isGoal) cls += ' sp-event-goal'
                else if (isRedCard) cls += ' sp-event-card-r'
                else if (isYellowCard) cls += ' sp-event-card-y'
                else if (isSub) cls += ' sp-event-sub'
                return (
                  <div key={i} className={cls}>
                    {ev.match && <div className="sp-match">{ev.match}</div>}
                    {ev.clock && <div className="sp-clock">{ev.clock}</div>}
                    <div className="sp-text">{ev.text}</div>
                  </div>
                )
              })}
            </div>
          )}

          {serverComments.length > 0 && (
            <div>
              <div className="sp-sec">💬 Kommentare</div>
              {serverComments.map((c, i) => (
                <div key={i} className="sp-comment">
                  <div className="sp-comment-src">{c.source || 'kicker'}</div>
                  <div className="sp-comment-txt">{c.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className={`wm2026-root ${widgetHidden ? 'hidden' : ''} ${W <= 340 ? 'wm2026-sm' : ''}`}>

    <div className="notch" onClick={toggleHidden}>
      {live.length > 0 && <span className="notch-live" />}
      <span className="notch-ball">⚽</span>
      <span className="notch-label">WM 2026</span>
      <span className="notch-chev">▶</span>
    </div>

    <div className="widget" style={{ width: W + 'px' }}>

      <div className="hdr">
        <div className="hdr-l">
          <div className="ball">⚽</div>
          <div>
            <div className="h-title">WM 2026</div>
            <div className="h-sub">USA · Kanada · Mexiko · <b>104 Spiele</b></div>
          </div>
        </div>
        <div className="h-r">
          {live.length > 0 && <div className="h-badge">● LIVE</div>}
          <div className="h-time">⟳ {now}</div>
          <div className="h-r-btns">
            <span className="sp-toggle" onClick={toggleSidePanel}>{sidePanelOpen ? '◀ Ticker' : 'Ticker ▶'}</span>
            <span className="hide-btn" onClick={toggleHidden}>✕ Ausblenden</span>
          </div>
        </div>
      </div>

      <div className="ctl">
        <div className="ctl-row">
          <div className="btn btn-magenta" onClick={openMagenta}>📺 MagentaTV</div>
          <div className={`btn ${audioOn ? 'btn-audio-on' : 'btn-audio-off'}`} onClick={() => toggleAudio(audioOn)}>
            {audioOn ? '🔊 Tor-Sound AN' : '🔇 Tor-Sound AUS'}
          </div>
          <div className="btn btn-test" onClick={testAudio} style={{fontSize:'11px'}}>▶ Test</div>
        </div>

        {live.length > 0 ? (
          <div>
            <div className="wlbl">🔴 Jetzt live — Stream wählen</div>
            {live.map(g => (
              <div key={g.id} className="wgame wgame-live">
                <div className="wg-teams">{g.h.short} <span className="wg-score">{g.h.score}:{g.a.score}</span> {g.a.short}</div>
                <div className="wg-clock">{g.clock}</div>
                <div className="wg-btn" onClick={openMagenta}>▶ Stream</div>
              </div>
            ))}
          </div>
        ) : pre.length > 0 ? (
          <div>
            <div className="wlbl">📺 Heute noch</div>
            {pre.slice(0, 3).map(g => (
              <div key={g.id} className="wgame">
                <div className="wg-teams">{g.h.short} vs {g.a.short}</div>
                <div className="wg-clock">{g.date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`livewrap ${expanded ? 'expanded' : ''}`}>
        <div className="live-toggle" onClick={toggleExpand}>
          <span className="lt-l">
            📻 Live-Audio &amp; Streams
            {serverAudio.playing && <span className="lt-live">● WIEDERGABE</span>}
            {serverStreams.filter(s => s.online).length > 0 && (
              <span className="lt-badge">{serverStreams.filter(s => s.online).length}</span>
            )}
          </span>
          <span className="chev">▾</span>
        </div>
        <div className="livepanel">
          <div className="live-actions">
            <div className="la-row">
              {serverAudio.playing ? (
                <div className="la-btn la-on la-flex" onClick={stopAudio}>⏹ Stop</div>
              ) : (
                <div className="la-btn la-off la-flex">🔇 Gestoppt</div>
              )}
              <div className="la-btn la-test" onClick={() => setVolume(Math.max(0, serverAudio.volume - 10))}>−</div>
              <div id="wm-vol-display" className="la-btn" style={{fontSize:'11px',color:'#9aa5c2',flex:'0 0 auto',padding:'9px 8px'}}>{serverAudio.volume}%</div>
              <div className="la-btn la-test" onClick={() => setVolume(Math.min(100, serverAudio.volume + 10))}>+</div>
            </div>

            <div className="wlbl" style={{marginTop:'4px'}}>
              Verfügbare Streams ({serverStreams.filter(s => s.online).length}/{serverStreams.length})
            </div>
            {serverStreams.filter(s => s.online).length === 0 ? (
              <div className="lf-empty">Streams werden geprüft…</div>
            ) : (
              <div className="streams-scroll">
                {serverStreams.filter(s => s.online).map((s, i) => {
                  const playing = serverAudio.playing && serverAudio.url === s.url
                  return (
                    <div key={i} className="la-row">
                      <div className="la-btn la-flex" style={{textAlign:'left',fontSize:'11px',color: playing ? '#34d399' : '#c9d1d9',background: playing ? '#16352a' : '#161b22',border:`1px solid ${playing ? '#1f7a5a' : '#21262d'}`}}>
                        {COUNTRY_FLAGS[s.country] || '🌍'} {s.name}
                        <span style={{color:'#4b5563',marginLeft:'5px'}}>{s.language.toUpperCase()}</span>
                      </div>
                      <div className="la-btn la-radio" style={{flex:'0 0 auto'}} onClick={() => playing ? stopAudio() : playStream(s.url)}>
                        {playing ? '⏹' : '▶'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sbar">
        <div className={`sb ${live.length > 0 ? 'sb-live' : ''}`}>
          <div className="sb-v">{live.length || pre.length}</div>
          <div className="sb-l">{live.length > 0 ? 'Live' : 'Heute'}</div>
        </div>
        <div className="sb"><div className="sb-v">{post.length}</div><div className="sb-l">Fertig</div></div>
        <div className="sb"><div className="sb-v">{totalPlayed}</div><div className="sb-l">Gespielt</div></div>
        <div className="sb"><div className="sb-v">{104 - totalPlayed}</div><div className="sb-l">Offen</div></div>
      </div>

      <div className="scroll">
        {live.length > 0 && <div><div className="sec">🔴 Jetzt live</div>{live.map(g => <GameCard key={g.id} g={g} />)}</div>}
        {pre.length > 0 && <div><div className="sec">🕐 Heute noch</div>{pre.map(g => <GameCard key={g.id} g={g} />)}</div>}
        {post.length > 0 && <div><div className="sec">✓ Heute abgeschlossen</div>{post.map(g => <GameCard key={g.id} g={g} />)}</div>}

        {tg.length === 0 && (
          <div>
            <div className="empty">
              <div className="ei">⚽</div>
              <div className="et">Heute keine Spiele</div>
              <div className="es">Die WM 2026 startet am<br /><span className="edate">11. Juni 2026</span></div>
            </div>
            {cd && (
              <div className="cdown">
                <div className="cd"><div className="cd-v">{cd.d}</div><div className="cd-l">Tage</div></div>
                <div className="cd"><div className="cd-v">{cd.h}</div><div className="cd-l">Std</div></div>
                <div className="cd"><div className="cd-v">{cd.m}</div><div className="cd-l">Min</div></div>
              </div>
            )}
          </div>
        )}

        <div className="sec">📅 Kompletter Spielplan</div>
        {days.map(([day, games]) => {
          const isToday = day === todayKey
          return (
            <div key={day}>
              <div className={`day-hdr ${isToday ? 'day-today' : ''}`}>
                <span>{isToday ? '📅 Heute · ' + day : day}</span>
                <span className="day-cnt">{games.filter(g => g.state === 'post').length}/{games.length}</span>
              </div>
              {games.map(g => {
                const isLive = g.state === 'in', isPost = g.state === 'post'
                const t = g.date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={g.id} className={`sg ${isLive ? 'sg-live' : ''}`}>
                    <div className={`sg-t ${isLive ? 'sg-t-live' : isPost ? 'sg-t-post' : ''}`}>{isLive ? g.clock : t}</div>
                    <div className="sg-flags">
                      {g.h.logo && <img className="sg-flag" src={g.h.logo} />}
                      {g.a.logo && <img className="sg-flag" src={g.a.logo} />}
                    </div>
                    <div className="sg-info">
                      <div className={`sg-match ${isLive ? 'sg-match-live' : isPost ? 'sg-match-post' : ''}`}>{g.h.short} vs {g.a.short}</div>
                      <div className="sg-meta">{slugLabel(g.group)}{g.city ? ' · ' + g.city : ''}</div>
                    </div>
                    {(isLive || isPost)
                      ? <div className={`sg-res ${isLive ? 'sg-res-live' : ''}`}>{g.h.score}:{g.a.score}</div>
                      : <div className="sg-dash">–</div>}
                    {isLive && <div className="sg-btn" onClick={openMagenta}>▶</div>}
                  </div>
                )
              })}
            </div>
          )
        })}

        <div className={`comments-wrap ${commentsExpanded ? 'expanded' : ''}`}>
          <div className="comments-toggle" onClick={toggleCommentsExpand}>
            <span className="lt-l">
              💬 Kommentare
              {commentsEnabled === false && <span className="lt-badge">AUS</span>}
              {serverComments.length > 0 && commentsEnabled && <span className="lt-badge">{serverComments.length}</span>}
            </span>
            <span className="chev">▾</span>
          </div>
          <div className="comments-panel">
            <div className="live-actions">
              <div className="la-row">
                <div className={`la-btn la-flex ${commentsEnabled ? 'la-on' : 'la-off'}`} onClick={() => toggleComments(!commentsEnabled)}>
                  {commentsEnabled ? '💬 Kommentare AN' : '💬 Kommentare AUS'}
                </div>
              </div>
            </div>
            <div className="comments-list">
              {commentsEnabled && serverComments.length === 0 && (
                <div className="lf-empty">Noch keine Kommentare geladen. Der Server prüft alle 45 Sekunden.</div>
              )}
              {!commentsEnabled && (
                <div className="lf-empty">Kommentare sind deaktiviert. Aktiviere sie oben.</div>
              )}
              {commentsEnabled && serverComments.map((c, i) => (
                <div key={i} className="comment-item">
                  <b>{c.source}</b> · {c.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="foot">
          <div className="ft">Quelle: <b>ESPN</b> · Widget 3s · API-Cache 30s</div>
          <div className="ft"><b>Server</b> · {SERVER_URL}</div>
        </div>
      </div>
    </div>
    <SidePanel />
    </div>
  )
}
