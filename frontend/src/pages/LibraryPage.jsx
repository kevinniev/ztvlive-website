import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { 
  Tv, Search, Menu, X, Play, Clock, Eye, Heart, Send,
  Film, Trophy, Mic, Music, Cpu, Gamepad2, Newspaper, Sparkles,
  Filter, Grid3X3, LayoutList, TrendingUp, RefreshCw, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import AdUnit, { InFeedAd } from "@/components/AdUnit";

const API = '/api';
const WS_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : '';

// Format large numbers (e.g., 1.2M, 850K)
const formatViews = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
  return num?.toString() || '0';
};

const CATEGORY_ICONS = {
  sports: Trophy,
  podcast: Mic,
  music: Music,
  film: Film,
  tech: Cpu,
  gaming: Gamepad2,
  news: Newspaper,
  culture: Sparkles,
  other: Film,
};

const CATEGORY_COLORS = {
  sports: "#f97316",
  podcast: "#8b5cf6",
  music: "#d946ef",
  film: "#ec4899",
  tech: "#06b6d4",
  gaming: "#22c55e",
  news: "#eab308",
  culture: "#f43f5e",
  other: "#71717a",
};

export default function LibraryPage() {
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [likedVideos, setLikedVideos] = useState(new Set());
  const [newContentAvailable, setNewContentAvailable] = useState(false);
  const wsRef = useRef(null);

  // WebSocket for real-time content updates
  useEffect(() => {
    if (!WS_URL) return;
    
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`${WS_URL}/ws/content/${selectedCategory}`);
        wsRef.current = ws;
        
        ws.onopen = () => {
          console.log("Connected to content updates");
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === "new_content") {
            setNewContentAvailable(true);
            toast.info(`New ${data.category} content available!`, {
              action: {
                label: "Refresh",
                onClick: () => fetchVideos(),
              },
            });
          }
        };
        
        ws.onclose = () => {
          // Reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };
      } catch (e) {
        console.error("WebSocket error:", e);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedCategory]);

  const handleLike = async (videoId) => {
    if (likedVideos.has(videoId)) return;
    
    try {
      await axios.post(`${API}/highlights/${videoId}/like`);
      setLikedVideos(prev => new Set([...prev, videoId]));
      
      // Update local state
      setVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, likes: (v.likes || 0) + 1 } : v
      ));
      
      toast.success("Liked!");
    } catch (error) {
      console.error("Error liking video:", error);
    }
  };

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setNewContentAvailable(false);
    try {
      // Get combined content from all sources (real-time, AI, curated)
      const params = selectedCategory !== "all" ? `?category=${selectedCategory}&limit=30` : "?limit=30";
      const res = await axios.get(`${API}/content/all${params}`);
      
      if (res.data.content.length > 0) {
        setVideos(res.data.content);
      } else {
        // Fallback to highlights
        const highlightsRes = await axios.get(`${API}/highlights${params}`);
        setVideos(highlightsRes.data.highlights);
      }
    } catch (error) {
      console.error("Error fetching videos:", error);
      // Fallback
      try {
        const fallback = await axios.get(`${API}/highlights?limit=20`);
        setVideos(fallback.data.highlights);
      } catch (e) {
        console.error("Fallback failed:", e);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/categories`);
      setCategories(res.data.categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchVideos();
    // Auto-refresh every 5 minutes
    const refreshInterval = setInterval(fetchVideos, 5 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [fetchVideos]);

  const filteredVideos = videos.filter(v => {
    const title = v.title || v.topic || "";
    const description = v.description || v.summary || "";
    return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           description.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Shared Navigation */}
      <Navigation />

      {/* Main Content */}
      <main className="pt-8 pb-16">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-start justify-between">
              <div>
                <Badge className="bg-red-600/20 text-red-400 border border-red-600/30 mb-2">
                  VIDEO ARCHIVE
                </Badge>
                <h1 className="font-heading text-4xl md:text-5xl tracking-tight uppercase mb-2" data-testid="page-title">
                  VIDEO LIBRARY
                </h1>
                <p className="text-zinc-400">
                  All our content in one place. Same videos that play on Roku, Fire TV, Samsung & LG.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {newContentAvailable && (
                  <Badge className="bg-green-600 animate-pulse">
                    <Zap className="w-3 h-3 mr-1" />
                    New Content
                  </Badge>
                )}
                <Button 
                  onClick={fetchVideos} 
                  variant="outline" 
                  size="sm"
                  className="border-zinc-700"
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input 
                  placeholder="Search videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-zinc-900 border-zinc-800 focus:border-red-500"
                  data-testid="search-input"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-2">
                <Button 
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={viewMode === "grid" ? "bg-red-600" : ""}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button 
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={viewMode === "list" ? "bg-red-600" : ""}
                >
                  <LayoutList className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className={selectedCategory === "all" 
                  ? "bg-red-600 hover:bg-red-500 border-0" 
                  : "border-zinc-700 hover:border-red-500"
                }
              >
                <Filter className="w-4 h-4 mr-1" />
                All
              </Button>
              {categories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id] || Sparkles;
                return (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={selectedCategory === cat.id 
                      ? "border-0" 
                      : "border-zinc-700 hover:border-red-500"
                    }
                    style={selectedCategory === cat.id ? { backgroundColor: cat.color } : {}}
                  >
                    <Icon className="w-4 h-4 mr-1" />
                    {cat.name}
                  </Button>
                );
              })}
            </div>
          </motion.div>

          {/* Results Count */}
          <div className="mb-4 text-sm text-zinc-500">
            {filteredVideos.length} videos available
          </div>

          {/* Video Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-zinc-900 rounded-lg overflow-hidden animate-pulse">
                  <div className="aspect-video bg-zinc-800" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-zinc-800 rounded w-3/4" />
                    <div className="h-3 bg-zinc-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === "grid" ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {filteredVideos.map((video, i) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link 
                    to={`/video/${video.id}`}
                    className="block group"
                    data-testid={`video-card-${video.id}`}
                  >
                    <div className="relative rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-red-500/50 transition-colors">
                      <div className="aspect-video relative">
                        <img 
                          src={video.thumbnail} 
                          alt={video.title || video.topic}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        
                        {/* Play overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-14 h-14 bg-red-600/90 rounded-full flex items-center justify-center">
                            <Play className="w-7 h-7 ml-1" />
                          </div>
                        </div>
                        
                        {video.is_breaking && (
                          <Badge className="absolute top-2 right-2 bg-red-600 text-white text-xs animate-pulse">
                            BREAKING
                          </Badge>
                        )}
                        
                        <Badge 
                          className="absolute top-2 left-2 text-white text-xs"
                          style={{ backgroundColor: CATEGORY_COLORS[video.category] || '#8b5cf6' }}
                        >
                          {video.category?.toUpperCase() || 'TRENDING'}
                        </Badge>
                        <div className="absolute bottom-2 right-2 text-xs bg-black/80 px-2 py-1 rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {video.duration || '5:00'}
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-heading text-lg line-clamp-2 group-hover:text-red-400 transition-colors">
                          {video.title || video.topic}
                        </h3>
                        <p className="text-zinc-500 text-xs mt-1 line-clamp-1">
                          {video.source || 'AI Generated'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                          <span className="flex items-center gap-1 text-green-400 font-semibold">
                            <Eye className="w-3 h-3" />
                            {formatViews(video.views)} views
                          </span>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleLike(video.id);
                            }}
                            className={`flex items-center gap-1 transition-colors ${
                              likedVideos.has(video.id) 
                                ? 'text-red-500' 
                                : 'text-red-400 hover:text-red-300'
                            }`}
                            disabled={likedVideos.has(video.id)}
                          >
                            <Heart className={`w-3 h-3 ${likedVideos.has(video.id) ? 'fill-current' : ''}`} />
                            {formatViews(video.likes)}
                          </button>
                          {video.trending_score > 95 && (
                            <span className="flex items-center gap-1 text-amber-400">
                              <TrendingUp className="w-3 h-3" />
                              HOT
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
              
              {/* In-Feed Ad after every 8 videos */}
              {filteredVideos.length > 8 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-4"
                >
                  <AdUnit 
                    slot="6142838415" 
                    format="horizontal"
                    className="min-h-[90px] bg-zinc-900/30 rounded-lg"
                  />
                </motion.div>
              )}
            </motion.div>
          ) : (
            /* List View */
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {filteredVideos.map((video, i) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link 
                    to={`/video/${video.id}`}
                    className="block group"
                  >
                    <div className="flex gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-red-500/50 transition-colors">
                      <div className="w-48 h-28 flex-shrink-0 rounded overflow-hidden relative">
                        <img 
                          src={video.thumbnail} 
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute bottom-1 right-1 text-xs bg-black/80 px-1.5 py-0.5 rounded">
                          {video.duration}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Badge 
                          className="text-white text-xs mb-2"
                          style={{ backgroundColor: CATEGORY_COLORS[video.category] || '#8b5cf6' }}
                        >
                          {video.category?.toUpperCase()}
                        </Badge>
                        <h3 className="font-heading text-xl group-hover:text-red-400 transition-colors">
                          {video.title}
                        </h3>
                        <p className="text-zinc-400 text-sm mt-1 line-clamp-2">
                          {video.description}
                        </p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                          <span className="text-green-400 font-semibold">{formatViews(video.views)} views</span>
                          <span className="text-red-400">{formatViews(video.likes)} likes</span>
                          <span>{video.source}</span>
                          {video.trending_score > 95 && (
                            <Badge className="bg-amber-600 text-xs">🔥 TRENDING</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}

          {filteredVideos.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Film className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="font-heading text-2xl mb-2">NO VIDEOS FOUND</h3>
              <p className="text-zinc-500 mb-4">No content matches your search</p>
              <Link to="/submit">
                <Button className="bg-red-600 hover:bg-red-500">
                  <Send className="w-4 h-4 mr-2" />
                  Submit Content
                </Button>
              </Link>
            </div>
          )}

          {/* Info Box */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 p-6 bg-zinc-900 border border-zinc-800 rounded-lg"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-600/20 rounded flex items-center justify-center flex-shrink-0">
                <Tv className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-heading text-xl tracking-wider mb-2">SAME CONTENT EVERYWHERE</h3>
                <p className="text-zinc-400 leading-relaxed">
                  All videos in this library are the same content that plays on our Roku, Fire TV, Samsung, and LG channels. 
                  When we're not live streaming, these videos automatically rotate on all platforms. 
                  Watch here, or tune in on your TV!
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-800">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Tv className="w-5 h-5 text-red-400" />
            <span className="font-heading text-xl tracking-wider">ZTV LIVE</span>
          </div>
          <p className="text-zinc-500 text-sm">
            Same content on Roku, Fire TV, Samsung, LG, and Web • 24/7 Streaming
          </p>
        </div>
      </footer>
    </div>
  );
}
