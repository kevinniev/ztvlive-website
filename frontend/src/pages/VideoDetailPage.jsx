import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { 
  Play, Heart, Share2, ArrowLeft, Tv, Menu, X, Eye, Clock,
  Sparkles, RefreshCw, Send, ChevronRight, MessageSquare, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import CleanYouTubePlayer, { getYouTubeVideoId } from "@/components/CleanYouTubePlayer";

const API = '/api';
const WS_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : '';

const CATEGORY_COLORS = {
  sports: "#f97316",
  podcast: "#8b5cf6",
  music: "#d946ef",
  film: "#ec4899",
  tech: "#06b6d4",
  gaming: "#22c55e",
  news: "#eab308",
  culture: "#f43f5e",
};

export default function VideoDetailPage() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [generatingCommentary, setGeneratingCommentary] = useState(false);
  const [aiCommentary, setAiCommentary] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [username, setUsername] = useState(() => localStorage.getItem('ztv_username') || '');
  const [showUsernameInput, setShowUsernameInput] = useState(false);
  const wsRef = useRef(null);
  const commentsEndRef = useRef(null);

  // WebSocket for real-time comments
  useEffect(() => {
    if (!id || !WS_URL) return;
    
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`${WS_URL}/ws/chat/video_${id}`);
        wsRef.current = ws;
        
        ws.onopen = () => {
          console.log("Connected to video comments");
        };
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            setComments(prev => [...prev, data]);
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          } else if (data.type === 'history') {
            setComments(data.messages || []);
          }
        };
        
        ws.onclose = () => {
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
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
  }, [id]);

  const handleSendComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    if (!username.trim()) {
      setShowUsernameInput(true);
      toast.info("Please enter a display name first");
      return;
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        username: username,
        message: newComment.trim(),
        video_id: id,
      }));
      setNewComment("");
    } else {
      toast.error("Connection lost. Reconnecting...");
    }
  };

  const handleSetUsername = (e) => {
    e.preventDefault();
    if (username.trim()) {
      localStorage.setItem('ztv_username', username.trim());
      setShowUsernameInput(false);
      toast.success("Username saved!");
    }
  };

  const fetchVideo = useCallback(async () => {
    setLoading(true);
    try {
      // Use universal video fetch endpoint
      const res = await axios.get(`${API}/video/${id}`);
      const videoData = res.data;
      
      // Normalize field names
      if (!videoData.title && videoData.topic) {
        videoData.title = videoData.topic;
      }
      if (!videoData.description && videoData.summary) {
        videoData.description = videoData.summary;
      }
      if (!videoData.description && videoData.ai_narrative) {
        videoData.description = videoData.ai_narrative;
      }
      
      setVideo(videoData);
      setAiCommentary(videoData.ai_commentary || videoData.ai_narrative || "");
      
      // Get related videos
      try {
        const relatedRes = await axios.get(`${API}/content/all?category=${videoData.category}&limit=6`);
        setRelatedVideos(relatedRes.data.content.filter(v => v.id !== id).slice(0, 4));
      } catch (e) {
        console.log("Could not fetch related videos");
      }
    } catch (error) {
      console.error("Error fetching video:", error);
      toast.error("Video not found");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  // Extract video embed info
  const getVideoEmbed = (url) => {
    if (!url) return null;
    
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
    if (ytMatch) {
      return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0` };
    }
    
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1` };
    }
    
    if (url.match(/\.(mp4|webm|ogg)$/i)) {
      return { type: 'direct', url };
    }
    
    return null;
  };

  const handleLike = async () => {
    try {
      await axios.post(`${API}/highlights/${id}/like`);
      setLiked(true);
      toast.success("Added to your likes!");
    } catch (error) {
      toast.error("Failed to like");
    }
  };

  const handleShare = async () => {
    const shareUrl = `https://www.ztvlivestream.com${window.location.pathname}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: video?.title || 'ZTV LIVE Video',
          text: video?.description || 'Watch this on ZTV LIVE',
          url: shareUrl
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied: " + shareUrl);
      }
    } catch {
      toast.info("Share: " + shareUrl);
    }
  };

  const generateNewCommentary = async () => {
    if (!video) return;
    
    setGeneratingCommentary(true);
    try {
      const res = await axios.post(`${API}/ai/generate-commentary`, {
        topic: video.title,
        category: video.category,
        humor_level: 7,
        include_facts: true
      });
      setAiCommentary(res.data.commentary);
      toast.success("Fresh commentary generated!");
    } catch (error) {
      toast.error("Failed to generate commentary");
    } finally {
      setGeneratingCommentary(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading video...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="font-heading text-3xl mb-4">VIDEO NOT FOUND</h2>
          <Link to="/library">
            <Button className="bg-red-600 hover:bg-red-500">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center">
                <Tv className="w-6 h-6" />
              </div>
              <span className="font-heading text-2xl tracking-wider">ZTV LIVE</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm text-zinc-400 hover:text-white transition-colors">HOME</Link>
              <Link to="/watch" className="text-sm text-zinc-400 hover:text-white transition-colors">WATCH</Link>
              <Link to="/library" className="text-sm text-zinc-400 hover:text-white transition-colors">LIBRARY</Link>
              <Link to="/schedule" className="text-sm text-zinc-400 hover:text-white transition-colors">SCHEDULE</Link>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 pb-16">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          {/* Back Button */}
          <Link to="/library" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Video Player - Clean, No YouTube Graphics */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-lg overflow-hidden bg-black"
              >
                {(() => {
                  const embedInfo = getVideoEmbed(video.video_url);
                  const ytVideoId = getYouTubeVideoId(video.video_url);
                  
                  if (ytVideoId) {
                    // Use CleanYouTubePlayer for YouTube videos
                    return (
                      <CleanYouTubePlayer
                        videoId={ytVideoId}
                        autoUnmute={true}
                        showDVRControls={true}
                        showProgress={true}
                        title={video.title}
                      />
                    );
                  }
                  
                  if (embedInfo?.type === 'vimeo') {
                    return (
                      <div className="aspect-video relative">
                        <iframe
                          src={`${embedInfo.embedUrl}?autoplay=1`}
                          className="w-full h-full"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          title={video.title}
                          frameBorder="0"
                        />
                      </div>
                    );
                  }
                  
                  if (embedInfo?.type === 'direct') {
                    return (
                      <div className="aspect-video relative">
                        <video 
                          src={embedInfo.url} 
                          className="w-full h-full" 
                          controls 
                          autoPlay 
                          playsInline
                          controlsList="nodownload"
                        />
                      </div>
                    );
                  }
                  
                  // Fallback for no video
                  return (
                    <div className="aspect-video relative">
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover opacity-50" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <Play className="w-16 h-16 text-white/50 mb-4" />
                          <p className="text-zinc-400 text-center px-4">
                            Watch this video live on ZTVLIVE 24/7 channel
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>

              {/* Video Info */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-6"
              >
                <Badge 
                  className="text-white mb-2"
                  style={{ backgroundColor: CATEGORY_COLORS[video.category] || '#8b5cf6' }}
                >
                  {video.category?.toUpperCase()}
                </Badge>
                
                <h1 className="font-heading text-3xl md:text-4xl tracking-tight uppercase">
                  {video.title}
                </h1>
                
                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-1 bg-green-600/20 text-green-400 px-3 py-1 rounded-full font-semibold">
                    <Eye className="w-4 h-4" />
                    {video.views >= 1000000 
                      ? (video.views / 1000000).toFixed(1) + 'M views'
                      : video.views >= 1000 
                        ? (video.views / 1000).toFixed(0) + 'K views'
                        : (video.views || 0) + ' views'
                    }
                  </div>
                  <div className="flex items-center gap-1 bg-red-600/20 text-red-400 px-3 py-1 rounded-full">
                    <Heart className="w-4 h-4" />
                    {video.likes >= 1000000 
                      ? (video.likes / 1000000).toFixed(1) + 'M'
                      : video.likes >= 1000 
                        ? (video.likes / 1000).toFixed(0) + 'K'
                        : (video.likes || 0)
                    }
                  </div>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <Clock className="w-4 h-4" />
                    {video.duration}
                  </div>
                  <span className="text-zinc-500">Source: {video.source}</span>
                  {video.trending_score > 95 && (
                    <Badge className="bg-amber-600 animate-pulse">🔥 TRENDING</Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-4">
                  <Button 
                    variant={liked ? "default" : "outline"}
                    className={liked ? "bg-red-600 hover:bg-red-500" : "border-zinc-700 hover:border-red-500"}
                    onClick={handleLike}
                  >
                    <Heart className={`w-4 h-4 mr-2 ${liked ? 'fill-current' : ''}`} />
                    {liked ? 'Liked!' : 'Like'}
                  </Button>
                  <Button variant="outline" className="border-zinc-700 hover:border-red-500" onClick={handleShare}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </div>
              </motion.div>

              {/* Description */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-6 p-6 bg-zinc-900 border border-zinc-800 rounded-lg"
              >
                <h3 className="font-heading text-xl tracking-wider mb-3">ABOUT THIS VIDEO</h3>
                <p className="text-zinc-300 leading-relaxed">{video.description}</p>
              </motion.div>

              {/* AI Commentary */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 p-6 bg-zinc-900 border border-zinc-800 rounded-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <span className="font-heading text-xl tracking-wider">AI COMMENTARY</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={generateNewCommentary}
                    disabled={generatingCommentary}
                    className="text-red-400 hover:text-red-300"
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${generatingCommentary ? 'animate-spin' : ''}`} />
                    {generatingCommentary ? 'Generating...' : 'Generate New'}
                  </Button>
                </div>
                <p className="text-zinc-300 leading-relaxed italic">
                  "{aiCommentary || 'Click "Generate New" to create witty AI commentary!'}"
                </p>
              </motion.div>

              {/* User Comments Section */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-xl tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                    COMMENTS
                  </h3>
                  <Badge className="bg-zinc-800 text-zinc-400">
                    {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                  </Badge>
                </div>

                {/* Username Input */}
                {showUsernameInput && (
                  <form onSubmit={handleSetUsername} className="mb-4 p-3 bg-zinc-800 rounded-lg">
                    <p className="text-sm text-zinc-400 mb-2">Choose a display name:</p>
                    <div className="flex gap-2">
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Your name..."
                        className="bg-zinc-900 border-zinc-700"
                        maxLength={20}
                      />
                      <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-500">
                        Save
                      </Button>
                    </div>
                  </form>
                )}

                {/* Comments List */}
                <div className="space-y-3 max-h-80 overflow-y-auto mb-4 pr-2">
                  {comments.length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-4">
                      No comments yet. Be the first to comment!
                    </p>
                  ) : (
                    comments.map((comment, idx) => (
                      <div key={idx} className="flex gap-3 p-3 bg-zinc-800/50 rounded-lg">
                        <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-white">{comment.username}</span>
                            <span className="text-xs text-zinc-500">
                              {comment.timestamp ? new Date(comment.timestamp).toLocaleTimeString() : 'just now'}
                            </span>
                          </div>
                          <p className="text-zinc-300 text-sm break-words">{comment.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {/* Comment Input */}
                <form onSubmit={handleSendComment} className="flex gap-2">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={username ? "Add a comment..." : "Set username to comment..."}
                    className="bg-zinc-800 border-zinc-700 flex-1"
                    maxLength={500}
                    onClick={() => !username && setShowUsernameInput(true)}
                  />
                  <Button 
                    type="submit" 
                    className="bg-red-600 hover:bg-red-500"
                    disabled={!newComment.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </motion.div>
            </div>

            {/* Sidebar - Related Videos */}
            <div className="lg:col-span-1">
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading text-xl tracking-wider">MORE VIDEOS</h3>
                  <Link to="/library" className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
                    See All <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                
                <div className="space-y-4">
                  {relatedVideos.map((related) => (
                    <Link 
                      key={related.id}
                      to={`/video/${related.id}`}
                      className="block group"
                    >
                      <div className="flex gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-red-500/50 transition-colors">
                        <div className="w-32 h-20 flex-shrink-0 rounded overflow-hidden relative">
                          <img 
                            src={related.thumbnail} 
                            alt={related.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute bottom-1 right-1 text-xs bg-black/80 px-1 py-0.5 rounded">
                            {related.duration}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-heading text-sm line-clamp-2 group-hover:text-red-400 transition-colors">
                            {related.title}
                          </h4>
                          <div className="text-xs text-zinc-500 mt-1">
                            {(related.views || 0).toLocaleString()} views
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Watch Live CTA */}
                <div className="mt-6 p-4 bg-red-600/10 border border-red-600/30 rounded-lg">
                  <h4 className="font-heading text-lg tracking-wider mb-2 text-red-400">WATCH LIVE</h4>
                  <p className="text-zinc-400 text-sm mb-3">
                    Catch the 24/7 live stream on Roku, Fire TV, or right here!
                  </p>
                  <Link to="/watch?unmute=true">
                    <Button className="w-full bg-red-600 hover:bg-red-500">
                      <Play className="w-4 h-4 mr-2" />
                      Go to Live Stream
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
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
            Same content on Roku, Fire TV, and Web • 24/7 Streaming
          </p>
        </div>
      </footer>
    </div>
  );
}
