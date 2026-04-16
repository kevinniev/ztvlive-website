import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Flame, Zap, Star, Rocket, Users, Tv, Moon, Sun, Calendar,
  Award, TrendingUp, Crown, Brain, Sparkles, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Icon mapping for badges
const BADGE_ICONS = {
  trophy: Trophy,
  flame: Flame,
  zap: Zap,
  star: Star,
  rocket: Rocket,
  users: Users,
  tv: Tv,
  moon: Moon,
  sunrise: Sun,
  calendar: Calendar,
  award: Award,
  'trending-up': TrendingUp,
  crown: Crown,
  brain: Brain,
  sparkles: Sparkles
};

// Rarity colors
const RARITY_COLORS = {
  common: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  uncommon: 'bg-green-500/20 text-green-400 border-green-500/30',
  rare: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  epic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  legendary: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
};

const RARITY_GLOW = {
  common: '',
  uncommon: 'shadow-green-500/20',
  rare: 'shadow-blue-500/30 shadow-lg',
  epic: 'shadow-purple-500/40 shadow-xl',
  legendary: 'shadow-amber-500/50 shadow-2xl animate-pulse'
};

/**
 * Single Badge Display Component
 */
export function BadgeIcon({ badge, size = 'md', showTooltip = true }) {
  const IconComponent = BADGE_ICONS[badge.icon] || Trophy;
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  return (
    <div 
      className={`relative group ${sizeClasses[size]} rounded-full flex items-center justify-center ${RARITY_COLORS[badge.rarity]} border-2 ${RARITY_GLOW[badge.rarity]}`}
      title={showTooltip ? `${badge.name}: ${badge.description}` : undefined}
    >
      <IconComponent className={`${iconSizes[size]} ${badge.earned === false ? 'opacity-30' : ''}`} />
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          <p className="text-white font-semibold text-sm">{badge.name}</p>
          <p className="text-zinc-400 text-xs">{badge.description}</p>
          <Badge className={`mt-1 text-xs ${RARITY_COLORS[badge.rarity]}`}>
            {badge.rarity}
          </Badge>
        </div>
      )}
    </div>
  );
}

/**
 * Badge Collection - Shows all earned badges
 */
