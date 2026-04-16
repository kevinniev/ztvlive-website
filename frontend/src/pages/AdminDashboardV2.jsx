import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Tv, Menu, X, Shield, CheckCircle, XCircle, Clock, Play, 
  MessageSquare, Video, Radio, Settings, Users, TrendingUp,
  Eye, EyeOff, Pin, Trash2, RefreshCw, AlertTriangle, Zap,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Newspaper,
  Sparkles, Loader2, BarChart2, DollarSign, Target, Lock,
  LogOut, UserPlus, Activity, CreditCard, Wallet, PieChart,
  PlayCircle, Pause, Volume2, Bell, Globe, Monitor, Calendar,
  ThumbsUp, ThumbsDown, ExternalLink, Check, Smartphone, Download,
  Share2, Link as LinkIcon, MapPin, Send, Link2, Copy, QrCode, Trophy,
  Search, Lightbulb, FileText, Youtube, Library
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import AdminNotificationPanel from "@/components/AdminNotificationPanel";
import SponsorAnalytics from "@/components/SponsorAnalytics";
import ContentShuffleManager from "@/components/ContentShuffleManager";
import SocialQRGenerator from "@/components/SocialQRGenerator";
import LaunchChecklist from "@/components/LaunchChecklist";
import { ScheduleHealthPanel, PennyDashboardPanel, SecurityPanel, PlatformStatsPanel } from "@/components/admin";

const API = '/api';

