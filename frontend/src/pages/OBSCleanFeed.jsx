import { useState, useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import axios from "axios";

const API = '/api';

/**
 * OBS Clean Feed - 100% Pure Video Output
 * 
 * This page uses the DIRECT HLS stream from Castr - NO YOUTUBE!
 * Completely eliminates all YouTube overlays, popups, and branding.
 * 
 * Primary: Castr HLS Stream (pure video)
 * Fallback: Castr embedded player
 * 
 * Usage URLs: /obs-clean, /broadcast-feed, /clean-feed
 * 
 * For OBS: Add as Browser Source with 1920x1080 resolution
 */

// Direct HLS stream from Castr (no YouTube!)
const HLS_STREAM_URL = "https://shanahan.akamaized.net/5f0f2f3b7e39a52ee2b14bd1/live_4b7189d06d5211eb981d29252a61de03/index.m3u8";
const CASTR_PLAYER_URL = "https://player.castr.com/live_4b7189d06d5211eb981d29252a61de03";

export default function OBSCleanFeed() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [useHLS, setUseHLS] = useState(true);
  const [streamActive, setStreamActive] = useState(true);
  const retryCountRef = useRef(0);

  // Initialize HLS player
  useEffect(() => {
    if (!useHLS) return;
    
    const video = videoRef.current;
    if (!video) return;

    const initHLS = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          manifestLoadingTimeOut: 15000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 15000,
          fragLoadingTimeOut: 20000,
          startPosition: -1,
          debug: false,
        });

        hlsRef.current = hls;

        hls.loadSource(HLS_STREAM_URL);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('[OBS Clean] HLS stream connected');
          setIsLoading(false);
          setStreamActive(true);
          retryCountRef.current = 0;
          video.play().catch(() => {
            // Autoplay blocked - will play on click
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('[OBS Clean] HLS error:', data.type, data.details);
          
          if (data.fatal) {
            retryCountRef.current++;
            
            if (retryCountRef.current < 3) {
              // Retry HLS
              console.log(`[OBS Clean] Retrying HLS (${retryCountRef.current}/3)...`);
              setTimeout(() => {
                hls.destroy();
                initHLS();
              }, 2000);
            } else {
              // Fall back to Castr player
              console.log('[OBS Clean] Falling back to Castr player');
              hls.destroy();
              setUseHLS(false);
              setStreamActive(false);
            }
          }
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          setIsLoading(false);
          setStreamActive(true);
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = HLS_STREAM_URL;
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          setStreamActive(true);
          video.play().catch(() => {});
        });
        video.addEventListener('error', () => {
          setUseHLS(false);
          setStreamActive(false);
        });
      } else {
        // No HLS support
        setUseHLS(false);
      }
    };

    initHLS();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [useHLS]);

  // Handle click for unmute/play
  const handleClick = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.play().catch(() => {});
    }
  };

  // Castr player fallback (when HLS fails)
  if (!useHLS) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "#000",
          overflow: "hidden",
        }}
      >
        <iframe
          src={`${CASTR_PLAYER_URL}?autoplay=1&muted=0`}
          style={{
            position: "absolute",
            top: "-5%",
            left: "-2.5%",
            width: "105%",
            height: "110%",
            border: "none",
          }}
          allow="autoplay; fullscreen"
          allowFullScreen
          title="ZTVLIVE Stream"
        />
        
        {/* Full edge overlays to hide Castr branding */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "80px", background: "#000", zIndex: 10 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "100px", background: "#000", zIndex: 10 }} />
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "50px", background: "#000", zIndex: 10 }} />
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "50px", background: "#000", zIndex: 10 }} />
      </div>
    );
  }

  // HLS stream player (primary - pure video, NO YouTube!)
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
        cursor: "pointer",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
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

      {/* Loading indicator */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#333",
            fontSize: "14px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Connecting to stream...
        </div>
      )}

      {/* Stream offline indicator */}
      {!isLoading && !streamActive && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#444",
            fontSize: "14px",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          <div>Stream Offline</div>
          <div style={{ marginTop: "8px", fontSize: "12px" }}>
            Click to retry
          </div>
        </div>
      )}
    </div>
  );
}
