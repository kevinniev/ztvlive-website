import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * ROKU BROADCAST FEED - PURE VIDEO ONLY
 * 
 * This page shows ONLY the video player - nothing else.
 * Designed for RTMP capture to Roku/Fire TV.
 * 
 * - No browser chrome (use with --kiosk or --app flags)
 * - No QR codes, no game overlay, no leaderboard
 * - Just fullscreen video that auto-plays and auto-advances
 */

// Extract YouTube video ID from URL
const getYouTubeVideoId = (url) => {
  if (!url) return null;
  const match = url.match(/youtube\.com\/embed\/([^?]+)/) || 
                url.match(/youtube\.com\/watch\?v=([^&]+)/) || 
                url.match(/youtu\.be\/([^?]+)/);
  return match ? match[1] : null;
};

export default function RokuBroadcastFeed() {
  const [currentContent, setCurrentContent] = useState(null);
  const [ytApiReady, setYtApiReady] = useState(false);
  const playerRef = useRef(null);
  const currentVideoIdRef = useRef(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtApiReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(tag, firstScript);

    window.onYouTubeIframeAPIReady = () => {
      setYtApiReady(true);
    };
  }, []);

  // Fetch current content
  const fetchContent = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/tv/sync`);
      const data = res.data;
      
      setCurrentContent({
        id: data.video_id || data.now_playing?.id,
        title: data.title || data.now_playing?.title,
        video_url: data.video_url || data.now_playing?.video_url,
        elapsed_seconds: data.elapsed_seconds || 0,
      });
    } catch (err) {
      console.error('Failed to fetch content:', err);
    }
  }, []);

  // Initial fetch and refresh every 30 seconds
  useEffect(() => {
    fetchContent();
    const interval = setInterval(fetchContent, 30000);
    return () => clearInterval(interval);
  }, [fetchContent]);

  // Initialize YouTube player
  useEffect(() => {
    if (!currentContent || !ytApiReady) return;
    
    const videoId = getYouTubeVideoId(currentContent.video_url);
    if (!videoId) return;
    
    if (videoId === currentVideoIdRef.current && playerRef.current) return;
    
    currentVideoIdRef.current = videoId;
    
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
        playerRef.current = null;
      } catch (e) {}
    }
    
    const startTime = Math.floor(currentContent.elapsed_seconds || 0);
    
    const initPlayer = () => {
      const container = document.getElementById('broadcast-player');
      if (!container) {
        setTimeout(initPlayer, 200);
        return;
      }
      
      try {
        playerRef.current = new window.YT.Player('broadcast-player', {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            mute: 0,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            showinfo: 0,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            start: startTime,
            enablejsapi: 1,
            origin: window.location.origin,
            cc_load_policy: 0,
          },
          events: {
            onReady: (event) => {
              event.target.setVolume(70);
              event.target.playVideo();
            },
            onStateChange: (event) => {
              if (event.data === 0) {
                // Video ended - fetch next
                fetchContent();
              } else if (event.data === 2) {
                // Paused - auto resume
                event.target.playVideo();
              }
            },
            onError: () => {
              // Error - skip to next video
              setTimeout(fetchContent, 2000);
            }
          }
        });
      } catch (e) {
        console.error('Player init error:', e);
      }
    };
    
    setTimeout(initPlayer, 100);
  }, [currentContent?.id, ytApiReady, fetchContent]);

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
      }}
    >
      <div 
        id="broadcast-player"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
