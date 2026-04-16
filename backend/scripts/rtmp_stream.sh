#!/bin/bash
#
# ZTVLIVE RTMP Stream Pusher
# Captures the Roku Stream page (clean broadcast UI) and streams to RTMP endpoint
#
# Key Features:
# - Uses /roku-stream route (fullscreen TV-optimized UI, no browser chrome)
# - Kiosk mode to hide all browser UI elements
# - Autoplay enabled for continuous streaming
# - Direct audio input (file or stream URL)
# - AUTO-INSTALLS dependencies if missing
#

# ===== AUTO-INSTALL DEPENDENCIES =====
echo "[ZTVLIVE] Checking dependencies..."

install_deps() {
    echo "[ZTVLIVE] Installing missing dependencies..."
    apt-get update -qq
    apt-get install -y -qq ffmpeg xvfb chromium > /dev/null 2>&1
    echo "[ZTVLIVE] Dependencies installed!"
}

# Check and install if missing
if ! command -v ffmpeg &> /dev/null; then
    echo "[ZTVLIVE] ffmpeg not found, installing..."
    install_deps
fi

if ! command -v chromium &> /dev/null; then
    echo "[ZTVLIVE] chromium not found, installing..."
    install_deps
fi

if ! command -v Xvfb &> /dev/null; then
    echo "[ZTVLIVE] Xvfb not found, installing..."
    install_deps
fi

echo "[ZTVLIVE] All dependencies OK!"
# ===== END DEPENDENCY CHECK =====

RTMP_URL="rtmp://us-west.castr.io/static"
STREAM_KEY="live_b8b938d0c6b811eab6745b4605902bfa?password=2cee9565"

# Use the TV BROADCAST page (game UI, QR code, leaderboard - no video embed)
WATCH_URL="https://best-bites-live.preview.emergentagent.com/roku-tv"

# Display settings
DISPLAY_NUM=99
WIDTH=1920
HEIGHT=1080
FPS=30

# Output settings
VIDEO_BITRATE="4500k"
AUDIO_BITRATE="128k"
PRESET="veryfast"

# Audio source - can be a file path or stream URL
# Options:
# 1. Local file: /app/backend/audio/background_music.mp3
# 2. Internet radio: http://stream.example.com/radio.mp3
# 3. Silent: leave empty for anullsrc
# WORLD MUSIC MIX - Rotates through different genres:
# - SomaFM Fluid: Eclectic/World
# - SomaFM Suburbs of Goa: World/Electronica  
# - SomaFM Lush: Female vocals/World
# - SomaFM Beat Blender: Electronic/World
AUDIO_STREAMS=(
    "https://ice1.somafm.com/fluid-128-mp3"
    "https://ice1.somafm.com/suburbsofgoa-128-mp3"
    "https://ice1.somafm.com/lush-128-mp3"
    "https://ice1.somafm.com/beatblender-128-mp3"
    "https://ice1.somafm.com/indiepop-128-mp3"
    "https://ice1.somafm.com/poptron-128-mp3"
)

# Pick a random stream for variety
RANDOM_IDX=$((RANDOM % ${#AUDIO_STREAMS[@]}))
AUDIO_SOURCE="${AUDIO_SOURCE:-${AUDIO_STREAMS[$RANDOM_IDX]}}"

# Log file
LOG_FILE="/var/log/ztvlive_stream.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

cleanup() {
    log "Stopping stream..."
    pkill -f "ffmpeg.*rtmp://us-west.castr.io" 2>/dev/null
    pkill -f "chromium" 2>/dev/null
    pkill -f "Xvfb :$DISPLAY_NUM" 2>/dev/null
    log "Stream stopped."
}

trap cleanup EXIT

# Start virtual display
log "Starting virtual display :$DISPLAY_NUM ($WIDTH x $HEIGHT)"
Xvfb :$DISPLAY_NUM -screen 0 ${WIDTH}x${HEIGHT}x24 &
sleep 3

export DISPLAY=:$DISPLAY_NUM

# Start Chromium in TRUE kiosk mode - NO WARNING BARS
log "Starting Chromium with Roku stream page (app mode - zero chrome)..."

chromium --no-sandbox \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-dev-shm-usage \
    --autoplay-policy=no-user-gesture-required \
    --start-fullscreen \
    --kiosk \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --noerrdialogs \
    --disable-notifications \
    --disable-translate \
    --disable-features=TranslateUI,Translate,InfiniteSessionRestore,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure \
    --disable-popup-blocking \
    --disable-extensions \
    --disable-component-extensions-with-background-pages \
    --disable-background-networking \
    --disable-sync \
    --no-first-run \
    --no-default-browser-check \
    --disable-default-apps \
    --disable-hang-monitor \
    --disable-prompt-on-repost \
    --disable-client-side-phishing-detection \
    --force-device-scale-factor=1 \
    --window-size=${WIDTH},${HEIGHT} \
    --window-position=0,0 \
    --test-type \
    --enable-features=OverlayScrollbar \
    --hide-scrollbars \
    --disable-blink-features=AutomationControlled \
    --app="$WATCH_URL" &

CHROME_PID=$!
log "Chromium started (PID: $CHROME_PID)"

# Wait for page to load
log "Waiting 20 seconds for page to fully load..."
sleep 20

# Start FFmpeg stream
log "Starting RTMP stream to $RTMP_URL"

# Determine audio input
if [ -n "$AUDIO_SOURCE" ]; then
    if [ -f "$AUDIO_SOURCE" ]; then
        # Local file - loop it
        log "Using local audio file: $AUDIO_SOURCE"
        AUDIO_INPUT="-stream_loop -1 -i $AUDIO_SOURCE"
    else
        # Stream URL
        log "Using audio stream: $AUDIO_SOURCE"
        AUDIO_INPUT="-i $AUDIO_SOURCE"
    fi
else
    # Silent audio
    log "Using silent audio (no audio source configured)"
    AUDIO_INPUT="-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100"
fi

# Run FFmpeg with configured audio at 35% volume (featured music for game)
# CASTR ENGINEER RECOMMENDED SETTINGS FOR ROKU:
# - Profile: Main (more compatible than High)
# - Level: 4.0 (safer than 4.1)
# - sc_threshold 0: Disable scene change detection for consistent keyframes
# - keyint_min 60: Match GOP size for better segmentation
ffmpeg -y \
    -f x11grab -framerate $FPS -video_size ${WIDTH}x${HEIGHT} -i :$DISPLAY_NUM \
    $AUDIO_INPUT \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p" \
    -c:v libx264 -profile:v main -level:v 4.0 -preset $PRESET \
    -b:v $VIDEO_BITRATE -maxrate $VIDEO_BITRATE -bufsize 9000k \
    -g $(($FPS * 2)) -keyint_min $(($FPS * 2)) -sc_threshold 0 \
    -pix_fmt yuv420p \
    -af "volume=0.35" \
    -c:a aac -b:a $AUDIO_BITRATE -ar 44100 -ac 2 \
    -shortest \
    -f flv "${RTMP_URL}/${STREAM_KEY}" \
    2>&1 | tee -a $LOG_FILE &

FFMPEG_PID=$!
log "FFmpeg started (PID: $FFMPEG_PID)"

# Monitor the stream
log "Stream is LIVE! Monitoring..."
while kill -0 $FFMPEG_PID 2>/dev/null; do
    sleep 30
    log "Stream still running..."
done

log "Stream ended."
