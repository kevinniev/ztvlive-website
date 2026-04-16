import { useState, useEffect, useRef, useCallback } from "react";
import { 
  Play, Pause, Volume2, VolumeX, Volume1, Rewind, FastForward, 
  Maximize, Minimize, SkipForward, Radio, AlertTriangle, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * CleanYouTubePlayer - A reusable YouTube player component with custom controls
 * that completely hides all YouTube branding, overlays, and suggestions.
 * 
 * Features:
 * - No YouTube logo, controls, or overlays
 * - Custom play/pause, volume, and seek controls
 * - Optional DVR-style rewind/fast-forward
 * - Auto-unmute support via prop
 * - Smooth transitions between videos
 * 
 * @param {Object} props
 * @param {string} props.videoId - YouTube video ID
 * @param {boolean} props.autoUnmute - Start unmuted (default: false)
 * @param {boolean} props.showDVRControls - Show rewind/forward buttons (default: true)
 * @param {boolean} props.showProgress - Show progress bar (default: true)
 * @param {number} props.startTime - Start time in seconds (default: 0)
 * @param {function} props.onEnded - Callback when video ends
 * @param {function} props.onReady - Callback when player is ready
 * @param {function} props.onTimeUpdate - Callback with current time updates
 * @param {string} props.className - Additional CSS classes for container
 * @param {boolean} props.showLiveBadge - Show LIVE badge (default: false)
 * @param {string} props.title - Video title to display
 */
export default function CleanYouTubePlayer({
  videoId,
  autoUnmute = false,
  showDVRControls = true,
  showProgress = true,
  startTime = 0,
  onEnded,
  onReady,
  onTimeUpdate,
  className = "",
  showLiveBadge = false,
  title = ""
}) {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(!autoUnmute);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  // Refs
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const currentVideoIdRef = useRef(null);
  const volumeRef = useRef(0.7);
  const isMutedRef = useRef(!autoUnmute);
  const timeUpdateInterval = useRef(null);
  
  // YouTube API state
  const [ytApiReady, setYtApiReady] = useState(false);

  // Keep refs in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
    volumeRef.current = volume;
  }, [isMuted, volume]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtApiReady(true);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      // Wait for it to load
      const checkReady = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setYtApiReady(true);
          clearInterval(checkReady);
        }
      }, 100);
      return () => clearInterval(checkReady);
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(tag, firstScript);

    window.onYouTubeIframeAPIReady = () => {
      setYtApiReady(true);
    };
  }, []);

  // Initialize/update YouTube player
  useEffect(() => {
    if (!videoId || !ytApiReady) return;
    
    // If same video, don't reinitialize
    if (videoId === currentVideoIdRef.current && playerRef.current) {
      return;
    }

    currentVideoIdRef.current = videoId;
    
    // Reset unavailable state for new video
    setVideoUnavailable(false);
    setErrorMessage("");

    // Destroy existing player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
        playerRef.current = null;
      } catch (e) {}
    }

    const initPlayer = () => {
      const container = document.getElementById(`yt-player-${videoId}`);
      if (!container) {
        setTimeout(initPlayer, 200);
        return;
      }
      
      try {
        playerRef.current = new window.YT.Player(`yt-player-${videoId}`, {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            mute: 1,               // Always start muted for autoplay compatibility
            controls: 0,           // No YouTube controls
            rel: 0,                // No related videos at end
            modestbranding: 1,     // Minimal YouTube branding
            showinfo: 0,           // No video info overlay
            iv_load_policy: 3,     // No annotations
            disablekb: 1,          // No keyboard shortcuts
            fs: 0,                 // No fullscreen button
            playsinline: 1,        // Play inline on mobile
            start: Math.floor(startTime),
            enablejsapi: 1,
            origin: window.location.origin,
            cc_load_policy: 0,     // No closed captions
            hl: 'en',
            widget_referrer: window.location.origin
          },
          events: {
            onReady: (event) => {
              setIsReady(true);
              setDuration(event.target.getDuration() || 0);
              
              // Start muted, then unmute if autoUnmute is requested
              event.target.mute();
              setIsMuted(true);
              isMutedRef.current = true;
              
              // Start playback
              event.target.playVideo();
              setIsPlaying(true);
              
              // If autoUnmute is requested, unmute after a brief delay
              if (autoUnmute) {
                setTimeout(() => {
                  if (playerRef.current) {
                    playerRef.current.unMute();
                    playerRef.current.setVolume(volumeRef.current * 100);
                    setIsMuted(false);
                    isMutedRef.current = false;
                  }
                }, 500);
              }
              
              // Start time update interval
              timeUpdateInterval.current = setInterval(() => {
                if (playerRef.current && playerRef.current.getCurrentTime) {
                  const time = playerRef.current.getCurrentTime();
                  setCurrentTime(time);
                  if (onTimeUpdate) onTimeUpdate(time);
                }
              }, 1000);
              
              if (onReady) onReady(event.target);
            },
            onStateChange: (event) => {
              if (event.data === 0) {
                // Video ended
                if (onEnded) onEnded();
              } else if (event.data === 1) {
                setIsPlaying(true);
              } else if (event.data === 2) {
                setIsPlaying(false);
              }
            },
            onError: (event) => {
              console.error('YouTube error:', event.data);
              // Error codes: 2=invalid param, 5=HTML5 error, 100=not found, 101/150=blocked embed
              const errorMessages = {
                2: "Invalid video parameters",
                5: "HTML5 player error",
                100: "Video not found or removed",
                101: "Video cannot be embedded",
                150: "Video restricted by owner"
              };
              
              if ([100, 101, 150].includes(event.data)) {
                setVideoUnavailable(true);
                setErrorMessage(errorMessages[event.data] || "Video unavailable");
                // Auto-advance to next video after 3 seconds
                if (onEnded) {
                  setTimeout(() => {
                    console.log('Video unavailable, advancing to next');
                    onEnded();
                  }, 3000);
                }
              }
            }
          }
        });
      } catch (e) {
        console.error('Error creating player:', e);
      }
    };
    
    // Initialize player immediately since API is ready
    setTimeout(initPlayer, 150);
    
    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
    };
  }, [videoId, startTime, autoUnmute, ytApiReady, onEnded, onReady, onTimeUpdate]);

  // Format time display
  const formatTime = useCallback((seconds) => {
    if (!seconds || seconds < 0) return "0:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Play/Pause toggle
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

  // Volume control
  const handleVolumeChange = useCallback((newVolume) => {
    setVolume(newVolume);
    volumeRef.current = newVolume;
    
    if (playerRef.current) {
      try {
        if (newVolume > 0) {
          setIsMuted(false);
          isMutedRef.current = false;
          playerRef.current.unMute();
          playerRef.current.setVolume(newVolume * 100);
        } else {
          setIsMuted(true);
          isMutedRef.current = true;
          playerRef.current.mute();
        }
      } catch (e) {}
    }
  }, []);

  // Toggle mute - enhanced for user interaction
  const toggleMute = useCallback(() => {
    if (!playerRef.current) {
      console.log('Player not ready for unmute');
      return;
    }
    
    try {
      if (isMuted) {
        // Unmute and restore volume
        playerRef.current.unMute();
        playerRef.current.setVolume(Math.max(volumeRef.current * 100, 50)); // Ensure audible volume
        setIsMuted(false);
        isMutedRef.current = false;
        console.log('Unmuted successfully');
      } else {
        // Mute
        playerRef.current.mute();
        setIsMuted(true);
        isMutedRef.current = true;
        console.log('Muted successfully');
      }
    } catch (e) {
      console.error('Error toggling mute:', e);
    }
  }, [isMuted]);

  // Seek functions
  const seekTo = useCallback((time) => {
    if (playerRef.current) {
      try {
        playerRef.current.seekTo(time, true);
        setCurrentTime(time);
      } catch (e) {}
    }
  }, []);

  const rewind = useCallback(() => {
    const newTime = Math.max(0, currentTime - 10);
    seekTo(newTime);
  }, [currentTime, seekTo]);

  const fastForward = useCallback(() => {
    const newTime = Math.min(duration, currentTime + 10);
    seekTo(newTime);
  }, [currentTime, duration, seekTo]);

  // True fullscreen using browser Fullscreen API
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      // Enter fullscreen
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.log('Fullscreen error:', err);
        // Fallback: open in new tab
        if (videoId) {
          window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
        }
      });
    } else {
      // Exit fullscreen
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  }, [videoId]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Get volume icon
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  // Progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      className={`relative aspect-video bg-black group ${className}`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Loading indicator while YouTube loads */}
      {!isReady && !videoUnavailable && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-5">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Loading video...</p>
          </div>
        </div>
      )}
      
      {/* YouTube Player - Hidden controls */}
      <div 
        id={`yt-player-${videoId}`}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Clickable overlay for play/pause */}
      <div 
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={togglePlay}
      />

      {/* Live Badge */}
      {showLiveBadge && (
        <div className="absolute top-4 left-4 z-20 pointer-events-none">
          <Badge className="bg-red-600 text-white animate-pulse">
            <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
            LIVE
          </Badge>
        </div>
      )}

      {/* Video Unavailable Overlay */}
      {videoUnavailable && (
        <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center text-white">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
          <h3 className="text-xl font-bold mb-2">Video Unavailable</h3>
          <p className="text-zinc-400 text-sm mb-4">{errorMessage}</p>
          <div className="flex items-center gap-2 text-zinc-500">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading next video...</span>
          </div>
        </div>
      )}

      {/* Custom Controls Overlay */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Progress Bar */}
        {showProgress && duration > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono w-14 text-right text-white">{formatTime(currentTime)}</span>
            <div 
              className="flex-1 h-1.5 bg-zinc-700/80 rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                seekTo(percent * duration);
              }}
            >
              <div
                className="h-full bg-red-600 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-mono w-14 text-white">{formatTime(duration)}</span>
          </div>
        )}
        
        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              data-testid="clean-player-play-btn"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            
            {/* Rewind/Forward */}
            {showDVRControls && (
              <div className="flex items-center gap-1 bg-zinc-800/80 rounded-full px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); rewind(); }}
                  data-testid="clean-player-rewind-btn"
                >
                  <Rewind className="w-4 h-4" />
                </Button>
                <span className="text-xs text-zinc-400 px-1">10s</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); fastForward(); }}
                  data-testid="clean-player-forward-btn"
                >
                  <FastForward className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            {/* Volume Control - YouTube/Facebook Style */}
            <div 
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => !isDraggingVolume && setTimeout(() => setShowVolumeSlider(false), 1000)}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                data-testid="clean-player-mute-btn"
              >
                <VolumeIcon className="w-5 h-5" />
              </Button>
              <div 
                className={`flex items-center overflow-hidden transition-all duration-300 ${showVolumeSlider ? 'w-20 ml-1 opacity-100' : 'w-0 opacity-0'}`}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => { 
                    e.stopPropagation(); 
                    const val = parseFloat(e.target.value);
                    handleVolumeChange(val);
                    if (val > 0 && isMuted) toggleMute();
                  }}
                  onMouseDown={() => setIsDraggingVolume(true)}
                  onMouseUp={() => { setIsDraggingVolume(false); setTimeout(() => setShowVolumeSlider(false), 1500); }}
                  onTouchStart={() => setIsDraggingVolume(true)}
                  onTouchEnd={() => { setIsDraggingVolume(false); setTimeout(() => setShowVolumeSlider(false), 1500); }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : volume) * 100}%)`
                  }}
                  data-testid="clean-player-volume-slider"
                />
              </div>
            </div>
          </div>
          
          {/* Right side - Fullscreen */}
          <div className="flex items-center gap-2">
            {title && (
              <span className="text-sm text-zinc-300 mr-2 hidden sm:inline truncate max-w-[200px]">
                {title}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white hover:bg-white/20 rounded-full"
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              data-testid="clean-player-fullscreen-btn"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Always visible mini mute button when not hovering */}
      <div className={`absolute bottom-4 right-4 z-20 transition-opacity ${showControls ? 'opacity-0' : 'opacity-100'}`}>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 bg-black/60 text-white hover:bg-black/80 rounded-full"
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
        >
          <VolumeIcon className="w-5 h-5" />
        </Button>
      </div>

      {/* CSS to hide YouTube branding */}
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
        .annotation,
        .iv-branding,
        .ytp-title,
        .ytp-title-channel,
        .ytp-menuitem,
        .ytp-button[aria-label="Watch later"],
        .ytp-button[aria-label="Share"] {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `}</style>
      
      {/* Top overlay to cover YouTube title bar - solid black fade */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-black z-15 pointer-events-none" style={{background: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)'}} />
      
      {/* Bottom overlay to cover YouTube logo - solid black fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-black z-15 pointer-events-none" style={{background: 'linear-gradient(to top, black 0%, black 60%, transparent 100%)'}} />
      
      {/* Right side overlay to cover Share button */}
      <div className="absolute top-0 right-0 w-20 h-full z-15 pointer-events-none" style={{background: 'linear-gradient(to left, black 0%, black 40%, transparent 100%)'}} />
    </div>
  );
}

// Helper function to extract YouTube video ID from various URL formats
export function getYouTubeVideoId(url) {
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
  
  // Return as-is if already just an ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  
  return null;
}
