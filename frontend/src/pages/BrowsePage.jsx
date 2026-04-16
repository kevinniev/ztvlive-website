import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv, Play, Heart, MessageCircle, Share2, Eye, Clock,
  Filter, Search, ChevronRight, User, Loader2, X,
  Music, Trophy, Gamepad2, Laugh, Mic, Newspaper,
  GraduationCap, Sparkles, Cpu, Folder, Film, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

const API = '/api';

// Category icons mapping
const CATEGORY_ICONS = {
  music: Music,
  sports: Trophy,
  gaming: Gamepad2,
  comedy: Laugh,
  podcast: Mic,
  news: Newspaper,
  education: GraduationCap,
  entertainment: Sparkles,
  lifestyle: Heart,
  tech: Cpu,
  other: Folder
};

// Video Card Component
function VideoCard({ video, onLike, onComment, currentUserId }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [loadingComments, setLoadingComments] = useState(false);
  const navigate = useNavigate();

  // Check like status on mount
  useEffect(() => {
    if (currentUserId) {
      checkLikeStatus();
    }
  }, [currentUserId, video.id]);

  const checkLikeStatus = async () => {
    try {
      const response = await axios.get(
        `${API}/creator-videos/video/${video.id}/like-status?user_id=${currentUserId}`
      );
      setIsLiked(response.data.is_liked);
      setLikeCount(response.data.total_likes);
    } catch (error) {
      console.log("Could not check like status");
    }
  };

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error("Please log in to like videos");
      navigate(`/login?redirect=${encodeURIComponent('/browse')}`);
      return;
    }

    try {
      const response = await axios.post(
        `${API}/creator-videos/video/${video.id}/like?user_id=${currentUserId}`
      );
      setIsLiked(response.data.status === "liked");
      setLikeCount(response.data.likes);
    } catch (error) {
      toast.error("Failed to like video");
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const response = await axios.get(
        `${API}/creator-videos/video/${video.id}/comments`
      );
      setComments(response.data);
    } catch (error) {
      console.log("Could not load comments");
    } finally {
      setLoadingComments(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!currentUserId) {
      toast.error("Please log in to comment");
      navigate(`/login?redirect=${encodeURIComponent('/browse')}`);
      return;
    }

    if (!newComment.trim()) return;

    try {
      const user = JSON.parse(localStorage.getItem("ztvlive_user") || "{}");
      await axios.post(
        `${API}/creator-videos/video/${video.id}/comment?user_id=${currentUserId}&user_name=${encodeURIComponent(user.name || "Anonymous")}`,
        { content: newComment }
      );
      setNewComment("");
      loadComments();
      toast.success("Comment added!");
    } catch (error) {
      toast.error("Failed to add comment");
    }
  };

  const toggleComments = () => {
    if (!showComments && comments.length === 0) {
      loadComments();
    }
    setShowComments(!showComments);
  };

  const CategoryIcon = CATEGORY_ICONS[video.category] || Folder;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all"
    >
      {/* Thumbnail */}
      <Link to={`/watch?v=${video.id}`} className="block relative aspect-video group">
        <img
          src={video.thumbnail_url || `https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800`}
          alt={video.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </div>
        {/* Duration badge */}
        {video.duration_seconds && (
          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')}
          </div>
        )}
        {/* Category badge */}
        <div className="absolute top-2 left-2">
          <Badge 
            className="flex items-center gap-1 text-xs"
            style={{ backgroundColor: `${getCategoryColor(video.category)}20`, color: getCategoryColor(video.category), borderColor: getCategoryColor(video.category) }}
          >
            <CategoryIcon className="w-3 h-3" />
            {video.category}
          </Badge>
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        {/* Creator info */}
        <div className="flex items-center gap-3 mb-3">
          <img
            src={video.creator_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(video.creator_name)}&background=dc2626&color=fff`}
            alt={video.creator_name}
            className="w-8 h-8 rounded-full"
          />
          <div className="flex-1 min-w-0">
            <Link 
              to={`/creator/${video.creator_id}`}
              className="text-gray-300 text-sm hover:text-white font-medium truncate block"
            >
              {video.creator_name}
            </Link>
          </div>
        </div>

        {/* Title */}
        <Link to={`/watch?v=${video.id}`}>
          <h3 className="text-white font-semibold mb-2 line-clamp-2 hover:text-red-400 transition-colors">
            {video.title}
          </h3>
        </Link>

        {/* Stats */}
        <div className="flex items-center gap-4 text-gray-400 text-sm mb-4">
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {formatNumber(video.views)}
          </span>
          <span className="flex items-center gap-1">
            <Heart className={`w-4 h-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
            {formatNumber(likeCount)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            {formatNumber(video.comments_count)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={`flex-1 ${isLiked ? "text-red-500 hover:text-red-400" : "text-gray-400 hover:text-white"}`}
            data-testid={`like-btn-${video.id}`}
          >
            <Heart className={`w-4 h-4 mr-1 ${isLiked ? "fill-red-500" : ""}`} />
            {isLiked ? "Liked" : "Like"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleComments}
            className="flex-1 text-gray-400 hover:text-white"
            data-testid={`comment-btn-${video.id}`}
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            Comment
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/watch?v=${video.id}`);
              toast.success("Link copied!");
            }}
            className="flex-1 text-gray-400 hover:text-white"
          >
            <Share2 className="w-4 h-4 mr-1" />
            Share
          </Button>
        </div>

        {/* Comments Section */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 border-t border-zinc-800 pt-4 overflow-hidden"
            >
              {/* Comment input */}
              <form onSubmit={handleComment} className="flex gap-2 mb-4">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="bg-zinc-800 border-zinc-700 text-white text-sm"
                  data-testid={`comment-input-${video.id}`}
                />
                <Button 
                  type="submit" 
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                  disabled={!newComment.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>

              {/* Comments list */}
              {loadingComments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <img
                        src={comment.user_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user_name)}&background=6366f1&color=fff&size=32`}
                        alt={comment.user_name}
                        className="w-6 h-6 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300 text-xs font-medium">{comment.user_name}</span>
                          <span className="text-gray-500 text-xs">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-2">No comments yet. Be the first!</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Helper functions
function formatNumber(num) {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function getCategoryColor(category) {
  const colors = {
    music: "#EF4444",
    sports: "#F59E0B",
    gaming: "#8B5CF6",
    comedy: "#EC4899",
    podcast: "#06B6D4",
    news: "#3B82F6",
    education: "#10B981",
    entertainment: "#F97316",
    lifestyle: "#DB2777",
    tech: "#6366F1",
    other: "#6B7280"
  };
  return colors[category] || "#6B7280";
}

export default function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [currentUserId, setCurrentUserId] = useState(null);
  
  const selectedCategory = searchParams.get("category") || "all";
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Get current user
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("ztvlive_user") || "{}");
    if (user.user_id) {
      setCurrentUserId(user.user_id);
    }
  }, []);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await axios.get(`${API}/creator-videos/categories`);
        setCategories(response.data.categories);
      } catch (error) {
        console.error("Failed to load categories");
      }
    };
    loadCategories();
  }, []);

  // Load videos
  useEffect(() => {
    loadVideos(true);
  }, [selectedCategory, sortBy]);

  const loadVideos = async (reset = false) => {
    if (reset) {
      setLoading(true);
      setVideos([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const skip = reset ? 0 : videos.length;
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: "12",
        sort_by: sortBy
      });
      
      if (selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }

      const response = await axios.get(`${API}/creator-videos/feed?${params}`);
      const newVideos = response.data;

      if (reset) {
        setVideos(newVideos);
      } else {
        setVideos(prev => [...prev, ...newVideos]);
      }

      setHasMore(newVideos.length === 12);
    } catch (error) {
      console.error("Failed to load videos:", error);
      toast.error("Failed to load videos");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Search videos
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadVideos(true);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/creator-videos/search?q=${encodeURIComponent(searchQuery)}`
      );
      setVideos(response.data.videos);
      setHasMore(false);
    } catch (error) {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadVideos(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, videos.length]);

  const selectCategory = (categoryKey) => {
    if (categoryKey === "all") {
      searchParams.delete("category");
    } else {
      searchParams.set("category", categoryKey);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="min-h-screen bg-black">
      <SEO 
        title="Browse - Explore All Content"
        description="Browse the complete ZTVLIVE content library. Discover music videos, sports highlights, podcasts, gaming streams and more. Filter by category and find your next favorite."
        path="/browse"
      />
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Tv className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">ZTVLIVE</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link to="/watch" className="text-gray-300 hover:text-white font-medium">
                Watch Live
              </Link>
              <Link to="/browse" className="text-red-500 font-medium">
                Browse
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              {currentUserId ? (
                <Link to="/dashboard">
                  <Button variant="outline" size="sm" className="border-zinc-700 text-gray-300">
                    <User className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <Link to="/login">
                  <Button className="bg-red-600 hover:bg-red-700" size="sm">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Browse Videos</h1>
          <p className="text-gray-400">Discover content from our creator community</p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search videos, creators, tags..."
                className="pl-10 bg-zinc-900 border-zinc-700 text-white"
                data-testid="search-input"
              />
            </div>
            <Button type="submit" className="bg-red-600 hover:bg-red-700">
              Search
            </Button>
          </form>

          {/* Sort */}
          <div className="flex gap-2">
            {[
              { key: "recent", label: "Recent" },
              { key: "popular", label: "Popular" },
              { key: "trending", label: "Trending" }
            ].map((sort) => (
              <Button
                key={sort.key}
                variant={sortBy === sort.key ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy(sort.key)}
                className={sortBy === sort.key 
                  ? "bg-red-600 hover:bg-red-700" 
                  : "border-zinc-700 text-gray-300 hover:text-white"
                }
                data-testid={`sort-${sort.key}`}
              >
                {sort.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-max">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => selectCategory("all")}
              className={selectedCategory === "all" 
                ? "bg-red-600 hover:bg-red-700" 
                : "border-zinc-700 text-gray-300 hover:text-white"
              }
              data-testid="category-all"
            >
              All
            </Button>
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.key] || Folder;
              return (
                <Button
                  key={cat.key}
                  variant={selectedCategory === cat.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => selectCategory(cat.key)}
                  className={selectedCategory === cat.key 
                    ? "bg-red-600 hover:bg-red-700" 
                    : "border-zinc-700 text-gray-300 hover:text-white"
                  }
                  style={selectedCategory === cat.key ? {} : { borderColor: cat.color + "50" }}
                  data-testid={`category-${cat.key}`}
                >
                  <Icon className="w-4 h-4 mr-1" style={{ color: cat.color }} />
                  {cat.name}
                  {cat.video_count > 0 && (
                    <span className="ml-1 text-xs opacity-60">({cat.video_count})</span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Videos Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-4" />
            <p className="text-gray-400">Loading videos...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No videos yet</h3>
            <p className="text-gray-400 mb-6">
              {selectedCategory !== "all" 
                ? `No videos in this category yet. Be the first to upload!`
                : `Be the first creator to upload content!`
              }
            </p>
            <Link to="/login">
              <Button className="bg-red-600 hover:bg-red-700">
                Start Creating
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  currentUserId={currentUserId}
                />
              ))}
            </div>

            {/* Load More Trigger */}
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              {loadingMore && (
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
              )}
              {!hasMore && videos.length > 0 && (
                <p className="text-gray-500">You've seen all videos</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
