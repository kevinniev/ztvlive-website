import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, QrCode, Trophy, Zap, Users, Clock, ChevronRight, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";

/**
 * UNUSUAL FUN GAME SHOW - 90-Second Intro Sequence
 * 
 * Timeline:
 * [0:00 - 0:10] The Hook: 5-4-3-2-1 countdown
 * [0:10 - 0:25] The Brand: ZTVLIVE logo slam
 * [0:25 - 0:40] The Join Flow: QR code slide-in
 * [0:40 - 0:60] The Stakes: Prize tier infographic
 * [0:60 - 0:80] The Credibility: 15+ years experience
 * [0:80 - 0:90] The Launch: Host + "Let's get UNUSUAL!"
 */

// Voiceover lines (for display/reference)
const VO_LINES = {
  hook: "Live from the heart of the digital arena… this isn't a stream. This is a revolution.",
  brand: "The only place where the screen is the scoreboard, and your phone… is the controller.",
  join: "Grab your phone, scan the QR code on your screen right now... You're in the game in seconds.",
  stakes: "Three rounds. Three winners. Real prizes delivered to your door.",
  credibility: "Backed by 15+ years of broadcast experience. Now streaming on Roku, Fire TV, and more.",
  launch: "The first 10-minute clock starts… NOW. Let's get UNUSUAL!"
};

// Prize tiers
const PRIZE_TIERS = [
  { minute: 10, amount: "$5", color: "from-green-400 to-emerald-600", label: "Round 1" },
  { minute: 20, amount: "$10", color: "from-blue-400 to-cyan-600", label: "Round 2" },
  { minute: 30, amount: "$15", color: "from-yellow-400 to-orange-500", label: "Grand Finale" }
];

// Live ticker messages
const TICKER_MESSAGES = [
  "🔴 LIVE NOW: The Unusual Fun Game Show",
  "📱 Scan QR to Join the Pool",
  "🏆 Next $5 Payout in 9:59",
  "👥 127,450 Players in Pool",
  "🎮 Your Phone is the Controller",
  "💰 $30 Total Prizes Every Show"
];

