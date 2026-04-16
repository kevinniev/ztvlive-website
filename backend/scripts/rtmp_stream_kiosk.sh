#!/bin/bash
#
# ZTVLIVE RTMP Stream Pusher - KIOSK MODE VERSION
# Uses pure --kiosk flag (alternative to --app mode)
# Try this if rtmp_stream.sh still shows browser chrome
#

RTMP_URL="rtmp://us-west.castr.io/static"
STREAM_KEY="live_b8b938d0c6b811eab6745b4605902bfa?password=2cee9565"

# Use the TV BROADCAST page (game UI, QR code, leaderboard)
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

LOG_FILE="/var/log/ztvlive_stream_kiosk.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

cleanup() {
    log "Stopping stream..."
    pkill -f "ffmpeg.*rtmp://us-west.castr.io" 2>/dev/null
    pkill -f "chromium.*DISPLAY=:$DISPLAY_NUM" 2>/dev/null
    pkill -f "Xvfb :$DISPLAY_NUM" 2>/dev/null
    log "Stream stopped."
}

trap cleanup EXIT

# Start virtual display
log "Starting virtual display :$DISPLAY_NUM ($WIDTH x $HEIGHT)"
Xvfb :$DISPLAY_NUM -screen 0 ${WIDTH}x${HEIGHT}x24 &
sleep 2

export DISPLAY=:$DISPLAY_NUM

# Start Chromium in PURE KIOSK mode
# Note: --kiosk takes over the full screen and hides ALL browser UI
log "Starting Chromium in PURE KIOSK mode..."
chromium --no-sandbox \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-dev-shm-usage \
    --autoplay-policy=no-user-gesture-required \
    --kiosk \
    --disable-pinch \
    --overscroll-history-navigation=0 \
    --disable-infobars \
    --noerrdialogs \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --disable-notifications \
    --disable-translate \
    --disable-features=TranslateUI,Translate,InfiniteSessionRestore \
    --disable-popup-blocking \
    --disable-extensions \
    --disable-component-extensions-with-background-pages \
    --no-first-run \
    --no-default-browser-check \
    --disable-default-apps \
    --check-for-update-interval=31536000 \
    "$WATCH_URL" &

CHROME_PID=$!
log "Chromium started (PID: $CHROME_PID)"

# Wait for page to load
log "Waiting 20 seconds for page and video to fully load..."
sleep 20

# Start FFmpeg stream
log "Starting RTMP stream to $RTMP_URL"
log "Stream key: ${STREAM_KEY:0:20}..."

ffmpeg -y \
    -f x11grab -framerate $FPS -video_size ${WIDTH}x${HEIGHT} -i :$DISPLAY_NUM \
    -f pulse -i default \
    -c:v libx264 -preset $PRESET -b:v $VIDEO_BITRATE -maxrate $VIDEO_BITRATE -bufsize 8000k \
    -g $(($FPS * 2)) -keyint_min $FPS \
    -c:a aac -b:a $AUDIO_BITRATE -ar 44100 \
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
