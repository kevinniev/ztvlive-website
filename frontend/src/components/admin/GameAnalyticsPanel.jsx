import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Tv, Users, Activity, Trophy, Zap, RefreshCw, Globe, 
  Smartphone, Monitor, MapPin, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API = '/api';

// Game Analytics Panel - Real Player Data (No AI)
export default function GameAnalyticsPanel() {
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
