import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Heart, MessageCircle, Radio, DollarSign, Megaphone,
  Check, X, Loader2, Settings, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const API = '/api';

// Icon mapping for notification types
const NOTIFICATION_ICONS = {
  video_like: { icon: Heart, color: "text-red-500", bg: "bg-red-500/20" },
  video_comment: { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/20" },
  video_live: { icon: Radio, color: "text-green-500", bg: "bg-green-500/20" },
  payout_received: { icon: DollarSign, color: "text-green-500", bg: "bg-green-500/20" },
  video_approved: { icon: Check, color: "text-purple-500", bg: "bg-purple-500/20" },
  video_scheduled: { icon: Radio, color: "text-orange-500", bg: "bg-orange-500/20" },
  system_announcement: { icon: Megaphone, color: "text-yellow-500", bg: "bg-yellow-500/20" },
  new_follower: { icon: Heart, color: "text-pink-500", bg: "bg-pink-500/20" }
};

function NotificationItem({ notification, onMarkRead, onDelete }) {
  const config = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system_announcement;
  const Icon = config.icon;

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        notification.is_read 
          ? "bg-zinc-900/30 hover:bg-zinc-800/50" 
          : "bg-zinc-800/80 hover:bg-zinc-700/80"
      }`}
      onClick={handleClick}
    >
      <div className="flex gap-3">
        <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`font-medium text-sm ${notification.is_read ? "text-gray-400" : "text-white"}`}>
              {notification.title}
            </h4>
            {!notification.is_read && (
              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5" />
            )}
          </div>
          <p className="text-gray-500 text-xs mt-1 line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-gray-600 text-xs">
              {formatTimeAgo(notification.created_at)}
            </span>
            {notification.link && (
              <ExternalLink className="w-3 h-3 text-gray-500" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

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

export default function NotificationBell({ userId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch unread count periodically
  useEffect(() => {
    if (!userId) return;
    
    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get(
          `${API}/notifications/my/unread-count?user_id=${userId}`
        );
        setUnreadCount(response.data.unread_count);
      } catch (error) {
        console.log("Could not fetch notification count");
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [userId]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen && userId) {
      fetchNotifications();
    }
  }, [isOpen, userId]);

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

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/notifications/my?user_id=${userId}&limit=20`
      );
      setNotifications(response.data);
    } catch (error) {
      console.log("Could not fetch notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(
        `${API}/notifications/my/mark-read/${notificationId}?user_id=${userId}`
      );
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.log("Could not mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post(`${API}/notifications/my/mark-all-read?user_id=${userId}`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error("Failed to mark notifications as read");
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await axios.delete(
        `${API}/notifications/my/${notificationId}?user_id=${userId}`
      );
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.log("Could not delete notification");
    }
  };

  if (!userId) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-xs text-white flex items-center justify-center font-medium">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-12 w-80 sm:w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-500" />
                Notifications
                {unreadCount > 0 && (
                  <Badge className="bg-red-600 text-white text-xs">{unreadCount}</Badge>
                )}
              </h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  Mark all read
                </Button>
              )}
            </div>

            {/* Notifications List */}
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                </div>
              ) : notifications.length > 0 ? (
                <div className="p-2 space-y-2">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={markAsRead}
                      onDelete={deleteNotification}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-gray-400 font-medium">No notifications yet</p>
                  <p className="text-gray-500 text-sm mt-1">
                    We'll notify you when something happens
                  </p>
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-zinc-800">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Navigate to full notifications page if needed
                  }}
                  className="w-full text-center text-sm text-gray-400 hover:text-white transition-colors"
                >
                  View all notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
