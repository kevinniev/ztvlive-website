#!/bin/bash

RTMP_URL="rtmp://us-west.castr.io/static"
STREAM_KEY="live_4b7189d06d5211eb981d29252a61de03?password=d57f82ac"
BROADCAST_URL="https://best-bites-live.preview.emergentagent.com/broadcast-view"
DISPLAY_NUM=99
RESOLUTION="1920x1080"

echo "$(date): Starting BROADCAST VIEW stream"
echo "URL: $BROADCAST_URL"

# Clean up
pkill -f "Xvfb :$DISPLAY_NUM" 2>/dev/null
rm -rf /tmp/chrome-broadcast
sleep 1

# Start Xvfb
Xvfb :$DISPLAY_NUM -screen 0 ${RESOLUTION}x24 &
sleep 3

export DISPLAY=:$DISPLAY_NUM

# Start Chromium in KIOSK mode (no browser UI at all)
chromium \
  --no-sandbox \
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --no-first-run \
  --disable-extensions \
  --disable-background-networking \
  --disable-sync \
  --disable-translate \
  --autoplay-policy=no-user-gesture-required \
  --kiosk \
  --app="$BROADCAST_URL" \
  --window-size=1920,1080 \
  --window-position=0,0 \
  --disable-infobars \
  --disable-notifications \
  --disable-popup-blocking \
  --hide-scrollbars \
  --ignore-certificate-errors \
  --user-data-dir=/tmp/chrome-broadcast \
  2>/dev/null &

echo "$(date): Chromium in kiosk mode started"
echo "$(date): Waiting 15 seconds for page to fully load..."
sleep 15

# Start ffmpeg
echo "$(date): Starting FFmpeg stream..."
ffmpeg \
  -f x11grab \
  -framerate 30 \
  -video_size $RESOLUTION \
  -i :$DISPLAY_NUM \
  -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
  -c:v libx264 \
  -preset veryfast \
  -tune zerolatency \
  -b:v 3000k \
  -maxrate 3500k \
  -bufsize 6000k \
  -pix_fmt yuv420p \
  -g 60 \
  -c:a aac \
  -b:a 128k \
  -ar 44100 \
  -f flv \
  "${RTMP_URL}/${STREAM_KEY}" \
  2>&1 &

echo "$(date): Stream is LIVE!"
wait
