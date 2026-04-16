import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";

const API = '/api';

/**
 * OBS Creator Content Feed - Clean Fullscreen Video
 * 
 * OPTIMIZED FOR OBS Browser Source:
 * - Pure fullscreen YouTube embed - NO black bars/overlays
 * - Syncs with TV scheduler for current video
 * - Auto-plays with sound
 * - Falls back to promo on errors
 * 
 * URL: /obs-creator or /creator-feed
 * OBS Settings: 1920x1080, Control audio via OBS checked
 */

export default function OBSCreatorFeed() {
  const [videoId, setVideoId] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorCount, setErrorCount] = useState(0);
  const [showPromoFallback, setShowPromoFallback] = useState(false);
  
  const lastVideoIdRef = useRef(null);
  const errorTimeoutRef = useRef(null);

  // Disable body scroll and set black background
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = '#000';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.background = '#000';
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.background = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.background = '';
    };
  }, []);

  // Extract YouTube video ID from various URL formats
  const extractVideoId = (url) => {
    if (!url) return null;
    // Handle embed URLs
    let match = url.match(/youtube\.com\/embed\/([^?&/]+)/);
    if (match) return match[1];
    // Handle watch URLs
    match = url.match(/youtube\.com\/watch\?v=([^&]+)/);
    if (match) return match[1];
    // Handle short URLs
    match = url.match(/youtu\.be\/([^?&/]+)/);
    if (match) return match[1];
    return null;
  };

  // Report issue to API
  const reportIssue = useCallback(async (issueType) => {
    try {
      await axios.post(`${API}/obs/report-issue`, null, {
        params: { issue_type: issueType, details: `Video: ${videoId}` }
      });
    } catch (e) {
      console.error('[OBS-Creator] Report failed:', e);
    }
  }, [videoId]);

  // Handle video error
  const handleVideoError = useCallback(() => {
    setErrorCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 3) {
        setShowPromoFallback(true);
        reportIssue('video_error');
      }
      return newCount;
    });
  }, [reportIssue]);

  // Error timeout
  useEffect(() => {
    if (!videoId || showPromoFallback) return;

    errorTimeoutRef.current = setTimeout(() => {
      handleVideoError();
    }, 15000);

    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, [videoId, showPromoFallback, handleVideoError]);

  // Fetch sync data from TV scheduler
  const fetchSync = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/tv/sync`);
      const data = res.data;
      const nowPlaying = data.now_playing || data;
      
      const videoUrl = data.video_url || nowPlaying?.video_url || '';
      const newVideoId = extractVideoId(videoUrl);
      const newElapsed = Math.floor(data.elapsed_seconds || data.start_from_seconds || 0);
      
      if (newVideoId && newVideoId !== lastVideoIdRef.current) {
        lastVideoIdRef.current = newVideoId;
        setVideoId(newVideoId);
        setElapsed(newElapsed);
        setIsLoading(false);
        setShowPromoFallback(false);
        setErrorCount(0);
        
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      }
    } catch (err) {
      console.error('[OBS-Creator] Sync error:', err);
    }
  }, []);

  // Poll for updates every 5 seconds
  useEffect(() => {
    fetchSync();
    const interval = setInterval(fetchSync, 5000);
    return () => clearInterval(interval);
  }, [fetchSync]);

  // YouTube embed URL - fullscreen, no controls, autoplay
  const iframeSrc = videoId 
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&fs=0&disablekb=1&start=${elapsed}&enablejsapi=0&playsinline=1&loop=0&origin=${window.location.origin}`
    : null;

  // Promo fallback
  if (showPromoFallback) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#000',
      }}>
        <iframe
          src="/obs-promo"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title="ZTVLIVE Promo"
          allow="autoplay"
        />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      {/* Fullscreen YouTube iframe - NO black bars */}
      {iframeSrc ? (
        <iframe
          src={iframeSrc}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="ZTVLIVE Content"
        />
      ) : isLoading ? (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#333',
          fontSize: '14px',
        }}>
          Connecting to stream...
        </div>
      ) : null}
    </div>
  );
}
