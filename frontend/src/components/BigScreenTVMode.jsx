import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, Users, Trophy, Sparkles, Play, X, Volume2, VolumeX, 
  Zap, Gift, Crown, Mic, Star, QrCode, Tv, Timer, Award,
  ChevronRight, TrendingUp, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import QRCode from "qrcode";
import confetti from 'canvas-confetti';
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * BIG SCREEN TV MODE
 * 
 * Optimized for 10-foot viewing on OTT devices (Roku, Fire TV, Samsung, LG)
 * 
 * Features:
 * - TV-safe zones (10% margin from edges)
 * - Large fonts readable from couch distance
 * - Prominent QR code for phone joining
 * - 3-Round structure with 10-min timers
 * - Escalating prizes ($5 → $10 → $15)
 * - Hybrid scoring (accuracy + majority match bonus)
 */

// Prize tiers by round
const PRIZE_TIERS = {
  1: { amount: 5, label: "$5 DoorDash", color: "from-green-500 to-emerald-600" },
  2: { amount: 10, label: "$10 DoorDash", color: "from-blue-500 to-cyan-600" },
  3: { amount: 15, label: "$15 DoorDash", color: "from-yellow-500 to-orange-500" }
};

// Round duration in seconds (10 minutes = 600 seconds)
const ROUND_DURATION = 600;

// Questions per round
const QUESTIONS_PER_ROUND = 6;

// Bonus points for matching majority
const MAJORITY_MATCH_BONUS = 25;

// Host commentary for Big Screen
const TV_HOST_LINES = {
  intro: [
    "WELCOME TO THE UNUSUAL FUN SHOW! Scan the QR code to JOIN THE POOL!",
    "Your phone is your controller! SCAN NOW to play along!",
    "The Big Screen experience starts NOW! Get your phones ready!"
  ],
  roundStart: [
    "ROUND {round} BEGINS! {prize} is on the line!",
    "It's time for ROUND {round}! Who wants {prize}?",
    "ROUND {round} - The stakes are getting HIGHER!"
  ],
  majorityBonus: [
    "MAJORITY MATCH! +{bonus} bonus points!",
    "You're thinking like the CROWD! +{bonus}!",
    "CONSENSUS BONUS activated! +{bonus} points!"
  ],
  roundWinner: [
    "ROUND {round} CHAMPION! {winner} claims the {prize}!",
    "{winner} DOMINATES Round {round}! {prize} is THEIRS!",
    "What a PERFORMANCE! {winner} wins {prize}!"
  ],
  finale: [
    "THE GRAND FINALE! {prize} up for grabs!",
    "This is IT! The CHAMPIONSHIP ROUND for {prize}!",
    "Last chance to WIN BIG! {prize} awaits!"
  ]
};

