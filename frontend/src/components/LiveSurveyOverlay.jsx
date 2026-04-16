import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { 
  Users, Trophy, Clock, CheckCircle, XCircle, 
  Send, Award, Star, Mail, Volume2, VolumeX, X, 
  GripVertical, Minimize2, Maximize2, Sparkles, Share2
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import axios from "axios";
import QRCode from "qrcode";

const API = process.env.REACT_APP_BACKEND_URL || '';

// Detect if user is on mobile
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Friendly AI Voice-Over messages
const VOICE_MESSAGES = {
  welcome: [
    "Hey there, superstar! Welcome to ZTVLIVE! Ready to guess what the world thinks?",
    "Welcome to the party! You're about to play the most fun guessing game ever!",
    "Hey friend! So glad you're here! Let's see if you can match the crowd!",
  ],
  batchEnd: [
    "Great game everyone! Stick around, a fresh new batch is starting soon!",
    "What a round! Don't leave now, more questions are on the way!",
  ],
  newBatch: [
    "Here we go! New game, new chances to win! Let's do this!",
    "Fresh batch alert! Time to show everyone what you've got!",
  ]
};

/**
 * LiveSurveyOverlay - Compact overlay version for Watch page
 * 
 * Family Feud style - type your own answers!
 * Draggable on mobile, fixed position on desktop.
 */
export default function LiveSurveyOverlay({ onClose, isFullscreen = false, isAdmin = false }) {
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const wsRef = useRef(null);
  const dragControls = useDragControls();
  
  // UI state
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  
  // Game state - SYNCED across all platforms
  const [currentQuestion, setCurrentQuestion] = useState(null);
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
  
  // Sound state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isHostSpeaking, setIsHostSpeaking] = useState(false);
  const audioRef = useRef(null);
  const hasWelcomedRef = useRef(false);
  const playVoiceOverRef = useRef(null);
  
  // QR Code for scan to join
  const [qrCodeUrl, setQrCodeUrl] = useState(null);

  // Get/create player ID
  useEffect(() => {
    let pid = localStorage.getItem('ztvlive_survey_player');
    if (!pid) {
      pid = 'player_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ztvlive_survey_player', pid);
    }
    setPlayerId(pid);
    
    // Check if already joined
    const joinedBefore = localStorage.getItem('ztvlive_survey_joined');
    if (joinedBefore === 'true') {
      setHasJoined(true);
    }
  }, []);

  // Generate QR code
  useEffect(() => {
    const joinUrl = 'https://www.ztvlivestream.com/play';
    QRCode.toDataURL(joinUrl, {
      width: 150,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrCodeUrl);
  }, []);

  const getRandomMessage = (category) => {
    const messages = VOICE_MESSAGES[category];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const playVoiceOver = useCallback(async (text) => {
    if (!soundEnabled) return;
    
    try {
      setIsHostSpeaking(true);
      const res = await axios.post(`${API}/api/game-show/tts`, { text, speed: 1.1 });
      
      if (res.data.audio_base64) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        
        const audio = new Audio(`data:audio/mp3;base64,${res.data.audio_base64}`);
        audioRef.current = audio;
        audio.volume = 0.8;
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
  }, [soundEnabled]);

  useEffect(() => {
    playVoiceOverRef.current = playVoiceOver;
  }, [playVoiceOver]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const connectWebSocket = useCallback(() => {
    if (!playerId || wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/live-survey/ws/${playerId}`);
    
    ws.onopen = () => {
      console.log('[SurveyOverlay] Connected');
      setConnected(true);
      
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
      console.log('[SurveyOverlay] Disconnected');
      setConnected(false);
      setTimeout(connectWebSocket, 3000);
    };
    
    wsRef.current = ws;
  }, [playerId, playVoiceOver]);

  useEffect(() => {
    if (playerId) connectWebSocket();
    return () => wsRef.current?.close();
  }, [playerId, connectWebSocket]);

  const handleGameUpdate = (data) => {
    switch (data.event || data.type) {
      case 'connected':
      case 'new_question':
        setCurrentQuestion(data.question);
        setTimeRemaining(data.time_remaining);
        setBatchTimeRemaining(data.batch_time_remaining);
        setBatchNumber(data.batch_number);
        setTotalAnswers(data.total_answers || 0);
        setPlayerCount(data.player_count || 0);  // Sync player count
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
        setHasJoined(true);
        localStorage.setItem('ztvlive_survey_joined', 'true');
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
        
        const newBatchMsg = getRandomMessage('newBatch');
        if (playVoiceOverRef.current) playVoiceOverRef.current(newBatchMsg);
        break;
        
      case 'heartbeat':
      case 'pong':
        setTimeRemaining(data.time_remaining);
        setBatchTimeRemaining(data.batch_time_remaining);
        if (data.total_answers) setTotalAnswers(data.total_answers);
        if (data.same_percent !== undefined) setSamePercent(data.same_percent);
        break;
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
      setBatchTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const submitAnswer = () => {
    if (!answer.trim() || hasAnswered || timeRemaining < 5) return;
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'answer', answer: answer.trim() }));
    }
  };

  const claimPrize = async () => {
    if (!claimEmail || claiming) return;
    
    setClaiming(true);
    try {
      const res = await fetch(`${API}/api/live-survey/claim-prize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, email: claimEmail })
      });
      
      if (res.ok) {
        toast.success('Prize claimed! Check your email.');
        setShowClaimPrize(false);
      } else {
        toast.error('Failed to claim prize');
      }
    } catch (e) {
      toast.error('Error claiming prize');
    }
    setClaiming(false);
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const markAsJoined = () => {
    if (!hasJoined) {
      setHasJoined(true);
      localStorage.setItem('ztvlive_survey_joined', 'true');
    }
  };

  // Share game function
  const shareGame = async () => {
    const shareUrl = 'https://www.ztvlivestream.com/play';
    const shareText = 'Join me on ZTV UNUSUAL FUN SHOW! Win the Mystery Money Jackpot! 🎮💰 #ZTVLIVE';
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ZTV Mystery Money Jackpot',
          text: shareText,
          url: shareUrl
        });
        toast.success('Shared!');
      } catch (e) {
        if (e.name !== 'AbortError') {
          navigator.clipboard?.writeText(`${shareText} ${shareUrl}`);
          toast.success('Link copied!');
        }
      }
    } else {
      navigator.clipboard?.writeText(`${shareText} ${shareUrl}`);
      toast.success('Link copied!');
    }
  };

  return (
    <AnimatePresence>
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
          touchAction: 'none'
        }}
      >
        <div className={`bg-gradient-to-br from-purple-900/95 via-zinc-900/95 to-pink-900/95 backdrop-blur-xl rounded-2xl border-2 border-purple-500/50 shadow-2xl shadow-purple-500/20 overflow-hidden`}>
          
          {/* Header */}
          <div 
            className="bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-500 p-2 flex items-center justify-between cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => isMobile() && dragControls.start(e)}
          >
            <div className="flex items-center gap-2">
              {isMobile() && <GripVertical className="w-4 h-4 text-white/60" />}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
              </motion.div>
              <span className="font-black text-white text-xs uppercase tracking-wider">
                {isMinimized ? 'JACKPOT' : 'Mystery Money Jackpot'}
              </span>
              {isHostSpeaking && (
                <span className="text-yellow-300 text-xs animate-pulse">🎤</span>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {/* Score */}
              {!isMinimized && (
                <div className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded-full mr-1">
                  <Star className="w-3 h-3 text-yellow-400" />
                  <span className="text-white text-xs font-bold">{score}</span>
                </div>
              )}
              
              {/* Share Button */}
              {!isMinimized && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-pink-300 hover:text-pink-100 hover:bg-pink-500/20"
                  onClick={shareGame}
                  title="Share with friends"
                >
                  <Share2 className="w-3 h-3" />
                </Button>
              )}
              
              {/* Minimize/Maximize */}
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
              
              {/* Sound Toggle (Mute AI Voice) */}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  if (audioRef.current && soundEnabled) {
                    audioRef.current.pause();
                    setIsHostSpeaking(false);
                  }
                }}
                title={soundEnabled ? 'Mute AI Voice' : 'Unmute AI Voice'}
              >
                {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              </Button>
              
              {/* Close */}
              {onClose && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
                  onClick={onClose}
                  data-testid="game-close-btn"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Minimized state */}
          {isMinimized ? (
            <div className="p-2 flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              <span className="text-white text-sm font-bold">{score}</span>
              <span className="text-purple-300 text-xs">{timeRemaining}s</span>
            </div>
          ) : (
            <div className="p-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              
              {/* Timer Bar */}
              <div className="flex items-center justify-between mb-2">
                <motion.div 
                  className="flex items-center gap-1"
                  animate={timeRemaining <= 10 ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5, repeat: Infinity }}
                >
                  <Clock className={`w-4 h-4 ${timeRemaining <= 10 ? 'text-red-400' : 'text-purple-400'}`} />
                  <span className={`font-mono font-black text-xl ${timeRemaining <= 10 ? 'text-red-400' : 'text-white'}`}>
                    {timeRemaining}s
                  </span>
                </motion.div>
                
                <div className="text-xs text-zinc-400">
                  Game ends: {formatTime(batchTimeRemaining)}
                </div>
                
                <div className="flex items-center gap-1 bg-zinc-800/50 px-2 py-0.5 rounded-full">
                  <Users className="w-3 h-3 text-blue-400" />
                  <span className="text-white text-xs font-bold">{totalAnswers}</span>
                </div>
              </div>

              {/* Question Card */}
              {currentQuestion && !showBatchEnd && (
                <div className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-lg p-3 mb-3 border border-purple-500/30">
                  <p className="text-white font-bold text-sm text-center">{currentQuestion}</p>
                </div>
              )}

              {/* QR Code - Show if not joined */}
              {!hasJoined && qrCodeUrl && !showingResults && !showBatchEnd && (
                <div className="flex flex-col items-center mb-3">
                  <div className="bg-white p-1.5 rounded-lg shadow-lg shadow-purple-500/30">
                    <img src={qrCodeUrl} alt="Scan to vote" className="w-24 h-24" />
                  </div>
                  <p className="text-purple-300 text-[10px] mt-1 text-center">
                    SCAN TO JOIN<br/>
                    <span className="text-yellow-400 font-bold">ztvlivestream.com/play</span>
                  </p>
                </div>
              )}

              {/* Already joined badge */}
              {hasJoined && !showingResults && !showBatchEnd && (
                <div className="mb-3 text-center">
                  <span className="bg-green-600/50 text-green-200 text-xs px-2 py-1 rounded-full">
                    ✓ You're in the game!
                  </span>
                </div>
              )}

              {/* Answer Input or Results */}
              {showBatchEnd ? (
                /* Batch End UI */
                <div className="text-center py-3">
                  <div className="text-4xl mb-2">{isWinner ? "🎉" : "⏱️"}</div>
                  <h3 className="text-lg font-black text-white mb-1">
                    {isWinner ? "YOU'RE A WINNER!" : "Game Over"}
                  </h3>
                  <p className="text-purple-300 text-xs mb-3">
                    Score: {score} points
                  </p>
                  
                  {showClaimPrize ? (
                    <div className="space-y-2">
                      <Input
                        type="email"
                        value={claimEmail}
                        onChange={(e) => setClaimEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="bg-zinc-900 border-zinc-600 text-sm"
                      />
                      <Button
                        onClick={claimPrize}
                        disabled={!claimEmail || claiming}
                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm"
                      >
                        {claiming ? 'Claiming...' : 'Claim Prize'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-zinc-400 text-xs">New batch starting soon...</p>
                  )}
                </div>
              ) : showingResults ? (
                /* Results */
                <div className="space-y-2">
                  <h3 className="text-center text-sm font-bold text-yellow-400">TOP ANSWERS</h3>
                  
                  {topAnswers.slice(0, 4).map((ans, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`rounded-lg p-2 ${
                        idx === 0 ? 'bg-yellow-900/40 border border-yellow-500' : 'bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-yellow-500 text-black' : 'bg-zinc-700'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-sm capitalize">{ans.answer}</span>
                        </div>
                        <span className="font-bold text-lg">{ans.percent}%</span>
                      </div>
                    </motion.div>
                  ))}

                  {myResult && (
                    <div className={`rounded-lg p-2 mt-2 ${
                      myResult.won_point ? 'bg-green-900/40 border border-green-500' : 'bg-zinc-800/50'
                    }`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Your answer:</span>
                        <span className="font-bold capitalize">{myResult.your_answer}</span>
                      </div>
                      <div className="flex items-center justify-center mt-1">
                        {myResult.won_point ? (
                          <span className="text-green-400 text-xs flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> +1 Point!
                          </span>
                        ) : (
                          <span className="text-red-400 text-xs flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Try again!
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Answer Input */
                <>
                  {!hasAnswered ? (
                    <div className="flex gap-2">
                      <Input
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Type your answer..."
                        className="flex-1 bg-zinc-800 border-zinc-700 text-white text-sm placeholder:text-zinc-500"
                        maxLength={50}
                        disabled={timeRemaining < 5}
                        onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
                      />
                      <Button
                        onClick={() => {
                          submitAnswer();
                          markAsJoined();
                        }}
                        disabled={!answer.trim() || timeRemaining < 5}
                        className="bg-purple-600 hover:bg-purple-500 px-4"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    /* After answering */
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-green-900/30 border border-green-500/50 rounded-lg p-3 text-center"
                    >
                      <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                      <div className="text-sm font-bold mb-1">Answer Locked!</div>
                      <div className="text-lg font-bold text-white capitalize">"{myAnswer}"</div>
                      
                      <div className="bg-zinc-800/50 rounded-lg p-2 mt-2">
                        <div className="text-xs text-zinc-400">Same answer as you</div>
                        <div className="text-2xl font-black text-purple-400">{samePercent}%</div>
                        <div className="text-xs text-zinc-500">({sameCount} people)</div>
                      </div>
                    </motion.div>
                  )}
                  
                  {timeRemaining < 5 && !hasAnswered && (
                    <p className="text-center text-red-400 text-xs mt-2">
                      Too late! Wait for next question.
                    </p>
                  )}
                </>
              )}

              {/* Stats Footer */}
              <div className="mt-3 flex items-center justify-center gap-4 text-xs text-zinc-400">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{totalAnswers} answers</span>
                </div>
                <div className="flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  <span>{questionsAnswered} played</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
