import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const API = '/api';

/**
 * OBS Player Page - Maintains sync even on refresh
 * Uses YouTube Player API for seamless playback
 */
const OBSPlayerPage = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);
  
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const currentVideoIdRef = useRef(null);
  const targetSeekTimeRef = useRef(0);
  const lastSyncRef = useRef(0);

  // Extract video ID
  const extractVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?\s]+)/);
    return match ? match[1] : null;
  };

  // Load YouTube API
  useEffect(() => {
    if (window.YT?.Player) {
      setPlayerReady(true);
      return;
    }
    
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    
    window.onYouTubeIframeAPIReady = () => setPlayerReady(true);
    return () => { window.onYouTubeIframeAPIReady = null; };
  }, []);

  // Create or update player
  const setupPlayer = useCallback((videoId, seekTo) => {
    if (!window.YT?.Player || !containerRef.current) return;

    // Same video - just seek to correct position
    if (playerRef.current && currentVideoIdRef.current === videoId) {
      try {
        const currentTime = playerRef.current.getCurrentTime?.() || 0;
        const drift = Math.abs(currentTime - seekTo);
        
        // Only seek if more than 5 seconds off (avoid constant seeking)
        if (drift > 5) {
          console.log(`Syncing: drift ${drift.toFixed(1)}s, seeking to ${seekTo}`);
          playerRef.current.seekTo(seekTo, true);
        }
        
        // Ensure playing
        const state = playerRef.current.getPlayerState?.();
        if (state !== 1) { // 1 = playing
          playerRef.current.playVideo();
        }
      } catch (e) {
        console.error('Seek error:', e);
      }
      return;
    }

    // New video - destroy old player and create new one
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (e) {}
      playerRef.current = null;
    }

    console.log('Loading video:', videoId, 'at', seekTo, 'seconds');
    currentVideoIdRef.current = videoId;

    // Clear container
    containerRef.current.innerHTML = '<div id="yt-player"></div>';

    playerRef.current = new window.YT.Player('yt-player', {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        mute: 0,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        playsinline: 1,
        start: Math.floor(seekTo),
        enablejsapi: 1
      },
      events: {
        onReady: (e) => {
          console.log('Player ready');
          e.target.setVolume(100);
          e.target.playVideo();
        },
        onStateChange: (e) => {
          // Video ended naturally - notify backend
          if (e.data === 0) { // 0 = ended
            console.log('Video ended naturally, notifying backend');
            axios.post(`${API}/creator-schedule/video-ended`, {
              video_id: videoId,
              actual_duration_seconds: Math.floor(e.target.getDuration?.() || 0)
            }).catch(err => console.log('Video end notification failed:', err));
          }
          // Auto-resume if paused
          if (e.data === 2) { // paused
            setTimeout(() => {
              if (playerRef.current && currentVideoIdRef.current === videoId) {
                playerRef.current.playVideo();
              }
            }, 1000);
          }
        },
        onError: (e) => console.error('Player error:', e.data)
      }
    });
  }, []);

  // Fetch sync data
  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/tv/sync`);
      const data = res.data;
      const nowPlaying = data.now_playing || data;
      const isCreator = data.is_creator_content || nowPlaying?.is_creator_content;

      if (isCreator) {
        const videoUrl = data.video_url || nowPlaying?.video_url || '';
        const videoId = extractVideoId(videoUrl);
        const elapsed = Math.floor(data.elapsed_seconds || data.start_from_seconds || 0);
        const duration = nowPlaying?.duration_seconds || data.duration_seconds || 300;

        targetSeekTimeRef.current = elapsed;

        if (playerReady && videoId) {
          setupPlayer(videoId, elapsed);
        }

        setStatus({
          scene: "creator",
          is_creator_live: true,
          video_id: videoId,
          title: data.title || nowPlaying?.title,
          creator_name: data.creator_name || nowPlaying?.creator_name,
          remaining_seconds: Math.max(0, duration - elapsed),
          elapsed_seconds: elapsed
        });
      } else {
        // No creator content
        if (playerRef.current) {
          try { playerRef.current.destroy(); } catch (e) {}
          playerRef.current = null;
        }
        currentVideoIdRef.current = null;
        
        setStatus({
          scene: "game",
          is_creator_live: false
        });
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setLoading(false);
    }
  }, [playerReady, setupPlayer]);

  // Poll every 5 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const formatTime = (s) => {
    if (!s || s <= 0) return "0:00";
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  };

  if (loading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Loading ZTVLIVE...</div>
      </div>
    );
  }

  // Creator content
  if (status?.is_creator_live && status?.video_id) {
    return (
      <div className="w-screen h-screen bg-black overflow-hidden relative">
        <div ref={containerRef} className="absolute inset-0 w-full h-full">
          <div id="yt-player" />
        </div>
        
        {/* Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pointer-events-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white font-bold text-sm">LIVE</span>
              </div>
              <div>
                <div className="text-white font-semibold text-lg">{status.title}</div>
                <div className="text-zinc-300 text-sm">by {status.creator_name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-zinc-400 text-xs">TIME REMAINING</div>
              <div className="text-white font-mono text-xl">{formatTime(status.remaining_seconds)}</div>
            </div>
          </div>
        </div>
        
        <div className="absolute top-4 right-4 opacity-50 pointer-events-none">
          <div className="text-white font-bold text-xl tracking-wider">ZTVLIVE</div>
        </div>
      </div>
    );
  }

  // Game feed
  return (
    <div className="w-screen h-screen bg-gradient-to-br from-zinc-900 via-red-900/20 to-zinc-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl font-bold mb-4 bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent">
          ZTVLIVE
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-6 max-w-md">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 font-semibold">GAME FEED ACTIVE</span>
          </div>
          <p className="text-zinc-400 text-sm">Switch OBS to Game Feed scene.</p>
        </div>
      </div>
    </div>
  );
};

export default OBSPlayerPage;
