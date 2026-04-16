import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Clock, Play, Eye, X, Zap, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import axios from "axios";

const API = '/api';

/**
 * CreatorLiveBanner - Shows countdown and live status for creators
 * Displays when their scheduled content is coming up or currently live
 */
const CreatorLiveBanner = ({ userId, onClose }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  // Fetch creator live status
  const fetchStatus = useCallback(async () => {
    if (!userId) return;
    
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      const response = await axios.get(`${API}/creator-live/my-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setStatus(response.data);
      
      if (response.data.countdown_seconds) {
        setCountdown(response.data.countdown_seconds);
      } else if (response.data.remaining_seconds) {
        setCountdown(response.data.remaining_seconds);
      }
    } catch (error) {
      console.error("Failed to fetch creator live status:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
    
    // Poll every 30 seconds when not imminent
    const pollInterval = setInterval(fetchStatus, 30000);
    
    return () => clearInterval(pollInterval);
  }, [fetchStatus]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Refresh status when countdown hits zero
          fetchStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [countdown, fetchStatus]);

  // Format countdown
  const formatCountdown = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onClose) onClose();
  };

  // Don't show if dismissed, loading, or no status
  if (dismissed || loading || !status) return null;
  
  // Don't show if idle (no upcoming content)
  if (status.status === "idle") return null;

  const isLive = status.status === "live";
  const isImminent = status.countdown_seconds && status.countdown_seconds <= 60;
  const banner = status.banner;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className={`fixed top-0 left-0 right-0 z-50 ${
          isLive 
            ? "bg-gradient-to-r from-red-600 via-red-500 to-red-600" 
            : isImminent 
              ? "bg-gradient-to-r from-yellow-600 via-orange-500 to-yellow-600"
              : "bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-600"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Status Icon */}
            <div className={`p-2 rounded-full ${
              isLive ? "bg-white/20 animate-pulse" : "bg-white/10"
            }`}>
              {isLive ? (
                <Radio className="w-5 h-5 text-white" />
              ) : (
                <Clock className="w-5 h-5 text-white" />
              )}
            </div>
            
            {/* Content */}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-lg">
                  {banner?.title || (isLive ? "🔴 YOU'RE LIVE!" : "📅 Coming Up")}
                </span>
                
                {/* Live Indicator */}
                {isLive && (
                  <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              
              <p className="text-white/90 text-sm">
                {banner?.subtitle || status.title}
              </p>
            </div>
          </div>
          
          {/* Countdown / Timer */}
          <div className="flex items-center gap-4">
            {countdown > 0 && !isLive && (
              <div className="text-right">
                <div className={`text-2xl font-mono font-bold text-white ${
                  isImminent ? "animate-pulse" : ""
                }`}>
                  {formatCountdown(countdown)}
                </div>
                <div className="text-xs text-white/70">until live</div>
              </div>
            )}
            
            {isLive && countdown > 0 && (
              <div className="text-right">
                <div className="text-lg font-mono text-white">
                  {formatCountdown(countdown)}
                </div>
                <div className="text-xs text-white/70">remaining</div>
              </div>
            )}
            
            {/* CTA Button */}
            <Link to={banner?.cta_url || "/watch"}>
              <Button 
                className={`${
                  isLive 
                    ? "bg-white text-red-600 hover:bg-white/90" 
                    : "bg-white/20 text-white hover:bg-white/30 border border-white/30"
                } font-semibold`}
              >
                {isLive ? (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Watch Live
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    {banner?.cta_text || "Get Ready"}
                  </>
                )}
              </Button>
            </Link>
            
            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="p-1 text-white/60 hover:text-white/90 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Progress Bar for Live */}
        {isLive && status.duration_minutes && (
          <div className="h-1 bg-black/20">
            <motion.div
              className="h-full bg-white/50"
              initial={{ width: `${(status.elapsed_seconds / (status.duration_minutes * 60)) * 100}%` }}
              animate={{ width: `${(status.elapsed_seconds / (status.duration_minutes * 60)) * 100}%` }}
              transition={{ duration: 1 }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * CreatorLiveCard - Compact card version for dashboard
 */
export const CreatorLiveCard = ({ userId }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!userId) return;
      
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        
        const response = await axios.get(`${API}/creator-live/my-status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setStatus(response.data);
        if (response.data.countdown_seconds) {
          setCountdown(response.data.countdown_seconds);
        }
      } catch (error) {
        console.error("Failed to fetch status:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [countdown]);

  const formatCountdown = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading || !status || status.status === "idle") return null;

  const isLive = status.status === "live";
  const isImminent = countdown && countdown <= 60;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl p-4 ${
        isLive 
          ? "bg-gradient-to-br from-red-600 to-red-700 border-2 border-red-400"
          : isImminent
            ? "bg-gradient-to-br from-yellow-600 to-orange-600 border-2 border-yellow-400"
            : "bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border border-purple-500/30"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLive ? (
            <>
              <Radio className="w-5 h-5 text-white animate-pulse" />
              <span className="text-white font-bold">YOU'RE LIVE!</span>
            </>
          ) : (
            <>
              <Clock className={`w-5 h-5 ${isImminent ? "text-white" : "text-purple-400"}`} />
              <span className={`font-semibold ${isImminent ? "text-white" : "text-purple-200"}`}>
                {isImminent ? "Going Live Soon!" : "Upcoming"}
              </span>
            </>
          )}
        </div>
        
        {countdown > 0 && (
          <div className={`text-xl font-mono font-bold ${
            isLive || isImminent ? "text-white" : "text-purple-300"
          } ${isImminent && !isLive ? "animate-pulse" : ""}`}>
            {formatCountdown(countdown)}
          </div>
        )}
      </div>
      
      <p className={`text-sm mb-3 ${isLive || isImminent ? "text-white/90" : "text-purple-200/80"}`}>
        {status.title}
      </p>
      
      <Link to="/watch">
        <Button 
          className={`w-full ${
            isLive 
              ? "bg-white text-red-600 hover:bg-white/90" 
              : "bg-white/20 hover:bg-white/30"
          }`}
          size="sm"
        >
          {isLive ? (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Watch Now
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              View Schedule
            </>
          )}
        </Button>
      </Link>
    </motion.div>
  );
};

export default CreatorLiveBanner;
