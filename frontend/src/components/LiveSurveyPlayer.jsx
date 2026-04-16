import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from 'react-router-dom';
import { 
  Users, Trophy, Clock, CheckCircle, XCircle, 
  Send, Timer, TrendingUp, Award, Star, Mail, Volume2, VolumeX, Share2, LogIn, Globe,
  Copy, Download, X, Smartphone, Facebook, Twitter, MessageCircle, Linkedin
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import axios from "axios";
import { useTranslation, LanguageSelector } from "../contexts/TranslationContext";

const API = process.env.REACT_APP_BACKEND_URL || '';

// Meta Pixel Helper - Track custom events
const trackPixelEvent = (eventName, params = {}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
  }
};

// Track custom events (non-standard)
const trackCustomEvent = (eventName, params = {}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('trackCustom', eventName, params);
  }
};

// Friendly AI Voice-Over messages - Natural and Exciting
const VOICE_MESSAGES = {
  welcome: [
    "Hey there! Welcome to ZTVLIVE, the most exciting game show on TV! Get ready to win some amazing prizes!",
    "What's up, superstar? You've just joined the party! Let's see if you can guess what everyone's thinking!",
    "Welcome aboard! You're about to play the craziest, most fun guessing game ever! Let's do this!",
    "Hey friend! So happy you're here with us tonight! Time to put that brain to work and win big!"
  ],
  batchEnd: [
    "What an incredible round that was! Stick around, because a brand new game is starting in just a moment!",
    "Amazing game everyone! Don't go anywhere, we've got more prizes coming up next!",
    "That was absolutely fantastic! Ready for another shot at the jackpot? New round loading now!",
    "You played like a champion! Stay tuned, the next game starts in just a few seconds!"
  ],
  newBatch: [
    "Here we go everybody! Fresh new questions, fresh new chances to win! Let's make it happen!",
    "Alright! A brand new round is kicking off right now! Show us what you've got!",
    "Game time! New questions are here and the prize pool is ready! Type fast and win big!"
  ]
};

/**
 * LiveSurveyPlayer - Family Feud Style Live Survey Game
 * 
 * Features:
 * - Type your own answer (no multiple choice)
 * - See % of people who chose same answer in real-time
 * - Top 4 answers revealed when countdown hits zero (10 sec display)
 * - 10-minute game batches with 10 questions each
 * - Prize claim via email
 * - SYNCED across all platforms (mobile, PC, tablet, Roku)
 */

