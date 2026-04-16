import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Hls from 'hls.js';

// ============================================
// HLS Player Component
// Handles .m3u8 streams via hls.js with auto-recovery
// ============================================
const HLSPlayer = ({ src, muted, onError, onPlaying }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const destroyHls = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    // Native HLS support (Safari, iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      destroyHls();
      video.src = src;
      video.muted = muted;
      video.play().catch(() => {});
      return destroyHls;
    }

    // hls.js for Chrome, Firefox, Edge
    if (Hls.isSupported()) {
      destroyHls();
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1,
        fragLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = muted;
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[HLS] Network error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[HLS] Media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[HLS] Fatal error, cannot recover:', data);
              destroyHls();
              if (onError) onError(data);
              break;
          }
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (onPlaying) onPlaying();
      });

      return destroyHls;
    }

    // No HLS support at all
    console.error('[HLS] hls.js is not supported in this browser');
    if (onError) onError({ type: 'unsupported' });
  }, [src, onError, onPlaying]);

  // Sync muted state changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      autoPlay
      playsInline
      muted={muted}
      style={{ background: '#000' }}
    />
  );
};

// ============================================
// YouTube Iframe Fallback Player
// ============================================
const YouTubePlayer = ({ src, muted, onError }) => {
  const embedUrl = src.includes('?')
    ? `${src}&autoplay=1&mute=${muted ? 1 : 0}&rel=0&modestbranding=1&enablejsapi=1&controls=0`
    : `${src}?autoplay=1&mute=${muted ? 1 : 0}&rel=0&modestbranding=1&enablejsapi=1&controls=0`;

  return (
    <iframe
      src={embedUrl}
      className="w-full h-full border-0"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
      title="ZTV LIVE Feed"
      onError={onError}
    />
  );
};

// ============================================
// Universal Player - Routes to HLS or YouTube
// ============================================
const UniversalPlayer = ({ content, muted, onError, onPlaying }) => {
  const videoUrl = content?.video_url || '';
  const fallbackUrl = content?.fallback_url || '';
  const streamType = content?.stream_type || '';
  const [useFallback, setUseFallback] = useState(false);

  const isHLS = streamType === 'hls' || videoUrl.includes('.m3u8');
  const activeUrl = useFallback ? fallbackUrl : videoUrl;

  const handleHLSError = useCallback(() => {
    if (fallbackUrl && !useFallback) {
      console.warn('[Player] HLS failed, switching to YouTube fallback');
      setUseFallback(true);
    } else if (onError) {
      onError();
    }
  }, [fallbackUrl, useFallback, onError]);

  // Reset fallback state when content changes
  useEffect(() => {
    setUseFallback(false);
  }, [videoUrl]);

  if (!activeUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <div className="w-12 h-12 border-4 border-zinc-800 border-t-red-600 rounded-full animate-spin mb-4" />
        <p className="text-lg font-medium tracking-wider">CONNECTING TO FEED...</p>
      </div>
    );
  }

  if (isHLS && !useFallback) {
    return <HLSPlayer src={activeUrl} muted={muted} onError={handleHLSError} onPlaying={onPlaying} />;
  }

  return <YouTubePlayer src={activeUrl} muted={muted} onError={onError} />;
};

