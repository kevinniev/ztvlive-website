import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { 
  Tv, Menu, X, Shield, CheckCircle, XCircle, Clock, Play, 
  MessageSquare, Video, Radio, Settings, Users, TrendingUp,
  Eye, EyeOff, Pin, Trash2, RefreshCw, AlertTriangle, Zap,
  ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Newspaper,
  Sparkles, Loader2, BarChart2, DollarSign, Target, Calendar,
  Link2, Copy, Send, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const API = '/api';

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

export default function AdminDashboard() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [streamSubmissions, setStreamSubmissions] = useState([]);
  const [contentSubmissions, setContentSubmissions] = useState([]);
  const [pendingComments, setPendingComments] = useState([]);
  const [liveCommentSettings, setLiveCommentSettings] = useState({ comments_enabled: true });
  const [globalCommentSettings, setGlobalCommentSettings] = useState({ comments_enabled: true });
  const [customTitle, setCustomTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedSubmission, setExpandedSubmission] = useState(null);
  const [newsApiStatus, setNewsApiStatus] = useState(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Creator Scheduling State
  const [pendingBookings, setPendingBookings] = useState([]);
  const [creatorInvites, setCreatorInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(null);
  
  // RTMP Roku Stream State
  const [rtmpStatus, setRtmpStatus] = useState({ status: 'unknown' });
  const [rtmpLoading, setRtmpLoading] = useState(false);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  
  // Set admin-specific manifest for PWA
  useEffect(() => {
    // Update manifest link for admin app
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.href = '/admin-manifest.json';
    } else {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/admin-manifest.json';
      document.head.appendChild(manifestLink);
    }
    
    // Restore original manifest on unmount
    return () => {
      if (manifestLink) {
        manifestLink.href = '/manifest.json';
      }
    };
  }, []);
  
  // PWA Install listener
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  
  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('Admin app installed!');
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  // RTMP Roku Stream Functions
  const fetchRtmpStatus = async () => {
    try {
      const res = await axios.get(`${API}/rtmp/status`);
      setRtmpStatus(res.data);
    } catch (error) {
      setRtmpStatus({ status: 'error', message: 'Failed to fetch status' });
    }
  };

  const startRtmpStream = async () => {
    setRtmpLoading(true);
    try {
      const res = await axios.post(`${API}/rtmp/start`);
      toast.success('RTMP stream starting! Check Castr.io in ~30 seconds.');
      setRtmpStatus({ status: 'starting', ...res.data });
      // Check status after 30 seconds
      setTimeout(fetchRtmpStatus, 30000);
    } catch (error) {
      toast.error('Failed to start RTMP stream');
      console.error(error);
    } finally {
      setRtmpLoading(false);
    }
  };

  const stopRtmpStream = async () => {
    setRtmpLoading(true);
    try {
      await axios.post(`${API}/rtmp/stop`);
      toast.success('RTMP stream stopped');
      setRtmpStatus({ status: 'stopped' });
    } catch (error) {
      toast.error('Failed to stop RTMP stream');
    } finally {
      setRtmpLoading(false);
    }
  };

  // Fetch RTMP status on mount
  useEffect(() => {
    fetchRtmpStatus();
    const interval = setInterval(fetchRtmpStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashboardRes, streamsRes, contentRes, commentsRes, newsApiRes] = await Promise.all([
        axios.get(`${API}/admin/dashboard`),
        axios.get(`${API}/stream/submissions?limit=20`),
        axios.get(`${API}/admin/submissions/content?limit=20`),
        axios.get(`${API}/admin/comments/pending?limit=20`),
        axios.get(`${API}/newsapi/status`).catch(() => ({ data: null })),
      ]);
      
      setDashboard(dashboardRes.data);
      setStreamSubmissions(streamsRes.data.submissions || []);
      setContentSubmissions(contentRes.data.submissions || []);
      setPendingComments(commentsRes.data.comments || []);
      setLiveCommentSettings(dashboardRes.data.settings?.live_comments || { comments_enabled: true });
      setGlobalCommentSettings(dashboardRes.data.settings?.global_comments || { comments_enabled: true });
      setNewsApiStatus(newsApiRes.data);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchSchedulingData();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // Fetch scheduling data (bookings and invites)
  const fetchSchedulingData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const [bookingsRes, invitesRes] = await Promise.all([
        axios.get(`${API}/creator-schedule/admin/pending`, { headers }).catch(() => ({ data: { pending_bookings: [] } })),
        axios.get(`${API}/creator-schedule/admin/invites`, { headers }).catch(() => ({ data: { invites: [] } }))
      ]);
      
      setPendingBookings(bookingsRes.data.pending_bookings || []);
      setCreatorInvites(invitesRes.data.invites || []);
    } catch (error) {
      console.error("Error fetching scheduling data:", error);
    }
  };

  // Create invite link for a creator
  const handleCreateInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter creator email");
      return;
    }
    
    setCreatingInvite(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API}/creator-schedule/invite/create`,
        {
          creator_email: inviteEmail,
          creator_name: inviteName || inviteEmail.split("@")[0],
          message: "You've been invited to schedule content on ZTVLIVE!",
          expires_in_days: 7
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Invite link created!");
      setInviteEmail("");
      setInviteName("");
      fetchSchedulingData();
      
      // Copy to clipboard
      await navigator.clipboard.writeText(res.data.invite_url);
      toast.success("Invite link copied to clipboard!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create invite");
    } finally {
      setCreatingInvite(false);
    }
  };

  // Approve a booking
  const handleApproveBooking = async (bookingId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/creator-schedule/admin/approve/${bookingId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Booking approved!");
      fetchSchedulingData();
    } catch (error) {
      toast.error("Failed to approve booking");
    }
  };

  // Reject a booking
  const handleRejectBooking = async (bookingId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/creator-schedule/admin/reject/${bookingId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Booking rejected");
      fetchSchedulingData();
    } catch (error) {
      toast.error("Failed to reject booking");
    }
  };

  // Copy invite link
  const copyInviteLink = async (invite) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/schedule-slot?invite=${invite.invite_token}`;
    await navigator.clipboard.writeText(link);
    setCopiedInvite(invite.invite_token);
    toast.success("Invite link copied!");
    setTimeout(() => setCopiedInvite(null), 2000);
  };

  const handleApproveStream = async (submissionId) => {
    try {
      await axios.patch(`${API}/stream/submissions/${submissionId}/approve`);
      toast.success("Stream approved!");
      fetchDashboard();
    } catch (error) {
      toast.error("Failed to approve stream");
    }
  };

  const handleRejectStream = async (submissionId) => {
    try {
      await axios.patch(`${API}/stream/submissions/${submissionId}/reject`);
      toast.success("Stream rejected");
      fetchDashboard();
    } catch (error) {
      toast.error("Failed to reject stream");
    }
  };

  const handleGoLive = async (submissionId) => {
    try {
      const res = await axios.post(`${API}/stream/go-live/${submissionId}`);
      toast.success(res.data.message);
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to go live");
    }
  };

  const handleStopLive = async () => {
    try {
      await axios.post(`${API}/stream/stop-live`);
      toast.success("Live stream stopped");
      fetchDashboard();
    } catch (error) {
      toast.error("Failed to stop stream");
    }
  };

  const handleSetTitle = async () => {
    if (!customTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }
    try {
      await axios.post(`${API}/admin/set-live-title?title=${encodeURIComponent(customTitle)}`);
      toast.success("Title updated!");
      setCustomTitle("");
      fetchDashboard();
    } catch (error) {
      toast.error("Failed to update title");
    }
  };

  const handleToggleLiveComments = async () => {
    try {
      const newValue = !liveCommentSettings.comments_enabled;
      await axios.put(`${API}/admin/comments/settings/live_stream`, {
        comments_enabled: newValue
      });
      setLiveCommentSettings({ ...liveCommentSettings, comments_enabled: newValue });
      toast.success(`Live comments ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error("Failed to update settings");
    }
  };

  const handleToggleGlobalComments = async () => {
    try {
      const newValue = !globalCommentSettings.comments_enabled;
      await axios.put(`${API}/admin/comments/settings/global`, {
        comments_enabled: newValue
      });
      setGlobalCommentSettings({ ...globalCommentSettings, comments_enabled: newValue });
      toast.success(`Global comments ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error("Failed to update settings");
    }
  };

  const handleApproveComment = async (commentId) => {
    try {
      await axios.post(`${API}/admin/comments/${commentId}/show`);
      toast.success("Comment approved");
      fetchDashboard();
    } catch (error) {
      toast.error("Failed to approve comment");
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await axios.delete(`${API}/admin/comments/${commentId}`);
      toast.success("Comment deleted");
      fetchDashboard();
    } catch (error) {
      toast.error("Failed to delete comment");
    }
  };

  const handleContentSubmissionAction = async (submissionId, status) => {
    try {
      await axios.patch(`${API}/submissions/${submissionId}?status=${status}`);
      toast.success(`Submission ${status}`);
      fetchDashboard();
    } catch (error) {
      toast.error("Failed to update submission");
    }
  };

  const handleGenerateFreshContent = async () => {
    setGeneratingContent(true);
    try {
      if (selectedCategory === "all") {
        // Trigger generation for all categories
        const res = await axios.post(`${API}/ai/scheduler/trigger-all`);
        toast.success(`Generated ${res.data.total_generated} fresh content items using real trending news!`);
      } else {
        // Trigger generation for specific category
        const res = await axios.post(`${API}/ai/scheduler/trigger/${selectedCategory}`);
        toast.success(`Generated ${res.data.generated} fresh ${selectedCategory} content!`);
      }
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to generate content");
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleGenerateSingleHighlight = async (category) => {
    try {
      const res = await axios.post(`${API}/ai/generate-highlight?category=${category}`);
      toast.success(`Generated: ${res.data.highlight.title.substring(0, 50)}...`);
      fetchDashboard();
    } catch (error) {
      toast.error("Failed to generate highlight");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "needs_review":
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge className="bg-zinc-600">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading Admin Dashboard...</p>
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
            <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
              <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center">
                <Tv className="w-6 h-6" />
              </div>
              <span className="font-heading text-2xl tracking-wider">ZTV LIVE</span>
              <Badge className="bg-violet-600 ml-2">ADMIN</Badge>
            </Link>
            
            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm text-zinc-400 hover:text-white transition-colors">HOME</Link>
              <Link to="/watch" className="text-sm text-zinc-400 hover:text-white transition-colors">WATCH</Link>
              <Link to="/library" className="text-sm text-zinc-400 hover:text-white transition-colors">LIBRARY</Link>
              <Link to="/admin" className="text-sm text-white">ADMIN</Link>
            </div>
            
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-heading text-4xl tracking-tight uppercase flex items-center gap-3">
                  <Shield className="w-10 h-10 text-violet-400" />
                  ADMIN DASHBOARD
                </h1>
                <p className="text-zinc-400 mt-2">Manage streams, comments, and content submissions</p>
              </div>
              <div className="flex items-center gap-2">
                {showInstallBtn && (
                  <Button onClick={installApp} className="bg-violet-600 hover:bg-violet-500">
                    <Zap className="w-4 h-4 mr-2" />
                    Install App
                  </Button>
                )}
                <Button onClick={fetchDashboard} variant="outline" className="border-zinc-700">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardDescription className="text-zinc-500">Stream Submissions</CardDescription>
                <CardTitle className="text-3xl font-heading text-red-400">
                  {dashboard?.stream_submissions?.total || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-400">{dashboard?.stream_submissions?.approved || 0} approved</span>
                  <span className="text-yellow-400">{dashboard?.stream_submissions?.pending || 0} pending</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardDescription className="text-zinc-500">Total Content</CardDescription>
                <CardTitle className="text-3xl font-heading text-blue-400">
                  {(dashboard?.content?.archived_videos || 0) + 
                   (dashboard?.content?.ai_generated || 0) + 
                   (dashboard?.content?.mock_highlights || 0)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 text-xs">
                  <span className="text-violet-400">{dashboard?.content?.in_rotation || 0} in rotation</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardDescription className="text-zinc-500">Total Comments</CardDescription>
                <CardTitle className="text-3xl font-heading text-green-400">
                  {dashboard?.comments?.total || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 text-xs">
                  <span className="text-amber-400">{dashboard?.comments?.pending_approval || 0} pending</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-2">
                <CardDescription className="text-zinc-500">Content Submissions</CardDescription>
                <CardTitle className="text-3xl font-heading text-amber-400">
                  {dashboard?.submissions?.total || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 text-xs">
                  <span className="text-yellow-400">{dashboard?.submissions?.pending || 0} pending</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Stream Control */}
          <Card className="bg-zinc-900 border-zinc-800 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-400" />
                LIVE STREAM CONTROL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-4 h-4 rounded-full ${dashboard?.current_stream?.is_live ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
                    <span className="font-heading text-lg">
                      {dashboard?.current_stream?.is_live ? 'CURRENTLY LIVE' : 'OFFLINE (Playlist Mode)'}
                    </span>
                  </div>
                  {dashboard?.current_stream?.is_live && (
                    <div className="bg-zinc-800 rounded-lg p-4 mb-4">
                      <p className="text-sm text-zinc-400">Now Playing:</p>
                      <p className="font-heading text-lg">{dashboard?.current_stream?.custom_title || dashboard?.current_stream?.title || 'ZTVLIVE Stream'}</p>
                      {dashboard?.current_stream?.creator && (
                        <p className="text-sm text-violet-400">by {dashboard?.current_stream?.creator}</p>
                      )}
                    </div>
                  )}
                  {dashboard?.current_stream?.is_live && (
                    <Button onClick={handleStopLive} variant="destructive" className="w-full">
                      <XCircle className="w-4 h-4 mr-2" />
                      STOP LIVE STREAM
                    </Button>
                  )}
                </div>
                
                <div>
                  <Label className="text-sm text-zinc-400 mb-2 block">Set Custom Live Title</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Enter custom title..."
                      className="bg-zinc-800 border-zinc-700"
                    />
                    <Button onClick={handleSetTitle} className="bg-violet-600 hover:bg-violet-500">
                      Set Title
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* RTMP Roku Stream Control */}
          <Card className="bg-zinc-900 border-zinc-800 mb-8" data-testid="rtmp-control-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-purple-400" />
                ROKU RTMP STREAM (Castr.io)
              </CardTitle>
              <CardDescription>Control the 24/7 Roku TV broadcast stream</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-4 h-4 rounded-full ${
                      rtmpStatus.status === 'running' || rtmpStatus.status === 'started' 
                        ? 'bg-green-500 animate-pulse' 
                        : rtmpStatus.status === 'starting' 
                          ? 'bg-yellow-500 animate-pulse'
                          : 'bg-zinc-600'
                    }`} />
                    <span className="font-heading text-lg">
                      {rtmpStatus.status === 'running' || rtmpStatus.status === 'started' 
                        ? 'STREAMING TO CASTR' 
                        : rtmpStatus.status === 'starting'
                          ? 'STARTING...'
                          : 'OFFLINE'}
                    </span>
                  </div>
                  
                  <div className="bg-zinc-800 rounded-lg p-4 mb-4">
                    <p className="text-sm text-zinc-400">Stream Info:</p>
                    <p className="text-xs text-zinc-500 mt-1">URL: rtmp://us-west.castr.io/static</p>
                    <p className="text-xs text-zinc-500">Source: /roku-tv (Game Show UI)</p>
                    {rtmpStatus.pid && (
                      <p className="text-xs text-green-400 mt-1">Process ID: {rtmpStatus.pid}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={startRtmpStream}
                      disabled={rtmpLoading || rtmpStatus.status === 'running' || rtmpStatus.status === 'started'}
                      className="flex-1 bg-green-600 hover:bg-green-500"
                      data-testid="start-rtmp-btn"
                    >
                      {rtmpLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      START STREAM
                    </Button>
                    <Button 
                      onClick={stopRtmpStream}
                      disabled={rtmpLoading || rtmpStatus.status === 'stopped' || rtmpStatus.status === 'unknown'}
                      variant="destructive"
                      className="flex-1"
                      data-testid="stop-rtmp-btn"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      STOP STREAM
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm text-zinc-400 mb-2 block">Quick Actions</Label>
                  <div className="space-y-2">
                    <Button 
                      onClick={fetchRtmpStatus}
                      variant="outline"
                      className="w-full border-zinc-700"
                      data-testid="refresh-rtmp-status-btn"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Status
                    </Button>
                    <a 
                      href={`${window.location.origin}/roku-tv`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button variant="outline" className="w-full border-zinc-700">
                        <Eye className="w-4 h-4 mr-2" />
                        Preview Roku UI
                      </Button>
                    </a>
                    <a 
                      href="https://app.castr.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button variant="outline" className="w-full border-zinc-700">
                        <Link2 className="w-4 h-4 mr-2" />
                        Open Castr Dashboard
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comment Settings */}
          <Card className="bg-zinc-900 border-zinc-800 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-400" />
                COMMENT SETTINGS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                  <div>
                    <h4 className="font-heading">Live Stream Comments</h4>
                    <p className="text-sm text-zinc-500">Enable/disable comments on live streams</p>
                  </div>
                  <Button 
                    onClick={handleToggleLiveComments}
                    variant={liveCommentSettings.comments_enabled ? "default" : "outline"}
                    className={liveCommentSettings.comments_enabled ? "bg-green-600 hover:bg-green-500" : ""}
                  >
                    {liveCommentSettings.comments_enabled ? (
                      <><ToggleRight className="w-4 h-4 mr-2" />Enabled</>
                    ) : (
                      <><ToggleLeft className="w-4 h-4 mr-2" />Disabled</>
                    )}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg">
                  <div>
                    <h4 className="font-heading">Global Comments</h4>
                    <p className="text-sm text-zinc-500">Enable/disable comments on all videos</p>
                  </div>
                  <Button 
                    onClick={handleToggleGlobalComments}
                    variant={globalCommentSettings.comments_enabled ? "default" : "outline"}
                    className={globalCommentSettings.comments_enabled ? "bg-green-600 hover:bg-green-500" : ""}
                  >
                    {globalCommentSettings.comments_enabled ? (
                      <><ToggleRight className="w-4 h-4 mr-2" />Enabled</>
                    ) : (
                      <><ToggleLeft className="w-4 h-4 mr-2" />Disabled</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Content Generation */}
          <Card className="bg-zinc-900 border-zinc-800 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                AI CONTENT GENERATION
                {newsApiStatus?.working && (
                  <Badge className="bg-green-600/20 text-green-400 border-green-600/30 ml-2">
                    <Newspaper className="w-3 h-3 mr-1" />
                    NewsAPI Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Generate fresh content using real trending news from NewsAPI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Generate Content Controls */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white flex-1"
                    >
                      <option value="all">All Categories</option>
                      <option value="sports">Sports</option>
                      <option value="tech">Tech</option>
                      <option value="news">News</option>
                      <option value="culture">Culture</option>
                      <option value="music">Music</option>
                      <option value="film">Film & TV</option>
                      <option value="gaming">Gaming</option>
                      <option value="podcast">Podcasts</option>
                    </select>
                    <Button 
                      onClick={handleGenerateFreshContent}
                      disabled={generatingContent}
                      className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                    >
                      {generatingContent ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                      ) : (
                        <><Zap className="w-4 h-4 mr-2" />Generate Fresh Content</>
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-sm text-zinc-500">
                    Click to fetch the latest trending news and generate AI-powered highlights with commentary. 
                    Content is sourced from real news articles via NewsAPI.
                  </p>

                  {/* Quick Generate Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {['sports', 'tech', 'news', 'culture'].map((cat) => (
                      <Button
                        key={cat}
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateSingleHighlight(cat)}
                        className="border-zinc-700 hover:border-amber-500 text-xs"
                        style={{ borderColor: CATEGORY_COLORS[cat] + '50' }}
                      >
                        <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* NewsAPI Status */}
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <h4 className="font-heading text-sm mb-3 flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-blue-400" />
                    NewsAPI Status
                  </h4>
                  {newsApiStatus ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Status</span>
                        <span className={newsApiStatus.working ? "text-green-400" : "text-red-400"}>
                          {newsApiStatus.working ? "Connected & Working" : "Not Connected"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Cached Entries</span>
                        <span className="text-zinc-300">{newsApiStatus.cache_entries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Categories</span>
                        <span className="text-zinc-300">{newsApiStatus.categories_available?.length || 0}</span>
                      </div>
                      {newsApiStatus.error && (
                        <div className="text-red-400 text-xs mt-2">{newsApiStatus.error}</div>
                      )}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">Loading status...</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Tabs */}
          <Tabs defaultValue="schedule" className="space-y-6">
            <TabsList className="bg-zinc-900 border border-zinc-800">
              <TabsTrigger value="schedule" className="data-[state=active]:bg-orange-600">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Slots
              </TabsTrigger>
              <TabsTrigger value="streams" className="data-[state=active]:bg-red-600">
                <Radio className="w-4 h-4 mr-2" />
                Stream Submissions
              </TabsTrigger>
              <TabsTrigger value="content" className="data-[state=active]:bg-violet-600">
                <Video className="w-4 h-4 mr-2" />
                Content Submissions
              </TabsTrigger>
              <TabsTrigger value="comments" className="data-[state=active]:bg-green-600">
                <MessageSquare className="w-4 h-4 mr-2" />
                Pending Comments
              </TabsTrigger>
            </TabsList>

            {/* Schedule Slots Tab - NEW */}
            <TabsContent value="schedule">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Invite Creators Card */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="w-5 h-5 text-orange-500" />
                      Invite Creators
                    </CardTitle>
                    <CardDescription>
                      Generate shareable invite links for creators to schedule their content
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-zinc-400">Creator Email *</Label>
                        <Input
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="creator@example.com"
                          className="bg-zinc-800 border-zinc-700"
                        />
                      </div>
                      <div>
                        <Label className="text-zinc-400">Creator Name</Label>
                        <Input
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="John Doe"
                          className="bg-zinc-800 border-zinc-700"
                        />
                      </div>
                      <Button
                        onClick={handleCreateInvite}
                        disabled={creatingInvite || !inviteEmail}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                      >
                        {creatingInvite ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Link2 className="w-4 h-4 mr-2" />
                        )}
                        Create Invite Link
                      </Button>
                    </div>

                    {/* Quick Links */}
                    <div className="pt-4 border-t border-zinc-800 space-y-2">
                      <Link to="/schedule-slot">
                        <Button variant="outline" className="w-full border-zinc-700">
                          <Calendar className="w-4 h-4 mr-2" />
                          View Schedule Grid
                        </Button>
                      </Link>
                      <Link to="/creator/library">
                        <Button variant="outline" className="w-full border-purple-700 text-purple-400 hover:bg-purple-900/30">
                          <Video className="w-4 h-4 mr-2" />
                          Creator Library (Quick Schedule)
                        </Button>
                      </Link>
                      <Link to="/admin/creator-import">
                        <Button variant="outline" className="w-full border-red-700 text-red-400 hover:bg-red-900/30">
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Bulk YouTube Import
                        </Button>
                      </Link>
                    </div>

                    {/* Recent Invites */}
                    {creatorInvites.length > 0 && (
                      <div className="pt-4 border-t border-zinc-800">
                        <h4 className="text-sm font-medium text-zinc-400 mb-3">Recent Invites</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {creatorInvites.slice(0, 5).map((invite) => (
                            <div key={invite.invite_token} className="flex items-center justify-between p-2 bg-zinc-800 rounded-lg text-sm">
                              <div>
                                <div className="text-white">{invite.creator_name || invite.creator_email}</div>
                                <div className="text-xs text-zinc-500">
                                  {invite.used ? (
                                    <span className="text-green-400">Used</span>
                                  ) : (
                                    <span>Expires: {new Date(invite.expires_at).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                              {!invite.used && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyInviteLink(invite)}
                                  className="h-8 w-8 p-0"
                                >
                                  {copiedInvite === invite.invite_token ? (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pending Bookings Card */}
                <Card className="bg-zinc-900 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-500" />
                      Pending Booking Approvals
                      {pendingBookings.length > 0 && (
                        <Badge className="bg-yellow-600">{pendingBookings.length}</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Review and approve creator content for the live TV schedule
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pendingBookings.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No pending bookings</p>
                        <p className="text-sm">All booking requests have been processed</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3">
                          {pendingBookings.map((booking) => (
                            <div key={booking.booking_id} className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-medium text-white">{booking.title}</h4>
                                  <p className="text-sm text-zinc-400">by {booking.creator_name}</p>
                                </div>
                                <Badge variant="outline" className="border-yellow-600 text-yellow-500">
                                  Pending
                                </Badge>
                              </div>
                              <div className="text-sm text-zinc-500 mb-3">
                                <div>Date: {booking.slot_date}</div>
                                <div>Time: {String(booking.slot_start_hour).padStart(2, '0')}:{String(booking.slot_start_minute || 0).padStart(2, '0')}</div>
                                <div>Duration: {booking.duration_minutes} min</div>
                              </div>
                              {booking.video_url && (
                                <a 
                                  href={booking.video_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:underline block mb-3 truncate"
                                >
                                  {booking.video_url}
                                </a>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveBooking(booking.booking_id)}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectBooking(booking.booking_id)}
                                  className="flex-1 border-red-600 text-red-500 hover:bg-red-600/10"
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Stream Submissions Tab */}
            <TabsContent value="streams">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle>Creator Stream Submissions</CardTitle>
                  <CardDescription>Review and approve creator streams for live broadcast</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {streamSubmissions.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                          <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No stream submissions yet</p>
                        </div>
                      ) : (
                        streamSubmissions.map((submission) => (
                          <div 
                            key={submission.id} 
                            className="border border-zinc-800 rounded-lg overflow-hidden"
                          >
                            <div 
                              className="p-4 bg-zinc-800/50 cursor-pointer hover:bg-zinc-800 transition-colors"
                              onClick={() => setExpandedSubmission(expandedSubmission === submission.id ? null : submission.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <Badge 
                                    className="text-white"
                                    style={{ backgroundColor: CATEGORY_COLORS[submission.category] || '#8b5cf6' }}
                                  >
                                    {submission.category?.toUpperCase()}
                                  </Badge>
                                  <div>
                                    <h3 className="font-heading text-lg">{submission.title}</h3>
                                    <p className="text-sm text-zinc-400">by {submission.creator_name}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {getStatusBadge(submission.ai_review_status)}
                                  {expandedSubmission === submission.id ? (
                                    <ChevronUp className="w-5 h-5 text-zinc-400" />
                                  ) : (
                                    <ChevronDown className="w-5 h-5 text-zinc-400" />
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {expandedSubmission === submission.id && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="p-4 border-t border-zinc-800"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <Label className="text-xs text-zinc-500">Stream URL</Label>
                                    <p className="text-sm font-mono bg-zinc-800 p-2 rounded truncate">
                                      {submission.stream_url}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-zinc-500">Email</Label>
                                    <p className="text-sm">{submission.creator_email}</p>
                                  </div>
                                </div>
                                
                                <div className="mb-4">
                                  <Label className="text-xs text-zinc-500">Description</Label>
                                  <p className="text-sm text-zinc-300">{submission.description}</p>
                                </div>

                                {/* AI Review Results */}
                                <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
                                  <h4 className="font-heading text-sm mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-violet-400" />
                                    AI REVIEW
                                  </h4>
                                  <div className="grid grid-cols-4 gap-4 mb-3">
                                    <div className="text-center">
                                      <div className="font-heading text-2xl text-green-400">
                                        {submission.ai_review_score?.toFixed(0) || 0}
                                      </div>
                                      <div className="text-xs text-zinc-500">Score</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="font-heading text-2xl text-blue-400">
                                        {submission.ai_quality_score?.toFixed(0) || 0}
                                      </div>
                                      <div className="text-xs text-zinc-500">Quality</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="font-heading text-lg text-amber-400">
                                        {submission.ai_resolution_check || "N/A"}
                                      </div>
                                      <div className="text-xs text-zinc-500">Resolution</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="font-heading text-2xl text-red-400">
                                        {submission.ai_content_flags?.length || 0}
                                      </div>
                                      <div className="text-xs text-zinc-500">Flags</div>
                                    </div>
                                  </div>
                                  
                                  {submission.ai_content_analysis && (
                                    <p className="text-sm text-zinc-400 mb-2">{submission.ai_content_analysis}</p>
                                  )}
                                  
                                  {submission.ai_content_flags?.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {submission.ai_content_flags.map((flag, i) => (
                                        <Badge key={i} variant="destructive" className="text-xs">
                                          <AlertTriangle className="w-3 h-3 mr-1" />{flag}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                  {submission.ai_review_status !== "approved" && (
                                    <Button 
                                      onClick={() => handleApproveStream(submission.id)}
                                      className="bg-green-600 hover:bg-green-500"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Approve
                                    </Button>
                                  )}
                                  {submission.ai_review_status !== "rejected" && (
                                    <Button 
                                      onClick={() => handleRejectStream(submission.id)}
                                      variant="destructive"
                                    >
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Reject
                                    </Button>
                                  )}
                                  {submission.is_approved_for_live && (
                                    <Button 
                                      onClick={() => handleGoLive(submission.id)}
                                      className="bg-red-600 hover:bg-red-500"
                                    >
                                      <Zap className="w-4 h-4 mr-2" />
                                      GO LIVE
                                    </Button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Content Submissions Tab */}
            <TabsContent value="content">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle>Content Submissions</CardTitle>
                  <CardDescription>Review highlight submissions from creators</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {contentSubmissions.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                          <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No content submissions yet</p>
                        </div>
                      ) : (
                        contentSubmissions.map((submission) => (
                          <div key={submission.id} className="border border-zinc-800 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <Badge 
                                  className="text-white mb-2"
                                  style={{ backgroundColor: CATEGORY_COLORS[submission.category] || '#8b5cf6' }}
                                >
                                  {submission.category?.toUpperCase()}
                                </Badge>
                                <h3 className="font-heading text-lg">{submission.title}</h3>
                                <p className="text-sm text-zinc-400">by {submission.submitter_name}</p>
                              </div>
                              {getStatusBadge(submission.status)}
                            </div>
                            
                            <p className="text-sm text-zinc-300 mb-3">{submission.description}</p>
                            
                            <div className="bg-zinc-800 rounded p-2 mb-3">
                              <Label className="text-xs text-zinc-500">Source URL</Label>
                              <a 
                                href={submission.source_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-400 hover:underline truncate block"
                              >
                                {submission.source_url}
                              </a>
                            </div>
                            
                            <div className="bg-zinc-800 rounded p-2 mb-4">
                              <Label className="text-xs text-zinc-500">Why Trending</Label>
                              <p className="text-sm text-zinc-300">{submission.why_trending}</p>
                            </div>
                            
                            {submission.status === "pending" && (
                              <div className="flex gap-2">
                                <Button 
                                  onClick={() => handleContentSubmissionAction(submission.id, "approved")}
                                  className="bg-green-600 hover:bg-green-500"
                                  size="sm"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </Button>
                                <Button 
                                  onClick={() => handleContentSubmissionAction(submission.id, "rejected")}
                                  variant="destructive"
                                  size="sm"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pending Comments Tab */}
            <TabsContent value="comments">
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle>Pending Comments</CardTitle>
                  <CardDescription>Comments awaiting moderation or flagged for review</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {pendingComments.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>No pending comments</p>
                        </div>
                      ) : (
                        pendingComments.map((comment) => (
                          <div key={comment.id} className="border border-zinc-800 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span 
                                  className="font-semibold"
                                  style={{ color: comment.color }}
                                >
                                  {comment.username}
                                </span>
                                <span className="text-xs text-zinc-500">
                                  on {comment.video_id === "live_stream" ? "Live Stream" : `Video: ${comment.video_id}`}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                                <Clock className="w-3 h-3 mr-1" />Pending
                              </Badge>
                            </div>
                            
                            <p className="text-zinc-300 mb-4">{comment.message}</p>
                            
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => handleApproveComment(comment.id)}
                                className="bg-green-600 hover:bg-green-500"
                                size="sm"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Approve
                              </Button>
                              <Button 
                                onClick={() => handleDeleteComment(comment.id)}
                                variant="destructive"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-800">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Tv className="w-5 h-5 text-red-400" />
            <span className="font-heading text-xl tracking-wider">ZTV LIVE</span>
            <Badge className="bg-violet-600 ml-2">ADMIN</Badge>
          </div>
          <p className="text-zinc-500 text-sm">Admin Dashboard • Manage Streams & Content</p>
        </div>
      </footer>
    </div>
  );
}
