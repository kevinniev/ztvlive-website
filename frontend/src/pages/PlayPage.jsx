import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import LiveSurveyPlayer from '../components/LiveSurveyPlayer';
import GroupChallenge, { GroupLeaderboard, HostControls, JitsiVideoChat } from '../components/GroupChallengeV2';
import { SEO } from '../components/SEO';
import { Tv, ArrowLeft, Home, X, Users, Download, Share2, Heart, Gift, DollarSign, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Meta Pixel Helper - Track custom events
const trackPixelEvent = (eventName, params = {}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
  }
};

// Copyright-FREE Music Streams (Safe for Facebook/YouTube/Roku streaming)
// These are royalty-free, no copyright claims
const AUDIO_STREAMS = [
  // Lofi Radio - Copyright free for streams
  { name: "Lofi Beats", url: "https://play.streamafrica.net/lofiradio" },
  // NCS (NoCopyrightSounds) - Free to use
  { name: "NCS Radio", url: "https://stream.ncs.io/stream" },
  // Chillhop style - Royalty free lofi
  { name: "Chillhop", url: "https://streams.ilovemusic.de/iloveradio17.mp3" },
  // Ambient/Chill - No copyright
  { name: "Ambient", url: "https://radio.plaza.one/mp3" },
];

// Fallback news ticker
const FALLBACK_NEWS = [
  "ZTVLIVE: 24/7 Free Streaming Now Available",
  "Win Mystery Prizes Every Round - Type Your Answer!",
  "ZTVLIVE UNUSUAL FUN GAME SHOW - Join Thousands Playing Live!",
  "Grand Mystery Jackpot - Top Players Win Real Prizes!",
];

/**
 * PlayPage - Extension of Roku TV Experience (QR Code Landing)
 * 
 * This page is accessed via QR code scan from Roku/TV
 * It mirrors the Roku experience with:
 * - Same branding (ZTVLIVE UNUSUAL FUN GAME SHOW)
 * - Same waveform audio indicator
 * - Auto-playing music at 35% volume
 * - Scrolling news ticker
 * 
 * NO AUTH REQUIRED - Anyone can play!
 * Auth only prompts when claiming a prize (winner scenario)
 */
