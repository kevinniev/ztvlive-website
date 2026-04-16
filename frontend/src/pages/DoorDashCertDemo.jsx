import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gift, Mail, CheckCircle, Trophy, Play, Star, Clock, Users, 
  Zap, ArrowRight, Send, ShoppingBag, CreditCard, Sparkles,
  ChevronRight, Crown, PartyPopper
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import confetti from 'canvas-confetti';

/**
 * DoorDash Certification Demo Page
 * 
 * This page demonstrates the complete "Win → Claim → Delivery" flow
 * for DoorDash's UI certification review.
 * 
 * Flow Steps:
 * 1. PLAY - User plays trivia game (5 rounds to win)
 * 2. WIN - User achieves 5 correct answers
 * 3. CLAIM - User enters email to claim reward
 * 4. DELIVERY - Reward code is delivered to email
 */

// DoorDash brand colors
const DOORDASH_RED = "#FF3008";
const DOORDASH_DARK = "#1F1F1F";

// Demo reward data
const DEMO_REWARD = {
  sponsor: "DoorDash",
  logo: "🍔",
  brand_logo: "/doordash-logo.svg",
  reward_title: "$5 OFF Your Next Order",
  reward_code: "ZTV-DASH-5-DEMO2026",
  reward_description: "Use at checkout for $5 off any order $15+ on DoorDash",
  terms: "Valid for new & existing customers. One use per account. Expires 7 days after claim.",
  expires_days: 7
};

// Demo trivia questions
const DEMO_QUESTIONS = [
  { question: "What color is the DoorDash logo?", options: ["Red", "Blue", "Green", "Yellow"], correct: 0 },
  { question: "Which streaming service has Stranger Things?", options: ["Hulu", "Netflix", "Disney+", "HBO Max"], correct: 1 },
  { question: "What year was ZTVLIVE founded?", options: ["2024", "2025", "2026", "2023"], correct: 2 },
  { question: "What is the most popular pizza topping?", options: ["Mushrooms", "Sausage", "Pepperoni", "Olives"], correct: 2 },
  { question: "Which app delivers groceries and food?", options: ["Venmo", "DoorDash", "Robinhood", "Mint"], correct: 1 },
];

