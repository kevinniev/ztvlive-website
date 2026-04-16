import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { 
  Tv, Menu, X, Send, CheckCircle, Upload, 
  Link as LinkIcon, User, Mail, MessageSquare, Tag, FileText,
  Video, CloudUpload, FileVideo, Trash2, Radio, Loader2,
  Calendar, ChevronRight, Copy, Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

const API = '/api';

const CATEGORY_OPTIONS = [
  { id: "sports", name: "Sports", color: "#f97316" },
  { id: "podcast", name: "Podcasts", color: "#8b5cf6" },
  { id: "music", name: "Music", color: "#d946ef" },
  { id: "film", name: "Film & TV", color: "#ec4899" },
  { id: "tech", name: "Tech", color: "#06b6d4" },
  { id: "gaming", name: "Gaming", color: "#22c55e" },
  { id: "news", name: "Breaking News", color: "#eab308" },
  { id: "culture", name: "Pop Culture", color: "#f43f5e" },
  { id: "other", name: "Other", color: "#71717a" },
];

export default function SubmitPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submissionType, setSubmissionType] = useState("link"); // "link" or "upload"
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    source_url: "",
    description: "",
    submitter_name: "",
    submitter_email: "",
    why_trending: "",
  });

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('ztvlive_user');
        
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          // Pre-fill form with user data
          setFormData(prev => ({
            ...prev,
            submitter_name: parsedUser.name || parsedUser.display_name || "",
            submitter_email: parsedUser.email || ""
          }));
        }
        
        // Verify with backend
        const headers = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
        const response = await axios.get(`${API}/auth/me`, {
          withCredentials: true,
          headers
        });
        
        setUser(response.data);
        setFormData(prev => ({
          ...prev,
          submitter_name: response.data.name || response.data.display_name || prev.submitter_name,
          submitter_email: response.data.email || prev.submitter_email
        }));
      } catch (error) {
        // User not logged in - redirect to login with return URL
        setUser(null);
        navigate(`/login?redirect=${encodeURIComponent('/submit')}`);
        return;
      } finally {
        setAuthLoading(false);
      }
    };
    
    checkAuth();
  }, [navigate]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/x-m4v'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv|webm|m4v|wmv|mxf|prores)$/i)) {
      toast.error("Invalid file type. Please upload a video file (MP4, MOV, AVI, MKV, WebM, ProRes)");
      return;
    }
    
    // File size - 1TB max for 4K/8K content
    const maxSize = 1024 * 1024 * 1024 * 1024; // 1TB
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 1TB");
      return;
    }
    
    setSelectedFile(file);
    toast.success(`Selected: ${file.name} (${formatFileSize(file.size)})`);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate common fields
    if (!formData.title || !formData.category || !formData.description || !formData.submitter_name || !formData.why_trending) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate based on submission type
    if (submissionType === "link" && !formData.source_url) {
      toast.error("Please provide a source URL");
      return;
    }
    
    if (submissionType === "upload" && !selectedFile) {
      toast.error("Please select a video file to upload");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    
    try {
      let response;
      if (submissionType === "upload") {
        // File upload
        const formDataObj = new FormData();
        formDataObj.append("file", selectedFile);
        formDataObj.append("title", formData.title);
        formDataObj.append("category", formData.category);
        formDataObj.append("description", formData.description);
        formDataObj.append("submitter_name", formData.submitter_name);
        formDataObj.append("why_trending", formData.why_trending);
        if (formData.submitter_email) {
          formDataObj.append("submitter_email", formData.submitter_email);
        }
        // Add creator_id if user is logged in
        if (user?.id || user?.user_id) {
          formDataObj.append("creator_id", user.id || user.user_id);
        }
        
        response = await axios.post(`${API}/submissions/upload`, formDataObj, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          },
        });
      } else {
        // Link submission
        response = await axios.post(`${API}/submissions`, {
          ...formData,
          submission_type: "link",
          creator_id: user?.id || user?.user_id || null
        });
      }
      
      // Store submission result for confirmation display
      setSubmissionResult({
        id: response.data.submission_id || response.data.id,
        title: formData.title,
        type: submissionType,
        fileName: selectedFile?.name,
        fileSize: response.data.file_size_mb,
        status: response.data.status || "library",
        videoUrl: submissionType === "upload" 
          ? response.data.file_url || `/api/uploads/${response.data.submission_id || response.data.id}`
          : formData.source_url
      });
      
      setSubmitted(true);
      toast.success(submissionType === "upload" ? "Video uploaded successfully!" : "Content submitted successfully!");
    } catch (error) {
      console.error("Submission error:", error);
      const errorMsg = error.response?.data?.detail || "Failed to submit content";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      category: "",
      source_url: "",
      description: "",
      submitter_name: user?.name || user?.display_name || "",
      submitter_email: user?.email || "",
      why_trending: "",
    });
    setSelectedFile(null);
    setSubmitted(false);
    setSubmissionResult(null);
    setUploadProgress(0);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

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
            </Link>
            
            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm text-zinc-400 hover:text-white transition-colors">HOME</Link>
              <Link to="/watch" className="text-sm text-zinc-400 hover:text-white transition-colors">WATCH</Link>
              <Link to="/library" className="text-sm text-zinc-400 hover:text-white transition-colors">LIBRARY</Link>
              <Link to="/stream-submit" className="text-sm text-zinc-400 hover:text-white transition-colors">GO LIVE</Link>
              <Link to="/submit" className="text-sm text-white">SUBMIT</Link>
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
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="font-heading text-4xl md:text-5xl tracking-tight uppercase mb-2" data-testid="page-title">
              SUBMIT CONTENT
            </h1>
            <p className="text-zinc-400">
              Found something trending? Submit it to ZTV Live and get featured on Roku, Fire TV, Samsung, LG, and Web!
            </p>
          </motion.div>

          {/* Login Prompt for non-authenticated users */}
          {!authLoading && !user && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-gradient-to-r from-red-900/30 to-purple-900/30 border border-red-600/30 rounded-xl"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">Sign in for faster submissions</h3>
                    <p className="text-sm text-zinc-400">Your info will be auto-filled and you can track your submissions</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/login?redirect=${encodeURIComponent('/submit')}`}>
                    <Button variant="outline" size="sm" className="border-red-600/50 text-red-400 hover:bg-red-900/30">
                      Sign In
                    </Button>
                  </Link>
                  <Link to={`/signup?redirect=${encodeURIComponent('/submit')}`}>
                    <Button size="sm" className="bg-red-600 hover:bg-red-500">
                      Create Account
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {submitted ? (
            /* Success State */
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="font-heading text-3xl mb-3">VIDEO UPLOADED!</h2>
              
              {/* Submission Details Card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md mx-auto mb-6 text-left">
                <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-4">Upload Details</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Title:</span>
                    <span className="text-white font-medium truncate max-w-[200px]">{submissionResult?.title}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Type:</span>
                    <Badge className={submissionResult?.type === "upload" ? "bg-purple-600" : "bg-blue-600"}>
                      {submissionResult?.type === "upload" ? "Video Upload" : "Link Submission"}
                    </Badge>
                  </div>
                  
                  {submissionResult?.fileName && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">File:</span>
                      <span className="text-white text-sm truncate max-w-[200px]">{submissionResult.fileName}</span>
                    </div>
                  )}
                  
                  {submissionResult?.fileSize && (
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Size:</span>
                      <span className="text-white">{submissionResult.fileSize} MB</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Status:</span>
                    <Badge className="bg-green-600">Saved to Library</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Submission ID:</span>
                    <code className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
                      {submissionResult?.id?.slice(0, 8)}...
                    </code>
                  </div>
                </div>
              </div>

              {/* What to do next - ACTION OPTIONS */}
              <div className="bg-gradient-to-r from-red-900/20 to-purple-900/20 border border-red-600/30 rounded-xl p-6 max-w-lg mx-auto mb-6">
                <h4 className="font-medium text-white mb-4 text-lg">What would you like to do?</h4>
                
                <div className="grid gap-4">
                  {/* Option 1: Schedule for Livestream */}
                  <Link 
                    to={`/creator/schedule?video=${submissionResult?.id}&title=${encodeURIComponent(submissionResult?.title || '')}&video_url=${encodeURIComponent(submissionResult?.videoUrl || formData.source_url || '')}`}
                    className="block"
                  >
                    <div className="bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 hover:border-red-500 rounded-xl p-4 transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <h5 className="font-semibold text-white">Schedule for Livestream</h5>
                          <p className="text-sm text-zinc-400">Pick a time slot to go live on all platforms</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-500 ml-auto group-hover:text-red-400 transition-colors" />
                      </div>
                    </div>
                  </Link>

                  {/* Option 2: Keep in Library */}
                  <Link to="/creator/dashboard" className="block">
                    <div className="bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/50 hover:border-purple-500 rounded-xl p-4 transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Video className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left">
                          <h5 className="font-semibold text-white">Keep in My Library</h5>
                          <p className="text-sm text-zinc-400">Save for later - schedule anytime from your dashboard</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-500 ml-auto group-hover:text-purple-400 transition-colors" />
                      </div>
                    </div>
                  </Link>

                  {/* Option 3: View Public Profile */}
                  {user && (
                    <Link to={`/creator/${user.id || user.user_id}`} className="block">
                      <div className="bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700 hover:border-zinc-600 rounded-xl p-4 transition-all cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-zinc-700 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-left">
                            <h5 className="font-semibold text-white">View My Public Profile</h5>
                            <p className="text-sm text-zinc-400">See how fans view your content page</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-zinc-500 ml-auto group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              </div>

              {/* Share Your Profile */}
              {user && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 max-w-lg mx-auto mb-6">
                  <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-red-400" />
                    Share Your Creator Page
                  </h4>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-zinc-300 truncate">
                      {window.location.origin}/creator/{user.id || user.user_id}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/creator/${user.id || user.user_id}`);
                        toast.success("Link copied!");
                      }}
                      className="border-zinc-700"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">Share this link with your fans so they can browse all your content</p>
                </div>
              )}
              
              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={resetForm}
                  className="bg-red-600 hover:bg-red-500"
                  data-testid="submit-another-btn"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Another
                </Button>
                <Link to="/watch">
                  <Button variant="outline" className="border-zinc-700 hover:border-violet-500">
                    <Play className="w-4 h-4 mr-2" />
                    Watch Live
                  </Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            /* Submission Form */
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onSubmit={handleSubmit}
              className="space-y-6"
              data-testid="submit-form"
            >
              {/* Submission Type Toggle */}
              <div className="flex gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSubmissionType("link")}
                  className={`flex-1 py-3 px-4 rounded-md flex items-center justify-center gap-2 transition-all ${
                    submissionType === "link" 
                      ? "bg-red-600 text-white" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                  data-testid="toggle-link"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span className="font-medium">Share Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionType("upload")}
                  className={`flex-1 py-3 px-4 rounded-md flex items-center justify-center gap-2 transition-all ${
                    submissionType === "upload" 
                      ? "bg-red-600 text-white" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                  data-testid="toggle-upload"
                >
                  <Upload className="w-4 h-4" />
                  <span className="font-medium">Upload Video</span>
                </button>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-400" />
                  Content Title *
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., Epic Skateboard Trick Goes Viral"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500"
                  data-testid="input-title"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Tag className="w-4 h-4 text-red-400" />
                  Category *
                </Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                  <SelectTrigger className="bg-[#18181b] border-zinc-800" data-testid="select-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional: Link or Upload */}
              {submissionType === "link" ? (
                /* Source URL */
                <div className="space-y-2">
                  <Label htmlFor="source_url" className="text-sm font-medium flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-red-400" />
                    Stream/Video URL *
                  </Label>
                  <Input
                    id="source_url"
                    type="url"
                    placeholder="https://youtube.com/watch?v=... or https://tiktok.com/..."
                    value={formData.source_url}
                    onChange={(e) => handleInputChange("source_url", e.target.value)}
                    className="bg-[#18181b] border-zinc-800 focus:border-red-500"
                    data-testid="input-source-url"
                  />
                  <p className="text-xs text-zinc-500">Link to the original video (YouTube, TikTok, Twitter, Instagram, etc.) or your streaming URL</p>
                </div>
              ) : (
                /* File Upload */
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <CloudUpload className="w-4 h-4 text-red-400" />
                    Upload Video *
                  </Label>
                  
                  {selectedFile ? (
                    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center">
                            <FileVideo className="w-6 h-6 text-red-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[250px]">{selectedFile.name}</p>
                            <p className="text-xs text-zinc-500">{formatFileSize(selectedFile.size)}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={removeFile}
                          className="text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {isSubmitting && uploadProgress > 0 && (
                        <div className="mt-4 p-3 bg-red-900/20 border border-red-600/30 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-white font-medium flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                              Uploading to ZTVLIVE...
                            </span>
                            <span className="text-sm text-red-400 font-bold">{uploadProgress}%</span>
                          </div>
                          <Progress value={uploadProgress} className="h-3" />
                          <p className="text-xs text-zinc-500 mt-2 text-center">
                            Please don't close this page until upload completes
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-zinc-800 rounded-lg p-8 text-center cursor-pointer hover:border-red-500/50 hover:bg-red-600/5 transition-all"
                    >
                      <CloudUpload className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                      <p className="text-zinc-400 mb-1">Click to upload or drag and drop</p>
                      <p className="text-xs text-zinc-600">MP4, MOV, AVI, MKV, WebM, ProRes (up to 1TB for 4K/8K)</p>
                      <p className="text-xs text-green-500 mt-2">High-quality 4K/8K content encouraged!</p>
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v,.wmv"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-file"
                  />
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-red-400" />
                  Description *
                </Label>
                <Textarea
                  id="description"
                  placeholder="What's this content about? Give us the context..."
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500 min-h-[100px]"
                  data-testid="input-description"
                />
              </div>

              {/* Why Trending */}
              <div className="space-y-2">
                <Label htmlFor="why_trending" className="text-sm font-medium flex items-center gap-2">
                  <span className="text-red-400">🔥</span>
                  Why is this trending? *
                </Label>
                <Textarea
                  id="why_trending"
                  placeholder="Why should we feature this? What makes it special or viral-worthy?"
                  value={formData.why_trending}
                  onChange={(e) => handleInputChange("why_trending", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500 min-h-[80px]"
                  data-testid="input-why-trending"
                />
              </div>

              {/* Divider */}
              <div className="border-t border-zinc-800 pt-6">
                <p className="text-sm text-zinc-500 mb-4">Your Information</p>
              </div>

              {/* Submitter Name */}
              <div className="space-y-2">
                <Label htmlFor="submitter_name" className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-red-400" />
                  Your Name *
                </Label>
                <Input
                  id="submitter_name"
                  placeholder="Your display name"
                  value={formData.submitter_name}
                  onChange={(e) => handleInputChange("submitter_name", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500"
                  data-testid="input-submitter-name"
                />
              </div>

              {/* Submitter Email */}
              <div className="space-y-2">
                <Label htmlFor="submitter_email" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-red-400" />
                  Email (Optional)
                </Label>
                <Input
                  id="submitter_email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.submitter_email}
                  onChange={(e) => handleInputChange("submitter_email", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500"
                  data-testid="input-submitter-email"
                />
                <p className="text-xs text-zinc-500">We'll notify you if your content gets featured</p>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-red-600 hover:bg-red-500 h-12 font-heading text-lg tracking-wider"
                  data-testid="submit-btn"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      {submissionType === "upload" ? `UPLOADING... ${uploadProgress}%` : "SUBMITTING..."}
                    </>
                  ) : (
                    <>
                      {submissionType === "upload" ? (
                        <><Upload className="w-5 h-5 mr-2" />UPLOAD VIDEO</>
                      ) : (
                        <><Send className="w-5 h-5 mr-2" />SUBMIT CONTENT</>
                      )}
                    </>
                  )}
                </Button>
              </div>

              {/* Go Live CTA */}
              <div className="p-4 bg-gradient-to-r from-violet-900/30 to-red-900/30 border border-violet-600/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-heading text-lg flex items-center gap-2">
                      <Radio className="w-5 h-5 text-violet-400" />
                      Want to stream LIVE?
                    </h4>
                    <p className="text-sm text-zinc-400">Submit your stream to be featured live on ZTVLIVE</p>
                  </div>
                  <Link to="/stream-submit">
                    <Button variant="outline" className="border-violet-600 text-violet-400 hover:bg-violet-600 hover:text-white">
                      GO LIVE
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Rewards Section */}
              <div className="p-6 bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-600/30 rounded-lg">
                <h4 className="font-heading text-xl tracking-wider mb-3 text-red-400 flex items-center gap-2">
                  <span className="text-2xl">🎁</span> CREATOR REWARDS PROGRAM
                </h4>
                <p className="text-zinc-300 mb-4">
                  Get rewarded for your contributions! When your content gets featured on ZTV Live:
                </p>
                <ul className="text-sm text-zinc-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span><strong>70% Revenue Share:</strong> Earn from ad revenue generated by your content</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span><strong>$1.75 per 1,000 views</strong> - Direct payment for performance</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span><strong>Credit & Exposure:</strong> Your name featured across Roku, Fire TV, Samsung, LG, and Web</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span><strong>$50 minimum payout</strong> - Monthly payments via PayPal or direct deposit</span>
                  </li>
                </ul>
              </div>

              {/* Guidelines */}
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                <h4 className="font-heading text-sm tracking-wider mb-2 text-zinc-400">SUBMISSION GUIDELINES</h4>
                <ul className="text-xs text-zinc-500 space-y-1">
                  <li>• <span className="text-green-400">Trusted sources:</span> YouTube, Vimeo, TikTok, Instagram, Twitter, Archive.org</li>
                  <li>• <span className="text-green-400">Copyright-free:</span> Pexels, Pixabay, Coverr, Mixkit, Videvo</li>
                  <li>• Uploads: MP4, MOV, AVI, MKV, WebM, ProRes formats (up to 1TB for 4K/8K)</li>
                  <li>• <span className="text-red-400">Blocked:</span> URL shorteners, piracy sites, suspicious domains</li>
                  <li>• Must be appropriate for all audiences</li>
                  <li>• Trending or viral content gets priority</li>
                  <li>• Our AI reviews all links for authenticity before approval</li>
                </ul>
              </div>
            </motion.form>
          )}
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
