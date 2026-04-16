import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Trophy, Clock, Star
} from "lucide-react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL || '';

// Copyright-FREE Music Streams (Safe for Facebook/YouTube/Roku)
// These are royalty-free, no copyright claims
const AUDIO_STREAMS = [
  // Lofi Girl Radio - Copyright free for streams
  { name: "Lofi Beats", url: "https://play.streamafrica.net/lofiradio" },
  // NCS (NoCopyrightSounds) - Free to use
  { name: "NCS Radio", url: "https://stream.ncs.io/stream" },
  // Chillhop - Royalty free lofi
  { name: "Chillhop", url: "https://streams.ilovemusic.de/iloveradio17.mp3" },
  // Ambient/Nature sounds - No copyright
  { name: "Ambient", url: "https://radio.plaza.one/mp3" },
];

// News ticker fallback
const FALLBACK_NEWS = [
  "ZTVLIVE: 24/7 Free Streaming Now Available",
  "Win Mystery Prizes Every Round - Type Your Answer!",
  "ZTVLIVE UNUSUAL FUN GAME SHOW - Join Thousands Playing Live!",
  "Grand Mystery Jackpot - Top Players Win Real Prizes!",
];

// Results display duration (in seconds) - how long to show top answers
const RESULTS_DISPLAY_DURATION = 12;

/**
 * BroadcastView - Optimized for Castr/RTMP streaming
 * 
 * Mirrors PlayPage features:
 * - Same purple/pink color scheme (less aggressive)
 * - Same music streams (auto-plays at 30% volume)
 * - Clean 1920x1080 layout for streaming
 * - Clicking anywhere redirects to /play page
 * - Volume controls hidden for clean broadcast
 */
