import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { 
  Users, Trophy, Clock, Star, Gift, Zap, Crown, Play,
  Timer, TrendingUp, Tv, Radio
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * ROKU STREAM PAGE - Full Broadcast Experience
 * 
 * Designed specifically for RTMP streaming to Roku/Fire TV via headless Chromium
 * 
 * Features:
 * - Fullscreen layout with NO browser chrome (kiosk mode)
 * - YouTube video embed (main content - 70% of screen)
 * - Game overlay panel (right side - 30%)
 * - Persistent QR code (bottom-right corner, always visible)
 * - TV-safe zones (5% margin from edges)
 * - Auto-playing video with no user interaction required
 * - Live vote tallies and leaderboard
 * - No URLs, domain names, or sensitive info displayed
 */

// Prize tiers
const PRIZE_TIERS = {
  1: { amount: "$5", color: "from-green-500 to-emerald-600", label: "Round 1" },
  2: { amount: "$10", color: "from-blue-500 to-cyan-600", label: "Round 2" },
  3: { amount: "$15", color: "from-yellow-500 to-orange-500", label: "Grand Finale" }
};

// News ticker messages
const TICKER_MESSAGES = [
  "SCAN THE QR CODE TO PLAY ALONG ON YOUR PHONE!",
  "WIN REAL PRIZES - $5, $10, $15 GIFT CARDS!",
  "YOUR PHONE IS YOUR CONTROLLER!",
  "MATCH THE MAJORITY TO WIN BONUS POINTS!",
  "3 ROUNDS - 3 WINNERS - 3 CHANCES TO WIN!",
];

// Sample leaderboard (replaced by real data when available)
const SAMPLE_LEADERBOARD = [
  { name: "TriviaKing", score: 1250, rank: 1 },
  { name: "QuizMaster", score: 1100, rank: 2 },
  { name: "BrainStorm", score: 950, rank: 3 },
  { name: "GameChamp", score: 800, rank: 4 },
  { name: "WinnerPro", score: 750, rank: 5 },
];

// Extract YouTube video ID from embed URL
const getYouTubeVideoId = (url) => {
  if (!url) return null;
  const match = url.match(/youtube\.com\/embed\/([^?]+)/) || url.match(/youtube\.com\/watch\?v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
  return match ? match[1] : null;
};

export default function RokuStreamPage() {
  // Video state
  const [currentContent, setCurrentContent] = useState(null);
  const [ytApiReady, setYtApiReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const playerRef = useRef(null);
  const currentVideoIdRef = useRef(null);

  // Show state
  const [showStatus, setShowStatus] = useState(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTimeLeft, setRoundTimeLeft] = useState(600);
  const [playerCount, setPlayerCount] = useState(0);
  
  // Game state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [votes, setVotes] = useState({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [leaderboard, setLeaderboard] = useState(SAMPLE_LEADERBOARD);
  const [gameActive, setGameActive] = useState(false);
  
  // QR Code
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  
  // Ticker
  const [tickerIndex, setTickerIndex] = useState(0);
  
  // Winner animation state
  const [showWinner, setShowWinner] = useState(false);
  const [winnerName, setWinnerName] = useState("");

  // Generate QR code - points to play page (no domain shown on screen)
  useEffect(() => {
    const joinUrl = `${window.location.origin}/play`;
    QRCode.toDataURL(joinUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrCodeUrl);
  }, []);

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
      console.log('[RokuStream] YouTube API Ready');
    };
  }, []);

  // Fetch current content from TV sync
  const fetchContent = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/tv/sync`);
      const data = res.data;
      
      const newContent = {
        id: data.video_id || data.now_playing?.id,
        title: data.title || data.now_playing?.title,
        video_url: data.video_url || data.now_playing?.video_url,
        thumbnail: data.thumbnail || data.now_playing?.thumbnail,
        duration_seconds: data.now_playing?.duration_seconds || 300,
      };
      
      setCurrentContent(newContent);
      setVideoLoading(false);
      return newContent;
    } catch (err) {
      console.error('[RokuStream] Failed to fetch content:', err);
      setVideoLoading(false);
      return null;
    }
  }, []);

  // Initial content fetch
  useEffect(() => {
    fetchContent();
    // Refresh content every 30 seconds
    const interval = setInterval(fetchContent, 30000);
    return () => clearInterval(interval);
  }, [fetchContent]);

  // Initialize YouTube player when content and API are ready
  useEffect(() => {
    if (!currentContent || !ytApiReady) return;
    
    const videoId = getYouTubeVideoId(currentContent.video_url);
    if (!videoId) return;
    
    // Skip if same video already playing
    if (videoId === currentVideoIdRef.current && playerRef.current) return;
    
    currentVideoIdRef.current = videoId;
    
    // Destroy existing player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
        playerRef.current = null;
      } catch (e) {}
    }
    
    const initPlayer = () => {
      const container = document.getElementById('roku-youtube-player');
      if (!container) {
        setTimeout(initPlayer, 200);
        return;
      }
      
      try {
        playerRef.current = new window.YT.Player('roku-youtube-player', {
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            mute: 0,               // Unmuted for broadcast
            controls: 0,           // No YouTube controls
            rel: 0,                // No related videos
            modestbranding: 1,     // Minimal branding
            showinfo: 0,           // No video info
            iv_load_policy: 3,     // No annotations
            disablekb: 1,          // No keyboard shortcuts
            fs: 0,                 // No fullscreen button
            playsinline: 1,        // Play inline
            enablejsapi: 1,
            origin: window.location.origin,
            cc_load_policy: 0,     // No captions
          },
          events: {
            onReady: (event) => {
              console.log('[RokuStream] Player ready');
              event.target.setVolume(50);
              event.target.playVideo();
              setIsPlaying(true);
              setVideoLoading(false);
            },
            onStateChange: (event) => {
              if (event.data === 0) {
                // Video ended - fetch next
                fetchContent();
              } else if (event.data === 1) {
                setIsPlaying(true);
              } else if (event.data === 2) {
                // Paused - auto resume for 24/7
                event.target.playVideo();
              }
            },
            onError: (event) => {
              console.error('[RokuStream] Player error:', event.data);
              // Auto-skip to next video
              setTimeout(fetchContent, 2000);
            }
          }
        });
      } catch (e) {
        console.error('[RokuStream] Player init error:', e);
      }
    };
    
    setTimeout(initPlayer, 100);
  }, [currentContent?.id, ytApiReady, fetchContent]);

  // Fetch show status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API}/api/bigscreen-show/status`);
        setShowStatus(res.data);
        if (res.data.is_live) {
          setGameActive(true);
          if (res.data.current_round) setCurrentRound(res.data.current_round);
          if (res.data.time_remaining_seconds) setRoundTimeLeft(res.data.time_remaining_seconds);
          if (res.data.players_count) setPlayerCount(res.data.players_count);
        }
      } catch (e) {
        console.log("[RokuStream] Status fetch error:", e);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch current game
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const res = await axios.get(`${API}/api/game-show/active`);
        if (res.data && res.data.game_id) {
          setGameActive(true);
          setCurrentQuestion({
            question: res.data.question,
            options: res.data.options
          });
          setVotes(res.data.votes || {});
          setTotalVotes(res.data.total_votes || 0);
          setPlayerCount(prev => Math.max(prev, res.data.total_votes || 0));
        } else {
          setCurrentQuestion(null);
        }
      } catch (e) {
        // No active game - that's OK
      }
    };
    
    fetchGame();
    const interval = setInterval(fetchGame, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch leaderboard
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get(`${API}/api/game-analytics/leaderboard`);
        if (res.data.leaderboard && res.data.leaderboard.length > 0) {
          setLeaderboard(res.data.leaderboard.slice(0, 5));
        }
      } catch (e) {
        // Use sample data
      }
    };
    
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, []);

  // Round timer countdown
  useEffect(() => {
    if (!gameActive) return;
    const timer = setInterval(() => {
      setRoundTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [gameActive]);

  // Ticker rotation
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % TICKER_MESSAGES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Simulate player growth when game active
  useEffect(() => {
    if (!gameActive) return;
    const timer = setInterval(() => {
      setPlayerCount(prev => prev + Math.floor(Math.random() * 5));
    }, 4000);
    return () => clearInterval(timer);
  }, [gameActive]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get vote percentage
  const getVotePercent = (option) => {
    if (totalVotes === 0) return 0;
    return Math.round(((votes[option] || 0) / totalVotes) * 100);
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" data-testid="roku-stream-page">
      {/* Subtle animated background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-purple-600 rounded-full filter blur-[200px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-red-600 rounded-full filter blur-[200px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Main Content - TV Safe Zone (5% margin) */}
      <div className="relative z-10 h-full p-[3%] flex flex-col">
        
        {/* TOP BAR - Logo, Timer, Players */}
        <div className="flex items-center justify-between mb-3">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
              <span className="text-4xl font-black text-white">Z</span>
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">ZTVLIVE</h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <p className="text-lg text-red-400 font-semibold">LIVE 24/7</p>
              </div>
            </div>
          </div>

          {/* Game Info (only when active) */}
          {gameActive && (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-purple-400 text-sm font-semibold">ROUND</p>
                <p className="text-4xl font-black text-white">{currentRound}<span className="text-2xl text-zinc-500">/3</span></p>
              </div>
              <div className="bg-zinc-900/80 rounded-xl px-5 py-2 border border-purple-500/50">
                <div className="flex items-center gap-2">
                  <Timer className={`w-6 h-6 ${roundTimeLeft < 60 ? 'text-red-500 animate-pulse' : 'text-purple-400'}`} />
                  <span className={`text-3xl font-mono font-black ${roundTimeLeft < 60 ? 'text-red-500' : 'text-white'}`}>
                    {formatTime(roundTimeLeft)}
                  </span>
                </div>
              </div>
              <div className="bg-zinc-900/80 rounded-xl px-4 py-2 border border-zinc-700">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  <span className="text-2xl font-bold text-white">{playerCount.toLocaleString()}</span>
                </div>
                <p className="text-zinc-500 text-xs text-center">PLAYERS</p>
              </div>
            </div>
          )}
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex gap-4 min-h-0">
          
          {/* LEFT - Video Player (70%) */}
          <div className="flex-[7] flex flex-col min-h-0">
            {/* Video Container */}
            <div className="relative flex-1 bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl">
              {videoLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400 text-xl">Loading Stream...</p>
                  </div>
                </div>
              ) : (
                <div 
                  id="roku-youtube-player" 
                  className="absolute inset-0 w-full h-full"
                />
              )}
              
              {/* Live indicator overlay */}
              <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
                <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
                {currentContent?.title && (
                  <div className="bg-black/60 text-white px-3 py-1 rounded-full text-sm font-medium max-w-[400px] truncate">
                    {currentContent.title}
                  </div>
                )}
              </div>
            </div>

            {/* Game Question Overlay (below video when active) */}
            {gameActive && currentQuestion && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3"
              >
                {/* Prize Banner */}
                <div className={`bg-gradient-to-r ${PRIZE_TIERS[currentRound]?.color || 'from-purple-600 to-pink-600'} rounded-xl p-3 mb-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Gift className="w-8 h-8 text-white" />
                      <div>
                        <p className="text-white/80 text-sm">{PRIZE_TIERS[currentRound]?.label} Prize</p>
                        <p className="text-2xl font-black text-white">{PRIZE_TIERS[currentRound]?.amount} DoorDash</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Question */}
                <div className="bg-gradient-to-br from-purple-900/60 to-pink-900/60 rounded-xl p-4 mb-3 border border-purple-500/30">
                  <p className="text-2xl font-bold text-white text-center">
                    {currentQuestion.question}
                  </p>
                </div>

                {/* Vote Options - 2x2 Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {currentQuestion.options?.map((option, idx) => {
                    const percent = getVotePercent(option);
                    const isLeading = percent > 0 && percent >= Math.max(...currentQuestion.options.map(o => getVotePercent(o)));
                    
                    return (
                      <div
                        key={idx}
                        className={`relative overflow-hidden rounded-xl ${isLeading ? 'ring-2 ring-yellow-400' : ''}`}
                      >
                        <div className={`relative p-3 ${isLeading ? 'bg-yellow-600/20' : 'bg-zinc-800/60'}`}>
                          {/* Progress bar */}
                          <motion.div
                            className={`absolute inset-0 ${isLeading ? 'bg-yellow-500/20' : 'bg-purple-500/20'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.5 }}
                          />
                          
                          <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-8 h-8 bg-zinc-700/80 rounded-lg flex items-center justify-center text-lg font-bold text-white">
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span className="text-lg font-semibold text-white truncate max-w-[150px]">
                                {option}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {isLeading && <Crown className="w-5 h-5 text-yellow-400" />}
                              <span className="text-2xl font-black text-white">
                                {percent}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>

          {/* RIGHT - QR Code & Leaderboard (30%) */}
          <div className="flex-[3] flex flex-col gap-3 min-h-0">
            
            {/* QR CODE - ALWAYS VISIBLE */}
            <div className="bg-gradient-to-br from-purple-900/80 to-pink-900/80 rounded-2xl p-4 border border-purple-500/50 text-center">
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <p className="text-xl font-black text-yellow-400 mb-3 flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5" />
                  SCAN TO PLAY!
                  <Zap className="w-5 h-5" />
                </p>
              </motion.div>
              
              {qrCodeUrl && (
                <motion.div 
                  className="bg-white p-3 rounded-xl inline-block mb-3 shadow-xl"
                  animate={{ 
                    boxShadow: [
                      "0 0 15px 3px rgba(168, 85, 247, 0.3)",
                      "0 0 30px 8px rgba(168, 85, 247, 0.5)",
                      "0 0 15px 3px rgba(168, 85, 247, 0.3)"
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <img src={qrCodeUrl} alt="Scan to play" className="w-36 h-36" />
                </motion.div>
              )}
              
              <p className="text-base text-white font-semibold">
                Use your phone to vote!
              </p>
              <p className="text-purple-300 text-sm mt-1">
                Win <span className="text-yellow-400 font-bold">real prizes</span>!
              </p>
            </div>

            {/* LEADERBOARD */}
            <div className="flex-1 bg-zinc-900/80 rounded-2xl p-4 border border-zinc-700 overflow-hidden min-h-0">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
                <span className="text-lg font-black text-white">TOP PLAYERS</span>
              </div>
              
              <div className="space-y-2">
                {leaderboard.map((player, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      idx === 0 ? 'bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border border-yellow-500/50' :
                      idx === 1 ? 'bg-zinc-700/50 border border-zinc-600' :
                      idx === 2 ? 'bg-orange-900/30 border border-orange-500/30' :
                      'bg-zinc-800/50'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx === 0 ? 'bg-yellow-500 text-black' :
                      idx === 1 ? 'bg-zinc-400 text-black' :
                      idx === 2 ? 'bg-orange-500 text-black' :
                      'bg-zinc-700 text-white'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-white font-semibold text-sm truncate">
                      {player.name || player.username}
                    </span>
                    <span className="text-yellow-400 font-bold text-sm">
                      {(player.score || 0).toLocaleString()}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM TICKER */}
        <div className="mt-3 bg-gradient-to-r from-red-600 via-red-500 to-red-600 rounded-lg overflow-hidden">
          <motion.div 
            className="py-2 px-4 flex items-center justify-center"
            key={tickerIndex}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <span className="text-lg font-bold text-white">
              {TICKER_MESSAGES[tickerIndex]}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Winner Announcement Overlay */}
      <AnimatePresence>
        {showWinner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: 5 }}
                className="text-[120px] mb-4"
              >
                <Trophy className="w-32 h-32 text-yellow-400 mx-auto" />
              </motion.div>
              <p className="text-5xl font-black text-yellow-400 mb-4">
                WINNER!
              </p>
              <p className="text-3xl text-white font-bold">
                {winnerName}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
