import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv, Clock, Calendar, ChevronLeft, ChevronRight, Play, Bell,
  User, Film, Gamepad2, Music, Mic, Star, Timer, Eye, 
  Radio, Sparkles, ArrowRight, CheckCircle, Loader2, Volume2
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";

const API = '/api';

// Category icons mapping
const CATEGORY_ICONS = {
  gaming: Gamepad2,
  music: Music,
  comedy: Mic,
  sports: Radio,
  entertainment: Star,
  tech: Sparkles,
  education: Film,
  lifestyle: User,
  default: Tv
};

// Category colors
const CATEGORY_COLORS = {
  gaming: "from-purple-600 to-indigo-600",
  music: "from-pink-600 to-rose-600",
  comedy: "from-yellow-600 to-orange-600",
  sports: "from-green-600 to-emerald-600",
  entertainment: "from-red-600 to-pink-600",
  tech: "from-blue-600 to-cyan-600",
  education: "from-teal-600 to-green-600",
  lifestyle: "from-violet-600 to-purple-600",
  default: "from-zinc-600 to-zinc-700"
};

const TVGuidePage = () => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentSlotIndex, setCurrentSlotIndex] = useState(-1);
  const [reminderSet, setReminderSet] = useState({});
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const scheduleRef = useRef(null);
  const currentSlotRef = useRef(null);

  useEffect(() => {
    fetchSchedule();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [selectedDate]);

  useEffect(() => {
    // Auto-scroll to current slot
    if (currentSlotRef.current && scheduleRef.current) {
      currentSlotRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentSlotIndex, schedule]);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await axios.get(`${API}/schedule?date=${dateStr}`);
      const data = response.data;
      
      // Handle different response formats
      let slots = [];
      if (Array.isArray(data)) {
        slots = data;
      } else if (data?.schedule && Array.isArray(data.schedule)) {
        slots = data.schedule;
      } else if (data?.slots && Array.isArray(data.slots)) {
        slots = data.slots;
      }
      
      setSchedule(slots);
      
      // Find current slot
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentSlotIdx = slots.findIndex(slot => {
        const slotHour = slot.hour ?? slot.slot_start_hour ?? 0;
        const slotMinute = slot.minute ?? slot.slot_start_minute ?? 0;
        
        if (currentHour === slotHour && currentMinute >= slotMinute && currentMinute < slotMinute + 15) {
          return true;
        }
        return false;
      });
      setCurrentSlotIndex(currentSlotIdx);
    } catch (error) {
      console.error("Failed to fetch schedule:", error);
      toast.error("Failed to load TV Guide");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (hour, minute = 0) => {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m} ${ampm}`;
  };

  const getSlotProgress = (slot) => {
    const now = new Date();
    const slotHour = slot.hour || slot.slot_start_hour || 0;
    const slotMinute = slot.minute || slot.slot_start_minute || 0;
    
    const slotStart = new Date();
    slotStart.setHours(slotHour, slotMinute, 0, 0);
    
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + 15);
    
    if (now < slotStart) return 0;
    if (now > slotEnd) return 100;
    
    const elapsed = (now - slotStart) / (1000 * 60); // minutes
    return Math.round((elapsed / 15) * 100);
  };

  const getTimeUntilSlot = (slot) => {
    const now = new Date();
    const slotHour = slot.hour || slot.slot_start_hour || 0;
    const slotMinute = slot.minute || slot.slot_start_minute || 0;
    
    const slotStart = new Date();
    slotStart.setHours(slotHour, slotMinute, 0, 0);
    
    const diff = slotStart - now;
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const setReminder = async (slot, index) => {
    const slotId = `${selectedDate.toISOString().split('T')[0]}_${index}`;
    
    // Toggle reminder
    if (reminderSet[slotId]) {
      setReminderSet(prev => ({ ...prev, [slotId]: false }));
      toast.success("Reminder removed");
    } else {
      setReminderSet(prev => ({ ...prev, [slotId]: true }));
      toast.success("Reminder set! We'll notify you before this starts.");
      
      // In production, this would call the notification API
      // await axios.post(`${API}/fan-notifications/set-reminder`, { slot, date: selectedDate });
    }
  };

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    setSelectedDate(newDate);
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const isTomorrow = selectedDate.toDateString() === new Date(Date.now() + 86400000).toDateString();

  const getCategoryIcon = (category) => {
    const Icon = CATEGORY_ICONS[category?.toLowerCase()] || CATEGORY_ICONS.default;
    return Icon;
  };

  const getCategoryColor = (category) => {
    return CATEGORY_COLORS[category?.toLowerCase()] || CATEGORY_COLORS.default;
  };

  // Group schedule by hour for better display
  const groupedSchedule = (schedule || []).reduce((acc, slot, idx) => {
    const hour = slot.hour ?? slot.slot_start_hour ?? Math.floor(idx / 4);
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push({ ...slot, index: idx });
    return acc;
  }, {});

  // Get current and next slots
  const currentSlot = currentSlotIndex >= 0 ? schedule[currentSlotIndex] : null;
  const nextSlot = currentSlotIndex >= 0 && currentSlotIndex < schedule.length - 1 
    ? schedule[currentSlotIndex + 1] 
    : schedule[0];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900/40 via-zinc-900 to-purple-900/40 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600 rounded-lg">
                <Tv className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">TV Guide</h1>
                <p className="text-zinc-400 text-sm">See what's on ZTVLIVE</p>
              </div>
            </div>
            
            {/* Live indicator */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 border border-red-600 rounded-full">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-red-400">LIVE</span>
              </div>
              <Link to="/watch">
                <Button className="bg-red-600 hover:bg-red-700">
                  <Play className="w-4 h-4 mr-2" />
                  Watch Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Now Playing & Up Next */}
        {isToday && currentSlot && (
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {/* Now Playing */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-red-900/30 to-zinc-900 border border-red-700/50 rounded-xl p-5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Now Playing</span>
                </div>
                
                <h3 className="text-xl font-bold mb-2">
                  {currentSlot.title || currentSlot.content_title || "ZTVLIVE Game Show"}
                </h3>
                
                <div className="flex items-center gap-3 text-sm text-zinc-400 mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatTime(currentSlot.hour || currentSlot.slot_start_hour || 0, currentSlot.minute || currentSlot.slot_start_minute || 0)}
                  </span>
                  {currentSlot.creator_name && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {currentSlot.creator_name}
                    </span>
                  )}
                </div>
                
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>Progress</span>
                    <span>{getSlotProgress(currentSlot)}%</span>
                  </div>
                  <Progress value={getSlotProgress(currentSlot)} className="h-2" />
                </div>
                
                <Link to="/watch" className="mt-4 block">
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    <Volume2 className="w-4 h-4 mr-2" />
                    Watch Live
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Up Next */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRight className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Up Next</span>
                </div>
                
                <h3 className="text-xl font-bold mb-2">
                  {nextSlot?.title || nextSlot?.content_title || "Coming Soon"}
                </h3>
                
                <div className="flex items-center gap-3 text-sm text-zinc-400 mb-4">
                  <span className="flex items-center gap-1">
                    <Timer className="w-4 h-4" />
                    Starts in {getTimeUntilSlot(nextSlot) || "now"}
                  </span>
                  {nextSlot?.creator_name && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {nextSlot.creator_name}
                    </span>
                  )}
                </div>
                
                <Button
                  variant="outline"
                  className="w-full border-purple-700 text-purple-400 hover:bg-purple-900/20"
                  onClick={() => setReminder(nextSlot, currentSlotIndex + 1)}
                >
                  <Bell className="w-4 h-4 mr-2" />
                  {reminderSet[`${selectedDate.toISOString().split('T')[0]}_${currentSlotIndex + 1}`] 
                    ? "Reminder Set" 
                    : "Remind Me"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Date Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDate(-1)}
              className="border-zinc-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg min-w-[200px] text-center">
              <div className="flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <span className="font-semibold">
                  {isToday ? "Today" : isTomorrow ? "Tomorrow" : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDate(1)}
              className="border-zinc-700"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">
              {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Schedule Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        ) : (
          <div ref={scheduleRef} className="space-y-2">
            {Object.entries(groupedSchedule).map(([hour, slots]) => (
              <div key={hour} className="flex gap-2">
                {/* Time label */}
                <div className="w-20 flex-shrink-0 py-3 text-right pr-4">
                  <span className="text-sm font-medium text-zinc-400">
                    {formatTime(parseInt(hour))}
                  </span>
                </div>
                
                {/* Slots for this hour */}
                <div className="flex-1 grid grid-cols-4 gap-2">
                  {slots.map((slot) => {
                    const isCurrentSlot = slot.index === currentSlotIndex && isToday;
                    const isPast = isToday && slot.index < currentSlotIndex;
                    const isCreatorContent = slot.is_creator_content || slot.creator_name;
                    const category = slot.category || "entertainment";
                    const CategoryIcon = getCategoryIcon(category);
                    const slotId = `${selectedDate.toISOString().split('T')[0]}_${slot.index}`;
                    
                    return (
                      <motion.div
                        key={slot.index}
                        ref={isCurrentSlot ? currentSlotRef : null}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`
                          relative p-3 rounded-lg border transition-all cursor-pointer group
                          ${isCurrentSlot 
                            ? 'bg-red-900/30 border-red-600 ring-2 ring-red-600/50' 
                            : isPast
                              ? 'bg-zinc-900/50 border-zinc-800 opacity-50'
                              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                          }
                        `}
                      >
                        {/* Live indicator for current slot */}
                        {isCurrentSlot && (
                          <div className="absolute -top-1 -right-1">
                            <span className="flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                          </div>
                        )}
                        
                        {/* Time */}
                        <div className="text-xs text-zinc-500 mb-1">
                          {formatTime(slot.hour || slot.slot_start_hour || parseInt(hour), slot.minute || slot.slot_start_minute || (slot.index % 4) * 15)}
                        </div>
                        
                        {/* Title */}
                        <div className="font-medium text-sm truncate mb-2">
                          {slot.title || slot.content_title || (isCreatorContent ? "Creator Content" : "Game Show")}
                        </div>
                        
                        {/* Category & Creator */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <CategoryIcon className="w-3 h-3 text-zinc-500" />
                            <span className="text-xs text-zinc-500 capitalize">{category}</span>
                          </div>
                          
                          {isCreatorContent && (
                            <Badge variant="outline" className="text-xs py-0 px-1 border-purple-700 text-purple-400">
                              <User className="w-2 h-2 mr-1" />
                              Creator
                            </Badge>
                          )}
                        </div>
                        
                        {/* Reminder button (shows on hover for future slots) */}
                        {!isPast && !isCurrentSlot && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReminder(slot, slot.index);
                            }}
                            className={`
                              absolute top-2 right-2 p-1 rounded-full transition-all
                              ${reminderSet[slotId]
                                ? 'bg-yellow-600 text-white'
                                : 'bg-zinc-800 text-zinc-400 opacity-0 group-hover:opacity-100'
                              }
                            `}
                          >
                            <Bell className="w-3 h-3" />
                          </button>
                        )}
                        
                        {/* Progress bar for current slot */}
                        {isCurrentSlot && (
                          <div className="mt-2">
                            <Progress value={getSlotProgress(slot)} className="h-1" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <h4 className="text-sm font-semibold mb-3">Legend</h4>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-600 rounded" />
              <span className="text-zinc-400">Now Playing</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs py-0 px-1 border-purple-700 text-purple-400">
                <User className="w-2 h-2 mr-1" />
                Creator
              </Badge>
              <span className="text-zinc-400">Creator Content</span>
            </div>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-yellow-500" />
              <span className="text-zinc-400">Reminder Set</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-zinc-700 rounded opacity-50" />
              <span className="text-zinc-400">Past Shows</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-zinc-500 mb-4">Want your content featured on ZTVLIVE?</p>
          <Link to="/schedule-slot">
            <Button variant="outline" className="border-red-700 text-red-400 hover:bg-red-900/20">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Your Slot
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TVGuidePage;
