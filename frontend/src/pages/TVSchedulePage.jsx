import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Radio, Clock, Play, Calendar, ChevronRight, Eye, X, Tv, Pause,
  Film, Music, Newspaper, Gamepad2, Zap, Trophy, Cpu, BookOpen,
  Mountain, Globe, Pin, PinOff, Library, SkipForward, Volume2, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import CleanYouTubePlayer, { getYouTubeVideoId } from "@/components/CleanYouTubePlayer";
import AdUnit from "@/components/AdUnit";

const API = '/api';

const CATEGORY_CONFIG = {
  music: { color: "#d946ef", icon: Music, label: "Music" },
  movies: { color: "#ec4899", icon: Film, label: "Movies" },
  documentary: { color: "#8b5cf6", icon: BookOpen, label: "Documentary" },
  educational: { color: "#06b6d4", icon: BookOpen, label: "Educational" },
  sports: { color: "#f97316", icon: Trophy, label: "Sports" },
  entertainment: { color: "#ef4444", icon: Zap, label: "Entertainment" },
  news: { color: "#eab308", icon: Newspaper, label: "News" },
  nature: { color: "#22c55e", icon: Mountain, label: "Nature" },
  tech: { color: "#3b82f6", icon: Cpu, label: "Tech" },
  culture: { color: "#f59e0b", icon: Globe, label: "Culture" }
};

