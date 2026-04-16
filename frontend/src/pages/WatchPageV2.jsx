import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Hls from 'hls.js';

// ============================================
// Robust Video Player (HLS & MP4)
// ============================================
const VideoPlayer = ({ src, type, muted, onPlaying, onError }) => {
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

    if (type === 'hls' || src.includes('.m3u8')) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.play().catch(() => {});
      } else if (Hls.isSupported()) {
        destroyHls();
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls.on(Hls.Events.ERROR, (e, data) => data.fatal && onError());
      }
      return destroyHls;
    } else {
      // MP4 / Direct
      video.src = src;
      video.play().catch(() => {});
    }
  }, [src, type, onError]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover bg-black"
      autoPlay
      playsInline
      loop={type === 'mp4'}
      onPlaying={onPlaying}
      onError={onError}
    />
  );
};

// ============================================
// YouTube Iframe Player
// ============================================
const YouTubePlayer = ({ src, muted, onError }) => {
  const embedUrl = `${src}${src.includes('?') ? '&' : '?'}autoplay=1&mute=${muted ? 1 : 0}&rel=0&controls=0&modestbranding=1`;
  return (
    <iframe
      src={embedUrl}
      className="w-full h-full border-0 bg-black"
      allow="autoplay; fullscreen"
      title="ZTV LIVE"
      onError={onError}
    />
  );
};

// ============================================
// Main Watch Page
// ============================================
const WatchPage = () => {
  const [content, setContent] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [promoMode, setPromoMode] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  
  const PROMOS = [
    { url: "/api/static/promo/ztvlive_70_revolution_FINAL.mp4", type: "mp4", title: "ZTVLIVE - THE REVOLUTION" },
    { url: "/api/static/promo/01_revolution_intro.mp4", type: "mp4", title: "WELCOME TO ZTVLIVE" },
    { url: "/api/static/promo/02_sports_news_tech.mp4", type: "mp4", title: "SPORTS & NEWS ON ZTV" }
  ];

  const fetchSync = useCallback(async () => {
    if (promoMode) return;
    try {
      const { data } = await axios.get('/api/tv/sync');
      if (data?.video_url) setContent(data);
    } catch (e) {
      console.error("Sync failed", e);
      setPromoMode(true);
    }
  }, [promoMode]);

  useEffect(() => {
    fetchSync();
    const inv = setInterval(fetchSync, 15000);
    return () => clearInterval(inv);
  }, [fetchSync]);

  const handleError = () => {
    console.warn("Content failed, switching to promo loop");
    setPromoMode(true);
    setErrorCount(c => c + 1);
  };

  const activeContent = promoMode ? PROMOS[errorCount % PROMOS.length] : content;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Unmute Overlay */}
      {showOverlay && (
        <div 
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm cursor-pointer"
          onClick={() => { setIsMuted(false); setShowOverlay(false); }}
        >
          <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center animate-pulse mb-6 shadow-2xl">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tighter mb-2">ZTV LIVE</h1>
          <p className="text-zinc-400 uppercase tracking-widest text-sm">Tap to Unmute & Watch</p>
        </div>
      )}

      {/* Player Container */}
      <div className="absolute inset-0 z-0">
        {activeContent && (
          (activeContent.stream_type === 'youtube' || activeContent.video_url?.includes('youtube.com')) ? (
            <YouTubePlayer src={activeContent.video_url} muted={isMuted} onError={handleError} />
          ) : (
            <VideoPlayer 
              src={activeContent.video_url || activeContent.url} 
              type={activeContent.stream_type || activeContent.type} 
              muted={isMuted} 
              onError={handleError} 
            />
          )
        )}
      </div>

      {/* UI Elements */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-3 pointer-events-none">
        <div className="bg-red-600 px-3 py-1 text-xs font-black rounded-sm animate-pulse">LIVE</div>
        <div className="text-white/80 text-xs font-bold tracking-widest uppercase">
          {activeContent?.category || 'PROMO LOOP'}
        </div>
      </div>

      <div className="absolute bottom-10 left-10 z-10 pointer-events-none">
        <h2 className="text-4xl sm:text-6xl font-black tracking-tighter leading-none mb-2 drop-shadow-2xl">
          {activeContent?.title || 'ZTV LIVE'}
        </h2>
        <p className="text-red-600 font-bold tracking-widest text-sm">ZTV OFFICIAL BROADCAST</p>
      </div>
      
      {/* Promo Mode Indicator */}
      {promoMode && (
        <div className="absolute top-6 right-6 z-10 bg-zinc-900/80 px-3 py-1 rounded-full text-[10px] text-zinc-400 font-bold border border-zinc-800">
          EMERGENCY PROMO LOOP ACTIVE
        </div>
      )}
    </div>
  );
};

export default WatchPage;
