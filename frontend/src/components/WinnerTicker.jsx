import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Gift, Sparkles } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function WinnerTicker() {
  const [winners, setWinners] = useState([]);
  const [currentWinner, setCurrentWinner] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    // Connect to ticker WebSocket
    const wsUrl = `${API.replace('https://', 'wss://').replace('http://', 'ws://')}/api/game-analytics/ticker/ws`;
    
    const connect = () => {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("Ticker connected");
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "recent_winners") {
          setWinners(data.winners || []);
        } else if (data.type === "new_winner") {
          // Show new winner announcement
          setCurrentWinner(data.winner);
          setWinners(prev => [data.winner, ...prev.slice(0, 19)]);
          
          // Hide after 5 seconds
          setTimeout(() => {
            setCurrentWinner(null);
          }, 5000);
        }
      };
      
      ws.onclose = () => {
        // Reconnect after 3 seconds
        setTimeout(connect, 3000);
      };
      
      wsRef.current = ws;
    };
    
    connect();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {currentWinner && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.8 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 p-1 rounded-2xl shadow-2xl shadow-yellow-500/30">
            <div className="bg-zinc-900 rounded-xl px-6 py-3 flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                <Trophy className="w-8 h-8 text-yellow-400" />
              </motion.div>
              
              <div>
                <p className="text-white font-bold text-lg">
                  {currentWinner.ticker_message}
                </p>
                <p className="text-yellow-400 text-sm font-semibold">
                  <Gift className="w-3 h-3 inline mr-1" />
                  {currentWinner.reward_name} - {currentWinner.reward_value}
                </p>
              </div>
              
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-6 h-6 text-pink-400" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
