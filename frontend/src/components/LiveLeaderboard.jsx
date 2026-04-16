import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Crown, Flame, TrendingUp, TrendingDown, Minus,
  Zap, Star, Award, Target, ChevronUp, ChevronDown, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API = process.env.REACT_APP_BACKEND_URL || '';

// Rank badge styles
const RANK_STYLES = {
  1: { bg: "from-yellow-500 to-amber-600", icon: Crown, glow: "shadow-yellow-500/50" },
  2: { bg: "from-zinc-300 to-zinc-400", icon: Trophy, glow: "shadow-zinc-400/50" },
  3: { bg: "from-orange-600 to-amber-700", icon: Award, glow: "shadow-orange-500/50" },
};

export default function LiveLeaderboard({ isOpen, onClose, isCompact = false }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [peakStats, setPeakStats] = useState({ peak_concurrent: 0, peak_timestamp: null, peak_creator: null });
  const [updatedPlayer, setUpdatedPlayer] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const wsUrl = `${API.replace('https://', 'wss://').replace('http://', 'ws://')}/api/game-analytics/leaderboard/ws`;
    
    const connect = () => {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("Leaderboard WebSocket connected");
        setIsConnected(true);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "leaderboard_update") {
          setLeaderboard(data.leaderboard || []);
          setPeakStats(data.peak_stats || {});
          
          if (data.updated_player) {
            setUpdatedPlayer(data.updated_player);
            // Clear highlight after animation
            setTimeout(() => setUpdatedPlayer(null), 2000);
          }
        }
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
      
      ws.onerror = () => {
        ws.close();
      };
      
      wsRef.current = ws;
    };
    
    connect();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [isOpen]);

  // Compact overlay for Watch page
  if (isCompact) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed right-4 top-20 z-40 w-72"
            data-testid="live-leaderboard-compact"
          >
            <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl border border-zinc-700 overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-white" />
                  <span className="font-bold text-white text-sm">LIVE LEADERBOARD</span>
                </div>
                <button 
                  onClick={onClose}
                  className="text-white/80 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Peak indicator */}
              {peakStats.peak_concurrent > 0 && (
                <div className="px-3 py-2 bg-gradient-to-r from-red-600/20 to-orange-600/20 border-b border-zinc-700">
                  <div className="flex items-center gap-2 text-xs">
                    <Flame className="w-3 h-3 text-orange-400 animate-pulse" />
                    <span className="text-orange-400 font-medium">
                      Peak: {peakStats.peak_concurrent} players
                    </span>
                  </div>
                </div>
              )}

              {/* Leaderboard */}
              <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                {leaderboard.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500 text-sm">
                    <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No players yet</p>
                    <p className="text-xs">Play trivia to join!</p>
                  </div>
                ) : (
                  leaderboard.slice(0, 5).map((player, idx) => (
                    <LeaderboardRow 
                      key={player.player_id} 
                      player={player} 
                      isUpdated={updatedPlayer?.player_id === player.player_id}
                      isCompact={true}
                    />
                  ))
                )}
              </div>

              {/* FOMO footer */}
              {leaderboard.length > 0 && (
                <div className="p-2 bg-zinc-800/50 border-t border-zinc-700">
                  <p className="text-xs text-center text-zinc-400">
                    <span className="text-yellow-400 font-bold">{leaderboard.length}</span> players competing
                    {leaderboard[0]?.streak >= 3 && (
                      <span className="ml-2 text-orange-400">
                        <Flame className="w-3 h-3 inline" /> Hot streak!
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Full leaderboard modal
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          data-testid="live-leaderboard-modal"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-zinc-900 rounded-2xl border border-zinc-700 w-full max-w-md mx-4 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-600 via-orange-500 to-red-600 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Trophy className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">LIVE LEADERBOARD</h2>
                    <p className="text-white/80 text-sm">Top 10 Trivia Champions</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Peak stats bar */}
              {peakStats.peak_concurrent > 0 && (
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                    <Flame className="w-4 h-4 text-yellow-300 animate-pulse" />
                    <span className="text-white font-medium">Peak: {peakStats.peak_concurrent}</span>
                  </div>
                  <div className="flex items-center gap-1 text-white/80">
                    <Zap className="w-4 h-4" />
                    <span>{leaderboard.length} competing now</span>
                  </div>
                </div>
              )}
            </div>

            {/* Connection status */}
            <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-700 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                {isConnected ? (
                  <span className="flex items-center gap-1 text-green-400">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Live Updates
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full" />
                    Connecting...
                  </span>
                )}
              </span>
              <Badge variant="outline" className="text-xs border-zinc-600">
                Updated live
              </Badge>
            </div>

            {/* Leaderboard */}
            <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
              {leaderboard.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <Target className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No players yet</p>
                  <p className="text-sm mt-1">Play the UNUSUAL FUN SHOW to join!</p>
                </div>
              ) : (
                leaderboard.map((player, idx) => (
                  <LeaderboardRow 
                    key={player.player_id} 
                    player={player} 
                    isUpdated={updatedPlayer?.player_id === player.player_id}
                    isCompact={false}
                  />
                ))
              )}
            </div>

            {/* FOMO footer */}
            {leaderboard.length > 0 && leaderboard[0] && (
              <div className="p-4 bg-gradient-to-r from-zinc-800 to-zinc-900 border-t border-zinc-700">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <p className="text-zinc-400">Leader:</p>
                    <p className="text-white font-bold">{leaderboard[0].username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-yellow-400">{leaderboard[0].score}</p>
                    <p className="text-xs text-zinc-500">points</p>
                  </div>
                </div>
                {leaderboard.length >= 2 && (
                  <div className="mt-2 text-center text-xs text-zinc-500">
                    Gap to #2: <span className="text-orange-400 font-medium">{leaderboard[0].score - leaderboard[1].score} pts</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Individual leaderboard row
function LeaderboardRow({ player, isUpdated, isCompact }) {
  const rankStyle = RANK_STYLES[player.rank] || { bg: "from-zinc-600 to-zinc-700", icon: Star, glow: "" };
  const RankIcon = rankStyle.icon;

  return (
    <motion.div
      initial={isUpdated ? { scale: 1.05, backgroundColor: "rgba(234, 179, 8, 0.2)" } : {}}
      animate={{ scale: 1, backgroundColor: "transparent" }}
      transition={{ duration: 0.5 }}
      className={`flex items-center gap-3 p-2 rounded-xl ${
        isUpdated ? "ring-2 ring-yellow-500" : ""
      } ${player.rank <= 3 ? "bg-zinc-800/50" : "bg-zinc-800/20"} ${
        isCompact ? "py-1.5" : ""
      }`}
    >
      {/* Rank badge */}
      <div className={`
        ${isCompact ? "w-7 h-7 text-xs" : "w-10 h-10 text-sm"} 
        rounded-xl bg-gradient-to-br ${rankStyle.bg} 
        flex items-center justify-center font-bold text-white
        shadow-lg ${rankStyle.glow}
      `}>
        {player.rank <= 3 ? (
          <RankIcon className={isCompact ? "w-4 h-4" : "w-5 h-5"} />
        ) : (
          player.rank
        )}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`font-medium text-white truncate ${isCompact ? "text-xs" : "text-sm"}`}>
            {player.username}
          </span>
          {player.streak >= 3 && (
            <Flame className={`text-orange-400 ${isCompact ? "w-3 h-3" : "w-4 h-4"}`} />
          )}
        </div>
        <div className={`flex items-center gap-2 text-zinc-500 ${isCompact ? "text-[10px]" : "text-xs"}`}>
          <span>{player.correct_answers} correct</span>
          {player.streak > 0 && (
            <span className="text-orange-400">{player.streak} streak</span>
          )}
        </div>
      </div>

      {/* Score & rank change */}
      <div className="text-right">
        <div className={`font-bold text-yellow-400 ${isCompact ? "text-sm" : "text-lg"}`}>
          {player.score}
        </div>
        {player.rank_change !== 0 && (
          <div className={`flex items-center justify-end gap-0.5 ${isCompact ? "text-[10px]" : "text-xs"}`}>
            {player.rank_change > 0 ? (
              <>
                <ChevronUp className="w-3 h-3 text-green-400" />
                <span className="text-green-400">+{player.rank_change}</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 text-red-400" />
                <span className="text-red-400">{player.rank_change}</span>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
