/**
 * UpcomingSchedule Component for ZTVLIVE Watch Page
 * 
 * Shows upcoming content in the schedule with:
 * - Current playing indicator
 * - Next up preview
 * - Schedule list
 * - Time remaining
 */

import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Play, Radio, ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const UpcomingSchedule = memo(({
  currentContent,
  nextContent,
  upcomingList = [],
  programBlock,
  timeRemaining = 0,
  onItemClick,
  isExpanded = false,
  onToggleExpand,
}) => {
  const [showFullSchedule, setShowFullSchedule] = useState(false);

  // Format time remaining
  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  // Get category badge color
  const getCategoryColor = (category) => {
    const colors = {
      music: "bg-purple-600",
      entertainment: "bg-pink-600",
      sports: "bg-green-600",
      news: "bg-blue-600",
      gaming: "bg-orange-600",
      education: "bg-cyan-600",
      comedy: "bg-yellow-600",
      lifestyle: "bg-rose-600",
    };
    return colors[category?.toLowerCase()] || "bg-zinc-600";
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-red-500" />
          <span className="font-medium text-sm">Up Next</span>
        </div>
        
        {programBlock && (
          <Badge variant="outline" className="text-xs border-zinc-700">
            {programBlock}
          </Badge>
        )}
      </div>

      {/* Now Playing */}
      {currentContent && (
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-xs text-red-500 mb-2">
            <Radio className="w-3 h-3 animate-pulse" />
            <span className="font-medium">NOW PLAYING</span>
          </div>
          
          <div className="flex gap-3">
            {/* Thumbnail */}
            <div className="relative w-24 h-14 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
              {currentContent.thumbnail_url ? (
                <img 
                  src={currentContent.thumbnail_url} 
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-6 h-6 text-zinc-600" />
                </div>
              )}
              
              {/* Live badge */}
              <div className="absolute top-1 left-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                LIVE
              </div>
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-white truncate">
                {currentContent.title || "Live Stream"}
              </h3>
              {currentContent.creator_name && (
                <p className="text-xs text-zinc-400 truncate">
                  {currentContent.creator_name}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {currentContent.category && (
                  <Badge 
                    className={`text-[10px] h-4 px-1.5 ${getCategoryColor(currentContent.category)}`}
                  >
                    {currentContent.category}
                  </Badge>
                )}
                {timeRemaining > 0 && (
                  <span className="text-[10px] text-zinc-500">
                    {formatTimeRemaining(timeRemaining)} left
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next Up */}
      {nextContent && (
        <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
            <Clock className="w-3 h-3" />
            <span>NEXT UP</span>
          </div>
          
          <div 
            className="flex gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onItemClick?.(nextContent)}
          >
            {/* Thumbnail */}
            <div className="relative w-20 h-12 rounded overflow-hidden bg-zinc-800 flex-shrink-0">
              {nextContent.thumbnail_url ? (
                <img 
                  src={nextContent.thumbnail_url} 
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-5 h-5 text-zinc-600" />
                </div>
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-medium text-white truncate">
                {nextContent.title || "Upcoming"}
              </h4>
              {nextContent.duration_seconds && (
                <p className="text-[10px] text-zinc-500">
                  {formatDuration(nextContent.duration_seconds)}
                </p>
              )}
            </div>
            
            <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
          </div>
        </div>
      )}

      {/* Upcoming List */}
      <div className="flex-1 overflow-y-auto">
        {upcomingList.length > 0 ? (
          <div className="p-4 space-y-2">
            <button
              onClick={() => setShowFullSchedule(!showFullSchedule)}
              className="flex items-center justify-between w-full text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <span>Coming up ({upcomingList.length})</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFullSchedule ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showFullSchedule && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {upcomingList.slice(0, 10).map((item, index) => (
                    <div 
                      key={item.id || index}
                      onClick={() => onItemClick?.(item)}
                      className="flex items-center gap-3 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer transition-colors"
                    >
                      {/* Position */}
                      <span className="text-xs text-zinc-600 w-4 text-center">
                        {index + 1}
                      </span>
                      
                      {/* Thumbnail */}
                      <div className="w-12 h-7 rounded overflow-hidden bg-zinc-700 flex-shrink-0">
                        {item.thumbnail_url ? (
                          <img 
                            src={item.thumbnail_url} 
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play className="w-3 h-3 text-zinc-500" />
                          </div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">
                          {item.title}
                        </p>
                        {item.duration_seconds && (
                          <p className="text-[10px] text-zinc-500">
                            {formatDuration(item.duration_seconds)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-4">
            <Calendar className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs text-center">No upcoming content scheduled</p>
          </div>
        )}
      </div>

      {/* Full Schedule Button */}
      <div className="p-4 border-t border-zinc-800">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-zinc-700 text-zinc-400 hover:text-white"
          onClick={onToggleExpand}
        >
          <Calendar className="w-4 h-4 mr-2" />
          View Full Schedule
        </Button>
      </div>
    </div>
  );
});

UpcomingSchedule.displayName = 'UpcomingSchedule';

export default UpcomingSchedule;
