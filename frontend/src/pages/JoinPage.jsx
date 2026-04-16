import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Gamepad2, Gift, Sparkles } from 'lucide-react';

const API = '/api';

/**
 * JoinPage - Invite code landing page for social game integration
 * 
 * URL Format: /join/{invite_code}
 * Example: /join/Xy7k9Lm2
 * 
 * This page:
 * 1. Looks up the invite code to get tracking info
 * 2. Tracks the join event with full attribution
 * 3. Shows personalized welcome based on creator
 * 4. Redirects to /watch with game auto-open
 */
export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState(null);

  useEffect(() => {
    const processInvite = async () => {
      try {
        // Get QR/invite data which includes tracking info
        const res = await axios.get(`${API}/social-game/qr/${code}`);
        setInviteData(res.data);
        
        // Track the join with full attribution
        await axios.post(`${API}/social-game/track-join`, {
          ref: code,
          platform: res.data.platform,
          creator: res.data.creator,
          session_id: localStorage.getItem('ztvlive_session') || null
        });

        // Store referral info
        localStorage.setItem('ztvlive_ref', code);
        if (res.data.platform) localStorage.setItem('ztvlive_platform', res.data.platform);
        if (res.data.creator) localStorage.setItem('ztvlive_creator', res.data.creator);

        setLoading(false);
      } catch (err) {
        console.error('Failed to process invite:', err);
        setError('Invalid invite link');
        // Still redirect to watch page after delay
        setTimeout(() => {
          navigate('/watch?autoplay=game');
        }, 2000);
      }
    };

    processInvite();
  }, [code, navigate]);

  useEffect(() => {
    if (!loading && !error) {
      // Countdown timer
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/watch?autoplay=game&invite=' + code);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [loading, error, code, navigate]);

  // Creator-specific welcome messages
  const getCreatorWelcome = (creator) => {
    const messages = {
      'julian': "Julian invited you to the chaos! 🎭",
      'sabrina_brier': "Sabrina's POV: You're about to win! 💅",
      'boman': "Boman says: Time to flex those brain cells! 🧠",
      'vinny_thomas': "Vinny's challenge awaits! 🎬",
      'amelia': "Amelia's got a question for you! 💬",
      'tefi_pessoa': "Tefi says: Let's gooo! 🏀"
    };
    return messages[creator] || `You've been invited to play! 🎮`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="text-6xl mb-4">🎮</div>
          <p className="text-xl text-white mb-2">{error}</p>
          <p className="text-zinc-400">Redirecting to the game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-red-950/20 to-zinc-950 flex items-center justify-center overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-purple-500/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      <div className="text-center px-6 relative z-10">
        {/* Gift Animation */}
        <div className="relative mb-8">
          <div className="w-28 h-28 mx-auto bg-gradient-to-br from-red-600 via-purple-600 to-pink-600 rounded-3xl flex items-center justify-center transform rotate-12 animate-bounce" style={{ animationDuration: '2s' }}>
            <Gift className="w-14 h-14 text-white" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-pulse" />
          <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-pink-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>

        {/* Welcome Message */}
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          You're Invited! 🎉
        </h1>
        
        {inviteData?.creator && (
          <p className="text-xl text-purple-400 mb-6">
            {getCreatorWelcome(inviteData.creator)}
          </p>
        )}

        {/* Join Card */}
        <div className="bg-zinc-900/80 backdrop-blur-lg rounded-2xl p-8 border border-red-500/30 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Gamepad2 className="w-6 h-6 text-red-500" />
            <span className="text-lg font-semibold text-white">ZTVLIVE Game Show</span>
          </div>
          
          <p className="text-zinc-300 mb-6">
            Answer trivia questions live with other players and win real prizes like{' '}
            <span className="text-green-400 font-semibold">Mystery Money Jackpot</span> prizes from our sponsors!
          </p>

          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-2">Starting in</p>
            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-purple-500">
              {countdown}
            </div>
          </div>

          {/* Platform badge */}
          {inviteData?.platform && (
            <div className="mt-6 flex justify-center">
              <span className="px-3 py-1 bg-zinc-800 rounded-full text-xs text-zinc-400">
                via {inviteData.platform.charAt(0).toUpperCase() + inviteData.platform.slice(1)}
              </span>
            </div>
          )}
        </div>

        {/* Skip button */}
        <button
          onClick={() => navigate('/watch?autoplay=game&invite=' + code)}
          className="mt-6 px-6 py-3 bg-gradient-to-r from-red-600 to-purple-600 text-white font-semibold rounded-full hover:opacity-90 transition-opacity"
        >
          Join Now →
        </button>
      </div>

      <style jsx="true">{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
