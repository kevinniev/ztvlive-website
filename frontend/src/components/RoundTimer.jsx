import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Trophy, Gift, Zap, ChevronRight } from "lucide-react";

/**
 * RoundTimer Component
 * 
 * A standalone 10-minute round timer with visual transitions
 * between rounds. Designed for the 30-minute show format.
 * 
 * Props:
 * - totalRounds: Number of rounds (default: 3)
 * - roundDuration: Seconds per round (default: 600 = 10 min)
 * - onRoundEnd: Callback when a round ends
 * - onShowEnd: Callback when all rounds complete
 * - prizes: Array of prize labels per round
 * - isActive: Whether timer is running
 */

const DEFAULT_PRIZES = [
  { amount: 5, label: "$5 DoorDash", color: "green" },
  { amount: 10, label: "$10 DoorDash", color: "blue" },
  { amount: 15, label: "$15 DoorDash", color: "yellow" }
];

export default function RoundTimer({
  totalRounds = 3,
  roundDuration = 600,
  onRoundEnd = () => {},
  onShowEnd = () => {},
  prizes = DEFAULT_PRIZES,
  isActive = false,
  compact = false
}) {
  const [currentRound, setCurrentRound] = useState(1);
  const [timeLeft, setTimeLeft] = useState(roundDuration);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef(null);

  // Timer logic
  useEffect(() => {
    if (isActive && !isTransitioning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleRoundEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => clearInterval(timerRef.current);
  }, [isActive, isTransitioning, currentRound]);

  const handleRoundEnd = () => {
    setIsTransitioning(true);
    onRoundEnd(currentRound, prizes[currentRound - 1]);
    
    // Transition delay
    setTimeout(() => {
      if (currentRound < totalRounds) {
        setCurrentRound(prev => prev + 1);
        setTimeLeft(roundDuration);
        setIsTransitioning(false);
      } else {
        onShowEnd();
      }
    }, 5000);
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get progress percentage
  const progressPercent = ((roundDuration - timeLeft) / roundDuration) * 100;

  // Determine urgency level
  const isUrgent = timeLeft <= 60;
  const isCritical = timeLeft <= 10;

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-zinc-900/80 rounded-xl px-4 py-2 border border-zinc-700">
        <Timer className={`w-5 h-5 ${isCritical ? 'text-red-500' : isUrgent ? 'text-yellow-500' : 'text-purple-400'}`} />
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 text-sm">R{currentRound}</span>
          <span className={`font-mono font-bold text-lg ${
            isCritical ? 'text-red-500' : isUrgent ? 'text-yellow-500' : 'text-white'
          }`}>
            {formatTime(timeLeft)}
          </span>
        </div>
        <div className="flex gap-1">
          {[...Array(totalRounds)].map((_, i) => (
            <div 
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < currentRound - 1 ? 'bg-green-500' :
                i === currentRound - 1 ? 'bg-yellow-500' :
                'bg-zinc-600'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/90 rounded-2xl p-6 border border-zinc-700 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer className={`w-6 h-6 ${isCritical ? 'text-red-500' : 'text-purple-400'}`} />
          <span className="text-lg font-bold text-white">Round {currentRound} of {totalRounds}</span>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
          prizes[currentRound - 1].color === 'green' ? 'bg-green-500/20 text-green-400' :
          prizes[currentRound - 1].color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          <Gift className="w-4 h-4 inline mr-1" />
          {prizes[currentRound - 1].label}
        </div>
      </div>

      {/* Timer Display */}
      <AnimatePresence mode="wait">
        {!isTransitioning ? (
          <motion.div
            key="timer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Large Time Display */}
            <div className="text-center mb-4">
              <motion.span 
                className={`text-6xl font-mono font-black ${
                  isCritical ? 'text-red-500' : isUrgent ? 'text-yellow-500' : 'text-white'
                }`}
                animate={isCritical ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
              >
                {formatTime(timeLeft)}
              </motion.span>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden mb-4">
              <motion.div
                className={`h-full ${
                  isCritical ? 'bg-red-500' : isUrgent ? 'bg-yellow-500' : 'bg-purple-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="transition"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="text-center py-4"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 3 }}
              className="text-5xl mb-2"
            >
              🏆
            </motion.div>
            <p className="text-2xl font-bold text-yellow-400">
              Round {currentRound} Complete!
            </p>
            {currentRound < totalRounds && (
              <p className="text-zinc-400 mt-2">
                Round {currentRound + 1} starting soon...
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Round Progress Indicators */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {[...Array(totalRounds)].map((_, i) => (
          <div key={i} className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
              i < currentRound - 1 ? 'bg-green-500 text-white' :
              i === currentRound - 1 ? 'bg-yellow-500 text-black ring-2 ring-yellow-300' :
              'bg-zinc-700 text-zinc-400'
            }`}>
              {i < currentRound - 1 ? '✓' : i + 1}
            </div>
            {i < totalRounds - 1 && (
              <ChevronRight className="w-4 h-4 text-zinc-600 mx-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Export prize tiers for use elsewhere
export const PRIZE_TIERS = DEFAULT_PRIZES;
