import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, Users, Trophy, Clock, Zap, Gift, 
  Smartphone, Monitor, Tv, ArrowRight, Star,
  MessageCircle, Heart, Share2, Volume2, Download,
  ChevronRight, Award, Target, Sparkles, PartyPopper
} from "lucide-react";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

// Demo questions for animation
const DEMO_QUESTIONS = [
  "What's your go-to comfort food?",
  "Best movie of all time?",
  "Dream vacation destination?",
  "Favorite music genre?",
  "What superpower would you want?"
];

const DEMO_ANSWERS = [
  ["Pizza", "Ice Cream", "Tacos", "Burgers", "Pasta"],
  ["Inception", "Titanic", "Avatar", "Avengers", "Frozen"],
  ["Hawaii", "Paris", "Tokyo", "Maldives", "New York"],
  ["Hip-Hop", "Pop", "R&B", "Rock", "Afrobeats"],
  ["Flying", "Invisibility", "Time Travel", "Super Strength", "Telepathy"]
];

// Tutorial steps for the animated walkthrough
const TUTORIAL_STEPS = [
  {
    id: 1,
    title: "Join the Live Game",
    description: "Open ztvlivestream.com/play on any device - phone, tablet, laptop, or smart TV. No app download needed!",
    icon: Smartphone,
    color: "from-blue-500 to-cyan-500",
    demo: "join"
  },
  {
    id: 2,
    title: "Wait for the Question",
    description: "A new question appears every 60 seconds. Watch the countdown timer and get ready to type your answer!",
    icon: Clock,
    color: "from-purple-500 to-pink-500",
    demo: "question"
  },
  {
    id: 3,
    title: "Type Your Answer",
    description: "Be creative! Type what YOU think is the most popular answer. There are no wrong answers - just popular ones!",
    icon: MessageCircle,
    color: "from-green-500 to-emerald-500",
    demo: "answer"
  },
  {
    id: 4,
    title: "Watch Answers Rank Up",
    description: "See answers from players worldwide appear and rank in real-time. The most popular answers rise to the top!",
    icon: Target,
    color: "from-orange-500 to-red-500",
    demo: "ranking"
  },
  {
    id: 5,
    title: "Win Real Prizes!",
    description: "Match the top answers to earn points. Top scorers each round win DoorDash gift cards and cash prizes!",
    icon: Trophy,
    color: "from-yellow-500 to-amber-500",
    demo: "win"
  }
];