export default function SchedulePage() {
  const [schedule, setSchedule] = useState([]);
  const [currentPlaying, setCurrentPlaying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState(null);
  const [ticker, setTicker] = useState([]);
  const [library, setLibrary] = useState(null);
  const [pinnedContent, setPinnedContent] = useState([]);
  
  // Preview modal
  const [previewSlot, setPreviewSlot] = useState(null);
  
  // Category filter
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // View mode
  const [viewMode, setViewMode] = useState("schedule"); // schedule | library
  
  // Sync info update interval
  const syncIntervalRef = useRef(null);

  const fetchSchedule = useCallback(async () => {
    try {
      const [schedRes, syncRes, tickerRes] = await Promise.all([
        axios.get(`${API}/tv/schedule?hours=24`),
        axios.get(`${API}/tv/now-playing`),
        axios.get(`${API}/news/ticker`)
      ]);
      
      setSchedule(schedRes.data.schedule || []);
      setCurrentPlaying(syncRes.data);
      setServerTime(schedRes.data.server_time);
      setTicker(tickerRes.data.headlines || []);
    } catch (error) {
      console.error("Error fetching schedule:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLibrary = useCallback(async () => {
    try {
      const [libRes, pinnedRes] = await Promise.all([
        axios.get(`${API}/tv/library`),
        axios.get(`${API}/tv/pinned`)
      ]);
      setLibrary(libRes.data);
      setPinnedContent(pinnedRes.data.pinned || []);
    } catch (error) {
      console.error("Error fetching library:", error);
    }
  }, []);

  const pinContent = async (contentId) => {
    try {
      await axios.post(`${API}/tv/pin/${contentId}`);
      await fetchLibrary();
      await fetchSchedule();
    } catch (error) {
      console.error("Error pinning content:", error);
    }
  };

  const unpinContent = async (contentId) => {
    try {
      await axios.delete(`${API}/tv/pin/${contentId}`);
      await fetchLibrary();
      await fetchSchedule();
    } catch (error) {
      console.error("Error unpinning content:", error);
    }
  };

  useEffect(() => {
    fetchSchedule();
    fetchLibrary();
    
    // Refresh schedule every 30 seconds
    const scheduleInterval = setInterval(fetchSchedule, 30000);
    
    // Update sync info more frequently
    syncIntervalRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/tv/now-playing`);
        setCurrentPlaying(res.data);
      } catch (e) {
        // Ignore errors for sync updates
      }
    }, 5000);
    
    return () => {
      clearInterval(scheduleInterval);
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [fetchSchedule, fetchLibrary]);

  const openPreview = (slot) => {
    setPreviewSlot(slot);
  };

  const closePreview = () => {
    setPreviewSlot(null);
  };

  const filteredSchedule = selectedCategory 
    ? schedule.filter(s => s.category === selectedCategory)
    : schedule;

  const formatTimeUntil = (startTime) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = start - now;
    
    if (diffMs <= 0) return "Now";
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `In ${diffMins}m`;
    
    const diffHours = Math.floor(diffMins / 60);
    return `In ${diffHours}h ${diffMins % 60}m`;
  };

  const isPinned = (contentId) => {
    return pinnedContent.some(p => p.id === contentId);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Navigation />

      {/* Now Playing Bar */}
      {currentPlaying && currentPlaying.current_content && (
        <div className="fixed top-16 left-0 right-0 z-30 bg-gradient-to-r from-red-600/90 to-red-700/90 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-medium">NOW PLAYING:</span>
              <span className="text-sm truncate max-w-[200px] md:max-w-md">
                {currentPlaying.current_content.title}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="w-32 h-1.5 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-1000"
                  style={{ width: `${currentPlaying.progress_percent}%` }}
                />
              </div>
              <Link to="/watch?unmute=true">
                <Button size="sm" variant="secondary" className="bg-white text-red-600 hover:bg-gray-100">
                  <Play className="w-3 h-3 mr-1" /> Watch Live
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

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
            {ticker.map((item, i) => (
              <span key={`dup-${i}`} className="mx-8">
                {item.headline} <span className="opacity-70">• {item.source}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="pt-32 pb-24">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Tv className="w-8 h-8 text-red-500" />
                  <h1 className="font-bold text-3xl md:text-4xl tracking-tight" data-testid="schedule-title">
                    24/7 TV SCHEDULE
                  </h1>
                </div>
                <p className="text-zinc-400">
                  Continuous programming • Content plays back-to-back based on duration
                </p>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex items-center gap-2 bg-zinc-800 rounded-lg p-1">
                <Button 
                  variant={viewMode === "schedule" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("schedule")}
                  className={viewMode === "schedule" ? "bg-red-600" : ""}
                >
                  <Calendar className="w-4 h-4 mr-1" /> Schedule
                </Button>
                <Button 
                  variant={viewMode === "library" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("library")}
                  className={viewMode === "library" ? "bg-red-600" : ""}
                >
                  <Library className="w-4 h-4 mr-1" /> Library
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Pinned Content Section */}
          {pinnedContent.length > 0 && viewMode === "schedule" && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-zinc-900/50 border border-amber-500/30 rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Pin className="w-5 h-5 text-amber-500" />
                <h2 className="font-semibold text-amber-500">Pinned Content (Priority Queue)</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {pinnedContent.map((content, i) => (
                  <div key={content.id} className="flex items-center gap-2 bg-zinc-800 rounded-full px-3 py-1.5">
                    <span className="text-amber-500 font-bold text-xs">#{i + 1}</span>
                    <span className="text-sm truncate max-w-[150px]">{content.title}</span>
                    <button 
                      onClick={() => unpinContent(content.id)}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

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

          {/* Content View */}
          {viewMode === "schedule" ? (
            /* Schedule Grid */
            loading ? (
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
                className="space-y-2"
              >
                {/* Timeline View */}
                {filteredSchedule.map((slot, i) => {
                  const catConfig = CATEGORY_CONFIG[slot.category] || CATEGORY_CONFIG.entertainment;
                  const Icon = catConfig.icon;
                  const content = slot.content;
                  const pinned = isPinned(content?.id);
                  
                  return (
                    <motion.div
                      key={slot.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className={`flex items-stretch bg-zinc-900 border rounded-lg overflow-hidden cursor-pointer group transition-all hover:border-red-500/50 ${
                        slot.is_current 
                          ? 'border-red-500 ring-2 ring-red-500/30' 
                          : slot.is_pinned
                          ? 'border-amber-500/50'
                          : 'border-zinc-800'
                      }`}
                      onClick={() => openPreview(slot)}
                      data-testid={`schedule-slot-${slot.id}`}
                    >
                      {/* Thumbnail - make it larger */}
                      <div className="w-48 flex-shrink-0 relative">
                        <img 
                          src={content?.thumbnail || "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400"} 
                          alt={content?.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-8 h-8 text-white" />
                        </div>
                        {slot.is_current && (
                          <Badge className="absolute top-2 left-2 bg-red-600 text-white text-[10px]">LIVE</Badge>
                        )}
                        {slot.is_pinned && (
                          <Pin className="absolute top-2 right-2 w-4 h-4 text-amber-500" />
                        )}
                        {/* Duration badge */}
                        <Badge className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px]">
                          {slot.duration_display}
                        </Badge>
                      </div>
                      
                      {/* Content Info */}
                      <div className="flex-1 p-4 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            style={{ backgroundColor: catConfig.color }}
                            className="text-white text-xs"
                          >
                            <Icon className="w-3 h-3 mr-1" />
                            {catConfig.label}
                          </Badge>
                          {slot.is_current && (
                            <Badge className="bg-red-600 text-white text-xs animate-pulse">
                              Now Playing
                            </Badge>
                          )}
                          {slot.is_upcoming && !slot.is_current && (
                            <Badge variant="outline" className="border-green-500 text-green-500 text-xs">
                              Up Next
                            </Badge>
                          )}
                        </div>
                        
                        <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-red-400 transition-colors">
                          {content?.title || "Content Loading..."}
                        </h3>
                        
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                          <span>{content?.source}</span>
                          <span>•</span>
                          <span>{slot.duration_display}</span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 pr-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            pinned ? unpinContent(content?.id) : pinContent(content?.id);
                          }}
                        >
                          {pinned ? (
                            <PinOff className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Pin className="w-4 h-4 text-zinc-400 hover:text-amber-500" />
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )
          ) : (
            /* Library View */
            <div className="space-y-8">
              {/* Ad Unit - Top of Library */}
              <div className="mb-6">
                <AdUnit 
                  slot="7443836437" 
                  format="horizontal"
                  className="min-h-[90px] bg-zinc-900/30 rounded-lg"
                />
              </div>
              
              {library && Object.entries(library.categories).map(([category, contents]) => {
                const catConfig = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.entertainment;
                const Icon = catConfig.icon;
                
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-4">
                      <Badge style={{ backgroundColor: catConfig.color }} className="text-white">
                        <Icon className="w-4 h-4 mr-1" />
                        {catConfig.label}
                      </Badge>
                      <span className="text-zinc-500 text-sm">{contents.length} items</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {contents.map((content) => {
                        const pinned = isPinned(content.id);
                        
                        return (
                          <div 
                            key={content.id}
                            className={`bg-zinc-900 border rounded-lg overflow-hidden group cursor-pointer transition-all hover:border-red-500/50 ${
                              pinned ? 'border-amber-500' : 'border-zinc-800'
                            }`}
                            onClick={() => setPreviewSlot({ content, category })}
                          >
                            <div className="relative aspect-video">
                              <img 
                                src={content.thumbnail} 
                                alt={content.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                onError={(e) => {
                                  e.target.src = "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400";
                                }}
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Play className="w-10 h-10 text-white" />
                              </div>
                              <Badge className="absolute bottom-2 right-2 bg-black/70">
                                {content.duration}
                              </Badge>
                              {pinned && (
                                <Pin className="absolute top-2 right-2 w-5 h-5 text-amber-500" />
                              )}
                            </div>
                            
                            <div className="p-3">
                              <h3 className="font-medium text-sm line-clamp-2 group-hover:text-red-400">
                                {content.title}
                              </h3>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-zinc-500">{content.source}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    pinned ? unpinContent(content.id) : pinContent(content.id);
                                  }}
                                >
                                  {pinned ? (
                                    <><PinOff className="w-3 h-3 mr-1" /> Unpin</>
                                  ) : (
                                    <><Pin className="w-3 h-3 mr-1" /> Pin</>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              {library && (
                <div className="text-center text-zinc-500 text-sm pt-4 border-t border-zinc-800">
                  Total: {library.total_content} items • {library.total_duration_hours.toFixed(1)} hours of content
                </div>
              )}
            </div>
          )}

          {/* Watch Now CTA */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12 text-center"
          >
            <Link to="/watch?unmute=true">
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
                    const cat = previewSlot.category || previewSlot.content?.category;
                    const catConfig = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.entertainment;
                    const Icon = catConfig.icon;
                    return (
                      <Badge style={{ backgroundColor: catConfig.color }} className="text-white">
                        <Icon className="w-3 h-3 mr-1" />
                        {catConfig.label}
                      </Badge>
                    );
                  })()}
                  <span className="text-zinc-400 text-sm">
                    {previewSlot.duration_display}
                  </span>
                  {previewSlot.is_current && (
                    <Badge className="bg-red-600 text-white animate-pulse">NOW PLAYING</Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={closePreview} data-testid="close-preview">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Video Preview - Clean Player, No YouTube Graphics */}
              <div className="aspect-video bg-black">
                {(() => {
                  const videoUrl = previewSlot.content?.video_url;
                  const videoId = getYouTubeVideoId(videoUrl);
                  
                  if (videoId) {
                    return (
                      <CleanYouTubePlayer
                        videoId={videoId}
                        autoUnmute={false}
                        showDVRControls={true}
                        showProgress={true}
                        title={previewSlot.content?.title}
                      />
                    );
                  }
                  
                  // Fallback for non-YouTube content
                  return (
                    <div className="w-full h-full flex items-center justify-center">
                      <img 
                        src={previewSlot.content?.thumbnail}
                        alt={previewSlot.content?.title}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  );
                })()}
              </div>

              {/* Content Details */}
              <div className="p-6">
                <h2 className="font-bold text-xl mb-2">
                  {previewSlot.content?.title}
                </h2>
                
                <div className="flex items-center gap-4 text-sm text-zinc-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {previewSlot.content?.duration || previewSlot.duration_display}
                  </span>
                  {previewSlot.content?.source && (
                    <span>{previewSlot.content.source}</span>
                  )}
                  {previewSlot.content?.source_type && (
                    <Badge variant="outline" className="text-xs">
                      {previewSlot.content.source_type}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={closePreview} className="border-zinc-700">
                      Close
                    </Button>
                    <Button
                      variant="outline"
                      className={isPinned(previewSlot.content?.id) ? "border-amber-500 text-amber-500" : "border-zinc-700"}
                      onClick={() => {
                        isPinned(previewSlot.content?.id) 
                          ? unpinContent(previewSlot.content?.id)
                          : pinContent(previewSlot.content?.id);
                      }}
                    >
                      {isPinned(previewSlot.content?.id) ? (
                        <><PinOff className="w-4 h-4 mr-2" /> Unpin</>
                      ) : (
                        <><Pin className="w-4 h-4 mr-2" /> Pin to Queue</>
                      )}
                    </Button>
                  </div>
                  
                  <Link to="/watch?unmute=true" onClick={closePreview}>
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
              24/7 Continuous Programming - Content plays back-to-back
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
