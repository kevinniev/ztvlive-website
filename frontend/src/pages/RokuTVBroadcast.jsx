import { useState, useEffect, useRef } from "react";
import axios from "axios";
import QRCode from "qrcode";

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * ROKU TV BROADCAST - 24/7 Game Show + Creator Content
 * 
 * Features:
 * - Full-bleed design (no white bars)
 * - Mystery Money Jackpot prizes
 * - RED scrolling news ticker (synced with website)
 * - Live voting counts
 * - Auto-shuffling questions 24/7
 */

const PRIZE_TIERS = {
  1: { label: "Mystery Money Jackpot", color: "#22c55e", gradient: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)", icon: "💰" },
  2: { label: "Mystery Money Jackpot", color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)", icon: "💰" },
  3: { label: "Grand Mystery Jackpot", color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)", icon: "🏆" }
};

// Fallback news if API fails
const FALLBACK_NEWS = [
  "ZTVLIVE: 24/7 Free Streaming Now Available",
  "Win Mystery Prizes Every Round - Scan QR Code to Play!",
  "ZTV UNUSUAL FUN SHOW - Type Your Answer to Win!",
  "Join Thousands of Players Live Right Now!",
];

// Auto-shuffle questions for 24/7 engagement
const SHUFFLE_QUESTIONS = [
  { question: "What's your favorite streaming platform?", options: ["Netflix", "YouTube", "Disney+", "HBO Max"] },
  { question: "Best pizza topping?", options: ["Pepperoni", "Mushrooms", "Extra Cheese", "Pineapple"] },
  { question: "Morning drink of choice?", options: ["Coffee", "Tea", "Energy Drink", "Juice"] },
  { question: "Favorite music genre?", options: ["Pop", "Hip-Hop", "Rock", "Electronic"] },
  { question: "Best social media app?", options: ["TikTok", "Instagram", "Twitter/X", "YouTube"] },
  { question: "Ideal vacation spot?", options: ["Beach", "Mountains", "City", "Countryside"] },
  { question: "Favorite movie genre?", options: ["Action", "Comedy", "Drama", "Horror"] },
  { question: "Best fast food?", options: ["McDonald's", "Chick-fil-A", "Taco Bell", "Wendy's"] },
  { question: "Dogs or cats?", options: ["Dogs", "Cats", "Both", "Neither"] },
  { question: "Favorite season?", options: ["Spring", "Summer", "Fall", "Winter"] },
  { question: "Best superhero?", options: ["Spider-Man", "Batman", "Iron Man", "Superman"] },
  { question: "Favorite gaming console?", options: ["PlayStation", "Xbox", "Nintendo", "PC"] },
  { question: "Morning or night person?", options: ["Early Bird", "Night Owl", "Depends", "Both"] },
  { question: "Favorite snack?", options: ["Chips", "Candy", "Popcorn", "Fruit"] },
  { question: "Best way to exercise?", options: ["Gym", "Running", "Sports", "Walking"] },
];

const getYouTubeVideoId = (url) => {
  if (!url) return null;
  const match = url.match(/youtube\.com\/embed\/([^?]+)/) || 
                url.match(/youtube\.com\/watch\?v=([^&]+)/) || 
                url.match(/youtu\.be\/([^?]+)/);
  return match ? match[1] : null;
};

