import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Clock, Users, Trophy, Sparkles, Play, X, Volume2, VolumeX, Zap, Gift, Crown, Mic, RotateCcw, Star, GripVertical, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import QRCode from "qrcode";
import confetti from 'canvas-confetti';
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL || '';

// Detect if user is on mobile
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Auto-shuffle delay after question ends (ms)
const AUTO_SHUFFLE_DELAY = 4000;

// AI Host commentary templates
const HOST_LINES = {
  intro: [
    "50 seconds. One choice. Your phone is the controller. LET'S GET UNUSUAL!",
    "Welcome! Your vote decides EVERYTHING!",
    "It's time to play! Vote NOW!"
  ],
  during: [
    "{leader} is CRUSHING IT with {percent}%!",
    "OH WOW! {trailer} is making a COMEBACK!",
    "This is INSANE! Only {time} seconds left!",
    "Vote NOW! Every vote counts!",
    "{leader} holding strong but {trailer} is RIGHT THERE!",
    "The crowd is going WILD! {total} votes and counting!"
  ],
  final10: [
    "TEN SECONDS! THIS IS IT!",
    "FINAL COUNTDOWN! VOTE VOTE VOTE!",
    "IT'S NOW OR NEVER!"
  ],
  winner: [
    "{winner} WINS with {percent}%!",
    "AND THE WINNER IS... {winner}!",
    "{winner} takes the crown!"
  ],
  reward: [
    "You're a CHAMPION! Enter your email to claim your EXCLUSIVE reward!",
    "5 WINS! Drop your email for a special prize!",
    "Congratulations WINNER! Your reward is waiting!"
  ],
  tryAgain: [
    "So close! Keep playing to win rewards!",
    "Not this time, but you're getting better!",
    "Try again! Winners get amazing prizes!"
  ]
};

// Number of correct answers needed to win a reward
const WINS_NEEDED = 5;