export default function LiveSurveyPlayer({ embedded = false, teaserMode = false }) {
  const navigate = useNavigate();
  
  // Translation hook
  const { t, language, translateQuestion, translateAnswer, isRTL } = useTranslation();
  
  // Check URL params for teaser mode
  const urlParams = new URLSearchParams(window.location.search);
  const isTeaserMode = teaserMode || embedded || urlParams.get('teaser') === 'true' || urlParams.get('embed') === 'true';
  const TEASER_LIMIT = 3; // Maximum questions allowed in teaser mode
  
  // Teaser mode state - persisted in localStorage
  const [teaserQuestionsAnswered, setTeaserQuestionsAnswered] = useState(() => {
    if (isTeaserMode) {
      const stored = localStorage.getItem('ztvlive_teaser_count');
      return stored ? parseInt(stored, 10) : 0;
    }
    return 0;
  });
  const [showTeaserLimitModal, setShowTeaserLimitModal] = useState(false);
  
  // Check if teaser limit reached
  useEffect(() => {
    if (isTeaserMode && teaserQuestionsAnswered >= TEASER_LIMIT) {
      setShowTeaserLimitModal(true);
    }
  }, [isTeaserMode, teaserQuestionsAnswered]);
  
  // Update localStorage when teaser count changes
  useEffect(() => {
    if (isTeaserMode) {
      localStorage.setItem('ztvlive_teaser_count', teaserQuestionsAnswered.toString());
    }
  }, [isTeaserMode, teaserQuestionsAnswered]);
  
  // Connection state
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const wsRef = useRef(null);
  
  // Auth state - only needed for prize claims
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  
  // Game state - SYNCED across all platforms
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [translatedQuestion, setTranslatedQuestion] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [batchTimeRemaining, setBatchTimeRemaining] = useState(600);
  const [batchNumber, setBatchNumber] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);  // Total players (real + AI)
  
  // Answer state
  const [answer, setAnswer] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);
  const [myAnswer, setMyAnswer] = useState(null);
  const [samePercent, setSamePercent] = useState(0);
  const [sameCount, setSameCount] = useState(0);
  
  // Results state
  const [showingResults, setShowingResults] = useState(false);
  const [topAnswers, setTopAnswers] = useState([]);
  const [translatedTopAnswers, setTranslatedTopAnswers] = useState([]);
  const [myResult, setMyResult] = useState(null);
  
  // Player stats
  const [score, setScore] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  
  // Batch end state
  const [showBatchEnd, setShowBatchEnd] = useState(false);
  const [isWinner, setIsWinner] = useState(false);
  const [showClaimPrize, setShowClaimPrize] = useState(false);
  const [claimEmail, setClaimEmail] = useState("");
  const [claiming, setClaiming] = useState(false);
  
  // AI Voice-Over state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isHostSpeaking, setIsHostSpeaking] = useState(false);
  const audioRef = useRef(null);
  const hasWelcomedRef = useRef(false); // Track if we've already welcomed this session
  const playVoiceOverRef = useRef(null); // Ref for voice function to use in callbacks

  // Translate question when it changes or language changes
  useEffect(() => {
    const doTranslate = async () => {
      if (currentQuestion) {
        const translated = await translateQuestion(currentQuestion);
        setTranslatedQuestion(translated);
      } else {
        setTranslatedQuestion(null);
      }
    };
    doTranslate();
  }, [currentQuestion, language, translateQuestion]);

  // Translate top answers when results come in
  useEffect(() => {
    const translateAnswers = async () => {
      if (topAnswers.length > 0 && language !== 'en') {
        try {
          const translated = await Promise.all(
            topAnswers.map(async (ans) => {
              const translatedAnswer = await translateAnswer(ans.answer, 'en');
              return { ...ans, displayAnswer: translatedAnswer };
            })
          );
          setTranslatedTopAnswers(translated);
        } catch (e) {
          // Fallback to original answers
          setTranslatedTopAnswers(topAnswers.map(a => ({ ...a, displayAnswer: a.answer })));
        }
      } else {
        setTranslatedTopAnswers(topAnswers.map(a => ({ ...a, displayAnswer: a.answer })));
      }
    };
    translateAnswers();
  }, [topAnswers, language, translateAnswer]);

  // Helper to detect device type
  const getDeviceType = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
      return 'mobile';
    }
    if (/smart-tv|googletv|appletv|hbbtv|pov_tv|netcast|roku|viera/i.test(ua)) {
      return 'tv';
    }
    return 'desktop';
  };

  // Get/create player ID and register with backend
  useEffect(() => {
    let pid = localStorage.getItem('ztvlive_survey_player');
    if (!pid) {
      pid = 'player_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ztvlive_survey_player', pid);
    }
    setPlayerId(pid);
    
    // Register player with backend (send device info)
    const registerPlayer = async () => {
      try {
        // Try to get location from IP (using free API)
        let country = 'Unknown';
        let city = null;
        try {
          const geoRes = await fetch('https://ipapi.co/json/', { timeout: 3000 });
          if (geoRes.ok) {
            const geo = await geoRes.json();
            country = geo.country_name || geo.country || 'Unknown';
            city = geo.city;
          }
        } catch (e) {
          // Geolocation failed, continue without it
        }
        
        await fetch(`${API}/api/live-survey/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_id: pid,
            device_type: getDeviceType(),
            user_agent: navigator.userAgent,
            country: country,
            city: city
          })
        });
      } catch (e) {
        // Silent fail - game will still work
      }
    };
    
    registerPlayer();
    
    // Check auth status (for prize claims only)
    const storedUser = localStorage.getItem('ztvlive_user');
    const token = localStorage.getItem('token');
    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch (e) {
        setIsAuthenticated(false);
      }
    }
  }, []);

  // Get random message from category
  const getRandomMessage = (category) => {
    const messages = VOICE_MESSAGES[category];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  // Play AI Voice-Over using TTS API - with language support
  const playVoiceOver = useCallback(async (text) => {
    if (!soundEnabled) return;
    
    try {
      setIsHostSpeaking(true);
      // Speed 0.95 for more natural, excited delivery
      // Pass language for translation
      const res = await axios.post(`${API}/api/game-show/tts`, { 
        text, 
        speed: 0.95,
        lang: language // TTS will speak in user's language
      });
      
      if (res.data.audio_base64) {
        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio_base64}`);
        audioRef.current = audio;
        audio.volume = 0.85;
        audio.onended = () => setIsHostSpeaking(false);
        audio.onerror = () => setIsHostSpeaking(false);
        
        // Handle autoplay restriction gracefully
        audio.play().catch(() => {
          // Browser blocked autoplay - user needs to interact first
          setIsHostSpeaking(false);
        });
      } else {
        setIsHostSpeaking(false);
      }
    } catch (error) {
      console.error("TTS error:", error);
      setIsHostSpeaking(false);
    }
  }, [soundEnabled, language]);

  // Keep ref updated for use in callbacks
  useEffect(() => {
    playVoiceOverRef.current = playVoiceOver;
  }, [playVoiceOver]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (!playerId || wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/live-survey/ws/${playerId}`);
    
    ws.onopen = () => {
      console.log('[Survey] Connected');
      setConnected(true);
      
      // Play welcome message only once per session
      if (!hasWelcomedRef.current) {
        hasWelcomedRef.current = true;
        const welcomeMsg = getRandomMessage('welcome');
        setTimeout(() => playVoiceOver(welcomeMsg), 500);
      }
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleGameUpdate(data);
    };
    
    ws.onclose = () => {
      console.log('[Survey] Disconnected');
      setConnected(false);
      setTimeout(connectWebSocket, 3000);
    };
    
    wsRef.current = ws;
  }, [playerId, playVoiceOver]);

  useEffect(() => {
    if (playerId) connectWebSocket();
    return () => wsRef.current?.close();
  }, [playerId, connectWebSocket]);

  // Handle game updates - SYNCED across all platforms
  const handleGameUpdate = (data) => {
    console.log('[Survey] Event:', data.event || data.type);
    
    switch (data.event || data.type) {
      case 'connected':
      case 'new_question':
        setCurrentQuestion(data.question);
        setTimeRemaining(data.time_remaining);
        setBatchTimeRemaining(data.batch_time_remaining);
        setBatchNumber(data.batch_number);
        setTotalAnswers(data.total_answers || 0);
        setPlayerCount(data.player_count || 0);  // Synced player count
        setShowingResults(false);
        setTopAnswers([]);
        setAnswer("");
        setHasAnswered(false);
        setMyAnswer(null);
        setMyResult(null);
        setSamePercent(0);
        setShowBatchEnd(false);
        
        if (data.session) {
          setScore(data.session.score || 0);
          setQuestionsAnswered(data.session.questions_answered || 0);
        }
        break;
        
      case 'answer_update':
        setTotalAnswers(data.total_answers || 0);
        setPlayerCount(data.player_count || playerCount);  // Sync player count
        break;
        
      case 'answer_confirmed':
        setHasAnswered(true);
        setMyAnswer(data.answer);
        setSamePercent(data.same_percent);
        setSameCount(data.same_count);
        toast.success(`Answer submitted! ${data.same_percent}% chose the same`);
        break;
        
      case 'results':
        setShowingResults(true);
        setTopAnswers(data.top_answers || []);
        
        if (data.last_results?.player_results?.[playerId]) {
          const result = data.last_results.player_results[playerId];
          setMyResult(result);
          
          if (result.won_point) {
            setScore(prev => prev + 1);
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
          }
          setQuestionsAnswered(prev => prev + 1);
        }
        break;
        
      case 'batch_end':
        setShowBatchEnd(true);
        const winners = data.winners || [];
        const amWinner = winners.some(w => w.player_id === playerId);
        setIsWinner(amWinner);
        
        if (amWinner) {
          confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
          setShowClaimPrize(true);
        }
        
        // Play batch end voice message (friendly prompt to keep playing)
        setTimeout(() => {
          const batchEndMsg = getRandomMessage('batchEnd');
          if (playVoiceOverRef.current) playVoiceOverRef.current(batchEndMsg);
        }, 2000);
        break;
        
      case 'new_batch':
        setShowBatchEnd(false);
        setShowClaimPrize(false);
        setScore(0);
        setQuestionsAnswered(0);
        toast.info('New game starting!');
        
        // Play new batch voice message
        const newBatchMsg = getRandomMessage('newBatch');
        if (playVoiceOverRef.current) playVoiceOverRef.current(newBatchMsg);
        break;
        
      case 'heartbeat':
      case 'pong':
        setTimeRemaining(data.time_remaining);
        setBatchTimeRemaining(data.batch_time_remaining);
        if (data.total_answers) setTotalAnswers(data.total_answers);
        if (data.player_count) setPlayerCount(data.player_count);  // Sync player count
        if (data.same_percent !== undefined) setSamePercent(data.same_percent);
        break;
    }
  };

  // Local countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
      setBatchTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Share state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Share game link with multiple options
  const shareGame = async () => {
    setShowShareModal(true);
  };

  const shareViaNative = async () => {
    const shareUrl = 'https://www.ztvlivestream.com/play';
    const shareText = 'Join me on ZTVLIVE! Play the live survey game and win prizes! 🎮🏆 #ZTVLIVE';
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ZTVLIVE - Live Survey Game',
          text: shareText,
          url: shareUrl
        });
        toast.success('Shared successfully!');
        setShowShareModal(false);
      } catch (e) {
        if (e.name !== 'AbortError') {
          copyLink();
        }
      }
    } else {
      copyLink();
    }
  };

  const copyLink = () => {
    const shareUrl = 'https://www.ztvlivestream.com/play';
    const shareText = 'Join me on ZTVLIVE! Play the live survey game and win prizes! 🎮🏆 #ZTVLIVE';
    navigator.clipboard?.writeText(`${shareText} ${shareUrl}`);
    toast.success('Link copied to clipboard!');
  };

  const shareViaEmail = async () => {
    if (!shareEmail || sendingEmail) return;
    
    setSendingEmail(true);
    try {
      await axios.post(`${API}/api/social-game/share-email`, {
        to_email: shareEmail,
        from_name: user?.name || 'A Friend',
        game_url: 'https://www.ztvlivestream.com/play'
      });
      toast.success('Invite email sent!');
      setShareEmail('');
      setShowShareModal(false);
    } catch (e) {
      toast.error('Failed to send email');
    }
    setSendingEmail(false);
  };

  const shareToSocial = (platform) => {
    const shareUrl = encodeURIComponent('https://www.ztvlivestream.com/play');
    const shareText = encodeURIComponent('Join me on ZTVLIVE! Play the live survey game and win real prizes! 🎮🏆 #ZTVLIVE');
    
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareText}`,
      whatsapp: `https://wa.me/?text=${shareText}%20${shareUrl}`,
      telegram: `https://t.me/share/url?url=${shareUrl}&text=${shareText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      reddit: `https://reddit.com/submit?url=${shareUrl}&title=${shareText}`,
    };
    
    window.open(urls[platform], '_blank', 'width=600,height=400');
    toast.success(`Opening ${platform}...`);
  };

  const addToHomeScreen = () => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      toast.info('App already installed!');
      return;
    }
    
    // For iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      toast.info('Tap the Share button, then "Add to Home Screen"', { duration: 5000 });
      return;
    }
    
    // For Android/Desktop - trigger the install prompt if available
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      window.deferredPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
          toast.success('App installed!');
        }
        window.deferredPrompt = null;
      });
    } else {
      // Fallback - show instructions
      toast.info('Bookmark this page for quick access!', { duration: 5000 });
    }
  };

  // Submit answer
  const submitAnswer = () => {
    if (!answer.trim() || hasAnswered || timeRemaining < 5) return;
    
    // Check teaser limit before allowing answer
    if (isTeaserMode && teaserQuestionsAnswered >= TEASER_LIMIT) {
      setShowTeaserLimitModal(true);
      return;
    }
    
    // Track answer submission with Meta Pixel
    trackCustomEvent('GameAnswerSubmitted', {
      question: currentQuestion?.substring(0, 50),
      answer_length: answer.trim().length
    });
    
    // Increment teaser count if in teaser mode
    if (isTeaserMode) {
      setTeaserQuestionsAnswered(prev => prev + 1);
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Include language for cross-language answer normalization
      wsRef.current.send(JSON.stringify({ 
        type: 'answer', 
        answer: answer.trim(),
        lang: language // Send player's language for answer matching
      }));
    }
  };

  // Claim prize
  const claimPrize = async () => {
    const emailToUse = claimEmail || user?.email;
    if (!emailToUse || claiming) return;
    
    // Track prize claim attempt with Meta Pixel
    trackPixelEvent('InitiateCheckout', {
      content_name: 'Prize Claim',
      content_category: 'Game Show Prize',
      value: 10,
      currency: 'USD'
    });
    
    setClaiming(true);
    try {
      const res = await fetch(`${API}/api/live-survey/claim-prize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, email: emailToUse })
      });
      
      if (res.ok) {
        // Track successful prize claim
        trackPixelEvent('Purchase', {
          content_name: 'Prize Won',
          content_category: 'Game Show Prize',
          value: 10,
          currency: 'USD'
        });
        toast.success('Prize claimed! Check your email.');
        setShowClaimPrize(false);
        setShowBatchEnd(false);
      } else {
        toast.error('Failed to claim prize');
      }
    } catch (e) {
      toast.error('Error claiming prize');
    }
    setClaiming(false);
  };

  // Format time
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`${embedded ? '' : 'h-full'} bg-gradient-to-br from-zinc-900 via-purple-900/20 to-zinc-900 text-white overflow-y-auto`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-lg mx-auto p-3 sm:p-4 pb-20 sm:pb-24">
        
        {/* Header - Compact game info */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center">
              <span className="text-sm sm:text-base font-black">Z</span>
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold">{t('game_title')}</h1>
              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-yellow-400">
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                {t('grand_jackpot')}
                {isHostSpeaking && (
                  <span className="ml-1 text-purple-400 animate-pulse">🎤</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Language Selector, Score, Sound Toggle, and Share */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Language Selector */}
            <LanguageSelector className="h-6 sm:h-7 text-[10px] sm:text-xs px-1 py-0" />
            
            {/* Share Button */}
            <button
              onClick={shareGame}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center bg-pink-600/50 text-pink-300 hover:bg-pink-500/50 transition-colors"
              data-testid="share-btn-header"
            >
              <Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
            
            {/* Sound Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (audioRef.current && soundEnabled) {
                  audioRef.current.pause();
                  setIsHostSpeaking(false);
                }
              }}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-colors ${
                soundEnabled ? 'bg-purple-600/50 text-purple-300' : 'bg-zinc-700/50 text-zinc-500'
              }`}
              data-testid="sound-toggle"
              title={soundEnabled ? 'Mute AI Voice' : 'Unmute AI Voice'}
            >
              {soundEnabled ? <Volume2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <VolumeX className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
            </button>
            
            <div className="text-right ml-1">
              <div className="text-[9px] sm:text-[10px] text-zinc-400">{t('score')}</div>
              <div className="text-base sm:text-lg font-bold text-yellow-400">{score}</div>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Batch Timer */}
        <div className="bg-zinc-800/50 rounded-lg p-1.5 sm:p-2 mb-3 sm:mb-4 flex items-center justify-between">
          <span className="text-xs sm:text-sm text-zinc-400">{t('game_ends_in')}</span>
          <span className={`font-mono font-bold text-sm sm:text-base ${batchTimeRemaining < 60 ? 'text-red-400' : 'text-white'}`}>
            {formatTime(batchTimeRemaining)}
          </span>
        </div>

        {/* Question Timer */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs sm:text-sm text-zinc-400">{t('answer_in')}</span>
            <span className={`text-xl sm:text-2xl font-mono font-bold ${timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {timeRemaining}s
            </span>
          </div>
          <div className="h-1.5 sm:h-2 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${timeRemaining <= 10 ? 'bg-red-500' : 'bg-purple-500'}`}
              style={{ width: `${(timeRemaining / 50) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card - Shows translated question - LARGER for clarity */}
        {currentQuestion && (
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-900/60 to-pink-900/60 rounded-xl sm:rounded-2xl p-5 sm:p-8 mb-4 sm:mb-5 border-2 border-purple-500/40 shadow-lg shadow-purple-500/20"
          >
            <div className="text-center mb-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm bg-purple-500/40 px-3 py-1 sm:py-1.5 rounded-full font-medium">
                {totalAnswers.toLocaleString()} {t('answers')}
              </span>
              <span className="text-xs sm:text-sm bg-green-500/40 px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1.5 font-medium">
                <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                {playerCount.toLocaleString()} {t('players')}
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl md:text-3xl font-bold text-center leading-relaxed">
              {translatedQuestion || currentQuestion}
            </h2>
          </motion.div>
        )}

        {/* Answer Input or Results */}
        <AnimatePresence mode="wait">
          {showingResults ? (
            /* Results View */
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <h3 className="text-center text-lg font-bold text-yellow-400">
                {t('top_answers')}
              </h3>
              
              {(translatedTopAnswers.length > 0 ? translatedTopAnswers : topAnswers).map((ans, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`rounded-xl p-4 ${
                    idx === 0 ? 'bg-yellow-900/40 border-2 border-yellow-500' :
                    'bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-gray-400 text-black' :
                        idx === 2 ? 'bg-orange-500 text-black' :
                        'bg-zinc-700'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold capitalize">{ans.displayAnswer || ans.answer}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{ans.percent}%</div>
                      <div className="text-xs text-zinc-400">{ans.count} {t('votes')}</div>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Your Result */}
              {myResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl p-4 mt-4 ${
                    myResult.won_point ? 'bg-green-900/40 border-2 border-green-500' : 'bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-zinc-400">{t('your_answer')}</div>
                      <div className="font-bold capitalize">{myResult.your_answer}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">{myResult.your_percent}%</div>
                      {myResult.won_point ? (
                        <div className="text-green-400 text-sm flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> {t('point_won')}
                        </div>
                      ) : (
                        <div className="text-red-400 text-sm flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> {t('try_again')}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div className="text-center text-sm text-zinc-400 mt-4">
                {t('next_question')}
              </div>
            </motion.div>
          ) : (
            /* Answer Input */
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {!hasAnswered ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder={t('type_answer')}
                      className="flex-1 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                      maxLength={50}
                      disabled={timeRemaining < 5}
                      onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                    />
                    <Button
                      onClick={submitAnswer}
                      disabled={!answer.trim() || timeRemaining < 5}
                      className="bg-purple-600 hover:bg-purple-500 px-6"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  </div>
                  
                  {timeRemaining < 5 && (
                    <p className="text-center text-red-400 text-sm">
                      {t('too_late')}
                    </p>
                  )}
                </>
              ) : (
                /* After answering - show live stats */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-900/30 border border-green-500/50 rounded-xl p-5 text-center"
                >
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <div className="text-lg font-bold mb-1">{t('answer_locked')}</div>
                  <div className="text-2xl font-bold text-white mb-2 capitalize">
                    "{myAnswer}"
                  </div>
                  
                  <div className="bg-zinc-800/50 rounded-lg p-4 mt-4">
                    <div className="text-sm text-zinc-400 mb-1">{t('same_answer')}</div>
                    <div className="text-4xl font-black text-purple-400">
                      {samePercent}%
                    </div>
                    <div className="text-sm text-zinc-500">
                      ({sameCount} {t('people')})
                    </div>
                  </div>
                  
                  <p className="text-sm text-zinc-400 mt-3">
                    {t('waiting_results')}
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Footer */}
        <div className="mt-4 sm:mt-6 flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm text-zinc-400">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{totalAnswers} {t('answers')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{questionsAnswered} {t('played')}</span>
          </div>
        </div>

        {/* Batch End Modal */}
        <AnimatePresence>
          {showBatchEnd && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className={`rounded-2xl p-8 text-center max-w-md ${
                  isWinner 
                    ? 'bg-gradient-to-br from-yellow-900 to-orange-900 border-2 border-yellow-500'
                    : 'bg-zinc-900 border border-zinc-700'
                }`}
              >
                {isWinner ? (
                  <>
                    <div className="text-6xl mb-4">🏆</div>
                    <h2 className="text-3xl font-black text-yellow-400 mb-2">
                      {t('winner')}
                    </h2>
                    <p className="text-white mb-4">
                      {t('your_score')}: {score} {t('points')}
                    </p>
                    
                    {/* Check if user is logged in before showing claim form */}
                    {!isAuthenticated ? (
                      <div className="space-y-3">
                        <p className="text-sm text-zinc-300 mb-4">
                          {t('sign_in_claim')}
                        </p>
                        <Button
                          onClick={() => navigate('/login?redirect=/play&claim=true')}
                          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                          data-testid="claim-login-btn"
                        >
                          <LogIn className="w-4 h-4 mr-2" />
                          {t('sign_in_claim')}
                        </Button>
                        <Button
                          onClick={() => setShowBatchEnd(false)}
                          variant="outline"
                          className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                        >
                          {t('continue_playing')}
                        </Button>
                      </div>
                    ) : showClaimPrize ? (
                      <div className="space-y-3">
                        <p className="text-sm text-zinc-300">
                          Confirm your email to receive your prize:
                        </p>
                        <Input
                          type="email"
                          value={claimEmail || user?.email || ''}
                          onChange={(e) => setClaimEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="bg-zinc-800 border-zinc-600"
                        />
                        <Button
                          onClick={claimPrize}
                          disabled={!(claimEmail || user?.email) || claiming}
                          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                        >
                          {claiming ? 'Claiming...' : t('claim_prize')}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => {
                          setClaimEmail(user?.email || '');
                          setShowClaimPrize(true);
                        }}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-8"
                      >
                        {t('claim_prize')}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">⏱️</div>
                    <h2 className="text-2xl font-bold mb-2">{t('game_over')}</h2>
                    <p className="text-zinc-400 mb-4">
                      {t('your_score')}: {score} {t('points')}<br/>
                      {t('better_luck')}
                    </p>
                    <Button
                      onClick={() => setShowBatchEnd(false)}
                      className="bg-purple-600 hover:bg-purple-500"
                    >
                      {t('continue_playing')}
                    </Button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share Button - Fixed bottom - Only show when embedded (not on /play page which has its own buttons) */}
        {embedded && (
          <div className="fixed bottom-14 sm:bottom-12 right-3 sm:right-4 z-20">
            <Button
              onClick={shareGame}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full shadow-lg shadow-purple-500/30 text-xs sm:text-sm px-3 py-1.5 h-auto"
              data-testid="share-game-btn"
            >
              <Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5" />
              {t('share')}
            </Button>
          </div>
        )}

        {/* Share Modal */}
        <AnimatePresence>
          {showShareModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowShareModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 rounded-2xl p-6 max-w-md w-full border border-zinc-700"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Share & Save</h3>
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>

                {/* Social Media Share Buttons */}
                <div className="mb-6">
                  <p className="text-sm text-zinc-400 mb-3">Share on Social Media</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => shareToSocial('twitter')}
                      className="flex flex-col items-center gap-1 p-3 bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 rounded-xl transition-colors"
                    >
                      <Twitter className="w-6 h-6 text-[#1DA1F2]" />
                      <span className="text-xs text-zinc-300">Twitter</span>
                    </button>
                    <button
                      onClick={() => shareToSocial('facebook')}
                      className="flex flex-col items-center gap-1 p-3 bg-[#4267B2]/20 hover:bg-[#4267B2]/30 rounded-xl transition-colors"
                    >
                      <Facebook className="w-6 h-6 text-[#4267B2]" />
                      <span className="text-xs text-zinc-300">Facebook</span>
                    </button>
                    <button
                      onClick={() => shareToSocial('whatsapp')}
                      className="flex flex-col items-center gap-1 p-3 bg-[#25D366]/20 hover:bg-[#25D366]/30 rounded-xl transition-colors"
                    >
                      <MessageCircle className="w-6 h-6 text-[#25D366]" />
                      <span className="text-xs text-zinc-300">WhatsApp</span>
                    </button>
                    <button
                      onClick={() => shareToSocial('telegram')}
                      className="flex flex-col items-center gap-1 p-3 bg-[#0088cc]/20 hover:bg-[#0088cc]/30 rounded-xl transition-colors"
                    >
                      <Send className="w-6 h-6 text-[#0088cc]" />
                      <span className="text-xs text-zinc-300">Telegram</span>
                    </button>
                    <button
                      onClick={() => shareToSocial('linkedin')}
                      className="flex flex-col items-center gap-1 p-3 bg-[#0077B5]/20 hover:bg-[#0077B5]/30 rounded-xl transition-colors"
                    >
                      <Linkedin className="w-6 h-6 text-[#0077B5]" />
                      <span className="text-xs text-zinc-300">LinkedIn</span>
                    </button>
                    <button
                      onClick={() => shareToSocial('reddit')}
                      className="flex flex-col items-center gap-1 p-3 bg-[#FF4500]/20 hover:bg-[#FF4500]/30 rounded-xl transition-colors"
                    >
                      <TrendingUp className="w-6 h-6 text-[#FF4500]" />
                      <span className="text-xs text-zinc-300">Reddit</span>
                    </button>
                  </div>
                </div>

                {/* Email Invite */}
                <div className="mb-6">
                  <p className="text-sm text-zinc-400 mb-2">Invite by Email</p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="friend@email.com"
                      className="flex-1 bg-zinc-800 border-zinc-700"
                    />
                    <Button
                      onClick={shareViaEmail}
                      disabled={!shareEmail || sendingEmail}
                      className="bg-purple-600 hover:bg-purple-500"
                    >
                      {sendingEmail ? '...' : <Mail className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Copy Link & Save */}
                <div className="space-y-2">
                  <button
                    onClick={() => { copyLink(); setShowShareModal(false); }}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                  >
                    <Copy className="w-5 h-5 text-zinc-400" />
                    <span className="text-white">Copy Link</span>
                  </button>
                  
                  <button
                    onClick={addToHomeScreen}
                    className="w-full flex items-center justify-center gap-2 p-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl transition-colors"
                  >
                    <Smartphone className="w-5 h-5 text-white" />
                    <span className="text-white font-semibold">Save to Home Screen</span>
                  </button>
                </div>

                {/* Follow Us Section */}
                <div className="mt-6 pt-4 border-t border-zinc-700">
                  <p className="text-sm text-zinc-400 mb-3 text-center">Follow ZTVLIVE</p>
                  <div className="flex justify-center gap-4">
                    <a href="https://twitter.com/ztvlive" target="_blank" rel="noopener noreferrer" 
                       className="p-2 bg-zinc-800 hover:bg-[#1DA1F2]/30 rounded-full transition-colors">
                      <Twitter className="w-5 h-5 text-[#1DA1F2]" />
                    </a>
                    <a href="https://facebook.com/ztvlive" target="_blank" rel="noopener noreferrer"
                       className="p-2 bg-zinc-800 hover:bg-[#4267B2]/30 rounded-full transition-colors">
                      <Facebook className="w-5 h-5 text-[#4267B2]" />
                    </a>
                    <a href="https://instagram.com/ztvlive" target="_blank" rel="noopener noreferrer"
                       className="p-2 bg-zinc-800 hover:bg-[#E4405F]/30 rounded-full transition-colors">
                      <svg className="w-5 h-5 text-[#E4405F]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </a>
                    <a href="https://tiktok.com/@ztvlive" target="_blank" rel="noopener noreferrer"
                       className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                      </svg>
                    </a>
                    <a href="https://youtube.com/@ztvlive" target="_blank" rel="noopener noreferrer"
                       className="p-2 bg-zinc-800 hover:bg-[#FF0000]/30 rounded-full transition-colors">
                      <svg className="w-5 h-5 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Teaser Mode Limit Modal */}
        <AnimatePresence>
          {showTeaserLimitModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
              data-testid="teaser-limit-modal"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gradient-to-br from-zinc-900 via-purple-900/30 to-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-purple-500/30 shadow-2xl"
              >
                <div className="text-center">
                  {/* Trophy Icon */}
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                    <Trophy className="w-10 h-10 text-white" />
                  </div>
                  
                  <h2 className="text-2xl font-bold mb-2">{t('youre_on_fire') || "You're On Fire!"}</h2>
                  <p className="text-zinc-400 mb-4">
                    {t('teaser_limit_message') || `You've played ${TEASER_LIMIT} questions! Continue playing for FREE on the full ZTVLIVE experience.`}
                  </p>
                  
                  {/* Stats */}
                  <div className="flex justify-center gap-4 mb-6">
                    <div className="bg-zinc-800/50 rounded-lg px-4 py-2">
                      <div className="text-2xl font-bold text-yellow-400">{score}</div>
                      <div className="text-xs text-zinc-500">{t('points')}</div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg px-4 py-2">
                      <div className="text-2xl font-bold text-green-400">{TEASER_LIMIT}</div>
                      <div className="text-xs text-zinc-500">{t('played')}</div>
                    </div>
                  </div>
                  
                  {/* CTA Button */}
                  <a
                    href="https://www.ztvlivestream.com/play"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all transform hover:scale-105 mb-3"
                    data-testid="continue-playing-btn"
                    onClick={() => {
                      // Track conversion
                      trackCustomEvent('TeaserLimitReached', { score, questions: TEASER_LIMIT });
                    }}
                  >
                    {t('continue_playing') || 'Continue Playing FREE'}
                  </a>
                  
                  <p className="text-xs text-zinc-500">
                    {t('teaser_prize_info') || 'Win real prizes - DoorDash, Cash & more!'}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
