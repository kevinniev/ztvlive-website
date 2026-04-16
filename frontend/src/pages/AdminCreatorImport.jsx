import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Youtube, Search, Download, CheckCircle, AlertCircle, Loader2,
  ArrowLeft, User, Mail, Lock, Plus, RefreshCw, Play, Eye,
  Calendar, X, ExternalLink, ChevronRight, Film, Users,
  Shield, Clock, Trash2, Zap, Copy, Check, UserPlus
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";

const API = '/api';

const AdminCreatorImport = () => {
  const navigate = useNavigate();
  
  // Admin auth
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminToken, setAdminToken] = useState("");
  
  // Tab state
  const [activeTab, setActiveTab] = useState("import");
  
  // Creator account form
  const [creatorForm, setCreatorForm] = useState({
    email: "",
    name: "",
    password: "",
    createNew: true
  });
  const [existingCreators, setExistingCreators] = useState([]);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  
  // YouTube import
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [channelInfo, setChannelInfo] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [maxVideos, setMaxVideos] = useState(3000);
  
  // Import job tracking
  const [activeJobs, setActiveJobs] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [currentJob, setCurrentJob] = useState(null);
  const [pollInterval, setPollInterval] = useState(null);

  useEffect(() => {
    checkAdminAuth();
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const checkAdminAuth = async () => {
    try {
      // Try both token keys (admin_token for legacy, access_token for current)
      const token = localStorage.getItem("access_token") || localStorage.getItem("admin_token");
      if (!token) {
        navigate("/admin");
        return;
      }
      
      setAdminToken(token);
      
      // Check admin user from localStorage (set by AdminDashboardV2 on login)
      const adminUserStr = localStorage.getItem("admin_user");
      if (adminUserStr) {
        try {
          const adminUser = JSON.parse(adminUserStr);
          if (adminUser?.role === "admin" || adminUser?.email?.includes("admin")) {
            setIsAdmin(true);
            fetchExistingCreators(token);
            fetchAllImportJobs(token);
            return;
          }
        } catch (e) {
          console.log("Could not parse admin user");
        }
      }
      
      // Fallback: verify token with API
      try {
        const response = await axios.get(`${API}/admin-auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data?.role === "admin") {
          setIsAdmin(true);
          fetchExistingCreators(token);
          fetchAllImportJobs(token);
        } else {
          toast.error("Admin access required");
          navigate("/admin");
        }
      } catch (apiError) {
        console.error("API auth error:", apiError);
        toast.error("Session expired. Please login again.");
        navigate("/admin");
      }
    } catch (error) {
      console.error("Auth error:", error);
      navigate("/admin");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExistingCreators = async (token) => {
    try {
      const response = await axios.get(`${API}/admin/users?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExistingCreators(response.data?.users || []);
    } catch (error) {
      // Users endpoint may not exist, use alternative
      console.log("Could not fetch users list");
    }
  };

  const fetchAllImportJobs = async (token) => {
    try {
      const response = await axios.get(`${API}/youtube-import/admin/all-jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const jobs = response.data?.jobs || [];
      setActiveJobs(jobs.filter(j => ["pending", "in_progress"].includes(j.status)));
      setCompletedJobs(jobs.filter(j => ["completed", "failed"].includes(j.status)));
    } catch (error) {
      console.log("Could not fetch import jobs");
    }
  };

  const createCreatorAccount = async () => {
    if (!creatorForm.email || !creatorForm.name) {
      toast.error("Email and name are required");
      return;
    }
    
    setCreatingAccount(true);
    try {
      // Generate a random password if not provided
      const password = creatorForm.password || Math.random().toString(36).slice(-12);
      
      const response = await axios.post(`${API}/auth/admin/create-user`, {
        email: creatorForm.email,
        name: creatorForm.name,
        password: password,
        role: "creator"
      }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (response.data?.user_id) {
        setSelectedCreator({
          user_id: response.data.user_id,
          email: creatorForm.email,
          name: creatorForm.name
        });
        toast.success(`Account created for ${creatorForm.name}!`);
        setCreatorForm({ ...creatorForm, createNew: false });
      }
    } catch (error) {
      // If endpoint doesn't exist, try regular signup
      try {
        const password = creatorForm.password || Math.random().toString(36).slice(-12);
        const signupResponse = await axios.post(`${API}/auth/signup`, {
          email: creatorForm.email,
          name: creatorForm.name,
          password: password
        });
        
        if (signupResponse.data?.user_id) {
          setSelectedCreator({
            user_id: signupResponse.data.user_id,
            email: creatorForm.email,
            name: creatorForm.name
          });
          toast.success(`Account created for ${creatorForm.name}!`);
        }
      } catch (signupError) {
        toast.error(signupError.response?.data?.detail || "Failed to create account");
      }
    } finally {
      setCreatingAccount(false);
    }
  };

  const searchChannel = async () => {
    if (!youtubeApiKey) {
      toast.error("Please enter your YouTube API key");
      return;
    }
    if (!channelUrl) {
      toast.error("Please enter a YouTube channel URL");
      return;
    }
    
    setIsSearching(true);
    setChannelInfo(null);
    
    try {
      const response = await axios.post(`${API}/youtube-import/lookup-channel`, {
        channel_url: channelUrl,
        youtube_api_key: youtubeApiKey
      }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (response.data?.channel) {
        setChannelInfo(response.data.channel);
        toast.success(`Found: ${response.data.channel.channel_title}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Channel not found");
    } finally {
      setIsSearching(false);
    }
  };

  const startImport = async () => {
    if (!selectedCreator) {
      toast.error("Please select or create a creator account first");
      return;
    }
    if (!channelInfo) {
      toast.error("Please search for a channel first");
      return;
    }
    
    try {
      const response = await axios.post(
        `${API}/youtube-import/start-import?creator_id=${selectedCreator.user_id}&creator_name=${encodeURIComponent(selectedCreator.name)}&max_videos=${maxVideos}`,
        {
          channel_url: channelUrl,
          youtube_api_key: youtubeApiKey
        },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      
      if (response.data?.job_id) {
        setCurrentJob(response.data);
        toast.success(`Import started! Job ID: ${response.data.job_id}`);
        
        // Start polling for progress
        const interval = setInterval(() => pollJobStatus(response.data.job_id), 3000);
        setPollInterval(interval);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start import");
    }
  };

  const pollJobStatus = async (jobId) => {
    try {
      const response = await axios.get(`${API}/youtube-import/job/${jobId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      const job = response.data?.job;
      if (job) {
        setCurrentJob(prev => ({ ...prev, ...job }));
        
        if (job.status === "completed" || job.status === "failed") {
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
          }
          
          if (job.status === "completed") {
            toast.success(`Import complete! ${job.imported_videos} videos imported.`);
          } else {
            toast.error(`Import failed: ${job.error_message}`);
          }
          
          fetchAllImportJobs(adminToken);
        }
      }
    } catch (error) {
      console.error("Poll error:", error);
    }
  };

  const formatNumber = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Admin Access Required</h1>
          <Button onClick={() => navigate("/admin")} className="mt-4">
            Go to Admin Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => navigate("/admin/dashboard")}
                className="text-zinc-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <div className="h-8 w-px bg-zinc-700" />
              <div className="flex items-center gap-2">
                <Youtube className="w-6 h-6 text-red-500" />
                <h1 className="text-xl font-bold">Creator Content Import</h1>
              </div>
            </div>
            <Badge variant="outline" className="text-emerald-400 border-emerald-400">
              <Shield className="w-3 h-3 mr-1" />
              Admin
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-zinc-900">
            <TabsTrigger value="import" className="data-[state=active]:bg-red-600">
              <Plus className="w-4 h-4 mr-2" />
              Import New Creator
            </TabsTrigger>
            <TabsTrigger value="jobs" className="data-[state=active]:bg-red-600">
              <Clock className="w-4 h-4 mr-2" />
              Import Jobs ({activeJobs.length})
            </TabsTrigger>
          </TabsList>

          {/* Import New Creator Tab */}
          <TabsContent value="import" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Step 1: Creator Account */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    Creator Account
                  </CardTitle>
                  <CardDescription>
                    Create or select the creator who owns this content
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedCreator ? (
                    <>
                      <div className="space-y-3">
                        <div>
                          <Label>Creator Name</Label>
                          <Input
                            placeholder="e.g., Matthew Brian Brown"
                            value={creatorForm.name}
                            onChange={(e) => setCreatorForm({ ...creatorForm, name: e.target.value })}
                            className="bg-zinc-800 border-zinc-700"
                          />
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input
                            type="email"
                            placeholder="creator@email.com"
                            value={creatorForm.email}
                            onChange={(e) => setCreatorForm({ ...creatorForm, email: e.target.value })}
                            className="bg-zinc-800 border-zinc-700"
                          />
                        </div>
                        <div>
                          <Label>Password (optional - will auto-generate)</Label>
                          <Input
                            type="password"
                            placeholder="Leave blank to auto-generate"
                            value={creatorForm.password}
                            onChange={(e) => setCreatorForm({ ...creatorForm, password: e.target.value })}
                            className="bg-zinc-800 border-zinc-700"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={createCreatorAccount}
                        disabled={creatingAccount || !creatorForm.name || !creatorForm.email}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        {creatingAccount ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4 mr-2" />
                        )}
                        Create Creator Account
                      </Button>
                    </>
                  ) : (
                    <div className="p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                        <div>
                          <p className="font-semibold">{selectedCreator.name}</p>
                          <p className="text-sm text-zinc-400">{selectedCreator.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCreator(null)}
                        className="mt-3 text-zinc-400"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Change Creator
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 2: YouTube API Key */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    YouTube API Key
                  </CardTitle>
                  <CardDescription>
                    Required to access YouTube channel data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Your YouTube Data API v3 Key</Label>
                    <Input
                      type="password"
                      placeholder="AIza..."
                      value={youtubeApiKey}
                      onChange={(e) => setYoutubeApiKey(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 font-mono"
                    />
                  </div>
                  <div className="text-xs text-zinc-500">
                    Get one free at{" "}
                    <a 
                      href="https://console.cloud.google.com/apis/credentials" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-red-400 hover:underline"
                    >
                      Google Cloud Console
                    </a>
                  </div>
                  {youtubeApiKey && (
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      API key entered
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Step 3: Channel Search */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  Find YouTube Channel
                </CardTitle>
                <CardDescription>
                  Enter the creator's YouTube channel URL
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="https://youtube.com/@matthewbrianbrown or channel URL"
                    value={channelUrl}
                    onChange={(e) => setChannelUrl(e.target.value)}
                    className="flex-1 bg-zinc-800 border-zinc-700"
                  />
                  <Button
                    onClick={searchChannel}
                    disabled={isSearching || !youtubeApiKey || !channelUrl}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isSearching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span className="ml-2">Search</span>
                  </Button>
                </div>

                {/* Channel Preview */}
                <AnimatePresence>
                  {channelInfo && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 bg-zinc-800 rounded-lg"
                    >
                      <div className="flex items-start gap-4">
                        <img
                          src={channelInfo.thumbnail_url}
                          alt={channelInfo.channel_title}
                          className="w-20 h-20 rounded-full"
                        />
                        <div className="flex-1">
                          <h3 className="text-lg font-bold">{channelInfo.channel_title}</h3>
                          <p className="text-sm text-zinc-400 line-clamp-2">
                            {channelInfo.description || "No description"}
                          </p>
                          <div className="flex gap-4 mt-2 text-sm">
                            <span className="text-zinc-400">
                              <Users className="w-4 h-4 inline mr-1" />
                              {formatNumber(channelInfo.subscriber_count)} subscribers
                            </span>
                            <span className="text-emerald-400 font-semibold">
                              <Film className="w-4 h-4 inline mr-1" />
                              {formatNumber(channelInfo.video_count)} videos
                            </span>
                          </div>
                        </div>
                        <Badge className="bg-emerald-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Found
                        </Badge>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            {/* Step 4: Import Settings & Start */}
            {channelInfo && selectedCreator && (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm font-bold">
                      4
                    </div>
                    Import Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Maximum Videos to Import</Label>
                      <Select
                        value={maxVideos.toString()}
                        onValueChange={(v) => setMaxVideos(parseInt(v))}
                      >
                        <SelectTrigger className="bg-zinc-800 border-zinc-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">100 videos</SelectItem>
                          <SelectItem value="500">500 videos</SelectItem>
                          <SelectItem value="1000">1,000 videos</SelectItem>
                          <SelectItem value="2000">2,000 videos</SelectItem>
                          <SelectItem value="3000">3,000 videos (max)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <div className="p-3 bg-zinc-800 rounded-lg flex-1">
                        <p className="text-sm text-zinc-400">Importing to:</p>
                        <p className="font-semibold">{selectedCreator.name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-yellow-400">Ready to Import</p>
                        <p className="text-zinc-400 mt-1">
                          This will import up to {formatNumber(maxVideos)} videos from{" "}
                          <strong>{channelInfo.channel_title}</strong> into{" "}
                          <strong>{selectedCreator.name}'s</strong> library.
                          Videos will be auto-approved and ready for scheduling.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={startImport}
                    disabled={!!currentJob}
                    className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 h-12 text-lg"
                  >
                    {currentJob ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Import in Progress...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 mr-2" />
                        Start Import
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Active Import Progress */}
            {currentJob && (
              <Card className="bg-zinc-900 border-zinc-800 border-2 border-red-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-red-500" />
                    Import in Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Channel:</span>
                    <span className="font-semibold">{currentJob.channel_title || channelInfo?.channel_title}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Status:</span>
                    <Badge className={
                      currentJob.status === "completed" ? "bg-emerald-600" :
                      currentJob.status === "failed" ? "bg-red-600" :
                      "bg-yellow-600"
                    }>
                      {currentJob.status}
                    </Badge>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Progress</span>
                      <span>
                        {currentJob.imported_videos || 0} / {currentJob.total_videos || "?"} videos
                      </span>
                    </div>
                    <Progress 
                      value={
                        currentJob.total_videos 
                          ? ((currentJob.imported_videos || 0) / currentJob.total_videos) * 100 
                          : 0
                      }
                      className="h-3"
                    />
                  </div>
                  {currentJob.status === "completed" && (
                    <div className="p-4 bg-emerald-900/20 border border-emerald-700 rounded-lg">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-semibold">
                          Successfully imported {currentJob.imported_videos} videos!
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Import Jobs Tab */}
          <TabsContent value="jobs" className="space-y-6">
            {/* Active Jobs */}
            {activeJobs.length > 0 && (
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                    Active Imports
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeJobs.map((job) => (
                      <div 
                        key={job.job_id}
                        className="p-4 bg-zinc-800 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold">{job.channel_title}</p>
                          <p className="text-sm text-zinc-400">
                            For: {job.creator_name} • {job.imported_videos || 0} / {job.total_videos} videos
                          </p>
                        </div>
                        <Badge className="bg-yellow-600">{job.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Completed Jobs */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader>
                <CardTitle>Import History</CardTitle>
              </CardHeader>
              <CardContent>
                {completedJobs.length === 0 ? (
                  <p className="text-zinc-500 text-center py-8">
                    No completed imports yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {completedJobs.map((job) => (
                      <div 
                        key={job.job_id}
                        className="p-4 bg-zinc-800 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="font-semibold">{job.channel_title}</p>
                          <p className="text-sm text-zinc-400">
                            For: {job.creator_name} • {job.imported_videos} videos imported
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(job.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={job.status === "completed" ? "bg-emerald-600" : "bg-red-600"}>
                          {job.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminCreatorImport;
