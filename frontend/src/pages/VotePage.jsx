import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Vote, Check, Clock, Trophy, Users, PartyPopper, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function VotePage() {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [voterId, setVoterId] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [ws, setWs] = useState(null);

  // Generate or retrieve voter ID
  useEffect(() => {
    let id = localStorage.getItem(`ztv_voter_${gameId}`);
    if (!id) {
      id = `voter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    setVoterId(id);
  }, [gameId]);

  // Fetch game data
  const fetchGame = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/game-show/game/${gameId}`);
      
      // Check if game was found
      if (res.data.status === "not_found") {
        setGame({ status: "not_found", error: res.data.error });
        setLoading(false);
        return;
      }
      
      setGame(res.data);
      setRemainingTime(res.data.remaining_seconds || 0);
      
      // Check if already voted
      if (res.data.voters?.includes(voterId)) {
        setVoted(true);
      }
    } catch (error) {
      console.error("Error fetching game:", error);
      setGame({ status: "not_found", error: "Game not found or has ended" });
    } finally {
      setLoading(false);
    }
  }, [gameId, voterId]);

  useEffect(() => {
    if (gameId) {
      fetchGame();
    }
  }, [gameId, fetchGame]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!gameId) return;

    const wsUrl = `${API.replace('https://', 'wss://').replace('http://', 'ws://')}/api/game-show/ws/${gameId}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("Connected to game WebSocket");
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "vote_update") {
        setGame(prev => ({
          ...prev,
          votes: data.votes,
          total_votes: data.total_votes
        }));
      } else if (data.type === "game_ended") {
        setGame(data.game);
      } else if (data.type === "game_state") {
        setGame(data.game);
        setRemainingTime(data.remaining_seconds);
      }
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [gameId]);

  // Countdown timer
  useEffect(() => {
    if (remainingTime <= 0 || game?.status === "ended") return;

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingTime, game?.status]);

  // Submit vote
  const handleVote = async (optionIndex) => {
    if (voted || voting || game?.status === "ended") return;

    setVoting(true);
    setSelectedOption(optionIndex);

    try {
      const res = await axios.post(`${API}/api/game-show/vote`, {
        game_id: gameId,
        option_index: optionIndex,
        voter_id: voterId
      });

      if (res.data.success) {
        setVoted(true);
        localStorage.setItem(`ztv_voter_${gameId}`, voterId);
        toast.success("Vote submitted!");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to vote");
      setSelectedOption(null);
    } finally {
      setVoting(false);
    }
  };

  // Calculate vote percentages
  const getPercentage = (option) => {
    if (!game || game.total_votes === 0) return 0;
    return Math.round((game.votes[option] / game.total_votes) * 100);
  };

  // Get winner
  const getWinner = () => {
    if (!game?.votes) return null;
    const entries = Object.entries(game.votes);
    if (entries.length === 0) return null;
    return entries.reduce((a, b) => a[1] > b[1] ? a : b);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-zinc-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-white">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game || game.status === "not_found") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-zinc-900 to-pink-900 flex items-center justify-center p-4">
        <Card className="bg-zinc-800/80 border-zinc-700 max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4">😕</div>
            <h1 className="text-2xl font-bold text-white mb-2">Game Not Found</h1>
            <p className="text-zinc-400 mb-6">This game may have ended or doesn't exist.</p>
            <a href="/watch" className="inline-block">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                Watch ZTVLIVE
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isEnded = game.status === "ended" || remainingTime <= 0;
  const winner = isEnded ? getWinner() : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-zinc-900 to-pink-900 p-4">
      <div className="max-w-lg mx-auto pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-yellow-400" />
            <h1 className="text-xl font-bold text-white uppercase tracking-wider">
              ZTVLIVE Unusual Fun Game Show
            </h1>
            <Sparkles className="w-6 h-6 text-yellow-400" />
          </div>
          
          {/* Timer */}
          {!isEnded && (
            <div className="flex items-center justify-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-red-400 animate-pulse" />
              <span className={`font-mono font-bold ${remainingTime <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
                {remainingTime}s
              </span>
            </div>
          )}
          
          {/* Participants count */}
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-zinc-400">
            <Users className="w-4 h-4" />
            <span>{game.total_votes} participant{game.total_votes !== 1 ? 's' : ''}</span>
          </div>
        </motion.div>

        {/* Question Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-zinc-800/90 border-purple-500/50 border-2 mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
              <h2 className="text-xl md:text-2xl font-bold text-white text-center">
                {game.question}
              </h2>
            </div>
            
            <CardContent className="p-4 space-y-3">
              {game.options.map((option, index) => {
                const percentage = getPercentage(option);
                const isWinning = winner && winner[0] === option;
                const isSelected = selectedOption === index;
                
                return (
                  <motion.div
                    key={option}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <Button
                      onClick={() => handleVote(index)}
                      disabled={voted || voting || isEnded}
                      className={`w-full h-auto py-4 px-4 relative overflow-hidden transition-all ${
                        isWinning
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 ring-2 ring-yellow-400'
                          : isSelected
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                            : voted || isEnded
                              ? 'bg-zinc-700 hover:bg-zinc-700'
                              : 'bg-zinc-700 hover:bg-zinc-600'
                      }`}
                    >
                      {/* Progress bar background */}
                      {(voted || isEnded) && (
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-white/10 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      )}
                      
                      <div className="relative z-10 flex items-center justify-between w-full">
                        <span className="text-left font-medium text-lg flex items-center gap-2">
                          {isWinning && <Trophy className="w-5 h-5 text-yellow-400" />}
                          {isSelected && voted && <Check className="w-5 h-5 text-green-400" />}
                          {option}
                        </span>
                        
                        {(voted || isEnded) && (
                          <span className="font-bold text-lg">
                            {percentage}% ({game.votes[option]})
                          </span>
                        )}
                      </div>
                    </Button>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Messages */}
        <AnimatePresence>
          {voted && !isEnded && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="bg-green-600/20 border border-green-500/50 rounded-lg p-4 mb-4">
                <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-medium">Vote submitted! Waiting for results...</p>
              </div>
            </motion.div>
          )}
          
          {isEnded && winner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/50 rounded-lg p-6">
                <PartyPopper className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-white mb-2">Winner!</h3>
                <p className="text-3xl font-bold text-yellow-400">{winner[0]}</p>
                <p className="text-zinc-400 mt-2">with {winner[1]} votes ({getPercentage(winner[0])}%)</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ZTVLIVE Branding */}
        <div className="text-center mt-8 text-zinc-500 text-sm">
          <p>Powered by <span className="text-purple-400 font-bold">ZTVLIVE</span></p>
          <p>ztvlivestream.com</p>
        </div>
      </div>
    </div>
  );
}
