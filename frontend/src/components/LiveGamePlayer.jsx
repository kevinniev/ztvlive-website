import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Trophy, Clock, CheckCircle, XCircle, 
  Zap, Crown, Timer, TrendingUp, Award, Star
} from "lucide-react";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import confetti from "canvas-confetti";

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * LiveGamePlayer - 24/7 Live Game Component
 * 
 * Features:
 * - Join the live game from any device (PC, phone, tablet)
 * - See current question and countdown timer
 * - Vote and see real-time results
 * - "You vs The World" comparison after each question
 * - Track score and become a winner after 10 minutes
 */

export default function LiveGamePlayer({ embedded = false, onClose }) {
  // Connection state
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const wsRef = useRef(null);
  
  // Game state
  const [gameState, setGameState] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [shouldWait, setShouldWait] = useState(false);
  const [waitMessage, setWaitMessage] = useState("");
  
  // Voting state
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votes, setVotes] = useState({});
  const [totalVotes, setTotalVotes] = useState(0);
  
  // Results state
  const [showResults, setShowResults] = useState(false);
  const [myResult, setMyResult] = useState(null);
  
  // Player stats
  const [playerStats, setPlayerStats] = useState({
    score: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    accuracy: 0
  });
  
  // Winner notification
  const [isWinner, setIsWinner] = useState(false);
  const [winnerMessage, setWinnerMessage] = useState("");

  // Generate or get player ID
  useEffect(() => {
    let pid = localStorage.getItem('ztvlive_player_id');
    if (!pid) {
      pid = 'player_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ztvlive_player_id', pid);
    }
    setPlayerId(pid);
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (!playerId || wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/live-game/ws/${playerId}`);
    
    ws.onopen = () => {
      console.log('[LiveGame] Connected');
      setConnected(true);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleGameUpdate(data);
    };
    
    ws.onclose = () => {
      console.log('[LiveGame] Disconnected');
      setConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };
    
    ws.onerror = (error) => {
      console.error('[LiveGame] WebSocket error:', error);
    };
    
    wsRef.current = ws;
  }, [playerId]);

  useEffect(() => {
    if (playerId) {
      connectWebSocket();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [playerId, connectWebSocket]);

  // Handle game updates from WebSocket
  const handleGameUpdate = (data) => {
    console.log('[LiveGame] Update:', data.event || data.type);
    
    switch (data.event || data.type) {
      case 'connected':
      case 'new_question':
        setCurrentQuestion(data.question);
        setTimeRemaining(data.time_remaining);
        setVotes(data.votes || {});
        setTotalVotes(data.total_votes || 0);
        setShowResults(false);
        setSelectedOption(null);
        setHasVoted(false);
        setMyResult(null);
        
        if (data.time_remaining < 15) {
          setShouldWait(true);
          setWaitMessage(`Next question in ${data.time_remaining + 3} seconds...`);
        } else {
          setShouldWait(false);
        }
        break;
        
      case 'vote_update':
        setVotes(data.votes || {});
        setTotalVotes(data.total_votes || 0);
        break;
        
      case 'vote_confirmed':
        setHasVoted(true);
        toast.success(`Vote locked in: ${data.option}`);
        break;
        
      case 'results':
        setShowResults(true);
        if (data.last_results && playerId && data.last_results.player_results) {
          const result = data.last_results.player_results[playerId];
          if (result) {
            setMyResult(result);
            setPlayerStats({
              score: result.total_score,
              questionsAnswered: result.questions_answered,
              correctAnswers: result.total_score,
              accuracy: Math.round((result.total_score / result.questions_answered) * 100)
            });
            
            if (result.won_point) {
              confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
            }
          }
        }
        break;
        
      case 'winner_notification':
        if (data.player_id === playerId) {
          setIsWinner(true);
          setWinnerMessage(data.message);
          confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
          toast.success("YOU'RE A WINNER! 🎉", { duration: 10000 });
        }
        break;
        
      case 'heartbeat':
        setTimeRemaining(data.time_remaining);
        break;
    }
  };

  // Local timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Vote for an option
  const vote = (option) => {
    if (hasVoted || timeRemaining < 5 || shouldWait) return;
    
    setSelectedOption(option);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'vote', option }));
    }
  };

  // Calculate percentage
  const getPercent = (option) => {
    if (totalVotes === 0) return 0;
    return Math.round(((votes[option] || 0) / totalVotes) * 100);
  };

  // Render waiting screen
  if (shouldWait && !currentQuestion) {
    return (
      <div className={`${embedded ? '' : 'min-h-screen'} bg-gradient-to-br from-zinc-900 via-purple-900/20 to-zinc-900 flex items-center justify-center p-4`}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">Get Ready!</h2>
          <p className="text-purple-300">{waitMessage}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-gradient-to-br from-zinc-900 via-purple-900/20 to-zinc-900 text-white`}>
      <div className="max-w-2xl mx-auto p-4">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center">
              <span className="text-xl font-black">Z</span>
            </div>
            <div>
              <h1 className="text-lg font-bold">UNUSUAL FUN SHOW</h1>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                LIVE
              </div>
            </div>
          </div>
          
          {/* Player Stats */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-zinc-400">Your Score</div>
              <div className="text-xl font-bold text-yellow-400">{playerStats.score}</div>
            </div>
            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
        </div>

        {/* Timer Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-zinc-400">Time Remaining</span>
            <span className={`text-2xl font-mono font-bold ${timeRemaining <= 10 ? 'text-red-400' : 'text-white'}`}>
              {timeRemaining}s
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${timeRemaining <= 10 ? 'bg-red-500' : 'bg-purple-500'}`}
              initial={{ width: '100%' }}
              animate={{ width: `${(timeRemaining / 50) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Question Card */}
        {currentQuestion && (
          <motion.div
            key={currentQuestion.question}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-2xl p-5 mb-4 border border-purple-500/30"
          >
            <div className="text-center mb-2">
              <span className="text-xs bg-purple-500/30 px-2 py-1 rounded-full">
                {totalVotes.toLocaleString()} votes
              </span>
            </div>
            <h2 className="text-xl font-bold text-center">
              {currentQuestion.question}
            </h2>
          </motion.div>
        )}

        {/* Results View */}
        <AnimatePresence mode="wait">
          {showResults && myResult ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              {/* You vs World Header */}
              <div className="text-center py-4">
                <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                  YOU vs THE WORLD
                </h3>
              </div>
              
              {/* Result Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-xl p-4 text-center ${myResult.won_point ? 'bg-green-900/50 border-2 border-green-500' : 'bg-zinc-800/50'}`}>
                  <div className="text-sm text-zinc-400 mb-1">Your Answer</div>
                  <div className="text-lg font-bold mb-1">{myResult.your_answer}</div>
                  <div className="text-3xl font-black">{myResult.your_percent}%</div>
                  {myResult.won_point && (
                    <div className="flex items-center justify-center gap-1 mt-2 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-bold">+1 Point!</span>
                    </div>
                  )}
                </div>
                
                <div className="bg-yellow-900/30 rounded-xl p-4 text-center border-2 border-yellow-500/50">
                  <div className="text-sm text-zinc-400 mb-1">World Winner</div>
                  <div className="text-lg font-bold mb-1">{myResult.world_winner}</div>
                  <div className="text-3xl font-black text-yellow-400">{myResult.world_percent}%</div>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400">Majority</span>
                  </div>
                </div>
              </div>
              
              {/* Score Summary */}
              <div className="bg-zinc-800/50 rounded-xl p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-yellow-400">{playerStats.score}</div>
                    <div className="text-xs text-zinc-400">Total Score</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{playerStats.questionsAnswered}</div>
                    <div className="text-xs text-zinc-400">Questions</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-400">{playerStats.accuracy}%</div>
                    <div className="text-xs text-zinc-400">Accuracy</div>
                  </div>
                </div>
              </div>
              
              <div className="text-center text-sm text-zinc-400">
                Next question loading...
              </div>
            </motion.div>
          ) : (
            /* Voting Options */
            <motion.div
              key="voting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {currentQuestion?.options?.map((option, idx) => {
                const percent = getPercent(option);
                const isSelected = selectedOption === option;
                const isLeading = percent > 0 && percent >= Math.max(...(currentQuestion?.options || []).map(o => getPercent(o)));
                
                return (
                  <motion.button
                    key={option}
                    onClick={() => vote(option)}
                    disabled={hasVoted || timeRemaining < 5}
                    whileHover={!hasVoted && timeRemaining >= 5 ? { scale: 1.02 } : {}}
                    whileTap={!hasVoted && timeRemaining >= 5 ? { scale: 0.98 } : {}}
                    className={`
                      relative w-full text-left rounded-xl overflow-hidden transition-all
                      ${isSelected ? 'ring-2 ring-green-500 bg-green-900/30' : 'bg-zinc-800/70'}
                      ${hasVoted && !isSelected ? 'opacity-60' : ''}
                      ${hasVoted || timeRemaining < 5 ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-zinc-700/70'}
                    `}
                  >
                    {/* Progress bar */}
                    <motion.div
                      className={`absolute inset-0 ${isSelected ? 'bg-green-500/20' : isLeading ? 'bg-yellow-500/15' : 'bg-purple-500/15'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.5 }}
                    />
                    
                    <div className="relative p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg
                          ${isSelected ? 'bg-green-500 text-white' : 'bg-zinc-700/80'}
                        `}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="font-semibold">{option}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isSelected && <CheckCircle className="w-5 h-5 text-green-400" />}
                        {isLeading && !isSelected && <Crown className="w-4 h-4 text-yellow-400" />}
                        <span className="text-xl font-bold">{percent}%</span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
              
              {/* Vote status */}
              {hasVoted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-2"
                >
                  <span className="text-green-400 text-sm font-medium">
                    Vote locked! Waiting for results...
                  </span>
                </motion.div>
              )}
              
              {timeRemaining < 5 && !hasVoted && (
                <div className="text-center py-2">
                  <span className="text-red-400 text-sm">Too late to vote! Wait for next question.</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Winner Notification Modal */}
        <AnimatePresence>
          {isWinner && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-gradient-to-br from-yellow-900 to-orange-900 rounded-2xl p-8 text-center max-w-md border-2 border-yellow-500"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                  className="text-6xl mb-4"
                >
                  🏆
                </motion.div>
                <h2 className="text-3xl font-black text-yellow-400 mb-4">YOU'RE A WINNER!</h2>
                <p className="text-white mb-6">{winnerMessage}</p>
                <Button
                  onClick={() => {
                    setIsWinner(false);
                    window.location.href = '/login?claim=prize';
                  }}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-8 py-3"
                >
                  Log In & Claim Prize
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Stats */}
        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-zinc-400">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{totalVotes.toLocaleString()} playing</span>
          </div>
          <div className="flex items-center gap-1">
            <Timer className="w-4 h-4" />
            <span>50s per question</span>
          </div>
        </div>
      </div>
    </div>
  );
}
