import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, Video, CheckCircle, ArrowRight, Calendar, Clock,
  Film, DollarSign, Users, Tv, ChevronRight, Play, LogIn,
  FileVideo, CloudUpload, Loader2, AlertCircle, Sparkles,
  ArrowLeft, X, Trash2, Files
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";

const API = '/api';

// Max file size: 2GB
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks

// Step indicators
const STEPS = {
  AUTH: 0,
  UPLOAD: 1,
  DETAILS: 2,
  SCHEDULE_CHOICE: 3,
  SCHEDULE: 4,
  COMPLETE: 5
};

const UploadAndEarnPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // Auth state
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // login or signup
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "" });
  const [authError, setAuthError] = useState("");
  
  // Upload flow state
  const [currentStep, setCurrentStep] = useState(STEPS.AUTH);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  
  // Multiple files support
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [uploadedVideos, setUploadedVideos] = useState([]);
  
  // Video details with permissions
  const [videoDetails, setVideoDetails] = useState({
    title: "",
    description: "",
    category: "entertainment",
    allow_download: false,
    allow_share: true
  });
  
  // Upload status tracking
  const [uploadStatus, setUploadStatus] = useState(null); // null, 'validating', 'converting', 'failed', 'success'
  const [uploadError, setUploadError] = useState(null);
  const [uploadGuidance, setUploadGuidance] = useState([]);
  
  // Schedule choice
  const [scheduleChoice, setScheduleChoice] = useState(null); // "now" or "later"
  
  // Upload type - file, youtube, or tiktok
  const [uploadType, setUploadType] = useState("file");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeThumbnail, setYoutubeThumbnail] = useState(null);
  
  // TikTok/Shorts import state
  const [socialUrl, setSocialUrl] = useState("");
  const [socialImportResolution, setSocialImportResolution] = useState("1920x1080");
  const [isSocialImporting, setIsSocialImporting] = useState(false);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      if (token) {
        const response = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data && response.data.user_id) {
          setUser(response.data);
          setCurrentStep(STEPS.UPLOAD);
        }
      }
    } catch (error) {
      localStorage.removeItem("token");
      localStorage.removeItem("session_token");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    
    try {
      const endpoint = authMode === "login" ? `${API}/auth/login` : `${API}/auth/signup`;
      const payload = authMode === "login" 
        ? { email: authForm.email, password: authForm.password }
        : { email: authForm.email, password: authForm.password, name: authForm.name };
      
      const response = await axios.post(endpoint, payload);
      
      if (response.data.session_token) {
        localStorage.setItem("token", response.data.session_token);
        localStorage.setItem("session_token", response.data.session_token);
      }
      if (response.data.user) {
        setUser(response.data.user);
        setCurrentStep(STEPS.UPLOAD);
        toast.success(authMode === "login" ? "Welcome back!" : "Account created successfully!");
      }
    } catch (error) {
      setAuthError(error.response?.data?.detail || "Authentication failed");
    }
  };

  // Video duration state
  const [videoDuration, setVideoDuration] = useState(null);
  
  // Format duration for display
  const formatDuration = (seconds) => {
    if (!seconds) return "Unknown";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  // Validate a single file
  const validateFile = (file) => {
    const validTypes = [
      'video/mp4', 'video/mov', 'video/webm', 'video/quicktime',
      'video/x-flv', 'video/flv', 'video/x-msvideo', 'video/avi',
      'video/x-m4v', 'video/m4v', 'video/x-matroska', 'video/mkv',
      'video/3gpp', 'video/3gpp2', 'video/3gp', // Mobile formats
      'video/mpeg', 'video/mp2t', 'video/x-ms-wmv', 'video/x-mpeg',
      'application/octet-stream', '' // Empty for unknown types
    ];
    const validExtensions = ['.mp4', '.mov', '.webm', '.flv', '.avi', '.m4v', '.mkv', '.wmv', '.mpeg', '.mpg', '.3gp', '.3gpp', '.ts'];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    // Accept any video/* MIME type (covers all mobile formats)
    const isValidType = validTypes.includes(file.type) || file.type.startsWith('video/') || file.type === '';
    const isValidExt = validExtensions.includes(fileExt);
    
    // Be more lenient - if extension is video-like, accept it
    if (!isValidType && !isValidExt) {
      // Check if file name suggests it's a video
      const videoExtPattern = /\.(mp4|mov|webm|flv|avi|m4v|mkv|wmv|mpeg|mpg|3gp|3gpp|ts)$/i;
      if (!videoExtPattern.test(file.name)) {
        return { valid: false, error: `${file.name}: Invalid file type (${file.type || 'unknown'})` };
      }
    }
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `${file.name}: File too large (max 2GB)` };
    }
    return { valid: true };
  };

  // Handle multiple file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const validFiles = [];
    const errors = [];
    let totalSize = 0;
    
    for (const file of files) {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push({
          file,
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: 'pending',
          progress: 0,
          title: file.name.replace(/\.[^/.]+$/, ""),
          duration: null
        });
        totalSize += file.size;
      } else {
        errors.push(validation.error);
      }
    }
    
    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
    }
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      toast.success(`Added ${validFiles.length} video${validFiles.length > 1 ? 's' : ''} (${formatFileSize(totalSize)} total)`);
      
      // For single file, also set the legacy state
      if (validFiles.length === 1 && selectedFiles.length === 0) {
        setSelectedFile(validFiles[0].file);
        setVideoDetails(prev => ({ ...prev, title: validFiles[0].title }));
      }
    }
  };

  // Remove file from selection
  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Clear all selected files
  const clearAllFiles = () => {
    setSelectedFiles([]);
    setSelectedFile(null);
  };

  // Chunked upload for large files (>50MB)
  const uploadChunked = async (file, creatorId, creatorName, onProgress) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // Initialize chunked upload
    const initFormData = new FormData();
    initFormData.append("creator_id", creatorId);
    initFormData.append("creator_name", creatorName);
    initFormData.append("filename", file.name);
    initFormData.append("total_size", file.size);
    initFormData.append("total_chunks", totalChunks);
    initFormData.append("category", videoDetails.category);
    initFormData.append("content_type", "video");
    
    const initResponse = await axios.post(`${API}/uploads/video/chunk/init`, initFormData, {
      timeout: 30000
    });
    
    const uploadId = initResponse.data.upload_id;
    
    // Upload each chunk
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      const chunkFormData = new FormData();
      chunkFormData.append("upload_id", uploadId);
      chunkFormData.append("chunk_index", i);
      chunkFormData.append("chunk", chunk, `chunk_${i}`);
      
      const chunkResponse = await axios.post(`${API}/uploads/video/chunk/upload`, chunkFormData, {
        timeout: 180000,
        onUploadProgress: (progressEvent) => {
          const chunkProgress = (progressEvent.loaded / progressEvent.total) * 100;
          const overallProgress = Math.round(((i * 100) + chunkProgress) / totalChunks);
          if (onProgress) onProgress(overallProgress);
        }
      });
      
      if (chunkResponse.data.status === "completed") {
        return chunkResponse.data;
      }
    }
    
    throw new Error("Chunked upload did not complete");
  };

  // Upload a single file (used by batch upload)
  const uploadSingleFile = async (fileItem, creatorId, creatorName) => {
    const file = fileItem.file;
    
    // Use chunked upload for files > 50MB
    if (file.size > 50 * 1024 * 1024) {
      return await uploadChunked(file, creatorId, creatorName, (progress) => {
        setSelectedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, progress } : f
        ));
      });
    } else {
      // Standard upload for smaller files
      const formData = new FormData();
      formData.append("file", file);
      formData.append("creator_id", creatorId);
      formData.append("creator_name", creatorName);
      formData.append("content_type", "video");
      formData.append("category", videoDetails.category);
      formData.append("generate_thumbnail", "true");
      
      const response = await axios.post(`${API}/uploads/video`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600000,
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setSelectedFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, progress } : f
          ));
        }
      });
      return response.data;
    }
  };

  // Batch upload all selected files
  const handleBatchUpload = async () => {
    if (selectedFiles.length === 0 || !user) return;
    
    const creatorId = user.user_id || user.id;
    const creatorName = user.name || user.display_name || "Creator";
    
    if (!creatorId) {
      toast.error("Session error. Please refresh the page and try again.");
      return;
    }
    
    setIsUploading(true);
    const totalFiles = selectedFiles.length;
    const uploaded = [];
    const failed = [];
    
    toast.info(`Starting upload of ${totalFiles} video${totalFiles > 1 ? 's' : ''}...`);
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const fileItem = selectedFiles[i];
      setCurrentUploadIndex(i);
      
      // Update status to uploading
      setSelectedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'uploading' } : f
      ));
      
      try {
        console.log(`[Batch Upload] Uploading ${i + 1}/${totalFiles}: ${fileItem.file.name}`);
        
        const result = await uploadSingleFile(fileItem, creatorId, creatorName);
        
        uploaded.push({
          ...result,
          originalName: fileItem.file.name,
          title: fileItem.title
        });
        
        // Update status to completed
        setSelectedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'completed', progress: 100, uploadResult: result } : f
        ));
        
      } catch (error) {
        console.error(`[Batch Upload] Failed: ${fileItem.file.name}`, error);
        failed.push({ name: fileItem.file.name, error: error.message });
        
        // Update status to failed
        setSelectedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'failed', error: error.message } : f
        ));
      }
    }
    
    setIsUploading(false);
    setUploadedVideos(uploaded);
    
    if (uploaded.length > 0) {
      toast.success(`Uploaded ${uploaded.length} video${uploaded.length > 1 ? 's' : ''} successfully!`);
      
      if (uploaded.length === 1) {
        // Single file - go to details step
        setUploadedVideo({
          id: uploaded[0].id,
          file_url: uploaded[0].file_url,
          filename: uploaded[0].filename
        });
        setCurrentStep(STEPS.DETAILS);
      } else {
        // Multiple files - go directly to complete
        setCurrentStep(STEPS.COMPLETE);
      }
    }
    
    if (failed.length > 0) {
      toast.error(`${failed.length} upload${failed.length > 1 ? 's' : ''} failed`);
    }
  };
  
  // Poll upload status to check for validation/conversion progress
  const pollUploadStatus = async (uploadId) => {
    try {
      const response = await axios.get(`${API}/uploads/status/${uploadId}`);
      const data = response.data;
      
      setUploadStatus(data.status);
      
      if (data.status === 'failed') {
        setUploadError(data.error);
        setUploadGuidance(data.guidance || []);
        toast.error(data.error || "Upload validation failed");
        return 'failed';
      } else if (data.status === 'validating') {
        toast.info("Validating video...", { id: 'upload-status' });
        return 'validating';
      } else if (data.status === 'converting') {
        toast.info("Converting video to web format...", { id: 'upload-status' });
        return 'converting';
      } else if (data.status === 'uploaded') {
        toast.success("Video ready!", { id: 'upload-status' });
        return 'success';
      }
      
      return data.status;
    } catch (error) {
      console.error("Status poll error:", error);
      return 'error';
    }
  };
  
  // Retry failed upload
  const retryFailedUpload = async (uploadId) => {
    try {
      setUploadStatus('retrying');
      setUploadError(null);
      setUploadGuidance([]);
      
      const response = await axios.post(`${API}/uploads/retry/${uploadId}`);
      toast.success(response.data.message || "Retrying upload...");
      
      // Start polling for status
      const pollInterval = setInterval(async () => {
        const status = await pollUploadStatus(uploadId);
        if (status === 'success' || status === 'failed' || status === 'error') {
          clearInterval(pollInterval);
        }
      }, 3000);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Retry failed");
      setUploadStatus('failed');
    }
  };
  
  const handleUpload = async () => {
    // Use batch upload for multiple files
    if (selectedFiles.length > 0) {
      return handleBatchUpload();
    }
    
    if (!selectedFile || !user) return;
    
    const creatorId = user.user_id || user.id;
    const creatorName = user.name || user.display_name || "Creator";
    
    if (!creatorId) {
      toast.error("Session error. Please refresh the page and try again.");
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    console.log(`[Upload] Starting upload: ${selectedFile.name} (${(selectedFile.size / (1024*1024)).toFixed(2)}MB)`);
    
    try {
      let response;
      
      // Use chunked upload for files > 50MB to avoid proxy limits
      if (selectedFile.size > 50 * 1024 * 1024) {
        console.log("[Upload] Using chunked upload for large file");
        toast.info("Large file detected - using optimized upload...");
        response = { data: await uploadChunked(selectedFile, creatorId, creatorName, setUploadProgress) };
      } else {
        // Standard upload for smaller files
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("creator_id", creatorId);
        formData.append("creator_name", creatorName);
        formData.append("content_type", "video");
        formData.append("category", videoDetails.category);
        formData.append("generate_thumbnail", "true");
        
        response = await axios.post(`${API}/uploads/video`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 600000, // 10 minute timeout
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        });
      }
      
      console.log("[Upload] Success:", response.data);
      
      setUploadedVideo({
        id: response.data.id,
        file_url: response.data.file_url,
        filename: response.data.filename
      });
      
      setCurrentStep(STEPS.DETAILS);
      toast.success("Video uploaded successfully! Thumbnail generating...");
    } catch (error) {
      console.error("[Upload] Error:", error);
      console.error("[Upload] Response:", error.response?.data);
      
      // Provide more specific error messages
      let errorMessage = "Upload failed. Please try again.";
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = "Upload timed out. Try a smaller file or check your connection.";
      } else if (error.response?.status === 413) {
        errorMessage = "File too large for upload. Try a file under 100MB or use YouTube link.";
      } else if (error.response?.status === 401) {
        errorMessage = "Session expired. Please refresh and login again.";
      } else if (error.response?.status === 502 || error.response?.status === 504) {
        errorMessage = "Server timeout. Try uploading a smaller file or use YouTube link.";
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (!navigator.onLine) {
        errorMessage = "No internet connection. Please check your network.";
      } else if (error.message) {
        errorMessage = `Upload failed: ${error.message}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // Extract YouTube video ID from URL
  const extractYoutubeId = (url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Handle YouTube URL submission
  const handleYoutubeSubmit = async () => {
    if (!youtubeUrl.trim()) {
      toast.error("Please enter a YouTube URL");
      return;
    }

    const videoId = extractYoutubeId(youtubeUrl);
    if (!videoId) {
      toast.error("Invalid YouTube URL. Please enter a valid YouTube video link.");
      return;
    }

    setIsUploading(true);
    
    try {
      // Set thumbnail
      const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      setYoutubeThumbnail(thumbnail);
      
      // Create video entry with YouTube link
      setUploadedVideo({
        id: null,
        file_url: youtubeUrl,
        youtube_id: videoId,
        thumbnail_url: thumbnail,
        is_youtube: true
      });
      
      // Auto-fill title from video ID (user can change it)
      if (!videoDetails.title) {
        setVideoDetails(prev => ({ ...prev, title: `YouTube Video ${videoId}` }));
      }
      
      setCurrentStep(STEPS.DETAILS);
      toast.success("YouTube video added! Now add your details.");
    } catch (error) {
      console.error("YouTube submit error:", error);
      toast.error("Failed to process YouTube URL. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Import from TikTok, YouTube Shorts, or Instagram Reels
  const handleSocialImport = async () => {
    if (!socialUrl.trim()) {
      toast.error("Please enter a TikTok, YouTube Shorts, or Instagram Reels URL");
      return;
    }

    setIsSocialImporting(true);
    toast.info("Downloading and reframing video for TV... This may take 30-60 seconds.", { duration: 5000 });

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      const response = await axios.post(
        `${API}/creator-videos/import-video`,
        null,
        {
          params: {
            url: socialUrl,
            output_resolution: socialImportResolution,
            blur_background: true,
            creator_id: user?.user_id || user?.id
          },
          headers: { Authorization: `Bearer ${token}` },
          timeout: 120000
        }
      );

      if (response.data.success) {
        const importedVideo = response.data.video;
        
        // Set uploaded video with imported data
        setUploadedVideo({
          id: importedVideo.id,
          file_url: importedVideo.video_url,
          thumbnail_url: importedVideo.thumbnail,
          is_imported: true,
          source_platform: importedVideo.source_platform
        });

        // Auto-fill title
        setVideoDetails(prev => ({ 
          ...prev, 
          title: importedVideo.title || `Imported from ${importedVideo.source_platform}` 
        }));

        setCurrentStep(STEPS.DETAILS);
        toast.success("Video imported and reframed for TV! Add your details.");
        setSocialUrl("");
      }
    } catch (error) {
      console.error("Social import error:", error);
      const errorMsg = error.response?.data?.detail || error.response?.data?.error || "";
      const suggestion = error.response?.data?.suggestion || "";
      
      if (error.code === 'ECONNABORTED') {
        toast.error("Import timed out. The video may be too long. Try again.");
      } else if (errorMsg.includes("blocked") || errorMsg.includes("TikTok")) {
        toast.error("TikTok is blocking our server. Try YouTube Shorts instead, or download and upload directly.", { duration: 6000 });
      } else if (errorMsg.includes("Unsupported URL")) {
        toast.error("Could not access this video. Try using the full video URL (not a shortened link).", { duration: 5000 });
      } else {
        toast.error(errorMsg || "Failed to import video. Try YouTube Shorts or upload directly.", { duration: 5000 });
      }
    } finally {
      setIsSocialImporting(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!videoDetails.title.trim()) {
      toast.error("Please enter a title for your video");
      return;
    }
    
    try {
      // Save video to creator library
      const token = localStorage.getItem("token") || localStorage.getItem("session_token");
      
      const videoData = {
        title: videoDetails.title,
        description: videoDetails.description,
        category: videoDetails.category,
        video_url: uploadedVideo.file_url,
        tags: []
      };
      
      // Add YouTube-specific fields if applicable
      if (uploadedVideo.is_youtube) {
        videoData.youtube_id = uploadedVideo.youtube_id;
        videoData.thumbnail_url = uploadedVideo.thumbnail_url;
      }
      
      const uploadResponse = await axios.post(
        `${API}/creator-videos/upload?creator_id=${user.user_id || user.id}&creator_name=${encodeURIComponent(user.name || user.display_name)}`,
        videoData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Trigger automatic content review
      try {
        const reviewResponse = await axios.post(
          `${API}/content-automation/process-submission`,
          {
            content_id: uploadResponse.data?.id || uploadedVideo.id,
            title: videoDetails.title,
            description: videoDetails.description || "",
            category: videoDetails.category,
            video_url: uploadedVideo.file_url,
            creator_id: user.user_id || user.id,
            creator_email: user.email
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        // Show appropriate message based on review result
        if (reviewResponse.data?.auto_approved) {
          toast.success("Content approved! Ready for broadcast.");
        } else if (reviewResponse.data?.status === "flagged") {
          toast.warning("Content flagged for review. Check your dashboard for details on what needs to be fixed.");
        } else {
          toast.info("Content submitted for review.");
        }
      } catch (reviewError) {
        // Don't block the flow if review fails
        console.warn("Auto-review error:", reviewError);
        toast.info("Content uploaded. Manual review may be required.");
      }
      
      setCurrentStep(STEPS.SCHEDULE_CHOICE);
    } catch (error) {
      console.error("Save details error:", error);
      toast.error("Failed to save video details. Please try again.");
    }
  };

  const handleScheduleChoice = (choice) => {
    setScheduleChoice(choice);
    if (choice === "now") {
      // Navigate to schedule page with video pre-selected
      const params = new URLSearchParams({
        video: uploadedVideo.id,
        title: videoDetails.title,
        video_url: uploadedVideo.file_url
      });
      navigate(`/creator/schedule?${params.toString()}`);
    } else {
      setCurrentStep(STEPS.COMPLETE);
    }
  };

  const categories = [
    { value: "music", label: "Music", icon: "🎵" },
    { value: "entertainment", label: "Entertainment", icon: "🎬" },
    { value: "sports", label: "Sports", icon: "⚽" },
    { value: "gaming", label: "Gaming", icon: "🎮" },
    { value: "education", label: "Education", icon: "📚" },
    { value: "comedy", label: "Comedy", icon: "😂" },
    { value: "lifestyle", label: "Lifestyle", icon: "✨" },
    { value: "other", label: "Other", icon: "📺" }
  ];

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

      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          {[
            { step: STEPS.AUTH, label: "Sign In", icon: LogIn },
            { step: STEPS.UPLOAD, label: "Upload", icon: Upload },
            { step: STEPS.DETAILS, label: "Details", icon: FileVideo },
            { step: STEPS.SCHEDULE_CHOICE, label: "Schedule", icon: Calendar },
            { step: STEPS.COMPLETE, label: "Done", icon: CheckCircle }
          ].map((item, index) => (
            <div key={index} className="flex items-center">
              <div className={`flex flex-col items-center ${currentStep >= item.step ? 'text-red-500' : 'text-zinc-600'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-colors ${
                  currentStep >= item.step ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500'
                } ${currentStep === item.step ? 'ring-2 ring-red-400 ring-offset-2 ring-offset-black' : ''}`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-xs">{item.label}</span>
              </div>
              {index < 4 && (
                <div className={`w-16 h-0.5 mx-2 ${currentStep > item.step ? 'bg-red-600' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pb-20">
        <AnimatePresence mode="wait">
          {/* Step 0: Auth Required */}
          {currentStep === STEPS.AUTH && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div className="bg-gradient-to-r from-red-900/20 to-purple-900/20 border border-red-600/30 rounded-2xl p-8 mb-8">
                <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-3xl font-bold mb-4">Upload & Earn</h1>
                <p className="text-zinc-400 mb-6 max-w-lg mx-auto">
                  Share your content on ZTVLIVE's 24/7 broadcast and earn <span className="text-red-400 font-semibold">70% revenue share</span> from views across Roku, Fire TV, Samsung, LG, and Web.
                </p>
                
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-8">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">$5-15</div>
                    <div className="text-xs text-zinc-500">Per 1K views</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">70%</div>
                    <div className="text-xs text-zinc-500">Revenue share</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">Weekly</div>
                    <div className="text-xs text-zinc-500">Payouts</div>
                  </div>
                </div>

                {!showAuthForm ? (
                  <div className="flex flex-col items-center gap-3">
                    <Button 
                      onClick={() => { setShowAuthForm(true); setAuthMode("login"); }}
                      className="bg-red-600 hover:bg-red-500 px-8"
                      size="lg"
                    >
                      <LogIn className="w-5 h-5 mr-2" />
                      Sign In to Upload
                    </Button>
                    <button 
                      onClick={() => { setShowAuthForm(true); setAuthMode("signup"); }}
                      className="text-zinc-400 hover:text-white text-sm"
                    >
                      Don't have an account? <span className="text-red-400">Sign up free</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleAuth} className="max-w-sm mx-auto">
                    <div className="flex gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setAuthMode("login")}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          authMode === "login" ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode("signup")}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          authMode === "signup" ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        Sign Up
                      </button>
                    </div>
                    
                    {authMode === "signup" && (
                      <Input
                        type="text"
                        placeholder="Your name"
                        value={authForm.name}
                        onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                        className="mb-3 bg-zinc-900 border-zinc-700"
                        autoComplete="name"
                        required
                      />
                    )}
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      className="mb-3 bg-zinc-900 border-zinc-700"
                      autoComplete="email"
                      inputMode="email"
                      required
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      className="mb-3 bg-zinc-900 border-zinc-700"
                      autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                      required
                    />
                    
                    {authError && (
                      <p className="text-red-400 text-sm mb-3">{authError}</p>
                    )}
                    
                    <Button type="submit" className="w-full bg-red-600 hover:bg-red-500">
                      {authMode === "login" ? "Sign In & Continue" : "Create Account"}
                    </Button>
                    
                    <button
                      type="button"
                      onClick={() => setShowAuthForm(false)}
                      className="mt-3 text-zinc-500 hover:text-white text-sm"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 1: Upload */}
          {currentStep === STEPS.UPLOAD && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Upload Your Video</h1>
                <p className="text-zinc-400">Select a video file or share a YouTube link</p>
              </div>

              {/* Upload Type Toggle */}
              <div className="flex justify-center gap-2 mb-6 flex-wrap">
                <button
                  onClick={() => setUploadType("file")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    uploadType === "file" 
                      ? "bg-red-600 text-white" 
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  <Upload className="w-4 h-4 inline mr-1" />
                  Upload File
                </button>
                <button
                  onClick={() => setUploadType("youtube")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    uploadType === "youtube" 
                      ? "bg-red-600 text-white" 
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  <Play className="w-4 h-4 inline mr-1" />
                  YouTube
                </button>
                <button
                  onClick={() => setUploadType("tiktok")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    uploadType === "tiktok" 
                      ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white" 
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  <Sparkles className="w-4 h-4 inline mr-1" />
                  TikTok/Shorts
                </button>
              </div>

              {uploadType === "file" && (
                <>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all touch-manipulation ${
                      selectedFiles.length > 0
                        ? "border-green-500 bg-green-900/10" 
                        : "border-zinc-700 hover:border-red-500 hover:bg-red-900/5 active:border-red-500 active:bg-red-900/10"
                    }`}
                  >
                    {/* File input with mobile-friendly attributes */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*,.mp4,.mov,.webm,.flv,.avi,.mkv,.m4v,.wmv,.mpeg,.mpg,.3gp,.3gpp"
                      onChange={handleFileSelect}
                      multiple
                      className="hidden"
                    />
                    
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <Files className="w-7 h-7 sm:w-8 sm:h-8 text-zinc-400" />
                    </div>
                    <p className="text-base sm:text-lg font-medium text-white mb-1">
                      {selectedFiles.length > 0 ? "Tap to add more videos" : "Tap to select videos"}
                    </p>
                    <p className="text-xs sm:text-sm text-zinc-500">MP4, MOV, WebM, 3GP • Max 2GB</p>
                    <p className="text-xs text-zinc-600 mt-1 hidden sm:block">Select multiple files at once for batch upload</p>
                    
                    {/* Mobile hint */}
                    <p className="text-xs text-purple-400 mt-3 sm:hidden">
                      Choose from Gallery or Files app
                    </p>
                  </div>

                  {/* Selected Files Queue */}
                  {selectedFiles.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-white flex items-center gap-2">
                          <FileVideo className="w-4 h-4" />
                          {selectedFiles.length} video{selectedFiles.length > 1 ? 's' : ''} selected
                          <span className="text-zinc-500">
                            ({formatFileSize(selectedFiles.reduce((acc, f) => acc + f.file.size, 0))} total)
                          </span>
                        </h3>
                        <button 
                          onClick={clearAllFiles}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Clear all
                        </button>
                      </div>
                      
                      <div className="bg-zinc-900 rounded-xl p-4 max-h-64 overflow-y-auto space-y-2">
                        {selectedFiles.map((fileItem, index) => (
                          <div 
                            key={fileItem.id}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              fileItem.status === 'completed' ? 'bg-green-900/20' :
                              fileItem.status === 'failed' ? 'bg-red-900/20' :
                              fileItem.status === 'uploading' ? 'bg-purple-900/20' :
                              'bg-zinc-800'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-xs text-zinc-500 w-6">{index + 1}.</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{fileItem.file.name}</p>
                                <p className="text-xs text-zinc-500">{formatFileSize(fileItem.file.size)}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {fileItem.status === 'uploading' && (
                                <div className="flex items-center gap-2">
                                  <div className="w-20">
                                    <Progress value={fileItem.progress} className="h-2" />
                                  </div>
                                  <span className="text-xs text-purple-400">{fileItem.progress}%</span>
                                </div>
                              )}
                              {fileItem.status === 'completed' && (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              )}
                              {fileItem.status === 'failed' && (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                              )}
                              {fileItem.status === 'pending' && !isUploading && (
                                <button 
                                  onClick={() => removeFile(fileItem.id)}
                                  className="p-1 hover:bg-zinc-700 rounded"
                                >
                                  <X className="w-4 h-4 text-zinc-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Upload Button */}
                      {!isUploading ? (
                        <Button 
                          onClick={handleBatchUpload}
                          className="w-full bg-red-600 hover:bg-red-500 h-14 text-lg"
                        >
                          <Upload className="w-5 h-5 mr-2" />
                          Upload {selectedFiles.length} Video{selectedFiles.length > 1 ? 's' : ''}
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                      ) : (
                        <div className="bg-zinc-900 rounded-xl p-6">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-white flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                              Uploading {currentUploadIndex + 1} of {selectedFiles.length}...
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-2 text-center">
                            Please don't close this page • Thumbnails will be auto-generated
                          </p>
                        </div>
                      )}
                      
                      {/* Upload Status Messages */}
                      {uploadStatus === 'validating' && (
                        <div className="mt-4 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Validating your video...</span>
                          </div>
                        </div>
                      )}
                      
                      {uploadStatus === 'converting' && (
                        <div className="mt-4 p-4 bg-purple-900/20 border border-purple-600/30 rounded-lg">
                          <div className="flex items-center gap-2 text-purple-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Converting video to web-compatible format (high quality)...</span>
                          </div>
                          <p className="text-xs text-purple-300/70 mt-2">This may take a few minutes for larger videos</p>
                        </div>
                      )}
                      
                      {/* Failed Upload with Guidance */}
                      {uploadStatus === 'failed' && (
                        <div className="mt-4 p-4 bg-red-900/20 border border-red-600/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="text-red-400 font-medium">{uploadError || "Upload Failed"}</h4>
                              {uploadGuidance.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {uploadGuidance.map((tip, idx) => (
                                    <li key={idx} className="text-sm text-red-300/70 flex items-start gap-2">
                                      <span className="text-red-400">•</span>
                                      {tip}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <div className="flex gap-2 mt-3">
                                {uploadedVideo?.id && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => retryFailedUpload(uploadedVideo.id)}
                                    className="border-red-600 text-red-400 hover:bg-red-600/10"
                                  >
                                    Retry Upload
                                  </Button>
                                )}
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setUploadStatus(null);
                                    setUploadError(null);
                                    setUploadGuidance([]);
                                    setSelectedFiles([]);
                                    setSelectedFile(null);
                                  }}
                                  className="border-zinc-600"
                                >
                                  Upload Different Video
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* YouTube Link Option */}
              {uploadType === "youtube" && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center">
                      <Play className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Share a YouTube Video</h3>
                      <p className="text-sm text-zinc-400">Paste your YouTube video link below</p>
                    </div>
                  </div>
                  
                  <Input
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="bg-zinc-800 border-zinc-700 mb-4"
                  />
                  
                  {youtubeThumbnail && (
                    <div className="mb-4">
                      <img 
                        src={youtubeThumbnail} 
                        alt="Video thumbnail"
                        className="w-full max-w-md mx-auto rounded-lg"
                      />
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleYoutubeSubmit}
                    disabled={!youtubeUrl.trim()}
                    className="w-full bg-red-600 hover:bg-red-500 h-14 text-lg disabled:opacity-50"
                  >
                    Continue with YouTube Video
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              )}

              {/* TikTok/Shorts Import Option */}
              {uploadType === "tiktok" && (
                <div className="border-2 border-dashed border-pink-700 rounded-2xl p-8 bg-gradient-to-br from-pink-900/20 to-purple-900/20">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-pink-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Import from TikTok, YouTube Shorts, or Reels</h3>
                      <p className="text-sm text-zinc-400">Auto-reframes vertical video to TV format with blur background</p>
                    </div>
                  </div>
                  
                  <Input
                    value={socialUrl}
                    onChange={(e) => setSocialUrl(e.target.value)}
                    placeholder="Paste TikTok, YouTube Shorts, or Instagram Reels URL..."
                    className="bg-zinc-800 border-zinc-700 mb-4"
                    disabled={isSocialImporting}
                  />
                  
                  <div className="mb-4">
                    <label className="text-sm text-zinc-400 mb-2 block">Output Resolution for TV</label>
                    <div className="flex gap-2">
                      {[
                        { value: "1280x720", label: "720p HD" },
                        { value: "1920x1080", label: "1080p Full HD" },
                        { value: "3840x2160", label: "4K UHD" }
                      ].map(res => (
                        <button
                          key={res.value}
                          onClick={() => setSocialImportResolution(res.value)}
                          disabled={isSocialImporting}
                          className={`px-4 py-2 rounded-lg text-sm transition-all ${
                            socialImportResolution === res.value 
                              ? "bg-purple-600 text-white" 
                              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                          }`}
                        >
                          {res.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-800/50 rounded-lg text-sm mb-4">
                    <p className="text-zinc-300 font-medium">Auto-Reframe for TV</p>
                    <p className="text-zinc-500 text-xs mt-1">
                      Vertical videos (9:16) are automatically converted to horizontal (16:9) with a beautiful blurred background.
                    </p>
                    <p className="text-amber-400 text-xs mt-2">
                      💡 Tip: YouTube Shorts work most reliably. TikTok may be blocked in some regions.
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleSocialImport}
                    disabled={!socialUrl.trim() || isSocialImporting}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 h-14 text-lg disabled:opacity-50"
                  >
                    {isSocialImporting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Downloading & Reframing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Import & Reframe for TV
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Troubleshooting tip */}
              <p className="text-center text-xs text-zinc-500 mt-4">
                Having trouble uploading? Try using a YouTube link instead, or upload a smaller file.
              </p>
            </motion.div>
          )}

          {/* Step 2: Video Details */}
          {currentStep === STEPS.DETAILS && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h1 className="text-3xl font-bold mb-2">Video Uploaded!</h1>
                <p className="text-zinc-400">Now add some details about your content</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Video Title *</label>
                  <Input
                    value={videoDetails.title}
                    onChange={(e) => setVideoDetails({ ...videoDetails, title: e.target.value })}
                    placeholder="Enter a catchy title for your video"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>

                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Description</label>
                  <Textarea
                    value={videoDetails.description}
                    onChange={(e) => setVideoDetails({ ...videoDetails, description: e.target.value })}
                    placeholder="Tell viewers what your video is about..."
                    className="bg-zinc-800 border-zinc-700 min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="text-sm text-zinc-400 mb-2 block">Category</label>
                  <div className="grid grid-cols-4 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setVideoDetails({ ...videoDetails, category: cat.value })}
                        className={`p-3 rounded-lg border transition-all text-center ${
                          videoDetails.category === cat.value
                            ? "bg-red-600/20 border-red-500 text-white"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <span className="block text-xs mt-1">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Permissions Section */}
                <div className="mt-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <h3 className="text-sm font-medium text-white mb-3">Fan Permissions</h3>
                  <div className="space-y-3">
                    {/* Allow Download Toggle */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-zinc-400">Allow fans to download video</span>
                      <button
                        type="button"
                        onClick={() => setVideoDetails({ ...videoDetails, allow_download: !videoDetails.allow_download })}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          videoDetails.allow_download ? 'bg-emerald-600' : 'bg-zinc-600'
                        }`}
                      >
                        <span 
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            videoDetails.allow_download ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </label>
                    
                    {/* Allow Share Toggle */}
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-zinc-400">Allow fans to share video link</span>
                      <button
                        type="button"
                        onClick={() => setVideoDetails({ ...videoDetails, allow_share: !videoDetails.allow_share })}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          videoDetails.allow_share ? 'bg-emerald-600' : 'bg-zinc-600'
                        }`}
                      >
                        <span 
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                            videoDetails.allow_share ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                </div>

                <Button 
                  onClick={handleSaveDetails}
                  className="w-full bg-red-600 hover:bg-red-500 h-14 text-lg mt-6"
                >
                  Continue to Scheduling
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Schedule Choice */}
          {currentStep === STEPS.SCHEDULE_CHOICE && (
            <motion.div
              key="schedule-choice"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-purple-500" />
                </div>
                <h1 className="text-3xl font-bold mb-2">Almost There!</h1>
                <p className="text-zinc-400">Your video is saved. What would you like to do next?</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Schedule Now */}
                <button
                  onClick={() => handleScheduleChoice("now")}
                  className="bg-gradient-to-br from-red-900/30 to-purple-900/30 border border-red-600/50 hover:border-red-500 rounded-2xl p-6 text-left transition-all hover:scale-[1.02] group"
                >
                  <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Calendar className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Schedule for Broadcast</h3>
                  <p className="text-zinc-400 text-sm mb-4">
                    Pick a time slot to go LIVE on the big screen. Your video will play on Roku, Fire TV, Samsung, LG, and Web at your scheduled time.
                  </p>
                  <div className="flex items-center text-red-400 font-medium">
                    Choose time slot
                    <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Save for Later */}
                <button
                  onClick={() => handleScheduleChoice("later")}
                  className="bg-zinc-900 border border-zinc-700 hover:border-zinc-600 rounded-2xl p-6 text-left transition-all hover:scale-[1.02] group"
                >
                  <div className="w-14 h-14 bg-zinc-700 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Film className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Keep in My Library</h3>
                  <p className="text-zinc-400 text-sm mb-4">
                    Save your video to your library and schedule it anytime from your Creator Dashboard. Perfect if you're not ready to go live yet.
                  </p>
                  <div className="flex items-center text-zinc-400 font-medium">
                    Go to Dashboard
                    <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>

              {/* Info Box */}
              <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <h4 className="font-medium text-white mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                  How it works
                </h4>
                <ul className="text-sm text-zinc-400 space-y-1">
                  <li>• Your video is auto-reviewed instantly by our AI system</li>
                  <li>• Clean content is approved within seconds</li>
                  <li>• You'll appear in the "Upcoming" section before going live</li>
                  <li>• Earn 70% of ad revenue from your content views</li>
                </ul>
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
              <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-3xl font-bold mb-2">You're All Set!</h1>
              <p className="text-zinc-400 mb-8">
                Your video "<span className="text-white">{videoDetails.title}</span>" has been saved to your library.
              </p>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md mx-auto mb-8">
                <h3 className="font-medium text-white mb-4">What's Next?</h3>
                <ul className="text-left text-sm text-zinc-400 space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    Video uploaded and saved to your library
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Auto-reviewed and approved instantly
                  </li>
                  <li className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                    Schedule anytime from your Dashboard
                  </li>
                </ul>
              </div>

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
                    setCurrentStep(STEPS.UPLOAD);
                    setSelectedFile(null);
                    setUploadedVideo(null);
                    setVideoDetails({ title: "", description: "", category: "entertainment" });
                  }}
                  className="border-zinc-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Another
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default UploadAndEarnPage;
