import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function HLSPlayer({ 
  src, 
  poster, 
  title,
  autoPlay = true,
  onError,
  onStreamConnected,
  onStreamDisconnected,
  className = ""
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState([75]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const controlsTimeoutRef = useRef(null);

  const handleStreamSuccess = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    setIsLive(true);
    if (onStreamConnected) onStreamConnected();
  }, [onStreamConnected]);

  const handleStreamError = useCallback((errorData) => {
    setHasError(true);
    setIsLoading(false);
    setIsLive(false);
    if (onStreamDisconnected) onStreamDisconnected();
    if (onError) onError(errorData);
  }, [onStreamDisconnected, onError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setIsLoading(true);
    setHasError(false);

    const loadVideo = () => {
      if (Hls.isSupported()) {
        // Destroy existing instance
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          capLevelToPlayerSize: true,
          startLevel: -1,
        });
        
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log("HLS: Stream manifest parsed, levels:", data.levels.length);
          handleStreamSuccess();
          if (autoPlay) {
            video.play().catch(console.error);
          }
        });
        
        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          console.log("HLS: Level loaded, live:", data.details.live);
          if (data.details.live) {
            setIsLive(true);
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("HLS error:", data.type, data.details, data.fatal);
          if (data.fatal) {
            // Try codec fallback
            if (data.details === 'manifestIncompatibleCodecsError') {
              console.log("HLS: Codec incompatible, trying native playback");
              hls.destroy();
              video.src = src;
              video.load();
              video.play().then(() => {
                handleStreamSuccess();
              }).catch((e) => {
                console.error("Native playback failed:", e);
                handleStreamError(data);
              });
              return;
            }
            
            handleStreamError(data);
            
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log("HLS: Network error, retrying in 5s");
                setTimeout(() => {
                  if (hlsRef.current) {
                    hlsRef.current.startLoad();
                  }
                }, 5000);
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log("HLS: Media error, attempting recovery");
                hls.recoverMediaError();
                break;
              default:
                break;
            }
          }
        });
        
        // Detect stream end
        hls.on(Hls.Events.BUFFER_EOS, () => {
          console.log("HLS: Buffer end of stream");
          if (onStreamDisconnected) onStreamDisconnected();
        });
        
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        video.src = src;
        video.addEventListener("loadedmetadata", () => {
          handleStreamSuccess();
          if (autoPlay) {
            video.play().catch(console.error);
          }
        });
        video.addEventListener("error", () => {
          handleStreamError({ type: "native", details: "playback_error" });
        });
      } else {
        // Last resort: direct source
        video.src = src;
        video.load();
      }
    };

    loadVideo();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay, handleStreamSuccess, handleStreamError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
    video.volume = volume[0] / 100;
  }, [isMuted, volume]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black rounded-sm overflow-hidden group ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        poster={poster}
        playsInline
        data-testid="hls-video"
      />
      
      {/* LIVE Badge */}
      {isLive && !hasError && !isLoading && (
        <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
          <div className="bg-red-600 text-white px-3 py-1 rounded flex items-center gap-2 animate-pulse">
            <Radio className="w-4 h-4" />
            <span className="font-bold text-sm">LIVE</span>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-zinc-400">Connecting to stream...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {hasError && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="font-heading text-xl mb-2">STREAM OFFLINE</h3>
            <p className="text-zinc-400 text-sm mb-4">The live stream is currently unavailable</p>
            <Button 
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
                if (hlsRef.current) {
                  hlsRef.current.startLoad();
                }
              }}
              className="bg-violet-600 hover:bg-violet-500"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div 
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Center Play Button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Button 
            size="lg"
            className={`w-16 h-16 rounded-full bg-violet-600/80 hover:bg-violet-600 backdrop-blur-sm transition-transform ${
              showControls ? 'scale-100' : 'scale-0'
            }`}
            onClick={togglePlay}
            data-testid="play-pause-center"
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </Button>
        </div>

        {/* Bottom Controls */}
        <div className={`absolute bottom-0 left-0 right-0 p-4 transition-transform ${
          showControls ? 'translate-y-0' : 'translate-y-full'
        }`}>
          {title && (
            <h3 className="font-heading text-xl tracking-tight mb-3 line-clamp-1">{title}</h3>
          )}
          
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={togglePlay}
              data-testid="play-pause-btn"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={toggleMute}
                data-testid="mute-btn"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              <div className="w-20 hidden sm:block">
                <Slider 
                  value={volume}
                  onValueChange={setVolume}
                  max={100}
                  step={1}
                  className="cursor-pointer"
                  data-testid="volume-slider"
                />
              </div>
            </div>

            <div className="flex-1" />

            <Button 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={toggleFullscreen}
              data-testid="fullscreen-btn"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Scanline Effect */}
      <div className="scanline-overlay pointer-events-none" />
    </div>
  );
}
