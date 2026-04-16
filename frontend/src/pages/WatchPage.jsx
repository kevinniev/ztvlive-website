import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UnmuteOverlay from '../components/UnmuteOverlay';

const WatchPage = () => {
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showUnmute, setShowUnmute] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchContent = async () => {
    try {
      const response = await axios.get('/api/tv/sync');
      if (response.data && response.data.video_url !== currentVideo?.video_url) {
        setCurrentVideo(response.data);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
    const interval = setInterval(fetchContent, 10000);
    return () => clearInterval(interval);
  }, [currentVideo?.video_url]);

  const handleUnmute = () => {
    setIsMuted(false);
    setShowUnmute(false);
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-black text-white">Loading ZTV LIVE...</div>;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {showUnmute && <UnmuteOverlay onUnmute={handleUnmute} />}
      
      <div className="absolute inset-0">
        {currentVideo?.video_url ? (
          <iframe
            src={currentVideo.video_url.includes('youtube.com/embed/') 
              ? `${currentVideo.video_url}?autoplay=1&mute=${isMuted ? 1 : 0}&rel=0&modestbranding=1` 
              : currentVideo.video_url.includes('watch?v=')
                ? `https://www.youtube.com/embed/${currentVideo.video_url.split('watch?v=')[1].split('&')[0]}?autoplay=1&mute=${isMuted ? 1 : 0}`
                : currentVideo.video_url}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            title="ZTV LIVE Feed"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">Waiting for clean feed...</div>
        )}
      </div>

      <div className="absolute bottom-8 left-8 z-10">
        <h1 className="text-4xl font-bold text-white drop-shadow-lg">
          {currentVideo?.title || 'ZTV LIVE'}
        </h1>
        <p className="text-xl text-gray-300 drop-shadow-md">
          {currentVideo?.category || '24/7 Automation'}
        </p>
      </div>
    </div>
  );
};

export default WatchPage;