export function BadgeCollection({ playerId, compact = false }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});

  useEffect(() => {
    const fetchBadges = async () => {
      if (!playerId) return;
      
      try {
        const res = await fetch(`${API}/api/achievements/player/${playerId}`);
        const data = await res.json();
        setBadges(data.badges || []);
        setStats(data.stats || {});
      } catch (err) {
        console.error('Failed to fetch badges:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBadges();
  }, [playerId]);

  if (loading) {
    return <div className="animate-pulse bg-zinc-800 rounded-lg h-20" />;
  }

  if (badges.length === 0) {
    return (
      <div className="text-center py-4 text-zinc-500 text-sm">
        No badges earned yet. Keep playing!
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex gap-1 flex-wrap">
        {badges.slice(0, 5).map((badge) => (
          <BadgeIcon key={badge.id} badge={badge} size="sm" />
        ))}
        {badges.length > 5 && (
          <Badge className="bg-zinc-700 text-zinc-300">+{badges.length - 5}</Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Your Badges ({badges.length})
        </h3>
      </div>
      
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
        {badges.map((badge) => (
          <BadgeIcon key={badge.id} badge={badge} size="md" />
        ))}
      </div>
      
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-zinc-800/50 rounded-lg p-2">
          <p className="text-xl font-bold text-white">{stats.games_played || 0}</p>
          <p className="text-zinc-500 text-xs">Games</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2">
          <p className="text-xl font-bold text-green-400">{stats.correct_answers || 0}</p>
          <p className="text-zinc-500 text-xs">Correct</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2">
          <p className="text-xl font-bold text-yellow-400">{stats.current_streak || 0}</p>
          <p className="text-zinc-500 text-xs">Streak</p>
        </div>
      </div>
    </div>
  );
}

/**
 * New Badge Earned Notification
 */
export function NewBadgeNotification({ badge, onClose }) {
  if (!badge) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 50 }}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50"
      >
        <Card className={`bg-zinc-900 border-2 ${RARITY_COLORS[badge.rarity]} ${RARITY_GLOW[badge.rarity]} overflow-hidden`}>
          <CardContent className="p-4 flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: 2 }}
            >
              <BadgeIcon badge={badge} size="lg" showTooltip={false} />
            </motion.div>
            
            <div>
              <p className="text-zinc-400 text-xs uppercase tracking-wider">New Badge!</p>
              <p className="text-white font-bold text-lg">{badge.name}</p>
              <p className="text-zinc-400 text-sm">{badge.description}</p>
            </div>
            
            <button onClick={onClose} className="text-zinc-500 hover:text-white ml-2">
              <X className="w-5 h-5" />
            </button>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Badge Progress Tracker - Shows progress toward unearned badges
 */
export function BadgeProgress({ playerId }) {
  const [allBadges, setAllBadges] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [badgesRes, playerRes] = await Promise.all([
          fetch(`${API}/api/achievements/badges`),
          fetch(`${API}/api/achievements/player/${playerId || 'anonymous'}`)
        ]);
        
        const badgesData = await badgesRes.json();
        const playerData = await playerRes.json();
        
        setAllBadges(badgesData.badges || []);
        setEarnedBadges(playerData.badges?.map(b => b.id) || []);
        setStats(playerData.stats || {});
      } catch (err) {
        console.error('Failed to fetch badge progress:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [playerId]);

  if (loading) {
    return <div className="animate-pulse bg-zinc-800 rounded-lg h-32" />;
  }

  // Calculate progress for specific badges
  const progressBadges = [
    {
      badge: allBadges.find(b => b.id === 'trivia_master'),
      current: stats.correct_answers || 0,
      target: 100,
      unit: 'correct answers'
    },
    {
      badge: allBadges.find(b => b.id === 'loyal_viewer'),
      current: Math.floor((stats.watch_time_minutes || 0) / 60),
      target: 10,
      unit: 'hours watched'
    },
    {
      badge: allBadges.find(b => b.id === 'social_butterfly'),
      current: stats.friends_invited || 0,
      target: 5,
      unit: 'friends invited'
    },
    {
      badge: allBadges.find(b => b.id === 'group_leader'),
      current: stats.group_wins || 0,
      target: 3,
      unit: 'group wins'
    }
  ].filter(p => p.badge && !earnedBadges.includes(p.badge.id));

  return (
    <Card className="bg-zinc-800/50 border-zinc-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          Badge Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {progressBadges.slice(0, 3).map((item) => {
          const progress = Math.min(100, (item.current / item.target) * 100);
          return (
            <div key={item.badge.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1">
                  <BadgeIcon badge={{...item.badge, earned: false}} size="sm" showTooltip={false} />
                  {item.badge.name}
                </span>
                <span className="text-zinc-500">{item.current}/{item.target}</span>
              </div>
              <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className={`h-full rounded-full ${
                    progress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                />
              </div>
            </div>
          );
        })}
        
        {progressBadges.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-2">
            All progress badges earned!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Leaderboard with Badges
 */
export function BadgeLeaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`${API}/api/achievements/leaderboard?limit=10`);
        const data = await res.json();
        setLeaders(data.leaderboard || []);
      } catch (err) {
        console.error('Failed to fetch leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeaderboard();
  }, []);

  if (loading) {
    return <div className="animate-pulse bg-zinc-800 rounded-lg h-48" />;
  }

  return (
    <Card className="bg-zinc-800/50 border-zinc-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-400" />
          Top Badge Collectors
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {leaders.map((player, idx) => (
            <div 
              key={player.player_id} 
              className={`flex items-center gap-3 p-2 rounded-lg ${
                idx === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' :
                idx === 1 ? 'bg-zinc-400/10 border border-zinc-400/30' :
                idx === 2 ? 'bg-amber-700/10 border border-amber-700/30' :
                'bg-zinc-800/50'
              }`}
            >
              <span className={`font-bold w-6 text-center ${
                idx === 0 ? 'text-yellow-400' :
                idx === 1 ? 'text-zinc-300' :
                idx === 2 ? 'text-amber-600' :
                'text-zinc-500'
              }`}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
              </span>
              
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {player.name || 'Anonymous Player'}
                </p>
                <div className="flex gap-1 mt-0.5">
                  {player.badges?.slice(0, 4).map((badgeId) => (
                    <div key={badgeId} className="w-4 h-4 rounded-full bg-zinc-700 flex items-center justify-center">
                      <Trophy className="w-2 h-2 text-yellow-400" />
                    </div>
                  ))}
                  {player.badges?.length > 4 && (
                    <span className="text-zinc-500 text-xs">+{player.badges.length - 4}</span>
                  )}
                </div>
              </div>
              
              <Badge className="bg-zinc-700 text-zinc-300">
                {player.badge_count} badges
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Hook to check and award badges after game actions
 */
export function useAchievements(playerId) {
  const [newBadge, setNewBadge] = useState(null);

  const checkAchievement = async (eventType, metadata = {}) => {
    if (!playerId) return;
    
    try {
      const res = await fetch(`${API}/api/achievements/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerId,
          event_type: eventType,
          metadata
        })
      });
      
      const data = await res.json();
      
      if (data.new_badges?.length > 0) {
        // Show notification for first new badge
        setNewBadge(data.new_badges[0]);
        
        // Toast for additional badges
        if (data.new_badges.length > 1) {
          toast.success(`You earned ${data.new_badges.length} badges!`);
        }
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => setNewBadge(null), 5000);
      }
      
      return data;
    } catch (err) {
      console.error('Failed to check achievements:', err);
      return null;
    }
  };

  const dismissBadge = () => setNewBadge(null);

  return {
    newBadge,
    dismissBadge,
    checkAchievement,
    // Convenience methods
    onGamePlayed: () => checkAchievement('game_played'),
    onAnswerSubmitted: (score, isCorrect, answerTimeMs) => 
      checkAchievement('answer_submitted', { score, is_correct: isCorrect, answer_time_ms: answerTimeMs }),
    onFirstAnswer: () => checkAchievement('first_answer'),
    onGameWon: (score, isGroupGame = false) => 
      checkAchievement('game_won', { score, is_group_game: isGroupGame }),
    onPerfectGame: () => checkAchievement('perfect_game'),
    onFriendInvited: () => checkAchievement('friend_invited'),
    onWatchTime: (minutes) => checkAchievement('watch_time', { minutes })
  };
}

export default BadgeCollection;
