import { useState, useEffect } from "react";
import axios from "axios";
import { 
  Activity, RefreshCw, CheckCircle, XCircle, 
  BarChart2, Loader2, AlertTriangle, Zap, Library
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const API = '/api';

// Category colors for visual distinction
const CATEGORY_COLORS = {
  global_hits: "bg-blue-500",
  latin: "bg-orange-500",
  kpop_asia: "bg-pink-500",
  bollywood: "bg-purple-500",
  caribbean: "bg-cyan-500",
  european: "bg-indigo-500",
  hiphop_rnb: "bg-red-500",
  comedy: "bg-yellow-500",
  short_films: "bg-green-500",
  viral_trending: "bg-rose-500",
  movies_trailers: "bg-amber-500",
  documentaries: "bg-teal-500",
  gaming: "bg-violet-500",
  sports_highlights: "bg-emerald-500",
  afrobeats: "bg-lime-500",
  classic_hits: "bg-sky-500",
};

export default function ScheduleHealthPanel() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    try {
      const response = await axios.get(`${API}/tv/schedule-health`);
      setHealth(response.data);
    } catch (error) {
      console.error("Failed to fetch schedule health:", error);
    } finally {
      setLoading(false);
    }
  };

  const forceRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await axios.post(`${API}/tv/refresh-schedule`);
      if (response.data.success) {
        await fetchHealth();
      }
    } catch (error) {
      console.error("Failed to refresh schedule:", error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="ml-3 text-zinc-400">Loading schedule health...</span>
      </div>
    );
  }

  if (!health) {
    return (
      <Card className="bg-red-900/20 border-red-800">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-400">Failed to load schedule health data</p>
          <Button onClick={fetchHealth} className="mt-4" variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { 
    library_stats, 
    schedule_stats, 
    category_distribution, 
    health_score,
    recommendations 
  } = health;

  // Calculate health color based on score
  const getHealthColor = (score) => {
    if (score >= 90) return "text-emerald-400";
    if (score >= 70) return "text-yellow-400";
    if (score >= 50) return "text-orange-400";
    return "text-red-400";
  };

  const getHealthBg = (score) => {
    if (score >= 90) return "from-emerald-900/30 to-zinc-900";
    if (score >= 70) return "from-yellow-900/30 to-zinc-900";
    if (score >= 50) return "from-orange-900/30 to-zinc-900";
    return "from-red-900/30 to-zinc-900";
  };

  return (
    <div className="space-y-6" data-testid="schedule-health-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-400" />
            Schedule Health
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time content rotation stats and library utilization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={forceRefresh} 
            disabled={refreshing}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {refreshing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Force Refresh Schedule
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Health Score Card */}
      <Card className={`bg-gradient-to-br ${getHealthBg(health_score)} border-zinc-800`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-400 mb-1">Overall Health Score</p>
              <p className={`text-5xl font-bold ${getHealthColor(health_score)}`}>
                {health_score}%
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                {health_score >= 90 ? "Excellent variety!" : 
                 health_score >= 70 ? "Good rotation" :
                 health_score >= 50 ? "Needs improvement" : "Critical - refresh recommended"}
              </p>
            </div>
            <div className="text-right space-y-2">
              {health_score >= 90 ? (
                <CheckCircle className="w-16 h-16 text-emerald-400 ml-auto" />
              ) : health_score >= 50 ? (
                <AlertTriangle className="w-16 h-16 text-yellow-400 ml-auto" />
              ) : (
                <XCircle className="w-16 h-16 text-red-400 ml-auto" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Library className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {library_stats?.total_videos || 0}
                </p>
                <p className="text-xs text-zinc-400">Total Library</p>
              </div>
            </div>
            <div className="mt-2 text-xs">
              <span className="text-emerald-400">{library_stats?.enabled_videos || 0} enabled</span>
              <span className="text-zinc-600 mx-1">•</span>
              <span className="text-red-400">{library_stats?.disabled_videos || 0} disabled</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BarChart2 className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {schedule_stats?.unique_videos || 0}
                </p>
                <p className="text-xs text-zinc-400">Unique in Rotation</p>
              </div>
            </div>
            <div className="mt-2">
              <Progress 
                value={(schedule_stats?.unique_videos / library_stats?.enabled_videos) * 100 || 0} 
                className="h-1.5"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {Math.round((schedule_stats?.unique_videos / library_stats?.enabled_videos) * 100 || 0)}% utilization
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {schedule_stats?.max_repeats || 0}x
                </p>
                <p className="text-xs text-zinc-400">Max Repeats</p>
              </div>
            </div>
            <Badge 
              className={`mt-2 ${schedule_stats?.max_repeats <= 3 ? 'bg-emerald-600' : schedule_stats?.max_repeats <= 5 ? 'bg-yellow-600' : 'bg-red-600'}`}
            >
              {schedule_stats?.max_repeats <= 3 ? 'Excellent' : schedule_stats?.max_repeats <= 5 ? 'Acceptable' : 'Too High'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-white">
                  {schedule_stats?.schedule_length || 0}
                </p>
                <p className="text-xs text-zinc-400">Videos/24hr</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              ~{Math.round(86400 / (schedule_stats?.schedule_length || 1))}s avg duration
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Distribution */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart2 className="w-5 h-5 text-indigo-400" />
            Category Distribution
          </CardTitle>
          <CardDescription>How content is spread across categories in today's schedule</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(category_distribution || {})
              .sort((a, b) => b[1] - a[1])
              .map(([category, count]) => {
                const total = schedule_stats?.schedule_length || 1;
                const percentage = Math.round((count / total) * 100);
                const colorClass = CATEGORY_COLORS[category] || "bg-zinc-500";
                
                return (
                  <div key={category} className="p-3 bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${colorClass}`} />
                      <span className="text-sm text-zinc-300 capitalize">
                        {category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-white">{count}</span>
                      <span className="text-xs text-zinc-500">({percentage}%)</span>
                    </div>
                    <Progress value={percentage} className="h-1 mt-2" />
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-yellow-400 mt-0.5">•</span>
                  <span className="text-zinc-300">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
