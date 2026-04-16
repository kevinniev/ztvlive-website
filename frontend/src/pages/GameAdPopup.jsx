import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, Users, Trophy, Zap, Gift, X, Volume2, VolumeX,
  Sparkles, Clock, Star, ChevronRight, Gamepad2
} from "lucide-react";
import { Button } from "../components/ui/button";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

// Floating emoji particles
const FloatingEmoji = ({ emoji, delay }) => (
  <motion.div
    className="absolute text-2xl pointer-events-none"
    initial={{ 
      x: Math.random() * 300, 
      y: 400,
      opacity: 0,
      scale: 0
    }}
    animate={{ 
      y: -100,
      opacity: [0, 1, 1, 0],
      scale: [0, 1.2, 1, 0.5],
      rotate: [0, 15, -15, 0]
    }}
    transition={{ 
      duration: 3,
      delay: delay,
      repeat: Infinity,
      repeatDelay: Math.random() * 2
    }}
  >
    {emoji}
  </motion.div>
);

// Pulsing ring effect
const PulseRing = ({ delay = 0 }) => (
  <motion.div
    className="absolute inset-0 rounded-full border-2 border-red-500"
    initial={{ scale: 0.8, opacity: 0.8 }}
    animate={{ scale: 1.5, opacity: 0 }}
    transition={{ 
      duration: 1.5, 
      delay,
      repeat: Infinity,
      ease: "easeOut"
    }}
  />
);

