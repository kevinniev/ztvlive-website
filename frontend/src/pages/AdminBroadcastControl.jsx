import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, RefreshCw, Monitor, Radio, Clock,
  Calendar, User, Film, Tv, Eye, Users, AlertCircle, CheckCircle,
  ChevronRight, Volume2, VolumeX, Maximize, Settings, Wifi, WifiOff,
  Share2, Twitter, Facebook, MessageCircle, Copy, ExternalLink,
  Gamepad2, Video, Zap, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Navigation from "@/components/Navigation";
import { toast } from "sonner";

const API = '/api';

const AdminBroadcastControl = () => {
  const [currentProgram, setCurrentProgram] = useState(null);
  const [obsStatus, setObsStatus] = useState(null);
  const [creatorCache, setCreatorCache] = useState(null);
  const [viewerCount, setViewerCount] = useState(null);
  const [manualOverride, setManualOverride] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [overrideDuration, setOverrideDuration] = useState(30);
  const countdownRef = useRef(null);

  // Fetch all data
  const fetchData = async () => {
    try {
      const [syncRes, obsRes, cacheRes, viewerRes, overrideRes] = await Promise.all([
        axios.get(`${API}/tv/sync`),
        axios.get(`${API}/obs/scene-switch`),
        axios.get(`${API}/tv/creator-cache`),
        axios.get(`${API}/broadcast/viewer-count`).catch(() => ({ data: { total_viewers: 0 } })),
        axios.get(`${API}/obs/manual-override`).catch(() => ({ data: { enabled: false } }))
      ]);

      setCurrentProgram(syncRes.data);
      setObsStatus(obsRes.data);
      setCreatorCache(cacheRes.data);
      setViewerCount(viewerRes.data);
      setManualOverride(overrideRes.data);
      
      // Set countdown
      if (obsRes.data?.remaining_seconds) {
        setCountdown(obsRes.data.remaining_seconds);
      } else if (syncRes.data?.now_playing?.duration_seconds && syncRes.data?.elapsed_seconds) {
        setCountdown(syncRes.data.now_playing.duration_seconds - syncRes.data.elapsed_seconds);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Manual scene override
  const setSceneOverride = async (scene) => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.post(
        `${API}/obs/manual-override?scene=${scene}&duration_minutes=${overrideDuration}&reason=Admin%20manual%20control`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message);
      setManualOverride(res.data.status);
      await fetchData();
    } catch (error) {
      toast.error("Failed to set override: " + (error.response?.data?.detail || error.message));
    }
  };

  // Disable override
  const disableOverride = async () => {
    const token = localStorage.getItem("token");
    try {
      await axios.post(
        `${API}/obs/manual-override?scene=disable`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Manual override disabled");
      setManualOverride({ enabled: false });
      await fetchData();
    } catch (error) {
      toast.error("Failed to disable override");
    }
  };

  // Refresh creator cache
  const refreshCache = async () => {
    setRefreshing(true);
    try {
      await axios.post(`${API}/tv/refresh-creator-cache`);
      toast.success("Creator cache refreshed!");
      await fetchData();
    } catch (error) {
      toast.error("Failed to refresh cache");
    } finally {
      setRefreshing(false);
    }
  };

  // Copy share URL
  const copyShareUrl = (booking) => {
    const url = `https://www.ztvlivestream.com/watch?event=${booking.booking_id || 'live'}`;
    navigator.clipboard.writeText(url);
    toast.success("Share URL copied!");
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds for real-time feel
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setInterval(() => {
        setCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [countdown]);

  // Format time
  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return "0:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-red-500" />
          <p>Loading Broadcast Control...</p>
        </div>
      </div>
    );
  }

  const isCreatorLive = obsStatus?.is_creator_live;
  const isManualOverride = manualOverride?.enabled || obsStatus?.manual_override;
  const currentTitle = isCreatorLive 
    ? obsStatus?.creator_title 
    : currentProgram?.title || currentProgram?.now_playing?.title;
  const embedUrl = isCreatorLive
    ? obsStatus?.creator_embed_url
    : currentProgram?.embed_url || currentProgram?.now_playing?.embed_url || currentProgram?.video_url;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navigation />
      
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Monitor className="w-6 h-6 text-red-500" />
              Broadcast Control
            </h1>
            <p className="text-zinc-400 text-sm">Master Control Room - Real-Time Monitoring</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Real Viewer Count */}
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg">
              <Eye className="w-4 h-4 text-green-400" />
              <span className="font-bold text-green-400">{viewerCount?.total_viewers || 0}</span>
              <span className="text-xs text-zinc-400">LIVE VIEWERS</span>
            </div>
            
            {/* Status Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              isManualOverride ? 'bg-yellow-600' : isCreatorLive ? 'bg-red-600' : 'bg-green-600'
            }`}>
              {isManualOverride ? (
                <>
                  <Shield className="w-4 h-4" />
                  MANUAL OVERRIDE
                </>
              ) : isCreatorLive ? (
                <>
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  CREATOR LIVE
                </>
              ) : (
                <>
                  <Gamepad2 className="w-4 h-4" />
                  GAME FEED
                </>
              )}
            </div>
          </div>
        </div>

        {/* Manual Override Warning */}
        {isManualOverride && (
          <div className="mb-4 p-4 bg-yellow-600/20 border border-yellow-600/50 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-yellow-500" />
              <div>
                <p className="font-semibold text-yellow-400">Manual Override Active</p>
                <p className="text-sm text-zinc-300">
                  Scene locked to: {manualOverride?.scene || obsStatus?.scene} | 
                  Reason: {manualOverride?.reason || obsStatus?.override_reason}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={disableOverride}
              className="border-yellow-600 text-yellow-400 hover:bg-yellow-600/20"
            >
              Disable Override
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Preview */}
          <div className="lg:col-span-2 space-y-4">
            {/* Live Preview */}
            <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isCreatorLive ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className="font-semibold">PROGRAM OUTPUT</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isCreatorLive ? "destructive" : "secondary"}>
                    {isCreatorLive ? "CREATOR" : "AI SCHEDULE"}
                  </Badge>
                  <Badge variant="outline" className="text-green-400 border-green-600">
                    <Eye className="w-3 h-3 mr-1" />
                    {viewerCount?.total_viewers || 0}
                  </Badge>
                </div>
              </div>
              
              {/* Video Preview */}
              <div className="relative aspect-video bg-black">
                {embedUrl ? (
                  <iframe
                    src={`${embedUrl}${embedUrl.includes('?') ? '&' : '?'}mute=1`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                    allowFullScreen
                    frameBorder="0"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film className="w-16 h-16 text-zinc-700" />
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-lg font-semibold">{currentTitle || "Loading..."}</p>
                      {isCreatorLive && (
                        <p className="text-sm text-zinc-400">by {obsStatus?.creator_name}</p>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">REMAINING</p>
                      <p className="text-3xl font-mono font-bold text-red-400">
                        {formatTime(countdown)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Scene Controls */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                Manual Scene Override
              </h3>
              
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">Duration:</span>
                  <Input
                    type="number"
                    value={overrideDuration}
                    onChange={(e) => setOverrideDuration(parseInt(e.target.value) || 30)}
                    className="w-20 bg-zinc-800 border-zinc-700"
                    min={1}
                    max={120}
                  />
                  <span className="text-sm text-zinc-400">min</span>
                </div>
                
                <Button
                  onClick={() => setSceneOverride("game")}
                  variant={obsStatus?.scene === "game" && !isManualOverride ? "default" : "outline"}
                  className={`${obsStatus?.scene === "game" ? 'bg-green-600 hover:bg-green-700' : 'border-green-600 text-green-400 hover:bg-green-600/20'}`}
                >
                  <Gamepad2 className="w-4 h-4 mr-2" />
                  Force Game Feed
                </Button>
                
                <Button
                  onClick={() => setSceneOverride("creator")}
                  variant={obsStatus?.scene === "creator" && !isManualOverride ? "default" : "outline"}
                  className={`${obsStatus?.scene === "creator" ? 'bg-red-600 hover:bg-red-700' : 'border-red-600 text-red-400 hover:bg-red-600/20'}`}
                >
                  <Video className="w-4 h-4 mr-2" />
                  Force Creator Content
                </Button>
                
                {isManualOverride && (
                  <Button
                    onClick={disableOverride}
                    variant="outline"
                    className="border-yellow-600 text-yellow-400"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Cancel Override
                  </Button>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs">GAME PLAYERS</span>
                </div>
                <p className="text-2xl font-bold text-green-400">{viewerCount?.game_players || 0}</p>
              </div>
              
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <Eye className="w-4 h-4" />
                  <span className="text-xs">WATCH VIEWERS</span>
                </div>
                <p className="text-2xl font-bold text-blue-400">{viewerCount?.watch_viewers || 0}</p>
              </div>
              
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">ELAPSED</span>
                </div>
                <p className="text-2xl font-bold font-mono">
                  {formatTime(currentProgram?.elapsed_seconds || obsStatus?.elapsed_seconds || 0)}
                </p>
              </div>
              
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400 mb-1">
                  <Tv className="w-4 h-4" />
                  <span className="text-xs">CURRENT SCENE</span>
                </div>
                <p className="text-lg font-bold">
                  {obsStatus?.scene === "creator" ? "Creator" : "Game Feed"}
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Cache Controls */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4 text-yellow-500" />
                  Creator Cache
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshCache}
                  disabled={refreshing}
                  className="border-zinc-700"
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Cached</span>
                  <span className="font-mono font-bold">{creatorCache?.cache_size || 0} bookings</span>
                </div>
              </div>
            </div>

            {/* Upcoming Schedule with Share */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Scheduled Content
                </h3>
              </div>
              
              <div className="max-h-[350px] overflow-y-auto">
                {creatorCache?.cache_entries && Object.keys(creatorCache.cache_entries).length > 0 ? (
                  <div className="divide-y divide-zinc-800">
                    {Object.entries(creatorCache.cache_entries).map(([key, entry], index) => (
                      <div key={key} className="p-3 hover:bg-zinc-800/30">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            index === 0 ? 'bg-red-600' : 'bg-zinc-700'
                          }`}>
                            {index === 0 ? <Play className="w-4 h-4" /> : <span className="text-xs">{index + 1}</span>}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{entry.title}</p>
                            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                              <Clock className="w-3 h-3" />
                              <span>{entry.hour}:{String(entry.minute || 0).padStart(2, '0')} UTC</span>
                            </div>
                            
                            {/* Share Buttons */}
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => copyShareUrl(entry)}
                                className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                                title="Copy Link"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <a
                                href={`https://twitter.com/intent/tweet?text=Watch%20LIVE%20on%20ZTVLIVE!&url=https://www.ztvlivestream.com/watch`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-blue-400 transition-colors"
                                title="Share on Twitter"
                              >
                                <Twitter className="w-3 h-3" />
                              </a>
                              <a
                                href={`https://www.facebook.com/sharer/sharer.php?u=https://www.ztvlivestream.com/watch`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-blue-600 transition-colors"
                                title="Share on Facebook"
                              >
                                <Facebook className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                          
                          {index === 0 && (
                            <Badge variant="destructive" className="text-xs flex-shrink-0">NEXT</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-500">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No creator content scheduled</p>
                  </div>
                )}
              </div>
            </div>

            {/* OBS Status */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Tv className="w-4 h-4 text-purple-500" />
                OBS Scene Status
              </h3>
              
              <div className="space-y-2">
                <div className={`p-3 rounded-lg transition-all ${
                  obsStatus?.scene === "game" ? 'bg-green-600/20 border border-green-600/30 scale-[1.02]' : 'bg-zinc-800/50'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      obsStatus?.scene === "game" ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'
                    }`} />
                    <Gamepad2 className="w-4 h-4" />
                    <span className="font-medium">Game Feed</span>
                    {obsStatus?.scene === "game" && <Badge className="ml-auto bg-green-600 text-xs">ACTIVE</Badge>}
                  </div>
                </div>
                
                <div className={`p-3 rounded-lg transition-all ${
                  obsStatus?.scene === "creator" ? 'bg-red-600/20 border border-red-600/30 scale-[1.02]' : 'bg-zinc-800/50'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      obsStatus?.scene === "creator" ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'
                    }`} />
                    <Video className="w-4 h-4" />
                    <span className="font-medium">Creator Content</span>
                    {obsStatus?.scene === "creator" && <Badge className="ml-auto bg-red-600 text-xs">LIVE</Badge>}
                  </div>
                  
                  {obsStatus?.is_creator_live && (
                    <div className="mt-2 pt-2 border-t border-zinc-700 text-sm">
                      <p className="truncate">{obsStatus.creator_title}</p>
                      <p className="text-xs text-zinc-500">by {obsStatus.creator_name}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBroadcastControl;