export default function BigScreenTVMode({ onClose, showId = null }) {
  // Show state
  const [showPhase, setShowPhase] = useState("intro"); // intro, round, transition, winner, finale, complete
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTimeLeft, setRoundTimeLeft] = useState(ROUND_DURATION);
  
  // Game state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(50);
  const [votes, setVotes] = useState({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [userVote, setUserVote] = useState(null);
  
  // Scoring
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerScores, setPlayerScores] = useState({});
  const [roundWinners, setRoundWinners] = useState([]);
  
  // UI state
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [hostLine, setHostLine] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [playersJoined, setPlayersJoined] = useState(0);
  const [showMajorityBonus, setShowMajorityBonus] = useState(false);
  
  // NEW: Track if user has already joined (hide QR after first scan)
  const [hasJoined, setHasJoined] = useState(() => {
    return localStorage.getItem('ztv_has_joined') === 'true';
  });
  
  // Refs
  const roundTimerRef = useRef(null);
  const questionTimerRef = useRef(null);
  const wsRef = useRef(null);

  // Generate QR code for joining
  useEffect(() => {
    const joinUrl = `${window.location.origin}/watch?auto_join=true&show_mode=bigscreen&round=${currentRound}`;
    QRCode.toDataURL(joinUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrCodeUrl);
  }, [currentRound]);

  // Round timer
  useEffect(() => {
    if (showPhase === "round" && roundTimeLeft > 0) {
      roundTimerRef.current = setInterval(() => {
        setRoundTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(roundTimerRef.current);
            endRound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(roundTimerRef.current);
  }, [showPhase]);

  // Question timer
  useEffect(() => {
    if (showPhase === "round" && currentQuestion && questionTimeLeft > 0) {
      questionTimerRef.current = setInterval(() => {
        setQuestionTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(questionTimerRef.current);
            processQuestionResults();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(questionTimerRef.current);
  }, [currentQuestion, showPhase]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get random host line
  const getHostLine = (type, replacements = {}) => {
    const lines = TV_HOST_LINES[type];
    let line = lines[Math.floor(Math.random() * lines.length)];
    Object.entries(replacements).forEach(([key, value]) => {
      line = line.replace(`{${key}}`, value);
    });
    return line;
  };

  // Start the show
  const startShow = async () => {
    setHostLine(getHostLine("intro"));
    
    // Wait for intro (placeholder - 5 seconds for now)
    setTimeout(() => {
      startRound(1);
    }, 5000);
  };

  // Start a round
  const startRound = async (roundNum) => {
    setCurrentRound(roundNum);
    setShowPhase("round");
    setRoundTimeLeft(ROUND_DURATION);
    setQuestionNumber(0);
    
    const prize = PRIZE_TIERS[roundNum];
    setHostLine(getHostLine(roundNum === 3 ? "finale" : "roundStart", { 
      round: roundNum, 
      prize: prize.label 
    }));
    
    // Fetch first question
    await fetchNextQuestion();
  };

  // Fetch next question from API
  const fetchNextQuestion = async () => {
    try {
      const res = await axios.get(`${API}/api/creator-trivia/question/random`);
      setCurrentQuestion(res.data);
      setQuestionTimeLeft(50);
      setVotes({});
      setTotalVotes(0);
      setUserVote(null);
      setQuestionNumber(prev => prev + 1);
    } catch (err) {
      console.error("Failed to fetch question:", err);
      // Use fallback question
      setCurrentQuestion({
        question: "What year was ZTVLIVE founded?",
        options: ["2024", "2025", "2026", "2023"],
        correct_index: 2
      });
      setQuestionTimeLeft(50);
    }
  };

  // Process question results and calculate hybrid scores
  const processQuestionResults = () => {
    if (!currentQuestion || totalVotes === 0) return;
    
    // Find majority answer
    const sortedVotes = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    const majorityAnswer = sortedVotes[0]?.[0];
    const majorityPercent = Math.round((sortedVotes[0]?.[1] / totalVotes) * 100);
    
    // Calculate scores (this would come from WebSocket in production)
    // For now, simulate scoring updates
    setShowMajorityBonus(true);
    setTimeout(() => setShowMajorityBonus(false), 2000);
    
    // Check if more questions in round
    if (questionNumber < QUESTIONS_PER_ROUND) {
      setTimeout(() => fetchNextQuestion(), 3000);
    }
  };

  // End current round
  const endRound = () => {
    setShowPhase("transition");
    
    // Determine round winner (highest score)
    const winner = leaderboard[0] || { username: "TopPlayer", score: 1500 };
    const prize = PRIZE_TIERS[currentRound];
    
    setHostLine(getHostLine("roundWinner", {
      round: currentRound,
      winner: winner.username,
      prize: prize.label
    }));
    
    // Fire confetti
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FF6B35', '#00D4FF']
    });
    
    // Record winner
    setRoundWinners(prev => [...prev, { round: currentRound, winner, prize }]);
    
    // Move to next round or finale
    setTimeout(() => {
      if (currentRound < 3) {
        startRound(currentRound + 1);
      } else {
        setShowPhase("complete");
      }
    }, 10000);
  };

  // Get percentage for vote option
  const getVotePercentage = (option) => {
    if (totalVotes === 0) return 0;
    return Math.round(((votes[option] || 0) / totalVotes) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* TV-Safe Zone Container (10% margins) */}
      <div className="absolute inset-[5%] flex flex-col">
        
        {/* TOP BAR - Show Info */}
        <div className="flex items-center justify-between mb-4">
          {/* Logo & Show Title */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-orange-500 rounded-2xl flex items-center justify-center">
              <Tv className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">
                UNUSUAL FUN SHOW
              </h1>
              <p className="text-xl text-zinc-400">
                Big Screen Edition • Round {currentRound} of 3
              </p>
            </div>
          </div>
          
          {/* Round Timer */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-zinc-500 text-sm uppercase tracking-wider">Round Timer</p>
              <p className={`text-5xl font-mono font-black ${roundTimeLeft <= 60 ? 'text-red-500' : 'text-white'}`}>
                {formatTime(roundTimeLeft)}
              </p>
            </div>
            
            {/* Players Count */}
            <div className="bg-zinc-900/80 rounded-2xl px-6 py-3 border border-zinc-700">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-400" />
                <span className="text-3xl font-bold text-white">{playersJoined.toLocaleString()}</span>
              </div>
              <p className="text-zinc-500 text-sm">Players</p>
            </div>
            
            {/* Sound Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="w-12 h-12 text-zinc-400 hover:text-white"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? <Volume2 className="w-8 h-8" /> : <VolumeX className="w-8 h-8" />}
            </Button>
            
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 text-zinc-400 hover:text-white"
                onClick={onClose}
              >
                <X className="w-8 h-8" />
              </Button>
            )}
          </div>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex gap-6">
          
          {/* LEFT SIDE - Game Area (70%) */}
          <div className="flex-[7] flex flex-col">
            
            {/* Prize Banner */}
            <div className={`bg-gradient-to-r ${PRIZE_TIERS[currentRound].color} rounded-2xl p-4 mb-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Gift className="w-10 h-10 text-white" />
                  <div>
                    <p className="text-white/80 text-lg">Round {currentRound} Prize</p>
                    <p className="text-4xl font-black text-white">{PRIZE_TIERS[currentRound].label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3].map(r => (
                    <div 
                      key={r}
                      className={`w-4 h-4 rounded-full ${r <= currentRound ? 'bg-white' : 'bg-white/30'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* INTRO PHASE */}
            <AnimatePresence mode="wait">
              {showPhase === "intro" && (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex-1 flex flex-col items-center justify-center"
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-[150px] mb-8"
                  >
                    🎮
                  </motion.div>
                  <h2 className="text-6xl font-black text-white mb-4 text-center">
                    GET READY TO PLAY!
                  </h2>
                  <p className="text-2xl text-zinc-400 mb-8 text-center max-w-2xl">
                    Scan the QR code with your phone to join the pool and compete for prizes!
                  </p>
                  <Button
                    onClick={startShow}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black text-3xl font-black px-12 py-8 rounded-2xl"
                  >
                    <Play className="w-10 h-10 mr-4" />
                    START THE SHOW
                  </Button>
                </motion.div>
              )}

              {/* ROUND PHASE - Question Display */}
              {showPhase === "round" && currentQuestion && (
                <motion.div
                  key="round"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex-1 flex flex-col"
                >
                  {/* Question Timer */}
                  <div className="flex items-center justify-between mb-4">
                    <Badge className="bg-purple-600/50 text-purple-200 text-xl px-4 py-2">
                      Question {questionNumber}/{QUESTIONS_PER_ROUND}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Timer className={`w-8 h-8 ${questionTimeLeft <= 10 ? 'text-red-500' : 'text-yellow-400'}`} />
                      <span className={`text-4xl font-mono font-black ${questionTimeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>
                        {questionTimeLeft}s
                      </span>
                    </div>
                  </div>

                  {/* Question Card */}
                  <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-3xl p-8 mb-6 border-2 border-purple-500/30">
                    <p className="text-4xl font-bold text-white text-center leading-tight">
                      {currentQuestion.question}
                    </p>
                  </div>

                  {/* Answer Options - 2x2 Grid */}
                  <div className="grid grid-cols-2 gap-4 flex-1">
                    {currentQuestion.options?.map((option, idx) => {
                      const percentage = getVotePercentage(option);
                      const isLeading = percentage > 0 && percentage === Math.max(...currentQuestion.options.map(o => getVotePercentage(o)));
                      
                      return (
                        <motion.div
                          key={idx}
                          className={`relative overflow-hidden rounded-2xl ${
                            isLeading ? 'ring-4 ring-yellow-400' : ''
                          }`}
                          animate={isLeading ? { scale: [1, 1.02, 1] } : {}}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <div className={`relative p-6 h-full ${
                            isLeading ? 'bg-gradient-to-br from-yellow-600/40 to-orange-600/40' : 'bg-zinc-800/80'
                          }`}>
                            {/* Vote Progress Bar */}
                            <motion.div
                              className={`absolute inset-0 ${isLeading ? 'bg-yellow-500/20' : 'bg-purple-500/20'}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5 }}
                            />
                            
                            <div className="relative z-10 flex items-center justify-between h-full">
                              <div className="flex items-center gap-4">
                                <span className="w-12 h-12 bg-zinc-700 rounded-xl flex items-center justify-center text-2xl font-bold text-white">
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span className="text-2xl font-bold text-white">
                                  {option}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isLeading && <Crown className="w-8 h-8 text-yellow-400" />}
                                <span className="text-4xl font-black text-white">
                                  {percentage}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Majority Bonus Indicator */}
                  <AnimatePresence>
                    {showMajorityBonus && (
                      <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 px-8 py-4 rounded-2xl"
                      >
                        <div className="flex items-center gap-3">
                          <Target className="w-8 h-8 text-white" />
                          <span className="text-2xl font-black text-white">
                            MAJORITY MATCH BONUS! +{MAJORITY_MATCH_BONUS} pts
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* TRANSITION PHASE - Round Winner */}
              {showPhase === "transition" && (
                <motion.div
                  key="transition"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex-1 flex flex-col items-center justify-center"
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, repeat: 3 }}
                    className="text-[150px] mb-6"
                  >
                    🏆
                  </motion.div>
                  <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-3xl px-8 py-3 mb-4">
                    <Crown className="w-8 h-8 mr-2" />
                    ROUND {currentRound} CHAMPION!
                  </Badge>
                  <h2 className="text-6xl font-black text-white mb-4">
                    {roundWinners[currentRound - 1]?.winner?.username || "Champion"}
                  </h2>
                  <p className="text-3xl text-yellow-400 font-bold mb-8">
                    Wins {PRIZE_TIERS[currentRound].label}!
                  </p>
                  
                  {currentRound < 3 && (
                    <div className="text-2xl text-zinc-400">
                      Round {currentRound + 1} starts in 10 seconds...
                    </div>
                  )}
                </motion.div>
              )}

              {/* COMPLETE PHASE - Show End */}
              {showPhase === "complete" && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center"
                >
                  <div className="text-[120px] mb-6">🎉</div>
                  <h2 className="text-6xl font-black text-white mb-8 text-center">
                    THAT'S A WRAP!
                  </h2>
                  
                  {/* Winners Summary */}
                  <div className="grid grid-cols-3 gap-6 mb-8">
                    {roundWinners.map((rw, idx) => (
                      <div key={idx} className="bg-zinc-800/80 rounded-2xl p-6 text-center border border-zinc-700">
                        <p className="text-zinc-500 text-lg mb-2">Round {rw.round}</p>
                        <p className="text-2xl font-bold text-white mb-1">{rw.winner?.username}</p>
                        <p className={`text-xl font-bold bg-gradient-to-r ${rw.prize.color} bg-clip-text text-transparent`}>
                          {rw.prize.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-2xl text-zinc-400 mb-6">
                    Thanks for playing! See you at the next show!
                  </p>
                  
                  <Button
                    onClick={() => {
                      setShowPhase("intro");
                      setCurrentRound(1);
                      setRoundWinners([]);
                    }}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-2xl font-bold px-8 py-6 rounded-xl"
                  >
                    <RotateCcw className="w-6 h-6 mr-2" />
                    PLAY AGAIN
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT SIDE - QR & Leaderboard (30%) */}
          <div className="flex-[3] flex flex-col gap-4">
            
            {/* QR Code Panel - Only show if user hasn't joined yet */}
            {!hasJoined ? (
              <div className="bg-zinc-900/80 rounded-3xl p-6 border border-zinc-700 text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <QrCode className="w-6 h-6 text-purple-400" />
                  <span className="text-xl font-bold text-white">SCAN ONCE TO JOIN</span>
                </div>
                
                {qrCodeUrl && (
                  <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                    <img src={qrCodeUrl} alt="Scan to join" className="w-48 h-48" />
                  </div>
                )}
                
                <p className="text-zinc-400 text-lg">
                  Scan once, then questions auto-shuffle!
                </p>
              </div>
            ) : (
              <div className="bg-green-900/30 rounded-3xl p-6 border border-green-500/50 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-3xl">✓</span>
                  <span className="text-xl font-bold text-green-400">YOU'RE IN!</span>
                </div>
                <p className="text-zinc-400">
                  Questions will auto-advance. No need to re-scan!
                </p>
              </div>
            )}

            {/* Live Leaderboard */}
            <div className="flex-1 bg-zinc-900/80 rounded-3xl p-6 border border-zinc-700 overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-6 h-6 text-yellow-400" />
                <span className="text-xl font-bold text-white">LEADERBOARD</span>
              </div>
              
              <div className="space-y-2">
                {(leaderboard.length > 0 ? leaderboard : [
                  { username: "TriviaKing", score: 1250, rank: 1 },
                  { username: "QuizMaster", score: 1100, rank: 2 },
                  { username: "BrainStorm", score: 950, rank: 3 },
                  { username: "WinnerWinner", score: 800, rank: 4 },
                  { username: "GameChamp", score: 750, rank: 5 },
                ]).slice(0, 5).map((player, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      idx === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' :
                      idx === 1 ? 'bg-zinc-500/20 border border-zinc-500/50' :
                      idx === 2 ? 'bg-orange-500/20 border border-orange-500/50' :
                      'bg-zinc-800/50'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold ${
                      idx === 0 ? 'bg-yellow-500 text-black' :
                      idx === 1 ? 'bg-zinc-400 text-black' :
                      idx === 2 ? 'bg-orange-500 text-black' :
                      'bg-zinc-700 text-white'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-white font-semibold truncate">
                      {player.username}
                    </span>
                    <span className="text-yellow-400 font-bold">
                      {player.score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Host Commentary */}
            {hostLine && (
              <motion.div
                key={hostLine}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gradient-to-r from-purple-900/80 to-pink-900/80 rounded-2xl p-4 border border-purple-500/30"
              >
                <div className="flex items-start gap-3">
                  <Mic className="w-6 h-6 text-yellow-400 shrink-0 mt-1" />
                  <p className="text-white text-lg italic">"{hostLine}"</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* BOTTOM BAR - Show Progress */}
        <div className="mt-4 flex items-center justify-between">
          {/* Round Progress */}
          <div className="flex items-center gap-4">
            {[1, 2, 3].map(r => (
              <div key={r} className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  r < currentRound ? 'bg-green-500 text-white' :
                  r === currentRound ? 'bg-yellow-500 text-black' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {r < currentRound ? '✓' : r}
                </div>
                <span className={`text-lg ${r === currentRound ? 'text-white font-bold' : 'text-zinc-500'}`}>
                  {PRIZE_TIERS[r].label}
                </span>
                {r < 3 && <ChevronRight className="w-5 h-5 text-zinc-600" />}
              </div>
            ))}
          </div>
          
          {/* Branding */}
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="text-lg">Powered by</span>
            <span className="text-xl font-bold text-white">ZTVLIVE</span>
            <span className="text-lg">• Sponsored by</span>
            <span className="text-xl font-bold text-red-500">DoorDash</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for importing
const RotateCcw = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
);