export default function GameAdPopup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [liveStats, setLiveStats] = useState({ players: 0, prizes: 100 });
  const [timeLeft, setTimeLeft] = useState(10);
  const [showAd, setShowAd] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentPrize, setCurrentPrize] = useState(0);
  
  // Check if embedded mode
  const isEmbed = searchParams.get('embed') === 'true';
  const autoClose = searchParams.get('autoclose') === 'true';
  const theme = searchParams.get('theme') || 'dark';

  // Prizes to cycle through
  const prizes = ["$10 DoorDash", "$25 Cash", "$5 Gift Card", "100 Points"];

  // Fetch live stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/api/live-survey/state`);
        setLiveStats({
          players: res.data.player_count || Math.floor(Math.random() * 50) + 30,
          prizes: 100
        });
      } catch (e) {
        // Fallback to simulated count
        setLiveStats({ players: Math.floor(Math.random() * 50) + 30, prizes: 100 });
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for urgency
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) return 60; // Reset to 60
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cycle through prizes
  useEffect(() => {
    const prizeInterval = setInterval(() => {
      setCurrentPrize(prev => (prev + 1) % prizes.length);
    }, 2000);
    return () => clearInterval(prizeInterval);
  }, []);

  // Handle play click
  const handlePlay = () => {
    // Track conversion
    try {
      axios.post(`${API}/api/analytics/track/tutorial`, null, {
        params: { event_type: 'ad_play_click', step_name: 'game_ad_popup' }
      });
    } catch (e) {}

    if (isEmbed) {
      // Open in new tab if embedded - with teaser mode
      window.open('https://www.ztvlivestream.com/play?teaser=true', '_blank');
    } else {
      navigate('/play?teaser=true');
    }
  };

  // Handle close
  const handleClose = () => {
    setShowAd(false);
    if (!isEmbed) {
      navigate(-1);
    }
  };

  if (!showAd) return null;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${
      theme === 'light' ? 'bg-gray-100' : 'bg-black/95'
    }`}>
      {/* Main Ad Container */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", damping: 15 }}
        className="relative w-full max-w-[360px] overflow-hidden"
      >
        {/* Ad Card */}
        <div className="relative bg-gradient-to-b from-zinc-900 via-black to-zinc-900 rounded-3xl border-2 border-red-600/50 shadow-2xl shadow-red-500/20 overflow-hidden">
          
          {/* Animated Background */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Gradient orbs */}
            <motion.div 
              className="absolute -top-20 -left-20 w-40 h-40 bg-red-600/30 rounded-full blur-3xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div 
              className="absolute -bottom-20 -right-20 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl"
              animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            
            {/* Floating emojis */}
            <FloatingEmoji emoji="🎮" delay={0} />
            <FloatingEmoji emoji="💰" delay={0.5} />
            <FloatingEmoji emoji="🏆" delay={1} />
            <FloatingEmoji emoji="🎉" delay={1.5} />
            <FloatingEmoji emoji="⭐" delay={2} />
          </div>

          {/* Close Button */}
          {!isEmbed && (
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 z-50 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
              data-testid="ad-close-btn"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          )}

          {/* Content */}
          <div className="relative z-10 p-6">
            
            {/* Live Badge */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-bold"
              >
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE NOW
              </motion.div>
              <div className="flex items-center gap-1 bg-green-600/80 text-white px-3 py-1.5 rounded-full text-sm">
                <Users className="w-3 h-3" />
                <motion.span
                  key={liveStats.players}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                >
                  {liveStats.players}
                </motion.span>
                playing
              </div>
            </div>

            {/* Logo & Title */}
            <div className="text-center mb-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-14 h-14 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/30 relative">
                  <Gamepad2 className="w-8 h-8 text-white" />
                  <PulseRing />
                  <PulseRing delay={0.5} />
                </div>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight">
                ZTV<span className="text-red-500">LIVE</span>
              </h1>
              <p className="text-yellow-400 font-bold text-lg mt-1">
                LIVE GAME SHOW
              </p>
            </div>

            {/* Prize Showcase */}
            <motion.div 
              className="bg-gradient-to-r from-yellow-600/20 via-yellow-500/30 to-yellow-600/20 border border-yellow-500/30 rounded-2xl p-4 mb-4"
              animate={{ borderColor: ['rgba(234,179,8,0.3)', 'rgba(234,179,8,0.6)', 'rgba(234,179,8,0.3)'] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 text-sm font-bold">WIN REAL PRIZES</span>
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPrize}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="text-center"
                >
                  <span className="text-3xl font-black text-white">{prizes[currentPrize]}</span>
                </motion.div>
              </AnimatePresence>
              <p className="text-center text-yellow-200/60 text-xs mt-1">Every 10 minutes!</p>
            </motion.div>

            {/* Urgency Timer */}
            <div className="bg-black/40 rounded-xl p-3 mb-4 border border-zinc-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-zinc-400 text-sm">Next round in:</span>
                </div>
                <motion.div
                  animate={{ scale: timeLeft <= 10 ? [1, 1.1, 1] : 1 }}
                  transition={{ duration: 0.5, repeat: timeLeft <= 10 ? Infinity : 0 }}
                  className={`font-mono font-bold text-xl ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}
                >
                  0:{timeLeft.toString().padStart(2, '0')}
                </motion.div>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { icon: Zap, label: "FREE", color: "text-green-400" },
                { icon: Gift, label: "PRIZES", color: "text-yellow-400" },
                { icon: Sparkles, label: "24/7", color: "text-purple-400" }
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="bg-zinc-800/50 rounded-lg p-2 text-center"
                >
                  <item.icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} />
                  <span className="text-white text-xs font-bold">{item.label}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={handlePlay}
                className="w-full h-14 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 hover:from-red-500 hover:via-red-400 hover:to-orange-400 text-white text-xl font-black rounded-2xl shadow-lg shadow-red-500/30 border-2 border-red-400/30 relative overflow-hidden group"
                data-testid="ad-play-btn"
              >
                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                />
                <span className="relative flex items-center justify-center gap-2">
                  <Play className="w-6 h-6 fill-current" />
                  PLAY NOW
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            </motion.div>

            {/* Bottom Text */}
            <p className="text-center text-zinc-500 text-xs mt-3">
              No download • No signup • 100% Free
            </p>
          </div>

          {/* Bottom Banner */}
          <div className="bg-gradient-to-r from-zinc-800 via-zinc-900 to-zinc-800 py-2 px-4 border-t border-zinc-700">
            <div className="flex items-center justify-center gap-2 text-xs">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              </motion.div>
              <span className="text-zinc-400">ztvlivestream.com/play</span>
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Embed Code Notice (only shown on standalone) */}
        {!isEmbed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-center"
          >
            <p className="text-zinc-500 text-sm mb-2">Embed this ad on your website:</p>
            <code className="bg-zinc-900 text-green-400 text-xs px-3 py-2 rounded-lg block overflow-x-auto">
              {`<iframe src="https://www.ztvlivestream.com/game-ad?embed=true" width="360" height="580" frameborder="0"></iframe>`}
            </code>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
