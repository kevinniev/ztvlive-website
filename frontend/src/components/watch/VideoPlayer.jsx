/**
 * VideoPlayer Component for ZTVLIVE Watch Page
 * 
 * Handles YouTube embed and MP4 video playback with:
 * - YouTube IFrame API integration
 * - OBS/Broadcast mode support
 * - Promo video overlay
 * - Sync with TV scheduler
 */

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Volume2, VolumeX, Play, Pause, Radio } from "lucide-react";

// Extract YouTube video ID from embed URL
export const getYouTubeVideoId = (url) => {
  if (!url) return null;
  
  // Handle embed URLs: youtube.com/embed/VIDEO_ID
  let match = url.match(/youtube\.com\/embed\/([^?&/]+)/);
  if (match) return match[1];
  
  // Handle standard watch URLs: youtube.com/watch?v=VIDEO_ID
  match = url.match(/youtube\.com\/watch\?v=([^?&/]+)/);
  if (match) return match[1];
  
  // Handle short URLs: youtu.be/VIDEO_ID
  match = url.match(/youtu\.be\/([^?&/]+)/);
  if (match) return match[1];
  
  return null;
};

const VideoPlayer = memo(({
  videoUrl,
  videoId,
  startTime = 0,
  isMuted = false,
  volume = 0.15,
  isPlaying = true,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onReady,
  obsMode = false,
  broadcastMode = false,
  cleanMode = false,
  showPromo = false,
  promoVideoUrl = null,
  onPromoEnded,
  isTransitioning = false,
  transitionOpacity = 1,
}) => {
  const playerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const promoVideoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playerError, setPlayerError] = useState(null);
  const lastVideoIdRef = useRef(null);

  // Initialize YouTube player
  useEffect(() => {
    if (!videoId || ytPlayerRef.current) return;

    // Load YouTube IFrame API if not loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        createPlayer();
      };
    } else {
      createPlayer();
    }

    function createPlayer() {
      if (ytPlayerRef.current) return;
      
      ytPlayerRef.current = new window.YT.Player(playerRef.current, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          showinfo: 0,
          start: Math.floor(startTime),
        },
        events: {
          onReady: (event) => {
            setIsLoading(false);
            event.target.setVolume(volume * 100);
            if (isMuted) event.target.mute();
            onReady?.(event);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              onPlay?.();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              onPause?.();
            } else if (event.data === window.YT.PlayerState.ENDED) {
              onEnded?.();
            }
          },
          onError: (event) => {
            console.error('[VideoPlayer] YouTube error:', event.data);
            setPlayerError(event.data);
          },
        },
      });
    }

    return () => {
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
    };
  }, [videoId]);

  // Handle video changes
  useEffect(() => {
    if (!ytPlayerRef.current || !videoId) return;
    
    if (lastVideoIdRef.current !== videoId) {
      lastVideoIdRef.current = videoId;
      ytPlayerRef.current.loadVideoById({
        videoId: videoId,
        startSeconds: startTime,
      });
    }
  }, [videoId, startTime]);

  // Handle volume changes
  useEffect(() => {
    if (!ytPlayerRef.current) return;
    ytPlayerRef.current.setVolume(volume * 100);
  }, [volume]);

  // Handle mute changes
  useEffect(() => {
    if (!ytPlayerRef.current) return;
    if (isMuted) {
      ytPlayerRef.current.mute();
    } else {
      ytPlayerRef.current.unMute();
    }
  }, [isMuted]);

  // Handle play/pause
  useEffect(() => {
    if (!ytPlayerRef.current) return;
    if (isPlaying) {
      ytPlayerRef.current.playVideo();
    } else {
      ytPlayerRef.current.pauseVideo();
    }
  }, [isPlaying]);

  // Time update interval
  useEffect(() => {
    if (!ytPlayerRef.current || !onTimeUpdate) return;
    
    const interval = setInterval(() => {
      if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        const time = ytPlayerRef.current.getCurrentTime();
        const duration = ytPlayerRef.current.getDuration();
        onTimeUpdate?.(time, duration);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [onTimeUpdate]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* YouTube Player Container */}
      <motion.div
        className="absolute inset-0"
        style={{ opacity: transitionOpacity }}
        animate={{ opacity: isTransitioning ? 0.7 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <div
          ref={playerRef}
          className="absolute inset-0"
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </motion.div>

      {/* OBS/Broadcast Mode Overlays - Hide YouTube UI */}
      {(obsMode || broadcastMode || cleanMode) && (
        <>
          {/* TOP OVERLAY - Hides YouTube's progress bar and branding */}
          <div 
            className="absolute top-0 left-0 right-0 bg-black z-20"
            style={{ height: '12%' }}
          />
          
          {/* BOTTOM OVERLAY - Hides YouTube's control bar area */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-black z-20"
            style={{ height: '15%' }}
          />
          
          {/* Side overlays for broadcast mode */}
          {broadcastMode && (
            <>
              {/* Left edge cover */}
              <div 
                className="absolute top-0 left-0 bottom-0 bg-black z-20"
                style={{ width: '8%' }}
              />
              
              {/* Right edge cover */}
              <div 
                className="absolute top-0 right-0 bottom-0 bg-black z-20"
                style={{ width: '8%' }}
              />
              
              {/* Bottom-left corner cover */}
              <div 
                className="absolute bottom-0 left-0 bg-black z-25"
                style={{ width: '15%', height: '18%' }}
              />
              
              {/* Bottom-right corner cover */}
              <div 
                className="absolute bottom-0 right-0 bg-black z-25"
                style={{ width: '20%', height: '18%' }}
              />
            </>
          )}
          
          {/* OBS Mode indicator - small and unobtrusive */}
          {obsMode && !broadcastMode && (
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-black/70 px-2 py-1 rounded text-xs">
              <Radio className="w-3 h-3 text-red-500 animate-pulse" />
              <span className="text-zinc-400">OBS</span>
            </div>
          )}
        </>
      )}

      {/* MP4 Promo Video Overlay */}
      <AnimatePresence>
        {showPromo && promoVideoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-black"
          >
            <video
              ref={promoVideoRef}
              src={promoVideoUrl}
              autoPlay
              muted={isMuted}
              onEnded={onPromoEnded}
              className="w-full h-full object-cover"
            />
            
            {/* Promo banner indicator */}
            <div className="absolute top-4 left-4 bg-gradient-to-r from-red-600 to-purple-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              PROMO
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/80"
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              <span className="text-zinc-400 text-sm">Loading stream...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      {playerError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/90">
          <div className="text-center max-w-md p-6">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-white text-lg font-bold mb-2">Stream Unavailable</h3>
            <p className="text-zinc-400 text-sm">
              {playerError === 150 
                ? "This content is not available for embedding."
                : "Unable to load the stream. Please try again."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
