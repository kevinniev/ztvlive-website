import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Eye, Clock, Calendar, Users, Share2, Twitter, Facebook,
  MessageCircle, Copy, Bell, BellRing, ExternalLink, RefreshCw,
  Video, TrendingUp, ChevronRight, Radio, Wifi, WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const API = '/api';

/**
 * Creator Live Stats Widget
 * Shows real-time stats only for the creator's OWN content when it's live.
 * Creators cannot see other creators' stats.
 */
const CreatorLiveStats = ({ onShareClick }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const countdownRef = useRef(null);
  const elapsedRef = useRef(null);

  const fetchStats = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await axios.get(`${API}/creator/my-live-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
      
      if (res.data.remaining_seconds) {
        setCountdown(res.data.remaining_seconds);
      }
      if (res.data.elapsed_seconds) {
        setElapsed(res.data.elapsed_seconds);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Countdown/elapsed timer
  useEffect(() => {
    if (stats?.is_my_content_live) {
      countdownRef.current = setInterval(() => {
        setCountdown(prev => Math.max(0, prev - 1));
        setElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [stats?.is_my_content_live]);

  const formatTime = (seconds) => {
    if (!seconds || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShare = () => {
    const shareUrl = `https://www.ztvlivestream.com/watch`;
    const text = `I'm LIVE on ZTVLIVE right now! Come watch: ${stats?.content_title || "My Stream"}`;
    
    if (navigator.share) {
      navigator.share({ title: "ZTVLIVE", text, url: shareUrl });
    } else {
      navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      toast.success("Link copied to clipboard!");
    }
    onShareClick?.();
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800" data-testid="creator-stats-loading">
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-5 h-5 animate-spin text-zinc-500" />
          <span className="ml-2 text-zinc-400">Loading stats...</span>
        </div>
      </div>
    );
  }

  if (!stats?.is_my_content_live) {
    // Content not live - show next scheduled
    return (
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800" data-testid="creator-stats-offline">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-zinc-800 rounded-full flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="font-semibold mb-2 text-white">Your content is not live</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Real-time stats will appear here when your scheduled content goes live
          </p>
          
          {stats?.next_scheduled && (
            <div className="bg-zinc-800/50 rounded-lg p-4 text-left mt-4">
              <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">Next Scheduled</p>
              <p className="font-semibold text-white">{stats.next_scheduled.title}</p>
              <p className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {stats.next_scheduled.slot_date} at {stats.next_scheduled.slot_hour}:{String(stats.next_scheduled.slot_minute || 0).padStart(2, '0')} UTC
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Content IS live - show full stats
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-red-900/30 to-zinc-900 rounded-xl p-6 border border-red-600/30"
      data-testid="creator-stats-live"
    >
      {/* Live Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping" />
          </div>
          <span className="font-bold text-red-400">YOU'RE LIVE!</span>
        </div>
        <Badge variant="destructive" className="animate-pulse">
          <Radio className="w-3 h-3 mr-1" />
          BROADCASTING
        </Badge>
      </div>

      {/* Content Title */}
      <h3 className="text-xl font-bold mb-4 text-white">{stats.content_title}</h3>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <Eye className="w-5 h-5 mx-auto mb-1 text-green-400" />
          <p className="text-2xl font-bold text-green-400" data-testid="viewer-count">
            {stats.viewer_count || 0}
          </p>
          <p className="text-xs text-zinc-400">VIEWERS</p>
        </div>
        
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-blue-400" />
          <p className="text-2xl font-bold font-mono text-blue-400" data-testid="elapsed-time">
            {formatTime(elapsed)}
          </p>
          <p className="text-xs text-zinc-400">ELAPSED</p>
        </div>
        
        <div className="bg-black/30 rounded-lg p-3 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
          <p className="text-2xl font-bold font-mono text-yellow-400" data-testid="remaining-time">
            {formatTime(countdown)}
          </p>
          <p className="text-xs text-zinc-400">REMAINING</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-1000"
            style={{ 
              width: `${Math.min(100, (elapsed / (elapsed + countdown)) * 100)}%` 
            }}
          />
        </div>
      </div>

      {/* Share Button */}
      <Button 
        onClick={handleShare}
        className="w-full bg-white/10 hover:bg-white/20 border border-white/10"
        data-testid="share-live-btn"
      >
        <Share2 className="w-4 h-4 mr-2" />
        Share with your fans!
      </Button>
    </motion.div>
  );
};


/**
 * Fan Subscription Widget
 * Allows fans to subscribe to notifications when creator goes live
 * Supports both email and browser push notifications
 */
const FanSubscribeWidget = ({ creatorId, creatorName }) => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);

  // Check if browser push is supported
  useEffect(() => {
    setPushSupported('Notification' in window && 'serviceWorker' in navigator);
    
    // Check if already subscribed via email (stored in localStorage)
    const savedSubs = localStorage.getItem(`ztvlive_subscribed_${creatorId}`);
    if (savedSubs) {
      setSubscribed(true);
    }
  }, [creatorId]);

  const handleEmailSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await axios.post(`${API}/fan-notifications/subscribe`, {
        email,
        creator_id: creatorId,
        notify_live: true,
        notify_scheduled: true
      });
      setSubscribed(true);
      localStorage.setItem(`ztvlive_subscribed_${creatorId}`, 'true');
      toast.success("Subscribed! You'll be notified when this creator goes live.");
    } catch (error) {
      toast.error("Failed to subscribe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePushSubscribe = async () => {
    if (!pushSupported) {
      toast.error("Browser notifications not supported");
      return;
    }

    setLoading(true);
    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        toast.error("Please allow notifications to receive alerts when creator goes live");
        setLoading(false);
        return;
      }

      // Get OneSignal player ID if available
      const playerId = window.OneSignal?.User?.onesignalId;
      
      if (playerId) {
        // Subscribe via OneSignal
        await axios.post(`${API}/push/follow-creator`, {
          creator_id: creatorId,
          creator_name: creatorName,
          player_id: playerId
        });
        setPushEnabled(true);
        toast.success("Push notifications enabled!");
      } else {
        // Fallback - just enable browser notifications
        setPushEnabled(true);
        toast.success("Notifications enabled! You'll see alerts when content goes live.");
      }
    } catch (error) {
      console.error("Push subscription error:", error);
      toast.error("Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  if (subscribed && pushEnabled) {
    return (
      <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-4 text-center" data-testid="fan-subscribed">
        <BellRing className="w-8 h-8 mx-auto mb-2 text-green-400" />
        <p className="font-semibold text-green-400">You're all set!</p>
        <p className="text-sm text-zinc-400">We'll notify you via email & push when {creatorName || "this creator"} goes live.</p>
      </div>
    );
  }

  if (subscribed) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800" data-testid="fan-email-subscribed">
        <div className="flex items-center gap-2 mb-3">
          <BellRing className="w-5 h-5 text-green-400" />
          <h4 className="font-semibold text-white">Email notifications enabled</h4>
        </div>
        
        {pushSupported && !pushEnabled && (
          <Button 
            onClick={handlePushSubscribe} 
            disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-700"
            data-testid="enable-push-btn"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
            Enable Browser Notifications
          </Button>
        )}
        
        <p className="text-xs text-zinc-500 mt-2">
          Get instant alerts when {creatorName || "this creator"} goes live.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800" data-testid="fan-subscribe-widget">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-5 h-5 text-yellow-500" />
        <h4 className="font-semibold text-white">Get notified when live!</h4>
      </div>
      
      <form onSubmit={handleEmailSubscribe} className="flex gap-2 mb-3">
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-zinc-800 border-zinc-700 text-white"
          required
          data-testid="fan-email-input"
        />
        <Button 
          type="submit" 
          disabled={loading} 
          className="bg-red-600 hover:bg-red-700"
          data-testid="fan-subscribe-btn"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Subscribe"}
        </Button>
      </form>
      
      {pushSupported && (
        <Button 
          onClick={handlePushSubscribe} 
          variant="outline"
          disabled={loading}
          className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          data-testid="enable-push-alt-btn"
        >
          <Bell className="w-4 h-4 mr-2" />
          Enable Browser Notifications
        </Button>
      )}
      
      <p className="text-xs text-zinc-500 mt-2">
        We'll notify you when {creatorName || "this creator"} starts streaming.
      </p>
    </div>
  );
};


