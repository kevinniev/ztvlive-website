import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Video, Play, Clock, Calendar, Trash2, Edit, Share2, Eye,
  Search, Filter, Grid3X3, LayoutList, Plus, ArrowLeft,
  CheckCircle, AlertCircle, Loader2, ExternalLink, Tv,
  MoreVertical, Copy, Download, Youtube, X, RefreshCw
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";

const API = '/api';

const CreatorLibraryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectMode = searchParams.get('select') === 'true';
  const returnTo = searchParams.get('returnTo') || '/creator/dashboard';
  
  const [user, setUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [filter, setFilter] = useState("all"); // all, approved, pending, flagged
  const [selectedVideo, setSelectedVideo] = useState(null);
  
  // Video Preview State
  const [previewVideo, setPreviewVideo] = useState(null);
  const [videoLoadError, setVideoLoadError] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem("token") || localStorage.getItem("session_token");
    if (!token) {
      navigate("/login?redirect=/creator/library");
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      fetchVideos(token, response.data.user_id || response.data.id);
    } catch (error) {
      navigate("/login?redirect=/creator/library");
    }
  };

  const fetchVideos = async (token, userId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/creator-videos/my-videos?creator_id=${userId}&limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVideos(response.data || []);
    } catch (error) {
      console.error("Fetch videos error:", error);
      toast.error("Failed to load your videos");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (videoId, videoTitle) => {
    if (!confirm(`Are you sure you want to delete "${videoTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const userId = user?.user_id || user?.id;
      
      // Check if video is scheduled
      const bookingsResponse = await axios.get(`${API}/creator-schedule/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const isScheduled = bookingsResponse.data?.bookings?.some(
        booking => booking.video_id === videoId && booking.status !== 'cancelled'
      );
      
      if (isScheduled) {
        toast.error("Cannot delete a scheduled video. Cancel the booking first.");
        return;
      }
      
      await axios.delete(`${API}/creator-videos/video/${videoId}?creator_id=${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVideos(prev => prev.filter(v => v.video_id !== videoId && v.id !== videoId));
      toast.success("Video deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error("Failed to delete video");
      }
    }
  };

  const handleSelectVideo = (video) => {
    if (selectMode) {
      // Store selected video and navigate to scheduling
      localStorage.setItem('selectedVideoForSchedule', JSON.stringify(video));
      navigate(returnTo);
    }
  };

  const handleScheduleVideo = (video) => {
    // Save video to localStorage and navigate to schedule with video pre-loaded
    localStorage.setItem('selectedVideoForSchedule', JSON.stringify({
      ...video,
      // Ensure all needed fields are present
      title: video.title,
      video_url: video.video_url,
      youtube_id: video.youtube_id,
      thumbnail_url: video.thumbnail_url,
      duration_seconds: video.duration_seconds,
      duration_minutes: video.duration_seconds ? Math.ceil(video.duration_seconds / 60) : 15
    }));
    // Navigate to schedule page - the video will auto-load
    navigate('/schedule-slot?content_type=library');
    toast.success(`"${video.title}" selected! Now pick a time slot.`);
  };

  // Open video preview modal
  const handlePreviewVideo = (video) => {
    setVideoLoadError(false);
    setPreviewVideo(video);
  };

  // Get video URL for preview (handles YouTube and direct uploads)
  const getVideoPreviewUrl = (video) => {
    if (video.youtube_id) {
      return `https://www.youtube.com/embed/${video.youtube_id}?autoplay=1`;
    }
    return video.video_url || video.file_url;
  };

  const filteredVideos = videos.filter(video => {
    const matchesSearch = video.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         video.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    if (filter === "approved") return matchesSearch && (video.review_status === "approved" || video.auto_approved);
    if (filter === "pending") return matchesSearch && video.review_status === "pending";
    if (filter === "flagged") return matchesSearch && video.review_status === "flagged";
    return matchesSearch;
  });

  const formatDuration = (seconds) => {
    if (!seconds) return "Unknown";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const stats = {
    total: videos.length,
    approved: videos.filter(v => v.review_status === "approved" || v.auto_approved || !v.review_status).length,
    pending: videos.filter(v => v.review_status === "pending").length,
    flagged: videos.filter(v => v.review_status === "flagged").length,
  };

  // Helper to determine video status
  const getVideoStatus = (video) => {
    if (video.review_status === "flagged") return "flagged";
    if (video.review_status === "pending") return "pending";
    // Default to approved for imported/uploaded videos
    return "approved";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-zinc-400">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">My Video Library</h1>
                <p className="text-xs text-zinc-400">
                  {selectMode ? "Select a video to schedule" : "Manage your uploaded content"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/upload">
              <Button className="bg-red-600 hover:bg-red-700">
                <Plus className="w-4 h-4 mr-2" /> Upload Video
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card 
            className={`bg-zinc-900 border-zinc-800 cursor-pointer transition-all ${filter === 'all' ? 'ring-2 ring-red-500' : ''}`}
            onClick={() => setFilter('all')}
          >
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-zinc-400">Total Videos</p>
            </CardContent>
          </Card>
          <Card 
            className={`bg-zinc-900 border-zinc-800 cursor-pointer transition-all ${filter === 'approved' ? 'ring-2 ring-emerald-500' : ''}`}
            onClick={() => setFilter('approved')}
          >
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-400">{stats.approved}</p>
              <p className="text-sm text-zinc-400">Approved</p>
            </CardContent>
          </Card>
          <Card 
            className={`bg-zinc-900 border-zinc-800 cursor-pointer transition-all ${filter === 'pending' ? 'ring-2 ring-yellow-500' : ''}`}
            onClick={() => setFilter('pending')}
          >
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
              <p className="text-sm text-zinc-400">Pending Review</p>
            </CardContent>
          </Card>
          <Card 
            className={`bg-zinc-900 border-zinc-800 cursor-pointer transition-all ${filter === 'flagged' ? 'ring-2 ring-red-500' : ''}`}
            onClick={() => setFilter('flagged')}
          >
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-red-400">{stats.flagged}</p>
              <p className="text-sm text-zinc-400">Needs Attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Search your videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-800 border-zinc-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "bg-zinc-800" : ""}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-zinc-800" : ""}
            >
              <LayoutList className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Video Grid/List */}
        {filteredVideos.length === 0 ? (
          <div className="text-center py-16">
            <Video className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No videos found</h3>
            <p className="text-zinc-400 mb-6">
              {videos.length === 0 
                ? "Upload your first video to get started!" 
                : "No videos match your search criteria."}
            </p>
            {videos.length === 0 && (
              <Link to="/upload">
                <Button className="bg-red-600 hover:bg-red-700">
                  <Plus className="w-4 h-4 mr-2" /> Upload Your First Video
                </Button>
              </Link>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredVideos.map((video, idx) => (
              <motion.div
                key={video.id || video.video_id || idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card 
                  className={`bg-zinc-900 border-zinc-800 overflow-hidden group cursor-pointer transition-all hover:border-zinc-700 ${
                    selectMode ? 'hover:ring-2 hover:ring-red-500' : ''
                  }`}
                  onClick={() => selectMode ? handleSelectVideo(video) : null}
                  data-testid={`video-card-${video.id || video.video_id || idx}`}
                >
                  <div className="relative aspect-video">
                    <img
                      src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/320x180?text=No+Thumbnail";
                      }}
                    />
                    {/* Hover overlay with Quick Schedule button */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2">
                      {!selectMode && (
                        <Button
                          size="sm"
                          className="bg-white/20 hover:bg-white/30 text-white shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewVideo(video);
                          }}
                          data-testid={`preview-btn-${video.id || video.video_id || idx}`}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                      )}
                      {!selectMode && getVideoStatus(video) === "approved" && (
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-500 text-white shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleScheduleVideo(video);
                          }}
                          data-testid={`quick-schedule-btn-${video.id || video.video_id || idx}`}
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          Quick Schedule
                        </Button>
                      )}
                    </div>
                    {video.youtube_id && (
                      <Badge className="absolute top-2 left-2 bg-red-600">
                        <Youtube className="w-3 h-3 mr-1" /> YouTube
                      </Badge>
                    )}
                    <Badge className={`absolute top-2 right-2 ${
                      getVideoStatus(video) === "approved"
                        ? "bg-emerald-600" 
                        : getVideoStatus(video) === "flagged" 
                          ? "bg-red-600" 
                          : "bg-yellow-600"
                    }`}>
                      {getVideoStatus(video) === "approved"
                        ? "Approved" 
                        : getVideoStatus(video) === "flagged" 
                          ? "Flagged" 
                          : "Pending"}
                    </Badge>
                    {video.duration_seconds && (
                      <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs">
                        {formatDuration(video.duration_seconds)}
                      </span>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-2 mb-2">{video.title}</h3>
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>{formatDate(video.created_at)}</span>
                      {!selectMode && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-700">
                            <DropdownMenuItem onClick={() => handlePreviewVideo(video)} className="cursor-pointer">
                              <Play className="w-4 h-4 mr-2" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleScheduleVideo(video)} className="cursor-pointer">
                              <Calendar className="w-4 h-4 mr-2" /> Schedule
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(video.video_url)} className="cursor-pointer">
                              <Copy className="w-4 h-4 mr-2" /> Copy URL
                            </DropdownMenuItem>
                            {video.video_url && (
                              <DropdownMenuItem onClick={() => window.open(video.video_url, '_blank')} className="cursor-pointer">
                                <ExternalLink className="w-4 h-4 mr-2" /> Open Original
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => handleDeleteVideo(video.id || video.video_id, video.title)} 
                              className="cursor-pointer text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredVideos.map((video, idx) => (
              <motion.div
                key={video.id || video.video_id || idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card 
                  className={`bg-zinc-900 border-zinc-800 cursor-pointer transition-all hover:border-zinc-700 ${
                    selectMode ? 'hover:ring-2 hover:ring-red-500' : ''
                  }`}
                  onClick={() => selectMode ? handleSelectVideo(video) : null}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="relative w-40 aspect-video flex-shrink-0">
                      <img
                        src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`}
                        alt={video.title}
                        className="w-full h-full object-cover rounded"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/160x90?text=No+Thumbnail";
                        }}
                      />
                      {video.duration_seconds && (
                        <span className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-xs">
                          {formatDuration(video.duration_seconds)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold mb-1 truncate">{video.title}</h3>
                      <p className="text-sm text-zinc-400 line-clamp-1">{video.description || "No description"}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                        <span>{formatDate(video.created_at)}</span>
                        {video.youtube_id && (
                          <Badge className="bg-red-600 text-xs">YouTube</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${
                        getVideoStatus(video) === "approved"
                          ? "bg-emerald-600" 
                          : getVideoStatus(video) === "flagged" 
                            ? "bg-red-600" 
                            : "bg-yellow-600"
                      }`}>
                        {getVideoStatus(video) === "approved"
                          ? "Approved" 
                          : getVideoStatus(video) === "flagged" 
                            ? "Flagged" 
                            : "Pending"}
                      </Badge>
                      {!selectMode && (
                        <>
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handlePreviewVideo(video); }}>
                            <Play className="w-4 h-4 mr-1" /> Preview
                          </Button>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleScheduleVideo(video); }}>
                            <Calendar className="w-4 h-4 mr-1" /> Schedule
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                            onClick={(e) => { e.stopPropagation(); handleDeleteVideo(video.id || video.video_id, video.title); }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Video Preview Modal */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-4xl bg-zinc-900 border-zinc-700 p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate pr-4">{previewVideo?.title || "Video Preview"}</span>
              <Badge className={
                getVideoStatus(previewVideo || {}) === "approved"
                  ? "bg-emerald-600"
                  : getVideoStatus(previewVideo || {}) === "flagged"
                    ? "bg-red-600"
                    : "bg-yellow-600"
              }>
                {getVideoStatus(previewVideo || {})}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Preview your video before scheduling
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            {previewVideo && (
              <div className="space-y-4">
                {/* Video Player */}
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                  {(() => {
                    // Extract YouTube ID from URL if present
                    const videoUrl = previewVideo.video_url || "";
                    let youtubeId = previewVideo.youtube_id;
                    
                    // Try to extract YouTube ID from URL
                    if (!youtubeId && videoUrl.includes("youtube.com/watch?v=")) {
                      youtubeId = videoUrl.split("watch?v=")[1]?.split("&")[0];
                    } else if (!youtubeId && videoUrl.includes("youtu.be/")) {
                      youtubeId = videoUrl.split("youtu.be/")[1]?.split("?")[0];
                    }
                    
                    if (youtubeId) {
                      return (
                        <iframe
                          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={previewVideo.title}
                        />
                      );
                    } else if (videoUrl && !videoLoadError) {
                      return (
                        <video 
                          key={previewVideo.video_id}
                          src={videoUrl}
                          controls 
                          autoPlay
                          playsInline
                          preload="auto"
                          className="w-full h-full"
                          data-testid="library-video-preview-player"
                          onError={() => setVideoLoadError(true)}
                        >
                          Your browser does not support the video tag.
                        </video>
                      );
                    } else {
                      return (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 p-6">
                          <Video className="w-16 h-16 mb-4 opacity-50" />
                          {videoLoadError ? (
                            <>
                              <p className="text-red-400 font-medium">Video file not accessible</p>
                              <p className="text-xs mt-2 text-center max-w-md">
                                The video file may have been moved or is temporarily unavailable.
                              </p>
                              <div className="mt-4 p-3 bg-zinc-800 rounded-lg text-xs max-w-full overflow-hidden">
                                <p className="text-zinc-400">Video URL:</p>
                                <p className="text-zinc-500 break-all mt-1 text-xs">{previewVideo.video_url}</p>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="mt-4"
                                onClick={() => setVideoLoadError(false)}
                              >
                                <RefreshCw className="w-3 h-3 mr-2" />
                                Retry Loading
                              </Button>
                            </>
                          ) : (
                            <>
                              <p>Video URL not available</p>
                              <p className="text-xs mt-1">The video may still be processing</p>
                            </>
                          )}
                        </div>
                      );
                    }
                  })()}
                </div>
                
                {/* Video Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500">Duration:</span>
                    <span className="ml-2 text-white">
                      {previewVideo.duration_seconds 
                        ? formatDuration(previewVideo.duration_seconds)
                        : "Unknown"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Category:</span>
                    <span className="ml-2 text-white capitalize">{previewVideo.category || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Uploaded:</span>
                    <span className="ml-2 text-white">{formatDate(previewVideo.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Source:</span>
                    <span className="ml-2 text-white">{previewVideo.youtube_id ? "YouTube" : "Upload"}</span>
                  </div>
                </div>
                
                {/* Description */}
                {previewVideo.description && (
                  <div className="text-sm">
                    <span className="text-zinc-500">Description:</span>
                    <p className="mt-1 text-zinc-300 line-clamp-3">{previewVideo.description}</p>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <Button variant="outline" onClick={() => setPreviewVideo(null)}>
                    Close
                  </Button>
                  {getVideoStatus(previewVideo) === "approved" && (
                    <Button 
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => {
                        handleScheduleVideo(previewVideo);
                        setPreviewVideo(null);
                      }}
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule This Video
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorLibraryPage;
