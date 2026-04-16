/**
 * ZTVLIVE HLS Live Stream Player
 * Primary: Plays HLS live stream from Castr
 * Fallback: YouTube scheduled content if HLS unavailable
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Castr HLS Stream Configuration
const LIVE_STREAM_CONFIG = {
  hlsUrl: 'https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_b8b938d0c6b811eab6745b4605902bfa/index.m3u8',
  rtmpUrl: 'rtmp://us-west.castr.io/static',
  streamKey: 'live_b8b938d0c6b811eab6745b4605902bfa',
};

export default function LiveStreamPlayer({ 
  onStreamError, 
  onStreamReady,
  className = "",
  showControls = true 
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [streamError, setStreamError] = useState(null);
  const [quality, setQuality] = useState('auto');

  // Initialize HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log('LiveStreamPlayer: Starting HLS initialization...');
    
    // Timeout to fallback if HLS doesn't load in 3 seconds (reduced for faster fallback)
    let loadTimeout = setTimeout(() => {
      console.log('LiveStreamPlayer: HLS load timeout after 3s, falling back to scheduled content');
      setIsLoading(false);
      setStreamError('Stream timeout');
      setIsLive(false);
      onStreamError?.({ type: 'timeout' });
    }, 3000);

    const initHls = () => {
      // Check if HLS is supported
      if (Hls.isSupported()) {
        console.log('LiveStreamPlayer: HLS supported, creating instance...');
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
        });

        hls.loadSource(LIVE_STREAM_CONFIG.hlsUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          clearTimeout(loadTimeout); // Clear timeout on success
          console.log('LiveStreamPlayer: HLS manifest parsed, levels:', data.levels.length);
          setIsLoading(false);
          setIsLive(true);
          setStreamError(null);
          onStreamReady?.();
          
          // Auto-play muted (browser requirement)
          video.muted = true;
          video.play().catch(e => console.log('Autoplay blocked:', e));
          setIsPlaying(true);
        });

        let retryCount = 0;
        const maxRetries = 1; // Reduced retries for faster fallback

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                retryCount++;
                if (retryCount <= maxRetries) {
                  console.log(`Network error, retry ${retryCount}/${maxRetries}...`);
                  setTimeout(() => hls.startLoad(), 1000);
                } else {
                  console.log('Max retries reached, stream offline');
                  setStreamError('Stream offline');
                  setIsLive(false);
                  setIsLoading(false);
                  onStreamError?.(data);
                  hls.destroy();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Media error, attempting recovery...');
                hls.recoverMediaError();
                break;
              default:
                console.error('Fatal HLS error, cannot recover');
                setStreamError('Stream unavailable');
                setIsLive(false);
                setIsLoading(false);
                onStreamError?.(data);
                hls.destroy();
                break;
            }
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          console.log('Quality level switched to:', data.level);
        });

        hlsRef.current = hls;
      } 
      // Native HLS support (Safari)
      else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = LIVE_STREAM_CONFIG.hlsUrl;
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          setIsLive(true);
          video.muted = true;
          video.play().catch(e => console.log('Autoplay blocked:', e));
          setIsPlaying(true);
        });
        video.addEventListener('error', () => {
          setStreamError('Stream unavailable');
          setIsLive(false);
          onStreamError?.({ type: 'native', error: video.error });
        });
      } 
      else {
        setStreamError('HLS not supported in this browser');
        onStreamError?.({ type: 'unsupported' });
      }
    };

    initHls();

    return () => {
      clearTimeout(loadTimeout); // Clear timeout on unmount
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [onStreamError, onStreamReady]);

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(e => console.log('Play error:', e));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // Mute toggle
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
    if (!video.muted) {
      video.volume = volume;
    }
  }, [volume]);

  // Volume change
  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume > 0 && videoRef.current.muted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (e) {
      console.log('Fullscreen error:', e);
    }
  }, []);

  // Refresh stream
  const refreshStream = useCallback(() => {
    setIsLoading(true);
    setStreamError(null);
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }
    
    // Reinitialize after short delay
    setTimeout(() => {
      if (videoRef.current) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hls.loadSource(LIVE_STREAM_CONFIG.hlsUrl);
        hls.attachMedia(videoRef.current);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setIsLive(true);
          videoRef.current.muted = isMuted;
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setStreamError('Stream unavailable');
            setIsLive(false);
          }
        });
        
        hlsRef.current = hls;
      }
    }, 500);
  }, [isMuted]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black group ${className}`}
      data-testid="live-stream-player"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        muted
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white mb-4">Connecting to live stream...</p>
            {onStreamError && (
              <Button 
                onClick={() => onStreamError({ type: 'user_cancel' })} 
                variant="outline"
                className="border-zinc-600 text-white hover:bg-zinc-800"
              >
                Cancel - Back to Videos
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {streamError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center">
            <Radio className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-white text-lg mb-2">Stream Offline</p>
            <p className="text-zinc-400 text-sm mb-4">{streamError}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={refreshStream} className="bg-red-600 hover:bg-red-500">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              {onStreamError && (
                <Button 
                  onClick={() => onStreamError({ type: 'user_back' })} 
                  variant="outline"
                  className="border-zinc-600 text-white hover:bg-zinc-800"
                >
                  Back to Videos
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Badge */}
      {isLive && !streamError && (
        <div className="absolute top-4 left-4 z-10">
          <Badge className="bg-red-600 text-white animate-pulse">
            <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
            LIVE
          </Badge>
        </div>
      )}

      {/* Controls Overlay */}
      {showControls && !streamError && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={togglePlay}
                className="text-white hover:bg-white/20"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer"
                />
              </div>

              {/* Refresh */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={refreshStream}
                className="text-white hover:bg-white/20"
                title="Refresh stream"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {/* Live indicator */}
              {isLive && (
                <span className="text-red-500 text-sm font-medium flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}

              {/* Fullscreen */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export config for use in other components
export { LIVE_STREAM_CONFIG };