/**
 * Subscriber Count Widget
 * Shows the creator how many fans are subscribed to their notifications
 */
const SubscriberCountWidget = ({ creatorId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/fan-notifications/subscribers/${creatorId}`);
        setStats(res.data);
      } catch (error) {
        console.error("Failed to fetch subscriber stats:", error);
      } finally {
        setLoading(false);
      }
    };

    if (creatorId) {
      fetchStats();
    }
  }, [creatorId]);

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex items-center justify-center">
        <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800" data-testid="subscriber-count-widget">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-red-600/20 to-pink-600/20 rounded-full flex items-center justify-center">
          <Users className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{stats?.total_reach || 0}</p>
          <p className="text-sm text-zinc-400">Fans Subscribed</p>
        </div>
      </div>
      {stats?.direct_subscribers > 0 && (
        <p className="text-xs text-zinc-500 mt-2">
          {stats.direct_subscribers} follow you directly • {stats.total_reach - stats.direct_subscribers} follow all creators
        </p>
      )}
    </div>
  );
};


/**
 * Share Content Widget
 * Allows creators to share their scheduled content with fans
 */
const ShareContentWidget = ({ bookingId, title, scheduleTime }) => {
  const [shareInfo, setShareInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShareInfo = async () => {
      try {
        const res = await axios.get(`${API}/creator/share/${bookingId}`);
        setShareInfo(res.data);
      } catch (error) {
        console.error("Failed to fetch share info:", error);
        // Fallback share info
        setShareInfo({
          share_url: `https://www.ztvlivestream.com/watch?event=${bookingId}`,
          social_share: {
            twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Watch "${title}" live on ZTVLIVE!`)}&url=${encodeURIComponent(`https://www.ztvlivestream.com/watch`)}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://www.ztvlivestream.com/watch`)}`,
            whatsapp: `https://wa.me/?text=${encodeURIComponent(`Watch "${title}" live on ZTVLIVE! https://www.ztvlivestream.com/watch`)}`
          }
        });
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) {
      fetchShareInfo();
    } else {
      setLoading(false);
    }
  }, [bookingId, title]);

  const copyLink = () => {
    const url = shareInfo?.share_url || 'https://www.ztvlivestream.com/watch';
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
        <div className="flex items-center justify-center py-4">
          <RefreshCw className="w-4 h-4 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800" data-testid="share-content-widget">
      <h4 className="font-semibold mb-3 flex items-center gap-2 text-white">
        <Share2 className="w-4 h-4 text-blue-500" />
        Share with your fans
      </h4>
      
      <p className="text-sm text-zinc-400 mb-3">
        Let your fans know about your upcoming content!
      </p>
      
      {/* Share URL */}
      <div className="flex items-center gap-2 mb-4">
        <Input
          value={shareInfo?.share_url || 'https://www.ztvlivestream.com/watch'}
          readOnly
          className="flex-1 bg-zinc-800 border-zinc-700 text-sm text-zinc-300"
        />
        <Button variant="outline" size="icon" onClick={copyLink} className="border-zinc-700">
          <Copy className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Social Share Buttons */}
      <div className="flex items-center gap-2">
        <a
          href={shareInfo?.social_share?.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] rounded-lg transition-colors text-white text-sm"
        >
          <Twitter className="w-4 h-4" />
          Tweet
        </a>
        
        <a
          href={shareInfo?.social_share?.facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#4267B2] hover:bg-[#365899] rounded-lg transition-colors text-white text-sm"
        >
          <Facebook className="w-4 h-4" />
          Share
        </a>
        
        <a
          href={shareInfo?.social_share?.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#25D366] hover:bg-[#20bd5a] rounded-lg transition-colors text-white text-sm"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </a>
      </div>
    </div>
  );
};


export { CreatorLiveStats, FanSubscribeWidget, ShareContentWidget, SubscriberCountWidget };