export default function LiveAIShow({ isAdmin = false, onClose, isFullscreen = false, allowAnyoneToStart = true }) {
  const [phase, setPhase] = useState("idle"); // idle, playing, results, winner, loser, claim, claimed
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [hostLine, setHostLine] = useState("");
  const [isHostSpeaking, setIsHostSpeaking] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentReward, setCurrentReward] = useState(null);
  const [ws, setWs] = useState(null);
  const [showMobileVote, setShowMobileVote] = useState(isMobile());
  const [voterId, setVoterId] = useState(null);
  
  // Multi-round scoring
  const [roundNumber, setRoundNumber] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [userVote, setUserVote] = useState(null);
  
  // Email claim form
  const [email, setEmail] = useState("");
  const [claiming, setClaiming] = useState(false);
  
  // NEW: Has user joined the game? (controls QR visibility)
  const [hasJoined, setHasJoined] = useState(false);
  
  // NEW: Mobile window positioning
  const [isMinimized, setIsMinimized] = useState(false);
  const [windowPosition, setWindowPosition] = useState({ x: 0, y: 0 });
  const dragControls = useDragControls();
  
  // NEW: Auto-shuffle state
  const [isAutoShuffling, setIsAutoShuffling] = useState(false);
  
  // NEW: Latest voter name (from AI simulation)
  const [latestVoter, setLatestVoter] = useState(null);
  
  // NEW: Player count
  const [playerCount, setPlayerCount] = useState(0);
  const [claimedReward, setClaimedReward] = useState(null);
  
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const lastCommentaryTime = useRef(0);

  const canStartShow = isAdmin || allowAnyoneToStart;

  // Initialize voter ID and check if already joined
  useEffect(() => {
    let id = localStorage.getItem('ztv_voter_id');
    if (!id) {
      id = `voter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('ztv_voter_id', id);
    }
    setVoterId(id);
    
    // Check if user has already joined before
    const joinedBefore = localStorage.getItem('ztv_has_joined');
    if (joinedBefore === 'true') {
      setHasJoined(true);
    }
    
    // Load saved score
    const savedScore = localStorage.getItem('ztv_game_score');
    if (savedScore) {
      const score = JSON.parse(savedScore);
      setCorrectAnswers(score.correct || 0);
      setRoundNumber(score.round || 0);
    }
  }, []);
  
  // Mark user as joined (called when they vote or interact)
  const markAsJoined = () => {
    if (!hasJoined) {
      setHasJoined(true);
      localStorage.setItem('ztv_has_joined', 'true');
    }
  };

  // Save score
  const saveScore = (correct, round) => {
    localStorage.setItem('ztv_game_score', JSON.stringify({ correct, round }));
  };

  // Generate QR code
  const generateQRCode = async (gameId) => {
    try {
      const voteUrl = `${window.location.origin}/vote/${gameId}`;
      const qr = await QRCode.toDataURL(voteUrl, {
        width: 150,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      setQrCodeUrl(qr);
    } catch (err) {
      console.error("QR generation error:", err);
    }
  };

  // Play AI host voice
  const playHostVoice = async (text) => {
    if (!soundEnabled) return;
    
    try {
      setIsHostSpeaking(true);
      const res = await axios.post(`${API}/api/game-show/tts`, { text, speed: 1.2 });
      
      if (res.data.audio_base64) {
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio_base64}`);
        audioRef.current = audio;
        audio.volume = 0.8;
        audio.play();
        audio.onended = () => setIsHostSpeaking(false);
      }
    } catch (error) {
      console.error("TTS error:", error);
      setIsHostSpeaking(false);
    }
  };

  // Get dynamic host commentary
  const getHostLine = (type, data = {}) => {
    const lines = HOST_LINES[type];
    let line = lines[Math.floor(Math.random() * lines.length)];
    
    Object.entries(data).forEach(([key, value]) => {
      line = line.replace(`{${key}}`, value);
    });
    
    return line;
  };

  // Fire confetti
  const fireConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#a855f7', '#ec4899', '#eab308', '#22c55e']
      });
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#a855f7', '#ec4899', '#eab308', '#22c55e']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  // Start a new round
  const startRound = async () => {
    setLoading(true);
    setUserVote(null);
    
    const introLine = getHostLine("intro");
    setHostLine(introLine);
    
    try {
      const res = await axios.post(`${API}/api/game-show/create`, {
        use_random: true,
        duration_seconds: 50
      });
      
      const votes = {};
      res.data.options.forEach(opt => votes[opt] = 0);
      
      setGame({
        ...res.data,
        votes,
        total_votes: 0,
        status: "active"
      });
      
      setRemainingTime(res.data.duration_seconds);
      await generateQRCode(res.data.game_id);
      
      connectWebSocket(res.data.game_id);
      
      setPhase("playing");
      setRoundNumber(prev => prev + 1);
      lastCommentaryTime.current = Date.now();
      
    } catch (error) {
      console.error("Error starting game:", error);
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  };

  // WebSocket connection with polling fallback
  const connectWebSocket = useCallback((gameId) => {
    if (ws) ws.close();
    
    const wsUrl = `${API.replace('https://', 'wss://').replace('http://', 'ws://')}/api/game-show/ws/${gameId}`;
    console.log('[WS] Connecting to:', wsUrl);
    const websocket = new WebSocket(wsUrl);
    let wsConnected = false;
    let pollInterval = null;
    
    // Polling fallback - fetch game state every 2 seconds if WS fails
    const startPolling = () => {
      if (pollInterval) return;
      console.log('[POLL] Starting polling fallback');
      pollInterval = setInterval(async () => {
        try {
          const res = await axios.get(`${API}/api/game-show/game/${gameId}`);
          if (res.data && res.data.status === "active") {
            setGame(prev => ({
              ...prev,
              votes: res.data.votes || prev.votes,
              total_votes: res.data.total_votes || prev.total_votes
            }));
            setPlayerCount(res.data.total_votes || 0);
          } else if (res.data && res.data.status === "ended") {
            // Game ended - trigger end handler
            clearInterval(pollInterval);
            handleGameEnd(res.data, res.data.reward);
          }
        } catch (e) {
          console.log('[POLL] Error:', e.message);
        }
      }, 2000);
    };
    
    websocket.onopen = () => {
      console.log('[WS] Connected successfully');
      wsConnected = true;
      // Clear polling if WS connects
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
    
    websocket.onerror = (error) => {
      console.error('[WS] Error:', error);
      if (!wsConnected) {
        startPolling();
      }
    };
    
    websocket.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);
      wsConnected = false;
      // Start polling on disconnect
      startPolling();
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('[WS] Received:', data.type);
      
      if (data.type === "vote_update") {
        setGame(prev => ({
          ...prev,
          votes: data.votes,
          total_votes: data.total_votes
        }));
        
        // Show latest voter name (from AI simulation)
        if (data.latest_voter) {
          setLatestVoter(data.latest_voter);
          setPlayerCount(data.total_votes);
          
          // Clear after 2 seconds
          setTimeout(() => setLatestVoter(null), 2000);
        }
      } else if (data.type === "game_ended") {
        if (pollInterval) clearInterval(pollInterval);
        handleGameEnd(data.game, data.reward);
      } else if (data.type === "game_state") {
        // Initial state from WebSocket
        setGame(prev => ({
          ...prev,
          votes: data.game.votes || prev.votes,
          total_votes: data.game.total_votes || prev.total_votes
        }));
        setPlayerCount(data.game.total_votes || 0);
      }
    };
    
    // Start polling immediately as backup (will stop if WS connects)
    setTimeout(() => {
      if (!wsConnected) {
        startPolling();
      }
    }, 3000);

    setWs(websocket);
    
    // Return cleanup function
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [ws]);

  // Handle game end - check if user voted for winner
  const handleGameEnd = async (finalGame, reward) => {
    setGame(finalGame);
    setRemainingTime(0);
    setPhase("results");
    setCurrentReward(reward);
    
    // Fire confetti
    fireConfetti();
    
    const winnerOption = finalGame.winner?.option;
    const userWonRound = userVote === winnerOption;
    
    // Mark user as joined since they participated
    markAsJoined();
    
    // Announce winner
    if (winnerOption) {
      const percent = finalGame.total_votes > 0 
        ? Math.round((finalGame.winner.votes / finalGame.total_votes) * 100)
        : 0;
      
      const winnerLine = getHostLine("winner", {
        winner: winnerOption,
        percent: `${percent}%`
      });
      setHostLine(winnerLine);
      await playHostVoice(winnerLine);
    }
    
    // Update score after 3 seconds
    setTimeout(async () => {
      if (userWonRound) {
        const newCorrect = correctAnswers + 1;
        setCorrectAnswers(newCorrect);
        saveScore(newCorrect, roundNumber);
        
        // Update leaderboard score
        try {
          const username = voterId ? `Player_${voterId.slice(0, 6)}` : `Player_${Date.now()}`;
          await axios.post(`${API}/api/game-analytics/leaderboard/score`, {
            player_id: voterId || `temp_${Date.now()}`,
            username: username,
            score: 10, // 10 points per correct answer
            correct_answers: 1,
            creator_slug: null
          });
        } catch (e) {
          console.log("Leaderboard update error:", e);
        }
        
        // Check if user reached 5 wins
        if (newCorrect >= WINS_NEEDED) {
          setPhase("winner");
          const rewardLine = getHostLine("reward");
          setHostLine(rewardLine);
          playHostVoice(rewardLine);
          fireConfetti();
          // Don't auto-shuffle after winner - let them claim reward
          return;
        } else {
          setPhase("loser"); // Actually means "not yet winner"
          setHostLine(`Correct! ${newCorrect}/${WINS_NEEDED} wins. Next question coming up!`);
        }
      } else {
        // Wrong answer - still update leaderboard (0 points for participation)
        try {
          const username = voterId ? `Player_${voterId.slice(0, 6)}` : `Player_${Date.now()}`;
          await axios.post(`${API}/api/game-analytics/leaderboard/score`, {
            player_id: voterId || `temp_${Date.now()}`,
            username: username,
            score: 0, // 0 points for wrong answer
            correct_answers: 0,
            creator_slug: null
          });
        } catch (e) {
          console.log("Leaderboard update error:", e);
        }
        
        setPhase("loser");
        const tryAgainLine = getHostLine("tryAgain");
        setHostLine(tryAgainLine);
      }
      
      // AUTO-SHUFFLE: Start next question automatically after delay
      setIsAutoShuffling(true);
      setTimeout(() => {
        setIsAutoShuffling(false);
        newRound(); // Auto-start next question
      }, AUTO_SHUFFLE_DELAY);
      
    }, 3000);
  };

  // Claim reward
  const handleClaimReward = async () => {
    if (!email || !email.includes('@')) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    setClaiming(true);
    
    try {
      const res = await axios.post(`${API}/api/game-show/claim-reward`, {
        email,
        voter_id: voterId,
        game_id: game.game_id,
        reward_id: currentReward?.id || "ztvlive"
      });
      
      if (res.data.success) {
        setClaimedReward(res.data.reward);
        setPhase("claimed");
        toast.success("Reward sent to your inbox!");
        
        // Announce winner to ticker
        try {
          const username = email.split('@')[0];
          await axios.post(`${API}/api/game-analytics/winner`, {
            username,
            reward_type: "super_fan",
            location: Intl.DateTimeFormat().resolvedOptions().timeZone,
            creator_slug: null
          });
        } catch (e) {
          console.log("Ticker announcement error:", e);
        }
        
        // Reset score
        setCorrectAnswers(0);
        setRoundNumber(0);
        saveScore(0, 0);
        
        await playHostVoice(`Amazing! Your ${currentReward?.reward_title || 'reward'} has been sent to ${email}!`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to claim reward");
    } finally {
      setClaiming(false);
    }
  };

  // Timer and live commentary
  useEffect(() => {
    if (phase !== "playing" || remainingTime <= 0) return;

    timerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        const newTime = prev - 1;
        
        const now = Date.now();
        const timeSinceLastComment = now - lastCommentaryTime.current;
        
        if (game && timeSinceLastComment > 10000 && newTime > 10) {
          lastCommentaryTime.current = now;
          
          const sorted = Object.entries(game.votes).sort((a, b) => b[1] - a[1]);
          if (sorted.length >= 2 && game.total_votes > 0) {
            const leader = sorted[0][0];
            const trailer = sorted[1][0];
            const leaderPercent = Math.round((sorted[0][1] / game.total_votes) * 100);
            
            const line = getHostLine("during", {
              leader,
              trailer,
              percent: `${leaderPercent}%`,
              time: newTime,
              total: game.total_votes
            });
            setHostLine(line);
            playHostVoice(line);
          }
        }
        
        if (newTime === 10) {
          const line = getHostLine("final10");
          setHostLine(line);
          playHostVoice(line);
        }
        
        if (newTime <= 0) {
          clearInterval(timerRef.current);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [phase, game]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (ws) ws.close();
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, [ws]);

  const getPercentage = (option) => {
    if (!game || game.total_votes === 0) return 0;
    return Math.round((game.votes[option] / game.total_votes) * 100);
  };

  const getWinner = () => {
    if (!game?.votes || game.total_votes === 0) return null;
    return Object.entries(game.votes).reduce((a, b) => a[1] > b[1] ? a : b);
  };

  const winner = (phase === "results" || phase === "winner" || phase === "loser") && game ? getWinner() : null;

  const resetGame = () => {
    setPhase("idle");
    setGame(null);
    setQrCodeUrl(null);
    setCurrentReward(null);
    setHostLine("");
    setEmail("");
    setClaimedReward(null);
    setUserVote(null);
  };

  const newRound = () => {
    setGame(null);
    setQrCodeUrl(null);
    setHostLine("");
    setUserVote(null);
    startRound();
  };

  // Get vote URL for display
  const getVoteUrl = () => {
    if (!game) return "";
    return `${window.location.host}/vote/${game.game_id}`;
  };

  return (
    <AnimatePresence>
      {/* MAIN GAME PANEL - Draggable on mobile */}
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        drag={isMobile()}
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.1}
        dragConstraints={{
          top: -100,
          left: -200,
          right: 100,
          bottom: 300
        }}
        className={`fixed z-30 ${
          isMinimized 
            ? 'bottom-4 right-4 w-auto' 
            : 'top-20 right-4 w-80 max-w-[calc(100vw-2rem)]'
        }`}
        style={{ 
          maxHeight: isMinimized ? 'auto' : 'calc(100vh - 140px)',
          touchAction: 'none' // Better drag on mobile
        }}
      >
        <div className={`bg-gradient-to-br from-purple-900/95 via-zinc-900/95 to-pink-900/95 backdrop-blur-xl rounded-2xl border-2 border-purple-500/50 shadow-2xl shadow-purple-500/20 overflow-hidden ${
          isMinimized ? '' : ''
        }`}>
          {/* Header - Draggable handle on mobile */}
          <div 
            className="bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-500 p-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => isMobile() && dragControls.start(e)}
          >
            <div className="flex items-center gap-2">
              {isMobile() && (
                <GripVertical className="w-4 h-4 text-white/60" />
              )}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
              </motion.div>
              <span className="font-black text-white text-xs uppercase tracking-wider">
                {isMinimized ? 'GAME' : 'UNUSUAL FUN SHOW'}
              </span>
              {isHostSpeaking && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <Mic className="w-3 h-3 text-yellow-300" />
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Score display */}
              {!isMinimized && (
                <div className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-full mr-1">
                  <Star className="w-3 h-3 text-yellow-400" />
                  <span className="text-white text-xs font-bold">{correctAnswers}/{WINS_NEEDED}</span>
                </div>
              )}
              
              {/* Minimize/Maximize for mobile */}
              {isMobile() && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                </Button>
              )}
              
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              </Button>
              {onClose && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
                  onClick={onClose}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Minimized state - just show score */}
          {isMinimized ? (
            <div className="p-2 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-white text-sm font-bold">{correctAnswers}/{WINS_NEEDED}</span>
              {phase === "playing" && (
                <span className="text-purple-300 text-xs">Round {roundNumber}</span>
              )}
            </div>
          ) : (
            <div className="p-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {/* Idle state */}
            {phase === "idle" && (
              <div className="text-center py-4">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-5xl mb-3"
                >
                  🎮
                </motion.div>
                <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-pink-500 mb-1">
                  ZTVLIVE UNUSUAL FUN SHOW
                </h3>
                <p className="text-zinc-400 text-xs mb-3">Win {WINS_NEEDED} rounds to claim rewards!</p>
                {canStartShow ? (
                  <Button
                    onClick={startRound}
                    disabled={loading}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold w-full py-4 text-sm"
                  >
                    {loading ? "LOADING..." : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        START THE SHOW
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-zinc-500 text-sm">Waiting for host...</p>
                )}
              </div>
            )}

            {/* Playing state */}
            {phase === "playing" && game && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <motion.div 
                    className="flex items-center gap-1"
                    animate={remainingTime <= 10 ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <Clock className={`w-4 h-4 ${remainingTime <= 10 ? 'text-red-400' : 'text-purple-400'}`} />
                    <span className={`font-mono font-black text-xl ${remainingTime <= 10 ? 'text-red-400' : 'text-white'}`}>
                      {remainingTime}s
                    </span>
                  </motion.div>
                  <Badge className="bg-purple-600/50 text-xs">
                    Round {roundNumber}
                  </Badge>
                  <div className="flex items-center gap-1 bg-zinc-800/50 px-2 py-0.5 rounded-full">
                    <Users className="w-3 h-3 text-blue-400" />
                    <span className="text-white text-xs font-bold">{game.total_votes}</span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-lg p-3 mb-3 border border-purple-500/30">
                  <p className="text-white font-bold text-sm text-center">{game.question}</p>
                </div>

                {/* QR Code - Only show if user hasn't joined yet */}
                {!hasJoined && !showMobileVote && qrCodeUrl && (
                  <div className="flex flex-col items-center mb-3">
                    <div className="bg-white p-1.5 rounded-lg shadow-lg shadow-purple-500/30">
                      <img src={qrCodeUrl} alt="Scan to vote" className="w-28 h-28" />
                    </div>
                    <p className="text-purple-300 text-[10px] mt-1 text-center">
                      SCAN ONCE TO JOIN<br/>
                      <span className="text-yellow-400 font-bold">{getVoteUrl()}</span>
                    </p>
                  </div>
                )}
                
                {/* Mobile vote button - marks as joined when clicked */}
                {showMobileVote && !hasJoined && (
                  <div className="mb-3">
                    <a 
                      href={`${window.location.origin}/vote/${game.game_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                      onClick={() => markAsJoined()}
                    >
                      <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 py-4 text-sm font-bold">
                        <Play className="w-4 h-4 mr-2" />
                        TAP TO JOIN & VOTE!
                      </Button>
                    </a>
                  </div>
                )}
                
                {/* Already joined indicator */}
                {hasJoined && (
                  <div className="mb-3 text-center">
                    <Badge className="bg-green-600/50 text-green-200 text-xs">
                      ✓ You're in the game!
                    </Badge>
                  </div>
                )}
                
                {/* Player count and latest voter */}
                <div className="flex items-center justify-between mb-2 text-xs">
                  <div className="flex items-center gap-1 text-purple-300">
                    <Users className="w-3 h-3" />
                    <span>{game.total_votes || playerCount || 0} players</span>
                  </div>
                  {latestVoter && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-green-400 text-xs"
                    >
                      +{latestVoter} joined!
                    </motion.div>
                  )}
                </div>

                <div className="space-y-1.5">
                  {game.options.map((option, idx) => {
                    const percentage = getPercentage(option);
                    const isLeading = percentage > 0 && percentage === Math.max(...game.options.map(o => getPercentage(o)));
                    
                    return (
                      <motion.div 
                        key={idx} 
                        className="relative overflow-hidden rounded-lg"
                        animate={isLeading ? { scale: [1, 1.02, 1] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <div className={`relative p-2 ${isLeading ? 'bg-purple-600/40 ring-1 ring-yellow-400' : 'bg-zinc-800/50'}`}>
                          <motion.div 
                            className={`absolute left-0 top-0 bottom-0 ${isLeading ? 'bg-gradient-to-r from-yellow-500/40 to-purple-500/40' : 'bg-purple-500/30'}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                          
                          <div className="relative z-10 flex items-center justify-between">
                            <span className="text-white text-sm font-bold flex items-center gap-1">
                              {isLeading && percentage > 0 && <Crown className="w-3 h-3 text-yellow-400" />}
                              {option}
                            </span>
                            <span className="text-white font-black text-sm">
                              {percentage}%
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {hostLine && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 bg-zinc-800/50 rounded-lg p-2 border-l-2 border-yellow-400"
                  >
                    <p className="text-purple-200 text-xs italic">"{hostLine}"</p>
                  </motion.div>
                )}
              </>
            )}

            {/* Results state */}
            {phase === "results" && winner && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-3"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                  className="text-5xl mb-2"
                >
                  🏆
                </motion.div>
                
                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2">
                  {winner[0]} WINS!
                </h3>
                
                <p className="text-yellow-400 font-bold text-sm mb-2">
                  {getPercentage(winner[0])}% ({winner[1]} votes)
                </p>

                <p className="text-purple-300 text-xs italic">Calculating your score...</p>
              </motion.div>
            )}

            {/* Winner state - User got 5 correct! */}
            {phase === "winner" && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-3"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-5xl mb-2"
                >
                  🎉
                </motion.div>
                
                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black mb-2">
                  <Gift className="w-3 h-3 mr-1" />
                  CHAMPION!
                </Badge>
                
                <h3 className="text-lg font-black text-white mb-1">
                  You Won {WINS_NEEDED} Rounds!
                </h3>
                <p className="text-purple-300 text-xs mb-3">Claim your exclusive reward!</p>
                
                {currentReward && (
                  <div className="bg-zinc-800/50 rounded-lg p-3 mb-3">
                    <p className="text-4xl mb-1">{currentReward.logo}</p>
                    <p className="text-white font-bold text-sm">{currentReward.sponsor}</p>
                    <p className="text-yellow-400 text-xs">{currentReward.reward_title}</p>
                  </div>
                )}
                
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-900 border-purple-500/50 text-white text-center text-sm mb-2"
                />
                <Button 
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm py-4 font-bold"
                  onClick={handleClaimReward}
                  disabled={claiming || !email}
                >
                  {claiming ? "CLAIMING..." : "SEND TO MY INBOX"}
                </Button>
              </motion.div>
            )}

            {/* Loser/Try Again state - with auto-shuffle indicator */}
            {phase === "loser" && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-3"
              >
                <div className="text-4xl mb-2">
                  {userVote === winner?.[0] ? "✅" : "😅"}
                </div>
                
                <h3 className="text-lg font-black text-white mb-1">
                  {userVote === winner?.[0] ? "Correct!" : "Not This Time!"}
                </h3>
                
                <div className="flex items-center justify-center gap-1 mb-3">
                  {[...Array(WINS_NEEDED)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-5 h-5 ${i < correctAnswers ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600'}`} 
                    />
                  ))}
                </div>
                
                <p className="text-purple-300 text-xs mb-3">
                  {correctAnswers}/{WINS_NEEDED} wins - {WINS_NEEDED - correctAnswers} more to claim a reward!
                </p>
                
                {/* Auto-shuffle indicator */}
                {isAutoShuffling ? (
                  <div className="bg-purple-600/30 rounded-lg p-3 border border-purple-500/50">
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4 text-purple-300 animate-spin" />
                      <span className="text-purple-200 text-sm font-semibold">
                        Next question loading...
                      </span>
                    </motion.div>
                  </div>
                ) : (
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm py-4 font-bold"
                    onClick={newRound}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    PLAY AGAIN
                  </Button>
                )}
              </motion.div>
            )}

            {/* Claimed state */}
            {phase === "claimed" && claimedReward && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-3"
              >
                <div className="text-4xl mb-2">✅</div>
                
                <h3 className="text-lg font-black text-green-400 mb-1">REWARD SENT!</h3>
                <p className="text-zinc-400 text-xs mb-3">Check your inbox at {email}</p>
                
                <div className="bg-zinc-800/50 rounded-lg p-3 mb-3">
                  <p className="text-2xl mb-1">{claimedReward.logo}</p>
                  <p className="text-yellow-400 font-mono font-bold">{claimedReward.reward_code}</p>
                </div>
                
                <Button 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm py-4 font-bold"
                  onClick={resetGame}
                >
                  <Play className="w-4 h-4 mr-2" />
                  PLAY AGAIN
                </Button>
              </motion.div>
            )}
          </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
