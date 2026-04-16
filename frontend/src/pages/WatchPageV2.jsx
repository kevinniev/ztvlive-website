import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Clock, Play, Pause, SkipForward, Volume2, VolumeX, Volume1, Rewind, FastForward,
  MessageCircle, Users, Send, Calendar, RefreshCw, Radio, Maximize, Minimize, Share2,
  Subtitles, Monitor, Gamepad2, Trophy, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link, useSearchParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { toast } from "sonner";
import AdUnit from "@/components/AdUnit";
import { ScreenMirrorButton } from "@/components/ScreenMirror";
import ComingUpAlert from "@/components/ComingUpAlert";
import LiveSurveyOverlay from "@/components/LiveSurveyOverlay";
import WinnerTicker from "@/components/WinnerTicker";
import LiveLeaderboard from "@/components/LiveLeaderboard";
import { FanSubscribeWidget } from "@/components/CreatorWidgets";
import { useTranslation, LanguageSelector } from "@/contexts/TranslationContext";

// Modular components for future refactoring
// These can replace inline JSX as the refactor progresses:
// - VideoPlayer: /app/frontend/src/components/watch/VideoPlayer.jsx
// - PlayerControls: /app/frontend/src/components/watch/PlayerControls.jsx  
// - LiveChat: /app/frontend/src/components/watch/LiveChat.jsx
// - UpcomingSchedule: /app/frontend/src/components/watch/UpcomingSchedule.jsx
// - useVideoPlayer hook: /app/frontend/src/hooks/useVideoPlayer.js

const API = '/api';

// Extract YouTube video ID from embed URL
const getYouTubeVideoId = (url) => {
  if (!url) return null;
  
  // Handle embed URLs: youtube.com/embed/VIDEO_ID
  let match = url.match(/youtube\.com\/embed\/([^?&/]+)/);
  if (match) return match[1];
  
  // Handle standard watch URLs: youtube.com/watch?v=VIDEO_ID
  match = url.match(/youtube\.com\/watch\?v=([^?&/]+)/);
  if (match) return match[1];
  
  // Handle short URLs: youtu.be/VIDEO_ID
  match = url.match(/youtu\.be\/([^?&/]+)/);
  if (match) return match[1];
  
  return null;
};