export default function GamePromoPage() {
  const navigate = useNavigate();
  const [liveStats, setLiveStats] = useState({ players: 0, answers: 0 });
  const [demoQuestion, setDemoQuestion] = useState(0);
  const [demoAnswers, setDemoAnswers] = useState([]);
  const [animatingAnswer, setAnimatingAnswer] = useState(null);
  const [showResults, setShowResults] = useState(false);
  
  // Tutorial state
  const [currentStep, setCurrentStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [tutorialProgress, setTutorialProgress] = useState(0);
  const tutorialRef = useRef(null);
  const stepStartTime = useRef(Date.now());
  const viewedSteps = useRef(new Set());
  
  // Get or create session ID for analytics
  const getSessionId = () => {
    let sessionId = sessionStorage.getItem('tutorial_session_id');
    if (!sessionId) {
      sessionId = `tut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('tutorial_session_id', sessionId);
    }
    return sessionId;
  };

  // Track tutorial analytics
  const trackTutorialEvent = async (eventType, stepNum = null, stepName = null, timeSpent = null) => {
    try {
      await axios.post(`${API}/api/analytics/track/tutorial`, null, {
        params: {
          event_type: eventType,
          step_number: stepNum,
          step_name: stepName,
          session_id: getSessionId(),
          time_spent_seconds: timeSpent
        }
      });
    } catch (e) {
      // Silent fail for analytics
    }
  };

  // Track step views
  useEffect(() => {
    const stepInfo = TUTORIAL_STEPS[currentStep];
    if (stepInfo && !viewedSteps.current.has(currentStep)) {
      viewedSteps.current.add(currentStep);
      trackTutorialEvent('step_view', stepInfo.id, stepInfo.title);
      stepStartTime.current = Date.now();
    }
    
    // Track completion when reaching last step
    if (currentStep === TUTORIAL_STEPS.length - 1 && viewedSteps.current.size === TUTORIAL_STEPS.length) {
      trackTutorialEvent('tutorial_complete');
    }
  }, [currentStep]);

  // Fetch live stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/api/live-survey/state`);
        setLiveStats({
          players: res.data.player_count || 0,
          answers: res.data.total_answers || 0
        });
      } catch (e) {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-advance tutorial
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const stepDuration = 4000; // 4 seconds per step
    const progressInterval = setInterval(() => {
      setTutorialProgress(prev => {
        if (prev >= 100) {
          setCurrentStep(step => (step + 1) % TUTORIAL_STEPS.length);
          return 0;
        }
        return prev + (100 / (stepDuration / 50));
      });
    }, 50);

    return () => clearInterval(progressInterval);
  }, [isAutoPlaying, currentStep]);

  // Demo animation cycle
  useEffect(() => {
    const runDemo = () => {
      setShowResults(false);
      setDemoAnswers([]);
      
      // Simulate answers coming in
      const answers = DEMO_ANSWERS[demoQuestion];
      answers.forEach((answer, i) => {
        setTimeout(() => {
          setAnimatingAnswer(answer);
          setDemoAnswers(prev => {
            const existing = prev.find(a => a.text === answer);
            if (existing) {
              return prev.map(a => a.text === answer ? {...a, count: a.count + Math.floor(Math.random() * 3) + 1} : a);
            }
            return [...prev, { text: answer, count: Math.floor(Math.random() * 10) + 5 }];
          });
          setTimeout(() => setAnimatingAnswer(null), 300);
        }, i * 800);
      });

      // Show results after answers
      setTimeout(() => {
        setShowResults(true);
      }, answers.length * 800 + 1000);

      // Move to next question
      setTimeout(() => {
        setDemoQuestion(prev => (prev + 1) % DEMO_QUESTIONS.length);
      }, answers.length * 800 + 4000);
    };

    runDemo();
    const interval = setInterval(runDemo, 15000);
    return () => clearInterval(interval);
  }, [demoQuestion]);

  // Share functionality
  const handleShare = async () => {
    const shareData = {
      title: 'Play ZTVLIVE Live Survey Game!',
      text: 'Join me in the live trivia game where YOUR answers compete against the world! Win real prizes 24/7!',
      url: 'https://www.ztvlivestream.com/play'
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Shared successfully!");
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n\n${shareData.url}`);
        toast.success("Link copied to clipboard!");
      }
    } catch (err) {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.text}\n\n${shareData.url}`);
        toast.success("Link copied to clipboard!");
      } catch (e) {
        toast.error("Couldn't share. Copy this link: ztvlivestream.com/play");
      }
    }
  };

  // Download tutorial as shareable image (creates canvas)
  const handleDownloadTutorial = () => {
    // Create a shareable link instead (since canvas generation is complex)
    const shareableLink = `${window.location.origin}/game`;
    navigator.clipboard.writeText(shareableLink);
    toast.success("Game promo link copied! Share: ztvlivestream.com/game");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white overflow-hidden">
      {/* Floating particles background */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-red-500/20 rounded-full"
            initial={{ 
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1920), 
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1080) 
            }}
            animate={{ 
              y: [null, Math.random() * -500],
              opacity: [0.2, 0.8, 0.2]
            }}
            transition={{ 
              duration: Math.random() * 10 + 10, 
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-zinc-800/50 bg-black/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-xl font-black">Z</span>
            </div>
            <span className="text-xl font-bold">ZTVLIVE</span>
          </Link>
          
          {/* Live indicator */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400">{liveStats.players} playing now</span>
            </div>
            <Button 
              onClick={() => {
                trackTutorialEvent('play_click', null, 'header_button');
                navigate('/play');
              }}
              className="bg-red-600 hover:bg-red-500"
              data-testid="header-play-now-btn"
            >
              Play Now
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-full text-sm mb-6">
                <Zap className="w-4 h-4" />
                Live 24/7 Game Show
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
                Think Fast.
                <span className="text-red-500 block">Type Faster.</span>
                <span className="text-yellow-500 block">Win Prizes!</span>
              </h1>
              
              <p className="text-lg text-zinc-400 mb-8 max-w-lg">
                The ultimate live trivia game where YOUR answers compete against the crowd. 
                Match the top answers to win DoorDash gift cards, cash prizes, and more!
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                  <div className="text-2xl md:text-3xl font-bold text-red-500">{liveStats.players}+</div>
                  <div className="text-xs text-zinc-500">Playing Now</div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                  <div className="text-2xl md:text-3xl font-bold text-green-500">$100</div>
                  <div className="text-xs text-zinc-500">Daily Prizes</div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                  <div className="text-2xl md:text-3xl font-bold text-yellow-500">10min</div>
                  <div className="text-xs text-zinc-500">Per Round</div>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg"
                  onClick={() => {
                    trackTutorialEvent('play_click', null, 'hero_join_game');
                    navigate('/play');
                  }}
                  className="bg-red-600 hover:bg-red-500 text-lg px-8 group"
                  data-testid="hero-join-game-btn"
                >
                  <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Join Live Game
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={handleShare}
                  className="border-zinc-700 text-lg"
                  data-testid="hero-share-btn"
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Share Game
                </Button>
              </div>
            </motion.div>

            {/* Right: Live Demo */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {/* Phone mockup with game */}
              <div className="relative mx-auto max-w-[320px]">
                {/* Phone frame */}
                <div className="bg-zinc-900 rounded-[3rem] p-3 border-4 border-zinc-800 shadow-2xl shadow-red-500/10">
                  <div className="bg-black rounded-[2.5rem] overflow-hidden">
                    {/* Game UI */}
                    <div className="p-4 min-h-[500px] flex flex-col">
                      {/* Game header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center text-xs font-bold">Z</div>
                          <span className="text-sm font-bold">LIVE GAME</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-400">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          {liveStats.players} players
                        </div>
                      </div>

                      {/* Question */}
                      <motion.div 
                        key={demoQuestion}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-4 mb-4"
                      >
                        <div className="text-xs text-red-200 mb-1">QUESTION {demoQuestion + 1}</div>
                        <div className="text-lg font-bold">{DEMO_QUESTIONS[demoQuestion]}</div>
                      </motion.div>

                      {/* Answers area */}
                      <div className="flex-1 space-y-2">
                        <AnimatePresence mode="popLayout">
                          {demoAnswers
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 5)
                            .map((answer, i) => (
                              <motion.div
                                key={answer.text}
                                initial={{ opacity: 0, x: -20, scale: 0.9 }}
                                animate={{ 
                                  opacity: 1, 
                                  x: 0, 
                                  scale: animatingAnswer === answer.text ? 1.05 : 1,
                                  backgroundColor: animatingAnswer === answer.text ? '#dc2626' : '#18181b'
                                }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                                className="bg-zinc-900 rounded-lg p-3 flex items-center justify-between border border-zinc-800"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    i === 0 ? 'bg-yellow-500 text-black' : 
                                    i === 1 ? 'bg-zinc-400 text-black' : 
                                    i === 2 ? 'bg-orange-700 text-white' : 
                                    'bg-zinc-700 text-white'
                                  }`}>
                                    {i + 1}
                                  </span>
                                  <span className="font-medium">{answer.text}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-2 bg-red-600 rounded-full" style={{ width: `${answer.count * 3}px` }} />
                                  <span className="text-sm text-zinc-400">{answer.count}</span>
                                </div>
                              </motion.div>
                            ))}
                        </AnimatePresence>
                      </div>

                      {/* Input area */}
                      <div className="mt-4">
                        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 flex items-center gap-2">
                          <MessageCircle className="w-4 h-4 text-zinc-500" />
                          <span className="text-zinc-500 text-sm">Type your answer...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating elements */}
                <motion.div 
                  className="absolute -top-4 -right-4 bg-yellow-500 text-black rounded-full px-3 py-1 text-sm font-bold"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  WIN $$$
                </motion.div>
                <motion.div 
                  className="absolute -bottom-2 -left-4 bg-green-500 text-black rounded-full px-3 py-1 text-sm font-bold"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  FREE!
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* VIDEO DEMO SECTION */}
      <section className="relative z-10 py-16 bg-gradient-to-b from-black to-zinc-900/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600/20 to-orange-600/20 text-red-400 px-4 py-2 rounded-full text-sm mb-4"
            >
              <Play className="w-4 h-4" />
              Watch How It Works
            </motion.div>
            <h2 className="text-3xl md:text-4xl font-black mb-4">See the Game in Action</h2>
            <p className="text-zinc-400">Watch a quick demo of how players compete in real-time</p>
          </div>

          {/* Video Embed Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden border-2 border-red-600/30 shadow-2xl shadow-red-500/10"
          >
            {/* Gradient border glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 via-transparent to-orange-600/20 pointer-events-none" />
            
            {/* Video iframe */}
            <div className="relative aspect-video bg-black">
              <iframe
                src="https://ztvlive-app-ddc916fb.base44.app/Play"
                title="ZTVLIVE Game Demo"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            
            {/* Bottom bar */}
            <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Play className="w-4 h-4 text-red-500" />
                <span>Live Game Preview</span>
              </div>
              <Button
                size="sm"
                onClick={() => navigate('/play')}
                className="bg-red-600 hover:bg-red-500"
                data-testid="video-play-now-btn"
              >
                Play Now
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ANIMATED TUTORIAL WALKTHROUGH */}
      <section ref={tutorialRef} className="relative z-10 py-16 bg-gradient-to-b from-zinc-900/50 to-transparent" id="tutorial">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-400 px-4 py-2 rounded-full text-sm mb-4"
            >
              <Sparkles className="w-4 h-4" />
              Interactive Tutorial
            </motion.div>
            <h2 className="text-3xl md:text-5xl font-black mb-4">How To Play</h2>
            <p className="text-zinc-400 text-lg">Learn in 60 seconds - it's that easy!</p>
          </div>

          {/* Tutorial Container */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 md:p-10 backdrop-blur-sm">
            {/* Step Progress Indicators */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {TUTORIAL_STEPS.map((step, i) => (
                <button
                  key={step.id}
                  onClick={() => {
                    setCurrentStep(i);
                    setTutorialProgress(0);
                    setIsAutoPlaying(false);
                  }}
                  className={`relative h-2 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-12 bg-zinc-700' : 'w-8 bg-zinc-800 hover:bg-zinc-700'
                  }`}
                  data-testid={`tutorial-step-${i + 1}`}
                >
                  {i === currentStep && (
                    <motion.div 
                      className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${TUTORIAL_STEPS[currentStep].color}`}
                      style={{ width: `${tutorialProgress}%` }}
                    />
                  )}
                  {i < currentStep && (
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${TUTORIAL_STEPS[i].color}`} />
                  )}
                </button>
              ))}
            </div>

            {/* Main Tutorial Content */}
            <div className="grid md:grid-cols-2 gap-8 items-center min-h-[400px]">
              {/* Left: Step Info */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ duration: 0.4 }}
                  className="text-center md:text-left"
                >
                  {/* Step Icon */}
                  <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${TUTORIAL_STEPS[currentStep].color} mb-6 shadow-lg`}>
                    {(() => {
                      const Icon = TUTORIAL_STEPS[currentStep].icon;
                      return <Icon className="w-10 h-10 text-white" />;
                    })()}
                  </div>

                  {/* Step Number */}
                  <div className="text-sm font-bold text-zinc-500 mb-2">
                    STEP {currentStep + 1} OF {TUTORIAL_STEPS.length}
                  </div>

                  {/* Step Title */}
                  <h3 className="text-2xl md:text-3xl font-bold mb-4">
                    {TUTORIAL_STEPS[currentStep].title}
                  </h3>

                  {/* Step Description */}
                  <p className="text-zinc-400 text-lg leading-relaxed mb-6">
                    {TUTORIAL_STEPS[currentStep].description}
                  </p>

                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-4 justify-center md:justify-start">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentStep(prev => prev === 0 ? TUTORIAL_STEPS.length - 1 : prev - 1);
                        setTutorialProgress(0);
                      }}
                      className="border-zinc-700"
                      data-testid="tutorial-prev-btn"
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setCurrentStep(prev => (prev + 1) % TUTORIAL_STEPS.length);
                        setTutorialProgress(0);
                      }}
                      className={`bg-gradient-to-r ${TUTORIAL_STEPS[currentStep].color} border-0`}
                      data-testid="tutorial-next-btn"
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                      className="text-zinc-400"
                      data-testid="tutorial-autoplay-btn"
                    >
                      {isAutoPlaying ? "Pause" : "Auto"}
                    </Button>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Right: Visual Demo */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  className="relative"
                >
                  {/* Demo visualization based on step */}
                  <div className={`bg-gradient-to-br ${TUTORIAL_STEPS[currentStep].color} p-1 rounded-2xl`}>
                    <div className="bg-zinc-950 rounded-xl p-6 min-h-[300px] flex items-center justify-center">
                      {currentStep === 0 && (
                        <div className="text-center">
                          <motion.div
                            animate={{ y: [0, -10, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="flex justify-center gap-4 mb-6"
                          >
                            <Smartphone className="w-12 h-12 text-blue-400" />
                            <Monitor className="w-14 h-14 text-cyan-400" />
                            <Tv className="w-16 h-16 text-blue-500" />
                          </motion.div>
                          <div className="text-xl font-bold text-white">ztvlivestream.com/play</div>
                          <div className="text-zinc-500 mt-2">Works on ANY device!</div>
                        </div>
                      )}
                      {currentStep === 1 && (
                        <div className="text-center">
                          <motion.div
                            className="text-7xl font-black text-white"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            <Clock className="w-24 h-24 mx-auto text-purple-400 mb-4" />
                            60
                          </motion.div>
                          <div className="text-zinc-400 mt-2">seconds between questions</div>
                        </div>
                      )}
                      {currentStep === 2 && (
                        <div className="w-full max-w-xs">
                          <div className="bg-zinc-800 rounded-xl p-4 mb-4">
                            <div className="text-sm text-zinc-500 mb-1">QUESTION</div>
                            <div className="text-lg font-bold">{DEMO_QUESTIONS[0]}</div>
                          </div>
                          <motion.div 
                            className="bg-zinc-800 border-2 border-green-500 rounded-xl p-4"
                            animate={{ scale: [1, 1.02, 1] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                          >
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.5 }}
                              className="text-green-400 font-medium"
                            >
                              Pizza|
                            </motion.span>
                          </motion.div>
                        </div>
                      )}
                      {currentStep === 3 && (
                        <div className="w-full max-w-xs space-y-2">
                          {["Pizza", "Tacos", "Ice Cream"].map((answer, i) => (
                            <motion.div
                              key={answer}
                              initial={{ x: -50, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: i * 0.3 }}
                              className="bg-zinc-800 rounded-lg p-3 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  i === 0 ? 'bg-yellow-500 text-black' : 'bg-zinc-700'
                                }`}>{i + 1}</span>
                                <span>{answer}</span>
                              </div>
                              <motion.div 
                                className="h-2 bg-orange-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${(3 - i) * 20}px` }}
                                transition={{ delay: i * 0.3 + 0.5 }}
                              />
                            </motion.div>
                          ))}
                        </div>
                      )}
                      {currentStep === 4 && (
                        <div className="text-center">
                          <motion.div
                            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            <Trophy className="w-24 h-24 mx-auto text-yellow-500 mb-4" />
                          </motion.div>
                          <div className="text-2xl font-bold text-yellow-500 mb-2">YOU WON!</div>
                          <div className="text-zinc-400">$10 DoorDash Gift Card</div>
                          <motion.div
                            className="mt-4 flex justify-center gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                          >
                            {["🎉", "🏆", "💰", "🎉"].map((emoji, i) => (
                              <motion.span
                                key={i}
                                animate={{ y: [0, -10, 0] }}
                                transition={{ delay: i * 0.1, duration: 0.5, repeat: Infinity }}
                                className="text-2xl"
                              >
                                {emoji}
                              </motion.span>
                            ))}
                          </motion.div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Share/Download Section */}
            <div className="mt-10 pt-8 border-t border-zinc-800">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <h4 className="text-lg font-bold mb-1">Share This Game!</h4>
                  <p className="text-zinc-500 text-sm">Invite friends & play together</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleShare}
                    className="bg-gradient-to-r from-pink-600 to-purple-600"
                    data-testid="share-game-btn"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Game
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadTutorial}
                    className="border-zinc-700"
                    data-testid="copy-link-btn"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Play With Friends */}
      <section className="relative z-10 py-16">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-gradient-to-r from-red-900/30 to-zinc-900 border border-red-800/30 rounded-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-pink-600/20 text-pink-400 px-4 py-2 rounded-full text-sm mb-4">
                  <Users className="w-4 h-4" />
                  Group Play
                </div>
                <h2 className="text-3xl font-bold mb-4">Play With Friends!</h2>
                <p className="text-zinc-400 mb-6">
                  ZTVLIVE is perfect for parties, family game nights, or hanging out with friends. 
                  Everyone plays on their own phone while watching the same stream!
                </p>
                <ul className="space-y-3 mb-6">
                  {[
                    "Compete to see who matches the most answers",
                    "Play from anywhere - same room or across the world",
                    "No app download needed - just open the website",
                    "Works on any device with a browser"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Star className="w-4 h-4 text-yellow-500" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button 
                  size="lg"
                  onClick={handleShare}
                  className="bg-pink-600 hover:bg-pink-500"
                  data-testid="invite-friends-btn"
                >
                  <Share2 className="w-5 h-5 mr-2" />
                  Invite Friends
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {["Party Night", "Family Fun", "Friends Hangout", "Office Break"].map((label, i) => (
                  <div key={label} className="bg-zinc-800/50 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">{["🎉", "👨‍👩‍👧‍👦", "👯", "💼"][i]}</div>
                    <div className="text-sm font-medium">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prizes */}
      <section className="relative z-10 py-16 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-yellow-600/20 text-yellow-400 px-4 py-2 rounded-full text-sm mb-4">
            <Gift className="w-4 h-4" />
            Real Prizes
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Win Every Round!</h2>
          <p className="text-zinc-400 mb-8 max-w-xl mx-auto">
            Top scorers each round win real prizes. Play more, win more!
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { prize: "$10 DoorDash", place: "1st Place", color: "yellow", borderColor: "border-yellow-600/30" },
              { prize: "$5 Gift Card", place: "2nd Place", color: "zinc", borderColor: "border-zinc-600/30" },
              { prize: "Bonus Points", place: "3rd Place", color: "orange", borderColor: "border-orange-600/30" }
            ].map((item, i) => (
              <div key={item.place} className={`bg-zinc-900 ${item.borderColor} border rounded-xl p-6`}>
                <div className={`text-4xl font-bold mb-2 ${
                  item.color === 'yellow' ? 'text-yellow-500' : 
                  item.color === 'orange' ? 'text-orange-500' : 'text-zinc-400'
                }`}>{item.prize}</div>
                <div className="text-zinc-400">{item.place}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-black mb-6">
              Ready to Play?
            </h2>
            <p className="text-xl text-zinc-400 mb-8">
              A new round starts every 10 minutes. Jump in now!
            </p>
            <Button 
              size="lg"
              onClick={() => {
                trackTutorialEvent('play_click', null, 'final_cta');
                navigate('/play');
              }}
              className="bg-red-600 hover:bg-red-500 text-xl px-12 py-6 h-auto"
              data-testid="final-cta-play-btn"
            >
              <Play className="w-6 h-6 mr-2" />
              Play Now - It's Free!
            </Button>
            <p className="text-sm text-zinc-500 mt-4">
              No download. No signup. Just play!
            </p>
            
            {/* Share promo link */}
            <div className="mt-8 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 inline-block">
              <p className="text-sm text-zinc-400 mb-2">Share this page for promotions:</p>
              <div className="flex items-center gap-2">
                <code className="bg-zinc-800 px-3 py-1.5 rounded text-green-400 text-sm">
                  ztvlivestream.com/game
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText('https://www.ztvlivestream.com/game');
                    toast.success('Link copied!');
                  }}
                  className="border-zinc-700"
                  data-testid="copy-promo-link-btn"
                >
                  Copy
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800 py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
              <span className="font-bold">Z</span>
            </div>
            <span className="font-bold">ZTVLIVE</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link to="/watch" className="hover:text-white">Watch</Link>
            <Link to="/play" className="hover:text-white">Play</Link>
            <Link to="/creators" className="hover:text-white">Creators</Link>
            <a href="mailto:admin@ztvlivestream.com" className="hover:text-white">Contact</a>
          </div>
          <div className="text-sm text-zinc-600">
            © 2026 ZTVLIVE. Play responsibly.
          </div>
        </div>
      </footer>
    </div>
  );
}
