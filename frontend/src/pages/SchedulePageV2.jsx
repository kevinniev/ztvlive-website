import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Radio, Clock, Play, Calendar, ChevronRight, Eye, X, Tv,
  Film, Music, Newspaper, Gamepad2, Zap, Trophy, Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";

const API = '/api';

const CATEGORY_CONFIG = {
  sports: { color: "#f97316", icon: Trophy, label: "Sports" },
  music: { color: "#d946ef", icon: Music, label: "Music" },
  movies: { color: "#ec4899", icon: Film, label: "Movies" },
  buzz: { color: "#ef4444", icon: Zap, label: "Viral & Trending" },
  news: { color: "#eab308", icon: Newspaper, label: "News" },
  gaming: { color: "#22c55e", icon: Gamepad2, label: "Gaming" },
  tech: { color: "#06b6d4", icon: Cpu, label: "Tech" }
};

export default function SchedulePage() {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getUTCHours());
  const [serverTime, setServerTime] = useState(null);
  const [ticker, setTicker] = useState([]);
  
  // Preview modal
  const [previewSlot, setPreviewSlot] = useState(null);
  
  // Category filter
  const [selectedCategory, setSelectedCategory] = useState(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, tickerRes] = await Promise.all([
        axios.get(`${API}/schedule/v2`),
        axios.get(`${API}/news/ticker`)
      ]);
      
      setSchedule(schedRes.data.schedule || []);
      setCurrentHour(schedRes.data.current_hour || new Date().getUTCHours());
      setServerTime(schedRes.data.server_time);
      setTicker(tickerRes.data.headlines || []);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      // Fallback to basic schedule
      generateFallbackSchedule();
    } finally {
      setLoading(false);
    }
  }, []);

  const generateFallbackSchedule = () => {
    const now = new Date();
    const fallback = [];
    for (let i = 0; i < 24; i++) {
      fallback.push({
        id: `slot_${i}`,
        slot_index: i,
        start_time: `${i.toString().padStart(2, '0')}:00`,
        end_time: `${((i + 1) % 24).toString().padStart(2, '0')}:00`,
        scheduled_category: ["sports", "music", "movies", "buzz", "news", "gaming", "tech"][i % 7],
        content: {
          title: "Loading content...",
          thumbnail: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400",
          duration: "30:00"
        },
        is_current: i === now.getUTCHours()
      });
    }
    setSchedule(fallback);
  };

  useEffect(() => {
    fetchSchedule();
    const interval = setInterval(fetchSchedule, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchSchedule]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().getUTCHours());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const openPreview = (slot) => {
    setPreviewSlot(slot);
  };

  const closePreview = () => {
    setPreviewSlot(null);
  };

  const filteredSchedule = selectedCategory 
    ? schedule.filter(s => s.scheduled_category === selectedCategory)
    : schedule;

  const formatTimeUntil = (slotIndex) => {
    const diff = slotIndex - currentHour;
    if (diff <= 0) return "Now";
    if (diff === 1) return "Up Next";
    return `In ${diff}h`;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Navigation />

      {/* Breaking News Ticker */}
      {ticker.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-red-600 text-white py-2 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap flex items-center">
            <span className="mx-4 font-bold">BREAKING:</span>
            {ticker.map((item, i) => (
              <span key={i} className="mx-8">
                {item.headline} <span className="opacity-70">• {item.source}</span>
              </span>
            ))}
            {/* Duplicate for seamless loop */}
            {ticker.map((item, i) => (
              <span key={`dup-${i}`} className="mx-8">
                {item.headline} <span className="opacity-70">• {item.source}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="pt-24 pb-24">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-8 h-8 text-red-500" />
              <h1 className="font-bold text-3xl md:text-4xl tracking-tight" data-testid="schedule-title">
                24/7 PROGRAMMING
              </h1>
            </div>
            <p className="text-zinc-400">
              AI-curated content streaming around the clock. Movies, Sports, Music, News & More.
            </p>
            {serverTime && (
              <div className="mt-2 text-sm text-zinc-500">
                Server Time: {new Date(serverTime).toLocaleTimeString()} UTC
              </div>
            )}
          </motion.div>

          {/* Category Filter */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className={selectedCategory === null ? "bg-red-600 hover:bg-red-500" : "border-zinc-700"}
                data-testid="filter-all"
              >
                All
              </Button>
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <Button
                    key={key}
                    variant={selectedCategory === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(key)}
                    className={selectedCategory === key ? "" : "border-zinc-700 hover:border-zinc-600"}
                    style={selectedCategory === key ? { backgroundColor: config.color } : {}}
                    data-testid={`filter-${key}`}
                  >
                    <Icon className="w-4 h-4 mr-1" />
                    {config.label}
                  </Button>
                );
              })}
            </div>
          </motion.div>

          {/* Schedule Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="bg-zinc-900 rounded-lg overflow-hidden animate-pulse">
                  <div className="aspect-video bg-zinc-800" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-zinc-800 rounded w-3/4" />
                    <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {filteredSchedule.map((slot, i) => {
                const catConfig = CATEGORY_CONFIG[slot.scheduled_category] || CATEGORY_CONFIG.buzz;
                const Icon = catConfig.icon;
                
                return (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`bg-zinc-900 border rounded-lg overflow-hidden cursor-pointer group transition-all hover:border-red-500/50 ${
                      slot.is_current 
                        ? 'border-red-500 ring-2 ring-red-500/30' 
                        : 'border-zinc-800'
                    }`}
                    onClick={() => openPreview(slot)}
                    data-testid={`schedule-slot-${slot.id}`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video overflow-hidden">
                      <img 
                        src={slot.content?.thumbnail || "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400"} 
                        alt={slot.content?.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400";
                        }}
                      />
                      
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center">
                          <Play className="w-7 h-7 text-white ml-1" />
                        </div>
                      </div>
                      
                      {/* Time Badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-2">
                        <Badge className="bg-black/70 text-white font-mono">
                          {slot.start_time}
                        </Badge>
                        {slot.is_current && (
                          <Badge className="bg-red-600 text-white animate-pulse">
                            LIVE NOW
                          </Badge>
                        )}
                      </div>
                      
                      {/* Duration */}
                      {slot.content?.duration && (
                        <Badge className="absolute bottom-2 right-2 bg-black/70">
                          {slot.content.duration}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Content Info */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge 
                          style={{ backgroundColor: catConfig.color }}
                          className="text-white text-xs"
                        >
                          <Icon className="w-3 h-3 mr-1" />
                          {catConfig.label}
                        </Badge>
                        <span className="text-xs text-zinc-500">
                          {formatTimeUntil(slot.slot_index)}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-red-400 transition-colors">
                        {slot.content?.title || "Content Loading..."}
                      </h3>
                      
                      <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                        <Clock className="w-3 h-3" />
                        <span>{slot.start_time} - {slot.end_time} UTC</span>
                        {slot.content?.source && (
                          <>
                            <span>•</span>
                            <span>{slot.content.source}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Watch Now CTA */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12 text-center"
          >
            <Link to="/watch">
              <Button size="lg" className="bg-red-600 hover:bg-red-500" data-testid="watch-now-cta">
                <Tv className="w-5 h-5 mr-2" />
                Watch Live Now
              </Button>
            </Link>
          </motion.div>
        </div>
      </main>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={closePreview}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const catConfig = CATEGORY_CONFIG[previewSlot.scheduled_category] || CATEGORY_CONFIG.buzz;
                    const Icon = catConfig.icon;
                    return (
                      <Badge style={{ backgroundColor: catConfig.color }} className="text-white">
                        <Icon className="w-3 h-3 mr-1" />
                        {catConfig.label}
                      </Badge>
                    );
                  })()}
                  <span className="text-zinc-400 text-sm">
                    {previewSlot.start_time} - {previewSlot.end_time} UTC
                  </span>
                  {previewSlot.is_current && (
                    <Badge className="bg-red-600 text-white animate-pulse">NOW PLAYING</Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={closePreview} data-testid="close-preview">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Video Preview */}
              <div className="aspect-video bg-black">
                {previewSlot.content?.video_url?.includes('youtube.com') || previewSlot.content?.video_url?.includes('youtu.be') ? (
                  <iframe
                    src={`${previewSlot.content.video_url}?autoplay=0&rel=0&modestbranding=1`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={previewSlot.content?.title}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <img 
                      src={previewSlot.content?.thumbnail}
                      alt={previewSlot.content?.title}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Content Details */}
              <div className="p-6">
                <h2 className="font-bold text-xl mb-2">
                  {previewSlot.content?.title}
                </h2>
                
                <div className="flex items-center gap-4 text-sm text-zinc-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {previewSlot.content?.duration}
                  </span>
                  {previewSlot.content?.source && (
                    <span>{previewSlot.content.source}</span>
                  )}
                  {previewSlot.content?.views && (
                    <span>{(previewSlot.content.views / 1000000).toFixed(1)}M views</span>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={closePreview} className="border-zinc-700">
                    Close
                  </Button>
                  
                  <Link to="/watch" onClick={closePreview}>
                    <Button className="bg-red-600 hover:bg-red-500" data-testid="modal-watch-btn">
                      <Play className="w-4 h-4 mr-2" />
                      {previewSlot.is_current ? "Watch Live" : "Watch Now"}
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-800">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-red-500" />
              <span className="font-bold text-xl tracking-wider">ZTVLIVE</span>
            </div>
            <p className="text-zinc-500 text-sm">
              24/7 AI-Curated Entertainment - Always Something Worth Watching
            </p>
          </div>
        </div>
      </footer>

      {/* Marquee Animation CSS */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