export default function IntroSequence() {
  const [phase, setPhase] = useState("idle"); // idle, countdown, brand, join, stakes, credibility, launch, playing
  const [countdown, setCountdown] = useState(5);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef(null);

  // Generate QR code
  useEffect(() => {
    const joinUrl = `${window.location.origin}/watch?auto_join=true&show=unusual_fun`;
    QRCode.toDataURL(joinUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrCodeUrl);
  }, []);

  // Ticker rotation
  useEffect(() => {
    if (phase !== "idle") {
      const tickerTimer = setInterval(() => {
        setTickerIndex(prev => (prev + 1) % TICKER_MESSAGES.length);
      }, 3000);
      return () => clearInterval(tickerTimer);
    }
  }, [phase]);

  // Main sequence timer
  useEffect(() => {
    if (isPlaying && phase !== "idle") {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 100;
          
          // Phase transitions based on elapsed time (in ms)
          if (newTime >= 0 && newTime < 10000 && phase === "countdown") {
            // Countdown phase - handled separately
          } else if (newTime >= 10000 && newTime < 25000 && phase !== "brand") {
            setPhase("brand");
          } else if (newTime >= 25000 && newTime < 40000 && phase !== "join") {
            setPhase("join");
          } else if (newTime >= 40000 && newTime < 60000 && phase !== "stakes") {
            setPhase("stakes");
          } else if (newTime >= 60000 && newTime < 80000 && phase !== "credibility") {
            setPhase("credibility");
          } else if (newTime >= 80000 && newTime < 90000 && phase !== "launch") {
            setPhase("launch");
          } else if (newTime >= 90000) {
            setPhase("playing");
            setIsPlaying(false);
            clearInterval(timerRef.current);
          }
          
          return newTime;
        });
      }, 100);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, phase]);

  // Countdown logic
  useEffect(() => {
    if (phase === "countdown" && countdown > 0) {
      const countTimer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(countTimer);
    }
  }, [phase, countdown]);

  const startIntro = () => {
    setPhase("countdown");
    setCountdown(5);
    setElapsedTime(0);
    setIsPlaying(true);
  };

  const resetIntro = () => {
    setPhase("idle");
    setCountdown(5);
    setElapsedTime(0);
    setIsPlaying(false);
  };

  // Jump to specific phase (for preview)
  const jumpToPhase = (targetPhase, time) => {
    setPhase(targetPhase);
    setElapsedTime(time);
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Main Content Area */}
      <div className="relative w-full h-full">
        
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-red-900/20" />
        
        {/* Animated Grid Background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }} />
        </div>

        {/* IDLE STATE */}
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-[120px] mb-8"
              >
                🎬
              </motion.div>
              <h1 className="text-5xl font-black text-white mb-4">
                90-SECOND INTRO PREVIEW
              </h1>
              <p className="text-xl text-zinc-400 mb-8">
                "The Unusual Fun Game Show" Opening Sequence
              </p>
              <Button
                onClick={startIntro}
                className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white text-2xl font-black px-12 py-8 rounded-2xl"
              >
                <Play className="w-8 h-8 mr-3" />
                PLAY INTRO
              </Button>
            </motion.div>
          )}

          {/* COUNTDOWN PHASE [0:00 - 0:10] */}
          {phase === "countdown" && (
            <motion.div
              key="countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {/* Pulsing background rings */}
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border-2 border-red-500/30"
                  initial={{ width: 100, height: 100, opacity: 0.8 }}
                  animate={{ 
                    width: [100, 800], 
                    height: [100, 800], 
                    opacity: [0.8, 0] 
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    delay: i * 0.4,
                    ease: "easeOut"
                  }}
                />
              ))}
              
              {/* Countdown Number */}
              <motion.div
                key={countdown}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="relative z-10"
              >
                <span className="text-[300px] font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-orange-600 drop-shadow-2xl">
                  {countdown > 0 ? countdown : "GO!"}
                </span>
              </motion.div>

              {/* VO Text */}
              <motion.p
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-32 text-2xl text-zinc-300 italic max-w-3xl text-center px-8"
              >
                "{VO_LINES.hook}"
              </motion.p>
            </motion.div>
          )}

          {/* BRAND PHASE [0:10 - 0:25] */}
          {phase === "brand" && (
            <motion.div
              key="brand"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              {/* Logo Slam */}
              <motion.div
                initial={{ scale: 3, opacity: 0, rotateY: 90 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ type: "spring", duration: 1, bounce: 0.4 }}
                className="relative"
              >
                {/* Gold glow effect */}
                <div className="absolute inset-0 blur-3xl bg-gradient-to-r from-yellow-400 to-orange-500 opacity-50" />
                
                <div className="relative flex items-center gap-6">
                  <div className="w-32 h-32 bg-gradient-to-br from-red-600 to-red-700 rounded-3xl flex items-center justify-center shadow-2xl shadow-red-500/50">
                    <span className="text-7xl font-black text-white">Z</span>
                  </div>
                  <div>
                    <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400">
                      ZTVLIVE
                    </h1>
                    <p className="text-3xl text-yellow-400/80 font-semibold tracking-wider">
                      THE UNUSUAL FUN SHOW
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* VO Text */}
              <motion.p
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute bottom-32 text-2xl text-zinc-300 italic max-w-3xl text-center px-8"
              >
                "{VO_LINES.brand}"
              </motion.p>
            </motion.div>
          )}

          {/* JOIN FLOW PHASE [0:25 - 0:40] */}
          {phase === "join" && (
            <motion.div
              key="join"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="flex items-center gap-16">
                {/* Phone mockup */}
                <motion.div
                  initial={{ x: -200, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="text-[150px]"
                >
                  📱
                </motion.div>

                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", duration: 0.8, delay: 0.3 }}
                >
                  <ChevronRight className="w-24 h-24 text-yellow-400" />
                </motion.div>

                {/* QR Code with glowing border */}
                <motion.div
                  initial={{ x: 200, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8, delay: 0.5 }}
                  className="relative"
                >
                  {/* Glowing border animation */}
                  <motion.div
                    className="absolute -inset-4 rounded-3xl"
                    animate={{
                      boxShadow: [
                        "0 0 20px 5px rgba(234, 179, 8, 0.5)",
                        "0 0 40px 10px rgba(234, 179, 8, 0.8)",
                        "0 0 20px 5px rgba(234, 179, 8, 0.5)"
                      ]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  
                  <div className="relative bg-white p-6 rounded-2xl">
                    {qrCodeUrl && (
                      <img src={qrCodeUrl} alt="Scan to join" className="w-64 h-64" />
                    )}
                  </div>
                  
                  <motion.p
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-center text-2xl font-bold text-yellow-400 mt-4"
                  >
                    SCAN NOW!
                  </motion.p>
                </motion.div>
              </div>

              {/* VO Text */}
              <motion.p
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute bottom-32 text-2xl text-zinc-300 italic max-w-3xl text-center px-8"
              >
                "{VO_LINES.join}"
              </motion.p>
            </motion.div>
          )}

          {/* STAKES PHASE [0:40 - 0:60] */}
          {phase === "stakes" && (
            <motion.div
              key="stakes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <motion.h2
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-5xl font-black text-white mb-12"
              >
                THREE ROUNDS. THREE WINNERS.
              </motion.h2>

              {/* Prize Tiers */}
              <div className="flex items-end gap-8">
                {PRIZE_TIERS.map((tier, idx) => (
                  <motion.div
                    key={tier.minute}
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 + idx * 0.3 }}
                    className="relative"
                  >
                    {/* Jackpot Glow Effect */}
                    <motion.div
                      className={`absolute inset-0 blur-2xl bg-gradient-to-t ${tier.color} opacity-50`}
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, delay: idx * 0.3 }}
                    />
                    
                    <div className={`relative bg-gradient-to-t ${tier.color} rounded-3xl p-8 text-center`}
                      style={{ height: `${180 + idx * 60}px`, width: '200px' }}
                    >
                      <p className="text-white/80 text-lg font-semibold">{tier.label}</p>
                      <p className="text-6xl font-black text-white my-4">{tier.amount}</p>
                      <div className="flex items-center justify-center gap-2 text-white/80">
                        <Clock className="w-5 h-5" />
                        <span>{tier.minute} min</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* VO Text */}
              <motion.p
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="absolute bottom-32 text-2xl text-zinc-300 italic max-w-3xl text-center px-8"
              >
                "{VO_LINES.stakes}"
              </motion.p>
            </motion.div>
          )}

          {/* CREDIBILITY PHASE [0:60 - 0:80] */}
          {phase === "credibility" && (
            <motion.div
              key="credibility"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center"
              >
                <motion.p
                  initial={{ y: -30 }}
                  animate={{ y: 0 }}
                  className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-4"
                >
                  15+ YEARS
                </motion.p>
                <p className="text-3xl text-zinc-300 mb-12">
                  of Broadcast Excellence
                </p>
              </motion.div>

              {/* Platform Logos */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-12"
              >
                {["ROKU", "FIRE TV", "SAMSUNG", "LG", "WEB"].map((platform, idx) => (
                  <motion.div
                    key={platform}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 + idx * 0.1 }}
                    className="bg-zinc-800/50 px-6 py-3 rounded-xl border border-zinc-700"
                  >
                    <span className="text-xl font-bold text-white">{platform}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* VO Text */}
              <motion.p
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="absolute bottom-32 text-2xl text-zinc-300 italic max-w-3xl text-center px-8"
              >
                "{VO_LINES.credibility}"
              </motion.p>
            </motion.div>
          )}

          {/* LAUNCH PHASE [0:80 - 0:90] */}
          {phase === "launch" && (
            <motion.div
              key="launch"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="flex items-center gap-16">
                {/* Host placeholder */}
                <motion.div
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="text-center"
                >
                  <div className="w-48 h-48 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mb-4 shadow-2xl shadow-purple-500/50">
                    <span className="text-8xl">🎤</span>
                  </div>
                  <p className="text-2xl font-bold text-white">YOUR HOST</p>
                </motion.div>

                {/* Launch Text */}
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", delay: 0.3 }}
                  className="text-center"
                >
                  <motion.p
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500"
                  >
                    LET'S GET
                  </motion.p>
                  <motion.p
                    animate={{ 
                      textShadow: [
                        "0 0 20px rgba(234, 179, 8, 0.5)",
                        "0 0 60px rgba(234, 179, 8, 1)",
                        "0 0 20px rgba(234, 179, 8, 0.5)"
                      ]
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-9xl font-black text-yellow-400"
                  >
                    UNUSUAL!
                  </motion.p>
                </motion.div>

                {/* Persistent QR */}
                <motion.div
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="relative"
                >
                  <div className="bg-white p-4 rounded-xl">
                    {qrCodeUrl && (
                      <img src={qrCodeUrl} alt="Scan to join" className="w-32 h-32" />
                    )}
                  </div>
                  <p className="text-center text-sm font-bold text-yellow-400 mt-2">JOIN NOW</p>
                </motion.div>
              </div>

              {/* VO Text */}
              <motion.p
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute bottom-32 text-2xl text-zinc-300 italic max-w-3xl text-center px-8"
              >
                "{VO_LINES.launch}"
              </motion.p>
            </motion.div>
          )}

          {/* PLAYING STATE (after intro) */}
          {phase === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-[100px] mb-6"
              >
                🎮
              </motion.div>
              <h2 className="text-5xl font-black text-white mb-4">
                INTRO COMPLETE!
              </h2>
              <p className="text-xl text-zinc-400 mb-8">
                The show would now transition to the first trivia question
              </p>
              <Button
                onClick={resetIntro}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-bold px-8 py-6 rounded-xl"
              >
                REPLAY INTRO
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PERSISTENT QR CODE (bottom right) - shows during all phases except idle */}
        {phase !== "idle" && phase !== "playing" && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute bottom-24 right-8 z-50"
          >
            <div className="bg-black/80 backdrop-blur-sm p-3 rounded-xl border border-yellow-500/50">
              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="Scan to join" className="w-24 h-24" />
              )}
              <p className="text-center text-xs font-bold text-yellow-400 mt-1">SCAN TO JOIN</p>
            </div>
          </motion.div>
        )}

        {/* BREAKING NEWS TICKER (bottom) */}
        {phase !== "idle" && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-r from-red-600 via-red-500 to-red-600 py-3 overflow-hidden"
          >
            <motion.div
              animate={{ x: [0, -1000] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="flex items-center gap-12 whitespace-nowrap"
            >
              {[...TICKER_MESSAGES, ...TICKER_MESSAGES].map((msg, idx) => (
                <span key={idx} className="text-white font-bold text-lg flex items-center gap-4">
                  {msg}
                  <span className="text-yellow-300">●</span>
                </span>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* TIMELINE CONTROLS (for preview) */}
        {phase !== "idle" && (
          <div className="absolute top-4 left-4 right-4 z-50">
            <div className="flex items-center justify-between bg-black/80 backdrop-blur-sm rounded-xl p-4 border border-zinc-700">
              <div className="flex items-center gap-4">
                <span className="text-zinc-400 text-sm">PREVIEW CONTROLS:</span>
                {[
                  { label: "Countdown", phase: "countdown", time: 0 },
                  { label: "Brand", phase: "brand", time: 10000 },
                  { label: "Join", phase: "join", time: 25000 },
                  { label: "Stakes", phase: "stakes", time: 40000 },
                  { label: "Credibility", phase: "credibility", time: 60000 },
                  { label: "Launch", phase: "launch", time: 80000 }
                ].map(item => (
                  <button
                    key={item.phase}
                    onClick={() => jumpToPhase(item.phase, item.time)}
                    className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                      phase === item.phase 
                        ? 'bg-red-600 text-white' 
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-white font-mono">
                  {Math.floor(elapsedTime / 1000)}s / 90s
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetIntro}
                  className="border-zinc-600 text-zinc-300"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