export default function RokuTVBroadcast() {
  // Creator content state
  const [creatorContent, setCreatorContent] = useState(null);
  const [isCreatorLive, setIsCreatorLive] = useState(false);
  const [ytApiReady, setYtApiReady] = useState(false);
  const playerRef = useRef(null);
  const currentVideoIdRef = useRef(null);
  
  // Background audio player for main programming
  const audioPlayerRef = useRef(null);
  const audioVideoIdRef = useRef(null);
  const [mainProgramming, setMainProgramming] = useState(null);
  
  // Game state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [votes, setVotes] = useState({});
  const [totalVotes, setTotalVotes] = useState(0);
  const [questionTimer, setQuestionTimer] = useState(50);
  const [questionIndex, setQuestionIndex] = useState(0);
  
  // Live activity counts
  const [liveVoters, setLiveVoters] = useState(0);
  const [votesPerSecond, setVotesPerSecond] = useState(0);
  
  // Show state
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTimer, setRoundTimer] = useState(600);
  const [playerCount, setPlayerCount] = useState(0);
  
  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  
  // QR Code
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  
  // NEWS TICKER - synced with website
  const [tickerItems, setTickerItems] = useState(FALLBACK_NEWS);
  
  // Animation
  const [pulseQR, setPulseQR] = useState(true);
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  
  // Audio status indicator
  const [audioPlaying, setAudioPlaying] = useState(false);

  // NEW: Interactive features
  const [typingPlayers, setTypingPlayers] = useState([]);
  const [lightningRound, setLightningRound] = useState(false);
  const [lightningMultiplier, setLightningMultiplier] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  const [leaderboardAnimations, setLeaderboardAnimations] = useState({});
  const prevLeaderboardRef = useRef([]);
  
  // Sound effects refs
  const soundsRef = useRef({
    correct: null,
    wrong: null,
    timer: null,
    celebration: null,
    lightning: null
  });

  // Initialize sound effects
  useEffect(() => {
    // Create audio elements for sound effects (using free sound URLs)
    soundsRef.current = {
      correct: new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'),
      wrong: new Audio('https://assets.mixkit.co/active_storage/sfx/2001/2001-preview.mp3'),
      timer: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'),
      celebration: new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'),
      lightning: new Audio('https://assets.mixkit.co/active_storage/sfx/146/146-preview.mp3')
    };
    
    // Set volumes
    Object.values(soundsRef.current).forEach(audio => {
      if (audio) audio.volume = 0.3;
    });
  }, []);

  // Play sound helper
  const playSound = (soundName) => {
    try {
      const audio = soundsRef.current[soundName];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch (e) {}
  };

  // Load YouTube API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setYtApiReady(true);
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => setYtApiReady(true);
  }, []);

  // Fetch main programming for background audio
  useEffect(() => {
    const fetchMainProgramming = async () => {
      try {
        const res = await axios.get(`${API}/api/tv/sync`);
        const data = res.data;
        const content = data.now_playing || data;
        
        // Only use non-creator content for background audio
        const isCreator = content.is_creator_content || 
                         content.source === 'creator' ||
                         content.content_type === 'creator';
        
        if (!isCreator && content.video_url) {
          setMainProgramming({
            video_url: content.video_url,
            elapsed_seconds: data.elapsed_seconds || 0,
          });
        }
      } catch (e) {
        console.log('Failed to fetch main programming for audio');
      }
    };
    
    fetchMainProgramming();
    const interval = setInterval(fetchMainProgramming, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Initialize hidden audio-only YouTube player for background audio
  useEffect(() => {
    if (!ytApiReady || !mainProgramming || isCreatorLive) return;
    
    const videoId = getYouTubeVideoId(mainProgramming.video_url);
    if (!videoId || videoId === audioVideoIdRef.current) return;
    
    audioVideoIdRef.current = videoId;
    
    // Destroy existing audio player
    if (audioPlayerRef.current) {
      try { audioPlayerRef.current.destroy(); } catch (e) {}
    }
    
    const initAudioPlayer = () => {
      const container = document.getElementById('audio-only-player');
      if (!container) { setTimeout(initAudioPlayer, 200); return; }
      
      audioPlayerRef.current = new window.YT.Player('audio-only-player', {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 0, // Audio ON
          controls: 0,
          rel: 0,
          modestbranding: 1,
          showinfo: 0,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          start: Math.floor(mainProgramming.elapsed_seconds || 0),
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(80); // Set volume to 80%
            e.target.playVideo();
            setAudioPlaying(true);
          },
          onStateChange: (e) => {
            // Track playing state: 1 = playing, 2 = paused, 0 = ended
            if (e.data === 1) {
              setAudioPlaying(true);
            } else if (e.data === 2 || e.data === 0) {
              setAudioPlaying(false);
            }
            // Auto-replay if video ends
            if (e.data === 0) {
              e.target.seekTo(0);
              e.target.playVideo();
            }
          },
        }
      });
    };
    setTimeout(initAudioPlayer, 100);
  }, [ytApiReady, mainProgramming?.video_url, isCreatorLive]);

  // Cleanup audio player when creator goes live
  useEffect(() => {
    if (isCreatorLive && audioPlayerRef.current) {
      try { 
        audioPlayerRef.current.pauseVideo();
        setAudioPlaying(false);
      } catch (e) {}
    } else if (!isCreatorLive && audioPlayerRef.current) {
      try {
        audioPlayerRef.current.playVideo();
        setAudioPlaying(true);
      } catch (e) {}
    }
  }, [isCreatorLive]);

  // Generate QR code - PRODUCTION URL
  useEffect(() => {
    // Always use production URL for QR code
    const joinUrl = 'https://www.ztvlivestream.com/play';
    QRCode.toDataURL(joinUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setQrCodeUrl);
  }, []);

  // FETCH NEWS TICKER - Same API as website
  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await axios.get(`${API}/api/news/ticker`);
        if (res.data.headlines?.length > 0) {
          // Extract headline text from objects or strings
          const headlines = res.data.headlines.map(h => 
            typeof h === 'string' ? h : (h.headline || h.title || h.text || String(h))
          );
          setTickerItems(headlines);
        }
      } catch (e) {
        console.log('Using fallback ticker');
      }
    };
    
    fetchTicker();
    const interval = setInterval(fetchTicker, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Check for creator content
  useEffect(() => {
    const checkCreatorContent = async () => {
      try {
        const res = await axios.get(`${API}/api/tv/sync`);
        const data = res.data;
        const content = data.now_playing || data;
        
        const isCreator = content.is_creator_content || 
                         content.source === 'creator' ||
                         content.content_type === 'creator' ||
                         (content.creator_id && content.creator_id !== 'system') ||
                         (content.booked_by && content.booked_by !== 'system');
        
        if (isCreator && content.video_url) {
          setIsCreatorLive(true);
          setCreatorContent({
            id: content.id || content.video_id,
            title: content.title,
            video_url: content.video_url,
            creator: content.source || content.creator_name || 'Creator',
            elapsed_seconds: data.elapsed_seconds || 0,
          });
        } else {
          setIsCreatorLive(false);
          setCreatorContent(null);
        }
      } catch (e) {
        setIsCreatorLive(false);
        setCreatorContent(null);
      }
    };
    
    checkCreatorContent();
    const interval = setInterval(checkCreatorContent, 10000);
    return () => clearInterval(interval);
  }, []);

  // Initialize YouTube player for creator content
  useEffect(() => {
    if (!isCreatorLive || !creatorContent || !ytApiReady) return;
    
    const videoId = getYouTubeVideoId(creatorContent.video_url);
    if (!videoId || videoId === currentVideoIdRef.current) return;
    
    currentVideoIdRef.current = videoId;
    
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (e) {}
    }
    
    const initPlayer = () => {
      const container = document.getElementById('creator-player');
      if (!container) { setTimeout(initPlayer, 200); return; }
      
      playerRef.current = new window.YT.Player('creator-player', {
        videoId,
        playerVars: {
          autoplay: 1, mute: 0, controls: 0, rel: 0,
          modestbranding: 1, showinfo: 0, iv_load_policy: 3,
          disablekb: 1, fs: 0, playsinline: 1,
          start: Math.floor(creatorContent.elapsed_seconds || 0),
        },
        events: {
          onReady: (e) => { e.target.setVolume(70); e.target.playVideo(); },
          onStateChange: (e) => {
            if (e.data === 0) { setIsCreatorLive(false); setCreatorContent(null); }
          },
        }
      });
    };
    setTimeout(initPlayer, 100);
  }, [isCreatorLive, creatorContent?.id, ytApiReady]);

  // Cleanup player
  useEffect(() => {
    if (!isCreatorLive && playerRef.current) {
      try { playerRef.current.destroy(); playerRef.current = null; currentVideoIdRef.current = null; } catch (e) {}
    }
  }, [isCreatorLive]);

  // WebSocket connection for real-time game sync (same as other platforms)
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = API.replace('http://', '').replace('https://', '');
    const wsUrl = `${wsProtocol}//${wsHost}`;
    const rokuClientId = `roku-broadcast-${Date.now()}`;
    
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    
    const connectWebSocket = () => {
      try {
        ws = new WebSocket(`${wsUrl}/api/live-survey/ws/${rokuClientId}`);
        
        ws.onopen = () => {
          console.log('Roku WebSocket connected for real-time sync');
          reconnectAttempts = 0;
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Update game state from WebSocket
            if (data.type === 'game_state' || data.type === 'question_update') {
              if (data.question) {
                setCurrentQuestion({ question: data.question, options: [] });
              }
              if (data.time_remaining !== undefined) {
                setQuestionTimer(data.time_remaining);
              }
              if (data.total_answers !== undefined) {
                setTotalVotes(data.total_answers);
              }
              if (data.player_count !== undefined) {
                setPlayerCount(data.player_count);
              }
              if (data.batch_time_remaining !== undefined) {
                setRoundTimer(data.batch_time_remaining);
              }
              if (data.batch_number !== undefined) {
                setCurrentRound(data.batch_number);
              }
            }
            
            // Handle results display
            if (data.type === 'results' && data.top_answers) {
              const newVotes = {};
              data.top_answers.forEach(a => {
                newVotes[a.answer] = a.count;
              });
              setVotes(newVotes);
              setCurrentQuestion({
                question: data.question,
                options: data.top_answers.map(a => a.answer),
                isResults: true
              });
            }
            
            // Handle new question
            if (data.type === 'new_question') {
              setCurrentQuestion({ question: data.question, options: [] });
              setVotes({});
              setQuestionTimer(data.time_remaining || 60);
              playSound('timer');
            }
            
            // NEW: Handle typing updates
            if (data.event === 'typing_update' || data.typing_players) {
              setTypingPlayers(data.typing_players || []);
            }
            
            // NEW: Handle lightning round
            if (data.event === 'lightning_round_start') {
              setLightningRound(true);
              setLightningMultiplier(data.multiplier || 2);
              playSound('lightning');
              // Flash effect
              setCelebrationMessage("⚡ LIGHTNING ROUND! 2X POINTS! ⚡");
              setTimeout(() => setCelebrationMessage(""), 3000);
            }
            
            if (data.event === 'lightning_round_end') {
              setLightningRound(false);
              setLightningMultiplier(1);
            }
            
            // NEW: Handle celebrations
            if (data.event === 'celebration') {
              setShowConfetti(true);
              setCelebrationMessage(data.message || "🎉 CELEBRATION!");
              playSound('celebration');
              setTimeout(() => {
                setShowConfetti(false);
                setCelebrationMessage("");
              }, 5000);
            }
            
            // Handle pong with new data
            if (data.event === 'pong') {
              if (data.typing_players) setTypingPlayers(data.typing_players);
              if (data.lightning_round !== undefined) setLightningRound(data.lightning_round);
            }
            
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };
        
        ws.onclose = () => {
          console.log('Roku WebSocket closed, reconnecting...');
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(connectWebSocket, 2000 * reconnectAttempts);
          }
        };
        
        ws.onerror = (error) => {
          console.error('Roku WebSocket error:', error);
        };
        
      } catch (e) {
        console.error('Error creating WebSocket:', e);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Fallback polling for game state (backup if WebSocket fails)
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const res = await axios.get(`${API}/api/live-survey/state`);
        if (res.data && res.data.is_live && res.data.question) {
          // Only update if significantly different (WebSocket should handle most updates)
          setCurrentQuestion(prev => {
            if (!prev || prev.question !== res.data.question) {
              return { question: res.data.question, options: [] };
            }
            return prev;
          });
          setQuestionTimer(res.data.time_remaining || 50);
          setTotalVotes(res.data.total_answers || 0);
          setPlayerCount(res.data.player_count || 0);
          
          // Sync batch timer with survey system
          if (res.data.batch_time_remaining) {
            setRoundTimer(res.data.batch_time_remaining);
          }
          if (res.data.batch_number) {
            setCurrentRound(res.data.batch_number);
          }
          
          // If showing results, display top answers
          if (res.data.showing_results && res.data.top_answers) {
            const topAnswers = res.data.top_answers;
            const newVotes = {};
            topAnswers.forEach(a => {
              newVotes[a.answer] = a.count;
            });
            setVotes(newVotes);
            
            setCurrentQuestion({
              question: res.data.question,
              options: topAnswers.map(a => a.answer),
              isResults: true
            });
          }
        }
      } catch (e) {
        // Fallback to shuffle questions if survey unavailable
        const q = SHUFFLE_QUESTIONS[questionIndex % SHUFFLE_QUESTIONS.length];
        setCurrentQuestion(q);
      }
    };
    
    fetchGame();
    // Reduced polling interval since WebSocket handles most updates
    const interval = setInterval(fetchGame, 5000);
    return () => clearInterval(interval);
  }, [questionIndex]);

  // Timer is now synced from server via fetchGame
  // No need for local countdown simulation

  // Votes are synced from server - no need for local simulation

  // Fetch show status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API}/api/bigscreen-show/status`);
        if (res.data.is_live) {
          if (res.data.current_round) setCurrentRound(res.data.current_round);
          if (res.data.time_remaining_seconds) setRoundTimer(res.data.time_remaining_seconds);
          if (res.data.players_count) setPlayerCount(res.data.players_count);
        }
      } catch (e) {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch leaderboard with animation tracking
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get(`${API}/api/game-analytics/leaderboard`);
        if (res.data.leaderboard?.length > 0) {
          const newLeaderboard = res.data.leaderboard.slice(0, 5);
          
          // Track position changes for animation
          const animations = {};
          newLeaderboard.forEach((player, newIdx) => {
            const prevIdx = prevLeaderboardRef.current.findIndex(
              p => p.username === player.username
            );
            if (prevIdx !== -1 && prevIdx !== newIdx) {
              animations[player.username] = prevIdx > newIdx ? 'move-up' : 'move-down';
            } else if (prevIdx === -1) {
              animations[player.username] = 'new-entry';
            }
          });
          
          setLeaderboardAnimations(animations);
          prevLeaderboardRef.current = newLeaderboard;
          setLeaderboard(newLeaderboard);
          
          // Clear animations after delay
          setTimeout(() => setLeaderboardAnimations({}), 1000);
        } else {
          setLeaderboard([
            { username: "TriviaKing", score: 1250 },
            { username: "QuizMaster", score: 1100 },
            { username: "BrainStorm", score: 950 },
            { username: "GameChamp", score: 800 },
            { username: "WinnerPro", score: 750 },
          ]);
        }
      } catch (e) {}
    };
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  // Round timer
  useEffect(() => {
    const timer = setInterval(() => {
      setRoundTimer(prev => prev > 0 ? prev - 1 : 600);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Player count growth
  useEffect(() => {
    const timer = setInterval(() => {
      setPlayerCount(prev => prev + Math.floor(Math.random() * 5) + 1);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // QR pulse
  useEffect(() => {
    const timer = setInterval(() => setPulseQR(prev => !prev), 2000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVotePercent = (option) => {
    if (totalVotes === 0) return 0;
    return Math.round(((votes[option] || 0) / totalVotes) * 100);
  };

  const prize = PRIZE_TIERS[currentRound] || PRIZE_TIERS[1];

  // Build ticker string for seamless scrolling
  const tickerText = tickerItems.map(item => `  ★  ${item}`).join('');

  // CREATOR CONTENT MODE
  if (isCreatorLive && creatorContent) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', margin: 0, padding: 0 }}>
        <div id="creator-player" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        
        {/* Creator Overlay */}
        <div style={{ position: 'absolute', top: '2%', left: '2%', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 10 }}>
          <div style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', padding: '6px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
            <span style={{ color: 'white', fontWeight: 700, fontSize: '16px' }}>LIVE</span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.7)', padding: '6px 14px', borderRadius: '6px', color: 'white', fontWeight: 600 }}>
            {creatorContent.creator}
          </div>
        </div>

        {/* QR Code - Bottom Right */}
        <div style={{ position: 'absolute', bottom: '8%', right: '2%', background: 'rgba(0,0,0,0.85)', borderRadius: '12px', padding: '12px', textAlign: 'center', zIndex: 10 }}>
          <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '12px', marginBottom: '6px' }}>SCAN TO PLAY</div>
          {qrCodeUrl && (
            <div style={{ background: 'white', padding: '6px', borderRadius: '6px' }}>
              <img src={qrCodeUrl} alt="QR" style={{ width: '80px', height: '80px' }} />
            </div>
          )}
        </div>

        {/* RED SCROLLING TICKER - Bottom */}
        <div style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          background: 'linear-gradient(90deg, #dc2626 0%, #b91c1c 50%, #dc2626 100%)', 
          padding: '10px 0',
          overflow: 'hidden',
          zIndex: 10 
        }}>
          <div style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            animation: 'scroll-ticker 60s linear infinite',
          }}>
            <span style={{ fontSize: '18px', fontWeight: 600, color: 'white', paddingRight: '100px' }}>{tickerText}</span>
            <span style={{ fontSize: '18px', fontWeight: 600, color: 'white', paddingRight: '100px' }}>{tickerText}</span>
          </div>
        </div>

        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
          @keyframes scroll-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        `}</style>
      </div>
    );
  }

  // GAME MODE - 24/7 with live voting (FULL BLEED - NO WHITE BAR)
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflow: 'hidden',
      color: 'white',
    }}>
      {/* Background */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.1,
        background: 'radial-gradient(circle at 20% 80%, #7c3aed 0%, transparent 50%), radial-gradient(circle at 80% 20%, #ec4899 0%, transparent 50%)',
      }} />

      {/* ⚡ LIGHTNING ROUND BANNER */}
      {lightningRound && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)',
          padding: '8px',
          textAlign: 'center',
          zIndex: 100,
          animation: 'lightning-flash 0.5s ease-in-out infinite alternate',
        }}>
          <span style={{ fontSize: '24px', fontWeight: 900, color: '#000', textShadow: '0 0 10px rgba(255,255,255,0.8)' }}>
            ⚡ LIGHTNING ROUND! {lightningMultiplier}X POINTS! ⚡
          </span>
        </div>
      )}

      {/* 🎉 CONFETTI OVERLAY */}
      {showConfetti && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 200,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}>
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                top: '-20px',
                width: `${8 + Math.random() * 8}px`,
                height: `${8 + Math.random() * 8}px`,
                background: ['#fbbf24', '#ec4899', '#8b5cf6', '#22c55e', '#ef4444', '#3b82f6'][i % 6],
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                animation: `confetti-fall ${2 + Math.random() * 2}s linear forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* CELEBRATION MESSAGE */}
      {celebrationMessage && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 300,
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(236, 72, 153, 0.95))',
          padding: '30px 60px',
          borderRadius: '20px',
          border: '3px solid rgba(255,255,255,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'celebration-pop 0.5s ease-out',
        }}>
          <div style={{ fontSize: '48px', fontWeight: 900, textAlign: 'center', textShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            {celebrationMessage}
          </div>
        </div>
      )}

      <div style={{ position: 'relative', height: '100%', padding: '2%', display: 'flex', flexDirection: 'column' }}>
        
        {/* TOP BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '60px', height: '60px',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(220, 38, 38, 0.4)',
            }}>
              <span style={{ fontSize: '36px', fontWeight: 900, color: 'white' }}>Z</span>
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-1px' }}>ZTVLIVE UNUSUAL FUN GAME SHOW</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontSize: '14px', fontWeight: 600 }}>
                <span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
                LIVE 24/7 INTERACTIVE GAME
              </div>
            </div>
          </div>

          {/* LIVE AUDIO Indicator with Animated Waveform */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: audioPlaying ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(16, 185, 129, 0.3) 100%)' : 'rgba(100, 100, 100, 0.3)',
            borderRadius: '12px',
            padding: '8px 16px',
            border: audioPlaying ? '2px solid rgba(34, 197, 94, 0.6)' : '2px solid rgba(100, 100, 100, 0.4)',
            transition: 'all 0.3s ease',
          }}>
            {/* Animated Waveform Bars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '32px' }}>
              {[1, 2, 3, 4, 5].map((bar) => (
                <div
                  key={bar}
                  style={{
                    width: '4px',
                    background: audioPlaying ? '#22c55e' : '#6b7280',
                    borderRadius: '2px',
                    animation: audioPlaying ? `waveform ${0.4 + bar * 0.1}s ease-in-out infinite alternate` : 'none',
                    height: audioPlaying ? '100%' : '8px',
                    transition: 'height 0.3s ease',
                  }}
                />
              ))}
            </div>
            <div>
              <div style={{ 
                fontSize: '11px', 
                color: audioPlaying ? '#22c55e' : '#9ca3af', 
                fontWeight: 700,
                letterSpacing: '0.5px'
              }}>
                {audioPlaying ? 'LIVE AUDIO' : 'AUDIO OFF'}
              </div>
              <div style={{ 
                fontSize: '9px', 
                color: audioPlaying ? '#86efac' : '#6b7280',
                fontWeight: 500 
              }}>
                {audioPlaying ? 'FROM MAIN STREAM' : 'WAITING...'}
              </div>
            </div>
          </div>

          {/* Live Stats - Simplified */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ background: 'rgba(34, 197, 94, 0.2)', borderRadius: '10px', padding: '6px 12px', border: '2px solid rgba(34, 197, 94, 0.5)' }}>
              <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>PLAYERS LIVE</div>
              <div style={{ fontSize: '26px', fontWeight: 900 }}>{playerCount.toLocaleString()}</div>
            </div>
            
            <div style={{ background: 'rgba(251, 191, 36, 0.2)', borderRadius: '10px', padding: '6px 12px', border: '2px solid rgba(251, 191, 36, 0.5)' }}>
              <div style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 600 }}>ANSWERS</div>
              <div style={{ fontSize: '26px', fontWeight: 900 }}>{totalVotes.toLocaleString()}</div>
            </div>
            
            <div style={{
              background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '8px 16px',
              border: roundTimer < 60 ? '2px solid #ef4444' : '2px solid rgba(139, 92, 246, 0.5)',
            }}>
              <div style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 600, textAlign: 'center' }}>GAME TIMER</div>
              <div style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'monospace', color: roundTimer < 60 ? '#ef4444' : 'white' }}>
                {formatTime(roundTimer)}
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, display: 'flex', gap: '16px', minHeight: 0 }}>
          
          {/* LEFT - Game Area */}
          <div style={{ flex: 7, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            
            {/* Hidden Audio-Only YouTube Player for Background Audio from Main Stream */}
            <div 
              id="audio-only-player"
              style={{
                position: 'absolute',
                width: '1px',
                height: '1px',
                left: '-9999px',
                top: '-9999px',
                opacity: 0,
                pointerEvents: 'none',
              }}
            />

            {/* Prize Banner - Mystery Money Jackpot */}
            <div style={{
              background: prize.gradient, borderRadius: '16px', padding: '12px 20px', marginBottom: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: `0 8px 30px ${prize.color}40`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '36px' }}>{prize.icon}</span>
                <div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>ZTVLIVE UNUSUAL FUN GAME SHOW</div>
                  <div style={{ fontSize: '28px', fontWeight: 900 }}>{prize.label}</div>
                </div>
              </div>
            </div>

            {/* Question Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'rgba(34, 197, 94, 0.3)', padding: '6px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#22c55e' }}>
                    {totalVotes.toLocaleString()} answers
                  </div>
                  <div style={{ background: 'rgba(139, 92, 246, 0.3)', padding: '6px 12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#a78bfa' }}>
                    {playerCount.toLocaleString()} playing
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '28px', fontWeight: 900, fontFamily: 'monospace', color: questionTimer <= 10 ? '#ef4444' : '#fbbf24' }}>
                  ⏱️ {questionTimer}s
                </div>
              </div>

              {/* Question Card */}
              <div style={{
                background: lightningRound 
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.4) 0%, rgba(251, 191, 36, 0.4) 100%)'
                  : 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)',
                borderRadius: '20px', padding: '24px', marginBottom: '12px',
                border: lightningRound ? '3px solid #fbbf24' : '2px solid rgba(139, 92, 246, 0.4)',
                transform: showNewQuestion ? 'scale(1.02)' : 'scale(1)', transition: 'transform 0.3s',
                boxShadow: lightningRound ? '0 0 30px rgba(251, 191, 36, 0.3)' : 'none',
              }}>
                {lightningRound && (
                  <div style={{ textAlign: 'center', marginBottom: '8px', fontSize: '18px', color: '#fbbf24', fontWeight: 700 }}>
                    ⚡ {lightningMultiplier}X POINTS ⚡
                  </div>
                )}
                <div style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>
                  {currentQuestion?.question || "Loading..."}
                </div>
              </div>

              {/* 💬 TYPING INDICATOR */}
              {typingPlayers.length > 0 && (
                <div style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  animation: 'typing-pulse 1s ease-in-out infinite',
                }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', background: '#a78bfa', borderRadius: '50%', animation: 'typing-dot 1.4s infinite ease-in-out', animationDelay: '0s' }} />
                    <span style={{ width: '8px', height: '8px', background: '#a78bfa', borderRadius: '50%', animation: 'typing-dot 1.4s infinite ease-in-out', animationDelay: '0.2s' }} />
                    <span style={{ width: '8px', height: '8px', background: '#a78bfa', borderRadius: '50%', animation: 'typing-dot 1.4s infinite ease-in-out', animationDelay: '0.4s' }} />
                  </div>
                  <span style={{ color: '#c4b5fd', fontSize: '16px', fontWeight: 500 }}>
                    {typingPlayers.slice(0, 3).join(', ')}{typingPlayers.length > 3 ? ` +${typingPlayers.length - 3} more` : ''} typing...
                  </span>
                </div>
              )}

              {/* Answer Options - Show top answers or "Type your answer" prompt */}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', minHeight: 0 }}>
                {currentQuestion?.options?.length > 0 ? (
                  /* Show top answers/options */
                  currentQuestion.options.map((option, idx) => {
                    const percent = getVotePercent(option);
                    const voteCount = votes[option] || 0;
                    const isLeading = percent > 0 && percent >= Math.max(...(currentQuestion?.options || []).map(o => getVotePercent(o)));
                    
                    return (
                      <div key={idx} style={{
                        position: 'relative', borderRadius: '14px', overflow: 'hidden',
                        border: isLeading ? '3px solid #fbbf24' : '2px solid rgba(255,255,255,0.1)',
                        background: isLeading ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%)' : 'rgba(0,0,0,0.3)',
                      }}>
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: isLeading ? 'rgba(251, 191, 36, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                          width: `${percent}%`, transition: 'width 0.5s ease-out',
                        }} />
                        
                        <div style={{ position: 'relative', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '44px', height: '44px', background: 'rgba(255,255,255,0.1)',
                              borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '22px', fontWeight: 700,
                            }}>
                              {idx + 1}
                            </div>
                            <div>
                              <span style={{ fontSize: '22px', fontWeight: 600, textTransform: 'capitalize' }}>{option}</span>
                              <div style={{ fontSize: '12px', color: '#a78bfa' }}>{voteCount.toLocaleString()} votes</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isLeading && <span style={{ fontSize: '24px' }}>👑</span>}
                            <span style={{ fontSize: '36px', fontWeight: 900 }}>{percent}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  /* Survey mode - Show "Type your answer" prompt */
                  <div style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(139, 92, 246, 0.2)',
                    borderRadius: '20px',
                    padding: '40px',
                    border: '2px dashed rgba(139, 92, 246, 0.5)',
                  }}>
                    <div style={{ fontSize: '60px', marginBottom: '16px' }}>✍️</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>TYPE YOUR ANSWER</div>
                    <div style={{ fontSize: '20px', color: '#a78bfa' }}>
                      Scan QR to play on your phone!
                    </div>
                    <div style={{ 
                      marginTop: '20px',
                      padding: '12px 24px',
                      background: 'rgba(34, 197, 94, 0.3)',
                      borderRadius: '12px',
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#22c55e'
                    }}>
                      {playerCount.toLocaleString()} players • {totalVotes.toLocaleString()} answers
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT - QR & Leaderboard */}
          <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
            
            {/* QR Code */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.4) 0%, rgba(236, 72, 153, 0.4) 100%)',
              borderRadius: '20px', padding: '16px', textAlign: 'center',
              border: '2px solid rgba(139, 92, 246, 0.5)',
              transform: pulseQR ? 'scale(1)' : 'scale(1.02)', transition: 'transform 0.5s ease-in-out',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#fbbf24', marginBottom: '10px' }}>
                ⚡ SCAN TO PLAY! ⚡
              </div>
              
              {qrCodeUrl && (
                <div style={{
                  background: 'white', padding: '10px', borderRadius: '14px', display: 'inline-block', marginBottom: '10px',
                  boxShadow: pulseQR ? '0 0 25px 8px rgba(168, 85, 247, 0.4)' : '0 0 40px 12px rgba(168, 85, 247, 0.6)',
                  transition: 'box-shadow 0.5s ease-in-out',
                }}>
                  <img src={qrCodeUrl} alt="Scan to play" style={{ width: '140px', height: '140px' }} />
                </div>
              )}
              
              <div style={{ fontSize: '16px', fontWeight: 600 }}>Vote from your phone!</div>
            </div>

            {/* Leaderboard */}
            <div style={{
              flex: 1, background: 'rgba(0,0,0,0.4)', borderRadius: '20px', padding: '14px',
              border: '2px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', minHeight: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '18px', fontWeight: 700 }}>
                📈 TOP PLAYERS
              </div>
              
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {leaderboard.map((player, idx) => {
                  const animation = leaderboardAnimations[player.username];
                  return (
                    <div key={player.username || idx} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', marginBottom: '4px', borderRadius: '8px',
                      background: idx === 0 ? 'rgba(251, 191, 36, 0.2)' : idx === 1 ? 'rgba(156, 163, 175, 0.2)' : idx === 2 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: idx === 0 ? '2px solid rgba(251, 191, 36, 0.5)' : 'none',
                      transition: 'all 0.5s ease-out',
                      transform: animation === 'move-up' ? 'translateY(-10px)' : animation === 'move-down' ? 'translateY(10px)' : 'translateY(0)',
                      animation: animation === 'move-up' ? 'leaderboard-up 0.5s ease-out' : 
                                 animation === 'move-down' ? 'leaderboard-down 0.5s ease-out' : 
                                 animation === 'new-entry' ? 'leaderboard-new 0.5s ease-out' : 'none',
                      boxShadow: animation === 'move-up' ? '0 0 15px rgba(34, 197, 94, 0.5)' : 
                                 animation === 'move-down' ? '0 0 15px rgba(239, 68, 68, 0.5)' : 'none',
                    }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '14px',
                        background: idx === 0 ? '#fbbf24' : idx === 1 ? '#9ca3af' : idx === 2 ? '#f59e0b' : '#374151',
                        color: idx < 3 ? 'black' : 'white',
                      }}>
                        {animation === 'move-up' ? '⬆️' : animation === 'move-down' ? '⬇️' : idx + 1}
                      </div>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: '14px' }}>{player.username || player.name}</span>
                      <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '14px' }}>{(player.score || 0).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RED SCROLLING NEWS TICKER - Same as website */}
        <div style={{
          marginTop: '12px',
          background: 'linear-gradient(90deg, #dc2626 0%, #b91c1c 50%, #dc2626 100%)',
          borderRadius: '10px',
          padding: '10px 0',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            animation: 'scroll-ticker 60s linear infinite',
          }}>
            <span style={{ fontSize: '18px', fontWeight: 600, color: 'white', paddingRight: '100px' }}>{tickerText}</span>
            <span style={{ fontSize: '18px', fontWeight: 600, color: 'white', paddingRight: '100px' }}>{tickerText}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes scroll-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes waveform {
          0% { height: 8px; }
          50% { height: 24px; }
          100% { height: 32px; }
        }
        
        /* NEW: Lightning round flash */
        @keyframes lightning-flash {
          0% { background: linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b); }
          100% { background: linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24); }
        }
        
        /* NEW: Confetti falling */
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        
        /* NEW: Celebration pop */
        @keyframes celebration-pop {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          50% { transform: translate(-50%, -50%) scale(1.1); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        
        /* NEW: Typing dots */
        @keyframes typing-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        
        /* NEW: Typing pulse */
        @keyframes typing-pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        
        /* NEW: Leaderboard animations */
        @keyframes leaderboard-up {
          0% { transform: translateY(20px); background: rgba(34, 197, 94, 0.3); }
          100% { transform: translateY(0); }
        }
        
        @keyframes leaderboard-down {
          0% { transform: translateY(-20px); background: rgba(239, 68, 68, 0.3); }
          100% { transform: translateY(0); }
        }
        
        @keyframes leaderboard-new {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { 
          margin: 0 !important; 
          padding: 0 !important; 
          width: 100vw !important;
          height: 100vh !important;
          overflow: hidden !important;
          background: #0f0f1a !important;
        }
      `}</style>
    </div>
  );
}