export default function BroadcastView() {
  // Game state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [batchTimeRemaining, setBatchTimeRemaining] = useState(600);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [playerCount, setPlayerCount] = useState(0);
  const [topAnswers, setTopAnswers] = useState([]);
  const [showingResults, setShowingResults] = useState(false);
  const [batchNumber, setBatchNumber] = useState(0);
  const [resultsTimer, setResultsTimer] = useState(0);
  
  // Music state - auto-plays at 30%, no controls shown
  const [currentStreamIndex] = useState(0);
  const audioRef = useRef(null);
  
  // News ticker
  const [tickerItems, setTickerItems] = useState(FALLBACK_NEWS);
  
  // WebSocket & Player
  const wsRef = useRef(null);
  const [playerId] = useState(() => {
    let pid = localStorage.getItem('ztvlive_broadcast_player');
    if (!pid) {
      pid = 'broadcast_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('ztvlive_broadcast_player', pid);
    }
    return pid;
  });

  // Handle click anywhere to go to play page
  const handlePlayRedirect = () => {
    window.open('https://www.ztvlivestream.com/play', '_blank');
  };

  // Initialize music - auto-play at 30% volume
  useEffect(() => {
    const audio = new Audio();
    audio.src = AUDIO_STREAMS[currentStreamIndex].url;
    audio.volume = 0.30; // Fixed at 30%
    audio.loop = true;
    audioRef.current = audio;
    
    // Auto-play
    audio.play().catch(() => {
      console.log('Autoplay blocked - will play on user interaction');
    });
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [currentStreamIndex]);

  // Fetch news ticker
  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await axios.get(`${API}/api/news/ticker`);
        if (res.data?.items?.length) {
          setTickerItems(res.data.items);
        }
      } catch (e) {}
    };
    fetchTicker();
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = API.replace('https://', 'wss://').replace('http://', 'ws://');
      const ws = new WebSocket(`${wsUrl}/api/live-survey/ws/${playerId}`);
      
      ws.onopen = () => {
        console.log('Broadcast view connected');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleGameUpdate(data);
      };
      
      ws.onclose = () => {
        console.log('WebSocket closed, reconnecting...');
        setTimeout(connectWebSocket, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      wsRef.current = ws;
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [playerId]);

  // Handle game updates
  const handleGameUpdate = useCallback((data) => {
    const event = data.event || data.type;
    
    if (event === 'connected' || event === 'new_question') {
      setCurrentQuestion(data.question);
      setTimeRemaining(data.time_remaining || 0);
      setBatchTimeRemaining(data.batch_time_remaining || 600);
      setBatchNumber(data.batch_number || 0);
      setTotalAnswers(data.total_answers || 0);
      setPlayerCount(data.player_count || 0);
      setShowingResults(false);
      setTopAnswers([]);
      setResultsTimer(0);
    }
    
    if (event === 'answer_update') {
      setTotalAnswers(data.total_answers || 0);
      if (data.player_count) setPlayerCount(data.player_count);
    }
    
    if (event === 'results') {
      setShowingResults(true);
      setTopAnswers(data.top_answers || []);
      setResultsTimer(RESULTS_DISPLAY_DURATION); // Start results countdown
    }
    
    if (event === 'heartbeat' || event === 'pong') {
      setTimeRemaining(data.time_remaining);
      setBatchTimeRemaining(data.batch_time_remaining);
      if (data.total_answers) setTotalAnswers(data.total_answers);
      if (data.player_count) setPlayerCount(data.player_count);
    }
  }, []);

  // Fetch initial state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await axios.get(`${API}/api/live-survey/state`);
        handleGameUpdate({ event: 'connected', ...res.data });
      } catch (e) {
        console.error('Failed to fetch game state');
      }
    };
    fetchState();
  }, [handleGameUpdate]);

  // Local countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
      setBatchTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Build ticker text
  const tickerText = tickerItems.map(item => `  ★  ${item}`).join('');

  return (
    <div 
      className="h-screen bg-gradient-to-br from-zinc-900 via-purple-900/30 to-zinc-900 text-white overflow-hidden flex flex-col cursor-pointer"
      onClick={handlePlayRedirect}
    >
      
      {/* Header Bar */}
      <header className="bg-zinc-900/90 border-b border-purple-500/30 px-8 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <span className="text-3xl font-black">Z</span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">ZTVLIVE UNUSUAL FUN GAME SHOW</h1>
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-yellow-400 font-bold">Grand Mystery Jackpot</span>
              </div>
            </div>
          </div>
          
          {/* Live Indicator with Waveform - No volume controls */}
          <div className="flex items-center gap-3 bg-green-500/20 border-2 border-green-500/60 px-5 py-3 rounded-xl">
            {/* Animated Waveform */}
            <div className="flex items-center gap-[3px] h-6">
              {[1, 2, 3, 4, 5].map((bar) => (
                <div
                  key={bar}
                  className="w-[5px] rounded-sm bg-green-500"
                  style={{
                    height: '100%',
                    animation: `waveform ${0.4 + bar * 0.1}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-green-400">LIVE AUDIO</div>
              <div className="text-xs text-green-300">{AUDIO_STREAMS[currentStreamIndex].name}</div>
            </div>
          </div>
          
          {/* Live Stats */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-zinc-800/50 rounded-xl px-5 py-3">
              <Users className="w-7 h-7 text-green-400" />
              <div>
                <div className="text-2xl font-black text-green-400">{playerCount}</div>
                <div className="text-xs text-green-300">PLAYING NOW</div>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-zinc-800/50 rounded-xl px-5 py-3">
              <Trophy className="w-7 h-7 text-yellow-400" />
              <div>
                <div className="text-2xl font-black text-yellow-400">ROUND {batchNumber}</div>
                <div className="text-xs text-yellow-300">{formatTime(batchTimeRemaining)} LEFT</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 px-8 py-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex gap-8">
          
          {/* Left Column: Question + Input */}
          <div className="flex-1 flex flex-col">
            {/* Timer */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <Clock className={`w-8 h-8 ${timeRemaining <= 10 ? 'text-red-500' : 'text-purple-400'}`} />
              <motion.div 
                className={`text-6xl font-black ${timeRemaining <= 10 ? 'text-red-500' : 'text-white'}`}
                animate={timeRemaining <= 10 ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: timeRemaining <= 10 ? Infinity : 0 }}
              >
                {timeRemaining}s
              </motion.div>
            </div>
            
            {/* Progress Bar */}
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-6">
              <motion.div
                className={`h-full ${timeRemaining <= 10 ? 'bg-red-500' : 'bg-purple-500'}`}
                style={{ width: `${(timeRemaining / 50) * 100}%` }}
              />
            </div>
            
            {/* Question Card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion || 'loading'}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-gradient-to-br from-purple-900/60 to-pink-900/60 rounded-2xl p-8 border-2 border-purple-500/40 shadow-xl shadow-purple-500/20 flex-1 flex flex-col justify-center"
              >
                <div className="text-center mb-4 flex items-center justify-center gap-4">
                  <span className="text-sm bg-purple-500/40 px-4 py-2 rounded-full font-medium">
                    {totalAnswers.toLocaleString()} answers
                  </span>
                  <span className="text-sm bg-green-500/40 px-4 py-2 rounded-full flex items-center gap-2 font-medium">
                    <Users className="w-4 h-4" />
                    {playerCount.toLocaleString()} players
                  </span>
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold text-center leading-relaxed mb-6">
                  {currentQuestion || "Waiting for next question..."}
                </h2>
                
                {/* Call to Action - Click to Play */}
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="inline-block bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-2xl px-10 py-4 rounded-xl shadow-lg shadow-yellow-500/30"
                  >
                    TAP ANYWHERE TO PLAY!
                  </motion.div>
                  <p className="text-purple-300 mt-3 text-lg">Join at ZTVLIVESTREAM.COM/PLAY</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Column: Top 4 Answers */}
          <div className="w-[450px] flex flex-col">
            <div className="text-center mb-4">
              <h3 className="text-2xl font-black text-yellow-400">TOP ANSWERS</h3>
            </div>
            
            <div className="flex-1 flex flex-col gap-3">
              {[0, 1, 2, 3].map((index) => {
                const ans = showingResults && topAnswers[index] ? topAnswers[index] : null;
                return (
                  <motion.div
                    key={index}
                    initial={ans ? { opacity: 0, x: 50 } : {}}
                    animate={ans ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: index * 0.15 }}
                    className={`flex-1 flex items-center gap-4 p-5 rounded-xl ${
                      ans ? (
                        index === 0 ? 'bg-gradient-to-r from-yellow-600/40 to-yellow-700/30 border-2 border-yellow-500/60' :
                        index === 1 ? 'bg-gradient-to-r from-zinc-400/30 to-zinc-500/20 border-2 border-zinc-400/50' :
                        index === 2 ? 'bg-gradient-to-r from-orange-700/30 to-orange-800/20 border-2 border-orange-500/50' :
                        'bg-zinc-800/40 border-2 border-zinc-600/40'
                      ) : 'bg-zinc-800/20 border-2 border-zinc-700/30 border-dashed'
                    }`}
                  >
                    {/* Rank */}
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black flex-shrink-0 ${
                      ans ? (
                        index === 0 ? 'bg-yellow-500 text-black' :
                        index === 1 ? 'bg-zinc-400 text-black' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-zinc-700 text-white'
                      ) : 'bg-zinc-800 text-zinc-600'
                    }`}>
                      {index === 0 && ans ? <Star className="w-7 h-7 fill-current" /> : index + 1}
                    </div>
                    
                    {/* Answer Text */}
                    <div className="flex-1 min-w-0">
                      {ans ? (
                        <div className="text-xl font-bold uppercase truncate">{ans.answer}</div>
                      ) : (
                        <div className="text-lg text-zinc-600 italic">
                          {showingResults ? '---' : '???'}
                        </div>
                      )}
                    </div>
                    
                    {/* Percentage */}
                    <div className="text-right flex-shrink-0">
                      {ans ? (
                        <>
                          <div className="text-3xl font-black">{ans.percentage || ans.percent}%</div>
                          <div className="text-xs text-zinc-400">{ans.count} votes</div>
                        </>
                      ) : (
                        <div className="text-xl text-zinc-600">--%</div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Footer CTA */}
      <footer className="bg-zinc-900/90 border-t border-purple-500/30 px-8 py-3 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-4"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl px-6 py-3">
              <div className="text-xs text-purple-200 font-medium">JOIN NOW AT</div>
              <div className="text-2xl font-black tracking-tight">ZTVLIVESTREAM.COM/PLAY</div>
            </div>
          </motion.div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-zinc-400 text-sm">SCAN TO PLAY</div>
              <div className="text-lg font-bold text-yellow-400">Win Real Prizes!</div>
            </div>
            <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-pink-600 rounded-md flex items-center justify-center">
                <span className="text-2xl font-black">Z</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* News Ticker */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 py-2 overflow-hidden shrink-0">
        <div 
          className="whitespace-nowrap"
          style={{ animation: 'scroll-ticker 45s linear infinite' }}
        >
          <span className="text-white font-semibold text-base">{tickerText}</span>
          <span className="text-white font-semibold text-base">{tickerText}</span>
        </div>
      </div>

      <style>{`
        @keyframes scroll-ticker { 
          0% { transform: translateX(0); } 
          100% { transform: translateX(-50%); } 
        }
        @keyframes waveform {
          0% { height: 10px; }
          50% { height: 18px; }
          100% { height: 24px; }
        }
      `}</style>
    </div>
  );
}
