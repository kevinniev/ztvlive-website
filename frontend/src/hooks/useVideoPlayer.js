/**
 * useVideoPlayer Hook for ZTVLIVE Watch Page
 * 
 * Manages video playback state including:
 * - Play/Pause state
 * - Volume control
 * - Progress tracking
 * - Live sync position
 */

import { useState, useEffect, useRef, useCallback } from "react";

export default function useVideoPlayer(initialVolume = 0.15) {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(initialVolume);
  const [previousVolume, setPreviousVolume] = useState(initialVolume);
  
  // Position state
  const [playerPosition, setPlayerPosition] = useState(0);
  const [livePosition, setLivePosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [behindLive, setBehindLive] = useState(0);
  const [isLive, setIsLive] = useState(true);
  
  // YouTube player ref
  const playerRef = useRef(null);
  const playerReadyRef = useRef(false);
  
  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error("Toggle play error:", error);
    }
  }, [isPlaying]);
  
  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    
    try {
      if (isMuted) {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume * 100);
      } else {
        playerRef.current.mute();
      }
      setIsMuted(!isMuted);
    } catch (error) {
      console.error("Toggle mute error:", error);
    }
  }, [isMuted, volume]);
  
  // Change volume
  const changeVolume = useCallback((newVolume) => {
    if (!playerRef.current || !playerReadyRef.current) return;
    
    try {
      const clampedVolume = Math.max(0, Math.min(1, newVolume));
      playerRef.current.setVolume(clampedVolume * 100);
      setVolume(clampedVolume);
      
      if (clampedVolume > 0 && isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
      if (clampedVolume === 0 && !isMuted) {
        setIsMuted(true);
      }
    } catch (error) {
      console.error("Change volume error:", error);
    }
  }, [isMuted]);
  
  // Seek to position
  const seekTo = useCallback((seconds, allowSeekAhead = true) => {
    if (!playerRef.current || !playerReadyRef.current) return;
    
    try {
      playerRef.current.seekTo(seconds, allowSeekAhead);
      setPlayerPosition(seconds);
    } catch (error) {
      console.error("Seek error:", error);
    }
  }, []);
  
  // Rewind 10 seconds
  const rewind = useCallback(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    
    try {
      const currentTime = playerRef.current.getCurrentTime();
      const newTime = Math.max(0, currentTime - 10);
      seekTo(newTime);
    } catch (error) {
      console.error("Rewind error:", error);
    }
  }, [seekTo]);
  
  // Fast forward 10 seconds
  const fastForward = useCallback(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    
    try {
      const currentTime = playerRef.current.getCurrentTime();
      const newTime = Math.min(duration, currentTime + 10);
      seekTo(newTime);
    } catch (error) {
      console.error("Fast forward error:", error);
    }
  }, [seekTo, duration]);
  
  // Go to live position
  const goToLive = useCallback(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    
    try {
      seekTo(livePosition);
      setIsLive(true);
      setBehindLive(0);
    } catch (error) {
      console.error("Go to live error:", error);
    }
  }, [seekTo, livePosition]);
  
  // Update position tracking (call periodically)
  const updatePosition = useCallback(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    
    try {
      const currentTime = playerRef.current.getCurrentTime() || 0;
      const totalDuration = playerRef.current.getDuration() || 0;
      
      setPlayerPosition(currentTime);
      setDuration(totalDuration);
      setLivePosition(totalDuration);
      
      const behind = totalDuration - currentTime;
      setBehindLive(behind);
      setIsLive(behind < 5); // Consider "live" if within 5 seconds
    } catch (error) {
      // Silently handle - player may not be ready
    }
  }, []);
  
  // Set player reference
  const setPlayer = useCallback((player) => {
    playerRef.current = player;
  }, []);
  
  // Set player ready state
  const setPlayerReady = useCallback((ready) => {
    playerReadyRef.current = ready;
    
    if (ready && playerRef.current) {
      // Apply initial settings
      playerRef.current.setVolume(volume * 100);
      if (isMuted) {
        playerRef.current.mute();
      }
    }
  }, [volume, isMuted]);
  
  return {
    // State
    isPlaying,
    isMuted,
    volume,
    playerPosition,
    livePosition,
    duration,
    behindLive,
    isLive,
    
    // Actions
    togglePlay,
    toggleMute,
    changeVolume,
    seekTo,
    rewind,
    fastForward,
    goToLive,
    updatePosition,
    
    // Setters
    setIsPlaying,
    setIsMuted,
    setVolume,
    setPlayer,
    setPlayerReady,
    
    // Refs
    playerRef,
  };
}
