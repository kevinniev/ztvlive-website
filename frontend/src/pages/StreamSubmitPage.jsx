import { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { 
  Tv, Menu, X, Send, CheckCircle, AlertCircle, Clock,
  Link as LinkIcon, User, Mail, MessageSquare, Tag, Video,
  Radio, Shield, Star, Zap, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  { id: "culture", name: "Culture", color: "#f43f5e" },
  { id: "other", name: "Other", color: "#71717a" },
];

const STREAM_TYPES = [
  { id: "hls", name: "HLS Stream (.m3u8)" },
  { id: "rtmp", name: "RTMP Stream" },
  { id: "youtube_live", name: "YouTube Live" },
];

export default function StreamSubmitPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    stream_url: "",
    stream_type: "hls",
    category: "",
    description: "",
    creator_name: "",
    creator_email: "",
    creator_social: "",
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
            creator_name: parsedUser.name || parsedUser.display_name || "",
            creator_email: parsedUser.email || ""
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
          creator_name: response.data.name || response.data.display_name || prev.creator_name,
          creator_email: response.data.email || prev.creator_email
        }));
      } catch (error) {
        // User not logged in - show login prompt
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.stream_url || !formData.category || 
        !formData.description || !formData.creator_name || !formData.creator_email) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Basic URL validation
    const urlPattern = /^(https?|rtmps?):\/\/.+/i;
    if (!urlPattern.test(formData.stream_url)) {
      toast.error("Please enter a valid stream URL (HTTP, HTTPS, or RTMP)");
      return;
    }

    setIsSubmitting(true);
    setReviewResult(null);
    
    try {
      const response = await axios.post(`${API}/stream/submit`, formData);
      setReviewResult(response.data);
      
      if (response.data.approved_for_live) {
        toast.success("Congratulations! Your stream has been approved!");
      } else {
        toast.info("Your stream is under review. We'll contact you soon!");
      }
    } catch (error) {
      console.error("Submission error:", error);
      const errorMsg = error.response?.data?.detail || "Failed to submit stream";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      stream_url: "",
      stream_type: "hls",
      category: "",
      description: "",
      creator_name: "",
      creator_email: "",
      creator_social: "",
    });
    setReviewResult(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved": return "bg-green-600";
      case "needs_review": return "bg-yellow-600";
      case "rejected": return "bg-red-600";
      default: return "bg-zinc-600";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "approved": return <CheckCircle className="w-5 h-5" />;
      case "needs_review": return <Clock className="w-5 h-5" />;
      case "rejected": return <AlertCircle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
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
              <Link to="/submit" className="text-sm text-zinc-400 hover:text-white transition-colors">SUBMIT CONTENT</Link>
              <Link to="/stream-submit" className="text-sm text-white">GO LIVE</Link>
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
              <Radio className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="font-heading text-4xl md:text-5xl tracking-tight uppercase mb-2" data-testid="page-title">
              GO LIVE ON ZTVLIVE
            </h1>
            <p className="text-zinc-400">
              Submit your stream for AI review. If approved, your content will be featured LIVE on Roku, Fire TV, and Web!
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
                    <Radio className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">Sign in to go live</h3>
                    <p className="text-sm text-zinc-400">Track your streams and manage your creator dashboard</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/login?redirect=${encodeURIComponent('/stream-submit')}`}>
                    <Button variant="outline" size="sm" className="border-red-600/50 text-red-400 hover:bg-red-900/30">
                      Sign In
                    </Button>
                  </Link>
                  <Link to={`/signup?redirect=${encodeURIComponent('/stream-submit')}`}>
                    <Button size="sm" className="bg-red-600 hover:bg-red-500">
                      Create Account
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          {reviewResult ? (
            /* Review Result State */
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Status Header */}
              <div className={`${getStatusColor(reviewResult.ai_review?.status)} rounded-lg p-6 text-center`}>
                <div className="flex items-center justify-center gap-3 mb-2">
                  {getStatusIcon(reviewResult.ai_review?.status)}
                  <span className="font-heading text-2xl uppercase">
                    {reviewResult.ai_review?.status === "approved" ? "APPROVED!" : 
                     reviewResult.ai_review?.status === "rejected" ? "NOT APPROVED" : "UNDER REVIEW"}
                  </span>
                </div>
                <p className="text-white/90">{reviewResult.message}</p>
              </div>

              {/* AI Review Details */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <h3 className="font-heading text-xl tracking-wider mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-violet-400" />
                  AI REVIEW RESULTS
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-zinc-800 rounded-lg p-4 text-center">
                    <div className="font-heading text-2xl text-green-400">
                      {reviewResult.ai_review?.score?.toFixed(0) || 0}
                    </div>
                    <div className="text-xs text-zinc-500">Overall Score</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4 text-center">
                    <div className="font-heading text-2xl text-blue-400">
                      {reviewResult.ai_review?.quality_score?.toFixed(0) || 0}
                    </div>
                    <div className="text-xs text-zinc-500">Quality Score</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4 text-center">
                    <div className="font-heading text-lg text-amber-400">
                      {reviewResult.ai_review?.resolution || "N/A"}
                    </div>
                    <div className="text-xs text-zinc-500">Resolution</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4 text-center">
                    <div className="font-heading text-lg text-violet-400">
                      {reviewResult.ai_review?.content_flags?.length || 0}
                    </div>
                    <div className="text-xs text-zinc-500">Content Flags</div>
                  </div>
                </div>

                {reviewResult.ai_review?.analysis && (
                  <div className="mb-4">
                    <h4 className="text-sm text-zinc-400 mb-2">Content Analysis</h4>
                    <p className="text-zinc-300 bg-zinc-800 rounded-lg p-4">
                      {reviewResult.ai_review.analysis}
                    </p>
                  </div>
                )}

                {reviewResult.ai_review?.content_flags?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm text-zinc-400 mb-2">Content Flags</h4>
                    <div className="flex flex-wrap gap-2">
                      {reviewResult.ai_review.content_flags.map((flag, i) => (
                        <Badge key={i} variant="destructive">{flag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {reviewResult.ai_review?.notes && (
                  <div>
                    <h4 className="text-sm text-zinc-400 mb-2">Review Notes</h4>
                    <p className="text-zinc-500 text-sm">{reviewResult.ai_review.notes}</p>
                  </div>
                )}
              </div>

              {/* Submission ID */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-center">
                <p className="text-xs text-zinc-500 mb-1">Your Submission ID</p>
                <code className="text-violet-400 font-mono">{reviewResult.submission_id}</code>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={resetForm}
                  className="bg-red-600 hover:bg-red-500"
                  data-testid="submit-another-btn"
                >
                  Submit Another Stream
                </Button>
                <Link to="/watch">
                  <Button variant="outline" className="border-zinc-700 hover:border-violet-500">
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
              data-testid="stream-submit-form"
            >
              {/* Stream Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium flex items-center gap-2">
                  <Video className="w-4 h-4 text-red-400" />
                  Stream Title *
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., Live Concert from NYC"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500"
                  data-testid="input-title"
                />
              </div>

              {/* Stream URL */}
              <div className="space-y-2">
                <Label htmlFor="stream_url" className="text-sm font-medium flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-red-400" />
                  Stream URL *
                </Label>
                <Input
                  id="stream_url"
                  type="url"
                  placeholder="https://your-stream-server.com/live/stream.m3u8"
                  value={formData.stream_url}
                  onChange={(e) => handleInputChange("stream_url", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500 font-mono text-sm"
                  data-testid="input-stream-url"
                />
                <p className="text-xs text-zinc-500">
                  Secure HLS (.m3u8) or RTMP stream URL. Your stream must be publicly accessible.
                </p>
              </div>

              {/* Stream Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-400" />
                  Stream Type *
                </Label>
                <Select value={formData.stream_type} onValueChange={(value) => handleInputChange("stream_type", value)}>
                  <SelectTrigger className="bg-[#18181b] border-zinc-800" data-testid="select-stream-type">
                    <SelectValue placeholder="Select stream type" />
                  </SelectTrigger>
                  <SelectContent>
                    {STREAM_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-red-400" />
                  Stream Description *
                </Label>
                <Textarea
                  id="description"
                  placeholder="Tell us about your stream. What will viewers see? What makes it special?"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500 min-h-[100px]"
                  data-testid="input-description"
                />
              </div>

              {/* Divider */}
              <div className="border-t border-zinc-800 pt-6">
                <p className="text-sm text-zinc-500 mb-4">Creator Information</p>
              </div>

              {/* Creator Name */}
              <div className="space-y-2">
                <Label htmlFor="creator_name" className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4 text-red-400" />
                  Your Name / Channel Name *
                </Label>
                <Input
                  id="creator_name"
                  placeholder="Your display name or channel"
                  value={formData.creator_name}
                  onChange={(e) => handleInputChange("creator_name", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500"
                  data-testid="input-creator-name"
                />
              </div>

              {/* Creator Email */}
              <div className="space-y-2">
                <Label htmlFor="creator_email" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4 text-red-400" />
                  Email *
                </Label>
                <Input
                  id="creator_email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.creator_email}
                  onChange={(e) => handleInputChange("creator_email", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500"
                  data-testid="input-creator-email"
                />
                <p className="text-xs text-zinc-500">We'll contact you when your stream is approved</p>
              </div>

              {/* Creator Social */}
              <div className="space-y-2">
                <Label htmlFor="creator_social" className="text-sm font-medium flex items-center gap-2">
                  <Star className="w-4 h-4 text-red-400" />
                  Social Media Handle (Optional)
                </Label>
                <Input
                  id="creator_social"
                  placeholder="@yourusername"
                  value={formData.creator_social}
                  onChange={(e) => handleInputChange("creator_social", e.target.value)}
                  className="bg-[#18181b] border-zinc-800 focus:border-red-500"
                  data-testid="input-creator-social"
                />
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
                      AI REVIEWING STREAM...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      SUBMIT FOR AI REVIEW
                    </>
                  )}
                </Button>
              </div>

              {/* AI Review Info */}
              <div className="p-6 bg-gradient-to-r from-red-900/30 to-violet-900/30 border border-red-600/30 rounded-lg">
                <h4 className="font-heading text-xl tracking-wider mb-3 text-red-400 flex items-center gap-2">
                  <Shield className="w-5 h-5" /> AI REVIEW PROCESS
                </h4>
                <p className="text-zinc-300 mb-4">
                  Our AI will automatically review your stream for:
                </p>
                <ul className="text-sm text-zinc-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span><strong>Content Nature:</strong> Is the content appropriate for our audience?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span><strong>Resolution & Quality:</strong> Does the stream meet broadcast standards?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span><strong>Category Fit:</strong> Does the content match your selected category?</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">✓</span>
                    <span><strong>Brand Safety:</strong> Is the content suitable for all viewers?</span>
                  </li>
                </ul>
                <p className="text-xs text-zinc-500 mt-4">
                  * Streams scoring 80+ with no content flags are automatically approved!
                </p>
              </div>

              {/* Guidelines */}
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                <h4 className="font-heading text-sm tracking-wider mb-2 text-zinc-400">STREAM REQUIREMENTS</h4>
                <ul className="text-xs text-zinc-500 space-y-1">
                  <li>• Stream must be publicly accessible (no authentication required)</li>
                  <li>• Minimum recommended resolution: 720p (1080p preferred)</li>
                  <li>• Stable bitrate of at least 2500 kbps</li>
                  <li>• No copyrighted content without proper licensing</li>
                  <li>• Content must be appropriate for general audiences</li>
                  <li>• You must have rights to broadcast the content</li>
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
