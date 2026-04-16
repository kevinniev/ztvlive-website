import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Users, TrendingUp, Zap, MapPin, Clock, Gift,
  RefreshCw, Download, Target, DollarSign, Activity,
  ArrowUpRight, ArrowDownRight, ChevronRight, Globe, Award,
  Crown, Flame, Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const API = '/api';

export default function SponsorAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [impactReport, setImpactReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [analyticsRes, leaderboardRes, impactRes] = await Promise.all([
        axios.get(`${API}/game-analytics/analytics`),
        axios.get(`${API}/game-analytics/leaderboard?limit=10`),
        axios.get(`${API}/game-analytics/leaderboard/impact-report`)
      ]);
      setAnalytics(analyticsRes.data);
      setLeaderboard(leaderboardRes.data);
      setImpactReport(impactRes.data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const handleExport = async () => {
    try {
      const res = await axios.get(`${API}/game-analytics/analytics/export`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ztvlive-sponsor-report-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      toast.success("Report exported!");
    } catch (err) {
      toast.error("Failed to export report");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = analytics?.summary || {};
  const recentWinners = analytics?.recent_winners || [];
  const geoData = analytics?.geo_distribution || {};
  const hourlyData = analytics?.engagement_by_hour || {};

  // Calculate engagement trend (compare last hour to previous)
  const hourlyEntries = Object.entries(hourlyData).sort();
  const currentHourEngagement = hourlyEntries.length > 0 ? hourlyEntries[hourlyEntries.length - 1][1] : 0;
  const prevHourEngagement = hourlyEntries.length > 1 ? hourlyEntries[hourlyEntries.length - 2][1] : 0;
  const engagementTrend = prevHourEngagement > 0 
    ? ((currentHourEngagement - prevHourEngagement) / prevHourEngagement * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6" data-testid="sponsor-analytics-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-yellow-500" />
            Sponsor Analytics Dashboard
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Real-time engagement metrics for DoorDash partnership
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-zinc-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            size="sm" 
            onClick={handleExport}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Engagement Velocity - THE KEY METRIC */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border-yellow-600/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-400 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Engagement Velocity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {summary.engagement_velocity?.toFixed(1) || '0.0'}
                <span className="text-lg text-yellow-400">/min</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                QR scans in last 5 minutes
              </p>
              <div className="mt-2 flex items-center gap-1 text-xs">
                {Number(engagementTrend) >= 0 ? (
                  <>
                    <ArrowUpRight className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">+{engagementTrend}% vs last hour</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-3 h-3 text-red-400" />
                    <span className="text-red-400">{engagementTrend}% vs last hour</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Plays */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Total Game Plays
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {summary.total_plays?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Since launch
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Unique Participants */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Unique Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {summary.unique_participants?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Individual viewers engaged
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Conversion Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-600/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Conversion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                {summary.conversion_rate?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Players → Email Captures
              </p>
              <Progress 
                value={summary.conversion_rate || 0} 
                className="mt-2 h-1 bg-zinc-700"
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Second Row - Winners & Geography */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Winners Feed */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-zinc-900 border-zinc-800 h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Winner Ticker Feed
                <Badge variant="outline" className="ml-2 border-green-500 text-green-400">
                  {summary.total_winners || 0} Total
                </Badge>
              </CardTitle>
              <CardDescription>
                Real-time reward claims from UNUSUAL FUN SHOW
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {recentWinners.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No winners yet. Start the show to see live data!</p>
                  </div>
                ) : (
                  recentWinners.slice().reverse().map((winner, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                          <Award className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-white">@{winner.username}</p>
                          <p className="text-xs text-zinc-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {winner.location || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-green-600 text-white">
                          <Gift className="w-3 h-3 mr-1" />
                          {winner.reward_value}
                        </Badge>
                        <p className="text-xs text-zinc-500 mt-1">
                          {new Date(winner.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Geographic Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-zinc-900 border-zinc-800 h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-500" />
                Geographic Distribution
              </CardTitle>
              <CardDescription>
                Where viewers are engaging from
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(geoData).length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Globe className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No geographic data yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(geoData)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([region, count], idx) => {
                      const maxCount = Math.max(...Object.values(geoData));
                      const percentage = (count / maxCount) * 100;
                      return (
                        <div key={region} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-300 flex items-center gap-2">
                              <MapPin className="w-3 h-3 text-blue-400" />
                              {region}
                            </span>
                            <span className="text-zinc-400">{count} plays</span>
                          </div>
                          <Progress 
                            value={percentage} 
                            className="h-2 bg-zinc-800"
                          />
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Live Leaderboard Section - FOMO for Sponsor Pitches */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
      >
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-800 border-yellow-600/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              Live Leaderboard
              <Badge className="bg-yellow-600 text-white ml-2">
                {leaderboard?.total_players || 0} Players
              </Badge>
            </CardTitle>
            <CardDescription>
              Top 10 trivia champions competing for rewards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Leaderboard List */}
              <div className="space-y-2">
                {!leaderboard?.leaderboard?.length ? (
                  <div className="text-center py-8 text-zinc-500">
                    <Crown className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No players on leaderboard yet</p>
                    <p className="text-xs mt-1">Players join when they play trivia</p>
                  </div>
                ) : (
                  leaderboard.leaderboard.slice(0, 5).map((player, idx) => (
                    <div 
                      key={player.player_id}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        idx === 0 ? 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-600/30' :
                        idx === 1 ? 'bg-zinc-700/30' :
                        idx === 2 ? 'bg-orange-900/20' :
                        'bg-zinc-800/30'
                      }`}
                    >
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                        ${idx === 0 ? 'bg-gradient-to-br from-yellow-500 to-amber-600 text-white' :
                          idx === 1 ? 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-800' :
                          idx === 2 ? 'bg-gradient-to-br from-orange-600 to-amber-700 text-white' :
                          'bg-zinc-700 text-zinc-300'}
                      `}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-white font-medium text-sm truncate">
                            {player.username}
                          </span>
                          {player.streak >= 3 && (
                            <Flame className="w-3 h-3 text-orange-400" />
                          )}
                        </div>
                        <span className="text-xs text-zinc-500">
                          {player.correct_answers} correct • {player.streak} streak
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-yellow-400">{player.score}</span>
                        <span className="text-xs text-zinc-500 block">pts</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Impact Report Stats */}
              <div className="space-y-4">
                <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                  <h4 className="text-sm font-medium text-zinc-400 mb-3">Live Impact Metrics</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {impactReport?.engagement_metrics?.peak_concurrent_players || 0}
                      </p>
                      <p className="text-xs text-zinc-500">Peak Concurrent</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-400">
                        {impactReport?.conversion_metrics?.winner_conversion_rate || 0}%
                      </p>
                      <p className="text-xs text-zinc-500">Winner Conversion</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-400">
                        {impactReport?.engagement_metrics?.participation_spikes_count || 0}
                      </p>
                      <p className="text-xs text-zinc-500">Participation Spikes</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-400">
                        {impactReport?.fomo_indicators?.active_streaks || 0}
                      </p>
                      <p className="text-xs text-zinc-500">Active Streaks (3+)</p>
                    </div>
                  </div>
                </div>

                {impactReport?.fomo_indicators?.current_top_player && (
                  <div className="p-4 bg-gradient-to-r from-yellow-600/10 to-orange-600/10 rounded-lg border border-yellow-600/30">
                    <h4 className="text-sm font-medium text-yellow-400 mb-2 flex items-center gap-2">
                      <Star className="w-4 h-4" /> Current Leader
                    </h4>
                    <p className="text-xl font-bold text-white">
                      {impactReport.fomo_indicators.current_top_player.username}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {impactReport.fomo_indicators.current_top_player.score} points • 
                      {impactReport.fomo_indicators.score_gap_to_top} pts ahead of #2
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Reward Tiers Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              Active Reward Tiers
            </CardTitle>
            <CardDescription>
              Current sponsor rewards being distributed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(analytics?.reward_tiers || {}).map(([key, tier]) => (
                <div 
                  key={key}
                  className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Gift className="w-5 h-5 text-yellow-500" />
                    <h4 className="font-medium text-white">{tier.name}</h4>
                  </div>
                  <p className="text-2xl font-bold text-green-400 mb-1">{tier.value}</p>
                  <p className="text-xs text-zinc-400">{tier.description}</p>
                  <Badge variant="outline" className="mt-2 text-xs border-zinc-600">
                    Trigger: {tier.trigger.replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer with last update */}
      <div className="text-center text-xs text-zinc-500">
        Last updated: {analytics?.report_generated 
          ? new Date(analytics.report_generated).toLocaleString()
          : 'Never'}
        <span className="mx-2">•</span>
        Auto-refreshes every 30 seconds
      </div>
    </div>
  );
}