export default function PlayPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Audio state
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [currentStreamIndex] = useState(0);
  const audioRef = useRef(null);
  
  // Navigation menu state
  const [showNavMenu, setShowNavMenu] = useState(false);
  
  // Group Challenge state
  const [showGroupChallenge, setShowGroupChallenge] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinEmail, setJoinEmail] = useState('');
  
  // Sponsor Modal state
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  
  // News ticker
  const [tickerItems, setTickerItems] = useState(FALLBACK_NEWS);

  // Extract tracking params
  const ref = searchParams.get('ref') || searchParams.get('utm_source');
  const creator = searchParams.get('creator') || searchParams.get('utm_medium');
  const campaign = searchParams.get('utm_campaign');
  
  // Check for group invite in URL
  const groupFromUrl = searchParams.get('group');
  const inviteCode = searchParams.get('code');

  // Track page view with Meta Pixel
  useEffect(() => {
    trackPixelEvent('ViewContent', {
      content_name: 'ZTVLIVE Game',
      content_category: 'Game Show',
      content_type: 'game'
    });
    
    // Track as Lead when someone views the play page (shows intent)
    trackPixelEvent('Lead', {
      content_name: 'Game Page View',
      value: 0,
      currency: 'USD'
    });
  }, []);

  // Check for group invite in URL
  useEffect(() => {
    if (groupFromUrl) {
      // Auto-open group challenge modal if coming from invite link
      setShowGroupChallenge(true);
    }
    
    // Check if already in a group
    const savedGroupId = localStorage.getItem('ztvlive_group_id');
    if (savedGroupId && !groupFromUrl) {
      setActiveGroup({ group_id: savedGroupId });
    }
  }, [groupFromUrl]);

  // Auto-play music on mount (35% volume)
  useEffect(() => {
    const autoPlayMusic = () => {
      if (audioRef.current) {
        audioRef.current.src = AUDIO_STREAMS[currentStreamIndex].url;
        audioRef.current.volume = 0.35;
        audioRef.current.play()
          .then(() => setAudioPlaying(true))
          .catch(() => {
            // Browser blocked autoplay, user needs to click
            setAudioPlaying(false);
          });
      }
    };
    
    // Small delay to ensure component is mounted
    const timer = setTimeout(autoPlayMusic, 500);
    return () => clearTimeout(timer);
  }, [currentStreamIndex]);

  // Fetch news ticker
  useEffect(() => {
    const fetchTicker = async () => {
      try {
        const res = await axios.get(`${API}/api/news/ticker`);
        if (res.data?.items?.length) {
          setTickerItems(res.data.items);
        }
      } catch (e) {
        // Use fallback
      }
    };
    fetchTicker();
  }, []);

  // Track the join (anonymous tracking)
  useEffect(() => {
    const trackJoin = async () => {
      try {
        let sessionId = localStorage.getItem('ztvlive_session');
        if (!sessionId) {
          sessionId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem('ztvlive_session', sessionId);
        }
        
        await axios.post(`${API}/api/social-game/track-join`, {
          ref, platform: ref, creator, campaign,
          session_id: sessionId
        });
      } catch (err) {}
    };
    trackJoin();
  }, [ref, creator, campaign]);

  // Toggle audio
  const toggleAudio = () => {
    if (!audioRef.current) return;
    
    if (audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
    } else {
      audioRef.current.src = AUDIO_STREAMS[currentStreamIndex].url;
      audioRef.current.volume = 0.35;
      audioRef.current.play()
        .then(() => setAudioPlaying(true))
        .catch(() => {});
    }
  };

  // Build ticker text
  const tickerText = tickerItems.map(item => `  ★  ${item}`).join('');

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <SEO 
        title="Play Live Game - Win Prizes"
        description="Join the ZTVLIVE 24/7 live survey game! Answer questions, compete with players worldwide, and win real prizes like DoorDash gift cards. No account required."
        path="/play"
        type="game"
      />
      {/* Hidden audio element */}
      <audio ref={audioRef} loop preload="none" />
      
      {/* Header - Simplified, no duplicate name */}
      <header className="relative bg-gradient-to-r from-zinc-900 via-zinc-900/95 to-zinc-900 border-b border-zinc-800 px-3 sm:px-4 py-2 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Back button and Live indicator */}
          <div className="flex items-center gap-2">
            {/* Back/Exit Button */}
            <button
              onClick={() => setShowNavMenu(!showNavMenu)}
              className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-lg flex items-center justify-center transition-colors"
              data-testid="play-menu-btn"
            >
              {showNavMenu ? <X className="w-4 h-4 text-white" /> : <ArrowLeft className="w-4 h-4 text-white" />}
            </button>
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center">
              <span className="text-lg font-black text-white">Z</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-red-400 font-semibold">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              LIVE 24/7
            </div>
          </div>

          {/* Right: Live Audio Indicator with Waveform (Same as Roku) */}
          <button
            onClick={toggleAudio}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
              audioPlaying 
                ? 'bg-green-500/20 border-green-500/60' 
                : 'bg-zinc-700/30 border-zinc-600/40 hover:bg-zinc-700/50'
            }`}
          >
            {/* Animated Waveform Bars */}
            <div className="flex items-center gap-[3px] h-6">
              {[1, 2, 3, 4, 5].map((bar) => (
                <div
                  key={bar}
                  className={`w-[4px] rounded-sm transition-all ${
                    audioPlaying ? 'bg-green-500' : 'bg-zinc-500'
                  }`}
                  style={{
                    height: audioPlaying ? '100%' : '8px',
                    animation: audioPlaying 
                      ? `waveform ${0.4 + bar * 0.1}s ease-in-out infinite alternate` 
                      : 'none',
                  }}
                />
              ))}
            </div>
            <div className="text-left">
              <div className={`text-[10px] sm:text-[11px] font-bold tracking-wide ${
                audioPlaying ? 'text-green-400' : 'text-zinc-400'
              }`}>
                {audioPlaying ? 'LIVE AUDIO' : 'TAP TO PLAY'}
              </div>
              <div className={`text-[8px] sm:text-[9px] font-medium ${
                audioPlaying ? 'text-green-300' : 'text-zinc-500'
              }`}>
                {audioPlaying ? 'FROM MAIN STREAM' : 'AUDIO OFF'}
              </div>
            </div>
          </button>
        </div>
        
        {/* Navigation Menu Dropdown */}
        {showNavMenu && (
          <div className="absolute left-0 right-0 top-full bg-zinc-900 border-b border-zinc-800 shadow-xl z-50 animate-in slide-in-from-top-2 duration-200">
            <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
              {/* Group Challenge Button - NEW! */}
              <button
                onClick={() => { setShowGroupChallenge(true); setShowNavMenu(false); }}
                className="w-full flex items-center gap-4 px-4 py-4 bg-gradient-to-r from-green-600/30 to-emerald-700/20 hover:from-green-600/40 hover:to-emerald-700/30 border border-green-600/30 rounded-xl text-white transition-all"
                data-testid="group-challenge-btn"
              >
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-bold text-base">Play with Friends</div>
                  <div className="text-sm text-zinc-400 truncate">Create private group & compete together!</div>
                </div>
                {activeGroup && (
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">Active</span>
                )}
              </button>
              
              <button
                onClick={() => { navigate('/watch?unmute=true'); setShowNavMenu(false); }}
                className="w-full flex items-center gap-4 px-4 py-4 bg-gradient-to-r from-red-600/30 to-red-700/20 hover:from-red-600/40 hover:to-red-700/30 border border-red-600/30 rounded-xl text-white transition-all"
                data-testid="exit-to-watch-btn"
              >
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center shrink-0">
                  <Tv className="w-5 h-5 text-white" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-bold text-base">Watch Live Stream</div>
                  <div className="text-sm text-zinc-400 truncate">Exit game and watch the 24/7 TV</div>
                </div>
              </button>
              
              <button
                onClick={() => { navigate('/'); setShowNavMenu(false); }}
                className="w-full flex items-center gap-4 px-4 py-4 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 rounded-xl text-white transition-all"
                data-testid="exit-to-home-btn"
              >
                <div className="w-10 h-10 bg-zinc-700 rounded-lg flex items-center justify-center shrink-0">
                  <Home className="w-5 h-5 text-zinc-300" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-bold text-base">Home</div>
                  <div className="text-sm text-zinc-400 truncate">Go to homepage</div>
                </div>
              </button>
              
              {/* Download App Button */}
              <button
                onClick={() => { navigate('/download'); setShowNavMenu(false); }}
                className="w-full flex items-center gap-4 px-4 py-4 bg-gradient-to-r from-green-600/30 to-green-700/20 hover:from-green-600/40 hover:to-green-700/30 border border-green-600/30 rounded-xl text-white transition-all"
                data-testid="download-app-menu-btn"
              >
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-bold text-base">Download App</div>
                  <div className="text-sm text-zinc-400 truncate">Install on your device</div>
                </div>
              </button>
              
              <button
                onClick={() => setShowNavMenu(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-zinc-500 hover:text-white hover:bg-zinc-800/50 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
                <span className="text-sm font-medium">Close menu</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Quick Join Group Bar - Always Visible */}
      {!activeGroup && (
        <div className="bg-gradient-to-r from-green-900/50 via-emerald-900/40 to-green-900/50 border-b border-green-700/30 px-3 py-3 shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 text-green-400">
                <Users className="w-5 h-5" />
                <span className="text-sm font-semibold">Join a Group</span>
              </div>
              <div className="flex-1 flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="flex-1 sm:w-32 h-10 px-3 bg-zinc-800/80 border border-green-600/30 rounded-lg text-white text-center tracking-widest uppercase placeholder:text-zinc-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
                  data-testid="quick-join-code-input"
                />
                <input
                  type="email"
                  value={joinEmail}
                  onChange={(e) => setJoinEmail(e.target.value)}
                  placeholder="Email (optional - quick access)"
                  className="hidden sm:block flex-1 h-10 px-3 bg-zinc-800/80 border border-zinc-700/50 rounded-lg text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30"
                  data-testid="quick-join-email-input"
                />
                <button
                  onClick={() => {
                    if (joinCode.length === 6) {
                      setShowGroupChallenge(true);
                    } else {
                      toast?.error?.('Please enter a valid 6-digit code') || alert('Please enter a valid 6-digit code');
                    }
                  }}
                  disabled={joinCode.length !== 6}
                  className={`h-10 px-4 rounded-lg font-semibold text-sm transition-all ${
                    joinCode.length === 6
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                  }`}
                  data-testid="quick-join-btn"
                >
                  Join
                </button>
              </div>
              <button
                onClick={() => setShowGroupChallenge(true)}
                className="text-green-400 hover:text-green-300 text-xs underline underline-offset-2"
              >
                or Create Group
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Active Group Indicator */}
      {activeGroup && (
        <div className="bg-gradient-to-r from-green-900/60 via-emerald-900/50 to-green-900/60 border-b border-green-600/40 px-3 py-2 shrink-0">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-green-400 font-semibold text-sm">{activeGroup.name || 'Group Game'}</div>
                <div className="text-green-300/60 text-xs">Playing with friends</div>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('ztvlive_group_id');
                setActiveGroup(null);
              }}
              className="text-zinc-400 hover:text-red-400 text-xs"
            >
              Leave Group
            </button>
          </div>
        </div>
      )}

      {/* Main Game Area */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-2xl mx-auto h-full">
          <LiveSurveyPlayer 
            embedded={false} 
            teaserMode={searchParams.get('teaser') === 'true' || searchParams.get('embed') === 'true'}
            groupId={activeGroup?.group_id}
          />
        </div>
        
        {/* Group Leaderboard Overlay (when in a group) */}
        {activeGroup?.group_id && (
          <div className="absolute top-4 right-4 z-20 w-64 hidden lg:block">
            <GroupLeaderboard groupId={activeGroup.group_id} />
          </div>
        )}
      </main>

      {/* News Ticker at Bottom - Matches Roku */}
      <div className="bg-red-600 py-1.5 overflow-hidden shrink-0">
        <div 
          className="whitespace-nowrap"
          style={{ animation: 'scroll-ticker 45s linear infinite' }}
        >
          <span className="text-white font-semibold text-xs sm:text-sm">{tickerText}</span>
          <span className="text-white font-semibold text-xs sm:text-sm">{tickerText}</span>
        </div>
      </div>
      
      {/* Sleek Action Bar - Integrated Above Ticker */}
      <div className="bg-gradient-to-r from-zinc-900/95 via-zinc-800/95 to-zinc-900/95 backdrop-blur-sm border-t border-zinc-700/50 py-2 px-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Play with Friends - Main CTA */}
          {!activeGroup ? (
            <button
              onClick={() => setShowGroupChallenge(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-xs sm:text-sm rounded-lg shadow-lg shadow-green-600/20 transition-all"
              data-testid="play-with-friends-floating-btn"
            >
              <Users className="w-4 h-4" />
              <span className="hidden xs:inline">Play with</span>
              <span>Friends</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-green-600/20 border border-green-500/40 text-green-400 font-semibold text-xs sm:text-sm rounded-lg">
              <Users className="w-4 h-4" />
              <span className="truncate max-w-[100px]">{activeGroup.name || 'Group Active'}</span>
            </div>
          )}
          
          {/* Center: Quick Actions */}
          <div className="flex items-center gap-1.5">
            {/* Share Button */}
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Join me on ZTVLIVE!',
                    text: 'Play the 24/7 live trivia game with me! Win real prizes!',
                    url: window.location.href
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  // Show brief feedback
                  const btn = document.querySelector('[data-testid="share-party-btn"]');
                  if (btn) {
                    btn.classList.add('ring-2', 'ring-pink-400');
                    setTimeout(() => btn.classList.remove('ring-2', 'ring-pink-400'), 500);
                  }
                }
              }}
              className="flex items-center justify-center w-9 h-9 sm:w-auto sm:px-3 sm:py-2 sm:gap-1.5 bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-xs rounded-lg transition-all"
              data-testid="share-party-btn"
              title="Share & Invite"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
            
            {/* Get App Button */}
            <button
              onClick={() => navigate('/download')}
              className="flex items-center justify-center w-9 h-9 sm:w-auto sm:px-3 sm:py-2 sm:gap-1.5 bg-gradient-to-r from-blue-600/80 to-cyan-600/80 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold text-xs rounded-lg transition-all"
              data-testid="get-app-floating-btn"
              title="Download App"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Get App</span>
            </button>
            
            {/* Become a Sponsor Button */}
            <button
              onClick={() => setShowSponsorModal(true)}
              className="flex items-center justify-center w-9 h-9 sm:w-auto sm:px-3 sm:py-2 sm:gap-1.5 bg-gradient-to-r from-pink-600/80 to-rose-600/80 hover:from-pink-500 hover:to-rose-500 text-white font-semibold text-xs rounded-lg transition-all"
              data-testid="sponsor-floating-btn"
              title="Become a Sponsor"
            >
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Sponsor</span>
            </button>
          </div>
          
          {/* Right: Score/Badge Display */}
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <span className="hidden sm:inline">🎮</span>
            <span className="text-zinc-500 hidden sm:inline">Playing Live</span>
          </div>
        </div>
      </div>

      {/* Group Challenge Modal */}
      {showGroupChallenge && (
        <GroupChallenge
          onClose={() => setShowGroupChallenge(false)}
          onJoinGroup={(group) => {
            setActiveGroup(group);
            setShowGroupChallenge(false);
            setJoinCode('');
          }}
          currentPlayerName={localStorage.getItem('ztvlive_player_name') || ''}
          initialGroupId={groupFromUrl || joinCode}
          initialPasscode={inviteCode}
          initialEmail={joinEmail}
        />
      )}
      
      {/* Host Controls (when in group with custom questions) */}
      {activeGroup?.isHost && (
        <div className="fixed bottom-20 left-4 right-4 z-30 max-w-md mx-auto">
          <HostControls 
            groupId={activeGroup.group_id}
            isHost={true}
            onGameControl={(data) => console.log('Game control:', data)}
          />
        </div>
      )}
      
      {/* Jitsi Video Chat (when in group with video enabled) */}
      {activeGroup?.jitsi_room && (
        <div className="fixed top-20 right-4 z-30 w-80 hidden xl:block">
          <JitsiVideoChat
            roomName={activeGroup.jitsi_room}
            displayName={localStorage.getItem('ztvlive_player_name') || 'Player'}
            isHost={activeGroup.isHost}
          />
        </div>
      )}

      {/* Become a Sponsor Modal */}
      {showSponsorModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowSponsorModal(false)}
        >
          <div
            className="bg-gradient-to-b from-zinc-900 to-black rounded-3xl p-6 sm:p-8 max-w-md w-full border border-pink-500/30 animate-in fade-in zoom-in duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Become a Sponsor</h2>
              <p className="text-white/60 text-sm">
                Support ZTVLIVE and help us bring entertainment to millions!
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
                <div className="flex items-center gap-3 mb-1">
                  <Gift className="w-5 h-5 text-pink-400 flex-shrink-0" />
                  <span className="text-white font-medium text-sm">100% Free - No Obligations</span>
                </div>
                <p className="text-white/50 text-xs sm:text-sm pl-8">
                  Sponsoring is completely free. Your brand gets exposure to our global audience.
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
                <div className="flex items-center gap-3 mb-1">
                  <Users className="w-5 h-5 text-pink-400 flex-shrink-0" />
                  <span className="text-white font-medium text-sm">Reach Millions of Viewers</span>
                </div>
                <p className="text-white/50 text-xs sm:text-sm pl-8">
                  Get your brand in front of our 24/7 global streaming audience.
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
                <div className="flex items-center gap-3 mb-1">
                  <DollarSign className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span className="text-white font-medium text-sm">Optional Donations Welcome</span>
                </div>
                <p className="text-white/50 text-xs sm:text-sm pl-8">
                  If you'd like to support us financially, donations help keep the show running!
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => window.open('mailto:admin@ztvlivestream.com?subject=ZTVLIVE Sponsorship Inquiry', '_blank')}
                className="w-full h-11 sm:h-12 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl gap-2"
                data-testid="sponsor-email-btn"
              >
                <Mail className="w-5 h-5" />
                Contact Us to Sponsor
              </Button>

              <button
                onClick={() => setShowSponsorModal(false)}
                className="w-full text-white/50 hover:text-white text-sm py-2"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scroll-ticker { 
          0% { transform: translateX(0); } 
          100% { transform: translateX(-50%); } 
        }
        @keyframes waveform {
          0% { height: 8px; }
          50% { height: 16px; }
          100% { height: 24px; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
