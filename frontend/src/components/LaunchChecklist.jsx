import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { 
  Tv, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle,
  Users, Trophy, Mail, Activity, Play, Pause, Radio, Zap,
  TrendingUp, Loader2
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

export default function LaunchChecklist() {
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  
  // Dashboard data
  const [rtmpStatus, setRtmpStatus] = useState({ status: 'unknown' });
  const [gameState, setGameState] = useState(null);
  const [batchStats, setBatchStats] = useState(null);
  const [prizeClaims, setPrizeClaims] = useState({ claims: [], total: 0 });
  const [emailStats, setEmailStats] = useState({ sent: 0, pending: 0 });

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [rtmpRes, gameRes, batchRes, claimsRes] = await Promise.all([
        axios.get(`${API}/rtmp/status`).catch(() => ({ data: { status: 'error' } })),
        axios.get(`${API}/live-survey/state`).catch(() => ({ data: null })),
        axios.get(`${API}/live-survey/admin/batch-stats`).catch(() => ({ data: null })),
        axios.get(`${API}/live-survey/admin/prize-claims?limit=10`).catch(() => ({ data: { claims: [], total: 0 } })),
      ]);
      
      setRtmpStatus(rtmpRes.data);
      setGameState(gameRes.data);
      setBatchStats(batchRes.data);
      setPrizeClaims(claimsRes.data);
      
      // Calculate email stats from claims
      const sent = claimsRes.data?.claims?.filter(c => c.email_sent)?.length || 0;
      const pending = (claimsRes.data?.total || 0) - sent;
      setEmailStats({ sent, pending });
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching launch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
      case 'started':
        return 'bg-green-500';
      case 'starting':
        return 'bg-yellow-500';
      case 'stopped':
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-zinc-500';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'running':
      case 'started':
        return 'LIVE';
      case 'starting':
        return 'STARTING';
      case 'stopped':
      case 'offline':
        return 'OFFLINE';
      default:
        return 'UNKNOWN';
    }
  };

  // Calculate checklist items
  const checklistItems = [
    {
      name: "RTMP Stream to Castr.io",
      status: rtmpStatus?.status === 'running' || rtmpStatus?.status === 'started',
      icon: Tv,
      value: getStatusText(rtmpStatus?.status),
      color: rtmpStatus?.status === 'running' || rtmpStatus?.status === 'started' ? 'text-green-400' : 'text-red-400'
    },
    {
      name: "Live Survey Game Running",
      status: gameState?.is_live,
      icon: Play,
      value: gameState?.is_live ? 'ACTIVE' : 'STOPPED',
      color: gameState?.is_live ? 'text-green-400' : 'text-red-400'
    },
    {
      name: "Active Players",
      status: (gameState?.player_count || 0) > 0,
      icon: Users,
      value: gameState?.player_count || 0,
      color: (gameState?.player_count || 0) > 10 ? 'text-green-400' : 'text-yellow-400'
    },
    {
      name: "Prize Claims System",
      status: true, // Always ready
      icon: Trophy,
      value: `${prizeClaims?.total || 0} claims`,
      color: 'text-green-400'
    },
    {
      name: "Email Delivery (SendGrid)",
      status: emailStats.pending === 0,
      icon: Mail,
      value: emailStats.pending > 0 ? `${emailStats.pending} pending` : 'All sent',
      color: emailStats.pending > 0 ? 'text-yellow-400' : 'text-green-400'
    },
  ];

  const readyCount = checklistItems.filter(item => item.status).length;
  const readyPercent = Math.round((readyCount / checklistItems.length) * 100);

  return (
    <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800" data-testid="launch-checklist">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Zap className="w-6 h-6 text-yellow-400" />
              LAUNCH CHECKLIST
            </CardTitle>
            <CardDescription>April 3rd Launch Status Monitor</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAllData}
            disabled={loading}
            className="border-zinc-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* Overall Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-zinc-400">Launch Readiness</span>
            <span className={readyPercent === 100 ? 'text-green-400 font-bold' : 'text-yellow-400'}>
              {readyPercent}% Ready
            </span>
          </div>
          <Progress 
            value={readyPercent} 
            className="h-2 bg-zinc-800"
          />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Checklist Items */}
        <div className="space-y-2">
          {checklistItems.map((item, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.status ? 'bg-green-500/20' : 'bg-zinc-700/50'}`}>
                  <item.icon className={`w-4 h-4 ${item.status ? 'text-green-400' : 'text-zinc-500'}`} />
                </div>
                <span className="font-medium">{item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-sm ${item.color}`}>{item.value}</span>
                {item.status ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Live Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <Activity className="w-3 h-3" />
              Current Batch
            </div>
            <div className="text-2xl font-bold text-white">
              #{batchStats?.current_batch || gameState?.batch_number || 0}
            </div>
            <div className="text-xs text-zinc-500">
              {formatTime(batchStats?.batch_time_remaining || gameState?.batch_time_remaining)} remaining
            </div>
          </div>
          
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
              <TrendingUp className="w-3 h-3" />
              Questions This Batch
            </div>
            <div className="text-2xl font-bold text-white">
              {batchStats?.questions_this_batch || gameState?.question_number || 0}/10
            </div>
            <div className="text-xs text-zinc-500">
              {gameState?.total_answers || 0} total answers
            </div>
          </div>
        </div>

        {/* Current Question */}
        {gameState?.question && (
          <div className="bg-gradient-to-r from-violet-900/30 to-purple-900/30 rounded-lg p-4 border border-violet-800/50">
            <div className="flex items-center gap-2 text-xs text-violet-400 mb-2">
              <Radio className="w-3 h-3 animate-pulse" />
              LIVE QUESTION
            </div>
            <p className="text-white font-medium">{gameState.question}</p>
            <div className="flex justify-between mt-2 text-sm">
              <span className="text-zinc-400">{gameState.total_answers} answers</span>
              <span className={`font-mono ${gameState.time_remaining < 10 ? 'text-red-400' : 'text-green-400'}`}>
                {formatTime(gameState.time_remaining)}
              </span>
            </div>
          </div>
        )}

        {/* Recent Prize Claims */}
        {prizeClaims?.claims?.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm text-zinc-400 mb-2 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Recent Prize Claims
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {prizeClaims.claims.slice(0, 5).map((claim, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 bg-zinc-800/30 rounded">
                  <span className="text-zinc-400">{claim.email?.slice(0, 20)}...</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={claim.email_sent ? "default" : "secondary"} className="text-[10px]">
                      {claim.email_sent ? "SENT" : "PENDING"}
                    </Badge>
                    <span className="text-zinc-500">Batch #{claim.batch_number}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="text-center text-xs text-zinc-600 pt-2">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
