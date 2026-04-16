import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import "./OBSBroadcastPage.css";

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * OBS Broadcast Page - Creator Content Scene
 * 
 * URL: /obs-broadcast
 * 
 * This page shows the video feed with the "Our World" scrolling ticker.
 * Used as the Creator Content scene source in OBS.
 * 
 * Features:
 * - Full screen YouTube video player
 * - "Our World" scrolling news ticker at bottom (matches watch page)
 * - Auto-skip for blocked videos
 */
const OBSBroadcastPage = () => {
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [newsItems, setNewsItems] = useState([]);
  const playerRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const lastVideoIdRef = useRef(null);
  const isInitializedRef = useRef(false);

  // Extract video ID from various YouTube URL formats
  const extractVideoId = (url) => {
    if (!url) return null;
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    const embedMatch = url.match(/youtube\.com\/embed\/([^?&/]+)/);
    if (embedMatch) return embedMatch[1];
    const watchMatch = url.match(/[?&]v=([^&]+)/);
    if (watchMatch) return watchMatch[1];
    const shortMatch = url.match(/youtu\.be\/([^?]+)/);
    if (shortMatch) return shortMatch[1];
    return null;
  };

  // Fetch news for ticker
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await axios.get(`${API}/api/news/ticker`);
        if (response.data && response.data.length > 0) {
          setNewsItems(response.data);
        }
      } catch (error) {
        // Use default "Our World" content if API fails
        setNewsItems([
          { title: "Our World • Your Entertainment", source: "ZTVLIVE" },
          { title: "Music • Movies • Gaming • Culture", source: "ZTVLIVE" },
          { title: "24/7 Live Streaming", source: "ZTVLIVE" },
          { title: "Global Entertainment Network", source: "ZTVLIVE" }
        ]);
      }
    };
    
    fetchNews();
    const interval = setInterval(fetchNews, 120000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, []);

  // Fetch current content
  const fetchContent = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/tv/sync`);
      const data = response.data;
      
      let videoId = data.video_id;
      if (!videoId) {
        videoId = extractVideoId(data.video_url) || 
                  extractVideoId(data.embed_url) ||
                  extractVideoId(data.now_playing?.video_url);
      }
      
      if (!videoId) {
        console.warn("No video ID found");
        return null;
      }
      
      return {
        id: videoId,
        title: data.title || data.now_playing?.title || "ZTVLIVE",
        startSeconds: data.elapsed_seconds || data.start_from_seconds || 0
      };
    } catch (error) {
      console.error("Fetch error:", error);
      return null;
    }
  }, []);

  // Initialize YouTube Player
  useEffect(() => {
    if (isInitializedRef.current) return;
    
    const initializePlayer = async () => {
      const content = await fetchContent();
      if (!content) {
        setTimeout(initializePlayer, 3000);
        return;
      }
      
      setCurrentVideo(content);
      lastVideoIdRef.current = content.id;
      
      const loadYouTubeAPI = () => {
        return new Promise((resolve) => {
          if (window.YT && window.YT.Player) {
            resolve();
            return;
          }
          
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          const firstScript = document.getElementsByTagName("script")[0];
          firstScript.parentNode.insertBefore(tag, firstScript);
          
          window.onYouTubeIframeAPIReady = () => resolve();
        });
      };
      
      await loadYouTubeAPI();
      
      // Create player with initial video
      playerRef.current = new window.YT.Player("youtube-player", {
        width: "100%",
        height: "100%",
        videoId: content.id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          mute: 1,
          playsinline: 1,
          enablejsapi: 1,
          start: Math.floor(content.startSeconds),
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            console.log("Player ready, starting playback...");
            setIsPlayerReady(true);
            event.target.playVideo();
            
            setTimeout(() => {
              try {
                event.target.unMute();
                event.target.setVolume(100);
                console.log("Audio unmuted");
              } catch (e) {
                console.error("Unmute error:", e);
              }
            }, 1500);
          },
          onStateChange: (event) => {
            if (event.data === 0) {
              console.log("Video ended, fetching next...");
              syncContent();
            } else if (event.data === -1 || event.data === 2) {
              event.target.playVideo();
            }
          },
          onError: (event) => {
            const errorCode = event.data;
            console.error("Player error:", errorCode);
            
            if (errorCode === 150 || errorCode === 101) {
              console.log("Embed blocked, auto-skipping...");
              axios.get(`${API}/api/tv/skip-current`)
                .then(() => setTimeout(syncContent, 1500))
                .catch(() => setTimeout(syncContent, 2000));
            } else {
              setTimeout(syncContent, 3000);
            }
          }
        }
      });
      
      isInitializedRef.current = true;
    };
    
    initializePlayer();
  }, [fetchContent]);

  // Sync content periodically
  const syncContent = useCallback(async () => {
    if (!isPlayerReady || !playerRef.current) return;
    
    const content = await fetchContent();
    if (!content) return;
    
    if (content.id !== lastVideoIdRef.current) {
      console.log(`Switching to: ${content.id} at ${content.startSeconds}s`);
      lastVideoIdRef.current = content.id;
      setCurrentVideo(content);
      
      try {
        playerRef.current.loadVideoById({
          videoId: content.id,
          startSeconds: content.startSeconds
        });
      } catch (e) {
        console.error("Load error:", e);
      }
    }
  }, [isPlayerReady, fetchContent]);

  // Start sync interval when player is ready
  useEffect(() => {
    if (!isPlayerReady) return;
    
    syncIntervalRef.current = setInterval(syncContent, 5000);
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isPlayerReady, syncContent]);

  // Build ticker text
  const tickerText = newsItems.length > 0 
    ? newsItems.map(item => `${item.title} • ${item.source}`).join("   •   ")
    : "Our World • Your Entertainment • ZTVLIVE 24/7 • Music • Movies • Gaming • Culture • Live Streaming";

  return (
    <div className="obs-broadcast-container">
      {/* Loading state */}
      {!currentVideo && (
        <div className="obs-loading">
          Connecting to ZTVLIVE...
        </div>
      )}
      
      {/* YouTube Player Container */}
      <div id="youtube-player" className="obs-player" />
      
      {/* Invisible overlay to prevent YouTube UI interactions */}
      <div className="obs-overlay" />
      
      {/* Our World Scrolling Ticker - Bottom */}
      <div className="obs-ticker-container">
        <div className="obs-ticker-content">
          <span className="obs-ticker-text">
            {tickerText}   •   {tickerText}   •   {tickerText}
          </span>
        </div>
      </div>
    </div>
  );
};

export default OBSBroadcastPage;
