import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Upload, Calendar, Video, Bell, Settings,
  TrendingUp, Eye, DollarSign, Clock, Play, Plus, ArrowRight,
  CheckCircle, AlertCircle, FileText, ExternalLink, Users,
  BarChart3, Loader2, RefreshCw, Share2, Copy, Sparkles,
  Film, Timer, Shield, Star, ChevronRight, Zap, Tv, Youtube,
  User, Pencil, X, Save, Gamepad2, Download, Edit, Check,
  GripVertical, LineChart, ThumbsUp, MessageCircle, ArrowUp, ArrowDown,
  ImagePlus, Trophy, Wallet, CreditCard, TrendingDown, Percent, Target,
  UserPlus, Handshake, Search, Send, Lightbulb, Brain, ImageIcon
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { toast } from "sonner";

// Modular Dashboard Tab Components
// These components are extracted from this file to reduce size and improve maintainability
import { RevenueTab, ScheduleTab, NotificationsTab } from "../components/dashboard";

// Drag and Drop imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const API = '/api';

// Sortable Video Item Component for drag & drop
const SortableVideoItem = ({ video, idx, isSelected, onToggleSelect, onPreview, onAnalytics, onABTest, onCollabInvite, formatDate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id || video.video_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };
  
  // Check if video has a playable URL
  const hasVideoUrl = video.video_url || video.file_url;
  const isProcessing = !video.thumbnail_url && video.status === "uploaded";

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 rounded-lg transition-colors ${
        isSelected
          ? 'bg-purple-900/20 border border-purple-500/30'
          : isDragging 
            ? 'bg-zinc-700 shadow-xl'
            : 'bg-zinc-800'
      }`}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-zinc-700 rounded"
      >
        <GripVertical className="w-4 h-4 text-zinc-500" />
      </div>

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(video.id || video.video_id)}
        className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 flex-shrink-0"
        data-testid={`select-video-${idx}`}
      />
      
      {/* Thumbnail - Click for instant preview */}
      <div 
        className={`w-20 h-12 bg-zinc-700 rounded overflow-hidden flex-shrink-0 relative group cursor-pointer ${
          hasVideoUrl ? '' : 'opacity-50'
        }`}
        onClick={() => hasVideoUrl && onPreview(video)}
        title={hasVideoUrl ? "Click to preview" : "Video processing..."}
      >
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : isProcessing ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800">
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            <span className="text-[8px] text-zinc-500 mt-0.5">Processing</span>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="w-5 h-5 text-zinc-500" />
          </div>
        )}
        {hasVideoUrl && (
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Play className="w-5 h-5 text-white" />
          </div>
        )}
        {/* Ready indicator */}
        {hasVideoUrl && (
          <div className="absolute bottom-0.5 right-0.5 w-2 h-2 bg-green-500 rounded-full" title="Ready to preview" />
        )}
      </div>

      {/* Video Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{video.title || "Untitled"}</p>
        <p className="text-xs text-zinc-500">
          {video.duration_seconds ? `${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, '0')}` : ""}
          {video.duration_seconds ? " • " : ""}
          {formatDate(video.created_at)}
        </p>
      </div>

      {/* Stats */}
      <div className="hidden md:flex items-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {video.views || 0}
        </span>
        <span className="flex items-center gap-1">
          <ThumbsUp className="w-3 h-3" />
          {video.likes || 0}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Badge className={
          video.review_status === "approved" || video.status === "approved" 
            ? "bg-emerald-600 text-xs" 
            : video.review_status === "flagged"
              ? "bg-red-600 text-xs"
              : "bg-yellow-600 text-xs"
        }>
          {video.review_status || video.status || "pending"}
        </Badge>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => onABTest(video)}
          className="h-8 w-8 p-0"
          title="A/B Thumbnail Test"
          data-testid={`ab-test-video-${idx}`}
        >
          <ImagePlus className="w-4 h-4 text-purple-400" />
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => onCollabInvite(video)}
          className="h-8 w-8 p-0"
          title="Invite Collaborator"
          data-testid={`collab-video-${idx}`}
        >
          <UserPlus className="w-4 h-4 text-green-400" />
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => onAnalytics(video)}
          className="h-8 w-8 p-0"
          data-testid={`analytics-video-${idx}`}
        >
          <LineChart className="w-4 h-4 text-blue-400" />
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => onPreview(video)}
          className="h-8 w-8 p-0"
          data-testid={`preview-video-${idx}`}
        >
          <Play className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" asChild className="h-8">
          <Link to={`/schedule-slot?video=${video.id || video.video_id}`}>
            <Calendar className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Schedule</span>
          </Link>
        </Button>
      </div>
    </div>
  );
};

const CreatorDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalViews: 0,
    totalEarnings: 0,
    totalVideos: 0,
    scheduledSlots: 0,
    pendingReview: 0,
    approvedContent: 0,
    followers: 0,
    // YouTube stats (to be populated from linked YouTube account)
    youtubeViews: 0,
    youtubeSubscribers: 0,
    youtubeAvgViews: 0,
    youtubeEarnings: 0
  });
  const [myVideos, setMyVideos] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [agreementStatus, setAgreementStatus] = useState({ accepted: false });
  const [activeTab, setActiveTab] = useState("overview");
  
  // YouTube Import State
  const [showYtImport, setShowYtImport] = useState(false);
  const [ytChannelUrl, setYtChannelUrl] = useState("");
  const [ytImporting, setYtImporting] = useState(false);
  const [ytImportResult, setYtImportResult] = useState(null);
  
  // Social Video Import State (TikTok, YouTube Shorts, Instagram Reels)
  const [showSocialImport, setShowSocialImport] = useState(false);
  const [socialImportUrl, setSocialImportUrl] = useState("");
  const [socialImportResolution, setSocialImportResolution] = useState("1920x1080");
  const [socialImporting, setSocialImporting] = useState(false);
  const [importedVideos, setImportedVideos] = useState([]);
  
  // Go Live State (YouTube/Facebook Live Embed)
  const [showGoLive, setShowGoLive] = useState(false);
  const [liveStreamUrl, setLiveStreamUrl] = useState("");
  const [liveStreamTitle, setLiveStreamTitle] = useState("");
  const [goingLive, setGoingLive] = useState(false);
  const [currentLiveSession, setCurrentLiveSession] = useState(null);
  
  // Profile Edit State
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    username: "",
    bio: ""
  });
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Video Preview State
  const [previewVideo, setPreviewVideo] = useState(null);
  const [videoLoadError, setVideoLoadError] = useState(false);
  
  // Handle opening video preview
  const openVideoPreview = (video) => {
    setVideoLoadError(false);
    setPreviewVideo(video);
  };
  
  // Notification Full Message Modal
  const [expandedNotification, setExpandedNotification] = useState(null);
  
  // Batch Edit State
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [batchEditForm, setBatchEditForm] = useState({
    applyTitle: false,
    titlePrefix: "",
    applyDescription: false,
    description: "",
    applyCategory: false,
    category: ""
  });
  const [savingBatch, setSavingBatch] = useState(false);
  
  // Video Analytics State
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsVideo, setAnalyticsVideo] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  
  // A/B Thumbnail Testing State
  const [showABTest, setShowABTest] = useState(false);
  const [abTestVideo, setABTestVideo] = useState(null);
  const [abTestData, setABTestData] = useState(null);
  const [loadingABTest, setLoadingABTest] = useState(false);
  const [creatingABTest, setCreatingABTest] = useState(false);
  const [uploadingVariant, setUploadingVariant] = useState(false);
  const abTestFileRef = React.useRef(null);
  
  // Revenue Dashboard State
  const [revenueData, setRevenueData] = useState(null);
  const [loadingRevenue, setLoadingRevenue] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState("month");
  
  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [hasOrderChanged, setHasOrderChanged] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  
  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Smart Scheduling State
  const [smartSuggestions, setSmartSuggestions] = useState(null);
  const [loadingSmartSuggestions, setLoadingSmartSuggestions] = useState(false);
  
  // Collabs State
  const [collabsData, setCollabsData] = useState(null);
  const [loadingCollabs, setLoadingCollabs] = useState(false);
  const [showInviteCollab, setShowInviteCollab] = useState(false);
  const [inviteCollabVideo, setInviteCollabVideo] = useState(null);
  const [collabSearchQuery, setCollabSearchQuery] = useState("");
  const [collabSearchResults, setCollabSearchResults] = useState([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState(null);
  const [collabRevenueSplit, setCollabRevenueSplit] = useState(50);
  const [sendingInvite, setSendingInvite] = useState(false);
  
  // Live Schedule State (24/7 Stream)
  const [liveSchedule, setLiveSchedule] = useState([]);
  const [currentPlaying, setCurrentPlaying] = useState(null);

  useEffect(() => {
    checkAuth();
    fetchLiveSchedule();
    // Refresh live schedule every 30 seconds
    const interval = setInterval(fetchLiveSchedule, 30000);
    
    // Auto-refresh videos every 10 seconds to catch new uploads instantly
    const videoRefreshInterval = setInterval(() => {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      if (token && user) {
        fetchMyContent(token, user.user_id);
      }
    }, 10000);
    
    return () => {
      clearInterval(interval);
      clearInterval(videoRefreshInterval);
    };
  }, [user]);
  
  // Manual refresh function for instant update
  const refreshVideos = async () => {
    const token = localStorage.getItem("token") || localStorage.getItem("session_token");
    if (token && user) {
      toast.info("Refreshing library...");
      await fetchMyContent(token, user.user_id);
      toast.success("Library updated!");
    }
  };
  
  // Generate thumbnails for videos that don't have them
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false);
  
  const generateAllThumbnails = async () => {
    try {
      setGeneratingThumbnails(true);
      toast.info("Generating thumbnails for all videos...");
      
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const response = await axios.post(`${API}/uploads/generate-thumbnails`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const { generated_count, failed_count, generated } = response.data;
      
      if (generated_count > 0) {
        toast.success(`Generated ${generated_count} thumbnails!`);
        // Refresh to show new thumbnails
        await fetchMyContent(token, user.user_id);
      } else if (failed_count > 0) {
        toast.warning(`Could not generate thumbnails for ${failed_count} videos`);
      } else {
        toast.info("All videos already have thumbnails");
      }
    } catch (error) {
      console.error("Thumbnail generation error:", error);
      toast.error("Failed to generate thumbnails");
    } finally {
      setGeneratingThumbnails(false);
    }
  };
  
  const fetchLiveSchedule = async () => {
    try {
      // Fetch current playing and upcoming
      const [syncRes, upcomingRes] = await Promise.all([
        axios.get(`${API}/tv/sync`),
        axios.get(`${API}/tv/upcoming?count=10`)
      ]);
      
      setCurrentPlaying(syncRes.data);
      
      // Calculate start times for upcoming videos
      const now = new Date();
      let nextStartTime = new Date(now.getTime() + ((syncRes.data.playback_duration || 180) - (syncRes.data.elapsed_seconds || 0)) * 1000);
      
      const upcoming = (upcomingRes.data.upcoming || []).map((item, i) => {
        const startTime = new Date(nextStartTime);
        const duration = item.duration_seconds || item.playback_duration || 180;
        nextStartTime = new Date(nextStartTime.getTime() + duration * 1000);
        return {
          ...item,
          start_time: startTime,
          duration: duration
        };
      });
      
      setLiveSchedule(upcoming);
    } catch (error) {
      console.log("Live schedule fetch error:", error);
    }
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      if (!token) {
        navigate("/login?redirect=/creator/dashboard");
        return;
      }

      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data) {
        setUser(response.data);
        await Promise.all([
          fetchStats(token, response.data.user_id),
          fetchMyContent(token, response.data.user_id),
          fetchMyBookings(token, response.data.user_id),
          fetchNotifications(token),
          fetchAgreementStatus(token)
        ]);
      }
    } catch (error) {
      console.error("Auth error:", error);
      navigate("/login?redirect=/creator-dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (token, userId) => {
    try {
      const response = await axios.get(`${API}/creator/${userId}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => ({ data: {} }));

      setStats(prev => ({
        ...prev,
        totalViews: response.data?.total_views || 0,
        totalEarnings: response.data?.total_earnings || 0
      }));
    } catch (error) {
      console.log("Stats fetch error (non-critical)");
    }
  };

  const fetchMyContent = async (token, userId) => {
    try {
      // Fetch from BOTH creator-videos AND uploads for complete library
      const [creatorVideosRes, uploadsRes] = await Promise.all([
        axios.get(`${API}/creator-videos/my-videos?creator_id=${userId}&limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })),
        axios.get(`${API}/uploads/my-uploads?creator_id=${userId}&file_type=video&limit=100`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: { uploads: [] } }))
      ]);
      
      const creatorVideos = creatorVideosRes.data || [];
      const uploadedFiles = uploadsRes.data?.uploads || [];
      
      // Normalize uploaded files to match video format for preview
      const normalizedUploads = uploadedFiles.map(upload => ({
        id: upload.id,
        video_id: upload.id,
        title: upload.title || upload.original_filename || "Untitled",
        description: upload.description || "",
        category: upload.category || "other",
        video_url: upload.file_url, // Map file_url to video_url for preview
        file_url: upload.file_url,
        thumbnail_url: upload.thumbnail_url,
        duration_seconds: upload.duration_seconds,
        views: upload.views || 0,
        likes: upload.likes || 0,
        status: upload.status || "uploaded",
        review_status: upload.review_status || upload.status || "pending",
        created_at: upload.created_at,
        creator_id: upload.creator_id,
        creator_name: upload.creator_name,
        source: "upload" // Mark source for debugging
      }));
      
      // Merge and dedupe by video_url or id
      const seenIds = new Set();
      const seenUrls = new Set();
      const allVideos = [];
      
      // Add creator videos first (they may have more metadata)
      for (const video of creatorVideos) {
        const id = video.id || video.video_id;
        const url = video.video_url || video.file_url;
        if (!seenIds.has(id) && !seenUrls.has(url)) {
          seenIds.add(id);
          if (url) seenUrls.add(url);
          allVideos.push({ ...video, source: "creator_videos" });
        }
      }
      
      // Add uploads that aren't already in creator_videos
      for (const upload of normalizedUploads) {
        const id = upload.id;
        const url = upload.video_url || upload.file_url;
        if (!seenIds.has(id) && !seenUrls.has(url)) {
          seenIds.add(id);
          if (url) seenUrls.add(url);
          allVideos.push(upload);
        }
      }
      
      // Sort by created_at descending
      allVideos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      setMyVideos(allVideos);
      setStats(prev => ({
        ...prev,
        totalVideos: allVideos.length,
        pendingReview: allVideos.filter(v => v.review_status === "pending" || v.review_status === "flagged").length,
        approvedContent: allVideos.filter(v => v.status === "approved" || v.review_status === "approved").length
      }));
    } catch (error) {
      console.log("Library fetch error:", error);
      setMyVideos([]);
    }
  };

  const fetchMyBookings = async (token, userId) => {
    try {
      const response = await axios.get(`${API}/creator-schedule/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const bookings = response.data?.bookings || [];
      setMyBookings(bookings);
      setStats(prev => ({
        ...prev,
        scheduledSlots: bookings.filter(b => b.status === "approved" || b.status === "confirmed").length
      }));
    } catch (error) {
      console.log("Bookings fetch error");
    }
  };

  const fetchNotifications = async (token) => {
    try {
      const response = await axios.get(`${API}/content-automation/my-notifications?unread_only=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data?.notifications || []);
    } catch (error) {
      console.log("Notifications fetch error");
    }
  };

  const fetchAgreementStatus = async (token) => {
    try {
      const response = await axios.get(`${API}/content-review/agreement-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAgreementStatus(response.data || { accepted: false });
    } catch (error) {
      console.log("Agreement status fetch error");
    }
  };

  // YouTube Channel Import Handler
  const handleYoutubeImport = async () => {
    if (!ytChannelUrl.trim()) {
      toast.error("Please enter your YouTube channel URL");
      return;
    }
    
    if (!user) {
      toast.error("Please login first");
      return;
    }
    
    setYtImporting(true);
    setYtImportResult(null);
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const response = await axios.post(
        `${API}/youtube-import/quick-import`,
        {
          channel_url: ytChannelUrl.trim(),
          creator_id: user.user_id || user.id,
          creator_name: user.name || user.display_name || "Creator"
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setYtImportResult(response.data);
      toast.success(`Successfully imported ${response.data.import_results?.imported || 0} videos!`);
      
      // Refresh video list
      const userId = user.user_id || user.id;
      await fetchMyContent(token, userId);
      
      // Close the import dialog
      setShowYtImport(false);
      setYtChannelUrl("");
    } catch (error) {
      console.error("YouTube import error:", error);
      toast.error(error.response?.data?.detail || "Failed to import YouTube channel");
      setYtImportResult({ error: error.response?.data?.detail || "Import failed" });
    } finally {
      setYtImporting(false);
    }
  };

  // Import video from TikTok, YouTube Shorts, or Instagram Reels
  const handleSocialImport = async () => {
    if (!socialImportUrl.trim()) {
      toast.error("Please enter a video URL");
      return;
    }

    setSocialImporting(true);
    toast.info("Downloading and processing video... This may take 30-60 seconds.", { duration: 5000 });
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const response = await axios.post(
        `${API}/creator-videos/import-video`,
        null,
        {
          params: {
            url: socialImportUrl,
            output_resolution: socialImportResolution,
            blur_background: true,
            creator_id: user?.user_id
          },
          headers: { Authorization: `Bearer ${token}` },
          timeout: 120000 // 2 minute timeout for video processing
        }
      );

      if (response.data.success) {
        toast.success("Video imported and reframed for TV! Redirecting to library...");
        setImportedVideos(prev => [response.data.video, ...prev]);
        setSocialImportUrl("");
        setShowSocialImport(false);
        // Navigate to library after successful import
        setTimeout(() => {
          window.location.href = '/creator/library';
        }, 1500);
      }
    } catch (error) {
      console.error("Import error:", error);
      const errorMsg = error.response?.data?.detail || error.response?.data?.error || "";
      
      if (error.code === 'ECONNABORTED') {
        toast.error("Import timed out. The video may be too long. Try again.");
      } else if (errorMsg.includes("blocked") || errorMsg.includes("TikTok")) {
        toast.error("TikTok is blocking our server. Try YouTube Shorts instead, or download and upload directly.", { duration: 6000 });
      } else if (errorMsg.includes("Unsupported URL")) {
        toast.error("Could not access this video. Use the full video URL (not shortened).", { duration: 5000 });
      } else {
        toast.error(errorMsg || "Failed to import. Try YouTube Shorts or upload directly.", { duration: 5000 });
      }
    } finally {
      setSocialImporting(false);
    }
  };

  // Go Live with YouTube/Facebook Live embed
  const handleGoLive = async () => {
    if (!liveStreamUrl.trim()) {
      toast.error("Please enter your live stream URL");
      return;
    }

    setGoingLive(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const response = await axios.post(
        `${API}/creator-videos/go-live`,
        null,
        {
          params: {
            url: liveStreamUrl,
            title: liveStreamTitle || "Live Stream",
            creator_id: user?.user_id,
            creator_name: user?.name || user?.username || "Creator",
            autoplay: true
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        toast.success(`You're now live on ZTVLIVE!`);
        setCurrentLiveSession(response.data.session);
        setShowGoLive(false);
        setLiveStreamUrl("");
        setLiveStreamTitle("");
      }
    } catch (error) {
      console.error("Go live error:", error);
      toast.error(error.response?.data?.detail || "Failed to start live stream");
    } finally {
      setGoingLive(false);
    }
  };

  // End live stream
  const handleEndLive = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      await axios.post(
        `${API}/creator-videos/end-live`,
        null,
        {
          params: {
            creator_id: user?.user_id,
            session_id: currentLiveSession?.id
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success("Live stream ended");
      setCurrentLiveSession(null);
    } catch (error) {
      console.error("End live error:", error);
      toast.error("Failed to end live stream");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Toggle video selection for batch edit
  const toggleVideoSelection = (videoId) => {
    setSelectedVideos(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  // Select all videos
  const selectAllVideos = () => {
    if (selectedVideos.length === myVideos.length) {
      setSelectedVideos([]);
    } else {
      setSelectedVideos(myVideos.map(v => v.id || v.video_id));
    }
  };

  // Drag & Drop handlers
  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragEnd = (event) => {
    setIsDragging(false);
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      setMyVideos((videos) => {
        const oldIndex = videos.findIndex(v => (v.id || v.video_id) === active.id);
        const newIndex = videos.findIndex(v => (v.id || v.video_id) === over.id);
        
        const newOrder = arrayMove(videos, oldIndex, newIndex);
        setHasOrderChanged(true);
        return newOrder;
      });
    }
  };

  // Save video order to backend
  const saveVideoOrder = async () => {
    setSavingOrder(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const videoOrders = myVideos.map((video, index) => ({
        video_id: video.id || video.video_id,
        order: index
      }));

      await axios.post(
        `${API}/uploads/reorder`,
        {
          creator_id: user?.user_id || user?.id,
          videos: videoOrders
        },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      toast.success("Video order saved!");
      setHasOrderChanged(false);
    } catch (error) {
      console.error("Error saving order:", error);
      toast.error("Failed to save video order");
    } finally {
      setSavingOrder(false);
    }
  };

  // Open video analytics
  const openVideoAnalytics = async (video) => {
    setAnalyticsVideo(video);
    setShowAnalytics(true);
    setLoadingAnalytics(true);
    setAnalyticsData(null);

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const response = await axios.get(
        `${API}/uploads/analytics/${video.id || video.video_id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAnalyticsData(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      // Set fallback data
      setAnalyticsData({
        video_id: video.id || video.video_id,
        title: video.title,
        metrics: {
          total_views: video.views || 0,
          total_likes: video.likes || 0,
          total_shares: video.shares || 0,
          total_comments: video.comments || 0,
          engagement_rate: 0,
          avg_watch_time_seconds: 0,
          completion_rate: 0
        },
        performance: {
          views_trend: "stable",
          daily_history: [],
          weekly_avg_views: 0
        }
      });
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // A/B Thumbnail Testing Functions
  const openABTest = async (video) => {
    setABTestVideo(video);
    setShowABTest(true);
    setLoadingABTest(true);
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const videoId = video.id || video.video_id;
      
      // Check for existing A/B test
      const response = await axios.get(
        `${API}/uploads/ab-test/video/${videoId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.tests && response.data.tests.length > 0) {
        // Get the most recent active test
        const activeTest = response.data.tests.find(t => t.status === "active") || response.data.tests[0];
        
        // Get full results
        const resultsResponse = await axios.get(
          `${API}/uploads/ab-test/${activeTest.test_id}/results`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setABTestData(resultsResponse.data);
      } else {
        setABTestData(null);
      }
    } catch (error) {
      console.error("Error fetching A/B test:", error);
      setABTestData(null);
    } finally {
      setLoadingABTest(false);
    }
  };

  const createABTest = async () => {
    if (!abTestVideo) return;
    setCreatingABTest(true);
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const response = await axios.post(
        `${API}/uploads/ab-test/create`,
        {
          video_id: abTestVideo.id || abTestVideo.video_id,
          creator_id: user?.user_id || user?.id
        },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      
      toast.success("A/B test created! Add thumbnail variants to start testing.");
      setABTestData({
        ...response.data,
        total_impressions: 0,
        total_clicks: 0,
        days_running: 0
      });
    } catch (error) {
      console.error("Error creating A/B test:", error);
      toast.error("Failed to create A/B test");
    } finally {
      setCreatingABTest(false);
    }
  };

  const uploadABVariant = async (e) => {
    const file = e.target.files[0];
    if (!file || !abTestData) return;
    
    setUploadingVariant(true);
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("creator_id", user?.user_id || user?.id);
      
      const response = await axios.post(
        `${API}/uploads/ab-test/${abTestData.test_id}/add-variant`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Thumbnail variant added!");
      
      // Refresh test data
      const resultsResponse = await axios.get(
        `${API}/uploads/ab-test/${abTestData.test_id}/results`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setABTestData(resultsResponse.data);
    } catch (error) {
      console.error("Error uploading variant:", error);
      toast.error(error.response?.data?.detail || "Failed to upload variant");
    } finally {
      setUploadingVariant(false);
    }
  };

  const selectABWinner = async (variantId) => {
    if (!abTestData) return;
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const formData = new FormData();
      formData.append("variant_id", variantId);
      
      await axios.post(
        `${API}/uploads/ab-test/${abTestData.test_id}/select-winner`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Winner selected! Thumbnail updated.");
      setShowABTest(false);
      
      // Refresh video list
      const userId = user?.user_id || user?.id;
      await fetchMyContent(token, userId);
    } catch (error) {
      console.error("Error selecting winner:", error);
      toast.error("Failed to select winner");
    }
  };

  // Revenue Dashboard Functions
  const fetchRevenue = async (period = "month") => {
    setLoadingRevenue(true);
    setRevenuePeriod(period);
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const creatorId = user?.user_id || user?.id;
      
      const response = await axios.get(
        `${API}/uploads/revenue/${creatorId}?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setRevenueData(response.data);
    } catch (error) {
      console.error("Error fetching revenue:", error);
      setRevenueData(null);
    } finally {
      setLoadingRevenue(false);
    }
  };

  // Fetch revenue when switching to revenue tab
  useEffect(() => {
    if (activeTab === "revenue" && user && !revenueData) {
      fetchRevenue(revenuePeriod);
    }
    if (activeTab === "collabs" && user && !collabsData) {
      fetchCollabs();
    }
  }, [activeTab, user]);

  // Smart Scheduling Functions
  const fetchSmartSuggestions = async () => {
    setLoadingSmartSuggestions(true);
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const creatorId = user?.user_id || user?.id;
      
      const response = await axios.get(
        `${API}/smart-scheduling/ai-suggestions/${creatorId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSmartSuggestions(response.data);
    } catch (error) {
      console.error("Error fetching smart suggestions:", error);
      setSmartSuggestions(null);
    } finally {
      setLoadingSmartSuggestions(false);
    }
  };

  // Collab Functions
  const fetchCollabs = async () => {
    setLoadingCollabs(true);
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      
      const response = await axios.get(
        `${API}/collabs/my-collabs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setCollabsData(response.data);
    } catch (error) {
      console.error("Error fetching collabs:", error);
      setCollabsData(null);
    } finally {
      setLoadingCollabs(false);
    }
  };

  const searchCreators = async (query) => {
    if (query.length < 2) {
      setCollabSearchResults([]);
      return;
    }
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      
      const response = await axios.get(
        `${API}/collabs/search/creators?q=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setCollabSearchResults(response.data.results || []);
    } catch (error) {
      console.error("Error searching creators:", error);
    }
  };

  const sendCollabInvite = async () => {
    if (!inviteCollabVideo || !selectedCollaborator) return;
    
    setSendingInvite(true);
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      
      await axios.post(
        `${API}/collabs/invite`,
        {
          video_id: inviteCollabVideo.id || inviteCollabVideo.video_id,
          invitee_email: selectedCollaborator.email,
          invitee_username: selectedCollaborator.username,
          revenue_split: collabRevenueSplit,
          cross_promote: true
        },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      
      toast.success(`Collaboration invite sent to ${selectedCollaborator.name}!`);
      setShowInviteCollab(false);
      setSelectedCollaborator(null);
      setCollabSearchQuery("");
      setCollabRevenueSplit(50);
      
      // Refresh collabs
      fetchCollabs();
    } catch (error) {
      console.error("Error sending invite:", error);
      toast.error(error.response?.data?.detail || "Failed to send invite");
    } finally {
      setSendingInvite(false);
    }
  };

  const respondToCollab = async (collabId, action) => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      
      await axios.post(
        `${API}/collabs/${collabId}/respond`,
        { action },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      
      toast.success(`Collaboration ${action}ed!`);
      fetchCollabs();
    } catch (error) {
      console.error("Error responding to collab:", error);
      toast.error(`Failed to ${action} collaboration`);
    }
  };

  // Open collab invite modal
  const openCollabInvite = (video) => {
    setInviteCollabVideo(video);
    setShowInviteCollab(true);
    setSelectedCollaborator(null);
    setCollabSearchQuery("");
    setCollabRevenueSplit(50);
  };

  // Open batch edit modal
  const openBatchEdit = () => {
    if (selectedVideos.length === 0) {
      toast.error("Please select at least one video to edit");
      return;
    }
    setBatchEditForm({
      applyTitle: false,
      titlePrefix: "",
      applyDescription: false,
      description: "",
      applyCategory: false,
      category: ""
    });
    setShowBatchEdit(true);
  };

  // Handle batch metadata update
  const handleBatchUpdate = async () => {
    if (selectedVideos.length === 0) {
      toast.error("No videos selected");
      return;
    }

    setSavingBatch(true);
    
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      
      // Build the request
      const videos = selectedVideos.map(videoId => {
        const video = myVideos.find(v => (v.id || v.video_id) === videoId);
        return {
          video_id: videoId,
          title: video?.title || null,
          description: null,
          category: null
        };
      });

      const applyToAll = {};
      if (batchEditForm.applyTitle && batchEditForm.titlePrefix) {
        applyToAll.title_prefix = batchEditForm.titlePrefix;
      }
      if (batchEditForm.applyDescription && batchEditForm.description) {
        applyToAll.description = batchEditForm.description;
      }
      if (batchEditForm.applyCategory && batchEditForm.category) {
        applyToAll.category = batchEditForm.category;
      }

      const response = await axios.post(
        `${API}/uploads/batch/metadata`,
        {
          videos,
          apply_to_all: Object.keys(applyToAll).length > 0 ? applyToAll : null
        },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      toast.success(`Updated ${response.data.updated_count} video${response.data.updated_count !== 1 ? 's' : ''}!`);
      
      if (response.data.failed_count > 0) {
        toast.warning(`${response.data.failed_count} video(s) could not be updated`);
      }

      // Refresh video list
      const userId = user?.user_id || user?.id;
      await fetchMyContent(token, userId);
      
      // Clear selection and close modal
      setSelectedVideos([]);
      setShowBatchEdit(false);
    } catch (error) {
      console.error("Batch update error:", error);
      toast.error(error.response?.data?.detail || "Failed to update videos");
    } finally {
      setSavingBatch(false);
    }
  };

  const copyShareLink = (bookingId) => {
    const link = `${window.location.origin}/watch?creator=${user?.user_id}&booking=${bookingId}`;
    navigator.clipboard.writeText(link);
    toast.success("Share link copied!");
  };

  // Open profile edit modal with current user data
  const openProfileEdit = () => {
    setProfileForm({
      name: user?.name || "",
      username: user?.username || "",
      bio: user?.bio || ""
    });
    setShowProfileEdit(true);
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    
    setSavingProfile(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const response = await axios.put(`${API}/auth/profile`, {
        name: profileForm.name.trim(),
        username: profileForm.username.trim() || undefined,
        bio: profileForm.bio.trim() || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local user state
      setUser(prev => ({
        ...prev,
        name: profileForm.name.trim(),
        username: profileForm.username.trim() || prev.username,
        bio: profileForm.bio.trim() || prev.bio
      }));
      
      // Update localStorage
      const storedUser = localStorage.getItem("ztvlive_user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        parsedUser.name = profileForm.name.trim();
        parsedUser.username = profileForm.username.trim() || parsedUser.username;
        parsedUser.bio = profileForm.bio.trim() || parsedUser.bio;
        localStorage.setItem("ztvlive_user", JSON.stringify(parsedUser));
      }
      
      toast.success("Profile updated successfully!");
      setShowProfileEdit(false);
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error(error.response?.data?.detail || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  const quickActions = [
    {
      title: "Watch Live",
      description: "Watch the 24/7 ZTVLIVE stream",
      icon: Tv,
      href: "/watch",  // Fixed: points to live stream, not game
      color: "from-blue-600 to-cyan-600"
    },
    {
      title: "Play Game",
      description: "Join the Unusual Fun Game!",
      icon: Gamepad2,
      href: "/play",  // This correctly goes to the game
      color: "from-yellow-500 to-orange-500"
    },
    {
      title: "Upload Content",
      description: "Add new videos to your library",
      icon: Upload,
      href: "/upload-and-earn",
      color: "from-red-600 to-orange-600"
    },
    {
      title: "Import Shorts/Reels",
      description: "TikTok, YT Shorts, IG Reels",
      icon: Sparkles,
      action: () => setShowSocialImport(true),
      color: "from-pink-600 to-rose-600"
    },
    {
      title: "Schedule Slot",
      description: "Book a time on the 24/7 stream",
      icon: Calendar,
      href: "/schedule-slot",
      color: "from-purple-600 to-pink-600"
    },
    {
      title: "Download App",
      description: "Get ZTVLIVE on Roku, Fire TV & more",
      icon: Download,
      href: "/download",
      color: "from-green-600 to-emerald-600"
    },
    {
      title: "View Analytics",
      description: "Track your content performance",
      icon: BarChart3,
      action: () => setActiveTab("stats"),
      color: "from-indigo-600 to-blue-600"
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/30 via-zinc-900 to-red-900/30 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={openProfileEdit}
                className="relative group cursor-pointer"
                data-testid="profile-edit-trigger"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-purple-600 flex items-center justify-center text-xl font-bold">
                  {user?.name?.charAt(0) || "C"}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">Welcome back, {user?.name?.split(' ')[0] || "Creator"}!</h1>
                  <button 
                    onClick={openProfileEdit}
                    className="text-zinc-400 hover:text-white transition-colors"
                    title="Edit Profile"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-zinc-400">
                  {user?.username ? `@${user.username} • ` : ""}Manage your content and grow your audience
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {notifications.length > 0 && (
                <Button variant="outline" className="border-yellow-700 text-yellow-400 relative">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full text-xs flex items-center justify-center">
                    {notifications.length}
                  </span>
                </Button>
              )}
              <Button asChild className="bg-red-600 hover:bg-red-700">
                <Link to="/upload-and-earn">
                  <Plus className="w-4 h-4 mr-2" />
                  Upload
                </Link>
              </Button>
              {/* Admin Access - Only show for admin users */}
              {user?.role === 'admin' && (
                <Button asChild variant="outline" className="border-purple-600 text-purple-400 hover:bg-purple-900/30">
                  <Link to="/admin/dashboard">
                    <Settings className="w-4 h-4 mr-2" />
                    Admin
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Agreement Warning */}
        {!agreementStatus.accepted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-yellow-400" />
              <div>
                <h3 className="font-semibold text-yellow-400">Creator Agreement Required</h3>
                <p className="text-sm text-zinc-400">Accept the creator agreement to start uploading content</p>
              </div>
            </div>
            <Button asChild className="bg-yellow-600 hover:bg-yellow-700">
              <Link to="/creator-agreement">
                <FileText className="w-4 h-4 mr-2" />
                Review & Accept
              </Link>
            </Button>
          </motion.div>
        )}

        {/* FEATURED: YouTube Bulk Import - Import Your Entire Library */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
          data-testid="youtube-import-featured-section"
        >
          <Card className="bg-gradient-to-r from-red-900/40 via-zinc-900 to-zinc-900 border border-red-800/50 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                {/* Icon and Header */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center shrink-0">
                    <Youtube className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      Import YouTube Channel
                      <Badge className="bg-red-600 text-xs">BULK</Badge>
                    </h3>
                    <p className="text-sm text-zinc-400">Bulk import all videos from any YouTube channel instantly</p>
                  </div>
                </div>

                {/* Inline Form */}
                <div className="flex-1 w-full">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                      <Input
                        placeholder="https://youtube.com/@YourChannelName"
                        value={ytChannelUrl}
                        onChange={(e) => setYtChannelUrl(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 h-12 text-base"
                        data-testid="youtube-channel-url-input"
                      />
                    </div>
                    <Button
                      onClick={handleYoutubeImport}
                      disabled={ytImporting || !ytChannelUrl.trim()}
                      className="bg-red-600 hover:bg-red-700 h-12 px-6 text-base font-semibold whitespace-nowrap"
                      data-testid="import-all-videos-btn"
                    >
                      {ytImporting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          Import All Videos
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    Tip: Copy your Creator ID from My Content below, or use your YouTube channel URL (e.g., youtube.com/@channel)
                  </p>
                </div>
              </div>

              {/* Import Result */}
              {ytImportResult && !ytImportResult.error && (
                <div className="mt-4 p-3 bg-emerald-900/30 border border-emerald-700 rounded-lg">
                  <p className="text-emerald-400 font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Import Successful! Imported {ytImportResult.import_results?.imported || 0} videos from {ytImportResult.channel?.title}
                  </p>
                </div>
              )}
              {ytImportResult?.error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                  <p className="text-red-400">Import failed: {ytImportResult.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {quickActions.map((action, idx) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              {action.href ? (
                <Link to={action.href}>
                  <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all hover:scale-[1.02] cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-3`}>
                        <action.icon className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold mb-1">{action.title}</h3>
                      <p className="text-xs text-zinc-500">{action.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ) : (
                <Card 
                  className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all hover:scale-[1.02] cursor-pointer h-full"
                  onClick={action.action}
                >
                  <CardContent className="p-4">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-3`}>
                      <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold mb-1">{action.title}</h3>
                    <p className="text-xs text-zinc-500">{action.description}</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Views</p>
                  <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Earnings</p>
                  <p className="text-2xl font-bold">${stats.totalEarnings.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-emerald-600/20 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Link to="/creator/library">
            <Card className="bg-zinc-900 border-zinc-800 hover:border-purple-600 cursor-pointer transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">My Videos</p>
                    <p className="text-2xl font-bold">{stats.totalVideos}</p>
                  </div>
                  <div className="p-2 bg-purple-600/20 rounded-lg">
                    <Video className="w-5 h-5 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Scheduled</p>
                  <p className="text-2xl font-bold">{stats.scheduledSlots}</p>
                </div>
                <div className="p-2 bg-red-600/20 rounded-lg">
                  <Calendar className="w-5 h-5 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Simplified Platform Analytics - YouTube vs ZTVLIVE Views */}
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border-zinc-800 mb-8" data-testid="platform-comparison-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Your Impact: YouTube vs ZTVLIVE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {/* YouTube Views */}
              <div className="flex-1 p-4 bg-red-900/20 border border-red-800/30 rounded-xl text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Youtube className="w-5 h-5 text-red-500" />
                  <span className="text-sm text-zinc-400">YouTube</span>
                </div>
                <p className="text-3xl font-bold text-white">{(stats.youtubeViews || 0).toLocaleString()}</p>
                <p className="text-xs text-zinc-500 mt-1">Total Views</p>
              </div>

              {/* VS Divider */}
              <div className="text-zinc-600 font-bold text-sm">VS</div>

              {/* ZTVLIVE Views */}
              <div className="flex-1 p-4 bg-emerald-900/20 border border-emerald-800/30 rounded-xl text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Tv className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm text-zinc-400">ZTVLIVE</span>
                  <Badge className="bg-emerald-600 text-[10px] px-1.5 py-0">LIVE</Badge>
                </div>
                <p className="text-3xl font-bold text-emerald-400">{stats.totalViews.toLocaleString()}</p>
                <p className="text-xs text-zinc-500 mt-1">Total Views</p>
              </div>
            </div>
            
            {/* Brief Advantage Note */}
            <p className="text-xs text-zinc-500 mt-3 text-center">
              ZTVLIVE pays <span className="text-emerald-400 font-medium">70% revenue share</span> vs YouTube's 55% — start earning from day one!
            </p>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-red-600">
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="content" className="data-[state=active]:bg-red-600">
              <Video className="w-4 h-4 mr-2" />
              My Content
            </TabsTrigger>
            <TabsTrigger value="revenue" className="data-[state=active]:bg-green-600">
              <DollarSign className="w-4 h-4 mr-2" />
              Revenue
            </TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-red-600">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="collabs" className="data-[state=active]:bg-purple-600">
              <Handshake className="w-4 h-4 mr-2" />
              Collabs
              {collabsData?.summary?.total_pending > 0 && (
                <span className="ml-1 w-5 h-5 bg-purple-600 rounded-full text-xs flex items-center justify-center">
                  {collabsData.summary.total_pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-red-600 relative">
              <Bell className="w-4 h-4 mr-2" />
              Alerts
              {notifications.length > 0 && (
                <span className="ml-1 w-5 h-5 bg-red-600 rounded-full text-xs flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Flagged Content Alerts - Show only if there are flagged videos */}
            {myVideos.filter(v => v.review_status === "flagged" || v.detected_issues?.length > 0).length > 0 && (
              <Card className="bg-red-900/20 border-red-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    Content Requires Attention
                  </CardTitle>
                  <CardDescription className="text-red-300/70">
                    Some of your content has been flagged. Here's how to fix it:
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {myVideos
                    .filter(v => v.review_status === "flagged" || v.detected_issues?.length > 0)
                    .slice(0, 3)
                    .map((video, idx) => (
                      <div key={idx} className="p-4 bg-zinc-900 rounded-lg border border-red-800/50">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold">{video.title || "Untitled Video"}</p>
                            <Badge className="bg-red-600 mt-1">Flagged for Review</Badge>
                          </div>
                        </div>
                        
                        {video.detected_issues?.map((issue, iIdx) => (
                          <div key={iIdx} className="mt-3 p-3 bg-zinc-800 rounded-lg">
                            <p className="text-sm font-medium text-yellow-400 mb-2">
                              ⚠️ {issue.details?.title || issue.type?.replace(/_/g, ' ').toUpperCase()}
                            </p>
                            <p className="text-xs text-zinc-400 mb-2">
                              {issue.details?.why_flagged || "This content may contain elements that need review."}
                            </p>
                            
                            {issue.matched_keywords?.length > 0 && (
                              <p className="text-xs text-zinc-500 mb-2">
                                Detected: {issue.matched_keywords.join(", ")}
                              </p>
                            )}
                            
                            <div className="mt-2 space-y-1">
                              <p className="text-xs font-semibold text-zinc-300">How to fix:</p>
                              {issue.details?.solutions?.slice(0, 2).map((sol, sIdx) => (
                                <p key={sIdx} className="text-xs text-emerald-400">
                                  Option {sol.option}: {sol.title} ({sol.difficulty})
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                        
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" className="border-red-700 text-red-400 hover:bg-red-900/50" asChild>
                            <Link to="/content-guidelines">View Guidelines</Link>
                          </Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" asChild>
                            <Link to="/upload">Re-upload Fixed Version</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* 24/7 Live Stream Schedule */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tv className="w-5 h-5 text-red-400" />
                    24/7 Live Stream Schedule
                    <Badge className="bg-red-600 text-xs animate-pulse">LIVE</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Currently Playing */}
                  {currentPlaying && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-red-900/30 to-zinc-800 rounded-lg border border-red-800/50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-xs text-red-400 font-medium">NOW PLAYING</span>
                      </div>
                      <p className="font-medium text-white truncate">{currentPlaying.title}</p>
                      <p className="text-xs text-zinc-400">
                        {currentPlaying.category?.replace(/_/g, ' ')} • {Math.floor((currentPlaying.playback_duration - currentPlaying.elapsed_seconds) / 60)}:{String(Math.floor((currentPlaying.playback_duration - currentPlaying.elapsed_seconds) % 60)).padStart(2, '0')} remaining
                      </p>
                    </div>
                  )}
                  
                  {/* Upcoming Schedule */}
                  {liveSchedule.length === 0 ? (
                    <div className="text-center py-4">
                      <Clock className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                      <p className="text-zinc-500 text-sm">Loading schedule...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-zinc-500 mb-2">UP NEXT</p>
                      {liveSchedule.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm truncate">{item.title}</p>
                            <p className="text-xs text-zinc-400">
                              {item.category?.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="text-sm text-emerald-400 font-mono">
                              {item.start_time?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
                            </p>
                          </div>
                        </div>
                      ))}
                      <Button asChild variant="ghost" className="w-full text-zinc-400 mt-2">
                        <Link to="/watch">
                          Watch Live <ChevronRight className="w-4 h-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Content */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Film className="w-5 h-5 text-purple-400" />
                    Recent Uploads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {myVideos.length === 0 ? (
                    <div className="text-center py-6">
                      <Upload className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-500 mb-3">No content uploaded yet</p>
                      <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-700">
                        <Link to="/upload-and-earn">Upload Content</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myVideos.slice(0, 3).map((video, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg">
                          <div className="w-16 h-10 bg-zinc-700 rounded overflow-hidden flex-shrink-0">
                            {video.thumbnail_url ? (
                              <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video className="w-5 h-5 text-zinc-500" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{video.title || "Untitled"}</p>
                            <p className="text-xs text-zinc-500">{formatDate(video.created_at)}</p>
                          </div>
                          <Badge className={
                            video.review_status === "approved" || video.status === "approved" 
                              ? "bg-emerald-600" 
                              : video.review_status === "flagged"
                                ? "bg-red-600"
                                : "bg-yellow-600"
                          }>
                            {video.review_status || video.status || "pending"}
                          </Badge>
                        </div>
                      ))}
                      <Link to="/creator/library" className="block">
                        <Button variant="ghost" className="w-full text-zinc-400">
                          View My Library <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tips & Resources */}
            <Card className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  Tips to Grow Your Audience
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-zinc-800/50 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Schedule Prime Time
                    </h4>
                    <p className="text-sm text-zinc-400">
                      Book slots during peak hours (7-10 PM) for maximum viewership.
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-purple-400" />
                      Share Your Slots
                    </h4>
                    <p className="text-sm text-zinc-400">
                      Promote your scheduled slots on social media to bring your audience.
                    </p>
                  </div>
                  <div className="p-4 bg-zinc-800/50 rounded-lg">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      Use Royalty-Free Music
                    </h4>
                    <p className="text-sm text-zinc-400">
                      Avoid copyright issues by using licensed music. See our guidelines.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <CardTitle>My Content Library</CardTitle>
                  {myVideos.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {myVideos.length} videos
                    </Badge>
                  )}
                  {/* Auto-refresh indicator */}
                  <span className="text-xs text-zinc-500 hidden md:inline">
                    Auto-refreshes every 10s
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Manual Refresh Button */}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={refreshVideos}
                    className="h-8"
                    data-testid="refresh-videos-btn"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  {/* Generate Thumbnails Button */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={generateAllThumbnails}
                    disabled={generatingThumbnails}
                    className="h-8 border-emerald-600 text-emerald-400 hover:bg-emerald-600/10"
                    data-testid="generate-thumbnails-btn"
                  >
                    {generatingThumbnails ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4 mr-1" />
                    )}
                    {generatingThumbnails ? "Generating..." : "Gen Thumbnails"}
                  </Button>
                  {selectedVideos.length > 0 && (
                    <Button 
                      onClick={openBatchEdit}
                      variant="outline" 
                      className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
                      data-testid="batch-edit-btn"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit {selectedVideos.length} Selected
                    </Button>
                  )}
                  <Button asChild className="bg-red-600 hover:bg-red-700">
                    <Link to="/upload-and-earn">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload New
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {myVideos.length === 0 ? (
                  <div className="text-center py-12">
                    <Video className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Content Yet</h3>
                    <p className="text-zinc-500 mb-4">Upload your first video to get started</p>
                    <Button asChild className="bg-red-600 hover:bg-red-700">
                      <Link to="/upload-and-earn">Upload Content</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Header Row with Save Order */}
                    <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedVideos.length === myVideos.length && myVideos.length > 0}
                            onChange={selectAllVideos}
                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500"
                          />
                          <span className="text-sm text-zinc-400">
                            {selectedVideos.length === myVideos.length ? "Deselect All" : "Select All"}
                          </span>
                        </label>
                        {selectedVideos.length > 0 && (
                          <span className="text-xs text-purple-400">
                            {selectedVideos.length} selected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500 hidden sm:inline">
                          <GripVertical className="w-3 h-3 inline mr-1" />
                          Drag to reorder
                        </span>
                        {hasOrderChanged && (
                          <Button 
                            size="sm" 
                            onClick={saveVideoOrder}
                            disabled={savingOrder}
                            className="bg-green-600 hover:bg-green-700 h-7 text-xs"
                          >
                            {savingOrder ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3 mr-1" />
                            )}
                            Save Order
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Draggable Video List */}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={myVideos.map(v => v.id || v.video_id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {myVideos.map((video, idx) => (
                            <SortableVideoItem
                              key={video.id || video.video_id}
                              video={video}
                              idx={idx}
                              isSelected={selectedVideos.includes(video.id || video.video_id)}
                              onToggleSelect={toggleVideoSelection}
                              onPreview={openVideoPreview}
                              onAnalytics={openVideoAnalytics}
                              onABTest={openABTest}
                              onCollabInvite={openCollabInvite}
                              formatDate={formatDate}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue Tab - Using modular component */}
          <TabsContent value="revenue">
            <RevenueTab user={user} />
          </TabsContent>

          {/* Schedule Tab - Using modular component */}
          <TabsContent value="schedule">
            <ScheduleTab 
              bookings={myBookings} 
              onCopyShareLink={(bookingId) => {
                const shareUrl = `${window.location.origin}/watch?slot=${bookingId}`;
                navigator.clipboard.writeText(shareUrl);
                toast.success("Share link copied!");
              }}
            />
          </TabsContent>

          {/* Collabs Tab */}
          <TabsContent value="collabs">
            <div className="space-y-6">
              {/* Smart Scheduling Card */}
              <Card className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-800/50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-blue-400" />
                      AI Smart Scheduling
                    </CardTitle>
                    <CardDescription>AI-powered optimal time suggestions based on your audience</CardDescription>
                  </div>
                  <Button 
                    onClick={fetchSmartSuggestions}
                    disabled={loadingSmartSuggestions}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loadingSmartSuggestions ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Lightbulb className="w-4 h-4 mr-2" />
                        Get Suggestions
                      </>
                    )}
                  </Button>
                </CardHeader>
                {smartSuggestions && (
                  <CardContent className="space-y-4">
                    {/* Insights */}
                    <div className="grid md:grid-cols-3 gap-4">
                      {smartSuggestions.insights?.map((insight, idx) => (
                        <div key={idx} className="bg-zinc-800/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            {insight.icon === "clock" && <Clock className="w-4 h-4 text-blue-400" />}
                            {insight.icon === "calendar" && <Calendar className="w-4 h-4 text-green-400" />}
                            {insight.icon === "trophy" && <Trophy className="w-4 h-4 text-yellow-400" />}
                            <span className="font-medium text-sm">{insight.title}</span>
                          </div>
                          <p className="text-xs text-zinc-400">{insight.description}</p>
                        </div>
                      ))}
                    </div>

                    {/* Recommended Slots */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        Recommended Time Slots
                      </h4>
                      <div className="space-y-2">
                        {smartSuggestions.recommended_slots?.slice(0, 3).map((slot, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="font-bold">{slot.day_name}</p>
                                <p className="text-xs text-zinc-500">{slot.date}</p>
                              </div>
                              <div className="text-center px-4 border-l border-zinc-700">
                                <p className="text-2xl font-bold text-blue-400">{slot.formatted_time}</p>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {slot.reasoning?.map((reason, i) => (
                                  <span key={i} className="text-xs bg-zinc-700 px-2 py-1 rounded">{reason}</span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className="bg-green-600">{Math.round(slot.confidence_score)}% Match</Badge>
                              <Button size="sm" className="ml-2 bg-purple-600 hover:bg-purple-700" asChild>
                                <Link to={`/schedule-slot?date=${slot.date}&hour=${slot.recommended_hour}`}>
                                  Book
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Data Quality Indicator */}
                    <div className="text-xs text-zinc-500 flex items-center gap-2">
                      <BarChart3 className="w-3 h-3" />
                      Analysis based on {smartSuggestions.analysis_based_on?.total_bookings || 0} broadcasts 
                      ({smartSuggestions.analysis_based_on?.data_quality} data quality)
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Collaborations Card */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Handshake className="w-5 h-5 text-purple-400" />
                      Creator Collaborations
                    </CardTitle>
                    <CardDescription>Partner with other creators to split revenue and cross-promote</CardDescription>
                  </div>
                  <Button 
                    onClick={() => fetchCollabs()}
                    variant="outline"
                    disabled={loadingCollabs}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingCollabs ? 'animate-spin' : ''}`} />
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingCollabs ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    </div>
                  ) : collabsData ? (
                    <div className="space-y-6">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-purple-400">{collabsData.summary?.total_active || 0}</p>
                          <p className="text-xs text-zinc-500">Active Collabs</p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-yellow-400">{collabsData.summary?.total_pending || 0}</p>
                          <p className="text-xs text-zinc-500">Pending Invites</p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-green-400">${collabsData.summary?.total_earnings?.toFixed(2) || '0.00'}</p>
                          <p className="text-xs text-zinc-500">Collab Earnings</p>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold">{collabsData.summary?.total_views?.toLocaleString() || 0}</p>
                          <p className="text-xs text-zinc-500">Total Views</p>
                        </div>
                      </div>

                      {/* Pending Invites */}
                      {collabsData.pending_invites?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Bell className="w-4 h-4 text-yellow-400" />
                            Pending Invites ({collabsData.pending_invites.length})
                          </h4>
                          <div className="space-y-2">
                            {collabsData.pending_invites.map((collab) => (
                              <div key={collab.collab_id} className="flex items-center justify-between p-4 bg-yellow-900/20 border border-yellow-800/30 rounded-lg">
                                <div className="flex items-center gap-4">
                                  <div className="w-16 h-10 bg-zinc-700 rounded overflow-hidden">
                                    {collab.video_thumbnail ? (
                                      <img src={collab.video_thumbnail} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Video className="w-4 h-4 text-zinc-500" />
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium">{collab.video_title}</p>
                                    <p className="text-sm text-zinc-400">
                                      From: {collab.owner_name} • Your share: {collab.invitee_revenue_split}%
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => respondToCollab(collab.collab_id, "accept")}
                                  >
                                    <Check className="w-4 h-4 mr-1" /> Accept
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => respondToCollab(collab.collab_id, "decline")}
                                  >
                                    <X className="w-4 h-4 mr-1" /> Decline
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active Collabs */}
                      {collabsData.active_collabs?.length > 0 ? (
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            Active Collaborations
                          </h4>
                          <div className="space-y-2">
                            {collabsData.active_collabs.map((collab) => (
                              <div key={collab.collab_id} className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                                <div className="flex items-center gap-4">
                                  <div className="w-16 h-10 bg-zinc-700 rounded overflow-hidden">
                                    {collab.video_thumbnail ? (
                                      <img src={collab.video_thumbnail} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Video className="w-4 h-4 text-zinc-500" />
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium">{collab.video_title}</p>
                                    <p className="text-sm text-zinc-400">
                                      With: {collab.my_role === "owner" ? collab.invitee_name : collab.owner_name}
                                      {" • "}
                                      Your share: {collab.my_split}%
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-green-400">${collab.my_earnings?.toFixed(2) || '0.00'}</p>
                                  <p className="text-xs text-zinc-500">{collab.total_views?.toLocaleString() || 0} views</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-zinc-800/30 rounded-lg">
                          <Handshake className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                          <h3 className="font-semibold mb-2">No Active Collaborations</h3>
                          <p className="text-sm text-zinc-500 mb-4">
                            Invite other creators to collaborate on your videos
                          </p>
                          <p className="text-xs text-zinc-600">
                            Go to My Content → Click the <UserPlus className="w-3 h-3 inline" /> icon on any video to invite
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Handshake className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Collaborations</h3>
                      <p className="text-zinc-500 mb-4">Partner with other creators</p>
                      <Button onClick={fetchCollabs} className="bg-purple-600 hover:bg-purple-700">
                        Load Collaborations
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notifications Tab - Using modular component */}
          <TabsContent value="notifications">
            <NotificationsTab 
              notifications={notifications}
              onExpandNotification={setExpandedNotification}
              formatDate={formatDate}
            />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* YouTube Import Modal */}
      {showYtImport && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                  <Youtube className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Import YouTube Channel</h2>
                  <p className="text-sm text-zinc-400">Bulk import all your YouTube videos</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowYtImport(false)}>
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Your YouTube Channel URL</label>
                <Input
                  placeholder="https://youtube.com/@YourChannelName"
                  value={ytChannelUrl}
                  onChange={(e) => setYtChannelUrl(e.target.value)}
                  className="bg-zinc-800 border-zinc-700"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Enter your channel URL (e.g., youtube.com/@channel or youtube.com/channel/UC...)
                </p>
              </div>
              
              {ytImportResult && !ytImportResult.error && (
                <div className="p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg">
                  <p className="text-emerald-400 font-semibold">✅ Import Successful!</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    Imported {ytImportResult.import_results?.imported || 0} videos from {ytImportResult.channel?.title}
                  </p>
                </div>
              )}
              
              {ytImportResult?.error && (
                <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
                  <p className="text-red-400">❌ {ytImportResult.error}</p>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleYoutubeImport}
                  disabled={ytImporting || !ytChannelUrl.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {ytImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Import All Videos
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowYtImport(false)} className="border-zinc-700">
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Social Video Import Modal (TikTok, YouTube Shorts, Instagram Reels) */}
      {showSocialImport && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Import Short Video</h2>
                  <p className="text-sm text-zinc-400">From TikTok, YouTube Shorts, or Instagram Reels</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowSocialImport(false)}>
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Video URL</label>
                <Input
                  placeholder="Paste TikTok, YouTube Shorts, or Instagram Reels link..."
                  value={socialImportUrl}
                  onChange={(e) => setSocialImportUrl(e.target.value)}
                  className="bg-zinc-800 border-zinc-700"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Supported: tiktok.com, youtube.com/shorts, instagram.com/reel
                </p>
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Output Resolution (for TV)</label>
                <div className="flex gap-2">
                  {["1280x720", "1920x1080", "3840x2160"].map(res => (
                    <Button
                      key={res}
                      variant={socialImportResolution === res ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSocialImportResolution(res)}
                      className={socialImportResolution === res ? "bg-purple-600" : "border-zinc-700"}
                    >
                      {res === "1280x720" ? "720p" : res === "1920x1080" ? "1080p" : "4K"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-zinc-800 rounded-lg text-sm">
                <p className="text-zinc-300 font-medium mb-1">Auto-Reframe for TV</p>
                <p className="text-zinc-500 text-xs">
                  Vertical videos (9:16) will be automatically reframed to horizontal (16:9) with a blurred background for the best big-screen experience.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSocialImport}
                  disabled={socialImporting || !socialImportUrl.trim()}
                  className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                >
                  {socialImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing & Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Import & Reframe
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowSocialImport(false)} className="border-zinc-700">
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Go Live Modal (YouTube/Facebook Live Embed) */}
      {showGoLive && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg flex items-center justify-center">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Go Live on ZTVLIVE</h2>
                  <p className="text-sm text-zinc-400">No RTMP needed - just paste your live link!</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowGoLive(false)}>
                ✕
              </Button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg">
                <p className="text-emerald-400 font-medium text-sm">How it works:</p>
                <ol className="text-xs text-zinc-400 mt-2 space-y-1 list-decimal list-inside">
                  <li>Start your live stream on YouTube or Facebook</li>
                  <li>Copy your live stream URL</li>
                  <li>Paste it below and click "Go Live"</li>
                  <li>Your stream appears on ZTVLIVE instantly!</li>
                </ol>
              </div>

              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Live Stream Title</label>
                <Input
                  placeholder="My Awesome Live Stream"
                  value={liveStreamTitle}
                  onChange={(e) => setLiveStreamTitle(e.target.value)}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Your Live Stream URL</label>
                <Input
                  placeholder="https://youtube.com/live/... or facebook.com/watch/..."
                  value={liveStreamUrl}
                  onChange={(e) => setLiveStreamUrl(e.target.value)}
                  className="bg-zinc-800 border-zinc-700"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Supported: YouTube Live, Facebook Live
                </p>
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleGoLive}
                  disabled={goingLive || !liveStreamUrl.trim()}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                >
                  {goingLive ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Go Live Now!
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowGoLive(false)} className="border-zinc-700">
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Current Live Session Banner */}
      {currentLiveSession && (
        <div className="fixed bottom-4 right-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-4 shadow-xl z-40 max-w-sm">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <div className="flex-1">
              <p className="font-semibold text-white">You're Live!</p>
              <p className="text-xs text-emerald-100">{currentLiveSession.title}</p>
            </div>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={handleEndLive}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              End Stream
            </Button>
          </div>
        </div>
      )}

      {/* Profile Edit Dialog */}
      <Dialog open={showProfileEdit} onOpenChange={setShowProfileEdit}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-red-500" />
              Edit Your Profile
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update your display name and username. These will be visible to other users.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Avatar Preview */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-purple-600 flex items-center justify-center text-3xl font-bold">
                {profileForm.name?.charAt(0) || "C"}
              </div>
            </div>
            
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="profile-name" className="text-zinc-300">Display Name *</Label>
              <Input
                id="profile-name"
                value={profileForm.name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your display name"
                className="bg-zinc-800 border-zinc-700"
                data-testid="profile-name-input"
              />
            </div>
            
            {/* Username Field */}
            <div className="space-y-2">
              <Label htmlFor="profile-username" className="text-zinc-300">Username</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">@</span>
                <Input
                  id="profile-username"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  placeholder="username"
                  className="bg-zinc-800 border-zinc-700 pl-8"
                  data-testid="profile-username-input"
                />
              </div>
              <p className="text-xs text-zinc-500">Only lowercase letters, numbers, and underscores allowed</p>
            </div>
            
            {/* Bio Field */}
            <div className="space-y-2">
              <Label htmlFor="profile-bio" className="text-zinc-300">Bio</Label>
              <Input
                id="profile-bio"
                value={profileForm.bio}
                onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell viewers about yourself..."
                className="bg-zinc-800 border-zinc-700"
                data-testid="profile-bio-input"
              />
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={() => setShowProfileEdit(false)}
              className="border-zinc-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveProfile}
              disabled={savingProfile || !profileForm.name.trim()}
              className="bg-red-600 hover:bg-red-700"
              data-testid="save-profile-btn"
            >
              {savingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Preview Modal */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-4xl bg-zinc-900 border-zinc-700 p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate pr-4">{previewVideo?.title || "Video Preview"}</span>
              <Badge className={
                previewVideo?.review_status === "approved" || previewVideo?.status === "approved"
                  ? "bg-emerald-600"
                  : previewVideo?.review_status === "flagged"
                    ? "bg-red-600"
                    : "bg-yellow-600"
              }>
                {previewVideo?.review_status || previewVideo?.status || "pending"}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Preview your video before scheduling
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            {previewVideo && (
              <div className="space-y-4">
                {/* Video Player - Instant Load */}
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                  {(previewVideo.video_url || previewVideo.file_url) && !videoLoadError ? (
                    <video 
                      key={previewVideo.id} // Force remount on video change
                      src={previewVideo.video_url || previewVideo.file_url}
                      controls 
                      autoPlay
                      playsInline
                      preload="auto"
                      className="w-full h-full"
                      data-testid="video-preview-player"
                      onLoadStart={() => {
                        setVideoLoadError(false);
                        console.log("Video loading:", previewVideo.video_url || previewVideo.file_url);
                      }}
                      onCanPlay={() => console.log("Video ready to play")}
                      onError={(e) => {
                        console.error("Video error:", e.target.error);
                        setVideoLoadError(true);
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 p-6">
                      <Video className="w-16 h-16 mb-4 opacity-50" />
                      {videoLoadError ? (
                        <>
                          <p className="text-red-400 font-medium">Video file not found</p>
                          <p className="text-xs mt-2 text-center max-w-md">
                            The video file may have been uploaded to a different server or is still being processed.
                          </p>
                          <div className="mt-4 p-3 bg-zinc-800 rounded-lg text-xs">
                            <p className="text-zinc-400">Video URL:</p>
                            <p className="text-zinc-500 break-all mt-1">{previewVideo.video_url || previewVideo.file_url}</p>
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
                  )}
                </div>
                
                {/* Video Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500">Duration:</span>
                    <span className="ml-2 text-white">
                      {previewVideo.duration_seconds 
                        ? `${Math.floor(previewVideo.duration_seconds / 60)}:${String(previewVideo.duration_seconds % 60).padStart(2, '0')}`
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
                    <span className="text-zinc-500">Views:</span>
                    <span className="ml-2 text-white">{previewVideo.views || 0}</span>
                  </div>
                </div>
                
                {/* Description */}
                {previewVideo.description && (
                  <div className="text-sm">
                    <span className="text-zinc-500">Description:</span>
                    <p className="mt-1 text-zinc-300">{previewVideo.description}</p>
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <Button variant="outline" onClick={() => setPreviewVideo(null)}>
                    Close
                  </Button>
                  <Button asChild className="bg-purple-600 hover:bg-purple-700">
                    <Link to={`/schedule-slot?video=${previewVideo.id}`}>
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule This Video
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Edit Modal */}
      <Dialog open={showBatchEdit} onOpenChange={setShowBatchEdit}>
        <DialogContent className="max-w-lg bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-purple-400" />
              Batch Edit {selectedVideos.length} Video{selectedVideos.length !== 1 ? 's' : ''}
            </DialogTitle>
            <DialogDescription>
              Apply changes to all selected videos at once
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Title Prefix */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="applyTitle"
                  checked={batchEditForm.applyTitle}
                  onChange={(e) => setBatchEditForm(prev => ({ ...prev, applyTitle: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500"
                />
                <Label htmlFor="applyTitle" className="font-medium cursor-pointer">
                  Add Title Prefix
                </Label>
              </div>
              {batchEditForm.applyTitle && (
                <Input
                  placeholder="e.g., [ZTVLIVE] or Season 1 -"
                  value={batchEditForm.titlePrefix}
                  onChange={(e) => setBatchEditForm(prev => ({ ...prev, titlePrefix: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700"
                />
              )}
            </div>

            {/* Description */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="applyDescription"
                  checked={batchEditForm.applyDescription}
                  onChange={(e) => setBatchEditForm(prev => ({ ...prev, applyDescription: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500"
                />
                <Label htmlFor="applyDescription" className="font-medium cursor-pointer">
                  Set Same Description
                </Label>
              </div>
              {batchEditForm.applyDescription && (
                <Textarea
                  placeholder="Enter description for all selected videos..."
                  value={batchEditForm.description}
                  onChange={(e) => setBatchEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 min-h-[100px]"
                />
              )}
            </div>

            {/* Category */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="applyCategory"
                  checked={batchEditForm.applyCategory}
                  onChange={(e) => setBatchEditForm(prev => ({ ...prev, applyCategory: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500"
                />
                <Label htmlFor="applyCategory" className="font-medium cursor-pointer">
                  Set Same Category
                </Label>
              </div>
              {batchEditForm.applyCategory && (
                <select
                  value={batchEditForm.category}
                  onChange={(e) => setBatchEditForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select a category</option>
                  <option value="entertainment">Entertainment</option>
                  <option value="music">Music</option>
                  <option value="comedy">Comedy</option>
                  <option value="news">News</option>
                  <option value="sports">Sports</option>
                  <option value="education">Education</option>
                  <option value="documentary">Documentary</option>
                  <option value="lifestyle">Lifestyle</option>
                  <option value="gaming">Gaming</option>
                  <option value="tech">Technology</option>
                  <option value="other">Other</option>
                </select>
              )}
            </div>

            {/* Selected Videos Preview */}
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-2">Selected videos:</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedVideos.map((videoId, idx) => {
                  const video = myVideos.find(v => (v.id || v.video_id) === videoId);
                  return (
                    <div key={videoId} className="text-sm text-zinc-300 truncate flex items-center gap-2">
                      <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                      <span className="truncate">{video?.title || videoId}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
            <Button variant="outline" onClick={() => setShowBatchEdit(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBatchUpdate}
              disabled={savingBatch || (!batchEditForm.applyTitle && !batchEditForm.applyDescription && !batchEditForm.applyCategory)}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="batch-save-btn"
            >
              {savingBatch ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Apply Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Analytics Modal */}
      <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LineChart className="w-5 h-5 text-blue-400" />
              Video Analytics
            </DialogTitle>
            <DialogDescription>
              {analyticsVideo?.title || "Video performance metrics"}
            </DialogDescription>
          </DialogHeader>
          
          {loadingAnalytics ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : analyticsData ? (
            <div className="space-y-6 py-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-800 rounded-lg p-4 text-center">
                  <Eye className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{analyticsData.metrics?.total_views?.toLocaleString() || 0}</p>
                  <p className="text-xs text-zinc-500">Total Views</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-4 text-center">
                  <ThumbsUp className="w-5 h-5 text-green-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{analyticsData.metrics?.total_likes?.toLocaleString() || 0}</p>
                  <p className="text-xs text-zinc-500">Total Likes</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-4 text-center">
                  <Share2 className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{analyticsData.metrics?.total_shares?.toLocaleString() || 0}</p>
                  <p className="text-xs text-zinc-500">Shares</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-4 text-center">
                  <MessageCircle className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{analyticsData.metrics?.total_comments?.toLocaleString() || 0}</p>
                  <p className="text-xs text-zinc-500">Comments</p>
                </div>
              </div>

              {/* Engagement Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Engagement Rate</p>
                  <p className="text-xl font-bold text-green-400">{analyticsData.metrics?.engagement_rate || 0}%</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Avg Watch Time</p>
                  <p className="text-xl font-bold">
                    {analyticsData.metrics?.avg_watch_time_seconds 
                      ? `${Math.floor(analyticsData.metrics.avg_watch_time_seconds / 60)}:${String(analyticsData.metrics.avg_watch_time_seconds % 60).padStart(2, '0')}`
                      : "0:00"
                    }
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Completion Rate</p>
                  <p className="text-xl font-bold text-blue-400">{analyticsData.metrics?.completion_rate || 0}%</p>
                </div>
              </div>

              {/* Trend */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Performance Trend</h4>
                  <div className="flex items-center gap-1">
                    {analyticsData.performance?.views_trend === "up" ? (
                      <>
                        <ArrowUp className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400">Trending Up</span>
                      </>
                    ) : analyticsData.performance?.views_trend === "down" ? (
                      <>
                        <ArrowDown className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-400">Trending Down</span>
                      </>
                    ) : (
                      <span className="text-sm text-zinc-400">Stable</span>
                    )}
                  </div>
                </div>
                
                {/* Mini Chart (bar representation) */}
                <div className="flex items-end gap-1 h-24">
                  {(analyticsData.performance?.daily_history || []).slice(-14).map((day, i) => {
                    const maxViews = Math.max(...(analyticsData.performance?.daily_history || []).map(d => d.views || 1));
                    const height = ((day.views || 0) / maxViews) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className="w-full bg-blue-500/60 rounded-t hover:bg-blue-500 transition-colors"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${day.date}: ${day.views} views`}
                        />
                        {i % 2 === 0 && (
                          <span className="text-[8px] text-zinc-600">{day.date?.slice(-2)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex justify-between mt-2 text-xs text-zinc-500">
                  <span>14 Day History</span>
                  <span>Weekly Avg: {analyticsData.performance?.weekly_avg_views || 0} views/day</span>
                </div>
              </div>

              {/* Schedule Info */}
              {analyticsData.schedule_info && (
                <div className="bg-zinc-800/30 rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Schedule History
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-500">Times Scheduled</p>
                      <p className="font-medium">{analyticsData.schedule_info.times_scheduled || 0}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Last Aired</p>
                      <p className="font-medium">
                        {analyticsData.schedule_info.last_aired 
                          ? formatDate(analyticsData.schedule_info.last_aired)
                          : "Never"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Next Scheduled</p>
                      <p className="font-medium">
                        {analyticsData.schedule_info.next_scheduled 
                          ? formatDate(analyticsData.schedule_info.next_scheduled)
                          : "Not scheduled"
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              No analytics data available
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="outline" onClick={() => setShowAnalytics(false)}>
              Close
            </Button>
            {analyticsVideo && (
              <Button asChild className="bg-purple-600 hover:bg-purple-700">
                <Link to={`/schedule-slot?video=${analyticsVideo.id || analyticsVideo.video_id}`}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Video
                </Link>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* A/B Thumbnail Testing Modal */}
      <Dialog open={showABTest} onOpenChange={setShowABTest}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImagePlus className="w-5 h-5 text-purple-400" />
              A/B Thumbnail Testing
            </DialogTitle>
            <DialogDescription>
              {abTestVideo?.title || "Test different thumbnails to find the best performer"}
            </DialogDescription>
          </DialogHeader>
          
          <input
            ref={abTestFileRef}
            type="file"
            accept="image/*"
            onChange={uploadABVariant}
            className="hidden"
          />
          
          {loadingABTest ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : abTestData ? (
            <div className="space-y-6 py-4">
              {/* Test Status */}
              <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <Badge className={abTestData.status === "active" ? "bg-green-600" : "bg-zinc-600"}>
                    {abTestData.status}
                  </Badge>
                  <span className="text-sm text-zinc-400">Running for {abTestData.days_running} days</span>
                </div>
                <div className="text-sm text-zinc-400">
                  {abTestData.total_impressions?.toLocaleString()} impressions • {abTestData.total_clicks?.toLocaleString()} clicks
                </div>
              </div>

              {/* Variants Grid */}
              <div className="grid grid-cols-2 gap-4">
                {(abTestData.variants || []).map((variant, idx) => (
                  <div 
                    key={variant.variant_id}
                    className={`rounded-lg overflow-hidden border-2 transition-all ${
                      variant.performance === "winner" 
                        ? 'border-yellow-500 bg-yellow-900/10' 
                        : abTestData.winner === variant.variant_id
                          ? 'border-green-500 bg-green-900/10'
                          : 'border-zinc-700 bg-zinc-800/50'
                    }`}
                  >
                    <div className="aspect-video bg-zinc-700 relative">
                      {variant.thumbnail_url ? (
                        <img 
                          src={variant.thumbnail_url} 
                          alt={`Variant ${idx}`} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImagePlus className="w-8 h-8 text-zinc-500" />
                        </div>
                      )}
                      {variant.is_original && (
                        <Badge className="absolute top-2 left-2 bg-blue-600 text-xs">Original</Badge>
                      )}
                      {variant.performance === "winner" && (
                        <Badge className="absolute top-2 right-2 bg-yellow-600 text-xs flex items-center gap-1">
                          <Trophy className="w-3 h-3" /> Leading
                        </Badge>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-sm">{variant.variant_id}</span>
                        <span className="text-lg font-bold text-green-400">{variant.ctr || 0}% CTR</span>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>{variant.impressions?.toLocaleString() || 0} impressions</span>
                        <span>{variant.clicks?.toLocaleString() || 0} clicks</span>
                      </div>
                      {abTestData.status === "active" && (
                        <Button 
                          size="sm" 
                          className="w-full mt-3 bg-green-600 hover:bg-green-700"
                          onClick={() => selectABWinner(variant.variant_id)}
                        >
                          <Trophy className="w-3 h-3 mr-1" />
                          Select as Winner
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Add Variant Card */}
                {abTestData.status === "active" && (abTestData.variants?.length || 0) < 4 && (
                  <div 
                    onClick={() => abTestFileRef.current?.click()}
                    className="rounded-lg border-2 border-dashed border-zinc-700 hover:border-purple-500 bg-zinc-800/30 hover:bg-purple-900/10 cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px]"
                  >
                    {uploadingVariant ? (
                      <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    ) : (
                      <>
                        <ImagePlus className="w-10 h-10 text-zinc-500 mb-2" />
                        <p className="text-sm text-zinc-400">Add Thumbnail Variant</p>
                        <p className="text-xs text-zinc-600">{4 - (abTestData.variants?.length || 0)} slots remaining</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* CTR Comparison Bar */}
              <div className="bg-zinc-800/30 rounded-lg p-4">
                <h4 className="font-medium mb-3">Performance Comparison</h4>
                <div className="space-y-2">
                  {(abTestData.variants || []).map((variant) => {
                    const maxCTR = Math.max(...(abTestData.variants || []).map(v => v.ctr || 1));
                    const width = ((variant.ctr || 0) / maxCTR) * 100;
                    return (
                      <div key={variant.variant_id} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400 w-20 truncate">{variant.variant_id}</span>
                        <div className="flex-1 h-4 bg-zinc-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              variant.performance === "winner" ? 'bg-yellow-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${Math.max(width, 2)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-16 text-right">{variant.ctr || 0}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <ImagePlus className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No A/B Test Running</h3>
              <p className="text-zinc-500 mb-6">Start an A/B test to compare different thumbnails and improve click-through rates</p>
              <Button 
                onClick={createABTest}
                disabled={creatingABTest}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {creatingABTest ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <ImagePlus className="w-4 h-4 mr-2" />
                    Start A/B Test
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="outline" onClick={() => setShowABTest(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Collab Invite Modal */}
      <Dialog open={showInviteCollab} onOpenChange={setShowInviteCollab}>
        <DialogContent className="max-w-lg bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-green-400" />
              Invite Collaborator
            </DialogTitle>
            <DialogDescription>
              {inviteCollabVideo?.title || "Share revenue with another creator"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Video Preview */}
            {inviteCollabVideo && (
              <div className="flex items-center gap-4 p-3 bg-zinc-800/50 rounded-lg">
                <div className="w-20 h-12 bg-zinc-700 rounded overflow-hidden">
                  {inviteCollabVideo.thumbnail_url ? (
                    <img src={inviteCollabVideo.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-5 h-5 text-zinc-500" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium">{inviteCollabVideo.title || "Untitled"}</p>
                  <p className="text-xs text-zinc-500">{inviteCollabVideo.views || 0} views</p>
                </div>
              </div>
            )}

            {/* Search Creators */}
            <div className="space-y-2">
              <Label>Search Creator</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Search by username or email..."
                  value={collabSearchQuery}
                  onChange={(e) => {
                    setCollabSearchQuery(e.target.value);
                    searchCreators(e.target.value);
                  }}
                  className="pl-10 bg-zinc-800 border-zinc-700"
                />
              </div>
              
              {/* Search Results */}
              {collabSearchResults.length > 0 && (
                <div className="bg-zinc-800 rounded-lg max-h-40 overflow-y-auto">
                  {collabSearchResults.map((creator) => (
                    <div
                      key={creator.user_id}
                      onClick={() => {
                        setSelectedCollaborator(creator);
                        setCollabSearchResults([]);
                        setCollabSearchQuery(creator.name || creator.username);
                      }}
                      className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-700 ${
                        selectedCollaborator?.user_id === creator.user_id ? 'bg-purple-900/30' : ''
                      }`}
                    >
                      <div className="w-8 h-8 bg-zinc-600 rounded-full flex items-center justify-center">
                        {creator.profile_pic ? (
                          <img src={creator.profile_pic} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{creator.name || creator.username}</p>
                        <p className="text-xs text-zinc-500">@{creator.username}</p>
                      </div>
                      {creator.is_verified && (
                        <Badge className="bg-blue-600 text-xs">Verified</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Collaborator */}
            {selectedCollaborator && (
              <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="font-medium">{selectedCollaborator.name || selectedCollaborator.username}</p>
                    <p className="text-xs text-zinc-500">@{selectedCollaborator.username}</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => {
                    setSelectedCollaborator(null);
                    setCollabSearchQuery("");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Revenue Split */}
            <div className="space-y-3">
              <Label>Revenue Split</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-zinc-800/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-400">{100 - collabRevenueSplit}%</p>
                  <p className="text-xs text-zinc-500">You</p>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={collabRevenueSplit}
                  onChange={(e) => setCollabRevenueSplit(parseInt(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex-1 bg-zinc-800/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{collabRevenueSplit}%</p>
                  <p className="text-xs text-zinc-500">Collaborator</p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-zinc-800/30 rounded-lg p-3 text-xs text-zinc-500">
              <p className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                Cross-promotion enabled - both channels will be featured
              </p>
              <p className="flex items-center gap-2">
                <DollarSign className="w-3 h-3 text-yellow-400" />
                Revenue is split automatically based on the percentage above
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button variant="outline" onClick={() => setShowInviteCollab(false)}>
              Cancel
            </Button>
            <Button 
              onClick={sendCollabInvite}
              disabled={!selectedCollaborator || sendingInvite}
              className="bg-green-600 hover:bg-green-700"
            >
              {sendingInvite ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Invite
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Notification Message Modal */}
      <Dialog open={!!expandedNotification} onOpenChange={() => setExpandedNotification(null)}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-400" />
              {expandedNotification?.subject}
            </DialogTitle>
            <DialogDescription>
              {expandedNotification?.created_at && formatDate(expandedNotification.created_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-zinc-800 rounded-lg p-4 max-h-96 overflow-y-auto">
              <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {expandedNotification?.body}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setExpandedNotification(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorDashboard;