export default function DoorDashCertDemo() {
  const [phase, setPhase] = useState("intro"); // intro, playing, win, claim, delivery, complete
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [email, setEmail] = useState("");
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Fire confetti on win
  useEffect(() => {
    if (phase === "win" || phase === "complete") {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: [DOORDASH_RED, '#FFD700', '#FF6B35']
      });
    }
  }, [phase]);

  const handleAnswer = (idx) => {
    setSelectedAnswer(idx);
    const correct = idx === DEMO_QUESTIONS[round].correct;
    setIsCorrect(correct);
    setShowResult(true);
    
    if (correct) {
      setScore(prev => prev + 1);
    }

    setTimeout(() => {
      setShowResult(false);
      setSelectedAnswer(null);
      
      if (round >= 4) {
        // Game complete - check if won
        if (score + (correct ? 1 : 0) >= 5) {
          setPhase("win");
        } else {
          setPhase("intro"); // Reset for demo purposes
          setRound(0);
          setScore(0);
        }
      } else {
        setRound(prev => prev + 1);
      }
    }, 1500);
  };

  const handleClaim = () => {
    if (email && email.includes('@')) {
      setPhase("delivery");
      setTimeout(() => setPhase("complete"), 2000);
    }
  };

  const resetDemo = () => {
    setPhase("intro");
    setRound(0);
    setScore(0);
    setEmail("");
    setSelectedAnswer(null);
    setShowResult(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-black text-lg">Z</span>
            </div>
            <div>
              <h1 className="font-bold text-white">ZTVLIVE</h1>
              <p className="text-zinc-500 text-xs">DoorDash Integration Demo</p>
            </div>
          </div>
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
            Certification Review v1.0
          </Badge>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          {["PLAY", "WIN", "CLAIM", "DELIVERY"].map((step, idx) => {
            const stepPhases = [["intro", "playing"], ["win"], ["claim"], ["delivery", "complete"]];
            const isActive = stepPhases[idx].includes(phase);
            const isPast = idx < stepPhases.findIndex(phases => phases.includes(phase));
            
            return (
              <div key={step} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                  isActive ? 'bg-red-600 text-white' : 
                  isPast ? 'bg-green-600 text-white' : 
                  'bg-zinc-800 text-zinc-500'
                }`}>
                  {isPast ? <CheckCircle className="w-4 h-4" /> : <span className="w-4 h-4 flex items-center justify-center text-sm font-bold">{idx + 1}</span>}
                  <span className="font-semibold text-sm">{step}</span>
                </div>
                {idx < 3 && <ChevronRight className="w-5 h-5 text-zinc-600 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          {/* INTRO PHASE */}
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl border border-zinc-700 p-8 text-center shadow-2xl">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-7xl mb-6"
                >
                  🎮
                </motion.div>
                
                <h2 className="text-3xl font-black text-white mb-2">
                  ZTVLIVE UNUSUAL FUN SHOW
                </h2>
                <p className="text-zinc-400 mb-6">
                  Answer 5 trivia questions correctly to win a <span className="text-red-500 font-bold">$5 DoorDash</span> reward!
                </p>

                {/* Reward Preview */}
                <div className="bg-zinc-800/50 rounded-2xl p-6 mb-6 border border-zinc-700">
                  <div className="flex items-center justify-center gap-4">
                    <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center">
                      <ShoppingBag className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-zinc-500 text-sm">TODAY'S PRIZE</p>
                      <p className="text-white font-bold text-xl">$5 DoorDash Credit</p>
                      <p className="text-zinc-400 text-sm">Use on any order $15+</p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => setPhase("playing")}
                  className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white text-lg py-6 font-bold rounded-xl"
                  data-testid="start-game-btn"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  START PLAYING
                </Button>

                <p className="text-zinc-500 text-xs mt-4">
                  Powered by ZTVLIVE • Sponsored by DoorDash
                </p>
              </div>
            </motion.div>
          )}

          {/* PLAYING PHASE */}
          {phase === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl border border-zinc-700 p-6 shadow-2xl">
                {/* Score Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-600/50 text-purple-200">
                      Round {round + 1}/5
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-5 h-5 ${i < score ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-600'}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Question */}
                <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl p-6 mb-6 border border-purple-500/30">
                  <p className="text-white font-bold text-xl text-center">
                    {DEMO_QUESTIONS[round].question}
                  </p>
                </div>

                {/* Answer Options */}
                <div className="space-y-3">
                  {DEMO_QUESTIONS[round].options.map((option, idx) => {
                    const isSelected = selectedAnswer === idx;
                    const isCorrectAnswer = idx === DEMO_QUESTIONS[round].correct;
                    
                    let bgClass = "bg-zinc-800 hover:bg-zinc-700 border-zinc-700";
                    if (showResult && isSelected) {
                      bgClass = isCorrect ? "bg-green-600/30 border-green-500" : "bg-red-600/30 border-red-500";
                    }
                    if (showResult && isCorrectAnswer && !isSelected) {
                      bgClass = "bg-green-600/30 border-green-500";
                    }

                    return (
                      <motion.button
                        key={idx}
                        onClick={() => !showResult && handleAnswer(idx)}
                        disabled={showResult}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${bgClass}`}
                        whileHover={{ scale: showResult ? 1 : 1.02 }}
                        whileTap={{ scale: showResult ? 1 : 0.98 }}
                        data-testid={`answer-option-${idx}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white font-semibold">{option}</span>
                          {showResult && isCorrectAnswer && (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Result Feedback */}
                <AnimatePresence>
                  {showResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`mt-4 p-4 rounded-xl text-center ${
                        isCorrect ? 'bg-green-600/20 border border-green-500/50' : 'bg-red-600/20 border border-red-500/50'
                      }`}
                    >
                      <p className={`font-bold text-lg ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {isCorrect ? "✓ CORRECT!" : "✗ Wrong Answer"}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* WIN PHASE */}
          {phase === "win" && (
            <motion.div
              key="win"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-gradient-to-br from-yellow-900/30 via-zinc-900 to-orange-900/30 rounded-3xl border-2 border-yellow-500/50 p-8 text-center shadow-2xl">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: 3 }}
                  className="text-7xl mb-4"
                >
                  🏆
                </motion.div>

                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-lg px-6 py-2 mb-4">
                  <Crown className="w-5 h-5 mr-2" />
                  CHAMPION!
                </Badge>

                <h2 className="text-3xl font-black text-white mb-2">
                  YOU WON 5 ROUNDS!
                </h2>
                <p className="text-yellow-400 text-lg mb-6">
                  Claim your exclusive DoorDash reward!
                </p>

                {/* Reward Card */}
                <div className="bg-zinc-800/80 rounded-2xl p-6 mb-6 border border-yellow-500/30">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center">
                      <ShoppingBag className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-red-500 font-bold text-lg">DoorDash</p>
                      <p className="text-white font-black text-2xl">{DEMO_REWARD.reward_title}</p>
                    </div>
                  </div>
                  <p className="text-zinc-400 text-sm">{DEMO_REWARD.reward_description}</p>
                </div>

                <Button
                  onClick={() => setPhase("claim")}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white text-lg py-6 font-bold rounded-xl"
                  data-testid="claim-reward-btn"
                >
                  <Gift className="w-5 h-5 mr-2" />
                  CLAIM YOUR REWARD
                </Button>
              </div>
            </motion.div>
          )}

          {/* CLAIM PHASE */}
          {phase === "claim" && (
            <motion.div
              key="claim"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl border border-zinc-700 p-8 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-black text-white mb-1">
                    Claim Your DoorDash Reward
                  </h2>
                  <p className="text-zinc-400">
                    Enter your email to receive your <span className="text-yellow-400 font-bold">$5 promo code</span>
                  </p>
                </div>

                {/* Email Form */}
                <div className="bg-zinc-800/50 rounded-2xl p-6 mb-6 border border-zinc-700">
                  <div className="flex items-center gap-2 text-purple-300 mb-4">
                    <Mail className="w-5 h-5" />
                    <span className="font-semibold">Delivery Email</span>
                  </div>
                  
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-zinc-900 border-2 border-zinc-600 text-white text-lg py-6 px-4 rounded-xl focus:border-red-500 mb-4"
                    data-testid="claim-email-input"
                  />

                  <Button
                    onClick={handleClaim}
                    disabled={!email || !email.includes('@')}
                    className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-lg py-6 font-bold rounded-xl disabled:opacity-50"
                    data-testid="submit-claim-btn"
                  >
                    <Send className="w-5 h-5 mr-2" />
                    SEND TO MY INBOX
                  </Button>
                </div>

                {/* Reward Preview */}
                <div className="bg-zinc-800/30 rounded-xl p-4 border border-zinc-700">
                  <p className="text-zinc-500 text-sm mb-2">You're claiming:</p>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{DEMO_REWARD.logo}</span>
                    <div>
                      <p className="text-white font-bold">{DEMO_REWARD.reward_title}</p>
                      <p className="text-zinc-400 text-xs">{DEMO_REWARD.terms}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* DELIVERY PHASE */}
          {phase === "delivery" && (
            <motion.div
              key="delivery"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl border border-zinc-700 p-8 text-center shadow-2xl">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-6"
                />
                
                <h2 className="text-2xl font-black text-white mb-2">
                  Sending Your Reward...
                </h2>
                <p className="text-zinc-400">
                  Delivering to <span className="text-red-400 font-bold">{email}</span>
                </p>
              </div>
            </motion.div>
          )}

          {/* COMPLETE PHASE */}
          {phase === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-gradient-to-br from-green-900/30 via-zinc-900 to-emerald-900/30 rounded-3xl border-2 border-green-500/50 p-8 text-center shadow-2xl">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                >
                  <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-4" />
                </motion.div>

                <h2 className="text-3xl font-black text-white mb-2">
                  REWARD DELIVERED!
                </h2>
                <p className="text-green-400 text-lg mb-6">
                  Check your inbox at <span className="font-bold">{email}</span>
                </p>

                {/* Reward Code Display */}
                <div className="bg-zinc-800/80 rounded-2xl p-6 mb-6 border border-green-500/30">
                  <p className="text-zinc-500 text-sm mb-2">Your DoorDash Promo Code:</p>
                  <div className="bg-black/50 rounded-xl p-4 mb-4">
                    <p className="text-3xl font-mono font-black text-yellow-400" data-testid="reward-code">
                      {DEMO_REWARD.reward_code}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-zinc-400 text-sm">
                    <CreditCard className="w-4 h-4" />
                    <span>$5 off orders $15+ • Expires in 7 days</span>
                  </div>
                </div>

                {/* How to Redeem */}
                <div className="bg-zinc-800/50 rounded-xl p-4 mb-6 text-left border border-zinc-700">
                  <p className="text-white font-bold mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    How to Redeem:
                  </p>
                  <ol className="text-zinc-400 text-sm space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                      Open the DoorDash app or website
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                      Add items to your cart ($15 minimum)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                      Enter code <span className="text-yellow-400 font-mono font-bold">{DEMO_REWARD.reward_code}</span> at checkout
                    </li>
                  </ol>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={resetDemo}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-6 font-bold rounded-xl"
                    data-testid="play-again-btn"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    PLAY AGAIN
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/rewards'}
                    variant="outline"
                    className="flex-1 border-zinc-600 text-zinc-300 hover:bg-zinc-800 py-6 font-bold rounded-xl"
                  >
                    VIEW ALL REWARDS
                  </Button>
                </div>

                <p className="text-zinc-500 text-xs mt-6">
                  Powered by ZTVLIVE • DoorDash Partner Program
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Demo Controls (for certification reviewers) */}
        <div className="mt-8 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
          <p className="text-zinc-500 text-xs text-center mb-3">
            CERTIFICATION DEMO CONTROLS
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {["intro", "playing", "win", "claim", "delivery", "complete"].map((p) => (
              <Button
                key={p}
                size="sm"
                variant={phase === p ? "default" : "outline"}
                onClick={() => {
                  setPhase(p);
                  if (p === "playing") { setRound(0); setScore(0); }
                  if (p === "win") setScore(5);
                }}
                className={`text-xs ${phase === p ? 'bg-red-600' : 'border-zinc-700 text-zinc-400'}`}
              >
                {p.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
