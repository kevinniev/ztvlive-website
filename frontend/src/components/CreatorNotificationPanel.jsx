/**
 * Creator Notification Panel - Real-time in-app notifications
 * 
 * Integrates with the notification_scheduler.py backend for:
 * - Slot reminders (30 min, 5 min)
 * - Live notifications
 * - Collab invites
 * - Content approvals
 * - Engagement alerts
 * - Optimal scheduling suggestions
 */

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Clock, Radio, CheckCircle2, AlertTriangle,
  UserPlus, Users, Trophy, Sparkles, TrendingUp,
  Info, X, Loader2, RefreshCw, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const API = '/api';

// Icon and color mapping for notification types
const NOTIFICATION_CONFIG = {
  slot_reminder_30: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/20", label: "Reminder" },
  slot_reminder_5: { icon: Clock, color: "text-orange-500", bg: "bg-orange-500/20", label: "Urgent" },
  slot_live: { icon: Radio, color: "text-red-500", bg: "bg-red-500/20", label: "Live" },
  slot_completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/20", label: "Complete" },
  content_approved: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/20", label: "Approved" },
  content_flagged: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/20", label: "Review" },
  collab_invite: { icon: UserPlus, color: "text-purple-500", bg: "bg-purple-500/20", label: "Collab" },
  collab_accepted: { icon: Users, color: "text-green-500", bg: "bg-green-500/20", label: "Collab" },
  collab_declined: { icon: Users, color: "text-zinc-500", bg: "bg-zinc-500/20", label: "Collab" },
  revenue_milestone: { icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/20", label: "Milestone" },
  optimal_time: { icon: Sparkles, color: "text-cyan-500", bg: "bg-cyan-500/20", label: "Tip" },
  engagement_alert: { icon: TrendingUp, color: "text-pink-500", bg: "bg-pink-500/20", label: "Stats" },
  system: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/20", label: "System" },
};

// Priority colors
const PRIORITY_COLORS = {
  urgent: "border-red-500",
  high: "border-orange-500",
  normal: "border-transparent",
  low: "border-transparent",
};

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function CreatorNotificationPanel({ userId, compact = false }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await axios.get(
        `${API}/in-app-notifications/unread-count?user_id=${userId}`
      );
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.log("Could not fetch notification count");
    }
  }, [userId]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/in-app-notifications?user_id=${userId}&limit=30`
      );
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.log("Could not fetch notifications");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Poll for new notifications
  useEffect(() => {
    if (!userId) return;
    
    fetchUnreadCount();
    pollIntervalRef.current = setInterval(fetchUnreadCount, 15000); // Every 15 seconds
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [userId, fetchUnreadCount]);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (isOpen && userId) {
      fetchNotifications();
    }
  }, [isOpen, userId, fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await axios.post(
        `${API}/in-app-notifications/${notificationId}/read?user_id=${userId}`
      );
      setNotifications(prev =>
        prev.map(n => n.notification_id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.log("Could not mark notification as read");
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/in-app-notifications/read-all?user_id=${userId}`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error("Failed to mark notifications as read");
    }
  };

  // Dismiss notification
  const dismissNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await axios.post(
        `${API}/in-app-notifications/${notificationId}/dismiss?user_id=${userId}`
      );
      setNotifications(prev =>
        prev.filter(n => n.notification_id !== notificationId)
      );
      if (!notifications.find(n => n.notification_id === notificationId)?.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.log("Could not dismiss notification");
    }
  };

  // Handle action button click
  const handleAction = (notification, action) => {
    if (action.link) {
      window.location.href = action.link;
    } else if (action.action === 'dismiss') {
      dismissNotification(notification.notification_id, { stopPropagation: () => {} });
    }
    // Mark as read after action
    if (!notification.read) {
      markAsRead(notification.notification_id);
    }
  };

  if (!userId) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          isOpen ? 'bg-zinc-800' : 'hover:bg-zinc-800'
        }`}
        data-testid="creator-notification-bell"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-white' : 'text-gray-400'}`} />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-gradient-to-r from-red-600 to-pink-600 rounded-full text-xs text-white flex items-center justify-center font-bold px-1"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden ${
              compact ? 'w-72' : 'w-80 sm:w-96'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-gradient-to-r from-zinc-800/50 to-zinc-900/50">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-500" />
                Notifications
                {unreadCount > 0 && (
                  <Badge className="bg-red-600 text-white text-xs px-1.5">{unreadCount}</Badge>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchNotifications}
                  className="text-gray-400 hover:text-white p-1 h-7 w-7"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-gray-400 hover:text-white text-xs h-7"
                  >
                    Mark all read
                  </Button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <ScrollArea className={compact ? 'h-[300px]' : 'h-[400px]'}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                </div>
              ) : notifications.length > 0 ? (
                <div className="p-2 space-y-1">
                  {notifications.map((notification) => {
                    const config = NOTIFICATION_CONFIG[notification.type] || 
                      NOTIFICATION_CONFIG.system;
                    const Icon = config.icon;
                    const priorityBorder = PRIORITY_COLORS[notification.priority] || "";
                    
                    return (
                      <motion.div
                        key={notification.notification_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`p-3 rounded-lg cursor-pointer transition-all border-l-2 ${priorityBorder} ${
                          notification.read 
                            ? "bg-zinc-900/30 hover:bg-zinc-800/50" 
                            : "bg-zinc-800/80 hover:bg-zinc-700/80"
                        }`}
                        onClick={() => {
                          if (!notification.read) markAsRead(notification.notification_id);
                          if (notification.link) window.location.href = notification.link;
                        }}
                      >
                        <div className="flex gap-3">
                          {/* Icon */}
                          <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${config.color}`} />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <h4 className={`font-medium text-sm ${notification.read ? "text-gray-400" : "text-white"}`}>
                                  {notification.title}
                                </h4>
                                {notification.priority === 'urgent' && (
                                  <Badge className="bg-red-600 text-white text-[10px] px-1 h-4">URGENT</Badge>
                                )}
                              </div>
                              <button
                                onClick={(e) => dismissNotification(notification.notification_id, e)}
                                className="text-zinc-600 hover:text-white p-0.5 rounded transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                            
                            {/* Actions */}
                            {notification.actions && notification.actions.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {notification.actions.slice(0, 2).map((action, idx) => (
                                  <Button
                                    key={idx}
                                    variant={idx === 0 ? "default" : "ghost"}
                                    size="sm"
                                    className={`h-6 text-xs px-2 ${
                                      idx === 0 ? 'bg-red-600 hover:bg-red-500' : 'text-zinc-400'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAction(notification, action);
                                    }}
                                  >
                                    {action.label}
                                    {action.link && <ChevronRight className="w-3 h-3 ml-1" />}
                                  </Button>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-zinc-600 text-[10px]">
                                {formatTimeAgo(notification.created_at)}
                              </span>
                              <Badge variant="outline" className="text-[9px] h-4 px-1 border-zinc-700 text-zinc-500">
                                {config.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                    <Bell className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-400 font-medium">All caught up!</p>
                  <p className="text-gray-500 text-sm mt-1">
                    You'll be notified about slot reminders, collabs, and more
                  </p>
                </div>
              )}
            </ScrollArea>
            
            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-zinc-800 bg-zinc-900/80">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-zinc-400 hover:text-white text-xs h-8"
                  onClick={() => {
                    setIsOpen(false);
                    window.location.href = '/creator/notifications';
                  }}
                >
                  View all notifications
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
