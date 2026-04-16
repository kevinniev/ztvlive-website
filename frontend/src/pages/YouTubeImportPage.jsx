import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Youtube, Search, Download, CheckCircle, AlertCircle, Loader2,
  ArrowLeft, ArrowRight, Tv, RefreshCw, Play, Eye, ThumbsUp,
  Calendar, X, ExternalLink, ChevronRight, Plus, Film, Link2,
  Shield, Clock, Settings, Trash2, Zap, Copy, Check
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";

const API = '/api';

const STEPS = {
  API_KEY: 0,
  CHANNEL_SEARCH: 1,
  VERIFY: 2,
  PREVIEW: 3,
  IMPORTING: 4,
  COMPLETE: 5
};

const YouTubeImportPage = () => {
  const navigate = useNavigate();
  
  // Auth state
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Flow state
  const [currentStep, setCurrentStep] = useState(STEPS.API_KEY);
  const [apiKey, setApiKey] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [channelInfo, setChannelInfo] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [maxVideos, setMaxVideos] = useState(500);
  const [enableAutoSync, setEnableAutoSync] = useState(true);
  
  // Verification state
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationInstructions, setVerificationInstructions] = useState([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Import state
  const [importJob, setImportJob] = useState(null);
  const [pollInterval, setPollInterval] = useState(null);
  
  // Connected channels state
  const [connectedChannels, setConnectedChannels] = useState([]);
  const [previousImports, setPreviousImports] = useState([]);
  const [loadingImports, setLoadingImports] = useState(false);
  const [activeTab, setActiveTab] = useState("import"); // "import" or "connected"

  // Check auth on mount
  useEffect(() => {
    checkAuth();
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const response = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data && response.data.user_id) {
          setUser(response.data);
          fetchConnectedChannels(response.data.user_id, token);
          fetchPreviousImports(response.data.user_id, token);
        } else {
          navigate("/login");
        }
      } else {
        navigate("/login");
      }
    } catch (error) {
      localStorage.removeItem("token");
      navigate("/login");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConnectedChannels = async (creatorId, token) => {
    try {
      const response = await axios.get(
        `${API}/youtube-import/connected-channels?creator_id=${creatorId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConnectedChannels(response.data.channels || []);
    } catch (error) {
      console.error("Failed to fetch connected channels:", error);
    }
  };

  const fetchPreviousImports = async (creatorId, token) => {
    setLoadingImports(true);
    try {
      const response = await axios.get(
        `${API}/youtube-import/my-imports?creator_id=${creatorId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPreviousImports(response.data.imports || []);
    } catch (error) {
      console.error("Failed to fetch previous imports:", error);
    } finally {
      setLoadingImports(false);
    }
  };

  const handleConnectChannel = async () => {
    if (!apiKey || !channelUrl) {
      toast.error("Please enter both API key and channel URL");
      return;
    }
    
    setIsSearching(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/youtube-import/connect-channel?creator_id=${user.user_id}&creator_name=${encodeURIComponent(user.name || user.display_name)}`,
        {
          channel_url: channelUrl,
          youtube_api_key: apiKey,
          auto_sync_enabled: enableAutoSync
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.already_connected) {
        setChannelInfo(response.data.channel);
        setIsVerified(true);
        setCurrentStep(STEPS.PREVIEW);
        toast.success("Channel already connected!");
      } else {
        setChannelInfo(response.data.channel);
        setVerificationCode(response.data.verification_code);
        setVerificationInstructions(response.data.verification_instructions);
        setCurrentStep(STEPS.VERIFY);
        toast.success("Please verify channel ownership");
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || "Failed to connect channel";
      toast.error(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  const handleVerifyOwnership = async () => {
    if (!channelInfo) return;
    
    setIsVerifying(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/youtube-import/verify-ownership?channel_id=${channelInfo.channel_id}&creator_id=${user.user_id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.verified) {
        setIsVerified(true);
        setCurrentStep(STEPS.PREVIEW);
        toast.success(response.data.message);
        fetchConnectedChannels(user.user_id, token);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || "Verification failed";
      toast.error(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChannelLookup = async () => {
    if (!apiKey || !channelUrl) {
      toast.error("Please enter both API key and channel URL");
      return;
    }
    
    setIsSearching(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/youtube-import/lookup-channel`,
        {
          channel_url: channelUrl,
          youtube_api_key: apiKey
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setChannelInfo(response.data.channel);
      // Skip verification for quick import, go directly to preview
      setCurrentStep(STEPS.PREVIEW);
      toast.success("Channel found!");
    } catch (error) {
      const errorMessage = error.response?.data?.detail || "Failed to find channel";
      toast.error(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  const startImport = async () => {
    if (!channelInfo || !user) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/youtube-import/start-import?creator_id=${user.user_id}&creator_name=${encodeURIComponent(user.name || user.display_name)}&max_videos=${maxVideos}`,
        {
          channel_url: channelUrl,
          youtube_api_key: apiKey
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setImportJob(response.data);
      setCurrentStep(STEPS.IMPORTING);
      toast.success("Import started!");
      
      // Start polling for progress
      const interval = setInterval(() => pollJobStatus(response.data.job_id), 3000);
      setPollInterval(interval);
      
    } catch (error) {
      const errorMessage = error.response?.data?.detail || "Failed to start import";
      toast.error(errorMessage);
    }
  };

  const pollJobStatus = async (jobId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API}/youtube-import/job/${jobId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const job = response.data.job;
      setImportJob(prev => ({ ...prev, ...job }));
      
      if (job.status === "completed" || job.status === "failed") {
        clearInterval(pollInterval);
        setPollInterval(null);
        setCurrentStep(STEPS.COMPLETE);
        
        if (job.status === "completed") {
          toast.success(`Successfully imported ${job.imported_videos} videos!`);
          fetchConnectedChannels(user.user_id, localStorage.getItem("token"));
        } else {
          toast.error(`Import failed: ${job.error_message}`);
        }
      }
    } catch (error) {
      console.error("Failed to poll job status:", error);
    }
  };

  const handleSyncChannel = async (channel) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${API}/youtube-import/sync-channel/${channel.channel_id}?creator_id=${user.user_id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success(response.data.message);
        fetchPreviousImports(user.user_id, token);
      } else {
        toast.info(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Sync failed");
    }
  };

  const handleDisconnectChannel = async (channelId) => {
    if (!confirm("Disconnect this channel? Auto-sync will stop but your imported videos remain.")) return;
    
    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API}/youtube-import/connected-channel/${channelId}?creator_id=${user.user_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Channel disconnected");
      fetchConnectedChannels(user.user_id, token);
    } catch (error) {
      toast.error("Failed to disconnect channel");
    }
  };

  const copyVerificationCode = () => {
    navigator.clipboard.writeText(verificationCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast.success("Code copied to clipboard!");
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num?.toString() || "0";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">ZTVLIVE</span>
          </Link>
          
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">Welcome, {user.name || user.display_name}</span>
              <Link to="/creator/dashboard">
                <Button variant="outline" size="sm" className="border-zinc-700">
                  Dashboard
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("import")}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === "import"
                ? "bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <Download className="w-4 h-4" />
            Import Channel
          </button>
          <button
            onClick={() => setActiveTab("connected")}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === "connected"
                ? "bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            <Link2 className="w-4 h-4" />
            Connected Channels
            {connectedChannels.length > 0 && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500 ml-1">
                {connectedChannels.length}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Connected Channels Tab */}
      {activeTab === "connected" && (
        <main className="max-w-4xl mx-auto px-4 pb-20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Connected YouTube Channels</h1>
            <p className="text-zinc-400">Manage your connected channels and auto-sync settings</p>
          </div>

          {connectedChannels.length === 0 ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center">
              <Link2 className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Connected Channels</h3>
              <p className="text-zinc-400 mb-6">Connect your YouTube channels to enable auto-sync for new uploads</p>
              <Button onClick={() => setActiveTab("import")} className="bg-red-600 hover:bg-red-500">
                <Plus className="w-4 h-4 mr-2" />
                Connect a Channel
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {connectedChannels.map((channel) => (
                <div key={channel.channel_id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <img
                      src={channel.channel_thumbnail}
                      alt={channel.channel_title}
                      className="w-16 h-16 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-white">{channel.channel_title}</h3>
                        {channel.verified ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Pending Verification
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-zinc-400 mb-4">
                        <span className="flex items-center gap-1">
                          <Film className="w-4 h-4" />
                          {channel.total_videos_synced || 0} videos synced
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Last sync: {formatDate(channel.last_sync_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-4 h-4" />
                          Auto-sync: {channel.auto_sync_enabled ? `Every ${channel.sync_interval_hours}h` : "Disabled"}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {channel.verified && (
                          <Button
                            size="sm"
                            onClick={() => handleSyncChannel(channel)}
                            className="bg-green-600 hover:bg-green-500"
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Sync Now
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDisconnectChannel(channel.channel_id)}
                          className="border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* Import Tab */}
      {activeTab === "import" && (
        <>
          {/* Progress Steps */}
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-8">
              {[
                { step: STEPS.API_KEY, label: "Setup", icon: Youtube },
                { step: STEPS.CHANNEL_SEARCH, label: "Find Channel", icon: Search },
                { step: STEPS.VERIFY, label: "Verify", icon: Shield },
                { step: STEPS.PREVIEW, label: "Preview", icon: Eye },
                { step: STEPS.IMPORTING, label: "Importing", icon: Download },
                { step: STEPS.COMPLETE, label: "Done", icon: CheckCircle }
              ].map((item, index) => (
                <div key={index} className="flex items-center">
                  <div className={`flex flex-col items-center ${currentStep >= item.step ? 'text-red-500' : 'text-zinc-600'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-colors ${
                      currentStep >= item.step ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500'
                    } ${currentStep === item.step ? 'ring-2 ring-red-400 ring-offset-2 ring-offset-black' : ''}`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs hidden sm:block">{item.label}</span>
                  </div>
                  {index < 5 && (
                    <div className={`w-8 sm:w-12 h-0.5 mx-1 sm:mx-2 ${currentStep > item.step ? 'bg-red-600' : 'bg-zinc-800'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <main className="max-w-4xl mx-auto px-4 pb-20">
            <AnimatePresence mode="wait">
              {/* Step 0: API Key Setup */}
              {currentStep === STEPS.API_KEY && (
                <motion.div
                  key="api-key"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Youtube className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Import Your YouTube Channel</h1>
                    <p className="text-zinc-400 max-w-md mx-auto">
                      Automatically import all your videos from YouTube to ZTVLIVE. No manual uploading needed!
                    </p>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 bg-red-600 rounded-full text-sm flex items-center justify-center">1</span>
                      Get Your YouTube API Key
                    </h2>
                    
                    <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-zinc-400 mb-3">
                        You'll need a YouTube Data API key from Google Cloud Console. Here's how:
                      </p>
                      <ol className="text-sm text-zinc-300 space-y-2 list-decimal list-inside">
                        <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">Google Cloud Console</a></li>
                        <li>Create a new project (or select existing)</li>
                        <li>Enable the "YouTube Data API v3"</li>
                        <li>Create an API Key credential</li>
                        <li>Copy and paste the key below</li>
                      </ol>
                    </div>

                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste your YouTube API Key here..."
                      className="bg-zinc-800 border-zinc-700 mb-4"
                      data-testid="youtube-api-key-input"
                    />

                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-yellow-200 font-medium">Your API key is safe</p>
                          <p className="text-yellow-200/70">We only use it to fetch your videos. For connected channels with auto-sync, we securely store the key. You can disconnect anytime.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => apiKey && setCurrentStep(STEPS.CHANNEL_SEARCH)}
                    disabled={!apiKey}
                    className="w-full bg-red-600 hover:bg-red-500 h-14 text-lg disabled:opacity-50"
                    data-testid="continue-to-channel-btn"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>

                  {/* Previous Imports */}
                  {previousImports.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-lg font-semibold mb-4">Recent Import History</h3>
                      <div className="space-y-3">
                        {previousImports.slice(0, 3).map((job) => (
                          <div key={job.job_id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-4">
                            <img
                              src={job.channel_thumbnail}
                              alt={job.channel_title}
                              className="w-12 h-12 rounded-full"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-white">{job.channel_title}</p>
                              <p className="text-sm text-zinc-400">
                                {job.imported_videos} videos • {formatDate(job.created_at)}
                              </p>
                            </div>
                            <Badge className={
                              job.status === "completed" ? "bg-green-500/20 text-green-400 border-green-500" :
                              job.status === "failed" ? "bg-red-500/20 text-red-400 border-red-500" :
                              "bg-yellow-500/20 text-yellow-400 border-yellow-500"
                            }>
                              {job.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 1: Channel Search */}
              {currentStep === STEPS.CHANNEL_SEARCH && (
                <motion.div
                  key="channel-search"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <button
                    onClick={() => setCurrentStep(STEPS.API_KEY)}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>

                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Find Your Channel</h1>
                    <p className="text-zinc-400">Enter your YouTube channel URL or @handle</p>
                  </div>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
                    <label className="text-sm text-zinc-400 mb-2 block">YouTube Channel URL</label>
                    <div className="flex gap-3 mb-4">
                      <Input
                        value={channelUrl}
                        onChange={(e) => setChannelUrl(e.target.value)}
                        placeholder="@goodtechcheap or https://youtube.com/@goodtechcheap"
                        className="bg-zinc-800 border-zinc-700 flex-1"
                        data-testid="channel-url-input"
                      />
                    </div>

                    <div className="text-sm text-zinc-500 mb-6">
                      <p className="mb-2">Accepted formats:</p>
                      <ul className="space-y-1">
                        <li>• @goodtechcheap</li>
                        <li>• https://youtube.com/@goodtechcheap</li>
                        <li>• https://youtube.com/channel/UC...</li>
                      </ul>
                    </div>

                    {/* Auto-sync option */}
                    <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-lg mb-4">
                      <input
                        type="checkbox"
                        id="auto_sync"
                        checked={enableAutoSync}
                        onChange={(e) => setEnableAutoSync(e.target.checked)}
                        className="w-5 h-5 rounded border-zinc-600 text-red-600 focus:ring-red-500"
                      />
                      <label htmlFor="auto_sync" className="flex-1">
                        <span className="text-white font-medium">Enable Auto-Sync</span>
                        <p className="text-sm text-zinc-400">Automatically import new uploads every 24 hours</p>
                      </label>
                      <Zap className="w-5 h-5 text-yellow-500" />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={handleConnectChannel}
                        disabled={isSearching || !channelUrl}
                        className="flex-1 bg-red-600 hover:bg-red-500"
                        data-testid="connect-channel-btn"
                      >
                        {isSearching ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <Link2 className="w-5 h-5 mr-2" />
                        )}
                        Connect & Verify Ownership
                      </Button>
                    </div>

                    <div className="text-center mt-4">
                      <button
                        onClick={handleChannelLookup}
                        disabled={isSearching || !channelUrl}
                        className="text-sm text-zinc-500 hover:text-zinc-300"
                      >
                        Or skip verification and import once →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Verification */}
              {currentStep === STEPS.VERIFY && (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <button
                    onClick={() => setCurrentStep(STEPS.CHANNEL_SEARCH)}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>

                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-yellow-500" />
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Verify Channel Ownership</h1>
                    <p className="text-zinc-400">Prove you own this channel to enable auto-sync</p>
                  </div>

                  {/* Channel Preview */}
                  {channelInfo && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 mb-6 flex items-center gap-4">
                      <img
                        src={channelInfo.thumbnail_url}
                        alt={channelInfo.channel_title}
                        className="w-16 h-16 rounded-full"
                      />
                      <div>
                        <h3 className="text-lg font-semibold text-white">{channelInfo.channel_title}</h3>
                        <p className="text-sm text-zinc-400">
                          {formatNumber(channelInfo.subscriber_count)} subscribers • {formatNumber(channelInfo.video_count)} videos
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">Verification Steps</h2>
                    
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                      <p className="text-sm text-zinc-300 mb-2">Add this code to your channel description:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-zinc-800 px-4 py-3 rounded-lg text-red-400 font-mono text-lg">
                          {verificationCode}
                        </code>
                        <Button
                          onClick={copyVerificationCode}
                          variant="outline"
                          size="sm"
                          className="border-zinc-700"
                        >
                          {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <ol className="space-y-3 mb-6">
                      {verificationInstructions.map((instruction, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm">
                          <span className="w-6 h-6 bg-zinc-800 rounded-full flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-zinc-300">{instruction.replace(/^\d+\.\s*/, '')}</span>
                        </li>
                      ))}
                    </ol>

                    <Button
                      onClick={handleVerifyOwnership}
                      disabled={isVerifying}
                      className="w-full bg-green-600 hover:bg-green-500 h-12"
                    >
                      {isVerifying ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="w-5 h-5 mr-2" />
                      )}
                      I've Added the Code - Verify Now
                    </Button>
                  </div>

                  <div className="text-center">
                    <button
                      onClick={() => setCurrentStep(STEPS.PREVIEW)}
                      className="text-sm text-zinc-500 hover:text-zinc-300"
                    >
                      Skip verification and import without auto-sync →
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Preview */}
              {currentStep === STEPS.PREVIEW && channelInfo && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <button
                    onClick={() => setCurrentStep(isVerified ? STEPS.CHANNEL_SEARCH : STEPS.VERIFY)}
                    className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>

                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">
                      {isVerified ? "Channel Verified!" : "Channel Found!"}
                    </h1>
                    <p className="text-zinc-400">Review the channel details before importing</p>
                  </div>

                  {/* Channel Card */}
                  <div className="bg-gradient-to-br from-red-900/20 to-purple-900/20 border border-red-600/30 rounded-2xl p-6 mb-6">
                    <div className="flex items-center gap-4 mb-6">
                      <img
                        src={channelInfo.thumbnail_url}
                        alt={channelInfo.channel_title}
                        className="w-20 h-20 rounded-full border-4 border-red-600/50"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold text-white">{channelInfo.channel_title}</h2>
                          {isVerified && (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                        </div>
                        {channelInfo.custom_url && (
                          <a
                            href={`https://youtube.com/${channelInfo.custom_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-400 hover:underline flex items-center gap-1"
                          >
                            {channelInfo.custom_url}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-zinc-900/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-white">{formatNumber(channelInfo.subscriber_count)}</p>
                        <p className="text-sm text-zinc-400">Subscribers</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-white">{formatNumber(channelInfo.video_count)}</p>
                        <p className="text-sm text-zinc-400">Videos</p>
                      </div>
                    </div>

                    {isVerified && enableAutoSync && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-green-400">
                          <Zap className="w-5 h-5" />
                          <span className="font-medium">Auto-Sync Enabled</span>
                        </div>
                        <p className="text-sm text-green-400/70 mt-1">
                          New uploads will be automatically imported every 24 hours
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Import Options */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-6">
                    <h3 className="font-semibold mb-4">Import Options</h3>
                    
                    <div>
                      <label className="text-sm text-zinc-400 mb-2 block">Maximum videos to import</label>
                      <div className="flex flex-wrap gap-2">
                        {[100, 250, 500, 1000, 3000].map((count) => (
                          <button
                            key={count}
                            onClick={() => setMaxVideos(count)}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                              maxVideos === count
                                ? "bg-red-600 text-white"
                                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                            }`}
                          >
                            {count >= 1000 ? `${count/1000}K` : count}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">
                        {channelInfo.video_count > maxVideos 
                          ? `Will import the ${maxVideos} most recent videos`
                          : `Will import all ${channelInfo.video_count} videos`
                        }
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={startImport}
                    className="w-full bg-red-600 hover:bg-red-500 h-14 text-lg"
                    data-testid="start-import-btn"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Import {Math.min(maxVideos, channelInfo.video_count)} Videos
                  </Button>
                </motion.div>
              )}

              {/* Step 4: Importing */}
              {currentStep === STEPS.IMPORTING && importJob && (
                <motion.div
                  key="importing"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center"
                >
                  <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <RefreshCw className="w-10 h-10 text-red-500 animate-spin" />
                  </div>
                  <h1 className="text-3xl font-bold mb-2">Importing Videos...</h1>
                  <p className="text-zinc-400 mb-8">This may take a few minutes for large channels</p>

                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 max-w-md mx-auto">
                    <div className="flex items-center gap-4 mb-6">
                      {channelInfo?.thumbnail_url && (
                        <img
                          src={channelInfo.thumbnail_url}
                          alt={channelInfo.channel_title}
                          className="w-12 h-12 rounded-full"
                        />
                      )}
                      <div className="text-left">
                        <p className="font-medium text-white">{importJob.channel?.channel_title || channelInfo?.channel_title}</p>
                        <p className="text-sm text-zinc-400">
                          {importJob.job?.imported_videos || importJob.imported_videos || 0} / {importJob.job?.total_videos || importJob.estimated_videos || "?"} videos
                        </p>
                      </div>
                    </div>

                    <Progress 
                      value={
                        ((importJob.job?.imported_videos || importJob.imported_videos || 0) / 
                        (importJob.job?.total_videos || importJob.estimated_videos || 1)) * 100
                      } 
                      className="h-3 mb-4" 
                    />

                    <p className="text-sm text-zinc-500">
                      Please don't close this page. You can navigate away and check progress later.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Step 5: Complete */}
              {currentStep === STEPS.COMPLETE && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center"
                >
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                    importJob?.job?.status === "completed" || importJob?.status === "completed"
                      ? "bg-green-600/20"
                      : "bg-red-600/20"
                  }`}>
                    {importJob?.job?.status === "completed" || importJob?.status === "completed" ? (
                      <CheckCircle className="w-10 h-10 text-green-500" />
                    ) : (
                      <AlertCircle className="w-10 h-10 text-red-500" />
                    )}
                  </div>
                  
                  <h1 className="text-3xl font-bold mb-2">
                    {importJob?.job?.status === "completed" || importJob?.status === "completed"
                      ? "Import Complete!"
                      : "Import Failed"
                    }
                  </h1>
                  
                  <p className="text-zinc-400 mb-8">
                    {importJob?.job?.status === "completed" || importJob?.status === "completed"
                      ? `Successfully imported ${importJob?.job?.imported_videos || importJob?.imported_videos} videos to your library`
                      : importJob?.job?.error_message || importJob?.error_message || "Something went wrong during import"
                    }
                  </p>

                  {(importJob?.job?.status === "completed" || importJob?.status === "completed") && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 max-w-md mx-auto mb-8">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-500">
                            {importJob?.job?.imported_videos || importJob?.imported_videos || 0}
                          </p>
                          <p className="text-sm text-zinc-400">Imported</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-500">
                            {importJob?.job?.failed_videos || importJob?.failed_videos || 0}
                          </p>
                          <p className="text-sm text-zinc-400">Skipped/Failed</p>
                        </div>
                      </div>

                      {isVerified && (
                        <div className="mt-4 pt-4 border-t border-zinc-800">
                          <div className="flex items-center justify-center gap-2 text-green-400">
                            <Zap className="w-4 h-4" />
                            <span className="text-sm">Auto-sync enabled - new uploads will be imported automatically</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 justify-center">
                    <Link to="/creator/dashboard">
                      <Button className="bg-red-600 hover:bg-red-500">
                        <Film className="w-4 h-4 mr-2" />
                        Go to Dashboard
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCurrentStep(STEPS.CHANNEL_SEARCH);
                        setChannelInfo(null);
                        setImportJob(null);
                        setChannelUrl("");
                        setIsVerified(false);
                        setVerificationCode("");
                      }}
                      className="border-zinc-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Import Another Channel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </>
      )}

      {/* Help Section */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            Important Notes
          </h3>
          <ul className="text-sm text-zinc-400 space-y-2">
            <li>• Your YouTube videos will be linked, not re-uploaded. They play directly from YouTube.</li>
            <li>• <strong>Verify ownership</strong> to enable auto-sync for new uploads every 24 hours.</li>
            <li>• Import runs in the background - you can close this page and check progress later.</li>
            <li>• Already imported videos are automatically skipped on re-import.</li>
            <li>• Free YouTube API quota: 10,000 units/day. Each video fetch uses ~3 units.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default YouTubeImportPage;
