import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Tv, Users, Activity, Trophy, TrendingUp, Download, Globe, 
  Smartphone, Monitor, MapPin, Loader2, RefreshCw, PieChart, BarChart2,
  Video, Film, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API = '/api';

// Platform Stats Panel - REAL Platform Data (Users, Creators, Videos, Schedule)
export default function PlatformStatsPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = async () => {
    try {
      // Fetch REAL platform data from multiple endpoints
      const [usersRes, creatorsRes, scheduleRes, pennyRes] = await Promise.all([
        axios.get(`${API}/admin/users?limit=100`),
        axios.get(`${API}/admin/creators?limit=100`),
        axios.get(`${API}/tv/schedule-health`),
        axios.get(`${API}/admin/penny/dashboard`)
      ]);

      // Combine into comprehensive stats
      const users = usersRes.data;
      const creators = creatorsRes.data;
      const schedule = scheduleRes.data;
      const penny = pennyRes.data;

      setStats({
        overview: {
          total_users: users.total || 0,
          total_creators: creators.total || 0,
          total_videos: schedule.library_stats?.total_videos || 0,
          enabled_videos: schedule.library_stats?.enabled_videos || 0,
          schedule_items: schedule.schedule_stats?.schedule_length || 0,
          health_score: schedule.health_score || 0
        },
        engagement: penny.engagement || {},
        creators_list: creators.creators?.slice(0, 10) || [],
        schedule: schedule,
        penny: penny
      });
    } catch (error) {
      console.error("Failed to fetch platform stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <span className="ml-3 text-zinc-400">Loading platform analytics...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-zinc-500">
        Failed to load platform stats
        <Button onClick={fetchStats} className="ml-4" variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  const { overview, engagement, creators_list, schedule } = stats;

  return (
    <div className="space-y-6" data-testid="platform-stats-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-indigo-400" />
            Platform Analytics
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time users, creators, content, and engagement metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <Switch 
              checked={autoRefresh} 
              onCheckedChange={setAutoRefresh}
            />
            Auto-refresh
          </label>
          <Button onClick={fetchStats} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-900/30 to-zinc-900 border-indigo-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-indigo-400" />
              <div>
                <p className="text-3xl font-bold text-white">{overview.total_users}</p>
                <p className="text-xs text-zinc-400">Registered Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-900/30 to-zinc-900 border-emerald-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Film className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-3xl font-bold text-white">{overview.total_creators}</p>
                <p className="text-xs text-zinc-400">Active Creators</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-900/30 to-zinc-900 border-cyan-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Video className="w-8 h-8 text-cyan-400" />
              <div>
                <p className="text-3xl font-bold text-white">{overview.total_videos}</p>
                <p className="text-xs text-zinc-400">Videos in Library</p>
              </div>
            </div>
            <p className="text-xs text-emerald-400 mt-2">{overview.enabled_videos} enabled</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-900/30 to-zinc-900 border-yellow-800/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-3xl font-bold text-white">{overview.health_score}%</p>
                <p className="text-xs text-zinc-400">Schedule Health</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Creator Engagement Distribution */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Creator Engagement Levels
          </CardTitle>
          <CardDescription>How engaged are your creators?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(engagement.distribution || {}).map(([level, count]) => {
              const colors = {
                new: "bg-blue-500",
                active: "bg-emerald-500",
                engaged: "bg-green-500",
                at_risk: "bg-yellow-500",
                inactive: "bg-orange-500",
                churned: "bg-red-500"
              };
              return (
                <div key={level} className="text-center p-3 bg-zinc-800/50 rounded-lg">
                  <div className={`w-4 h-4 rounded-full ${colors[level] || 'bg-zinc-500'} mx-auto mb-2`} />
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-xs text-zinc-400 capitalize">{level.replace('_', ' ')}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-zinc-800/30 rounded-lg">
            <p className="text-sm text-zinc-300">
              <span className="text-emerald-400 font-bold">{engagement.active_rate || 0}%</span> active rate • 
              <span className="text-yellow-400 font-bold ml-2">{engagement.at_risk_count || 0}</span> at risk • 
              <span className="text-red-400 font-bold ml-2">{engagement.churned_count || 0}</span> churned
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Creators */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-indigo-400" />
            Recent Creators ({overview.total_creators})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {creators_list.slice(0, 8).map((creator, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {(creator.name || creator.email || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-white">{creator.name || creator.email}</p>
                    <p className="text-xs text-zinc-500">{creator.videos || 0} videos</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {creator.role || 'creator'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Schedule Stats */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Tv className="w-5 h-5 text-red-400" />
            24/7 Stream Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{schedule?.schedule_stats?.schedule_length || 0}</p>
              <p className="text-xs text-zinc-400">Videos/24hr</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{schedule?.schedule_stats?.unique_videos || 0}</p>
              <p className="text-xs text-zinc-400">Unique in Rotation</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{schedule?.schedule_stats?.max_repeats || 0}x</p>
              <p className="text-xs text-zinc-400">Max Repeats</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-cyan-400">{Object.keys(schedule?.category_distribution || {}).length}</p>
              <p className="text-xs text-zinc-400">Categories Active</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