export default function WatchPage() {
  const [searchParams] = useSearchParams();
  const autoUnmute = searchParams.get('unmute') === 'true';
  const autoplayGame = searchParams.get('autoplay') === 'game';
  const autoJoin = searchParams.get('auto_join') === 'true';
  const inviteCode = searchParams.get('invite') || searchParams.get('ref');
  const rewardId = searchParams.get('reward_id');
  const campaign = searchParams.get('campaign') || searchParams.get('utm_campaign');
  const utmSource = searchParams.get('utm_source') || searchParams.get('ref');
  
  // OBS/Broadcast mode - cleaner player for screen capture
  const obsMode = searchParams.get('obs') === 'true' || searchParams.get('broadcast') === 'true';
  // Clean mode - hide ALL UI overlays (for pure video capture)
  const cleanMode = searchParams.get('clean') === 'true' || searchParams.get('fullscreen') === 'true';
  // Broadcast mode - hide EVERYTHING for pure video output to OBS
  const broadcastMode = searchParams.get('broadcast') === 'true' || searchParams.get('output') === 'true';
  
  // Track page load time for engagement velocity
  const [pageLoadTime] = useState(Date.now());
  
  // Track which videos we've tried (for auto-skip)
  const [errorSkipCount, setErrorSkipCount] = useState(0);
  const [triedVideoIds, setTriedVideoIds] = useState(new Set());
  
  // Translation system - enables global language support
  const { t, language, setLanguage, supportedLanguages } = useTranslation();
  
  // Current playing content
  const [currentContent, setCurrentContent] = useState(null);
  const [nextContent, setNextContent] = useState(null);
  const [upcomingList, setUpcomingList] = useState([]);
  const [programBlock, setProgramBlock] = useState(null);
  
  // Playback state
  const [livePosition, setLivePosition] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.15);
  const [isLive, setIsLive] = useState(true);
  const [behindLive, setBehindLive] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [viewers, setViewers] = useState(0);
  const [ticker, setTicker] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionOpacity, setTransitionOpacity] = useState(1); // For smooth fade transition
  const [showControls, setShowControls] = useState(true);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [ccEnabled, setCcEnabled] = useState(false); // Closed Captions state
  const [ccLanguage, setCcLanguage] = useState('en'); // Caption language
  const [showCcMenu, setShowCcMenu] = useState(false); // Show language menu
  
  // Promo video fallback system
  const [isShowingPromo, setIsShowingPromo] = useState(false);
  const [promoVideos, setPromoVideos] = useState([]);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [silenceCount, setSilenceCount] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const savedContentRef = useRef(null); // Save the real content while showing promo
  const [currentUser, setCurrentUser] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [showGameShow, setShowGameShow] = useState(false); // Game Show overlay
  const userClosedGameRef = useRef(false); // Track if user explicitly closed the game
  const [bigScreenShowLive, setBigScreenShowLive] = useState(null); // Active Big Screen show
  const [pendingContent, setPendingContent] = useState(null); // Pre-loaded content for smooth transition
  
  // Auto-open game if coming from social link (autoplay=game OR auto_join=true)
  useEffect(() => {
    if (autoplayGame || autoJoin) {
      // Calculate engagement velocity (time from page load to game join)
      const joinTime = Date.now();
      const engagementVelocityMs = joinTime - pageLoadTime;
      
      // Small delay to let page load
      const timer = setTimeout(() => {
        setShowGameShow(true);
        
        // Fire "JoinPool" tracking event
        const trackJoinPool = async () => {
          try {
            await axios.post(`${API}/social-game/track-join`, {
              ref: inviteCode || utmSource,
              platform: utmSource,
              campaign: campaign,
              reward_id: rewardId,
              session_id: localStorage.getItem('ztvlive_session'),
              engagement_velocity_ms: engagementVelocityMs,
              auto_join: true
            });
            
            // Store for reward attribution
            if (rewardId) localStorage.setItem('ztvlive_reward_id', rewardId);
            if (campaign) localStorage.setItem('ztvlive_campaign', campaign);
            
            console.log(`[JoinPool] User joined in ${engagementVelocityMs}ms from ${utmSource || 'direct'}`);
          } catch (err) {
            console.error('Failed to track JoinPool:', err);
          }
        };
        
        trackJoinPool();
        toast.success("🎮 You're in the Bigger Pool! Start playing to win!");
      }, 500); // Faster join for auto_join
      
      return () => clearTimeout(timer);
    }
  }, [autoplayGame, autoJoin, inviteCode, utmSource, campaign, rewardId, pageLoadTime]);
  const [showLeaderboard, setShowLeaderboard] = useState(false); // Leaderboard overlay
  
  // Check for active Big Screen show on mount and periodically
  useEffect(() => {
    const checkBigScreenShow = async () => {
      try {
        const res = await axios.get(`${API}/bigscreen-show/status`);
        if (res.data.is_live) {
          setBigScreenShowLive(res.data);
          // Auto-open the game show when Big Screen is live
          // BUT only if user hasn't explicitly closed it AND game isn't already open
          if (!userClosedGameRef.current) {
            setShowGameShow(prev => {
              if (!prev) {
                toast.success("🎮 LIVE SHOW! The Unusual Fun Game Show is starting!");
                return true;
              }
              return prev;
            });
          }
        } else {
          setBigScreenShowLive(null);
          // Reset the userClosedGame flag when show ends so next show can auto-open
          userClosedGameRef.current = false;
        }
      } catch (err) {
        console.log("Big Screen show check failed:", err);
      }
    };
    
    // Check immediately
    checkBigScreenShow();
    
    // Check every 30 seconds
    const interval = setInterval(checkBigScreenShow, 30000);
    
    return () => clearInterval(interval);
  }, []); // No dependencies - only runs on mount and via interval
  
  // Supported caption languages (major world languages)
  const CAPTION_LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
    { code: 'pl', name: 'Polski', flag: '🇵🇱' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'th', name: 'ไทย', flag: '🇹🇭' },
    { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
    { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
  ];
  
  // Quick reaction emojis (like TikTok/FB Live)
  const QUICK_EMOJIS = ['❤️', '🔥', '😂', '😮', '👏', '💯', '🎉', '😍'];
  
  // Refs
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const countdownRef = useRef(null);
  const [ytApiReady, setYtApiReady] = useState(false);
  const currentVideoIdRef = useRef(null);
  const isSeekingRef = useRef(false);
  const scheduleEndTimeRef = useRef(null);
  const volumeRef = useRef(0.15);
  const isMutedRef = useRef(false);
  const transitionTimeoutRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);
  const lastPlayerTimeRef = useRef(0);
  const stuckCheckCountRef = useRef(0);
  const playerReadyRef = useRef(false);
  const startPositionRef = useRef(0); // Track the position to start the video at
  const freezeFrameCountRef = useRef(0); // Track freeze frames
  const lastProgressTimeRef = useRef(null); // Track last time progress changed

  // Keep refs in sync
  useEffect(() => {
    isMutedRef.current = isMuted;
    volumeRef.current = volume;
  }, [isMuted, volume]);

  // Auto-unmute when user interacts with device volume (mobile)
  // This detects user intent to hear audio
  useEffect(() => {
    // Create a silent audio context to detect user interaction
    let audioContext = null;
    
    const handleUserInteraction = () => {
      // On any user touch/click, if they haven't unmuted yet, show a hint
      if (isMuted && playerRef.current) {
        // Auto-unmute on first significant interaction after page load
        try {
          setIsMuted(false);
          isMutedRef.current = false;
          playerRef.current.unMute();
          playerRef.current.setVolume(volume * 100);
          toast.info("Audio enabled! Tap speaker icon to mute.", { duration: 2000 });
        } catch (e) {
          console.log('Could not auto-unmute:', e);
        }
      }
      // Remove listener after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    // Listen for keyboard volume controls
    const handleKeyDown = (e) => {
      // Volume up (AudioVolumeUp key, Arrow Up, or + key)
      if (e.key === 'AudioVolumeUp' || e.keyCode === 175 || 
          e.key === 'ArrowUp' || e.key === '+' || e.key === '=') {
        e.preventDefault();
        const newVolume = Math.min(1, volume + 0.05);
        handleVolumeChange(newVolume);
        if (isMuted && newVolume > 0) {
          setIsMuted(false);
          isMutedRef.current = false;
          if (playerRef.current) {
            try {
              playerRef.current.unMute();
            } catch (e) {}
          }
        }
        return;
      }
      
      // Volume down (AudioVolumeDown key, Arrow Down, or - key)
      if (e.key === 'AudioVolumeDown' || e.keyCode === 174 ||
          e.key === 'ArrowDown' || e.key === '-' || e.key === '_') {
        e.preventDefault();
        const newVolume = Math.max(0, volume - 0.05);
        handleVolumeChange(newVolume);
        return;
      }
      
      // Mute toggle (M key or AudioVolumeMute)
      if (e.key === 'm' || e.key === 'M' || e.key === 'AudioVolumeMute' || e.keyCode === 173) {
        e.preventDefault();
        toggleMute();
        return;
      }
      
      // Fullscreen toggle (F key)
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      
      // Space bar to toggle play/pause
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (playerRef.current) {
          try {
            const state = playerRef.current.getPlayerState();
            if (state === 1) { // Playing
              playerRef.current.pauseVideo();
              setIsPlaying(false);
            } else {
              playerRef.current.playVideo();
              setIsPlaying(true);
            }
          } catch (err) {}
        }
        return;
      }
    };

    // Add listeners after a short delay (let page load first)
    const timer = setTimeout(() => {
      document.addEventListener('keydown', handleKeyDown);
    }, 2000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleKeyDown);
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [isMuted, volume]);

  // Close CC menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showCcMenu) setShowCcMenu(false);
      if (showEmojiPicker) setShowEmojiPicker(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showCcMenu, showEmojiPicker]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtApiReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(tag, firstScript);

    window.onYouTubeIframeAPIReady = () => {
      setYtApiReady(true);
      console.log('YouTube API Ready');
    };
  }, []);

  // Check for current user
  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await axios.get(`${API}/auth/me`, { withCredentials: true });
        setCurrentUser(res.data);
      } catch (error) {
        setCurrentUser(null);
      }
    };
    checkUser();
  }, []);

  // Fetch current programming with retry logic
  const fetchNowPlaying = useCallback(async (forceAdvance = false, retryCount = 0) => {
    try {
      const [syncRes, upcomingRes, tickerRes] = await Promise.all([
        axios.get(`${API}/tv/sync`),
        axios.get(`${API}/tv/upcoming?count=5`),
        axios.get(`${API}/news/ticker`)
      ]);
      
      const data = syncRes.data;
      
      // Validate we got actual content - if not, retry
      if (!data || (!data.video_id && !data.now_playing?.id)) {
        console.warn('Empty API response, retrying...', retryCount);
        if (retryCount < 3) {
          setTimeout(() => fetchNowPlaying(forceAdvance, retryCount + 1), 1000);
          return { data: null, contentChanged: false };
        }
      }
      
      // Build newContent from the API response - use top-level fields which are always present
      // Prefer embed_url (already formatted) over video_url (may need parsing)
      const newContent = {
        id: data.video_id || data.now_playing?.id,
        title: data.title || data.now_playing?.title,
        video_url: data.embed_url || data.now_playing?.embed_url || data.video_url || data.now_playing?.video_url,
        thumbnail: data.thumbnail || data.now_playing?.thumbnail,
        category: data.category || data.now_playing?.category,
        duration_seconds: data.now_playing?.duration_seconds || 300,
        playback_duration: data.playback_duration || data.now_playing?.playback_duration,
        source: data.now_playing?.source || "ZTVLIVE",
        is_creator_content: data.is_creator_content || data.now_playing?.is_creator_content,
        creator_name: data.creator_name || data.now_playing?.creator_name
      };
      
      console.log('Fetched content:', newContent.title, 'Video URL:', newContent.video_url);
      
      const contentChanged = newContent && newContent.id && (!currentContent || newContent.id !== currentContent.id);
      
      // Get the server's elapsed time for this video - this is the LIVE position
      const serverElapsedSeconds = data.elapsed_seconds || data.now_playing?.elapsed_seconds || 0;
      
      if (contentChanged) {
        console.log('Content changed to:', newContent.title, 'Server elapsed:', serverElapsedSeconds, 'seconds');
        
        // Smooth fade transition for content change
        setIsTransitioning(true);
        setTransitionOpacity(0); // Fade out
        
        // Wait for fade out, then update content
        setTimeout(() => {
          setIsLive(true);
          setBehindLive(0);
          
          // For LIVE TV: ALWAYS sync to server's elapsed time
          // This ensures all viewers see the same thing at the same time
          startPositionRef.current = serverElapsedSeconds;
          
          setPlayerPosition(serverElapsedSeconds);
          setLivePosition(serverElapsedSeconds);
          setCurrentContent(newContent);
          
          // Fade back in after content is set
          setTimeout(() => {
            setTransitionOpacity(1);
            setIsTransitioning(false);
          }, 150);
        }, 200);
      } else {
        setCurrentContent(newContent);
      }
      setNextContent(upcomingRes.data.upcoming?.[0] || null);
      setLivePosition(data.elapsed_seconds || data.now_playing?.elapsed_seconds || 0);
      setDuration(newContent.duration_seconds || 300);
      setProgress(data.now_playing?.progress_percent || 0);
      setUpcomingList(upcomingRes.data.upcoming || []);
      setTicker(tickerRes.data.headlines || []);
      
      // Set program block info
      if (data.program_block) {
        setProgramBlock(data.program_block);
      }
      
      // Base viewer count of 1.385 million with natural variation
      // This represents the global ZTVLIVE audience across all platforms
      const now = new Date();
      const hourSeed = now.getUTCFullYear() * 1000000 + (now.getUTCMonth() + 1) * 10000 + now.getUTCDate() * 100 + now.getUTCHours();
      const minuteSeed = now.getUTCMinutes();
      const seededRandom = ((hourSeed * 9301 + 49297) % 233280) / 233280;
      const minuteVariation = ((minuteSeed * 7919 + 104729) % 233280) / 233280;
      
      // Base: 1,385,000 with hourly variation of ±50,000 and minute variation of ±5,000
      const hourlyVariation = Math.floor(seededRandom * 100000) - 50000; // -50k to +50k
      const smallVariation = Math.floor(minuteVariation * 10000) - 5000; // -5k to +5k
      const baseViewers = 1385000 + hourlyVariation + smallVariation;
      
      // Add real concurrent viewers from analytics (fetched separately)
      try {
        const concurrentRes = await axios.get(`${API}/analytics/concurrent`);
        const realViewers = concurrentRes.data?.count || 0;
        setViewers(baseViewers + realViewers);
      } catch (e) {
        setViewers(baseViewers);
      }
      
      setLoading(false);
      
      // Calculate remaining seconds from duration and elapsed
      // Use playback_duration (DJ-trimmed) if available, otherwise fall back to duration_seconds
      const elapsedSecs = data.elapsed_seconds || data.now_playing?.elapsed_seconds || 0;
      const totalDuration = newContent.playback_duration || newContent.duration_seconds || 300;
      const remainingSecs = totalDuration - elapsedSecs;
      if (remainingSecs > 0) {
        scheduleEndTimeRef.current = Date.now() + (remainingSecs * 1000);
      }
      
      // Only set player position when content actually changes (initial join or video switch)
      // Don't re-seek during playback - let videos play naturally from start to finish
      if (contentChanged) {
        setPlayerPosition(startPositionRef.current);
      }
      
      return { data, contentChanged };
    } catch (error) {
      console.error("Error fetching now playing:", error);
      // Retry on error
      if (retryCount < 3) {
        console.log(`Retrying fetch (${retryCount + 1}/3)...`);
        setTimeout(() => fetchNowPlaying(forceAdvance, retryCount + 1), 1500);
      }
      setLoading(false);
      return { data: null, contentChanged: false };
    }
  }, [currentContent, isLive]);

  // OBS Mode: Auto-refresh iframe when content changes
  useEffect(() => {
    if (!obsMode || !currentContent) return;
    
    const videoId = getYouTubeVideoId(currentContent.video_url);
    if (!videoId) return;
    
    console.log('[OBS MODE] Content changed to:', currentContent.title);
    
    // The iframe src is bound to currentContent, so it auto-updates
    // Just need to track for sync purposes
    setIsPlaying(true);
    setLoading(false);
    setIsTransitioning(false);
  }, [obsMode, currentContent?.video_url]);

  // Initialize YouTube player - NO YouTube graphics, clean player
  // OBS mode also uses the API now but with cleaner UI
  useEffect(() => {
    if (!currentContent || !ytApiReady) return;
    
    const videoId = getYouTubeVideoId(currentContent.video_url);
    if (!videoId) {
      console.log('No valid video ID, skipping to next...');
      fetchNowPlaying(true);
      return;
    }
    
    if (videoId === currentVideoIdRef.current && playerRef.current) {
      return;
    }

    console.log('Initializing player for:', currentContent.title, 'Video ID:', videoId);
    currentVideoIdRef.current = videoId;
    playerReadyRef.current = false;
    stuckCheckCountRef.current = 0;

    if (playerRef.current) {
      try {
        playerRef.current.destroy();
        playerRef.current = null;
      } catch (e) {}
    }

    // For LIVE TV playback: use the start position determined by fetchNowPlaying
    // - If joining mid-broadcast: startPositionRef has the server's elapsed seconds
    // - If a new video just started: startPositionRef is 0
    const startTime = Math.floor(startPositionRef.current || 0);
    console.log('Starting video at position:', startTime, 'seconds');
    
    // Set a timeout - if player doesn't load in 15 seconds, skip to next
    const loadTimeout = setTimeout(() => {
      if (!playerReadyRef.current) {
        console.log('Player load timeout - skipping to next video');
        setIsTransitioning(true);
        fetchNowPlaying(true);
        setTimeout(() => setIsTransitioning(false), 500);
      }
    }, 15000);

    const initPlayer = () => {
      const container = document.getElementById('youtube-player');
      if (!container) {
        setTimeout(initPlayer, 200);
        return;
      }
      
      try {
        // Use enablejsapi=1 and origin for better control
        const origin = window.location.origin;
        
        playerRef.current = new window.YT.Player('youtube-player', {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            mute: 1,                 // Always muted for autoplay compatibility
            controls: 0,           // No YouTube controls
            rel: 0,                // No related videos at end
            modestbranding: 1,     // Minimal YouTube branding
            showinfo: 0,           // No video info overlay
            iv_load_policy: 3,     // No annotations
            disablekb: 1,          // No keyboard shortcuts
            fs: 0,                 // No fullscreen button
            playsinline: 1,        // Play inline on mobile
            start: startTime,
            enablejsapi: 1,        // Enable JS API
            origin: origin,        // Set origin for better control
            cc_load_policy: 0,     // No closed captions
            hl: 'en',
            widget_referrer: origin
          },
          events: {
            onReady: (event) => {
              console.log('Player ready for:', currentContent?.title);
              playerReadyRef.current = true;
              stuckCheckCountRef.current = 0;
              lastPlayerTimeRef.current = 0;
              
              // Set volume - start muted for autoplay compliance, then unmute
              event.target.mute();
              event.target.playVideo();
              setIsPlaying(true);
              setIsTransitioning(false);
              
              // AUTOPLAY VERIFICATION: Check if video actually started playing after 5 seconds
              // If not playing (still paused with red play button), switch to promo or skip
              setTimeout(() => {
                if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
                  const state = playerRef.current.getPlayerState();
                  // State 1 = playing, State 2 = paused, State -1 = unstarted
                  if (state !== 1) {
                    console.log('⚠️ Video failed to autoplay after 5s (state:', state, ')- switching to next');
                    // Report as potential embedding issue
                    const videoId = getYouTubeVideoId(currentContent?.video_url);
                    if (videoId) {
                      axios.post(`${API}/tv/report-error`, null, {
                        params: { video_id: videoId, error_code: 150, error_message: 'Autoplay failed' }
                      }).catch(e => {});
                    }
                    // Skip to next video
                    checkScheduleAndAdvance();
                  }
                }
              }, 5000);
              
              // Aggressive autoplay: Try to unmute after a short delay
              // Browsers may block this but we attempt it
              setTimeout(() => {
                if (playerRef.current && !isMutedRef.current) {
                  try {
                    playerRef.current.unMute();
                    playerRef.current.setVolume(volumeRef.current * 100);
                  } catch (e) {
                    console.log('Could not unmute - user interaction required');
                  }
                }
              }, 500);
            },
            onStateChange: (event) => {
              console.log('Player state:', event.data, '- Video:', currentContent?.title);
              
              // Clear load timeout once we get any state change
              clearTimeout(loadTimeout);
              
              if (event.data === 0) {
                // Video ended - notify backend if it was creator content
                console.log('Video ended, advancing...');
                if (currentContent?.is_creator_content) {
                  axios.post(`${API}/creator-schedule/video-ended`, {
                    video_id: currentContent?.id,
                    actual_duration_seconds: Math.floor(event.target.getDuration?.() || 0)
                  }).catch(err => console.log('Video end notification failed:', err));
                }
                checkScheduleAndAdvance();
              } else if (event.data === 1) {
                // Playing
                setIsPlaying(true);
                setIsTransitioning(false);
                setLoading(false);
                stuckCheckCountRef.current = 0;
                
                // AUTO-SKIP: Start checking for YouTube end screen (last 15 seconds)
                // This avoids showing YouTube's suggested videos overlay and promo cards
                const checkEndScreen = () => {
                  if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                    try {
                      const currentTime = playerRef.current.getCurrentTime();
                      const duration = playerRef.current.getDuration();
                      // Use playback_duration (DJ-trimmed) if available
                      const effectiveDuration = currentContent?.playback_duration || duration;
                      const timeRemaining = effectiveDuration - currentTime;
                      
                      // If less than 15 seconds remaining OR past playback_duration, skip to next content
                      // This avoids YouTube's end screen suggestions and promo cards
                      if ((timeRemaining > 0 && timeRemaining < 15 && effectiveDuration > 30) || 
                          (currentContent?.playback_duration && currentTime >= currentContent.playback_duration)) {
                        console.log(`⏭️ DJ Auto-skip: ${timeRemaining.toFixed(1)}s remaining - cutting before promo cards`);
                        checkScheduleAndAdvance();
                        return; // Stop checking
                      }
                      
                      // Keep checking every 1 second while video is playing (more aggressive)
                      if (playerRef.current.getPlayerState() === 1) {
                        setTimeout(checkEndScreen, 1000);
                      }
                    } catch (e) {
                      console.log('End screen check error:', e);
                    }
                  }
                };
                
                // Start checking after 5 seconds into the video (more aggressive)
                setTimeout(checkEndScreen, 5000);
                
              } else if (event.data === 2) {
                // Paused
                setIsPlaying(false);
              } else if (event.data === 3) {
                // Buffering - set timeout to skip if buffering too long (20 seconds - be patient)
                console.log('Video buffering...');
                setLoading(true);
                setTimeout(() => {
                  if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
                    try {
                      const state = playerRef.current.getPlayerState();
                      if (state === 3) { // Still buffering after 20 seconds
                        console.log('Buffering timeout - skipping to next video');
                        setIsTransitioning(true);
                        setLoading(false);
                        startPositionRef.current = 0;
                        fetchNowPlaying(true);
                        setTimeout(() => setIsTransitioning(false), 500);
                      }
                    } catch (e) {}
                  }
                }, 20000);
              } else if (event.data === -1) {
                // Unstarted - try to play multiple times
                console.log('Video unstarted, attempting to play...');
                let attempts = 0;
                const tryPlay = () => {
                  if (attempts < 3 && playerRef.current) {
                    try {
                      playerRef.current.playVideo();
                      attempts++;
                      setTimeout(() => {
                        if (playerRef.current && typeof playerRef.current.getPlayerState === 'function' && playerRef.current.getPlayerState() === -1) {
                          tryPlay();
                        }
                      }, 1000);
                    } catch (e) {}
                  } else if (attempts >= 3) {
                    // After 3 failed attempts, skip to next
                    console.log('Could not start video after 3 attempts, skipping...');
                    setIsTransitioning(true);
                    fetchNowPlaying(true);
                    setTimeout(() => setIsTransitioning(false), 500);
                  }
                };
                setTimeout(tryPlay, 500);
              }
            },
            onError: (event) => {
              console.error('YouTube error:', event.data, 'for video:', currentContent?.title);
              const currentId = currentContent?.id;
              const videoId = getYouTubeVideoId(currentContent?.video_url);
              
              // Report error to backend for auto-disable (only for embedding errors)
              if ((event.data === 150 || event.data === 101) && videoId) {
                axios.post(`${API}/tv/report-error`, null, {
                  params: { video_id: videoId, error_code: event.data, error_message: 'Embedding disabled' }
                }).catch(e => console.log('Error reporting:', e));
              }
              
              // Add current video to tried list immediately
              const newTriedIds = new Set(triedVideoIds);
              if (currentId) newTriedIds.add(currentId);
              setTriedVideoIds(newTriedIds);
              
              // Increment error count
              const newErrorCount = errorSkipCount + 1;
              setErrorSkipCount(newErrorCount);
              
              // Smooth transition - show loading state
              setIsTransitioning(true);
              
              // Fast skip with minimal delay for smoother experience
              const skipDelay = newErrorCount > 5 ? 300 : 100;
              
              setTimeout(async () => {
                // All error-skipped videos start from beginning
                startPositionRef.current = 0;
                
                // Find next untried video from upcoming list
                const untried = upcomingList.filter(v => !newTriedIds.has(v.id) && v.id !== currentId);
                
                if (untried.length > 0) {
                  // Switch to next untried video instantly
                  const nextVideo = untried[0];
                  console.log('Quick-switching to:', nextVideo.title);
                  setCurrentContent({
                    id: nextVideo.id,
                    title: nextVideo.title,
                    video_url: nextVideo.video_url,
                    thumbnail: nextVideo.thumbnail,
                    category: nextVideo.category,
                    duration_seconds: nextVideo.duration_seconds || 300,
                    source: nextVideo.source || "ZTVLIVE"
                  });
                } else if (newErrorCount < 15) {
                  // Fetch fresh content from server
                  console.log('Fetching fresh content...');
                  setTriedVideoIds(new Set());
                  try {
                    const res = await axios.get(`${API}/tv/upcoming?count=10`);
                    const freshVideos = res.data.upcoming || [];
                    if (freshVideos.length > 0) {
                      const nextVideo = freshVideos[0];
                      setCurrentContent({
                        id: nextVideo.id,
                        title: nextVideo.title,
                        video_url: nextVideo.video_url,
                        thumbnail: nextVideo.thumbnail,
                        category: nextVideo.category,
                        duration_seconds: nextVideo.duration_seconds || 300,
                        source: nextVideo.source || "ZTVLIVE"
                      });
                      setUpcomingList(freshVideos.slice(1));
                    }
                  } catch (e) {
                    console.error('Failed to fetch fresh content:', e);
                    fetchNowPlaying(true);
                  }
                } else {
                  // Reset after many errors
                  console.log('Resetting error state...');
                  setErrorSkipCount(0);
                  setTriedVideoIds(new Set());
                  fetchNowPlaying(true);
                }
                
                // End transition
                setTimeout(() => setIsTransitioning(false), 200);
              }, skipDelay);
            }
          }
        });
      } catch (e) {
        console.error('Error creating player:', e);
        clearTimeout(loadTimeout);
      }
    };
    
    setTimeout(initPlayer, 150);
    
    // Cleanup timeout on unmount or content change
    return () => {
      clearTimeout(loadTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContent?.id, ytApiReady]);

  // Check schedule and sync with server - for LIVE TV, server determines what's playing
  const checkScheduleAndAdvance = useCallback(async () => {
    // For synchronized live TV, we don't manually advance
    // Just re-sync with the server to get the current live content
    console.log('Video ended - quickly syncing to next...');
    
    try {
      // Fetch current live content from server (time-synchronized)
      const response = await axios.get(`${API}/tv/sync`);
      
      if (response.data) {
        const newContent = {
          id: response.data.video_id || response.data.now_playing?.id,
          title: response.data.title || response.data.now_playing?.title,
          video_url: response.data.video_url || response.data.now_playing?.video_url,
          embed_url: response.data.embed_url || response.data.now_playing?.embed_url,
          thumbnail: response.data.thumbnail || response.data.now_playing?.thumbnail,
          category: response.data.category || response.data.now_playing?.category,
          duration_seconds: response.data.now_playing?.duration_seconds || 300,
          playback_duration: response.data.playback_duration || response.data.now_playing?.playback_duration || response.data.now_playing?.duration_seconds || 300,
          source: response.data.now_playing?.source || "ZTVLIVE",
          is_creator_content: response.data.is_creator_content || response.data.now_playing?.is_creator_content,
          creator_name: response.data.creator_name || response.data.now_playing?.creator_name,
          creator_id: response.data.now_playing?.creator_id
        };
        
        // Sync to server's elapsed time
        const serverElapsed = response.data.elapsed_seconds || response.data.start_from_seconds || 0;
        
        // Extract video ID for quick loading
        const videoUrl = newContent.video_url || '';
        let newVideoId = null;
        if (videoUrl.includes('youtube.com/watch?v=')) {
          newVideoId = videoUrl.split('watch?v=')[1]?.split('&')[0];
        } else if (videoUrl.includes('youtu.be/')) {
          newVideoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
        }
        
        // FAST LOADING: If player exists and ready, use loadVideoById for instant transition
        if (playerRef.current && playerReadyRef.current && newVideoId && typeof playerRef.current.loadVideoById === 'function') {
          console.log('Fast loading next video:', newContent.title, 'at', serverElapsed, 'seconds');
          
          // Update refs and state first
          startPositionRef.current = serverElapsed;
          currentVideoIdRef.current = newVideoId;
          setPlayerPosition(serverElapsed);
          setLivePosition(serverElapsed);
          setCurrentContent(newContent);
          setDuration(newContent.playback_duration || newContent.duration_seconds || 300);
          setIsTransitioning(false);
          
          // Load new video instantly
          try {
            playerRef.current.loadVideoById({
              videoId: newVideoId,
              startSeconds: Math.floor(serverElapsed)
            });
            console.log('Loaded new video via loadVideoById');
            return;
          } catch (e) {
            console.log('loadVideoById failed, falling back to full reload:', e);
          }
        }
        
        // FALLBACK: Full content update (recreates player)
        startPositionRef.current = serverElapsed;
        setPlayerPosition(serverElapsed);
        setLivePosition(serverElapsed);
        setCurrentContent(newContent);
        setNextContent(null);
        setDuration(newContent.duration_seconds || 300);
        setIsTransitioning(true);
        setTimeout(() => setIsTransitioning(false), 500);
        
        console.log('Synced to live:', newContent.title, 'at', serverElapsed, 'seconds');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      setIsTransitioning(true);
      fetchNowPlaying(true);
      setTimeout(() => setIsTransitioning(false), 500);
    }
  }, [fetchNowPlaying]);

  // Monitor video position to trigger early transition (avoid YouTube suggestions)
  useEffect(() => {
    const checkVideoEnd = setInterval(() => {
      if (playerRef.current && duration > 0 && playerReadyRef.current && typeof playerRef.current.getPlayerState === 'function') {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          const playerState = playerRef.current.getPlayerState();
          
          // Check if video is stuck (same position for multiple checks while supposedly playing)
          if (playerState === 1) { // 1 = playing
            if (Math.abs(currentTime - lastPlayerTimeRef.current) < 0.5) {
              stuckCheckCountRef.current += 1;
              
              // If stuck for 15+ seconds (more patient), try gentle recovery
              if (stuckCheckCountRef.current >= 15) {
                console.log('Player stuck for 15+ seconds - attempting gentle recovery');
                stuckCheckCountRef.current = 0;
                
                // Just try to play again, don't seek (seeking causes skipping)
                try {
                  playerRef.current.playVideo();
                } catch (e) {
                  // If that fails, skip to next video
                  console.log('Recovery failed, skipping to next video');
                  setIsTransitioning(true);
                  startPositionRef.current = 0;
                  setTimeout(() => {
                    fetchNowPlaying(true);
                    setTimeout(() => setIsTransitioning(false), 500);
                  }, 300);
                }
              }
            } else {
              stuckCheckCountRef.current = 0;
            }
            lastPlayerTimeRef.current = currentTime;
          }
          
          // If within 3 seconds of end, trigger transition using checkScheduleAndAdvance
          // Use playback_duration (DJ-trimmed) if available, AND check against player duration
          const playerDuration = playerRef.current.getDuration ? playerRef.current.getDuration() : duration;
          const djDuration = currentContent?.playback_duration || duration;
          const effectiveDuration = Math.min(djDuration, playerDuration || djDuration);
          
          // Skip if: within 3 seconds of DJ duration, OR current time exceeds DJ duration
          if ((currentTime >= effectiveDuration - 3 && effectiveDuration > 10 && !isTransitioning) ||
              (currentContent?.playback_duration && currentTime >= currentContent.playback_duration - 2)) {
            console.log('🎧 DJ cut - skipping to next (', currentTime.toFixed(1), '/', effectiveDuration.toFixed(1), ')');
            checkScheduleAndAdvance();
          }
        } catch (e) {
          console.log('Error checking player state:', e);
        }
      }
    }, 1000);
    
    return () => clearInterval(checkVideoEnd);
  }, [duration, fetchNowPlaying, isTransitioning]);

  // Initial fetch
  useEffect(() => {
    fetchNowPlaying();
    axios.get(`${API}/chat/messages`).then(res => {
      setChatMessages(res.data.messages || []);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sync every 5 seconds to stay in sync with live TV schedule (reduced from 10s for better sync)
  useEffect(() => {
    syncIntervalRef.current = setInterval(() => {
      // Sync with server to ensure all viewers see the same content
      fetchNowPlaying(false);
    }, 5000);
    return () => clearInterval(syncIntervalRef.current);
  }, [fetchNowPlaying]);

  // Local countdown timer - also checks for content end
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setLivePosition(prev => {
        const newLivePos = prev + 1;
        if (duration > 0) {
          setProgress((newLivePos / duration) * 100);
          
          // If creator content - check for end conditions
          if (currentContent?.is_creator_content) {
            const remaining = duration - newLivePos;
            
            // At TRT=0 or past end - immediately sync to get next content
            if (remaining <= 0) {
              console.log('Creator content TRT reached 0, switching back to auto playlist');
              fetchNowPlaying(true);
            }
            // Near end (within 3 seconds) - pre-fetch next content
            else if (remaining <= 3 && remaining > 0) {
              console.log('Creator content ending soon, pre-fetching next content');
              fetchNowPlaying(true);
            }
          }
        }
        return newLivePos;
      });
      
      if (isLive) {
        setPlayerPosition(prev => prev + 1);
      } else {
        setBehindLive(prev => prev + 1);
      }
    }, 1000);
    
    return () => clearInterval(countdownRef.current);
  }, [duration, isLive, currentContent, fetchNowPlaying]);

  // PROMO VIDEO FALLBACK SYSTEM - Fetch promo videos on mount
  useEffect(() => {
    const fetchPromoVideos = async () => {
      try {
        const res = await axios.get(`${API}/tv/promo-videos`);
        if (res.data.videos && res.data.videos.length > 0) {
          setPromoVideos(res.data.videos);
          console.log(`📺 Loaded ${res.data.videos.length} promo videos for fallback`);
        }
      } catch (e) {
        console.log('Failed to load promo videos, using defaults');
        // Fallback to built-in promo videos
        setPromoVideos([
          { id: 'promo-1', title: 'ZTVLIVE - 70% Revolution', video_url: '/api/static/promo/ztvlive_70_revolution_with_voiceover.mp4', duration_seconds: 23 },
          { id: 'promo-2', title: 'ZTVLIVE - Create Stream Earn', video_url: '/api/static/promo/ztvlive_70_revolution_FINAL.mp4', duration_seconds: 36 }
        ]);
      }
    };
    fetchPromoVideos();
  }, []);

  // Switch to promo video when content is frozen/silent
  const switchToPromoVideo = useCallback(() => {
    if (promoVideos.length === 0) {
      console.log('No promo videos available, skipping to next content');
      checkScheduleAndAdvance();
      return;
    }

    // Save current content to resume later
    if (!isShowingPromo && currentContent) {
      savedContentRef.current = currentContent;
    }

    setIsShowingPromo(true);
    const promoVideo = promoVideos[currentPromoIndex % promoVideos.length];
    console.log(`📺 Switching to promo video: ${promoVideo.title}`);
    
    toast.info("📺 Loading fresh content...", { duration: 2000 });
    
    // Pause YouTube player if running (don't destroy - keeps DOM stable)
    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      try {
        playerRef.current.pauseVideo();
      } catch (e) {}
    }
    
    // Set the promo video content
    setCurrentContent({
      id: promoVideo.id,
      title: promoVideo.title,
      video_url: promoVideo.video_url,
      duration_seconds: promoVideo.duration_seconds || 30,
      is_promo: true,
      is_mp4: promoVideo.video_url.includes('.mp4')
    });
    
    // After promo ends, try to resume or advance
    setTimeout(() => {
      setIsShowingPromo(false);
      setCurrentPromoIndex(prev => prev + 1);
      freezeFrameCountRef.current = 0;
      
      // Try to sync back to live content
      console.log('📺 Promo ended, syncing back to live content');
      fetchNowPlaying(true);
    }, (promoVideo.duration_seconds || 30) * 1000);
    
  }, [promoVideos, currentPromoIndex, currentContent, isShowingPromo, checkScheduleAndAdvance, fetchNowPlaying]);

  // FREEZE FRAME WATCHDOG - Aggressive auto-skip when video is frozen
  useEffect(() => {
    const freezeWatchdog = setInterval(() => {
      // Don't monitor promo videos or during initial loading
      if (isShowingPromo || currentContent?.is_promo || loading || isTransitioning) return;
      
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function' && playerReadyRef.current) {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          const playerState = playerRef.current.getPlayerState?.() || 0;
          
          // Check for various stuck states
          const isPlaying = playerState === 1;
          const isPaused = playerState === 2;
          const isBuffering = playerState === 3;
          const isError = playerState === -1;
          const isUnstarted = playerState === -1 || playerState === 0;
          
          const lastTime = lastProgressTimeRef.current?.time || 0;
          const lastCheck = lastProgressTimeRef.current?.checkTime || 0;
          const now = Date.now();
          
          // Immediate skip on error state
          if (isError) {
            console.log('🚨 YouTube player error - skipping to next video immediately');
            freezeFrameCountRef.current = 0;
            checkScheduleAndAdvance();
            return;
          }
          
          // Skip if buffering for too long (6+ seconds)
          if (isBuffering && now - lastCheck > 6000) {
            freezeFrameCountRef.current += 1;
            console.log(`⏳ Buffering too long! Count: ${freezeFrameCountRef.current}`);
            if (freezeFrameCountRef.current >= 2) {
              console.log('⏭️ Video stuck buffering - skipping to next');
              freezeFrameCountRef.current = 0;
              checkScheduleAndAdvance();
              return;
            }
          }
          
          // Check for frozen playback (playing but time not advancing)
          if (isPlaying) {
            if (lastTime === currentTime && now - lastCheck > 2000) {
              freezeFrameCountRef.current += 1;
              console.log(`🧊 Freeze detected! Count: ${freezeFrameCountRef.current}, Time stuck at: ${currentTime.toFixed(1)}s`);
              
              // After 2 consecutive freeze detections (4+ seconds), skip to next video
              if (freezeFrameCountRef.current >= 2) {
                console.log('⏭️ Video frozen for 4+ seconds - skipping to NEXT video');
                freezeFrameCountRef.current = 0;
                // Skip directly to next scheduled video instead of promo
                checkScheduleAndAdvance();
                return;
              }
            } else if (lastTime !== currentTime) {
              // Progress is being made - reset freeze counter
              freezeFrameCountRef.current = 0;
            }
            
            lastProgressTimeRef.current = { time: currentTime, checkTime: now };
          }
          
          // Check for video stuck at 0 for too long (failed to start)
          if ((isUnstarted || isPaused) && currentTime === 0 && now - lastCheck > 8000) {
            console.log('🚨 Video failed to start after 8 seconds - skipping');
            freezeFrameCountRef.current = 0;
            checkScheduleAndAdvance();
            return;
          }
          
          // Also check if video is past playback_duration (DJ trim point)
          if (currentContent?.playback_duration && isPlaying) {
            if (currentTime >= currentContent.playback_duration) {
              console.log(`🎧 DJ trim reached (${currentTime.toFixed(1)}s >= ${currentContent.playback_duration}s) - cutting now`);
              checkScheduleAndAdvance();
            }
          }
          
        } catch (e) {
          console.log('Freeze watchdog error:', e);
          // On error, try to recover
          freezeFrameCountRef.current += 1;
          if (freezeFrameCountRef.current >= 3) {
            console.log('🚨 Multiple watchdog errors - forcing skip');
            freezeFrameCountRef.current = 0;
            checkScheduleAndAdvance();
          }
        }
      }
    }, 2000); // Check every 2 seconds
    
    return () => clearInterval(freezeWatchdog);
  }, [currentContent, isShowingPromo, checkScheduleAndAdvance, loading, isTransitioning]);

  // Format time
  const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return "0:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Play/Pause
  const togglePlay = () => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch (e) {}
  };

  // Volume control - unmute and set volume
  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
    volumeRef.current = newVolume;
    
    if (playerRef.current) {
      try {
        if (newVolume > 0) {
          setIsMuted(false);
          isMutedRef.current = false;
          playerRef.current.unMute();
          playerRef.current.setVolume(newVolume * 100);
        } else {
          setIsMuted(true);
          isMutedRef.current = true;
          playerRef.current.mute();
        }
      } catch (e) {}
    }
  };

  // Toggle mute - when unmuting, restore previous volume
  const toggleMute = () => {
    if (playerRef.current) {
      try {
        if (isMuted) {
          // Unmute - restore volume
          setIsMuted(false);
          isMutedRef.current = false;
          playerRef.current.unMute();
          playerRef.current.setVolume(volume * 100);
        } else {
          // Mute
          setIsMuted(true);
          isMutedRef.current = true;
          playerRef.current.mute();
        }
      } catch (e) {}
    }
  };

  // Rewind
  const rewind = () => {
    if (!playerRef.current) return;
    
    const newPosition = Math.max(0, playerPosition - 10);
    setPlayerPosition(newPosition);
    setIsLive(false);
    setBehindLive(livePosition - newPosition);
    
    try {
      isSeekingRef.current = true;
      playerRef.current.seekTo(newPosition, true);
      setTimeout(() => { isSeekingRef.current = false; }, 500);
    } catch (e) {}
  };

  // Fast forward (only to live)
  const fastForward = () => {
    if (!playerRef.current) return;
    
    const newPosition = Math.min(livePosition, playerPosition + 10);
    setPlayerPosition(newPosition);
    
    if (newPosition >= livePosition - 2) {
      setIsLive(true);
      setBehindLive(0);
    } else {
      setBehindLive(livePosition - newPosition);
    }
    
    try {
      isSeekingRef.current = true;
      playerRef.current.seekTo(newPosition, true);
      setTimeout(() => { isSeekingRef.current = false; }, 500);
    } catch (e) {}
  };

  // Go to live - refreshes the live feed to current real-time position
  const goToLive = useCallback(async () => {
    // Fetch fresh sync data to get current live position
    try {
      const response = await axios.get(`${API}/tv/sync`);
      const data = response.data;
      const freshLivePosition = data.elapsed_seconds || data.now_playing?.elapsed_seconds || 0;
      
      setLivePosition(freshLivePosition);
      setPlayerPosition(freshLivePosition);
      setIsLive(true);
      setBehindLive(0);
      
      if (playerRef.current) {
        isSeekingRef.current = true;
        playerRef.current.seekTo(freshLivePosition, true);
        playerRef.current.playVideo();
        setTimeout(() => { isSeekingRef.current = false; }, 500);
      }
      
      toast.success("Synced to LIVE!");
    } catch (e) {
      // Fallback to local live position
      if (playerRef.current) {
        setPlayerPosition(livePosition);
        setIsLive(true);
        setBehindLive(0);
        isSeekingRef.current = true;
        playerRef.current.seekTo(livePosition, true);
        setTimeout(() => { isSeekingRef.current = false; }, 500);
      }
    }
  }, [livePosition]);

  // Join Live - more prominent action that refreshes entire player
  const joinLive = useCallback(async () => {
    setLoading(true);
    
    try {
      // Fetch fresh content - force advance to get latest
      const result = await fetchNowPlaying(true);
      
      // Get the elapsed seconds from the fresh API data
      if (playerRef.current) {
        const freshPosition = livePosition || 0;
        playerRef.current.seekTo(freshPosition, true);
        playerRef.current.playVideo();
        
        // Unmute on explicit user action (mobile requires user gesture)
        if (isMuted) {
          playerRef.current.unMute();
          playerRef.current.setVolume(volume * 100);
          setIsMuted(false);
        }
      }
      
      setIsLive(true);
      setBehindLive(0);
      toast.success("🔴 Synced to LIVE!");
    } catch (e) {
      console.error('Join live error:', e);
      toast.error("Could not sync - try again");
    } finally {
      setLoading(false);
    }
  }, [fetchNowPlaying, isMuted, volume, livePosition]);

  // Share the stream - use correct domain www.ztvlivestream.com
  const shareStream = async () => {
    const shareUrl = "https://www.ztvlivestream.com/watch?ref=invite";
    const shareTitle = `Watch LIVE: ${currentContent?.title || "ZTVLIVE 24/7"} on ZTVLIVE`;
    const shareText = `🎬 Join me on ZTVLIVE! Watch 24/7 live streaming entertainment. ${shareUrl}`;
    
    // Try native share API first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        toast.success("Thanks for sharing! 🎉");
        return;
      } catch (e) {
        // User cancelled or share failed, fall through to clipboard
        if (e.name !== 'AbortError') {
          console.log('Share failed:', e);
        }
      }
    }
    
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("📋 Link copied! Share with friends");
    } catch (e) {
      // Final fallback: create a temporary input and copy
      try {
        const input = document.createElement('textarea');
        input.value = shareText;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        toast.success("📋 Link copied! Share with friends");
      } catch (err) {
        // Show the link in a toast so user can manually copy
        toast.info(`Share this link: ${shareUrl}`, { duration: 5000 });
      }
    }
  };

  // Share game invite link
  const shareGameInvite = async (platform = 'general') => {
    try {
      // Generate a trackable link
      const res = await axios.post(`${API}/social-game/generate-link`, {
        platform: platform,
        creator: localStorage.getItem('ztvlive_creator') || null,
        campaign: '7_day_squeeze'
      });
      
      const shareUrl = res.data.links.short;
      const shareText = `🎮 Join me on ZTVLIVE! Play trivia and win real prizes! ${shareUrl}`;
      
      // Try native share
      if (navigator.share) {
        try {
          await navigator.share({
            title: "ZTVLIVE Game Show",
            text: shareText,
            url: shareUrl
          });
          return;
        } catch (e) {
          // Fall through to clipboard
        }
      }
      
      // Copy to clipboard
      await navigator.clipboard.writeText(shareText);
      toast.success("🎮 Game invite link copied! Share it on " + platform);
    } catch (err) {
      toast.error("Failed to generate share link");
    }
  };

  // Toggle Closed Captions
  const toggleCC = useCallback(() => {
    if (!playerRef.current) return;
    
    try {
      if (ccEnabled) {
        // Disable captions
        playerRef.current.unloadModule('captions');
        playerRef.current.unloadModule('cc');
        setCcEnabled(false);
        toast.info('Captions OFF');
      } else {
        // Enable captions
        playerRef.current.loadModule('captions');
        playerRef.current.loadModule('cc');
        playerRef.current.setOption('captions', 'track', { languageCode: 'en' });
        setCcEnabled(true);
        toast.info('Captions ON');
      }
    } catch (e) {
      console.log('CC toggle error:', e);
      // Fallback method using iframe postMessage
      try {
        const iframe = playerRef.current.getIframe();
        if (iframe) {
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: ccEnabled ? 'hideAnnotations' : 'showAnnotations'
          }), '*');
        }
        setCcEnabled(!ccEnabled);
        toast.info(ccEnabled ? 'Captions OFF' : 'Captions ON');
      } catch (e2) {
        toast.error('Captions not available for this video');
      }
    }
  }, [ccEnabled]);

  // Change caption language
  // Change caption language - properly enable YouTube auto-translation
  const changeCaptionLanguage = useCallback((langCode) => {
    setCcLanguage(langCode);
    setShowCcMenu(false);
    
    const langName = CAPTION_LANGUAGES.find(l => l.code === langCode)?.name || langCode;
    
    if (playerRef.current) {
      try {
        // STEP 1: First, load the captions module if not loaded
        playerRef.current.loadModule('captions');
        playerRef.current.loadModule('cc');
        
        // STEP 2: Get available caption tracks
        const options = playerRef.current.getOptions();
        console.log('Player options:', options);
        
        // STEP 3: Set the caption track language
        // YouTube supports auto-translate via 'cc' module
        if (options && Array.isArray(options)) {
          if (options.includes('cc')) {
            // Use cc module for auto-translation
            playerRef.current.setOption('cc', 'track', { languageCode: langCode });
          }
          if (options.includes('captions')) {
            playerRef.current.setOption('captions', 'track', { languageCode: langCode });
          }
        }
        
        // STEP 4: Also try direct iframe postMessage approach for auto-translation
        const iframe = document.querySelector('#youtube-player iframe');
        if (iframe && iframe.contentWindow) {
          // Enable captions with specific language
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'loadModule',
            args: ['captions']
          }), '*');
          
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'loadModule',
            args: ['cc']
          }), '*');
          
          // Set the track language
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'setOption',
            args: ['cc', 'track', { languageCode: langCode }]
          }), '*');
          
          iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: 'setOption',
            args: ['captions', 'track', { languageCode: langCode }]
          }), '*');
        }
        
        // Enable captions state
        setCcEnabled(true);
        
        console.log(`CC language changed to: ${langCode} (${langName})`);
        toast.success(`Captions: ${langName}`);
      } catch (e) {
        console.log('Caption language change error:', e);
        // Still set the language in state so UI reflects the choice
        setCcEnabled(true);
        toast.info(`Language set to ${langName} - captions will show when available`);
      }
    } else {
      toast.info(`Language set to ${langName}`);
    }
  }, []);

  // Send chat
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const message = {
      id: Date.now(),
      username: "Viewer" + Math.floor(Math.random() * 1000),
      message: newMessage,
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, message].slice(-50));
    setNewMessage("");
    
    try {
      await axios.post(`${API}/chat/send`, message);
    } catch (e) {}
  };

  // Send emoji reaction (like TikTok/FB Live floating reactions)
  const sendEmojiReaction = useCallback((emoji) => {
    // Add floating emoji animation
    const newEmoji = {
      id: Date.now() + Math.random(),
      emoji: emoji,
      x: Math.random() * 60 + 20, // Random x position (20-80%)
    };
    
    setFloatingEmojis(prev => [...prev, newEmoji]);
    
    // Remove emoji after animation completes
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== newEmoji.id));
    }, 3000);
    
    // Also send as chat message
    const message = {
      id: Date.now(),
      username: currentUser?.name || "Viewer" + Math.floor(Math.random() * 1000),
      message: emoji,
      timestamp: new Date().toISOString(),
      isReaction: true
    };
    
    setChatMessages(prev => [...prev, message].slice(-50));
    
    try {
      axios.post(`${API}/chat/send`, message);
    } catch (e) {}
  }, [currentUser]);

  // Add emoji to message input
  const addEmojiToMessage = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Fullscreen toggle - optimized for mobile - HIDES ALL CONTROLS
  const toggleFullscreen = useCallback(async () => {
    const container = playerContainerRef.current;
    if (!container) return;
    
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement || 
      document.webkitFullscreenElement || 
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    
    if (isCurrentlyFullscreen) {
      // Exit fullscreen
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
        setIsFullscreen(false);
        setShowControls(true);
      } catch (e) {
        console.log('Exit fullscreen error:', e);
      }
    } else {
      // Enter fullscreen
      try {
        if (container.requestFullscreen) await container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
        else if (container.webkitEnterFullscreen) container.webkitEnterFullscreen();
        else if (container.mozRequestFullScreen) container.mozRequestFullScreen();
        else if (container.msRequestFullscreen) container.msRequestFullscreen();
        setIsFullscreen(true);
        setShowControls(false); // HIDE ALL controls in fullscreen
        
        // Lock orientation on mobile
        if (screen.orientation && screen.orientation.lock) {
          try { await screen.orientation.lock('landscape'); } catch (e) {}
        }
      } catch (e) {
        console.log('Fullscreen request error:', e);
        // iOS fallback
        if (playerRef.current?.getIframe) {
          try {
            const iframe = playerRef.current.getIframe();
            if (iframe?.webkitEnterFullscreen) {
              iframe.webkitEnterFullscreen();
              setIsFullscreen(true);
              setShowControls(false);
            } else if (iframe?.requestFullscreen) {
              await iframe.requestFullscreen();
              setIsFullscreen(true);
              setShowControls(false);
            }
          } catch (e2) {
            toast.error("Fullscreen not supported");
          }
        }
      }
    }
  }, []);

  // Double-tap detection for fullscreen
  const handleDoubleTap = useCallback((e) => {
    const now = Date.now();
    const timeDiff = now - lastTapTime;
    
    if (timeDiff < 300 && timeDiff > 0) {
      e.preventDefault();
      toggleFullscreen();
    } else if (!isFullscreen) {
      // Single tap - show controls briefly
      setShowControls(true);
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = setTimeout(() => {
        if (!isFullscreen) setShowControls(true);
      }, 3000);
    }
    
    setLastTapTime(now);
  }, [lastTapTime, isFullscreen, toggleFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
      setIsFullscreen(isFS);
      setShowControls(!isFS); // Hide controls in fullscreen, show when not
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const remaining = Math.max(0, duration - livePosition);

  // Get volume icon based on level
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hide navigation in clean mode and broadcast mode */}
      {!cleanMode && !broadcastMode && <Navigation />}

      <main className={`${isFullscreen || cleanMode || broadcastMode ? '' : 'pt-16'}`}>
        <div className={`flex flex-col lg:flex-row ${cleanMode || broadcastMode ? 'h-screen' : ''}`}>
          {/* Video Player Section */}
          <div className={`flex-1 ${cleanMode || broadcastMode ? 'w-full h-full' : ''}`}>
            {/* Video Container - Clean fullscreen with double-tap */}
            <div 
              ref={playerContainerRef} 
              className={`relative bg-black group ${isFullscreen ? 'fixed inset-0 z-[9999]' : 'aspect-video'}`}
              onClick={handleDoubleTap}
              onDoubleClick={(e) => { e.preventDefault(); toggleFullscreen(); }}
              style={{ cursor: isFullscreen ? 'none' : 'pointer' }}
            >
              {/* YouTube Player Container with smooth transition */}
              <div 
                className="absolute inset-0 transition-opacity duration-300 ease-in-out"
                style={{ opacity: transitionOpacity }}
              >
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <RefreshCw className="w-12 h-12 animate-spin text-red-500 mx-auto mb-4" />
                      <p className="text-zinc-400">{t('watch_loading')}</p>
                    </div>
                  </div>
                ) : currentContent ? (
                  <>
                    {/* OBS MODE: Simplified player for screen capture 
                        Uses same YouTube API but with cleaner overlay */}
                    {obsMode ? (
                      <>
                        <div 
                          id="youtube-player" 
                          className="absolute inset-0 w-full h-full"
                          style={{ zIndex: 1 }}
                        />
                        {/* OBS Mode indicator - small and unobtrusive, HIDDEN in pure broadcast mode */}
                        {!broadcastMode && (
                        <div className="absolute top-2 right-2 z-50 opacity-50">
                          <Badge className="bg-red-600/80 text-white text-xs">
                            OBS MODE
                          </Badge>
                        </div>
                        )}
                      </>
                    ) : broadcastMode ? (
                      /* BROADCAST MODE: Scale video to hide YouTube controls */
                      <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 1 }}>
                        <div 
                          id="youtube-player" 
                          className="absolute"
                          style={{
                            top: '-5%',
                            left: '-2%',
                            width: '104%',
                            height: '115%',
                            zIndex: 1
                          }}
                        />
                      </div>
                    ) : (
                      /* YouTube Player - ALWAYS rendered, never conditionally */
                      <div 
                        id="youtube-player" 
                        className="absolute inset-0 w-full h-full"
                        style={{ zIndex: 1 }}
                      />
                    )}
                    
                    {/* TOP OVERLAY - Hides YouTube's progress bar and branding that bleeds through */}
                    <div 
                      className={`absolute top-0 left-0 right-0 pointer-events-none ${broadcastMode ? 'h-28' : 'h-20'}`}
                      style={{ 
                        zIndex: 5,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 40%, rgba(0,0,0,0.7) 70%, transparent 100%)'
                      }}
                    />
                    
                    {/* CENTER OVERLAY - Hide YouTube play button and show ZTVLIVE loading when needed */}
                    {(!isPlaying || isTransitioning || loading) && !isShowingPromo && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none"
                        style={{ zIndex: 6 }}
                      >
                        <div className="flex flex-col items-center gap-4">
                          <div className="relative">
                            <div className="w-20 h-20 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-red-500 font-bold text-xl">Z</span>
                            </div>
                          </div>
                          <p className="text-white/80 text-sm">Loading ZTVLIVE...</p>
                        </div>
                      </div>
                    )}
                    
                    {/* BOTTOM OVERLAY - Hides YouTube's control bar area */}
                    <div 
                      className={`absolute bottom-0 left-0 right-0 pointer-events-none ${broadcastMode ? 'h-28' : 'h-20'}`}
                      style={{ 
                        zIndex: 5,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, transparent 100%)'
                      }}
                    />
                    
                    {/* BROADCAST MODE: Corner overlays to hide YouTube back/menu buttons */}
                    {broadcastMode && (
                      <>
                        {/* Bottom-left corner cover - covers YouTube back arrow */}
                        <div 
                          className="absolute bottom-0 left-0 w-32 h-32 pointer-events-none"
                          style={{ 
                            zIndex: 10,
                            background: 'rgba(0,0,0,1)'
                          }}
                        />
                        {/* Bottom-right corner cover - covers YouTube menu */}
                        <div 
                          className="absolute bottom-0 right-0 w-32 h-32 pointer-events-none"
                          style={{ 
                            zIndex: 10,
                            background: 'rgba(0,0,0,1)'
                          }}
                        />
                        {/* Left edge cover - full height */}
                        <div 
                          className="absolute top-0 left-0 bottom-0 w-8 pointer-events-none"
                          style={{ 
                            zIndex: 10,
                            background: 'rgba(0,0,0,1)'
                          }}
                        />
                        {/* Right edge cover - full height */}
                        <div 
                          className="absolute top-0 right-0 bottom-0 w-8 pointer-events-none"
                          style={{ 
                            zIndex: 10,
                            background: 'rgba(0,0,0,1)'
                          }}
                        />
                        {/* Extra bottom bar to cover any YouTube controls */}
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                          style={{ 
                            zIndex: 10,
                            background: 'rgba(0,0,0,1)'
                          }}
                        />
                      </>
                    )}
                    
                    {/* MP4 Video Player - Overlays YouTube when showing promo - separate from YT player */}
                    {isShowingPromo && currentContent.is_mp4 && (
                      <video
                        key="promo-video-player"
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ zIndex: 2 }}
                        autoPlay
                        muted={isMuted}
                        playsInline
                        onEnded={() => {
                          console.log('📺 Promo video ended, returning to live content');
                          setIsShowingPromo(false);
                          fetchNowPlaying(true);
                        }}
                        onError={() => {
                          console.log('📺 Promo video error, returning to live content');
                          setIsShowingPromo(false);
                          fetchNowPlaying(true);
                        }}
                        data-testid="promo-video-player"
                      >
                        <source src={currentContent.video_url} type="video/mp4" />
                      </video>
                    )}
                    
                    {/* Promo banner indicator */}
                    {isShowingPromo && (
                      <div className="absolute top-4 right-4 z-30 pointer-events-none">
                        <Badge className="bg-yellow-500 text-black font-bold">
                          📺 ZTVLIVE Promo
                        </Badge>
                      </div>
                    )}
                    
                    {/* Transparent overlay - captures taps for play/pause without blocking video */}
                    <div 
                      className="absolute inset-0"
                      style={{ zIndex: 10, cursor: isFullscreen ? 'none' : 'default' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // If video somehow stopped, restart it
                        if (playerRef.current && !isShowingPromo) {
                          const state = playerRef.current.getPlayerState?.();
                          if (state === 2 || state === -1 || state === 5) {
                            playerRef.current.playVideo();
                            // Also try to unmute on user tap
                            try {
                              playerRef.current.unMute();
                              playerRef.current.setVolume(volumeRef.current * 100);
                              setIsMuted(false);
                              isMutedRef.current = false;
                            } catch (err) {
                              console.log('Could not unmute');
                            }
                          }
                        }
                      }}
                      data-testid="video-touch-overlay"
                    />
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-zinc-400">No content available</p>
                  </div>
                )}
              </div>

              {/* Live/Behind Indicator - HIDDEN in fullscreen and broadcast mode */}
              {showControls && !isFullscreen && !broadcastMode && (
                <div className="absolute top-4 left-4 flex items-center gap-2 z-20 pointer-events-none">
                  {isLive ? (
                    <Badge className="bg-red-600 text-white animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                      LIVE
                    </Badge>
                  ) : (
                    <Badge 
                      className="bg-orange-600 text-white cursor-pointer pointer-events-auto"
                      onClick={goToLive}
                    >
                      <Radio className="w-3 h-3 mr-1" />
                      {formatTime(behindLive)} behind • Tap to go LIVE
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-zinc-600 bg-black/70">
                    <Users className="w-3 h-3 mr-1" />
                    {viewers.toLocaleString()}
                  </Badge>
                </div>
              )}

              {/* Custom Controls - HIDDEN in fullscreen and broadcast mode */}
              {showControls && !isFullscreen && !broadcastMode && (
                <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {/* Progress Bar */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-mono w-16 text-right text-white">{formatTime(playerPosition)}</span>
                  <div className="flex-1 h-2 bg-zinc-700/80 rounded-full overflow-hidden relative cursor-pointer">
                    {/* Live position (red) */}
                    <div 
                      className="absolute h-full bg-red-600/60 rounded-full"
                      style={{ width: `${Math.min((livePosition / duration) * 100, 100)}%` }}
                    />
                    {/* Current position (white) */}
                    <div
                      className="absolute h-full bg-white rounded-full transition-all"
                      style={{ width: `${Math.min((playerPosition / duration) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono w-16 text-white">{formatTime(duration)}</span>
                </div>
                
                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Play/Pause */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
                      onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                      data-testid="play-pause-btn"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </Button>
                    
                    {/* Rewind/Forward */}
                    <div className="flex items-center gap-1 bg-zinc-800/80 rounded-full px-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-white hover:bg-white/20"
                        onClick={(e) => { e.stopPropagation(); rewind(); }}
                        data-testid="rewind-btn"
                      >
                        <Rewind className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-zinc-400 px-1">10s</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-white hover:bg-white/20 disabled:opacity-30"
                        onClick={(e) => { e.stopPropagation(); fastForward(); }}
                        disabled={isLive}
                        data-testid="forward-btn"
                      >
                        <FastForward className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Volume Control - YouTube/Facebook Style */}
                    <div 
                      className="relative flex items-center"
                      onMouseEnter={() => setShowVolumeSlider(true)}
                      onMouseLeave={() => !isDraggingVolume && setTimeout(() => setShowVolumeSlider(false), 1000)}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
                        onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                        data-testid="mute-btn"
                      >
                        <VolumeIcon className="w-5 h-5" />
                      </Button>
                      <div 
                        className={`flex items-center overflow-hidden transition-all duration-300 ${showVolumeSlider ? 'w-20 ml-1 opacity-100' : 'w-0 opacity-0'}`}
                      >
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => { 
                            e.stopPropagation(); 
                            const val = parseFloat(e.target.value);
                            handleVolumeChange(val);
                            if (val > 0 && isMuted) toggleMute();
                          }}
                          onMouseDown={() => setIsDraggingVolume(true)}
                          onMouseUp={() => { setIsDraggingVolume(false); setTimeout(() => setShowVolumeSlider(false), 1500); }}
                          onTouchStart={() => setIsDraggingVolume(true)}
                          onTouchEnd={() => { setIsDraggingVolume(false); setTimeout(() => setShowVolumeSlider(false), 1500); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : volume) * 100}%)`
                          }}
                          data-testid="volume-slider"
                        />
                      </div>
                    </div>
                    
                    {/* Go Live button when behind */}
                    {!isLive && (
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-red-600 hover:bg-red-500 text-xs"
                        onClick={(e) => { e.stopPropagation(); goToLive(); }}
                        data-testid="go-live-btn"
                      >
                        <Radio className="w-3 h-3 mr-1" />
                        Go Live
                      </Button>
                    )}
                    
                    {/* Skip to Next Video button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-white hover:bg-white/20 rounded-full"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        console.log('Manual skip requested');
                        setIsTransitioning(true);
                        startPositionRef.current = 0; // Skip always starts new video from beginning
                        fetchNowPlaying(true);
                        setTimeout(() => setIsTransitioning(false), 500);
                      }}
                      data-testid="skip-btn"
                      title="Skip to next video"
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>
                    
                    {/* Closed Captions button with Language Menu */}
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-9 w-9 hover:bg-white/20 rounded-full ${ccEnabled ? 'text-yellow-400' : 'text-white'}`}
                        onClick={(e) => { e.stopPropagation(); toggleCC(); }}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setShowCcMenu(!showCcMenu); }}
                        data-testid="cc-btn"
                        title="Left click: Toggle captions | Right click: Language menu"
                      >
                        <Subtitles className="w-4 h-4" />
                      </Button>
                      
                      {/* Language indicator */}
                      {ccEnabled && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowCcMenu(!showCcMenu); }}
                          className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-bold rounded px-1 cursor-pointer hover:bg-yellow-400"
                        >
                          {ccLanguage.toUpperCase()}
                        </button>
                      )}
                      
                      {/* Language Selection Menu */}
                      {showCcMenu && (
                        <div 
                          className="absolute bottom-full right-0 mb-2 w-56 max-h-80 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-2 border-b border-zinc-700">
                            <p className="text-xs text-zinc-400 font-medium">Caption Language</p>
                          </div>
                          <div className="py-1">
                            {CAPTION_LANGUAGES.map((lang) => (
                              <button
                                key={lang.code}
                                onClick={(e) => { e.stopPropagation(); changeCaptionLanguage(lang.code); }}
                                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-zinc-800 transition-colors ${ccLanguage === lang.code ? 'bg-zinc-800 text-yellow-400' : 'text-white'}`}
                              >
                                <span className="text-lg">{lang.flag}</span>
                                <span>{lang.name}</span>
                                {ccLanguage === lang.code && <span className="ml-auto text-yellow-400">✓</span>}
                              </button>
                            ))}
                          </div>
                          <div className="p-2 border-t border-zinc-700">
                            <button
                              onClick={(e) => { e.stopPropagation(); setCcEnabled(false); setShowCcMenu(false); toast.info('Captions OFF'); }}
                              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 rounded"
                            >
                              Turn Off Captions
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Share button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-white hover:bg-white/20 rounded-full"
                      onClick={(e) => { e.stopPropagation(); shareStream(); }}
                      data-testid="share-btn"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                    
                    {/* Fullscreen button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-white hover:bg-white/20 rounded-full"
                      onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                      data-testid="fullscreen-btn"
                    >
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </Button>
                  </div>
                  
                  <div className="text-sm text-zinc-300">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatTime(remaining)} remaining
                  </div>
                </div>
              </div>
              )}
              
              {/* TOP RIGHT: Screen Mirror + Game Show + Leaderboard + Language buttons - HIDDEN in fullscreen and broadcast mode */}
              {!isFullscreen && !broadcastMode && (
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {/* Global Language Selector */}
                <div className="relative" data-testid="watch-language-selector">
                  <LanguageSelector className="text-xs" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 bg-yellow-600/80 hover:bg-yellow-500 text-white rounded-full"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLeaderboard(!showLeaderboard); }}
                  data-testid="leaderboard-btn"
                  title={t('watch_leaderboard')}
                >
                  <Trophy className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-10 w-10 ${bigScreenShowLive ? 'bg-red-600 animate-pulse' : 'bg-purple-600/80'} hover:bg-purple-500 text-white rounded-full relative`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowGameShow(true); }}
                  data-testid="game-show-btn"
                  title={bigScreenShowLive ? "LIVE SHOW! Tap to join" : t('watch_play_game')}
                >
                  <Gamepad2 className="w-5 h-5" />
                  {bigScreenShowLive && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-[8px] font-bold text-white px-1 rounded">LIVE</span>
                  )}
                </Button>
                <ScreenMirrorButton size="md" />
              </div>
              )}
              
              {/* BOTTOM RIGHT: Share & Invite CTA - HIDDEN in fullscreen and broadcast mode */}
              {!isFullscreen && !broadcastMode && (
              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {/* Share & Invite Button */}
                <button
                  onClick={(e) => { e.stopPropagation(); shareStream(); }}
                  className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white px-4 py-2 rounded-full font-semibold text-sm shadow-lg transition-all"
                  data-testid="share-invite-btn"
                >
                  <Share2 className="w-4 h-4" />
                  {t('watch_share_invite')}
                </button>
                
                {/* Fullscreen button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 bg-black/70 text-white hover:bg-black/90 rounded-full"
                  onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                  data-testid="mini-fullscreen-btn"
                  title={t('watch_fullscreen')}
                >
                  <Maximize className="w-5 h-5" />
                </Button>
              </div>
              )}
              
              {/* FULLSCREEN: Clean broadcast screen - MINIMAL UI for OBS/Roku capture */}
              {isFullscreen && (
                <>
                  {/* Only show small exit button in corner on hover - press ESC to exit */}
                  <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-70 transition-opacity duration-500">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-black/40 text-white/70 hover:bg-black/60 hover:text-white rounded-full"
                      onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                      data-testid="fullscreen-exit-btn"
                      title="Exit fullscreen (ESC)"
                    >
                      <Minimize className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Video Info */}
            <div className="p-4 border-b border-zinc-800">
              {/* Program Block Banner */}
              {programBlock && (
                <div className="mb-3 bg-gradient-to-r from-red-600/20 to-transparent border-l-4 border-red-600 pl-3 py-2">
                  <div className="text-red-400 font-semibold text-sm">{programBlock.name}</div>
                  <div className="text-zinc-400 text-xs">{programBlock.description}</div>
                </div>
              )}
              <h1 className="text-xl font-bold mb-1" data-testid="video-title">
                {currentContent?.title || "Loading..."}
              </h1>
              <div className="flex items-center gap-3 text-sm text-zinc-400">
                <span>{currentContent?.source}</span>
                <span>•</span>
                <Badge variant="outline" className="border-zinc-700 capitalize">
                  {currentContent?.category}
                </Badge>
              </div>
            </div>

            {/* Ad Unit - Below Video Info */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
              <AdUnit 
                slot="9140061483" 
                format="horizontal"
                className="min-h-[90px]"
              />
            </div>

            {/* Up Next */}
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <SkipForward className="w-5 h-5 text-red-500" />
                Up Next
              </h2>
              
              {nextContent && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={nextContent.thumbnail}
                      alt={nextContent.title}
                      className="w-24 h-14 object-cover rounded"
                      onError={(e) => { e.target.src = "https://via.placeholder.com/96x56?text=ZTVLIVE"; }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{nextContent.title}</h3>
                      <p className="text-xs text-zinc-500">{nextContent.source}</p>
                    </div>
                    <Badge className="bg-green-600/20 text-green-400 border-green-600/50">
                      In {formatTime(remaining)}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Upcoming Schedule */}
              <div className="space-y-2">
                {upcomingList.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-900/50"
                  >
                    <img
                      src={item.content?.thumbnail}
                      alt={item.content?.title}
                      className="w-16 h-10 object-cover rounded"
                      onError={(e) => { e.target.src = "https://via.placeholder.com/64x40?text=ZTV"; }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm truncate">{item.content?.title}</h4>
                      <p className="text-xs text-zinc-500">{item.duration_display}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link to="/schedule" className="block mt-4">
                <Button variant="outline" className="w-full border-zinc-700">
                  <Calendar className="w-4 h-4 mr-2" />
                  View Full Schedule
                </Button>
              </Link>
            </div>
          </div>

          {/* Chat Sidebar - Hidden in clean mode and broadcast mode */}
          {!cleanMode && !broadcastMode && (
          <div className="w-full lg:w-80 border-l border-zinc-800 bg-zinc-900/50">
            <div className="h-full flex flex-col">
              {/* Creator Content Badge & Subscribe Widget */}
              {currentContent?.is_creator_content && currentContent?.creator_name && (
                <div className="p-3 border-b border-zinc-800 bg-gradient-to-r from-red-900/30 to-zinc-900/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Creator Content</span>
                  </div>
                  <p className="text-white font-semibold mb-2">By {currentContent.creator_name}</p>
                  <FanSubscribeWidget 
                    creatorId={currentContent.creator_id} 
                    creatorName={currentContent.creator_name} 
                  />
                </div>
              )}
              
              <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-red-500" />
                  {t('watch_live_chat')}
                </h3>
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {viewers.toLocaleString()}
                </span>
              </div>

              {/* Quick Emoji Reactions Bar (like TikTok/FB Live) */}
              <div className="p-2 border-b border-zinc-800 bg-zinc-800/50">
                <div className="flex items-center justify-between gap-1">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendEmojiReaction(emoji)}
                      className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-zinc-700 active:scale-110 transition-all text-xl"
                      title={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[300px] max-h-[500px] relative">
                {/* Floating Emoji Reactions Animation */}
                {floatingEmojis.map((item) => (
                  <div
                    key={item.id}
                    className="absolute text-3xl animate-bounce pointer-events-none"
                    style={{
                      left: `${item.x}%`,
                      bottom: '10px',
                      animation: 'floatUp 3s ease-out forwards',
                    }}
                  >
                    {item.emoji}
                  </div>
                ))}
                
                {chatMessages.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-8">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className={`text-sm ${msg.isReaction ? 'text-2xl text-center py-1' : ''}`}>
                      {msg.isReaction ? (
                        <span>{msg.message}</span>
                      ) : (
                        <>
                          <span className="font-medium text-red-400">{msg.username}: </span>
                          <span className="text-zinc-300">{msg.message}</span>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-zinc-800">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Send a message..."
                      className="bg-zinc-800 border-zinc-700 text-sm pr-10"
                    />
                    {/* Emoji Picker Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      😊
                    </button>
                    
                    {/* Emoji Picker Dropdown */}
                    {showEmojiPicker && (
                      <div className="absolute bottom-full right-0 mb-2 p-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl grid grid-cols-8 gap-1 z-50">
                        {['😀', '😂', '🥰', '😎', '🤩', '😭', '🙏', '💪', '🔥', '❤️', '💯', '👏', '🎉', '😮', '👀', '✨'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => addEmojiToMessage(emoji)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-zinc-700 rounded text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button type="submit" size="icon" className="bg-red-600 hover:bg-red-500">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
              
              {/* Ad Unit - Bottom of Chat */}
              <div className="p-3 border-t border-zinc-800 bg-zinc-900/50">
                <AdUnit 
                  slot="2079829118" 
                  format="rectangle"
                  className="min-h-[250px]"
                />
              </div>
            </div>
          </div>
          )}
        </div>
      </main>

      {/* News Ticker - Full scrolling feed - Hidden in clean mode and broadcast mode */}
      {ticker.length > 0 && !cleanMode && !broadcastMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white py-2 overflow-hidden">
          <div className="ticker-wrapper">
            <div className="ticker-content">
              <span className="mx-4 font-bold text-yellow-300">BREAKING NEWS:</span>
              {ticker.map((item, i) => (
                <span key={`a-${i}`} className="mx-6 inline-flex items-center">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse" />
                  {item.headline} 
                  <span className="ml-2 text-red-200 text-sm">• {item.source}</span>
                </span>
              ))}
              {/* Duplicate for seamless loop */}
              <span className="mx-4 font-bold text-yellow-300">BREAKING NEWS:</span>
              {ticker.map((item, i) => (
                <span key={`b-${i}`} className="mx-6 inline-flex items-center">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse" />
                  {item.headline} 
                  <span className="ml-2 text-red-200 text-sm">• {item.source}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video Transition Overlay - HIDDEN in broadcast mode */}
      {isTransitioning && !broadcastMode && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center transition-opacity duration-500">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white text-lg font-medium">Up Next...</p>
            {nextContent && (
              <p className="text-zinc-400 mt-2">{nextContent.title}</p>
            )}
          </div>
        </div>
      )}

      <style>{`
        /* Ticker animation - scrolls through all content - SLOW speed */
        .ticker-wrapper {
          width: 100%;
          overflow: hidden;
        }
        .ticker-content {
          display: inline-flex;
          white-space: nowrap;
          animation: ticker-scroll 120s linear infinite;
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        
        /* Pause ticker on hover */
        .ticker-wrapper:hover .ticker-content {
          animation-play-state: paused;
        }
        
        /* Hide YouTube branding and end screen */
        .ytp-chrome-top,
        .ytp-chrome-bottom,
        .ytp-gradient-top,
        .ytp-gradient-bottom,
        .ytp-show-cards-title,
        .ytp-pause-overlay,
        .ytp-watermark,
        .ytp-ce-element,
        .ytp-endscreen-content,
        .ytp-suggestion-set,
        .ytp-videowall-still,
        .ytp-endscreen-previous,
        .ytp-endscreen-next,
        .annotation,
        .iv-branding,
        .ytp-cards-teaser,
        .ytp-ce-covering-overlay,
        .ytp-ce-element-shadow,
        .ytp-ce-covering-image,
        .ytp-ce-expanding-image,
        .ytp-ce-playlist-btn {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `}</style>
      
      {/* Coming Up Alert */}
      <ComingUpAlert />
      
      {/* Winner Ticker - Shows real-time winner announcements */}
      <WinnerTicker />
      
      {/* Live Leaderboard - FOMO-inducing top 10 players */}
      <LiveLeaderboard 
        isOpen={showLeaderboard} 
        onClose={() => setShowLeaderboard(false)}
        isCompact={true}
      />
      
      {/* Live Survey Game (Family Feud Style) */}
      {showGameShow && (
        <LiveSurveyOverlay 
          isAdmin={currentUser?.role === 'admin'} 
          onClose={() => {
            userClosedGameRef.current = true; // Mark that user explicitly closed the game
            setShowGameShow(false);
          }}
          isFullscreen={isFullscreen}
        />
      )}
      
      {/* Big Screen LIVE Show Banner */}
      {bigScreenShowLive && bigScreenShowLive.is_live && !showGameShow && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
        >
          <button
            onClick={() => setShowGameShow(true)}
            className="bg-gradient-to-r from-red-600 via-purple-600 to-pink-600 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 hover:scale-105 transition-transform"
          >
            <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-white font-black">🎮 LIVE SHOW!</span>
            <span className="text-white/80 text-sm">
              Round {bigScreenShowLive.current_round} • Tap to join
            </span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
