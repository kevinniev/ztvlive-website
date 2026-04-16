import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Users, Video, Upload, Radio, MessageSquare, 
  Check, X, Loader2, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const API = '/api';

// Icon mapping for admin notification types
const ADMIN_NOTIFICATION_ICONS = {
  new_creator: { icon: Users, color: "text-green-500", bg: "bg-green-500/20" },
  new_upload: { icon: Upload, color: "text-blue-500", bg: "bg-blue-500/20" },
  video_live: { icon: Radio, color: "text-red-500", bg: "bg-red-500/20" },
  creator_activity: { icon: Video, color: "text-purple-500", bg: "bg-purple-500/20" }
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

export default function AdminNotificationPanel({ adminId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch unread count
  useEffect(() => {
    if (!adminId) return;
    
    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get(
          `${API}/notifications/admin/unread-count?admin_id=${adminId}`
        );
        setUnreadCount(response.data.unread_count);
      } catch (error) {
        console.log("Could not fetch admin notification count");
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [adminId]);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (isOpen && adminId) {
      fetchNotifications();
    }
  }, [isOpen, adminId]);

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
        `${API}/notifications/admin?admin_id=${adminId}&limit=20`
      );
      setNotifications(response.data.notifications);
    } catch (error) {
      console.log("Could not fetch admin notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(
        `${API}/notifications/admin/mark-read/${notificationId}?admin_id=${adminId}`
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
      await axios.post(`${API}/notifications/admin/mark-all-read?admin_id=${adminId}`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error("Failed to mark notifications as read");
    }
  };

  if (!adminId) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        data-testid="admin-notification-bell"
      >
        <Bell className="w-5 h-5 text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-xs text-white flex items-center justify-center font-medium animate-pulse">
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
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-800/50">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-red-500" />
                Admin Alerts
                {unreadCount > 0 && (
                  <Badge className="bg-red-600 text-white text-xs">{unreadCount}</Badge>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchNotifications}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
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
            </div>

            {/* Notifications List */}
            <ScrollArea className="h-[400px]">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                </div>
              ) : notifications.length > 0 ? (
                <div className="p-2 space-y-2">
                  {notifications.map((notification) => {
                    const config = ADMIN_NOTIFICATION_ICONS[notification.type] || 
                      ADMIN_NOTIFICATION_ICONS.creator_activity;
                    const Icon = config.icon;
                    
                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          notification.is_read 
                            ? "bg-zinc-900/30 hover:bg-zinc-800/50" 
                            : "bg-zinc-800/80 hover:bg-zinc-700/80 border-l-2 border-red-500"
                        }`}
                        onClick={() => !notification.is_read && markAsRead(notification.id)}
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
                            <span className="text-gray-600 text-xs mt-2 block">
                              {formatTimeAgo(notification.created_at)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell className="w-12 h-12 text-gray-600 mb-3" />
                  <p className="text-gray-400 font-medium">No admin alerts</p>
                  <p className="text-gray-500 text-sm mt-1">
                    You'll be notified about creator activity
                  </p>
                </div>
              )}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
