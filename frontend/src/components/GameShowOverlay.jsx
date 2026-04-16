import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Clock, Users, Trophy, Sparkles, Play, X, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import QRCode from "qrcode";

const API = process.env.REACT_APP_BACKEND_URL || '';

// Ad content for between rounds
const ADS = [
  {
    id: "creator",
    title: "Become a ZTVLIVE Creator",
    subtitle: "Keep 70% of your revenue!",
    cta: "Sign Up Now",
    url: "/schedule-slot",
    bgGradient: "from-green-600 to-emerald-700",
    duration: 10
  },
  {
    id: "app",
    title: "Watch on Any Device",
    subtitle: "Roku, Fire TV, Samsung, LG",
    cta: "Get the App",
    url: "/download",
    bgGradient: "from-blue-600 to-cyan-700",
    duration: 8
  },
  {
    id: "premium",
    title: "ZTVLIVE Premium",
    subtitle: "Ad-free + Exclusive Content",
    cta: "Go Premium",
    url: "/premium",
    bgGradient: "from-purple-600 to-pink-700",
    duration: 10
  }
];

export default function GameShowOverlay({ isAdmin = false, onClose }) {
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const [currentAd, setCurrentAd] = useState(null);
  const [adTimeLeft, setAdTimeLeft] = useState(0);
  const [ws, setWs] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const timerRef = useRef(null);
  const adTimerRef = useRef(null);

  // Generate QR code
  const generateQRCode = async (url) => {
    try {
      const qr = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(qr);
    } catch (err) {
      console.error("QR generation error:", err);
    }
  };

  // Start a new game (admin only)
  const startNewGame = async (customQuestion = null) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/game-show/create`, {
        question: customQuestion,
        duration_seconds: 50,
        use_random: !customQuestion
      });
      
      setGame({
        ...res.data,
        votes: {},
        total_votes: 0,
        status: "active"
      });
      
      // Initialize votes object
      const votes = {};
      res.data.options.forEach(opt => votes[opt] = 0);
      setGame(prev => ({ ...prev, votes }));
      
      setRemainingTime(res.data.duration_seconds);
      await generateQRCode(res.data.qr_url);
      
      // Connect to WebSocket
      connectWebSocket(res.data.game_id);
      
    } catch (error) {
      console.error("Error starting game:", error);
    } finally {
      setLoading(false);
    }
  };

  // Connect to WebSocket for real-time updates
  const connectWebSocket = useCallback((gameId) => {
    if (ws) ws.close();
    
    const wsUrl = `${API.replace('https://', 'wss://').replace('http://', 'ws://')}/api/game-show/ws/${gameId}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("Game WebSocket connected");
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
        setRemainingTime(0);
        
        // Show ad after game ends
        if (data.ad) {
          setTimeout(() => {
            showAdBreak(data.ad);
          }, 3000); // Show results for 3 seconds first
        }
      }
    };

    setWs(websocket);
    return websocket;
  }, [ws]);

  // Countdown timer
  useEffect(() => {
    if (!game || remainingTime <= 0) return;

    timerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [game, remainingTime]);

  // Show ad break
  const showAdBreak = (ad) => {
    const adToShow = ad || ADS[Math.floor(Math.random() * ADS.length)];
    setCurrentAd(adToShow);
    setAdTimeLeft(adToShow.duration);
    setShowAd(true);
  };

  // Ad countdown
  useEffect(() => {
    if (!showAd || adTimeLeft <= 0) return;

    adTimerRef.current = setInterval(() => {
      setAdTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(adTimerRef.current);
          setShowAd(false);
          setCurrentAd(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (adTimerRef.current) clearInterval(adTimerRef.current);
    };
  }, [showAd, adTimeLeft]);

  // Get vote percentage
  const getPercentage = (option) => {
    if (!game || game.total_votes === 0) return 0;
    return Math.round((game.votes[option] / game.total_votes) * 100);
  };

  // Get winner
  const getWinner = () => {
    if (!game?.votes || game.total_votes === 0) return null;
    const entries = Object.entries(game.votes);
    return entries.reduce((a, b) => a[1] > b[1] ? a : b);
  };

  const isEnded = game?.status === "ended" || remainingTime <= 0;
  const winner = isEnded && game ? getWinner() : null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ws) ws.close();
      if (timerRef.current) clearInterval(timerRef.current);
      if (adTimerRef.current) clearInterval(adTimerRef.current);
    };
  }, [ws]);

  return (
    <AnimatePresence>
      {/* Ad Overlay */}
      {showAd && currentAd && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={`bg-gradient-to-br ${currentAd.bgGradient} p-8 rounded-2xl max-w-lg w-full mx-4 text-center shadow-2xl`}
          >
            <Badge className="bg-white/20 text-white mb-4">
              Ad • {adTimeLeft}s
            </Badge>
            <h2 className="text-3xl font-bold text-white mb-2">{currentAd.title}</h2>
            <p className="text-xl text-white/80 mb-6">{currentAd.subtitle}</p>
            <Button 
              className="bg-white text-black hover:bg-white/90 text-lg px-8 py-3"
              onClick={() => window.open(currentAd.url, '_blank')}
            >
              {currentAd.cta}
            </Button>
            <p className="text-white/60 text-sm mt-4">ztvlivestream.com</p>
          </motion.div>
        </motion.div>
      )}

      {/* Main Game Overlay - PIP Style */}
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className={`fixed ${isMinimized ? 'bottom-4 right-4 w-72' : 'top-20 right-4 w-80'} z-40 transition-all duration-300`}
      >
        <div className="bg-gradient-to-br from-purple-900/95 via-zinc-900/95 to-pink-900/95 backdrop-blur-lg rounded-2xl border border-purple-500/30 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="font-bold text-white text-sm uppercase tracking-wide">
                Fun Game Show
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? "+" : "-"}
              </Button>
              {onClose && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                  onClick={onClose}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {!isMinimized && (
            <div className="p-4">
              {/* No active game - Start button */}
              {!game && (
                <div className="text-center py-4">
                  <p className="text-zinc-400 text-sm mb-4">Ready to play?</p>
                  {isAdmin ? (
                    <Button
                      onClick={() => startNewGame()}
                      disabled={loading}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 w-full"
                    >
                      {loading ? "Starting..." : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Game
                        </>
                      )}
                    </Button>
                  ) : (
                    <p className="text-zinc-500 text-sm">Waiting for host to start...</p>
                  )}
                </div>
              )}

              {/* Active game */}
              {game && (
                <>
                  {/* Timer & Participants */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${remainingTime <= 10 && !isEnded ? 'text-red-400 animate-pulse' : 'text-purple-400'}`} />
                      <span className={`font-mono font-bold ${remainingTime <= 10 && !isEnded ? 'text-red-400' : 'text-white'}`}>
                        {isEnded ? "ENDED" : `${remainingTime}s`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-white font-medium">{game.total_votes}</span>
                    </div>
                  </div>

                  {/* Question */}
                  <div className="bg-zinc-800/50 rounded-lg p-3 mb-3">
                    <p className="text-white font-medium text-center">{game.question}</p>
                  </div>

                  {/* QR Code */}
                  {qrCodeUrl && !isEnded && (
                    <div className="flex justify-center mb-3">
                      <div className="bg-white p-2 rounded-lg">
                        <img src={qrCodeUrl} alt="Scan to vote" className="w-32 h-32" />
                      </div>
                    </div>
                  )}
                  
                  {!isEnded && (
                    <p className="text-center text-zinc-400 text-xs mb-3">
                      Scan QR code to vote!
                    </p>
                  )}

                  {/* Vote Results */}
                  <div className="space-y-2">
                    {game.options.map((option, idx) => {
                      const percentage = getPercentage(option);
                      const isWinning = winner && winner[0] === option;
                      
                      return (
                        <div key={idx} className="relative">
                          <div className={`relative overflow-hidden rounded-lg p-2 ${
                            isWinning ? 'bg-green-600/30 ring-2 ring-yellow-400' : 'bg-zinc-800/50'
                          }`}>
                            {/* Progress background */}
                            <div 
                              className={`absolute left-0 top-0 bottom-0 transition-all duration-500 ${
                                isWinning ? 'bg-green-500/30' : 'bg-purple-500/30'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                            
                            <div className="relative z-10 flex items-center justify-between">
                              <span className="text-white text-sm font-medium flex items-center gap-1">
                                {isWinning && <Trophy className="w-4 h-4 text-yellow-400" />}
                                {option}
                              </span>
                              <span className="text-white text-sm font-bold">
                                {percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Winner announcement */}
                  {isEnded && winner && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="mt-4 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/50 rounded-lg p-3 text-center"
                    >
                      <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                      <p className="text-yellow-400 font-bold">{winner[0]} wins!</p>
                      <p className="text-zinc-400 text-xs">{winner[1]} votes</p>
                    </motion.div>
                  )}

                  {/* New Game Button (Admin) */}
                  {isEnded && isAdmin && (
                    <Button
                      onClick={() => {
                        setGame(null);
                        setQrCodeUrl(null);
                      }}
                      className="w-full mt-3 bg-purple-600 hover:bg-purple-500"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      New Round
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
