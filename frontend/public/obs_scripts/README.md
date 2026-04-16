# ZTVLIVE OBS Auto Scene Switcher v2.0

Automatically switch OBS scenes based on ZTVLIVE playback state with **3-scene rotation** for a flawless broadcast experience.

## Scene Rotation

```
When issues detected:
  LIVE → PROMO (2 videos) → GAME (15 sec) → LIVE

Flow diagram:
  ┌─────────┐     Issues      ┌─────────┐
  │  LIVE   │ ──────────────► │  PROMO  │
  │  FEED   │                 │ VIDEOS  │
  └────┬────┘                 └────┬────┘
       │                           │
       │ ◄──── Ready ─────────────┘
       │                     After 2 promos
       │                           │
       │                           ▼
       │                     ┌─────────┐
       └──── After 15s ───── │  GAME   │
                             │  SHOW   │
                             └─────────┘
```

---

## Quick Setup

### Step 1: Create OBS Scenes

| Scene Name | Browser Source URL | Purpose |
|------------|-------------------|---------|
| `Creator Content` | `https://ztvlivestream.com/obs-creator` | YouTube creator content |
| `PROMO VIDEOS` | `https://ztvlivestream.com/obs-promo` | Gap filler promos |
| `Game Feed` | Your game overlay or custom feed | Game transitions |

**Alternative URLs:**
- `/obs-clean` - Castr HLS stream (if configured)
- `/creator-feed` - Alias for obs-creator
- `/broadcast-feed` - Alias for obs-clean

**Browser Source Settings:**
- Width: 1920
- Height: 1080
- ✅ Control audio via OBS
- ✅ Shutdown source when not visible
- ✅ Refresh browser when scene becomes active
- Custom CSS: `body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }`

### Step 2: Choose Your Method

---

## Option A: OBS Python Script (Built-in)

Best for simple setups.

1. Download `ztvlive_scene_switcher.py`
2. OBS → Tools → Scripts → Click "+"
3. Add the script
4. Configure scene names
5. Click "▶ Start Auto-Switch"

**Settings:**
| Setting | Default | Description |
|---------|---------|-------------|
| Poll Interval | 3 sec | How often to check API |
| Min Promo Duration | 8 sec | Minimum time per promo |
| Game Duration | 15 sec | Time on game scene |
| Max Promos | 2 | Promos before game |

---

## Option B: External Python Script (Recommended)

Runs outside OBS with better control and logging.

**Install dependencies:**
```bash
pip install obsws-python requests
```

**Enable OBS WebSocket:**
1. OBS → Tools → WebSocket Server Settings
2. ✅ Enable WebSocket Server
3. Set password
4. Note port (default: 4455)

**Run:**
```bash
python ztvlive_obs_switcher_external.py --password YOUR_PASSWORD
```

**Full options:**
```bash
python ztvlive_obs_switcher_external.py \
    --host localhost \
    --port 4455 \
    --password YOUR_PASSWORD \
    --scene-live "LIVE FEED" \
    --scene-promo "PROMO VIDEOS" \
    --scene-game "GAME SHOW" \
    --interval 3 \
    --promo-duration 8 \
    --game-duration 15 \
    --max-promos 2
```

---

## API Endpoints

### GET /api/obs/scene
Returns recommended scene with rotation state.

```json
{
  "scene": "LIVE",
  "reason": "Normal playback",
  "is_live_ready": true,
  "promo_count": 0,
  "remaining_seconds": 145,
  "current_video": "Song Title"
}
```

### POST /api/obs/scene-change
Report scene changes (called automatically by scripts).

```bash
curl -X POST "https://ztvlivestream.com/api/obs/scene-change?scene=PROMO&reason=Video%20ending"
```

### GET /api/obs/promo-playlist
Get promo videos from database.

```json
{
  "playlist": [
    {"id": "...", "title": "...", "video_url": "..."},
    ...
  ],
  "database_count": 5,
  "local_count": 9
}
```

### GET /api/obs/rotation-config
Get rotation configuration.

### GET /api/obs/status
Get full status for debugging.

---

## Rotation Logic

The script follows this logic:

**PROMO Scene:**
- Stay until MIN_PROMO_DURATION (8s) elapsed
- After showing MAX_PROMOS (2), transition to GAME

**GAME Scene:**
- Stay for GAME_DURATION (15s)
- If LIVE ready → go to LIVE
- If LIVE not ready → go back to PROMO

**LIVE Scene:**
- If issues detected → go to PROMO
- Otherwise → stay on LIVE

---

## Troubleshooting

### "Scene not found"
Scene names must match EXACTLY (case-sensitive).
Default names: `LIVE FEED`, `PROMO VIDEOS`, `GAME SHOW`

### "Cannot connect to OBS"
- OBS must be running
- WebSocket must be enabled: Tools → WebSocket Server Settings
- Check port number (default 4455)
- Verify password

### "API errors"
- Check internet connection
- Test: `curl https://ztvlivestream.com/api/obs/scene`
- Script auto-switches to PROMO on persistent errors

### No video in browser sources
- Enable "Shutdown source when not visible"
- Try refreshing sources manually
- Check URLs are correct

---

## Download

- [ztvlive_scene_switcher.py](./ztvlive_scene_switcher.py) - OBS built-in script
- [ztvlive_obs_switcher_external.py](./ztvlive_obs_switcher_external.py) - External WebSocket script

---

## Support

For issues: ZTVLIVE Support

Version: 2.0.0