// Game Analytics Panel - Real Player Data (No AI)
function GameAnalyticsPanel() {
  const [analytics, setAnalytics] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const [analyticsRes, playersRes] = await Promise.all([
        axios.get(`${API}/live-survey/admin/real-player-analytics`),
        axios.get(`${API}/live-survey/admin/live-players`)
      ]);
      setAnalytics(analyticsRes.data);
      setPlayers(playersRes.data.players || []);
    } catch (error) {
      console.error("Failed to fetch game analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    if (autoRefresh) {
      const interval = setInterval(fetchAnalytics, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const deviceIcons = {
    mobile: <Smartphone className="w-4 h-4" />,
    tablet: <Monitor className="w-4 h-4" />,
    desktop: <Monitor className="w-4 h-4" />,
    tv: <Tv className="w-4 h-4" />,
    unknown: <Globe className="w-4 h-4" />
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="ml-3 text-zinc-400">Loading real player analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="game-analytics-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-emerald-400" />
            Real Player Analytics
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Live data from real players only • AI/Virtual excluded
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <Switch 
              checked={autoRefresh} 
              onCheckedChange={setAutoRefresh}
            />
            Auto-refresh (5s)
          </label>
          <Button onClick={fetchAnalytics} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-900/30 to-zinc-900 border-emerald-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-3xl font-bold text-white">{analytics?.total_real_players || 0}</p>
                <p className="text-xs text-zinc-400">Real Players</p>
              </div>
            </div>
            <p className="text-xs text-emerald-400 mt-2">
              {analytics?.ai_players_excluded || 0} AI excluded
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-900/30 to-zinc-900 border-blue-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-3xl font-bold text-white">{analytics?.active_players || 0}</p>
                <p className="text-xs text-zinc-400">Active (Answered)</p>
              </div>
            </div>
            <p className="text-xs text-blue-400 mt-2">
              +{analytics?.recent_joins_5min || 0} joined (5min)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-900/30 to-zinc-900 border-amber-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400" />
              <div>
                <p className="text-3xl font-bold text-white">{analytics?.scored_players || 0}</p>
                <p className="text-xs text-zinc-400">Scored Points</p>
              </div>
            </div>
            <p className="text-xs text-amber-400 mt-2">
              Avg: {analytics?.average_score || 0} pts
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/30 to-zinc-900 border-purple-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-3xl font-bold text-white">#{analytics?.current_batch || 0}</p>
                <p className="text-xs text-zinc-400">Current Batch</p>
              </div>
            </div>
            <p className="text-xs text-purple-400 mt-2">
              Q{analytics?.current_question || 0}/10
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Device & Location Breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Device Breakdown */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              Device Breakdown
            </CardTitle>
            <CardDescription>What devices are real players using?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(analytics?.device_breakdown || {}).map(([device, count]) => (
              <div key={device} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {deviceIcons[device] || <Globe className="w-4 h-4" />}
                  <span className="capitalize text-zinc-300">{device}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 rounded-full transition-all"
                      style={{ width: `${analytics?.device_percentages?.[device] || 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-zinc-400 w-16 text-right">
                    {count} ({analytics?.device_percentages?.[device] || 0}%)
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Geographic Breakdown */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-green-400" />
              Top Countries
            </CardTitle>
            <CardDescription>Where are real players playing from?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(analytics?.top_countries || []).length > 0 ? (
              analytics.top_countries.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-400" />
                    <span className="text-zinc-300">{item.country}</span>
                  </div>
                  <Badge variant="outline" className="border-green-600 text-green-400">
                    {item.count} players
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-sm">No location data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Players Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            Live Players ({players.length})
          </CardTitle>
          <CardDescription>Real players currently in the game • Sorted by score</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-2 text-xs text-zinc-400">#</th>
                  <th className="text-left py-3 px-2 text-xs text-zinc-400">Player</th>
                  <th className="text-left py-3 px-2 text-xs text-zinc-400">Device</th>
                  <th className="text-left py-3 px-2 text-xs text-zinc-400">Location</th>
                  <th className="text-right py-3 px-2 text-xs text-zinc-400">Score</th>
                  <th className="text-right py-3 px-2 text-xs text-zinc-400">Answers</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, i) => (
                  <tr key={player.player_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2 px-2 text-sm text-zinc-500">{i + 1}</td>
                    <td className="py-2 px-2">
                      <span className="text-sm text-zinc-300">{player.name || 'Anonymous'}</span>
                      <span className="text-xs text-zinc-600 ml-2">{player.player_id}</span>
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {deviceIcons[player.device_type]}
                        <span className="ml-1">{player.device_type}</span>
                      </Badge>
                    </td>
                    <td className="py-2 px-2">
                      <span className="text-sm text-zinc-400">
                        {player.city ? `${player.city}, ` : ''}{player.country || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span className={`font-bold ${player.score > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                        {player.score}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-sm text-zinc-400">
                      {player.questions_answered}
                    </td>
                  </tr>
                ))}
                {players.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      No real players in current batch yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// PlatformStatsPanel is now imported from @/components/admin

// Helper functions for country display
function getCountryFlag(code) {
  const flags = {
    'US': '🇺🇸', 'CA': '🇨🇦', 'GB': '🇬🇧', 'UK': '🇬🇧', 'AU': '🇦🇺', 'IN': '🇮🇳',
    'DE': '🇩🇪', 'FR': '🇫🇷', 'JP': '🇯🇵', 'KR': '🇰🇷', 'BR': '🇧🇷', 'MX': '🇲🇽',
    'NG': '🇳🇬', 'ZA': '🇿🇦', 'ES': '🇪🇸', 'IT': '🇮🇹', 'PH': '🇵🇭', 'ID': '🇮🇩',
    'TH': '🇹🇭', 'VN': '🇻🇳', 'PK': '🇵🇰', 'BD': '🇧🇩', 'EG': '🇪🇬', 'TR': '🇹🇷',
  };
  return flags[code?.toUpperCase()] || '🌍';
}

function getCountryName(code) {
  const names = {
    'US': 'United States', 'CA': 'Canada', 'GB': 'United Kingdom', 'UK': 'United Kingdom',
    'AU': 'Australia', 'IN': 'India', 'DE': 'Germany', 'FR': 'France', 'JP': 'Japan',
    'KR': 'South Korea', 'BR': 'Brazil', 'MX': 'Mexico', 'NG': 'Nigeria', 'ZA': 'South Africa',
    'ES': 'Spain', 'IT': 'Italy', 'PH': 'Philippines', 'ID': 'Indonesia', 'TH': 'Thailand',
    'VN': 'Vietnam', 'PK': 'Pakistan', 'BD': 'Bangladesh', 'EG': 'Egypt', 'TR': 'Turkey',
  };
  return names[code?.toUpperCase()] || code;
}

// Live Activity Feed - Real-time visitor actions
function LiveActivityFeed() {
  const [activities, setActivities] = useState([]);
  const [realtimeStats, setRealtimeStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchActivityFeed = async () => {
    try {
      const [feedRes, statsRes] = await Promise.all([
        axios.get(`${API}/analytics/activity-feed?limit=30`),
        axios.get(`${API}/analytics/realtime-stats`)
      ]);
      setActivities(feedRes.data.activities || []);
      setRealtimeStats(statsRes.data);
    } catch (error) {
      console.error("Failed to fetch activity feed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityFeed();
    if (autoRefresh) {
      const interval = setInterval(fetchActivityFeed, 3000); // Refresh every 3 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'page_visit': return <Eye className="w-4 h-4 text-blue-400" />;
      case 'game_joined': return <UserPlus className="w-4 h-4 text-green-400" />;
      case 'game_answered': return <Send className="w-4 h-4 text-purple-400" />;
      case 'game_won_prize': return <Trophy className="w-4 h-4 text-yellow-400" />;
      case 'game_claimed_prize': return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'game_shared': return <Share2 className="w-4 h-4 text-pink-400" />;
      default: return <Activity className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'page_visit': return 'border-l-blue-500';
      case 'game_joined': return 'border-l-green-500';
      case 'game_answered': return 'border-l-purple-500';
      case 'game_won_prize': return 'border-l-yellow-500';
      case 'game_claimed_prize': return 'border-l-emerald-500';
      case 'game_shared': return 'border-l-pink-500';
      default: return 'border-l-zinc-500';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = (now - date) / 1000; // seconds
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-zinc-400">Loading activity feed...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="live-activity-feed">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" />
            Live Activity Feed
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time visitor actions and game events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <Switch 
              checked={autoRefresh} 
              onCheckedChange={setAutoRefresh}
            />
            Auto-refresh (3s)
          </label>
          <Button onClick={fetchActivityFeed} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-900/30 to-zinc-900 border-blue-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Eye className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-3xl font-bold text-white">{realtimeStats?.visits_last_hour || 0}</p>
                <p className="text-xs text-zinc-400">Visits (Last Hour)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-900/30 to-zinc-900 border-green-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-3xl font-bold text-white">{realtimeStats?.visits_last_5min || 0}</p>
                <p className="text-xs text-zinc-400">Visits (Last 5 min)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/30 to-zinc-900 border-purple-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-3xl font-bold text-white">{activities.length}</p>
                <p className="text-xs text-zinc-400">Recent Activities</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-yellow-400" />
            Live Events
            <Badge variant="outline" className="ml-2 animate-pulse bg-green-500/20 text-green-400 border-green-500/50">
              LIVE
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {activities.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 border-l-4 ${getEventColor(activity.event_type)}`}
                >
                  <div className="flex-shrink-0">
                    {getEventIcon(activity.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{activity.description}</p>
                    {activity.details?.location && (
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {activity.details.location}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-xs text-zinc-500">
                    {formatTime(activity.timestamp)}
                  </div>
                </motion.div>
              ))}
              {activities.length === 0 && (
                <div className="py-8 text-center text-zinc-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent activity</p>
                  <p className="text-xs mt-1">Waiting for visitors...</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Tutorial Funnel Analytics Panel
function TutorialFunnelPanel() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [periodDays, setPeriodDays] = useState(7);

  const STEP_NAMES = [
    "Join the Live Game",
    "Wait for the Question",
    "Type Your Answer",
    "Watch Answers Rank Up",
    "Win Real Prizes!"
  ];

  const STEP_COLORS = [
    "from-blue-500 to-cyan-500",
    "from-purple-500 to-pink-500",
    "from-green-500 to-emerald-500",
    "from-orange-500 to-red-500",
    "from-yellow-500 to-amber-500"
  ];

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API}/analytics/tutorial/summary?days=${periodDays}`);
      setAnalytics(res.data);
    } catch (error) {
      console.error("Failed to fetch tutorial analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    if (autoRefresh) {
      const interval = setInterval(fetchAnalytics, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, periodDays]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        <span className="ml-3 text-zinc-400">Loading tutorial funnel analytics...</span>
      </div>
    );
  }

  const getStepRetention = (stepIndex) => {
    if (!analytics?.funnel || analytics.funnel.length === 0) return 0;
    const stepData = analytics.funnel.find(f => f.step === stepIndex + 1);
    if (!stepData || analytics.total_started === 0) return 0;
    return Math.round((stepData.views / analytics.total_started) * 100);
  };

  return (
    <div className="space-y-6" data-testid="tutorial-funnel-panel">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            Tutorial Funnel Analytics
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Track how users progress through the game tutorial at /game
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={periodDays.toString()} onValueChange={(v) => setPeriodDays(parseInt(v))}>
            <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24h</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <Switch 
              checked={autoRefresh} 
              onCheckedChange={setAutoRefresh}
            />
            Auto-refresh
          </label>
          <Button onClick={fetchAnalytics} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-900/30 to-zinc-900 border-purple-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Eye className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-3xl font-bold text-white">{analytics?.total_started || 0}</p>
                <p className="text-xs text-zinc-400">Started Tutorial</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-900/30 to-zinc-900 border-green-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-3xl font-bold text-white">{analytics?.total_completions || 0}</p>
                <p className="text-xs text-zinc-400">Completed Tutorial</p>
              </div>
            </div>
            <p className="text-xs text-green-400 mt-2">
              {analytics?.completion_rate || 0}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-900/30 to-zinc-900 border-red-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Play className="w-8 h-8 text-red-400" />
              <div>
                <p className="text-3xl font-bold text-white">{analytics?.play_clicks || 0}</p>
                <p className="text-xs text-zinc-400">Clicked Play</p>
              </div>
            </div>
            <p className="text-xs text-red-400 mt-2">
              {analytics?.conversion_rate || 0}% conversion
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-900/30 to-zinc-900 border-amber-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-amber-400" />
              <div>
                <p className="text-3xl font-bold text-white">
                  {analytics?.total_started > 0 
                    ? Math.round((analytics?.play_clicks / analytics?.total_started) * 100) 
                    : 0}%
                </p>
                <p className="text-xs text-zinc-400">Tutorial → Play</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Funnel Visualization */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-purple-400" />
            Step-by-Step Funnel
          </CardTitle>
          <CardDescription>
            User retention at each tutorial step
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {STEP_NAMES.map((name, i) => {
              const retention = getStepRetention(i);
              const stepData = analytics?.funnel?.find(f => f.step === i + 1);
              const views = stepData?.views || 0;
              const dropOff = stepData?.drop_off_percent || 0;
              
              return (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full bg-gradient-to-r ${STEP_COLORS[i]} flex items-center justify-center text-white text-xs font-bold`}>
                        {i + 1}
                      </span>
                      <span className="text-white">{name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-400">{views} views</span>
                      <span className={`font-medium ${retention >= 70 ? 'text-green-400' : retention >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {retention}% retained
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="h-8 bg-zinc-800 rounded-lg overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${retention}%` }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                        className={`h-full bg-gradient-to-r ${STEP_COLORS[i]} opacity-80`}
                      />
                    </div>
                    {i > 0 && dropOff > 0 && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-400">
                        -{dropOff.toFixed(1)}% drop-off
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Final conversion */}
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-red-500" />
                <span className="text-white font-medium">Clicked "Play Now"</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-zinc-400">{analytics?.play_clicks || 0} clicks</span>
                <span className="text-lg font-bold text-green-400">
                  {analytics?.conversion_rate || 0}% conversion
                </span>
              </div>
            </div>
            <div className="mt-2 h-8 bg-zinc-800 rounded-lg overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${analytics?.conversion_rate || 0}%` }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-red-600 to-red-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights Card */}
      <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-300">
            <Lightbulb className="w-5 h-5" />
            Funnel Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {analytics?.total_started === 0 ? (
              <li className="text-zinc-400">No tutorial views yet. Share ztvlivestream.com/game to get started!</li>
            ) : (
              <>
                {analytics?.completion_rate >= 70 && (
                  <li className="text-green-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Great completion rate! Users find the tutorial engaging.
                  </li>
                )}
                {analytics?.completion_rate < 40 && analytics?.total_started > 10 && (
                  <li className="text-yellow-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Consider shortening the tutorial or making steps more engaging.
                  </li>
                )}
                {analytics?.conversion_rate < 20 && analytics?.total_completions > 5 && (
                  <li className="text-orange-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Users complete tutorial but don't play. Make the Play button more prominent.
                  </li>
                )}
                {analytics?.conversion_rate >= 50 && (
                  <li className="text-green-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Excellent conversion! Tutorial effectively drives players to the game.
                  </li>
                )}
                {(() => {
                  const worstStep = analytics?.funnel?.reduce((worst, curr) => 
                    (curr.drop_off_percent > (worst?.drop_off_percent || 0)) ? curr : worst
                  , null);
                  if (worstStep && worstStep.drop_off_percent > 30) {
                    return (
                      <li className="text-red-400 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Biggest drop-off at Step {worstStep.step}: "{STEP_NAMES[worstStep.step - 1]}" ({worstStep.drop_off_percent.toFixed(1)}% lost)
                      </li>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// Stream Health Panel - FFprobe Roku Validation
function StreamHealthPanel() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/rtmp/stream-health`);
      setHealth(res.data);
      setLastChecked(new Date());
    } catch (error) {
      console.error("Failed to check stream health:", error);
      setHealth({ status: "error", message: "Failed to connect to health endpoint" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusColor = (status) => {
    switch (status) {
      case "healthy": return "text-green-400 bg-green-400/10 border-green-600";
      case "warning": return "text-yellow-400 bg-yellow-400/10 border-yellow-600";
      case "critical": return "text-red-400 bg-red-400/10 border-red-600";
      case "error": return "text-zinc-400 bg-zinc-400/10 border-zinc-600";
      default: return "text-zinc-400 bg-zinc-400/10 border-zinc-600";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "healthy": return <CheckCircle className="w-6 h-6 text-green-400" />;
      case "warning": return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
      case "critical": return <XCircle className="w-6 h-6 text-red-400" />;
      case "error": return <XCircle className="w-6 h-6 text-zinc-400" />;
      default: return <Loader2 className="w-6 h-6 animate-spin" />;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "critical": return <Badge className="bg-red-600 text-white">CRITICAL</Badge>;
      case "warning": return <Badge className="bg-yellow-600 text-white">WARNING</Badge>;
      default: return <Badge className="bg-zinc-600">INFO</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Stream Health Monitor
              </CardTitle>
              <CardDescription>
                FFprobe validation against Roku device specs
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">Auto-refresh</span>
                <Switch 
                  checked={autoRefresh} 
                  onCheckedChange={setAutoRefresh}
                />
              </div>
              <Button 
                onClick={checkHealth} 
                disabled={loading}
                variant="outline"
                className="border-cyan-600 text-cyan-400 hover:bg-cyan-600/20"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Check Now
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Status Overview */}
      <Card className={`border-2 ${getStatusColor(health?.status)}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {loading ? (
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            ) : (
              getStatusIcon(health?.status)
            )}
            <div className="flex-1">
              <h3 className="text-xl font-semibold">
                {loading ? "Checking stream..." : (
                  health?.status === "healthy" ? "Stream Healthy" :
                  health?.status === "warning" ? "Stream Has Warnings" :
                  health?.status === "critical" ? "Stream Critical Issues" :
                  "Stream Unavailable"
                )}
              </h3>
              <p className="text-sm text-zinc-400">
                {health?.status_message || health?.message || "Analyzing..."}
              </p>
            </div>
            {lastChecked && (
              <div className="text-right text-xs text-zinc-500">
                Last checked:<br />
                {lastChecked.toLocaleTimeString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stream Info Cards */}
      {health?.stream_info && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Resolution */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Resolution</p>
                  <p className="text-2xl font-bold text-white">{health.stream_info.resolution}</p>
                </div>
                {health.stream_info.width === 1920 && health.stream_info.height === 1080 ? (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400" />
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Required: 1920x1080</p>
            </CardContent>
          </Card>

          {/* Codec */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Codec</p>
                  <p className="text-2xl font-bold text-white uppercase">{health.stream_info.codec}</p>
                </div>
                {health.stream_info.codec === "h264" ? (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400" />
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Required: H.264</p>
            </CardContent>
          </Card>

          {/* Profile & Level */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Profile / Level</p>
                  <p className="text-2xl font-bold text-white">
                    {health.stream_info.profile} {health.stream_info.level}
                  </p>
                </div>
                {health.stream_info.level <= 4.1 ? (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-400" />
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Max: High 4.1</p>
            </CardContent>
          </Card>

          {/* Pixel Format */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Pixel Format</p>
                  <p className="text-2xl font-bold text-white">{health.stream_info.pix_fmt}</p>
                </div>
                {health.stream_info.pix_fmt === "yuv420p" ? (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Required: yuv420p</p>
            </CardContent>
          </Card>

          {/* FPS */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Frame Rate</p>
                  <p className="text-2xl font-bold text-white">{health.stream_info.fps} fps</p>
                </div>
                <Video className="w-6 h-6 text-cyan-400" />
              </div>
            </CardContent>
          </Card>

          {/* Bitrate */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Bitrate</p>
                  <p className="text-2xl font-bold text-white">
                    {health.stream_info.bitrate_kbps !== "unknown" 
                      ? `${health.stream_info.bitrate_kbps} kbps` 
                      : "N/A"}
                  </p>
                </div>
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          {/* Audio Info */}
          {health.audio_info && (
            <Card className="bg-zinc-900/50 border-zinc-800 md:col-span-2">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Audio</p>
                    <p className="text-2xl font-bold text-white">
                      {health.audio_info.codec?.toUpperCase()} • {health.audio_info.sample_rate}Hz • {health.audio_info.channels}ch
                    </p>
                  </div>
                  <Volume2 className="w-6 h-6 text-green-400" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Alerts Section */}
      {health?.alerts && health.alerts.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Compatibility Alerts ({health.alerts.length})
            </CardTitle>
            <CardDescription>Issues that may prevent Roku playback</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {health.alerts.map((alert, i) => (
              <div 
                key={i}
                className={`p-4 rounded-lg border ${
                  alert.severity === "critical" 
                    ? "bg-red-950/30 border-red-800" 
                    : "bg-yellow-950/30 border-yellow-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  {alert.severity === "critical" ? (
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getSeverityBadge(alert.severity)}
                      <span className="text-xs text-zinc-500 uppercase">{alert.type}</span>
                    </div>
                    <p className="text-sm text-zinc-200">{alert.message}</p>
                    <div className="mt-2 text-xs text-zinc-500">
                      Current: <span className="text-zinc-300">{alert.current}</span>
                      {alert.required && (
                        <> • Required: <span className="text-green-400">{alert.required}</span></>
                      )}
                      {alert.max_allowed && (
                        <> • Max: <span className="text-green-400">{alert.max_allowed}</span></>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Roku Specs Reference */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-purple-400" />
            Roku Device Requirements
          </CardTitle>
          <CardDescription>Stream must meet these specs for Roku playback</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Resolution</p>
              <p className="font-semibold text-white">1920x1080 (exact)</p>
            </div>
            <div>
              <p className="text-zinc-500">Codec</p>
              <p className="font-semibold text-white">H.264</p>
            </div>
            <div>
              <p className="text-zinc-500">Profile</p>
              <p className="font-semibold text-white">High, Main, or Baseline</p>
            </div>
            <div>
              <p className="text-zinc-500">Max Level</p>
              <p className="font-semibold text-white">4.1</p>
            </div>
            <div>
              <p className="text-zinc-500">Pixel Format</p>
              <p className="font-semibold text-white">yuv420p</p>
            </div>
            <div>
              <p className="text-zinc-500">Container</p>
              <p className="font-semibold text-white">HLS (m3u8)</p>
            </div>
            <div>
              <p className="text-zinc-500">Audio</p>
              <p className="font-semibold text-white">AAC</p>
            </div>
            <div>
              <p className="text-zinc-500">Bitrate</p>
              <p className="font-semibold text-white">Up to 10 Mbps</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Admin Login Component
function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [name, setName] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin-auth/login`, null, {
        params: { email, password }
      });
      localStorage.setItem("admin_token", res.data.access_token);
      localStorage.setItem("admin_user", JSON.stringify(res.data.user));
      onLogin(res.data.user, res.data.access_token);
      toast.success("Welcome back!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin-auth/register`, null, {
        params: { email, password, name, admin_code: adminCode }
      });
      localStorage.setItem("admin_token", res.data.access_token);
      localStorage.setItem("admin_user", JSON.stringify(res.data.user));
      onLogin(res.data.user, res.data.access_token);
      toast.success("Admin account created!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/admin-auth/forgot-password`, null, {
        params: { email }
      });
      setResetSent(true);
      toast.success("Password reset instructions sent to your email");
      // In development, show the reset link
      if (res.data.reset_link) {
        console.log("Reset link:", res.data.reset_link);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password View
  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                  <Lock className="w-7 h-7 text-white" />
                </div>
              </div>
              <CardTitle className="font-heading text-2xl tracking-wider">
                {resetSent ? "CHECK YOUR EMAIL" : "FORGOT PASSWORD"}
              </CardTitle>
              <CardDescription>
                {resetSent 
                  ? "We've sent password reset instructions to your email"
                  : "Enter your email to reset your password"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetSent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-zinc-400 text-sm">
                    Check your inbox for password reset instructions. The link expires in 60 minutes.
                  </p>
                  <Button 
                    onClick={() => { setIsForgotPassword(false); setResetSent(false); }}
                    className="w-full bg-red-600 hover:bg-red-500"
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email Address</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@ztvlivestream.com"
                      className="bg-zinc-800 border-zinc-700"
                      required
                      data-testid="forgot-email-input"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-red-600 hover:bg-red-500"
                    disabled={loading}
                    data-testid="reset-password-btn"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
            {!resetSent && (
              <CardFooter className="justify-center">
                <Button
                  variant="link"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  Back to Login
                </Button>
              </CardFooter>
            )}
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                <Tv className="w-7 h-7 text-white" />
              </div>
            </div>
            <CardTitle className="font-heading text-2xl tracking-wider">
              {isRegistering ? "CREATE ADMIN" : "ADMIN LOGIN"}
            </CardTitle>
            <CardDescription>
              {isRegistering 
                ? "Create your admin account to manage ZTVLIVE"
                : "Sign in to access the admin dashboard"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
              {isRegistering && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="bg-zinc-800 border-zinc-700"
                    required
                    data-testid="admin-name-input"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ztvlivestream.com"
                  className="bg-zinc-800 border-zinc-700"
                  required
                  data-testid="admin-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-zinc-800 border-zinc-700 pr-10"
                    required
                    data-testid="admin-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                    data-testid="toggle-password-visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {isRegistering && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="bg-zinc-800 border-zinc-700"
                      required
                      data-testid="admin-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="adminCode">Admin Code</Label>
                    <Input
                      id="adminCode"
                      type="text"
                      value={adminCode}
                      onChange={(e) => setAdminCode(e.target.value)}
                      placeholder="ZTVLIVE_FIRST_ADMIN_2026"
                      className="bg-zinc-800 border-zinc-700"
                      required
                      data-testid="admin-code-input"
                    />
                    <p className="text-xs text-zinc-500">
                      Use code: <code className="bg-zinc-800 px-1 rounded text-green-400">ZTVLIVE_FIRST_ADMIN_2026</code>
                    </p>
                  </div>
                </>
              )}
              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-500"
                disabled={loading}
                data-testid="admin-submit-btn"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
                ) : (
                  <><Lock className="w-4 h-4 mr-2" />{isRegistering ? "Create Account" : "Sign In"}</>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            {!isRegistering && (
              <Button
                variant="link"
                onClick={() => setIsForgotPassword(true)}
                className="text-zinc-500 hover:text-red-400 text-sm"
                data-testid="forgot-password-link"
              >
                Forgot your password?
              </Button>
            )}
            <Button
              variant="link"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-zinc-400 hover:text-white"
            >
              {isRegistering 
                ? "Already have an account? Sign in"
                : "First time? Create admin account"
              }
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

// Schedule Queue Panel Component
function ScheduleQueuePanel({ token }) {
  const [queue, setQueue] = useState({ pending: [], approved: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(null);
  
  // New state for creator scheduling
  const [creatorBookings, setCreatorBookings] = useState([]);
  const [creatorInvites, setCreatorInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/schedule/queue`, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setQueue(res.data);
    } catch (error) {
      console.error("Error fetching queue:", error);
      toast.error("Failed to load schedule queue");
    } finally {
      setLoading(false);
    }
  };

  // Fetch creator scheduling data
  const fetchCreatorScheduling = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [bookingsRes, invitesRes, slotsRes] = await Promise.all([
        axios.get(`${API}/creator-schedule/admin/pending`, { headers }).catch(() => ({ data: { pending_bookings: [] } })),
        axios.get(`${API}/creator-schedule/admin/invites`, { headers }).catch(() => ({ data: { invites: [] } })),
        axios.get(`${API}/creator-schedule/available-slots?days_ahead=3`).catch(() => ({ data: { available_slots: [] } }))
      ]);
      
      setCreatorBookings(bookingsRes.data.pending_bookings || []);
      setCreatorInvites(invitesRes.data.invites || []);
      setAvailableSlots(slotsRes.data.available_slots || []);
    } catch (error) {
      console.error("Error fetching creator scheduling:", error);
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchCreatorScheduling();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchQueue();
      fetchCreatorScheduling();
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // Create invite link
  const handleCreateInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter creator email");
      return;
    }
    
    setCreatingInvite(true);
    try {
      const res = await axios.post(
        `${API}/creator-schedule/invite/create`,
        {
          creator_email: inviteEmail,
          creator_name: inviteName || inviteEmail.split("@")[0],
          message: "You've been invited to schedule content on ZTVLIVE!",
          expires_in_days: 7
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Invite link created!");
      
      // Copy to clipboard
      await navigator.clipboard.writeText(res.data.invite_url);
      toast.success("Link copied to clipboard!");
      
      setInviteEmail("");
      setInviteName("");
      fetchCreatorScheduling();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create invite");
    } finally {
      setCreatingInvite(false);
    }
  };

  // Approve creator booking
  const handleApproveCreatorBooking = async (bookingId) => {
    try {
      await axios.post(`${API}/creator-schedule/admin/approve/${bookingId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Booking approved!");
      fetchCreatorScheduling();
    } catch (error) {
      toast.error("Failed to approve booking");
    }
  };

  // Reject creator booking
  const handleRejectCreatorBooking = async (bookingId) => {
    try {
      await axios.post(`${API}/creator-schedule/admin/reject/${bookingId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Booking rejected");
      fetchCreatorScheduling();
    } catch (error) {
      toast.error("Failed to reject booking");
    }
  };

  // Copy invite link
  const copyInviteLink = async (invite) => {
    const link = `${window.location.origin}/schedule-slot?invite=${invite.invite_token}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(invite.invite_token);
    toast.success("Link copied!");
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleApprove = async (scheduleId) => {
    setActionLoading(prev => ({ ...prev, [scheduleId]: "approve" }));
    try {
      await axios.put(`${API}/schedule/${scheduleId}/approve`, {}, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      toast.success("Schedule approved! Creator and followers notified.");
      fetchQueue();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to approve");
    } finally {
      setActionLoading(prev => ({ ...prev, [scheduleId]: null }));
    }
  };

  const handleReject = async (scheduleId) => {
    setActionLoading(prev => ({ ...prev, [scheduleId]: "reject" }));
    try {
      await axios.put(`${API}/schedule/${scheduleId}/reject`, null, {
        params: { reason: rejectReason },
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      toast.success("Schedule rejected");
      setShowRejectModal(null);
      setRejectReason("");
      fetchQueue();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to reject");
    } finally {
      setActionLoading(prev => ({ ...prev, [scheduleId]: null }));
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      month: "short", day: "numeric", 
      hour: "numeric", minute: "2-digit",
      hour12: true
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const ScheduleCard = ({ item, showActions = false }) => (
    <Card className="bg-zinc-800/50 border-zinc-700">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="w-32 h-20 rounded-lg bg-zinc-700 overflow-hidden flex-shrink-0">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Video className="w-8 h-8 text-zinc-600" />
              </div>
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white line-clamp-1 mb-1">{item.title}</h4>
            <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {item.creator_name}
              </span>
              {item.creator_username && (
                <Link 
                  to={`/c/${item.creator_username}`} 
                  className="text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  @{item.creator_username}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatTime(item.scheduled_time)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(item.duration_seconds)}
              </span>
              <Badge variant="outline" className="text-xs border-zinc-600">
                {item.category}
              </Badge>
            </div>
          </div>
          
          {/* Actions */}
          {showActions && (
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(item.schedule_id)}
                disabled={actionLoading[item.schedule_id]}
                className="bg-green-600 hover:bg-green-500"
                data-testid={`approve-${item.schedule_id}`}
              >
                {actionLoading[item.schedule_id] === "approve" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    Approve
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRejectModal(item.schedule_id)}
                disabled={actionLoading[item.schedule_id]}
                className="border-red-600/50 text-red-400 hover:bg-red-900/30"
                data-testid={`reject-${item.schedule_id}`}
              >
                <ThumbsDown className="w-4 h-4 mr-1" />
                Reject
              </Button>
            </div>
          )}
          
          {/* Status badge for non-pending */}
          {!showActions && (
            <div className="flex items-center">
              {item.status === "approved" && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Approved
                </Badge>
              )}
              {item.status === "live" && (
                <Badge className="bg-red-600 text-white border-red-600 animate-pulse">
                  <Radio className="w-3 h-3 mr-1" />
                  LIVE
                </Badge>
              )}
              {item.status === "completed" && (
                <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Completed
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-yellow-900/20 border-yellow-800/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-yellow-400">PENDING APPROVAL</CardDescription>
            <CardTitle className="text-4xl font-heading text-yellow-400">
              {queue.pending?.length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-green-900/20 border-green-800/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-green-400">UPCOMING</CardDescription>
            <CardTitle className="text-4xl font-heading text-green-400">
              {queue.approved?.length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardHeader className="pb-2">
            <CardDescription className="text-zinc-400">COMPLETED TODAY</CardDescription>
            <CardTitle className="text-4xl font-heading text-zinc-400">
              {queue.completed?.length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Schedule Your Slot Link & Invite Creators */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Quick Actions Card */}
        <Card className="bg-gradient-to-br from-orange-900/30 to-zinc-900 border-orange-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-400">
              <Calendar className="w-5 h-5" />
              Schedule Slots
            </CardTitle>
            <CardDescription>Manage time slots for creator content on the 24/7 live TV</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/schedule">
              <Button className="w-full bg-orange-600 hover:bg-orange-700">
                <Calendar className="w-4 h-4 mr-2" />
                View Full Schedule & Available Slots
              </Button>
            </Link>
            
            {/* Available slots preview */}
            {availableSlots.length > 0 && (
              <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-400 mb-2">Next 3 days availability:</p>
                <div className="flex gap-2">
                  {availableSlots.slice(0, 3).map((day, i) => {
                    const availCount = day.slots?.filter(s => s.is_available).length || 0;
                    return (
                      <div key={i} className="flex-1 text-center p-2 bg-zinc-700/50 rounded">
                        <div className="text-xs text-zinc-400">{day.day_name?.slice(0, 3)}</div>
                        <div className="text-lg font-bold text-white">{availCount}</div>
                        <div className="text-[10px] text-zinc-500">slots</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invite Creators Card */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400">
              <Send className="w-5 h-5" />
              Invite Creators
            </CardTitle>
            <CardDescription>Generate shareable links to invite creators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="creator@example.com"
                className="bg-zinc-800 border-zinc-700"
              />
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Name"
                className="bg-zinc-800 border-zinc-700 w-32"
              />
            </div>
            <Button
              onClick={handleCreateInvite}
              disabled={creatingInvite || !inviteEmail}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {creatingInvite ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Create & Copy Invite Link
            </Button>
            
            {/* Recent invites */}
            {creatorInvites.length > 0 && (
              <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                {creatorInvites.slice(0, 3).map((invite) => (
                  <div key={invite.invite_token} className="flex items-center justify-between p-2 bg-zinc-800 rounded text-sm">
                    <span className="truncate">{invite.creator_name || invite.creator_email}</span>
                    <div className="flex items-center gap-2">
                      {invite.used ? (
                        <Badge className="bg-green-600/20 text-green-400 text-xs">Used</Badge>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => copyInviteLink(invite)} className="h-6 w-6 p-0">
                          {copiedLink === invite.invite_token ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Creator Slot Bookings (if any pending) */}
      {creatorBookings.length > 0 && (
        <Card className="bg-zinc-900 border-orange-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-400">
              <Clock className="w-5 h-5" />
              Creator Slot Requests ({creatorBookings.length})
            </CardTitle>
            <CardDescription>New creators requesting time slots on the live schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {creatorBookings.map((booking) => (
                <div key={booking.booking_id} className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-white">{booking.title}</h4>
                      <p className="text-sm text-zinc-400">by {booking.creator_name} ({booking.creator_email})</p>
                    </div>
                    <Badge variant="outline" className="border-orange-600 text-orange-400">New</Badge>
                  </div>
                  <div className="text-sm text-zinc-500 mb-3">
                    <span>📅 {booking.slot_date} at {String(booking.slot_start_hour).padStart(2, '0')}:{String(booking.slot_start_minute || 0).padStart(2, '0')}</span>
                    <span className="ml-3">⏱ {booking.duration_minutes} min</span>
                  </div>
                  {booking.video_url && (
                    <a href={booking.video_url} target="_blank" rel="noopener noreferrer" 
                       className="text-xs text-blue-400 hover:underline block mb-3 truncate">
                      {booking.video_url}
                    </a>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApproveCreatorBooking(booking.booking_id)} 
                            className="flex-1 bg-green-600 hover:bg-green-700">
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRejectCreatorBooking(booking.booking_id)}
                            className="flex-1 border-red-600 text-red-400 hover:bg-red-900/20">
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Approval Section */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-400">
            <AlertTriangle className="w-5 h-5" />
            Pending Approval ({queue.pending?.length || 0})
          </CardTitle>
          <CardDescription>Review and approve creator content for the live schedule</CardDescription>
        </CardHeader>
        <CardContent>
          {queue.pending?.length > 0 ? (
            <div className="space-y-3">
              {queue.pending.map((item) => (
                <ScheduleCard key={item.schedule_id} item={item} showActions />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No pending approvals</p>
              <p className="text-sm">All caught up!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved/Upcoming Section */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-400">
            <Calendar className="w-5 h-5" />
            Upcoming Schedule ({queue.approved?.length || 0})
          </CardTitle>
          <CardDescription>Approved content scheduled to go live</CardDescription>
        </CardHeader>
        <CardContent>
          {queue.approved?.length > 0 ? (
            <div className="space-y-3">
              {queue.approved.map((item) => (
                <ScheduleCard key={item.schedule_id} item={item} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No upcoming scheduled content</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recently Completed */}
      {queue.completed?.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-400">
              <CheckCircle className="w-5 h-5" />
              Recently Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {queue.completed.slice(0, 5).map((item) => (
                <ScheduleCard key={item.schedule_id} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setShowRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4">Reject Schedule Request</h3>
              <p className="text-zinc-400 text-sm mb-4">
                Provide a reason for rejection (optional). The creator will be notified.
              </p>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="bg-zinc-800 border-zinc-700 text-white mb-4"
                rows={3}
              />
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectModal(null);
                    setRejectReason("");
                  }}
                  className="border-zinc-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleReject(showRejectModal)}
                  disabled={actionLoading[showRejectModal]}
                  className="bg-red-600 hover:bg-red-500"
                >
                  {actionLoading[showRejectModal] === "reject" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Reject"
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Submissions Panel - Shows pending submissions, creator videos, and stream submissions
function SubmissionsPanel({ token }) {
  const [submissions, setSubmissions] = useState([]);
  const [creatorVideos, setCreatorVideos] = useState([]);
  const [streamSubmissions, setStreamSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [activeSubmissionTab, setActiveSubmissionTab] = useState("highlights");

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [subRes, videosRes, streamsRes] = await Promise.all([
        axios.get(`${API}/submissions`, { headers, withCredentials: true }).catch(() => ({ data: { submissions: [] } })),
        axios.get(`${API}/creator-videos/all`, { headers }).catch(() => ({ data: { videos: [] } })),
        axios.get(`${API}/admin/stream-submissions`, { headers }).catch(() => ({ data: [] }))
      ]);
      
      setSubmissions(subRes.data?.submissions || subRes.data || []);
      setCreatorVideos(videosRes.data?.videos || videosRes.data || []);
      setStreamSubmissions(Array.isArray(streamsRes.data) ? streamsRes.data : []);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 60000);
    return () => clearInterval(interval);
  }, [token]);

  const handleApprove = async (type, id) => {
    setActionLoading({ ...actionLoading, [id]: true });
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      if (type === "submission") {
        await axios.post(`${API}/submissions/${id}/approve`, {}, { headers, withCredentials: true });
      } else if (type === "stream") {
        await axios.post(`${API}/stream-submissions/${id}/approve`, {}, { headers });
      }
      
      toast.success("Approved successfully!");
      fetchSubmissions();
    } catch (error) {
      toast.error("Failed to approve");
    } finally {
      setActionLoading({ ...actionLoading, [id]: false });
    }
  };

  const handleReject = async (type, id) => {
    setActionLoading({ ...actionLoading, [id]: true });
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      if (type === "submission") {
        await axios.post(`${API}/submissions/${id}/reject`, {}, { headers, withCredentials: true });
      } else if (type === "stream") {
        await axios.post(`${API}/stream-submissions/${id}/reject`, {}, { headers });
      }
      
      toast.success("Rejected successfully!");
      fetchSubmissions();
    } catch (error) {
      toast.error("Failed to reject");
    } finally {
      setActionLoading({ ...actionLoading, [id]: false });
    }
  };

  const pendingSubmissions = submissions.filter(s => s.status === "pending");
  const pendingStreams = streamSubmissions.filter(s => s.ai_review_status === "pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-orange-900/20 border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-600 rounded-lg">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pendingSubmissions.length}</p>
                <p className="text-xs text-orange-300">Pending Highlights</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-purple-900/20 border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{creatorVideos.length}</p>
                <p className="text-xs text-purple-300">Creator Videos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-blue-900/20 border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pendingStreams.length}</p>
                <p className="text-xs text-blue-300">Stream Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-900/20 border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{submissions.filter(s => s.status === "approved").length}</p>
                <p className="text-xs text-green-300">Total Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sub-tabs for different submission types */}
      <Tabs value={activeSubmissionTab} onValueChange={setActiveSubmissionTab}>
        <TabsList className="bg-zinc-800 border border-zinc-700">
          <TabsTrigger value="highlights" className="data-[state=active]:bg-orange-600">
            Highlights ({pendingSubmissions.length} pending)
          </TabsTrigger>
          <TabsTrigger value="creator-videos" className="data-[state=active]:bg-purple-600">
            Creator Videos ({creatorVideos.length})
          </TabsTrigger>
          <TabsTrigger value="streams" className="data-[state=active]:bg-blue-600">
            Streams ({pendingStreams.length} pending)
          </TabsTrigger>
        </TabsList>

        {/* Highlight Submissions */}
        <TabsContent value="highlights" className="mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-orange-400" />
                Highlight Submissions
              </CardTitle>
              <CardDescription>User-submitted content waiting for review</CardDescription>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No submissions yet</p>
              ) : (
                <div className="space-y-4">
                  {submissions.map((sub) => (
                    <div 
                      key={sub.id} 
                      className={`p-4 rounded-lg border ${
                        sub.status === "pending" ? "bg-orange-900/10 border-orange-800" :
                        sub.status === "approved" ? "bg-green-900/10 border-green-800" :
                        "bg-red-900/10 border-red-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-white">{sub.title}</h4>
                            <Badge variant={sub.status === "pending" ? "outline" : sub.status === "approved" ? "default" : "destructive"}>
                              {sub.status}
                            </Badge>
                          </div>
                          <p className="text-zinc-400 text-sm mb-2">{sub.description}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                            <span>By: {sub.submitter_name || sub.submitter_email}</span>
                            <span>Category: {sub.category}</span>
                            <span>Submitted: {new Date(sub.submitted_at).toLocaleDateString()}</span>
                          </div>
                          {sub.source_url && (
                            <a 
                              href={sub.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-violet-400 text-sm hover:underline flex items-center gap-1 mt-2"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Source
                            </a>
                          )}
                        </div>
                        
                        {sub.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-500"
                              disabled={actionLoading[sub.id]}
                              onClick={() => handleApprove("submission", sub.id)}
                            >
                              {actionLoading[sub.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionLoading[sub.id]}
                              onClick={() => handleReject("submission", sub.id)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Creator Videos */}
        <TabsContent value="creator-videos" className="mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-400" />
                Creator Uploaded Videos
              </CardTitle>
              <CardDescription>Videos uploaded by creators</CardDescription>
            </CardHeader>
            <CardContent>
              {creatorVideos.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No creator videos yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {creatorVideos.map((video) => (
                    <div 
                      key={video.id || video._id} 
                      className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700"
                    >
                      <h4 className="font-semibold text-white mb-1">{video.title}</h4>
                      <p className="text-zinc-400 text-sm mb-2">{video.description?.slice(0, 100)}...</p>
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                        <span>Creator: {video.creator_id || video.uploader}</span>
                        <span>Duration: {video.duration}</span>
                      </div>
                      {video.video_url && (
                        <a 
                          href={video.video_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-purple-400 text-sm hover:underline flex items-center gap-1 mt-2"
                        >
                          <Play className="w-3 h-3" />
                          Watch Video
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stream Submissions */}
        <TabsContent value="streams" className="mt-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-blue-400" />
                Live Stream Submissions
              </CardTitle>
              <CardDescription>Creators requesting to go live</CardDescription>
            </CardHeader>
            <CardContent>
              {streamSubmissions.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No stream submissions yet</p>
              ) : (
                <div className="space-y-4">
                  {streamSubmissions.map((stream) => (
                    <div 
                      key={stream.id} 
                      className={`p-4 rounded-lg border ${
                        stream.ai_review_status === "pending" ? "bg-blue-900/10 border-blue-800" :
                        stream.ai_review_status === "approved" ? "bg-green-900/10 border-green-800" :
                        "bg-zinc-800/50 border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white mb-1">{stream.title}</h4>
                          <p className="text-zinc-400 text-sm mb-2">{stream.description}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                            <span>By: {stream.creator_name}</span>
                            <span>Type: {stream.stream_type}</span>
                            <span>Status: {stream.ai_review_status}</span>
                          </div>
                        </div>
                        
                        {stream.ai_review_status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-500"
                              disabled={actionLoading[stream.id]}
                              onClick={() => handleApprove("stream", stream.id)}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionLoading[stream.id]}
                              onClick={() => handleReject("stream", stream.id)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button 
          variant="outline" 
          onClick={fetchSubmissions}
          className="border-zinc-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Submissions
        </Button>
      </div>
    </div>
  );
}

// Live Mix Program Panel - Shows automated playlist and scheduled content
function LiveMixProgramPanel({ token }) {
  const [nowPlaying, setNowPlaying] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [scheduledContent, setScheduledContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testVideoUrl, setTestVideoUrl] = useState("");
  const [testingVideo, setTestingVideo] = useState(null);

  const fetchProgramming = async () => {
    try {
      // Fetch current now playing from automated system
      const [syncRes, upcomingRes, scheduleRes] = await Promise.all([
        axios.get(`${API}/tv/sync`),
        axios.get(`${API}/tv/upcoming?count=10`),
        axios.get(`${API}/schedule/queue`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }).catch(() => ({ data: { pending: [], approved: [], completed: [] } }))
      ]);
      
      setNowPlaying(syncRes.data);
      setUpcoming(upcomingRes.data?.upcoming || []);
      setScheduledContent(scheduleRes.data);
    } catch (error) {
      console.error("Error fetching programming:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgramming();
    // Refresh every 15 seconds
    const interval = setInterval(fetchProgramming, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", hour12: true
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const testVideo = (url) => {
    // Extract video ID and test embedding
    const videoId = url?.split("/embed/")[1]?.split("?")[0] || url?.split("v=")[1]?.split("&")[0];
    if (videoId) {
      setTestingVideo({
        url: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`,
        originalUrl: url
      });
    } else {
      toast.error("Invalid YouTube URL");
    }
  };

  const testCustomVideo = () => {
    if (!testVideoUrl.trim()) {
      toast.error("Please enter a YouTube URL");
      return;
    }
    testVideo(testVideoUrl);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-red-500" />
      </div>
    );
  }

  // Check if there's currently scheduled creator content
  const hasLiveScheduled = scheduledContent?.approved?.some(item => item.status === "live");
  const nextScheduled = scheduledContent?.approved?.find(item => item.status === "approved");

  return (
    <div className="space-y-6">
      {/* Live Status Banner */}
      <Card className={`border-2 ${hasLiveScheduled ? 'bg-red-900/30 border-red-600' : 'bg-green-900/20 border-green-700'}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full animate-pulse ${hasLiveScheduled ? 'bg-red-500' : 'bg-green-500'}`} />
              <div>
                <p className="font-bold text-lg">
                  {hasLiveScheduled ? '🎬 CREATOR CONTENT LIVE' : '🎵 AUTOMATED PLAYLIST'}
                </p>
                <p className="text-sm text-zinc-400">
                  {hasLiveScheduled 
                    ? 'Scheduled creator content is currently playing' 
                    : 'Running 24/7 automated mix program'}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchProgramming}
              className="border-zinc-600"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Now Playing */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-500">
            <Radio className="w-5 h-5 animate-pulse" />
            NOW PLAYING
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nowPlaying && (
            <div className="flex gap-4">
              <div className="w-48 h-28 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                {nowPlaying.thumbnail ? (
                  <img src={nowPlaying.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-10 h-10 text-zinc-600" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-xl text-white mb-2">{nowPlaying.title}</h3>
                <div className="flex items-center gap-3 text-sm text-zinc-400 mb-3">
                  <Badge variant="outline" className="border-zinc-600">{nowPlaying.category}</Badge>
                  <span>Elapsed: {formatDuration(nowPlaying.elapsed_seconds)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testVideo(nowPlaying.video_url)}
                    className="border-zinc-600"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Test Embed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(nowPlaying.video_url?.replace('/embed/', '/watch?v='), '_blank')}
                    className="border-zinc-600"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View on YouTube
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Video Section */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-400" />
            Test Video Embed
          </CardTitle>
          <CardDescription>Test any YouTube URL for embedding compatibility</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              value={testVideoUrl}
              onChange={(e) => setTestVideoUrl(e.target.value)}
              placeholder="Paste YouTube URL to test..."
              className="bg-zinc-800 border-zinc-700"
            />
            <Button onClick={testCustomVideo} className="bg-blue-600 hover:bg-blue-500">
              Test
            </Button>
          </div>
          
          {testingVideo && (
            <div className="space-y-2">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <iframe
                  src={testingVideo.url}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">Testing: {testingVideo.originalUrl}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTestingVideo(null)}
                  className="border-zinc-600"
                >
                  Close Test
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Automated Playlist */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-400">
              <PlayCircle className="w-5 h-5" />
              Automated Playlist Queue
            </CardTitle>
            <CardDescription>Next videos in the 24/7 mix (auto-generated)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {upcoming.map((item, index) => (
                  <div 
                    key={item.id + index} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="text-zinc-500 text-sm w-6">{index + 1}</span>
                    <div className="w-16 h-10 rounded bg-zinc-800 overflow-hidden flex-shrink-0">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-4 h-4 text-zinc-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white line-clamp-1">{item.title}</p>
                      <p className="text-xs text-zinc-500">{item.category} • {formatDuration(item.duration_seconds)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => testVideo(item.video_url)}
                      className="h-8 w-8 p-0"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Scheduled Creator Content */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <Calendar className="w-5 h-5" />
              Scheduled Creator Content
            </CardTitle>
            <CardDescription>Creator-submitted content overrides automated playlist</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {scheduledContent?.approved?.length > 0 ? (
                  scheduledContent.approved.map((item) => (
                    <div 
                      key={item.schedule_id} 
                      className={`p-3 rounded-lg border ${item.status === 'live' ? 'bg-red-900/30 border-red-600' : 'bg-zinc-800/50 border-zinc-700'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-12 rounded bg-zinc-700 overflow-hidden flex-shrink-0">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Video className="w-5 h-5 text-zinc-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white line-clamp-1">{item.title}</p>
                          <p className="text-xs text-zinc-500">
                            @{item.creator_username} • {formatTime(item.scheduled_time)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {item.status === "live" && (
                            <Badge className="bg-red-600 animate-pulse">LIVE</Badge>
                          )}
                          {item.status === "approved" && (
                            <Badge className="bg-green-600/20 text-green-400 border-green-600">
                              Scheduled
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => testVideo(item.video_url)}
                            className="h-6 text-xs"
                          >
                            Test
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-zinc-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No scheduled creator content</p>
                    <p className="text-sm">Automated playlist is running 24/7</p>
                  </div>
                )}

                {/* Pending section */}
                {scheduledContent?.pending?.length > 0 && (
                  <>
                    <div className="border-t border-zinc-700 my-4 pt-4">
                      <p className="text-sm font-medium text-yellow-400 mb-3">
                        ⏳ Pending Approval ({scheduledContent.pending.length})
                      </p>
                    </div>
                    {scheduledContent.pending.map((item) => (
                      <div 
                        key={item.schedule_id} 
                        className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-10 rounded bg-zinc-700 overflow-hidden flex-shrink-0">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video className="w-4 h-4 text-zinc-600" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white line-clamp-1">{item.title}</p>
                            <p className="text-xs text-zinc-500">
                              @{item.creator_username} • {formatTime(item.scheduled_time)}
                            </p>
                          </div>
                          <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600">
                            Pending
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-900/20 border-blue-800/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <p className="font-medium text-blue-300">How the Mix Program Works</p>
              <ul className="text-sm text-blue-200/70 mt-2 space-y-1">
                <li>• The 24/7 channel runs an <strong>automated playlist</strong> by default</li>
                <li>• When a creator's <strong>scheduled content</strong> starts, it <strong>overrides</strong> the automated playlist</li>
                <li>• Once the scheduled content <strong>expires</strong>, the channel automatically returns to the <strong>automated playlist</strong></li>
                <li>• You can test any video embed above to verify it works before approval</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Visitor Analytics Panel - Shows app installs, SEO campaigns, and general traffic
function VisitorAnalyticsPanel({ token }) {
  const [analytics, setAnalytics] = useState(null);
  const [appInstalls, setAppInstalls] = useState(null);
  const [seoData, setSeoData] = useState(null);
  const [demographics, setDemographics] = useState(null);
  const [pushStats, setPushStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [activeSection, setActiveSection] = useState('overview');

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [overviewRes, installsRes, seoRes, demoRes, pushRes] = await Promise.all([
        axios.get(`${API}/analytics/visitors/overview?days=${period}`),
        axios.get(`${API}/analytics/app-installs/summary?days=${period}`),
        axios.get(`${API}/analytics/seo/summary?days=${period}`),
        axios.get(`${API}/analytics/demographics?days=${period}`),
        axios.get(`${API}/push/stats?days=${period}`)
      ]);
      
      setAnalytics(overviewRes.data);
      setAppInstalls(installsRes.data);
      setSeoData(seoRes.data);
      setDemographics(demoRes.data);
      setPushStats(pushRes.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [period]);

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-red-500" />
      </div>
    );
  }

  // Country flag mapping (simplified)
  const getCountryFlag = (country) => {
    const flags = {
      'United States': '🇺🇸', 'US': '🇺🇸',
      'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'GB': '🇬🇧',
      'Canada': '🇨🇦', 'CA': '🇨🇦',
      'Germany': '🇩🇪', 'DE': '🇩🇪',
      'France': '🇫🇷', 'FR': '🇫🇷',
      'Australia': '🇦🇺', 'AU': '🇦🇺',
      'Japan': '🇯🇵', 'JP': '🇯🇵',
      'Brazil': '🇧🇷', 'BR': '🇧🇷',
      'India': '🇮🇳', 'IN': '🇮🇳',
      'Mexico': '🇲🇽', 'MX': '🇲🇽',
      'Spain': '🇪🇸', 'ES': '🇪🇸',
      'Italy': '🇮🇹', 'IT': '🇮🇹',
      'Netherlands': '🇳🇱', 'NL': '🇳🇱',
      'South Korea': '🇰🇷', 'KR': '🇰🇷',
      'Nigeria': '🇳🇬', 'NG': '🇳🇬',
      'South Africa': '🇿🇦', 'ZA': '🇿🇦',
      'Kenya': '🇰🇪', 'KE': '🇰🇪',
      'Philippines': '🇵🇭', 'PH': '🇵🇭',
      'Indonesia': '🇮🇩', 'ID': '🇮🇩',
    };
    return flags[country] || '🌍';
  };

  return (
    <div className="space-y-6">
      {/* Period Selector & Section Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant={activeSection === 'overview' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('overview')}
            className={activeSection === 'overview' ? 'bg-red-600' : 'border-zinc-600'}
          >
            Overview
          </Button>
          <Button 
            variant={activeSection === 'demographics' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('demographics')}
            className={activeSection === 'demographics' ? 'bg-blue-600' : 'border-zinc-600'}
          >
            <Globe className="w-4 h-4 mr-1" />
            Locations
          </Button>
          <Button 
            variant={activeSection === 'time' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('time')}
            className={activeSection === 'time' ? 'bg-green-600' : 'border-zinc-600'}
          >
            <Clock className="w-4 h-4 mr-1" />
            Time Patterns
          </Button>
          <Button 
            variant={activeSection === 'duration' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('duration')}
            className={activeSection === 'duration' ? 'bg-purple-600' : 'border-zinc-600'}
          >
            <Activity className="w-4 h-4 mr-1" />
            Duration
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period.toString()} onValueChange={(v) => setPeriod(parseInt(v))}>
            <SelectTrigger className="w-[140px] bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchAnalytics} size="sm" className="border-zinc-600">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Overview Stats Cards - Always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-sm font-medium">Total Page Views</p>
                <p className="text-3xl font-bold text-white">{analytics?.total_page_views?.toLocaleString() || 0}</p>
                <p className="text-xs text-blue-400 mt-1">Today: {analytics?.today_views?.toLocaleString() || 0}</p>
              </div>
              <Eye className="w-10 h-10 text-blue-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-300 text-sm font-medium">Unique Visitors</p>
                <p className="text-3xl font-bold text-white">{analytics?.unique_visitors?.toLocaleString() || 0}</p>
                <p className="text-xs text-green-400 mt-1">Live now: {analytics?.concurrent_viewers || 0}</p>
              </div>
              <Users className="w-10 h-10 text-green-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-300 text-sm font-medium">App Installs</p>
                <p className="text-3xl font-bold text-white">{analytics?.app_installs?.total?.toLocaleString() || 0}</p>
                <p className="text-xs text-purple-400 mt-1">Today: {analytics?.app_installs?.today || 0}</p>
              </div>
              <Download className="w-10 h-10 text-purple-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 border-amber-700/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-300 text-sm font-medium">SEO Visits</p>
                <p className="text-3xl font-bold text-white">{analytics?.seo_visits?.toLocaleString() || 0}</p>
                <p className="text-xs text-amber-400 mt-1">From campaigns</p>
              </div>
              <TrendingUp className="w-10 h-10 text-amber-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Push Notification Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-900/50 to-red-800/30 border-red-700/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-300 text-sm font-medium">Push Subscribers</p>
                <p className="text-3xl font-bold text-white">{pushStats?.total_subscriptions?.toLocaleString() || 0}</p>
                <p className="text-xs text-red-400 mt-1">Notification-enabled users</p>
              </div>
              <Bell className="w-10 h-10 text-red-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-900/50 to-pink-800/30 border-pink-700/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-300 text-sm font-medium">Creator Follows</p>
                <p className="text-3xl font-bold text-white">{pushStats?.total_follows?.toLocaleString() || 0}</p>
                <p className="text-xs text-pink-400 mt-1">"Notify Me" subscriptions</p>
              </div>
              <Users className="w-10 h-10 text-pink-400 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 border-cyan-700/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-300 text-sm font-medium">Top Followed Creator</p>
                <p className="text-xl font-bold text-white truncate">
                  {pushStats?.top_followed_creators?.[0]?.creator_name || "No data"}
                </p>
                <p className="text-xs text-cyan-400 mt-1">
                  {pushStats?.top_followed_creators?.[0]?.followers?.toLocaleString() || 0} followers
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-cyan-400 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overview Section - App Installs & SEO (only show when overview is active) */}
      {activeSection === 'overview' && (
        <>
          {/* App Installs by Platform */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-purple-400" />
              App Installs by Platform
            </CardTitle>
            <CardDescription>Breakdown of PWA installations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['android', 'ios', 'desktop'].map((platform) => {
                const count = analytics?.app_installs?.by_platform?.[platform] || 0;
                const total = analytics?.app_installs?.total || 1;
                const percentage = Math.round((count / total) * 100) || 0;
                const colors = {
                  android: { bg: 'bg-green-600', text: 'text-green-400' },
                  ios: { bg: 'bg-blue-600', text: 'text-blue-400' },
                  desktop: { bg: 'bg-purple-600', text: 'text-purple-400' }
                };
                const icons = {
                  android: '🤖',
                  ios: '🍎',
                  desktop: '💻'
                };
                
                return (
                  <div key={platform} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span>{icons[platform]}</span>
                        <span className="capitalize">{platform}</span>
                      </span>
                      <span className={colors[platform].text}>{count.toLocaleString()} ({percentage}%)</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* SEO Campaign Performance */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-400" />
              SEO Campaign Performance
            </CardTitle>
            <CardDescription>Traffic from search engines and campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* By Source */}
              <div>
                <p className="text-sm font-medium text-zinc-400 mb-2">Traffic Sources</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(seoData?.by_source || {}).slice(0, 6).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between bg-zinc-800/50 rounded p-2">
                      <span className="text-sm capitalize">{source}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Top Keywords */}
              {seoData?.top_keywords?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-zinc-400 mb-2">Top Keywords</p>
                  <div className="space-y-1">
                    {seoData.top_keywords.slice(0, 5).map((item) => (
                      <div key={item.keyword} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300 truncate max-w-[200px]">{item.keyword}</span>
                        <span className="text-amber-400">{item.visits}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Traffic Chart (Simple) */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            Daily Traffic (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between h-40 gap-2">
            {analytics?.daily_traffic?.slice(-7).map((day, index) => {
              const maxViews = Math.max(...(analytics.daily_traffic?.map(d => d.views) || [1]));
              const heightPercent = (day.views / maxViews) * 100;
              
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-blue-600 rounded-t transition-all hover:bg-blue-500"
                    style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                    title={`${day.views} views`}
                  />
                  <span className="text-xs text-zinc-500">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className="text-xs text-zinc-400">{day.views}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Admin Access Link */}
      <Card className="bg-gradient-to-r from-red-900/30 to-zinc-900 border-red-800/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-red-400" />
                Admin Dashboard Quick Access
              </h3>
              <p className="text-sm text-zinc-400 mt-1">Share this link for admin access (requires login)</p>
              <code className="text-xs bg-zinc-800 px-2 py-1 rounded mt-2 inline-block text-green-400">
                https://ztvlivestream.com/admin
              </code>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-red-700 text-red-400 hover:bg-red-900/30"
                onClick={() => {
                  navigator.clipboard.writeText('https://ztvlivestream.com/admin');
                  toast.success('Admin link copied to clipboard!');
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
        </>
      )}

      {/* Demographics Section - Locations */}
      {activeSection === 'demographics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Countries */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" />
                  Visitors by Country
                </CardTitle>
                <CardDescription>Top locations of your audience</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-3">
                    {demographics?.locations?.by_country?.length > 0 ? (
                      demographics.locations.by_country.map((item, index) => {
                        const maxVisitors = demographics.locations.by_country[0]?.visitors || 1;
                        const percentage = Math.round((item.visitors / maxVisitors) * 100);
                        return (
                          <div key={item.country} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <span className="text-lg">{getCountryFlag(item.country)}</span>
                                <span className="text-white">{item.country}</span>
                              </span>
                              <span className="text-blue-400 font-medium">{item.visitors.toLocaleString()}</span>
                            </div>
                            <Progress value={percentage} className="h-1.5" />
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-zinc-500">
                        <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No location data available yet</p>
                        <p className="text-xs">Data will appear as visitors browse your site</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Top Cities */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-400" />
                  Top Cities
                </CardTitle>
                <CardDescription>Where your viewers are located</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {demographics?.locations?.by_city?.length > 0 ? (
                      demographics.locations.by_city.map((item, index) => (
                        <div 
                          key={`${item.city}-${item.country}`} 
                          className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500 text-sm w-6">#{index + 1}</span>
                            <div>
                              <p className="text-white text-sm font-medium">{item.city}</p>
                              <p className="text-xs text-zinc-500">{item.country}</p>
                            </div>
                          </div>
                          <Badge variant="secondary">{item.visitors}</Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-zinc-500">
                        <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No city data available</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Device & Browser Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-purple-400" />
                  Device Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(demographics?.devices?.by_type || {}).map(([device, count]) => {
                    const total = Object.values(demographics?.devices?.by_type || {}).reduce((a, b) => a + b, 1);
                    const percentage = Math.round((count / total) * 100);
                    const icons = { desktop: '💻', mobile: '📱', tablet: '📲' };
                    return (
                      <div key={device} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span>{icons[device] || '📱'}</span>
                            <span className="capitalize">{device}</span>
                          </span>
                          <span className="text-purple-400">{count} ({percentage}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                  {Object.keys(demographics?.devices?.by_type || {}).length === 0 && (
                    <p className="text-zinc-500 text-center py-4">No device data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-amber-400" />
                  Browsers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {demographics?.devices?.by_browser?.map((item) => (
                    <div key={item.browser} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded">
                      <span className="text-white">{item.browser}</span>
                      <Badge variant="outline" className="border-amber-600 text-amber-400">{item.count}</Badge>
                    </div>
                  ))}
                  {(!demographics?.devices?.by_browser || demographics.devices.by_browser.length === 0) && (
                    <p className="text-zinc-500 text-center py-4">No browser data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Time Patterns Section */}
      {activeSection === 'time' && (
        <div className="space-y-6">
          {/* Peak Time Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-300 text-sm font-medium">Peak Hour</p>
                    <p className="text-4xl font-bold text-white">
                      {demographics?.time_patterns?.peak_hour != null 
                        ? `${demographics.time_patterns.peak_hour}:00`
                        : '--'}
                    </p>
                    <p className="text-xs text-green-400 mt-1">Most active time (UTC)</p>
                  </div>
                  <Clock className="w-12 h-12 text-green-400 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-300 text-sm font-medium">Peak Day</p>
                    <p className="text-4xl font-bold text-white">
                      {demographics?.time_patterns?.peak_day || '--'}
                    </p>
                    <p className="text-xs text-blue-400 mt-1">Most active day of week</p>
                  </div>
                  <Calendar className="w-12 h-12 text-blue-400 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hourly Traffic Chart */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-400" />
                Hourly Traffic Pattern (24h)
              </CardTitle>
              <CardDescription>When your viewers are most active</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between h-48 gap-1">
                {demographics?.time_patterns?.hourly_traffic?.map((hour) => {
                  const maxViews = Math.max(...(demographics.time_patterns.hourly_traffic.map(h => h.views) || [1]));
                  const heightPercent = maxViews > 0 ? (hour.views / maxViews) * 100 : 0;
                  const isPeak = hour.hour === demographics.time_patterns.peak_hour;
                  
                  return (
                    <div key={hour.hour} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className={`w-full rounded-t transition-all ${isPeak ? 'bg-green-500' : 'bg-green-600/60'} hover:bg-green-500`}
                        style={{ height: `${heightPercent}%`, minHeight: hour.views > 0 ? '4px' : '2px' }}
                        title={`${hour.hour}:00 - ${hour.views} views`}
                      />
                      {hour.hour % 3 === 0 && (
                        <span className="text-[10px] text-zinc-500">{hour.hour}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-xs text-zinc-500">
                <span>12am</span>
                <span>6am</span>
                <span>12pm</span>
                <span>6pm</span>
                <span>12am</span>
              </div>
            </CardContent>
          </Card>

          {/* Daily Pattern */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Weekly Pattern
              </CardTitle>
              <CardDescription>Traffic by day of the week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between h-32 gap-4">
                {demographics?.time_patterns?.daily_pattern?.map((day) => {
                  const maxViews = Math.max(...(demographics.time_patterns.daily_pattern.map(d => d.views) || [1]));
                  const heightPercent = maxViews > 0 ? (day.views / maxViews) * 100 : 0;
                  const isPeak = day.day === demographics.time_patterns.peak_day;
                  
                  return (
                    <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-sm text-zinc-400">{day.views}</span>
                      <div 
                        className={`w-full rounded-t transition-all ${isPeak ? 'bg-blue-500' : 'bg-blue-600/60'} hover:bg-blue-500`}
                        style={{ height: `${heightPercent}%`, minHeight: day.views > 0 ? '8px' : '4px' }}
                      />
                      <span className={`text-sm ${isPeak ? 'text-blue-400 font-bold' : 'text-zinc-400'}`}>{day.day}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Duration Section */}
      {activeSection === 'duration' && (
        <div className="space-y-6">
          {/* Duration Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border-purple-700/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-300 text-sm font-medium">Avg Session Duration</p>
                    <p className="text-3xl font-bold text-white">
                      {demographics?.session_duration?.average_formatted || '0:00'}
                    </p>
                    <p className="text-xs text-purple-400 mt-1">
                      {demographics?.session_duration?.average_seconds 
                        ? `${Math.round(demographics.session_duration.average_seconds)}s` 
                        : '0 seconds'}
                    </p>
                  </div>
                  <Clock className="w-10 h-10 text-purple-400 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 border-amber-700/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-300 text-sm font-medium">Total Sessions</p>
                    <p className="text-3xl font-bold text-white">
                      {demographics?.session_duration?.total_sessions?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-amber-400 mt-1">In selected period</p>
                  </div>
                  <Users className="w-10 h-10 text-amber-400 opacity-80" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-300 text-sm font-medium">Longest Session</p>
                    <p className="text-3xl font-bold text-white">
                      {demographics?.session_duration?.max_seconds 
                        ? `${Math.round(demographics.session_duration.max_seconds / 60)}m`
                        : '0m'}
                    </p>
                    <p className="text-xs text-green-400 mt-1">Record session length</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-green-400 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Session Duration Distribution */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-purple-400" />
                Session Duration Distribution
              </CardTitle>
              <CardDescription>How long visitors stay on your site/stream</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {demographics?.session_duration?.distribution?.map((bucket) => {
                  const maxSessions = Math.max(...(demographics.session_duration.distribution.map(b => b.sessions) || [1]));
                  const percentage = maxSessions > 0 ? Math.round((bucket.sessions / maxSessions) * 100) : 0;
                  
                  return (
                    <div key={bucket.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white font-medium">{bucket.label}</span>
                        <span className="text-purple-400">{bucket.sessions.toLocaleString()} sessions</span>
                      </div>
                      <Progress value={percentage} className="h-3" />
                    </div>
                  );
                })}
                {(!demographics?.session_duration?.distribution || demographics.session_duration.distribution.every(b => b.sessions === 0)) && (
                  <div className="text-center py-8 text-zinc-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No session duration data yet</p>
                    <p className="text-xs">Sessions will be tracked as viewers browse</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Watch Time by Category */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-red-400" />
                Watch Time by Category
              </CardTitle>
              <CardDescription>Which content keeps viewers engaged longest</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {demographics?.watch_time?.by_category?.length > 0 ? (
                  demographics.watch_time.by_category.map((item, index) => (
                    <div key={item.category} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-500 font-mono text-sm">#{index + 1}</span>
                        <div>
                          <p className="text-white font-medium">{item.category}</p>
                          <p className="text-xs text-zinc-500">{item.views} views</p>
                        </div>
                      </div>
                      <Badge className="bg-red-600/20 text-red-400 border-red-600">
                        {item.watch_time_minutes}m watched
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-zinc-500">
                    <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No watch time data yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// SEO Dashboard Panel
function SEODashboardPanel() {
  const [metrics, setMetrics] = useState(null);
  const [sitemapStatus, setSitemapStatus] = useState(null);
  const [crawlIssues, setCrawlIssues] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSEOData();
  }, []);

  const fetchSEOData = async () => {
    try {
      setLoading(true);
      const [metricsRes, sitemapRes, crawlRes] = await Promise.all([
        axios.get(`${API}/seo/metrics`),
        axios.get(`${API}/seo/sitemap-status`),
        axios.get(`${API}/seo/crawl-issues`)
      ]);
      setMetrics(metricsRes.data);
      setSitemapStatus(sitemapRes.data);
      setCrawlIssues(crawlRes.data);
    } catch (error) {
      console.error("Error fetching SEO data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
      </div>
    );
  }

  const indexedPages = sitemapStatus?.pages?.filter(p => p.priority >= 0.8) || [];
  const pendingPages = sitemapStatus?.pages?.filter(p => p.priority < 0.8) || [];

  return (
    <div className="space-y-6">
      {/* SEO Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">{metrics?.summary?.total_indexed || 0}</div>
              <div className="text-sm text-zinc-400">Indexed Pages</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">{metrics?.summary?.total_not_indexed || 0}</div>
              <div className="text-sm text-zinc-400">Not Indexed</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">{metrics?.summary?.total_impressions || 0}</div>
              <div className="text-sm text-zinc-400">Total Impressions</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-teal-400">{metrics?.summary?.index_rate || "0%"}</div>
              <div className="text-sm text-zinc-400">Index Rate</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Impressions Chart */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Daily Impressions
          </CardTitle>
          <CardDescription>Google Search impressions over the last 9 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-end gap-2">
            {metrics?.metrics?.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t"
                  style={{ height: `${Math.max((day.impressions / 150) * 100, 5)}%` }}
                />
                <span className="text-xs text-zinc-500">{day.date.split('-')[2]}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-center text-xs text-zinc-500">March 2026</div>
        </CardContent>
      </Card>

      {/* Sitemap Pages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High Priority (Indexed) */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              High Priority Pages ({indexedPages.length})
            </CardTitle>
            <CardDescription>Pages with priority ≥ 0.8 in sitemap</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {indexedPages.map((page, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-zinc-800 rounded">
                  <span className="text-sm text-zinc-300 truncate flex-1">{page.url}</span>
                  <Badge className="bg-green-600 ml-2">{page.priority}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lower Priority (Pending) */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              Lower Priority Pages ({pendingPages.length})
            </CardTitle>
            <CardDescription>Pages with priority &lt; 0.8 - may take longer to index</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pendingPages.map((page, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-zinc-800 rounded">
                  <span className="text-sm text-zinc-300 truncate flex-1">{page.url}</span>
                  <Badge className="bg-yellow-600 ml-2">{page.priority}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Crawl Issues from Google Search Console */}
      {crawlIssues && crawlIssues.issues && crawlIssues.issues.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Crawl Issues ({crawlIssues.total_issues})
            </CardTitle>
            <CardDescription>URLs from Google Search Console with pending or failed status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {crawlIssues.issues.map((issue, i) => (
                <div key={i} className="p-3 bg-zinc-800 rounded border-l-4 border-l-orange-500">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <code className="text-xs text-zinc-400 break-all">{issue.url}</code>
                      <p className="text-sm text-zinc-300 mt-1">{issue.issue}</p>
                      <p className="text-xs text-green-400 mt-1">{issue.action}</p>
                    </div>
                    <Badge className={issue.status === "Failed" ? "bg-red-600" : "bg-yellow-600"}>
                      {issue.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {crawlIssues.recommendations && (
              <div className="mt-4 p-3 bg-zinc-800/50 rounded">
                <p className="text-sm font-semibold text-teal-400 mb-2">Recommendations:</p>
                <ul className="text-xs text-zinc-400 space-y-1">
                  {crawlIssues.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SEO Tips */}
      <Card className="bg-gradient-to-r from-teal-900/50 to-cyan-900/50 border-teal-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            SEO Tips to Improve Indexing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="font-semibold text-teal-400">Why pages aren't indexed:</p>
              <ul className="list-disc pl-4 text-zinc-300 space-y-1">
                <li>New pages take 1-4 weeks to index</li>
                <li>Low internal links to the page</li>
                <li>Duplicate or thin content</li>
                <li>Pages behind login (auth required)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-teal-400">How to fix:</p>
              <ul className="list-disc pl-4 text-zinc-300 space-y-1">
                <li>Submit sitemap to Google Search Console</li>
                <li>Use URL Inspection → Request Indexing</li>
                <li>Add internal links from homepage</li>
                <li>Share pages on social media</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" className="border-teal-600 text-teal-400 hover:bg-teal-600/20">
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Google Search Console
          </a>
        </Button>
        <Button asChild variant="outline" className="border-blue-600 text-blue-400 hover:bg-blue-600/20">
          <a href="https://www.ztvlivestream.com/sitemap.xml" target="_blank" rel="noopener noreferrer">
            <FileText className="w-4 h-4 mr-2" />
            View Sitemap
          </a>
        </Button>
        <Button asChild variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20">
          <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Bing Webmaster
          </a>
        </Button>
        <Button onClick={fetchSEOData} variant="outline" className="border-zinc-600">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>
    </div>
  );
}

// Main Admin Dashboard
export default function AdminDashboardV2() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Data states
  const [analytics, setAnalytics] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [adSettings, setAdSettings] = useState(null);
  const [subscriptionTiers, setSubscriptionTiers] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [contentStats, setContentStats] = useState(null);
  const [creators, setCreators] = useState([]);
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // YouTube Import State
  const [ytImportUrl, setYtImportUrl] = useState("");
  const [ytImportCreatorId, setYtImportCreatorId] = useState("");
  const [ytImportCreatorName, setYtImportCreatorName] = useState("");
  const [ytImporting, setYtImporting] = useState(false);
  const [ytImportResult, setYtImportResult] = useState(null);
  
  // RTMP Roku Stream State
  const [rtmpStatus, setRtmpStatus] = useState({ status: 'unknown' });
  const [rtmpLoading, setRtmpLoading] = useState(false);
  
  // Lightning Round State
  const [lightningRound, setLightningRound] = useState(false);
  const [lightningLoading, setLightningLoading] = useState(false);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // Check for existing session
  useEffect(() => {
    const storedToken = localStorage.getItem("admin_token");
    const storedUser = localStorage.getItem("admin_user");
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setAdminUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // Fetch dashboard data
  const fetchData = useCallback(async (showRefreshAnimation = false) => {
    if (!token) return;
    
    if (showRefreshAnimation) {
      setIsRefreshing(true);
    }
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [analyticsRes, realtimeRes, revenueRes, adRes, tiersRes, payoutsRes, contentRes] = await Promise.all([
        axios.get(`${API}/analytics/summary?days=7`).catch(() => ({ data: null })),
        axios.get(`${API}/analytics/realtime`).catch(() => ({ data: null })),
        axios.get(`${API}/revenue/summary?days=30`).catch(() => ({ data: null })),
        axios.get(`${API}/revenue/ads/settings`).catch(() => ({ data: null })),
        axios.get(`${API}/revenue/subscriptions/tiers`).catch(() => ({ data: { tiers: [] } })),
        axios.get(`${API}/revenue/payouts?limit=20`).catch(() => ({ data: { payouts: [] } })),
        axios.get(`${API}/tv/library`).catch(() => ({ data: null })),
      ]);
      
      setAnalytics(analyticsRes.data);
      setRealtime(realtimeRes.data);
      setRevenue(revenueRes.data);
      setAdSettings(adRes.data);
      setSubscriptionTiers(tiersRes.data?.tiers || []);
      setPayouts(payoutsRes.data?.payouts || []);
      setContentStats(contentRes.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      if (showRefreshAnimation) {
        // Keep animation for at least 1 second for visual feedback
        setTimeout(() => setIsRefreshing(false), 1000);
      }
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchData]);

  const handleLogin = (user, accessToken) => {
    setAdminUser(user);
    setToken(accessToken);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setIsAuthenticated(false);
    setAdminUser(null);
    setToken(null);
    toast.success("Logged out successfully");
  };

  // RTMP Roku Stream Functions
  const fetchRtmpStatus = async () => {
    try {
      const res = await axios.get(`${API}/rtmp/status`);
      setRtmpStatus(res.data);
    } catch (error) {
      setRtmpStatus({ status: 'error', message: 'Failed to fetch status' });
    }
  };

  const startRtmpStream = async () => {
    setRtmpLoading(true);
    try {
      const res = await axios.post(`${API}/rtmp/start`);
      if (res.data.status === 'error') {
        // Production environment limitation
        toast.error('Stream requires manual setup in production. Use OBS or preview environment.');
        setRtmpStatus({ status: 'stopped', note: 'Production requires external streaming software (OBS)' });
      } else {
        toast.success('RTMP stream starting! Check Castr.io in ~30 seconds.');
        setRtmpStatus({ status: 'starting', ...res.data });
        // Poll status more frequently during startup
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await axios.get(`${API}/rtmp/status`);
            setRtmpStatus(statusRes.data);
            if (statusRes.data.status === 'running') {
              clearInterval(pollInterval);
              toast.success('Stream is now LIVE!');
            } else if (statusRes.data.status === 'stopped' || statusRes.data.status === 'error') {
              clearInterval(pollInterval);
            }
          } catch (e) {}
        }, 5000);
        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(pollInterval), 120000);
      }
    } catch (error) {
      toast.error('Stream control unavailable. Use OBS to stream directly to Castr.');
    } finally {
      setRtmpLoading(false);
    }
  };

  const stopRtmpStream = async () => {
    setRtmpLoading(true);
    try {
      await axios.post(`${API}/rtmp/stop`);
      toast.success('RTMP stream stopped');
      setRtmpStatus({ status: 'stopped' });
    } catch (error) {
      toast.error('Failed to stop RTMP stream');
    } finally {
      setRtmpLoading(false);
    }
  };

  // Lightning Round Functions
  const fetchLightningStatus = async () => {
    try {
      const res = await axios.get(`${API}/live-survey/admin/lightning-round/status`);
      setLightningRound(res.data.active);
    } catch (error) {
      console.log('Lightning status fetch failed');
    }
  };

  const toggleLightningRound = async () => {
    setLightningLoading(true);
    try {
      if (lightningRound) {
        await axios.post(`${API}/live-survey/admin/lightning-round/stop`);
        toast.success('⚡ Lightning Round ended!');
        setLightningRound(false);
      } else {
        await axios.post(`${API}/live-survey/admin/lightning-round/start`);
        toast.success('⚡ LIGHTNING ROUND STARTED! 2X POINTS!');
        setLightningRound(true);
      }
    } catch (error) {
      toast.error('Failed to toggle Lightning Round');
    } finally {
      setLightningLoading(false);
    }
  };

  const triggerCelebration = async () => {
    try {
      await axios.post(`${API}/live-survey/admin/celebration?event_type=confetti&message=🎉 WINNER! 🎉`);
      toast.success('🎉 Celebration triggered!');
    } catch (error) {
      toast.error('Failed to trigger celebration');
    }
  };

  // Set admin-specific manifest for PWA
  useEffect(() => {
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.href = '/admin-manifest.json';
    } else {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/admin-manifest.json';
      document.head.appendChild(manifestLink);
    }
    return () => {
      if (manifestLink) manifestLink.href = '/manifest.json';
    };
  }, []);

  // PWA Install listener
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('ZTV ADMIN app installed!');
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  // Fetch RTMP status on mount
  useEffect(() => {
    fetchRtmpStatus();
    fetchLightningStatus();
    const interval = setInterval(() => {
      fetchRtmpStatus();
      fetchLightningStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateAdSetting = async (setting, value) => {
    try {
      await axios.put(`${API}/revenue/ads/settings`, null, {
        params: { [setting]: value, admin_id: adminUser?.id }
      });
      setAdSettings({ ...adSettings, [setting]: value });
      toast.success("Ad setting updated");
    } catch (error) {
      toast.error("Failed to update setting");
    }
  };

  // Fetch creators for outreach
  const fetchCreators = async () => {
    setLoadingCreators(true);
    try {
      // Try the admin creators endpoint first, then fall back to uploads endpoint
      let response;
      try {
        response = await axios.get(`${API}/admin/creators`);
      } catch {
        response = await axios.get(`${API}/uploads/admin/creators`);
      }
      setCreators(response.data.creators || response.data.users || []);
    } catch (error) {
      console.log("Could not fetch creators:", error);
    } finally {
      setLoadingCreators(false);
    }
  };

  // Delete creator and their content
  const handleDeleteCreator = async (creatorId, creatorName) => {
    if (!confirm(`Are you sure you want to delete "${creatorName}" and all their content? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem("access_token");
      await axios.delete(`${API}/uploads/admin/creator/${creatorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Remove from local state
      setCreators(prev => prev.filter(c => c.creator_id !== creatorId));
      toast.success(`Creator "${creatorName}" deleted successfully`);
    } catch (error) {
      console.error("Delete creator error:", error);
      toast.error("Failed to delete creator. Please try again.");
    }
  };

  // Load creators when tab is selected
  useEffect(() => {
    if (activeTab === "creators" && creators.length === 0 && !loadingCreators) {
      fetchCreators();
    }
  }, [activeTab]);

  // YouTube Channel Import Handler
  const handleYoutubeImport = async () => {
    if (!ytImportUrl.trim()) {
      toast.error("Please enter a YouTube channel URL");
      return;
    }
    if (!ytImportCreatorId.trim() || !ytImportCreatorName.trim()) {
      toast.error("Please enter creator ID and name");
      return;
    }
    
    setYtImporting(true);
    setYtImportResult(null);
    
    try {
      const token = localStorage.getItem("access_token");
      const response = await axios.post(
        `${API}/youtube-import/quick-import`,
        {
          channel_url: ytImportUrl.trim(),
          creator_id: ytImportCreatorId.trim(),
          creator_name: ytImportCreatorName.trim()
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setYtImportResult(response.data);
      toast.success(`Successfully imported ${response.data.import_results?.imported || 0} videos!`);
      
      // Refresh creators list
      fetchCreators();
    } catch (error) {
      console.error("YouTube import error:", error);
      toast.error(error.response?.data?.detail || "Failed to import YouTube channel");
      setYtImportResult({ error: error.response?.data?.detail || "Import failed" });
    } finally {
      setYtImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  const getRoleBadge = (role) => {
    const colors = {
      super_admin: "bg-red-600",
      manager: "bg-violet-600",
      viewer: "bg-zinc-600"
    };
    return <Badge className={colors[role] || "bg-zinc-600"}>{role?.replace("_", " ").toUpperCase()}</Badge>;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
              <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center">
                <Tv className="w-6 h-6" />
              </div>
              <span className="font-heading text-2xl tracking-wider">ZTVLIVE</span>
              <Badge className="bg-violet-600 ml-2">ADMIN</Badge>
            </Link>
            
            <div className="flex items-center gap-4">
              {/* Admin Notifications */}
              <AdminNotificationPanel adminId={adminUser?.id} />
              
              <div className="hidden md:flex items-center gap-2">
                <Link to="/creator/dashboard">
                  <Button variant="outline" size="sm" className="border-red-600 text-red-400 hover:bg-red-900/30">
                    <Video className="w-4 h-4 mr-1" />
                    Creator
                  </Button>
                </Link>
                <span className="text-sm text-zinc-400">{adminUser?.name}</span>
                {getRoleBadge(adminUser?.role)}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout}
                className="text-zinc-400 hover:text-white"
                data-testid="admin-logout-btn"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-heading text-4xl tracking-tight uppercase flex items-center gap-3">
                  <Shield className="w-10 h-10 text-violet-400" />
                  ADMIN DASHBOARD
                </h1>
                <p className="text-zinc-400 mt-2">Control traffic, revenue, and content management</p>
              </div>
              <Button 
                onClick={() => fetchData(true)} 
                variant="outline" 
                className="border-zinc-700"
                disabled={isRefreshing}
                data-testid="admin-refresh-btn"
              >
                <RefreshCw className={`w-4 h-4 mr-2 transition-transform duration-1000 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </motion.div>

          {/* Real-time Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
            <Card className="bg-gradient-to-br from-green-900/30 to-green-900/10 border-green-800/50">
              <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                <CardDescription className="text-green-400 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <Activity className="w-3 h-3 md:w-4 md:h-4" />
                  LIVE VIEWERS
                </CardDescription>
                <CardTitle className="text-2xl md:text-4xl font-heading text-green-400">
                  {realtime?.concurrent_viewers || 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <p className="text-xs text-zinc-500">Currently watching</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 border-blue-800/50">
              <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                <CardDescription className="text-blue-400 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <Eye className="w-3 h-3 md:w-4 md:h-4" />
                  VIEWS (7 DAYS)
                </CardDescription>
                <CardTitle className="text-2xl md:text-4xl font-heading text-blue-400">
                  {analytics?.total_page_views?.toLocaleString() || 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <p className="text-xs text-zinc-500">{analytics?.unique_visitors || 0} unique visitors</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-900/30 to-amber-900/10 border-amber-800/50">
              <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                <CardDescription className="text-amber-400 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <DollarSign className="w-3 h-3 md:w-4 md:h-4" />
                  REVENUE (30 DAYS)
                </CardDescription>
                <CardTitle className="text-2xl md:text-4xl font-heading text-amber-400">
                  ${revenue?.total_revenue?.toFixed(2) || "0.00"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <p className="text-xs text-zinc-500">${revenue?.pending_payouts?.toFixed(2) || "0.00"} pending payouts</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-violet-900/30 to-violet-900/10 border-violet-800/50">
              <CardHeader className="pb-1 md:pb-2 p-3 md:p-6">
                <CardDescription className="text-violet-400 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
                  <Video className="w-3 h-3 md:w-4 md:h-4" />
                  CONTENT LIBRARY
                </CardDescription>
                <CardTitle className="text-2xl md:text-4xl font-heading text-violet-400">
                  {contentStats?.total_content || 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                <p className="text-xs text-zinc-500">{contentStats?.total_duration_hours?.toFixed(1) || 0}hrs total</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
              <TabsList className="bg-zinc-900 border border-zinc-800 p-1 inline-flex min-w-max md:flex-wrap md:min-w-0 gap-1">
                <TabsTrigger value="overview" className="data-[state=active]:bg-violet-600 whitespace-nowrap text-xs md:text-sm">
                  <BarChart2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="submissions" className="data-[state=active]:bg-orange-600 whitespace-nowrap text-xs md:text-sm">
                  <Video className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Submissions
                </TabsTrigger>
                <TabsTrigger value="mix-program" className="data-[state=active]:bg-green-600 whitespace-nowrap text-xs md:text-sm">
                  <Monitor className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Live Mix
                </TabsTrigger>
                <TabsTrigger value="schedule" className="data-[state=active]:bg-red-600 whitespace-nowrap text-xs md:text-sm">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Schedule
                </TabsTrigger>
                <TabsTrigger value="traffic" className="data-[state=active]:bg-green-600 whitespace-nowrap text-xs md:text-sm">
                  <Activity className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Traffic
                </TabsTrigger>
                <TabsTrigger value="visitor-analytics" className="data-[state=active]:bg-blue-600 whitespace-nowrap text-xs md:text-sm">
                  <BarChart2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Stats
                </TabsTrigger>
                <TabsTrigger value="ads" className="data-[state=active]:bg-amber-600 whitespace-nowrap text-xs md:text-sm">
                  <Target className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Ads
                </TabsTrigger>
                <TabsTrigger value="subscriptions" className="data-[state=active]:bg-blue-600 whitespace-nowrap text-xs md:text-sm">
                  <CreditCard className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Subs
                </TabsTrigger>
                <TabsTrigger value="payouts" className="data-[state=active]:bg-red-600 whitespace-nowrap text-xs md:text-sm">
                  <Wallet className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Payouts
                </TabsTrigger>
                <TabsTrigger value="creators" className="data-[state=active]:bg-purple-600 whitespace-nowrap text-xs md:text-sm">
                  <Users className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Creators
                </TabsTrigger>
                <TabsTrigger value="sponsor-analytics" className="data-[state=active]:bg-yellow-600 whitespace-nowrap text-xs md:text-sm">
                  <Target className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Sponsors
                </TabsTrigger>
                <TabsTrigger value="game-analytics" className="data-[state=active]:bg-emerald-600 whitespace-nowrap text-xs md:text-sm">
                  <Trophy className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Game
                </TabsTrigger>
                <TabsTrigger value="platform-stats" className="data-[state=active]:bg-indigo-600 whitespace-nowrap text-xs md:text-sm">
                  <Globe className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Platform
                </TabsTrigger>
                <TabsTrigger value="social-qr" className="data-[state=active]:bg-pink-600 whitespace-nowrap text-xs md:text-sm">
                  <QrCode className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  QR
                </TabsTrigger>
                <TabsTrigger value="stream-health" className="data-[state=active]:bg-cyan-600 whitespace-nowrap text-xs md:text-sm">
                  <Activity className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Stream
                </TabsTrigger>
                <TabsTrigger value="schedule-health" className="data-[state=active]:bg-emerald-600 whitespace-nowrap text-xs md:text-sm">
                  <RefreshCw className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Schedule
                </TabsTrigger>
                <TabsTrigger value="penny" className="data-[state=active]:bg-pink-600 whitespace-nowrap text-xs md:text-sm">
                  <Send className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Penny
                </TabsTrigger>
                <TabsTrigger value="security" className="data-[state=active]:bg-red-600 whitespace-nowrap text-xs md:text-sm">
                  <Shield className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Security
                </TabsTrigger>
                <TabsTrigger value="seo" className="data-[state=active]:bg-teal-600 whitespace-nowrap text-xs md:text-sm">
                  <Search className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  SEO
                </TabsTrigger>
                <TabsTrigger value="tutorial-funnel" className="data-[state=active]:bg-fuchsia-600 whitespace-nowrap text-xs md:text-sm">
                  <Sparkles className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Tutorial
                </TabsTrigger>
                <TabsTrigger value="live-activity" className="data-[state=active]:bg-cyan-600 whitespace-nowrap text-xs md:text-sm">
                  <Bell className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  Live Feed
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Submissions Tab - NEW */}
            <TabsContent value="submissions" className="space-y-6">
              <SubmissionsPanel token={token} />
            </TabsContent>

            {/* Live Mix Program Tab */}
            <TabsContent value="mix-program" className="space-y-6">
              <LiveMixProgramPanel token={token} />
              <div className="border-t border-zinc-800 pt-6">
                <ContentShuffleManager />
              </div>
            </TabsContent>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Launch Checklist - April 3rd Dashboard */}
              <LaunchChecklist />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Views by Page */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-blue-400" />
                      Views by Page
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics?.views_by_page && Object.entries(analytics.views_by_page).map(([page, count]) => (
                        <div key={page} className="flex items-center justify-between">
                          <span className="text-sm text-zinc-400 capitalize">{page || "Homepage"}</span>
                          <div className="flex items-center gap-2">
                            <Progress value={(count / analytics.total_page_views) * 100} className="w-32 h-2" />
                            <span className="text-sm font-mono text-white">{count}</span>
                          </div>
                        </div>
                      ))}
                      {(!analytics?.views_by_page || Object.keys(analytics.views_by_page).length === 0) && (
                        <p className="text-zinc-500 text-center py-4">No data yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Content */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      Top Content
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[250px]">
                      <div className="space-y-3">
                        {analytics?.top_content?.slice(0, 10).map((content, index) => (
                          <div key={content.content_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50">
                            <span className="text-lg font-bold text-zinc-600 w-6">{index + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{content.title}</p>
                              <p className="text-xs text-zinc-500">{content.views} views • {content.total_watch_time_minutes}m watched</p>
                            </div>
                            <Badge className="bg-zinc-700">{content.category}</Badge>
                          </div>
                        ))}
                        {(!analytics?.top_content || analytics.top_content.length === 0) && (
                          <p className="text-zinc-500 text-center py-4">No content views yet</p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Revenue Breakdown */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-amber-400" />
                      Revenue Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-amber-400" />
                          <span className="text-sm">Ad Revenue</span>
                        </div>
                        <span className="font-mono text-amber-400">${revenue?.ad_revenue?.toFixed(2) || "0.00"}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-400" />
                          <span className="text-sm">Subscriptions</span>
                        </div>
                        <span className="font-mono text-blue-400">${revenue?.subscription_revenue?.toFixed(2) || "0.00"}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-green-400" />
                          <span className="text-sm">Tips</span>
                        </div>
                        <span className="font-mono text-green-400">${revenue?.tips_revenue?.toFixed(2) || "0.00"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-violet-400" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="border-zinc-700 h-auto py-4 flex-col" asChild>
                        <Link to="/watch">
                          <PlayCircle className="w-6 h-6 mb-2 text-red-400" />
                          <span>Watch Live</span>
                        </Link>
                      </Button>
                      <Button variant="outline" className="border-zinc-700 h-auto py-4 flex-col" asChild>
                        <Link to="/library">
                          <Video className="w-6 h-6 mb-2 text-blue-400" />
                          <span>Library</span>
                        </Link>
                      </Button>
                      <Button variant="outline" className="border-zinc-700 h-auto py-4 flex-col" asChild>
                        <Link to="/schedule">
                          <Clock className="w-6 h-6 mb-2 text-amber-400" />
                          <span>Schedule</span>
                        </Link>
                      </Button>
                      <Button variant="outline" className="border-zinc-700 h-auto py-4 flex-col" asChild>
                        <Link to="/stream-submit">
                          <Radio className="w-6 h-6 mb-2 text-green-400" />
                          <span>Go Live</span>
                        </Link>
                      </Button>
                      <Button variant="outline" className="border-zinc-700 h-auto py-4 flex-col col-span-2 bg-gradient-to-r from-red-900/20 to-orange-900/20 border-red-700/50" asChild>
                        <Link to="/admin/creator-import">
                          <Users className="w-6 h-6 mb-2 text-red-400" />
                          <span>Import Creator Channels</span>
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* RTMP Roku Stream Control */}
                <Card className="bg-gradient-to-br from-purple-900/30 to-zinc-900 border-purple-800/50" data-testid="rtmp-control-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-400">
                      <Tv className="w-5 h-5" />
                      ROKU RTMP STREAM
                    </CardTitle>
                    <CardDescription>Control the 24/7 Roku TV broadcast</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-4 h-4 rounded-full ${
                        rtmpStatus.status === 'running' || rtmpStatus.status === 'started' 
                          ? 'bg-green-500 animate-pulse' 
                          : rtmpStatus.status === 'starting'
                            ? 'bg-yellow-500 animate-pulse'
                            : 'bg-zinc-600'
                      }`} />
                      <span className="font-bold text-lg">
                        {rtmpStatus.status === 'running' || rtmpStatus.status === 'started' 
                          ? 'STREAMING' 
                          : rtmpStatus.status === 'starting'
                            ? 'STARTING...'
                            : 'OFFLINE'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={startRtmpStream}
                        disabled={rtmpLoading || rtmpStatus.status === 'running' || rtmpStatus.status === 'started' || rtmpStatus.status === 'starting'}
                        className="bg-green-600 hover:bg-green-500"
                        data-testid="start-rtmp-btn"
                      >
                        {rtmpLoading || rtmpStatus.status === 'starting' ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        {rtmpStatus.status === 'starting' ? 'STARTING...' : 'START'}
                      </Button>
                      <Button 
                        onClick={stopRtmpStream}
                        disabled={rtmpLoading || rtmpStatus.status === 'stopped' || rtmpStatus.status === 'unknown'}
                        variant="destructive"
                        data-testid="stop-rtmp-btn"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        STOP
                      </Button>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <Button 
                        onClick={fetchRtmpStatus}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-zinc-700"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Refresh
                      </Button>
                      <Button 
                        variant="outline"
                        size="sm"
                        className="flex-1 border-zinc-700"
                        asChild
                      >
                        <a href="/roku-tv" target="_blank" rel="noopener noreferrer">
                          <Eye className="w-3 h-3 mr-1" />
                          Preview
                        </a>
                      </Button>
                    </div>

                    {/* Game Controls */}
                    <div className="border-t border-zinc-700 pt-3 mt-3">
                      <p className="text-sm text-zinc-400 mb-2 font-semibold">⚡ Game Controls</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          onClick={toggleLightningRound}
                          disabled={lightningLoading}
                          className={lightningRound ? "bg-yellow-500 hover:bg-yellow-400 text-black" : "bg-zinc-700 hover:bg-zinc-600"}
                          data-testid="lightning-round-btn"
                        >
                          {lightningLoading ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <span className="mr-1">⚡</span>
                          )}
                          {lightningRound ? "END" : "LIGHTNING"}
                        </Button>
                        <Button 
                          onClick={triggerCelebration}
                          className="bg-pink-600 hover:bg-pink-500"
                          data-testid="celebration-btn"
                        >
                          <span className="mr-1">🎉</span>
                          CELEBRATE
                        </Button>
                      </div>
                    </div>

                    {/* Smart TV App Downloads */}
                    <div className="border-t border-zinc-700 pt-3 mt-3">
                      <p className="text-sm text-zinc-400 mb-2 font-semibold">📺 Smart TV App Packages</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-500"
                          data-testid="download-roku-btn"
                          onClick={() => window.open(`${API}/roku/download-package`, '_blank')}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Roku v2
                        </Button>
                        <Button 
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-500"
                          data-testid="download-firetv-btn"
                          onClick={() => window.open(`${API}/firetv/download-package`, '_blank')}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Fire TV
                        </Button>
                        <Button 
                          size="sm"
                          className="bg-red-600 hover:bg-red-500"
                          data-testid="download-lg-btn"
                          onClick={() => window.open(`${API}/lg-webos/download-ipk`, '_blank')}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          LG webOS (.ipk)
                        </Button>
                        <Button 
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-500"
                          data-testid="download-samsung-btn"
                          onClick={() => window.open(`${API}/samsung-tizen/download-package`, '_blank')}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Samsung
                        </Button>
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">Click to download packages for upload to app stores</p>
                    </div>

                    {/* Install ZTV ADMIN App */}
                    {showInstallBtn && (
                      <Button 
                        onClick={installApp}
                        className="w-full mt-2 bg-violet-600 hover:bg-violet-500"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Install ZTV ADMIN App
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Schedule Queue Tab */}
            <TabsContent value="schedule" className="space-y-6">
              <ScheduleQueuePanel token={token} />
            </TabsContent>

            {/* Traffic Tab */}
            <TabsContent value="traffic" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-zinc-900 border-zinc-800 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-green-400" />
                      Real-time Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center border border-dashed border-zinc-700 rounded-lg">
                      <div className="text-center">
                        <Activity className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
                        <p className="text-zinc-500">Live activity graph</p>
                        <p className="text-xs text-zinc-600">Coming soon</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-blue-400" />
                      Active Sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <div className="text-6xl font-heading text-green-400 mb-2">
                        {realtime?.concurrent_viewers || 0}
                      </div>
                      <p className="text-zinc-500">concurrent viewers</p>
                    </div>
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Last 5 min</span>
                        <span className="text-white">{realtime?.views_last_5min || 0} views</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Last hour</span>
                        <span className="text-white">{realtime?.views_last_hour || 0} views</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Visitor Analytics Tab */}
            <TabsContent value="visitor-analytics" className="space-y-6">
              <VisitorAnalyticsPanel token={token} />
            </TabsContent>

            {/* Ad Settings Tab */}
            <TabsContent value="ads" className="space-y-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-400" />
                    Ad Placement Settings
                  </CardTitle>
                  <CardDescription>Control how and where ads appear on your platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pre-roll */}
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-heading">Pre-roll Ads</h4>
                          <p className="text-sm text-zinc-500">Ads before video plays</p>
                        </div>
                        <Switch
                          checked={adSettings?.pre_roll_enabled || false}
                          onCheckedChange={(val) => updateAdSetting("pre_roll_enabled", val)}
                          data-testid="preroll-toggle"
                        />
                      </div>
                      {adSettings?.pre_roll_enabled && (
                        <div className="mt-3">
                          <Label className="text-xs text-zinc-500">Frequency (every N videos)</Label>
                          <Select
                            value={String(adSettings?.pre_roll_frequency || 1)}
                            onValueChange={(val) => updateAdSetting("pre_roll_frequency", parseInt(val))}
                          >
                            <SelectTrigger className="bg-zinc-700 border-zinc-600 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Every video</SelectItem>
                              <SelectItem value="2">Every 2 videos</SelectItem>
                              <SelectItem value="3">Every 3 videos</SelectItem>
                              <SelectItem value="5">Every 5 videos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Mid-roll */}
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-heading">Mid-roll Ads</h4>
                          <p className="text-sm text-zinc-500">Ads during video playback</p>
                        </div>
                        <Switch
                          checked={adSettings?.mid_roll_enabled || false}
                          onCheckedChange={(val) => updateAdSetting("mid_roll_enabled", val)}
                          data-testid="midroll-toggle"
                        />
                      </div>
                      {adSettings?.mid_roll_enabled && (
                        <div className="mt-3">
                          <Label className="text-xs text-zinc-500">Interval (seconds)</Label>
                          <Select
                            value={String(adSettings?.mid_roll_interval_seconds || 300)}
                            onValueChange={(val) => updateAdSetting("mid_roll_interval_seconds", parseInt(val))}
                          >
                            <SelectTrigger className="bg-zinc-700 border-zinc-600 mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="180">Every 3 minutes</SelectItem>
                              <SelectItem value="300">Every 5 minutes</SelectItem>
                              <SelectItem value="600">Every 10 minutes</SelectItem>
                              <SelectItem value="900">Every 15 minutes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {/* Banner Ads */}
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-heading">Banner Ads</h4>
                          <p className="text-sm text-zinc-500">Display ads on page</p>
                        </div>
                        <Switch
                          checked={adSettings?.banner_enabled || false}
                          onCheckedChange={(val) => updateAdSetting("banner_enabled", val)}
                          data-testid="banner-toggle"
                        />
                      </div>
                    </div>

                    {/* Overlay Ads */}
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-heading">Overlay Ads</h4>
                          <p className="text-sm text-zinc-500">Ads overlaid on video</p>
                        </div>
                        <Switch
                          checked={adSettings?.overlay_enabled || false}
                          onCheckedChange={(val) => updateAdSetting("overlay_enabled", val)}
                          data-testid="overlay-toggle"
                        />
                      </div>
                    </div>

                    {/* Ad-free for subscribers */}
                    <div className="p-4 bg-zinc-800/50 rounded-lg md:col-span-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-heading">Ad-free for Subscribers</h4>
                          <p className="text-sm text-zinc-500">Paying subscribers see no ads</p>
                        </div>
                        <Switch
                          checked={adSettings?.ad_free_for_subscribers || false}
                          onCheckedChange={(val) => updateAdSetting("ad_free_for_subscribers", val)}
                          data-testid="adfree-toggle"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions" className="space-y-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-400" />
                    Subscription Tiers
                  </CardTitle>
                  <CardDescription>Manage subscription plans and pricing</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {subscriptionTiers.map((tier) => (
                      <Card key={tier.id} className="bg-zinc-800/50 border-zinc-700">
                        <CardHeader>
                          <CardTitle className="text-lg">{tier.name}</CardTitle>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-blue-400">${tier.price_monthly}</span>
                            <span className="text-zinc-500">/mo</span>
                          </div>
                          <p className="text-sm text-zinc-500">${tier.price_yearly}/year</p>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {tier.features.map((feature, i) => (
                              <li key={i} className="flex items-center gap-2 text-sm">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                <span className="text-zinc-300">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                        <CardFooter>
                          <Badge className={tier.is_active ? "bg-green-600" : "bg-zinc-600"}>
                            {tier.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payouts Tab */}
            <TabsContent value="payouts" className="space-y-6">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-red-400" />
                    Creator Payouts
                  </CardTitle>
                  <CardDescription>Track and manage creator earnings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-amber-900/20 rounded-lg border border-amber-800/50 text-center">
                      <p className="text-sm text-amber-400">Pending</p>
                      <p className="text-2xl font-heading text-amber-400">${revenue?.pending_payouts?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className="p-4 bg-green-900/20 rounded-lg border border-green-800/50 text-center">
                      <p className="text-sm text-green-400">Completed (30d)</p>
                      <p className="text-2xl font-heading text-green-400">${revenue?.completed_payouts?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-800/50 text-center">
                      <p className="text-sm text-blue-400">Top Creators</p>
                      <p className="text-2xl font-heading text-blue-400">{revenue?.top_earning_creators?.length || 0}</p>
                    </div>
                  </div>

                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {payouts.length > 0 ? payouts.map((payout) => (
                        <div key={payout.id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                          <div>
                            <p className="font-heading">{payout.creator_name}</p>
                            <p className="text-sm text-zinc-500">{payout.creator_email}</p>
                            <p className="text-xs text-zinc-600">{payout.views_count} views • ${payout.tips_amount} tips</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-mono text-green-400">${payout.amount.toFixed(2)}</p>
                            <Badge className={
                              payout.status === "completed" ? "bg-green-600" :
                              payout.status === "processing" ? "bg-amber-600" :
                              payout.status === "failed" ? "bg-red-600" : "bg-zinc-600"
                            }>
                              {payout.status}
                            </Badge>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center py-12">
                          <Wallet className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
                          <p className="text-zinc-500">No payouts recorded yet</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Creators Tab */}
            <TabsContent value="creators" className="space-y-6">
              {/* YouTube Channel Import Card */}
              <Card className="bg-gradient-to-br from-red-900/20 to-zinc-900 border-red-800/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Youtube className="w-5 h-5 text-red-500" />
                    Import YouTube Channel
                  </CardTitle>
                  <CardDescription>
                    Bulk import all videos from any YouTube channel instantly
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-400">YouTube Channel URL</label>
                      <Input
                        placeholder="https://youtube.com/@ChannelName"
                        value={ytImportUrl}
                        onChange={(e) => setYtImportUrl(e.target.value)}
                        className="bg-zinc-800 border-zinc-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-400">Creator ID</label>
                      <Input
                        placeholder="user_xxxxx or select from list"
                        value={ytImportCreatorId}
                        onChange={(e) => setYtImportCreatorId(e.target.value)}
                        className="bg-zinc-800 border-zinc-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-zinc-400">Creator Name</label>
                      <Input
                        placeholder="Channel/Creator name"
                        value={ytImportCreatorName}
                        onChange={(e) => setYtImportCreatorName(e.target.value)}
                        className="bg-zinc-800 border-zinc-700"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Button 
                      onClick={handleYoutubeImport}
                      disabled={ytImporting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {ytImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Import All Videos
                        </>
                      )}
                    </Button>
                    
                    {ytImportResult && !ytImportResult.error && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-emerald-400">
                          ✅ Imported: {ytImportResult.import_results?.imported || 0}
                        </span>
                        <span className="text-zinc-400">
                          From: {ytImportResult.channel?.title}
                        </span>
                        <span className="text-blue-400">
                          ({ytImportResult.channel?.video_count} total on channel)
                        </span>
                      </div>
                    )}
                    
                    {ytImportResult?.error && (
                      <span className="text-red-400 text-sm">
                        ❌ {ytImportResult.error}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-zinc-500">
                    Tip: Copy Creator ID from the table below, or use "user_9c8d972958d4" for Admin account
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-500" />
                      Creator Management & Outreach
                    </span>
                    <Button onClick={fetchCreators} variant="outline" size="sm" className="border-zinc-700">
                      <RefreshCw className={`w-4 h-4 mr-2 ${loadingCreators ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    View all creator data for marketing outreach, engagement campaigns, and platform growth
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingCreators ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                    </div>
                  ) : creators.length > 0 ? (
                    <div className="space-y-4">
                      {/* Stats Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                          <p className="text-zinc-400 text-sm">Total Users</p>
                          <p className="text-2xl font-bold text-white">{creators.length}</p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                          <p className="text-zinc-400 text-sm">Total Videos</p>
                          <p className="text-2xl font-bold text-purple-400">
                            {creators.reduce((sum, c) => sum + (c.videos || c.video_count || 0), 0)}
                          </p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                          <p className="text-zinc-400 text-sm">Imported Videos</p>
                          <p className="text-2xl font-bold text-pink-400">
                            {creators.reduce((sum, c) => sum + (c.imports || c.imported_count || 0), 0)}
                          </p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                          <p className="text-zinc-400 text-sm">With Email</p>
                          <p className="text-2xl font-bold text-green-400">
                            {creators.filter(c => c.email && c.email !== "N/A").length}
                          </p>
                        </div>
                      </div>

                      {/* Creators Table */}
                      <ScrollArea className="h-[500px]">
                        <table className="w-full">
                          <thead className="bg-zinc-800/50 sticky top-0">
                            <tr>
                              <th className="text-left p-3 text-zinc-400 text-sm font-medium">Creator</th>
                              <th className="text-left p-3 text-zinc-400 text-sm font-medium">Email</th>
                              <th className="text-center p-3 text-zinc-400 text-sm font-medium">Videos</th>
                              <th className="text-center p-3 text-zinc-400 text-sm font-medium">Views</th>
                              <th className="text-center p-3 text-zinc-400 text-sm font-medium">Likes</th>
                              <th className="text-left p-3 text-zinc-400 text-sm font-medium">Categories</th>
                              <th className="text-left p-3 text-zinc-400 text-sm font-medium">Last Active</th>
                              <th className="text-center p-3 text-zinc-400 text-sm font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {creators.map((creator) => (
                              <tr key={creator.creator_id || creator.user_id || creator.id} className="hover:bg-zinc-800/30">
                                <td className="p-3">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={creator.profile_picture || creator.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.creator_name || creator.name || 'User')}&background=8b5cf6&color=fff`}
                                      alt={creator.creator_name || creator.name}
                                      className="w-8 h-8 rounded-full"
                                    />
                                    <div>
                                      <span className="text-white font-medium">{creator.creator_name || creator.name}</span>
                                      <p className="text-xs text-zinc-500">{creator.role || 'creator'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  {creator.email && creator.email !== "N/A" ? (
                                    <a href={`mailto:${creator.email}`} className="text-blue-400 hover:underline">
                                      {creator.email}
                                    </a>
                                  ) : (
                                    <span className="text-zinc-500">N/A</span>
                                  )}
                                </td>
                                <td className="p-3 text-center text-white">{creator.videos || 0}</td>
                                <td className="p-3 text-center text-blue-400">{(creator.total_views || 0).toLocaleString()}</td>
                                <td className="p-3 text-center text-red-400">{(creator.total_likes || 0).toLocaleString()}</td>
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-1">
                                    {(creator.categories || []).slice(0, 3).map((cat) => (
                                      <Badge key={cat} className="bg-zinc-700 text-xs">{cat}</Badge>
                                    ))}
                                    {(creator.categories || []).length > 3 && (
                                      <Badge className="bg-zinc-700 text-xs">+{creator.categories.length - 3}</Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-zinc-400 text-sm">
                                  {creator.last_activity 
                                    ? new Date(creator.last_activity).toLocaleDateString()
                                    : "N/A"
                                  }
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    {creator.email && creator.email !== "N/A" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
                                        onClick={() => {
                                          window.open(`mailto:${creator.email}?subject=ZTVLIVE%20Creator%20Opportunity&body=Hi%20${encodeURIComponent(creator.creator_name)},%0A%0AWe%20noticed%20your%20great%20content%20on%20ZTVLIVE!%20We'd%20love%20to%20feature%20more%20of%20your%20videos%20on%20our%20platform.`);
                                        }}
                                      >
                                        Email
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-zinc-600"
                                      onClick={() => {
                                        navigator.clipboard.writeText(creator.creator_id);
                                        toast.success("Creator ID copied");
                                      }}
                                    >
                                      Copy ID
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-red-600 text-red-400 hover:bg-red-600/20"
                                      onClick={() => handleDeleteCreator(creator.creator_id, creator.creator_name)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </ScrollArea>

                      {/* Export Button */}
                      <div className="flex justify-end pt-4 border-t border-zinc-800">
                        <Button
                          onClick={() => {
                            const csv = [
                              ["Name", "Email", "Videos", "Views", "Likes", "Categories", "Last Active", "Creator ID"],
                              ...creators.map(c => [
                                c.creator_name,
                                c.email || "N/A",
                                c.videos || 0,
                                c.total_views || 0,
                                c.total_likes || 0,
                                (c.categories || []).join("; "),
                                c.last_activity ? new Date(c.last_activity).toLocaleDateString() : "N/A",
                                c.creator_id
                              ])
                            ].map(row => row.join(",")).join("\n");
                            
                            const blob = new Blob([csv], { type: "text/csv" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `ztvlive-creators-${new Date().toISOString().split("T")[0]}.csv`;
                            a.click();
                            toast.success("Creator data exported!");
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Export to CSV
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 mx-auto text-zinc-600 mb-4" />
                      <p className="text-zinc-500">No creators registered yet</p>
                      <p className="text-zinc-600 text-sm mt-2">Creators will appear here when they upload content</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sponsor Analytics Tab - DoorDash Dashboard */}
            <TabsContent value="sponsor-analytics" className="space-y-6">
              <SponsorAnalytics />
            </TabsContent>

            {/* Game Analytics Tab - Real Player Data */}
            <TabsContent value="game-analytics" className="space-y-6">
              <GameAnalyticsPanel />
            </TabsContent>

            {/* Platform Stats Tab - Comprehensive Analytics */}
            <TabsContent value="platform-stats" className="space-y-6">
              <PlatformStatsPanel />
            </TabsContent>

            {/* Social QR Tab - QR Code Generator & Analytics */}
            <TabsContent value="social-qr" className="space-y-6">
              <SocialQRGenerator />
            </TabsContent>

            {/* Stream Health Tab - FFprobe Roku Validation */}
            <TabsContent value="stream-health" className="space-y-6">
              <StreamHealthPanel />
            </TabsContent>

            {/* Schedule Health Tab - NEW */}
            <TabsContent value="schedule-health" className="space-y-6">
              <ScheduleHealthPanel />
            </TabsContent>

            {/* Penny Creator Engagement Tab */}
            <TabsContent value="penny" className="space-y-6">
              <PennyDashboardPanel />
            </TabsContent>

            {/* Security Center Tab */}
            <TabsContent value="security" className="space-y-6">
              <SecurityPanel />
            </TabsContent>

            {/* SEO Dashboard Tab */}
            <TabsContent value="seo" className="space-y-6">
              <SEODashboardPanel />
            </TabsContent>

            {/* Tutorial Funnel Analytics Tab */}
            <TabsContent value="tutorial-funnel" className="space-y-6">
              <TutorialFunnelPanel />
            </TabsContent>

            {/* Live Activity Feed Tab */}
            <TabsContent value="live-activity" className="space-y-6">
              <LiveActivityFeed />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-800">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Tv className="w-5 h-5 text-red-400" />
            <span className="font-heading text-xl tracking-wider">ZTVLIVE</span>
            <Badge className="bg-violet-600 ml-2">ADMIN v2.0</Badge>
          </div>
          <p className="text-zinc-500 text-sm">Full Admin Dashboard • Traffic • Revenue • Payouts</p>
        </div>
      </footer>
    </div>
  );
}
