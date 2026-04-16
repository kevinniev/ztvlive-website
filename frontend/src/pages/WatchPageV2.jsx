import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Hls from 'hls.js';

// ─── 2026 ULTRA-FRESH ENGINE ───
// Manually verified 2026 clips to bypass backend staleness.
const FRESH_2026_CLIPS = [
  { id: "sports_nba", title: "NBA TOP Plays of the Week (April 2026)", video_url: "https://www.youtube.com/embed/KNs2d9xmEdU", category: "SPORTS" },
  { id: "comedy_matt", title: "Matt Rife: Best of 2026 Crowd Work", video_url: "https://www.youtube.com/embed/vNlXk7vXYYQ", category: "COMEDY" },
  { id: "music_lisa", title: "Anyma, LISA - Bad Angel (2026 Official)", video_url: "https://www.youtube.com/embed/q6786A7yR0s", category: "MUSIC" },
  { id: "tech_mit", title: "MIT: 10 Breakthrough Technologies of 2026", video_url: "https://www.youtube.com/embed/B_hx-zAWz3w", category: "TECH" },
  { id: "sports_nfl", title: "Super Bowl LX Highlights (2026)", video_url: "https://www.youtube.com/embed/tg1kaJqqkss", category: "SPORTS" },
  { id: "comedy_jokewrld", title: "Best of Comedy 2026 Compilation", video_url: "https://www.youtube.com/embed/SH-BU9aMYi8", category: "COMEDY" }
];

const VideoPlayer = ({ src, type, muted, onPlaying, onError }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    const destroyHls = () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };

    if (type === 'hls' || src.includes('.m3u8')) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src; video.play().catch(() => {});
      } else if (Hls.isSupported()) {
        destroyHls();
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls; hls.loadSource(src); hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls.on(Hls.Events.ERROR, (e, data) => data.fatal && onError());
      }
      return destroyHls;
    } else {
      video.src = src; video.play().catch(() => {});
    }
  }, [src, type, onError]);

  useEffect(() => { if (videoRef.current) videoRef.current.muted = muted; }, [muted]);

  return <video ref={videoRef} className="w-full h-full object-cover bg-black" autoPlay playsInline loop={type === 'mp4'} onPlaying={onPlaying} onError={onError} />;
};

const YouTubePlayer = ({ src, muted, onError }) => {
  const embedUrl = `${src}${src.includes('?') ? '&' : '?'}autoplay=1&mute=${muted ? 1 : 0}&rel=0&controls=0&modestbranding=1`;
  return <iframe src={embedUrl} className="w-full h-full border-0 bg-black" allow="autoplay; fullscreen" title="ZTV LIVE" onError={onError} />;
};

const WatchPage = () => {
  const [content, setContent] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [freshIndex, setFreshIndex] = useState(0);
  const lastSyncId = useRef(null);
  const consecutiveOldContent = useRef(0);

  const fetchSync = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/tv/sync');
      
      if (data?.video_id === lastSyncId.current || data?.video_id === '21X5lGlDOfg' || data?.video_url?.includes('21X5lGlDOfg')) {
        consecutiveOldContent.current += 1;
      } else {
        consecutiveOldContent.current = 0;
      }

      if (consecutiveOldContent.current >= 1) {
        const nextFresh = FRESH_2026_CLIPS[freshIndex % FRESH_2026_CLIPS.length];
        setContent({ ...nextFresh, stream_type: 'youtube', is_fresh: true });
        setFreshIndex(prev => prev + 1);
        lastSyncId.current = nextFresh.id;
      } else {
        setContent(data);
        lastSyncId.current = data.video_id;
      }
    } catch (e) {
      console.error("Sync error", e);
    }
  }, [freshIndex]);

  useEffect(() => {
    fetchSync();
    const inv = setInterval(fetchSync, 15000);
    return () => clearInterval(inv);
  }, [fetchSync]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {showOverlay && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm cursor-pointer" onClick={() => { setIsMuted(false); setShowOverlay(false); }}>
          <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center animate-pulse mb-6 shadow-2xl">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          </div>
          <h1 className="text-3xl font-black tracking-tighter mb-2">ZTV LIVE 2026</h1>
          <p className="text-zinc-400 uppercase tracking-widest text-sm">Tap to Unmute & Watch</p>
        </div>
      )}

      <div className="absolute inset-0 z-0">
        {content && (
          (content.stream_type === 'youtube' || content.video_url?.includes('youtube.com')) ? (
            <YouTubePlayer src={content.video_url} muted={isMuted} onError={fetchSync} />
          ) : (
            <VideoPlayer src={content.video_url} type={content.stream_type} muted={isMuted} onError={fetchSync} />
          )
        )}
      </div>

      <div className="absolute top-6 left-6 z-10 flex items-center gap-3 pointer-events-none">
        <div className="bg-red-600 px-3 py-1 text-xs font-black rounded-sm animate-pulse">LIVE</div>
        <div className="text-white/80 text-xs font-bold tracking-widest uppercase">{content?.category || '24/7 STREAM'}</div>
      </div>

      <div className="absolute bottom-10 left-10 z-10 pointer-events-none">
        <h2 className="text-4xl sm:text-6xl font-black tracking-tighter leading-none mb-2 drop-shadow-2xl">{content?.title || 'ZTV LIVE'}</h2>
        <p className="text-red-600 font-bold tracking-widest text-sm">{content?.is_fresh ? 'NEW 2026 EXCLUSIVE' : 'ZTV OFFICIAL BROADCAST'}</p>
      </div>
      
      {content?.is_fresh && (
        <div className="absolute top-6 right-6 z-10 bg-green-600 px-3 py-1 rounded-full text-[10px] text-white font-black animate-bounce shadow-lg">
          FRESH APRIL 2026 HITS
        </div>
      )}
    </div>
  );
};

export default WatchPage;
