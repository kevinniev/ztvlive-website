import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const WatchPage = () => {
  const [currentContent, setCurrentContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmuteOverlay, setShowUnmuteOverlay] = useState(true);
  const [errorCount, setErrorCount] = useState(0);
  const playerRef = useRef(null);

  const fetchNowPlaying = useCallback(async () => {
    try {
      const response = await axios.get('/api/tv/sync');
      if (response.data && response.data.video_url !== currentContent?.video_url) {
        setCurrentContent(response.data);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching sync:', error);
    }
  }, [currentContent]);

  useEffect(() => {
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 10000);
    return () => clearInterval(interval);
  }, [fetchNowPlaying]);

  const handleUnmute = () => {
    setIsMuted(false);
    setShowUnmuteOverlay(false);
  };

  const handlePlayerError = () => {
    console.warn('Player error detected. Attempting to skip to next feed...');
    setErrorCount(prev => prev + 1);
    // Force a refresh of content on error
    setTimeout(fetchNowPlaying, 2000);
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-black text-white font-bold text-2xl">INITIALIZING ZTV LIVE 24/7...</div>;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      {/* Unmute Overlay for Mobile Autoplay */}
      {showUnmuteOverlay && (
        <div 
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md cursor-pointer transition-all hover:bg-black/70"
          onClick={handleUnmute}
        >
          <div className="p-8 rounded-full bg-red-600 animate-pulse shadow-2xl mb-4">
            <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V3L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Click to Unmute & Join Live</h2>
          <p className="text-gray-400 mt-2">Experience ZTV LIVE in Full 4K</p>
        </div>
      )}

      {/* Main Video Feed */}
      <div className="absolute inset-0">
        {currentContent?.video_url ? (
          <iframe
            key={currentContent.video_url + errorCount}
            src={`${currentContent.video_url.includes('?') ? currentContent.video_url + '&' : currentContent.video_url + '?'}autoplay=1&mute=${isMuted ? 1 : 0}&rel=0&modestbranding=1&enablejsapi=1`}
            className="w-full h-full border-0 scale-[1.01]"
            allow="autoplay; fullscreen; picture-in-picture"
            title="ZTV LIVE Feed"
            onError={handlePlayerError}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700">
            <div className="w-12 h-12 border-4 border-zinc-800 border-t-red-600 rounded-full animate-spin mb-4"></div>
            <p className="text-lg font-medium">CONNECTING TO AUTOMATION HUB...</p>
          </div>
        )}
      </div>

      {/* UI Overlays */}
      <div className="absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none">
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-600 text-white px-3 py-1 rounded text-xs font-black animate-pulse">LIVE</div>
              <div className="text-white/60 text-xs font-bold tracking-widest uppercase">{currentContent?.category || '24/7 AUTOMATION'}</div>
            </div>
            <h1 className="text-6xl font-black text-white tracking-tighter drop-shadow-2xl leading-none">
              {currentContent?.title || 'ZTV LIVE'}
            </h1>
            <div className="mt-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white font-bold">Z</div>
              <span className="text-xl text-zinc-300 font-medium">ZTV Official Feed</span>
            </div>
          </div>
          
          <div className="hidden md:flex flex-col items-end text-right">
            <div className="text-white/40 text-xs font-bold tracking-widest uppercase mb-1">Current Viewers</div>
            <div className="text-4xl font-black text-white tabular-nums">{(1436592 + errorCount).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Cinematic Frame Border */}
      <div className="absolute inset-0 border-[20px] border-white/5 pointer-events-none"></div>
    </div>
  );
};

export default WatchPage;