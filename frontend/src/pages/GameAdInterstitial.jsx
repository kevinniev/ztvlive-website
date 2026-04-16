import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, Users, Trophy, Zap, Gift, X, 
  Sparkles, Clock, Star, ChevronRight, Gamepad2, Volume2
} from "lucide-react";
import { Button } from "../components/ui/button";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

// Floating particles
const FloatingParticle = ({ emoji, index }) => (
  <motion.div
    className="absolute text-3xl pointer-events-none z-10"
    initial={{ 
      x: Math.random() * 400 - 200, 
      y: 600,
      opacity: 0,
      scale: 0
    }}
    animate={{ 
      y: -200,
      opacity: [0, 1, 1, 0],
      scale: [0, 1.5, 1, 0.5],
      rotate: [0, 20, -20, 0]
    }}
    transition={{ 
      duration: 4,
      delay: index * 0.8,
      repeat: Infinity,
      repeatDelay: Math.random() * 3
    }}
  >
    {emoji}
  </motion.div>
);

export default function GameAdInterstitial() {
  const [liveCount, setLiveCount] = useState(47);
  const [showAd, setShowAd] = useState(true);
  const [canClose, setCanClose] = useState(false);
  const [closeCountdown, setCloseCountdown] = useState(5);
  const [currentPrize, setCurrentPrize] = useState(0);
  const [pulseCount, setPulseCount] = useState(false);
  
  const prizes = ["$10 DoorDash", "$25 Cash", "$50 Visa", "100 Points"];
  const emojis = ["🎮", "💰", "🏆", "🎉", "⭐", "💎", "🔥", "✨"];

  // Fetch real player count and simulate ticking up
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await axios.get(`${API}/api/live-survey/state`);
        const realCount = res.data.player_count || 40;
        setLiveCount(realCount);
      } catch (e) {
        // Fallback
      }
    };
    fetchCount();

    // Tick up player count randomly to simulate real-time activity
    const tickInterval = setInterval(() => {
      setLiveCount(prev => {
        const change = Math.random() > 0.5 ? Math.floor(Math.random() * 3) + 1 : -Math.floor(Math.random() * 2);
        const newCount = Math.max(30, Math.min(150, prev + change));
        if (change > 0) {
          setPulseCount(true);
          setTimeout(() => setPulseCount(false), 300);
        }
        return newCount;
      });
    }, 2000);

    return () => clearInterval(tickInterval);
  }, []);

  // Close countdown (5 seconds before they can close)
  useEffect(() => {
    if (closeCountdown > 0) {
      const timer = setTimeout(() => {
        setCloseCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanClose(true);
    }
  }, [closeCountdown]);

  // Cycle through prizes
  useEffect(() => {
    const prizeInterval = setInterval(() => {
      setCurrentPrize(prev => (prev + 1) % prizes.length);
    }, 2500);
    return () => clearInterval(prizeInterval);
  }, []);

  // Handle play click
  const handlePlay = () => {
    // Track conversion
    try {
      axios.post(`${API}/api/analytics/track/tutorial`, null, {
        params: { event_type: 'interstitial_play_click', step_name: 'mobile_game_ad' }
      });
    } catch (e) {}
    
    // Open game with teaser mode
    window.open('https://www.ztvlivestream.com/play?teaser=true', '_blank');
  };

  // Handle close
  const handleClose = () => {
    if (canClose) {
      setShowAd(false);
      // Try to close the window/iframe
      try { window.close(); } catch(e) {}
    }
  };

  if (!showAd) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-red-600/30 via-transparent to-transparent rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-yellow-500/20 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-3xl"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        
        {/* Floating emoji particles */}
        <div className="absolute inset-0 flex justify-center">
          {emojis.map((emoji, i) => (
            <FloatingParticle key={i} emoji={emoji} index={i} />
          ))}
        </div>
      </div>

      {/* AD Label */}
      <div className="absolute top-4 left-4 z-50">
        <div className="bg-zinc-800/80 text-zinc-400 text-xs font-bold px-2 py-1 rounded border border-zinc-700">
          AD
        </div>
      </div>

      {/* Close Button with Countdown */}
      <div className="absolute top-4 right-4 z-50">
        {canClose ? (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={handleClose}
            className="w-10 h-10 bg-zinc-800/80 hover:bg-zinc-700 rounded-full flex items-center justify-center border border-zinc-600 transition-colors"
            data-testid="ad-close-btn"
          >
            <X className="w-5 h-5 text-white" />
          </motion.button>
        ) : (
          <div className="w-10 h-10 bg-zinc-800/80 rounded-full flex items-center justify-center border border-zinc-600 relative">
            <span className="text-white font-bold text-sm">{closeCountdown}</span>
            {/* Circular progress */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="rgba(239, 68, 68, 0.3)"
                strokeWidth="3"
              />
              <motion.circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ strokeDasharray: "113", strokeDashoffset: "0" }}
                animate={{ strokeDashoffset: `${113 * (1 - (5 - closeCountdown) / 5)}` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </svg>
          </div>
        )}
      </div>

      {/* Main Ad Content */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 15, delay: 0.2 }}
        className="relative z-20 w-full max-w-md mx-4"
      >
        {/* Live Player Count - Floating Badge */}
        <motion.div 
          className="flex justify-center mb-6"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-full text-base font-bold shadow-lg shadow-red-500/30"
            >
              <span className="w-3 h-3 bg-white rounded-full animate-pulse" />
              LIVE NOW
            </motion.div>
            <motion.div 
              className={`flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-full text-base font-bold shadow-lg shadow-green-500/30 transition-transform ${pulseCount ? 'scale-110' : 'scale-100'}`}
            >
              <Users className="w-4 h-4" />
              <motion.span
                key={liveCount}
                initial={{ scale: 1.3, color: "#4ade80" }}
                animate={{ scale: 1, color: "#ffffff" }}
                transition={{ duration: 0.3 }}
              >
                {liveCount}
              </motion.span>
              <span className="text-green-200">playing</span>
            </motion.div>
          </div>
        </motion.div>

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <motion.div 
              className="w-20 h-20 bg-gradient-to-br from-red-600 to-red-700 rounded-3xl flex items-center justify-center shadow-2xl shadow-red-500/40 relative"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Gamepad2 className="w-10 h-10 text-white" />
              {/* Pulse rings */}
              <motion.div
                className="absolute inset-0 rounded-3xl border-2 border-red-500"
                animate={{ scale: [1, 1.3], opacity: [0.8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 rounded-3xl border-2 border-red-500"
                animate={{ scale: [1, 1.3], opacity: [0.8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              />
            </motion.div>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight">
            ZTV<span className="text-red-500">LIVE</span>
          </h1>
          <p className="text-yellow-400 font-bold text-xl mt-2">
            LIVE GAME SHOW
          </p>
        </div>

        {/* Prize Showcase */}
        <motion.div 
          className="bg-gradient-to-r from-yellow-600/20 via-yellow-500/30 to-yellow-600/20 border-2 border-yellow-500/40 rounded-2xl p-5 mb-6 mx-4"
          animate={{ 
            borderColor: ['rgba(234,179,8,0.4)', 'rgba(234,179,8,0.8)', 'rgba(234,179,8,0.4)'],
            boxShadow: ['0 0 20px rgba(234,179,8,0.1)', '0 0 40px rgba(234,179,8,0.3)', '0 0 20px rgba(234,179,8,0.1)']
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <span className="text-yellow-400 text-sm font-bold uppercase tracking-wider">Win Real Prizes</span>
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPrize}
              initial={{ y: 30, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -30, opacity: 0, scale: 0.8 }}
              className="text-center"
            >
              <span className="text-4xl font-black text-white">{prizes[currentPrize]}</span>
            </motion.div>
          </AnimatePresence>
          <p className="text-center text-yellow-200/60 text-sm mt-2">Every 10 minutes!</p>
        </motion.div>

        {/* Feature Pills */}
        <div className="flex justify-center gap-3 mb-6 px-4">
          {[
            { icon: Zap, label: "100% FREE", color: "bg-green-600/20 text-green-400 border-green-500/30" },
            { icon: Gift, label: "REAL PRIZES", color: "bg-yellow-600/20 text-yellow-400 border-yellow-500/30" },
            { icon: Clock, label: "24/7 LIVE", color: "bg-purple-600/20 text-purple-400 border-purple-500/30" }
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-bold ${item.color}`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        <div className="px-4">
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Button
              onClick={handlePlay}
              className="w-full h-16 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-500 hover:via-red-400 hover:to-orange-400 text-white text-2xl font-black rounded-2xl shadow-2xl shadow-red-500/40 border-2 border-red-400/50 relative overflow-hidden group"
              data-testid="interstitial-play-btn"
            >
              {/* Shine effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              />
              <span className="relative flex items-center justify-center gap-3">
                <Play className="w-7 h-7 fill-current" />
                PLAY NOW — IT'S FREE!
                <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </span>
            </Button>
          </motion.div>
        </div>

        {/* Bottom text */}
        <p className="text-center text-zinc-500 text-sm mt-4">
          No download needed • No signup required
        </p>
        
        {/* Website URL */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-zinc-400 text-sm font-medium">ztvlivestream.com</span>
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
        </div>
      </motion.div>
    </div>
  );
}
