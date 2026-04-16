import { useState, useEffect, useRef, useCallback } from "react";

/**
 * OBS Promo Feed - Local ZTVLIVE Promo Video Loop
 * 
 * Plays ZTVLIVE promo videos stored locally in the /public folder.
 * Perfect for filling gaps, transitions, and commercial breaks.
 * 
 * Features:
 * - Plays local MP4 promo videos (no external dependencies!)
 * - Shuffles playlist on load for variety
 * - Seamless looping through all promos
 * - Auto-skips on error, auto-advances on end
 * - Pure fullscreen video, no UI
 * 
 * Usage URL: /obs-promo or /promo-feed
 * 
 * For OBS: Add as Browser Source with 1920x1080 resolution
 */

// Local promo videos - stored in /public folder
const LOCAL_PROMOS = [
  { id: "premium", title: "ZTVLIVE Premium", file: "/ztvlive_promo_premium.mp4", duration: 12 },
  { id: "main", title: "ZTVLIVE Main", file: "/ztvlive_promo.mp4", duration: 15 },
  { id: "events", title: "ZTVLIVE Events", file: "/ztvlive_events_promo.mp4", duration: 8 },
  { id: "gaming", title: "ZTVLIVE Gaming", file: "/ztvlive_gaming_promo.mp4", duration: 8 },
  { id: "music", title: "ZTVLIVE Music", file: "/ztvlive_music_promo.mp4", duration: 8 },
  { id: "schedule", title: "ZTVLIVE Schedule", file: "/ztvlive_schedule_promo.mp4", duration: 8 },
  { id: "notification", title: "ZTVLIVE Notifications", file: "/ztvlive_notification_promo.mp4", duration: 8 },
  { id: "podcast", title: "ZTVLIVE Podcasts", file: "/ztvlive_podcast_promo.mp4", duration: 8 },
  { id: "install", title: "ZTVLIVE App", file: "/ztvlive_app_install_promo.mp4", duration: 8 },
  { id: "social", title: "ZTVLIVE Social", file: "/ztvlive_social_ad.mp4", duration: 8 },
];

// Fisher-Yates shuffle
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function OBSPromoFeed() {
  const videoRef = useRef(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const failedVideosRef = useRef(new Set());

  // Initialize shuffled playlist
  useEffect(() => {
    const shuffled = shuffleArray(LOCAL_PROMOS);
    setPlaylist(shuffled);
    console.log('[OBS Promo] Playlist initialized with', shuffled.length, 'videos');
  }, []);

  const currentVideo = playlist[currentIndex];

  // Advance to next video
  const advanceToNext = useCallback(() => {
    setCurrentIndex(prev => {
      const next = (prev + 1) % playlist.length;
      console.log('[OBS Promo] Advancing to video', next + 1, '/', playlist.length);
      return next;
    });
  }, [playlist.length]);

  // Handle video end - advance to next
  const handleEnded = useCallback(() => {
    console.log('[OBS Promo] Video ended:', currentVideo?.title);
    advanceToNext();
  }, [currentVideo, advanceToNext]);

  // Handle video error - skip to next
  const handleError = useCallback((e) => {
    console.error('[OBS Promo] Video error:', currentVideo?.file, e);
    
    // Track failed videos
    if (currentVideo) {
      failedVideosRef.current.add(currentVideo.id);
    }
    
    // If all videos failed, show error
    if (failedVideosRef.current.size >= playlist.length) {
      setError("No promo videos available");
      return;
    }
    
    // Skip to next
    advanceToNext();
  }, [currentVideo, playlist.length, advanceToNext]);

  // Handle video loaded
  const handleCanPlay = useCallback(() => {
    console.log('[OBS Promo] Video ready:', currentVideo?.title);
    setError(null);
    
    const video = videoRef.current;
    if (video) {
      video.play().then(() => {
        setIsPlaying(true);
        console.log('[OBS Promo] Playing:', currentVideo?.title);
      }).catch(err => {
        console.error('[OBS Promo] Autoplay blocked:', err);
        // Will play on click
      });
    }
  }, [currentVideo]);

  // Load and play video when index changes
  useEffect(() => {
    if (!currentVideo || !videoRef.current) return;

    const video = videoRef.current;
    
    // Skip if this video already failed
    if (failedVideosRef.current.has(currentVideo.id)) {
      advanceToNext();
      return;
    }

    console.log('[OBS Promo] Loading:', currentVideo.title, '-', currentVideo.file);
    
    // Reset state
    setIsPlaying(false);
    
    // Load new video
    video.src = currentVideo.file;
    video.load();
    
  }, [currentIndex, currentVideo, advanceToNext]);

  // Handle click to play (for autoplay blocked browsers)
  const handleClick = useCallback(() => {
    const video = videoRef.current;
    if (video && video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(console.error);
    }
  }, []);

  // Waiting for playlist
  if (playlist.length === 0) {
    return (
      <div style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100vw", height: "100vh",
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ color: "#333", fontSize: "14px" }}>Loading promos...</div>
      </div>
    );
  }

  // All videos failed
  if (error) {
    return (
      <div style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100vw", height: "100vh",
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{ color: "#444", fontSize: "14px" }}>{error}</div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000",
        overflow: "hidden",
        cursor: isPlaying ? "none" : "pointer",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        onEnded={handleEnded}
        onError={handleError}
        onCanPlay={handleCanPlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          backgroundColor: "#000",
        }}
      />

      {/* Click to play indicator (only when not playing) */}
      {!isPlaying && currentVideo && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#555",
            fontSize: "14px",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          Click to play
        </div>
      )}
    </div>
  );
}