// ============================================
// Simulated Viewer Count with realistic drift
// ============================================
const useViewerCount = (serverCount) => {
  const [count, setCount] = useState(serverCount || 143592);
  useEffect(() => {
    if (serverCount) setCount(serverCount);
  }, [serverCount]);
  useEffect(() => {
    const interval = setInterval(() => {
      setCount(prev => prev + Math.floor(Math.random() * 200 - 80));
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  return count;
};

// ============================================
// Main Watch Page
// ============================================
const WatchPage = () => {
  const [currentContent, setCurrentContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmuteOverlay, setShowUnmuteOverlay] = useState(true);
  const [errorCount, setErrorCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [upNext, setUpNext] = useState(null);
  const lastVideoUrl = useRef(null);
  const viewerCount = useViewerCount(currentContent?.viewer_count);

  const fetchNowPlaying = useCallback(async () => {
    try {
      const response = await axios.get('/api/tv/sync');
      const data = response.data;
      if (data && data.video_url !== lastVideoUrl.current) {
        lastVideoUrl.current = data.video_url;
        setCurrentContent(data);
        setLoading(false);
        setIsPlaying(false);
      }
      if (data?.up_next) {
        setUpNext(data.up_next);
      }
    } catch (error) {
      console.error('[ZTV] Error fetching sync:', error);
    }
  }, []);

  useEffect(() => {
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 15000);
    return () => clearInterval(interval);
  }, [fetchNowPlaying]);

  const handleUnmute = () => {
    setIsMuted(false);
    setShowUnmuteOverlay(false);
  };

  const handlePlayerError = useCallback(() => {
    console.warn('[ZTV] Player error, attempting skip...');
    setErrorCount(prev => prev + 1);
    // Try to skip the current feed on the server
    axios.get('/api/tv/skip-current').catch(() => {});
    setTimeout(fetchNowPlaying, 3000);
  }, [fetchNowPlaying]);

  const handlePlaying = useCallback(() => {
    setIsPlaying(true);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <div className="relative mb-8">
          <div className="w-20 h-20 border-4 border-zinc-800 border-t-red-600 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-red-600 font-black text-xl">Z</span>
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-tighter uppercase mb-2">ZTV LIVE</h1>
        <p className="text-zinc-500 text-sm tracking-widest uppercase animate-pulse">Initializing 24/7 Stream...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">

      {/* === UNMUTE OVERLAY === */}
      {showUnmuteOverlay && (
        <div
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer transition-all duration-300 hover:bg-black/70"
          onClick={handleUnmute}
        >
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-30" style={{ width: 96, height: 96 }} />
            <div className="relative p-6 rounded-full bg-red-600 shadow-2xl shadow-red-600/30">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase mb-2">Tap to Unmute & Watch Live</h2>
          <p className="text-zinc-400 text-sm tracking-wider">ZTV LIVE - 24/7 Streaming</p>
        </div>
      )}

      {/* === MAIN VIDEO FEED === */}
      <div className="absolute inset-0 z-0" key={`player-${currentContent?.video_url}-${errorCount}`}>
        <UniversalPlayer
          content={currentContent}
          muted={isMuted}
          onError={handlePlayerError}
          onPlaying={handlePlaying}
        />
      </div>

      {/* === TOP GRADIENT === */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />

      {/* === TOP BAR: LIVE badge + Category === */}
      <div className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 text-white px-3 py-1 rounded-sm text-xs font-black tracking-wider animate-pulse flex items-center gap-1.5">
            <span className="w-2 h-2 bg-white rounded-full" />
            LIVE
          </div>
          <span className="text-white/60 text-xs font-bold tracking-[0.2em] uppercase">
            {currentContent?.category || '24/7 STREAM'}
          </span>
          {currentContent?.source && (
            <span className="text-white/40 text-xs tracking-wider">
              via {currentContent.source}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-white/50 text-xs font-mono">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          {isPlaying ? 'STREAMING' : 'BUFFERING...'}
        </div>
      </div>

      {/* === BOTTOM OVERLAY === */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
        <div className="px-6 sm:px-10 pb-8 pt-32 bg-gradient-to-t from-black via-black/70 to-transparent">
          <div className="flex items-end justify-between">
            {/* Left: Title & Info */}
            <div className="flex flex-col max-w-[70%]">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-none mb-3 drop-shadow-lg">
                {currentContent?.title || 'ZTV LIVE'}
              </h1>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-black text-sm shadow-lg">
                  Z
                </div>
                <span className="text-zinc-300 text-sm font-medium">ZTV Official Feed</span>
              </div>
              {currentContent?.now_playing?.description && (
                <p className="text-zinc-400 text-sm max-w-md leading-relaxed hidden sm:block">
                  {currentContent.now_playing.description}
                </p>
              )}
              {upNext && (
                <div className="mt-3 flex items-center gap-2 text-zinc-500 text-xs">
                  <span className="text-zinc-600 font-bold uppercase tracking-wider">Up Next:</span>
                  <span className="text-zinc-400">{upNext.title}</span>
                  {upNext.starts_in_seconds && (
                    <span className="text-zinc-600">- {Math.ceil(upNext.starts_in_seconds / 60)}min</span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Viewer count */}
            <div className="hidden md:flex flex-col items-end text-right">
              <div className="text-white/30 text-xs font-bold tracking-[0.15em] uppercase mb-1">Viewers</div>
              <div className="text-3xl font-black text-white tabular-nums tracking-tight">
                {viewerCount.toLocaleString()}
              </div>
              {currentContent?.program_block?.name && (
                <div className="text-zinc-600 text-xs mt-2 tracking-wider uppercase">
                  {currentContent.program_block.name}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* === Cinematic Vignette Border === */}
      <div className="absolute inset-0 pointer-events-none z-10"
        style={{
          boxShadow: 'inset 0 0 120px 40px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
};

export default WatchPage;
