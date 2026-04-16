import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Calendar, Clock, User, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import axios from "axios";

const API = '/api';

export default function ComingUpAlert() {
  const [upcoming, setUpcoming] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    fetchUpcoming();
    // Check every 2 minutes
    const interval = setInterval(fetchUpcoming, 120000);
    return () => clearInterval(interval);
  }, []);

  const fetchUpcoming = async () => {
    try {
      const res = await axios.get(`${API}/schedule/upcoming`);
      // Only show content starting in the next 30 minutes
      const now = new Date();
      const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60 * 1000);
      
      const filtered = (res.data.upcoming || []).filter(item => {
        const schedTime = new Date(item.scheduled_time);
        return schedTime > now && schedTime <= thirtyMinsFromNow;
      });
      
      setUpcoming(filtered);
    } catch (error) {
      console.log("Could not fetch upcoming scheduled content");
    }
  };

  const dismiss = (scheduleId) => {
    setDismissed(prev => new Set([...prev, scheduleId]));
  };

  const visibleUpcoming = upcoming.filter(item => !dismissed.has(item.schedule_id));

  if (visibleUpcoming.length === 0) return null;

  const formatTimeUntil = (isoString) => {
    const schedTime = new Date(isoString);
    const now = new Date();
    const diffMs = schedTime - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins <= 0) return "Starting now!";
    if (diffMins === 1) return "In 1 minute";
    if (diffMins < 60) return `In ${diffMins} minutes`;
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `In ${hours}h ${mins}m`;
  };

  return (
    <AnimatePresence>
      {isMinimized ? (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg hover:bg-red-500 transition-colors"
          data-testid="coming-up-minimized"
        >
          <Bell className="w-5 h-5 text-white" />
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full text-xs font-bold flex items-center justify-center text-black">
            {visibleUpcoming.length}
          </span>
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 right-4 z-50 w-80 max-h-[50vh] overflow-hidden"
          data-testid="coming-up-panel"
        >
          <div className="bg-zinc-900/95 backdrop-blur-md rounded-xl border border-red-500/30 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-white" />
                <span className="font-bold text-white">Coming Up</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 rounded hover:bg-white/20 transition-colors"
                  title="Minimize"
                >
                  <span className="text-white text-lg">−</span>
                </button>
              </div>
            </div>
            
            {/* Content List */}
            <div className="max-h-[300px] overflow-y-auto">
              {visibleUpcoming.map((item, idx) => (
                <motion.div
                  key={item.schedule_id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="p-3 border-b border-zinc-800 last:border-b-0"
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="w-16 h-10 rounded bg-zinc-800 overflow-hidden flex-shrink-0">
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-zinc-600" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white line-clamp-1">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                        <User className="w-3 h-3" />
                        <span className="truncate">{item.creator_name}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-medium text-red-400">
                          {formatTimeUntil(item.scheduled_time)}
                        </span>
                        <button
                          onClick={() => dismiss(item.schedule_id)}
                          className="text-zinc-500 hover:text-white p-1 transition-colors"
                          title="Dismiss"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Creator link */}
                  {item.creator_username && (
                    <Link
                      to={`/c/${item.creator_username}`}
                      className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                    >
                      View @{item.creator_username}'s profile
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </motion.div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="px-4 py-2 bg-zinc-800/50 border-t border-zinc-700">
              <p className="text-xs text-zinc-500 text-center">
                Creator content coming to ZTVLIVE
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
