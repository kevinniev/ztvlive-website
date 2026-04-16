import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

// Extract YouTube video ID from various URL formats
export const getYouTubeVideoId = (url) => {
  if (!url) return null;
  // Handle embed URLs
  const embedMatch = url.match(/youtube\.com\/embed\/([^?&]+)/);
  if (embedMatch) return embedMatch[1];
  // Handle watch URLs
  const watchMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  // Handle short URLs
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return shortMatch[1];
  return null;
};

/**
 * ImmersiveVideoPlayer - Clean fullscreen video player
 * Features:
 * - Double-tap to toggle fullscreen
 * - NO overlays/controls in fullscreen mode (immersive viewing)
 * - Works on Android, iOS, and desktop
 * - Auto-advances to next content on video end/error
 */
export default function ImmersiveVideoPlayer({
  videoUrl,
  title,
  onVideoEnd,
  onVideoError,
  onVideoReady,
  autoPlay = true,
  startTime = 0,
  className = "",
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [lastTapTime, setLastTapTime] = useState(0);
  
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);
  const videoIdRef = useRef(null);

  const videoId = getYouTubeVideoId(videoUrl);

  // Initialize YouTube player
  useEffect(() => {
    if (!videoId) return;
    if (videoId === videoIdRef.current && playerRef.current) return;
    
    videoIdRef.current = videoId;

    // Load YouTube API if not loaded
    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      
      window.onYouTubeIframeAPIReady = () => initPlayer();
      return;
    }
    
    initPlayer();
    
    function initPlayer() {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }

      const container = document.getElementById('immersive-player');
      if (!container) {
        setTimeout(initPlayer, 200);
        return;
      }

      playerRef.current = new window.YT.Player('immersive-player', {
        videoId: videoId,
        playerVars: {
          autoplay: autoPlay ? 1 : 0,
          mute: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          showinfo: 0,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          start: Math.floor(startTime),
          enablejsapi: 1,
          origin: window.location.origin,
          cc_load_policy: 0,
        },
        events: {
          onReady: (event) => {
            setIsPlaying(true);
            event.target.playVideo();
            onVideoReady?.();
          },
          onStateChange: (event) => {
            if (event.data === 0) {
              onVideoEnd?.();
            } else if (event.data === 1) {
              setIsPlaying(true);
            } else if (event.data === 2) {
              setIsPlaying(false);
            }
          },
          onError: (event) => {
            console.error('YouTube error:', event.data);
            onVideoError?.(event.data);
          }
        }
      });
    }
  }, [videoId, autoPlay, startTime, onVideoEnd, onVideoError, onVideoReady]);

  // Double-tap detection for fullscreen
  const handleTap = useCallback((e) => {
    const now = Date.now();
    const timeDiff = now - lastTapTime;
    
    if (timeDiff < 300 && timeDiff > 0) {
      // Double tap detected - toggle fullscreen
      e.preventDefault();
      toggleFullscreen();
    } else {
      // Single tap - toggle controls visibility (only when not fullscreen)
      if (!isFullscreen) {
        setShowControls(true);
        clearTimeout(hideControlsTimeoutRef.current);
        hideControlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    }
    
    setLastTapTime(now);
  }, [lastTapTime, isFullscreen]);

  // Fullscreen toggle - works on all platforms
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );

    if (isCurrentlyFullscreen) {
      // Exit fullscreen
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
        setIsFullscreen(false);
        setShowControls(true);
      } catch (e) {
        console.log('Exit fullscreen error:', e);
      }
    } else {
      // Enter fullscreen
      try {
        if (container.requestFullscreen) await container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
        else if (container.webkitEnterFullscreen) container.webkitEnterFullscreen();
        else if (container.mozRequestFullScreen) container.mozRequestFullScreen();
        else if (container.msRequestFullscreen) container.msRequestFullscreen();
        setIsFullscreen(true);
        setShowControls(false); // Hide ALL controls in fullscreen
        
        // Lock orientation on mobile
        if (screen.orientation && screen.orientation.lock) {
          try {
            await screen.orientation.lock('landscape');
          } catch (e) {}
        }
      } catch (e) {
        console.log('Fullscreen request error:', e);
        // iOS fallback - use video element's native fullscreen
        if (playerRef.current?.getIframe) {
          try {
            const iframe = playerRef.current.getIframe();
            if (iframe?.webkitEnterFullscreen) {
              iframe.webkitEnterFullscreen();
              setIsFullscreen(true);
            }
          } catch (e2) {
            toast.error("Fullscreen not supported");
          }
        }
      }
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement
      );
      setIsFullscreen(isFS);
      setShowControls(!isFS); // Hide controls when fullscreen
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch (e) {}
  }, [isPlaying]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        playerRef.current.setVolume(100);
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch (e) {}
  }, [isMuted]);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black ${className} ${isFullscreen ? 'fixed inset-0 z-[9999]' : ''}`}
      onClick={handleTap}
      onDoubleClick={(e) => { e.preventDefault(); toggleFullscreen(); }}
      style={{ cursor: isFullscreen ? 'none' : 'pointer' }}
    >
      {/* YouTube Player Container */}
      <div
        id="immersive-player"
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Transparent overlay for capturing taps */}
      <div className="absolute inset-0 z-10" />

      {/* Controls - ONLY shown when NOT fullscreen */}
      {showControls && !isFullscreen && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 to-transparent p-4 transition-opacity duration-300">
          {/* Title */}
          {title && (
            <p className="text-white text-sm font-medium mb-2 truncate">{title}</p>
          )}
          
          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              
              {/* Mute/Unmute */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className="w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors"
              >
                {isMuted ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Fullscreen button */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              className="w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          </div>
          
          {/* Hint text */}
          <p className="text-white/50 text-xs mt-2 text-center">Double-tap for fullscreen</p>
        </div>
      )}

      {/* Fullscreen exit button - visible in fullscreen */}
      {isFullscreen && (
        <div className="absolute bottom-4 right-4 z-30">
          <button
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            className="w-12 h-12 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Hide YouTube branding */}
      <style>{`
        .ytp-chrome-top,
        .ytp-chrome-bottom,
        .ytp-gradient-top,
        .ytp-gradient-bottom,
        .ytp-show-cards-title,
        .ytp-pause-overlay,
        .ytp-watermark,
        .ytp-ce-element,
        .ytp-endscreen-content,
        .ytp-suggestion-set,
        .ytp-videowall-still,
        .annotation,
        .iv-branding,
        .ytp-cards-teaser,
        .ytp-ce-covering-overlay {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `}</style>
    </div>
  );
}
