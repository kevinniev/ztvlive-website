import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Radio, Clock, Play, Calendar, ChevronLeft, ChevronRight, Eye, Pause, Volume2, VolumeX,
  ExternalLink, Tv, User, Upload, Link as LinkIcon, Video, X, Check, AlertCircle, Bell, BellOff,
  Sparkles, MonitorPlay, Users, Star, Zap, Globe, CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import { SEO } from "@/components/SEO";

const API = '/api';

// Get viewer's timezone offset in hours
const getTimezoneOffset = () => {
  return -new Date().getTimezoneOffset() / 60; // Returns offset in hours (e.g., -7 for Arizona)
};

// Get viewer's timezone name
const getTimezoneName = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Local Time';
  }
};

// Convert UTC hour (can be decimal like 14.25 for 14:15) to local hour
const utcToLocal = (utcHour) => {
  const offset = getTimezoneOffset();
  let localHour = (utcHour + offset) % 24;
  if (localHour < 0) localHour += 24;
  return localHour;
};

// Convert local hour to UTC hour
const localToUtc = (localHour) => {
  const offset = getTimezoneOffset();
  let utcHour = (localHour - offset) % 24;
  if (utcHour < 0) utcHour += 24;
  return utcHour;
};

// Format slot time for display (12-hour format with AM/PM)
// utcSlotIndex can be decimal: 14.25 = 14:15, 14.5 = 14:30, 14.75 = 14:45
const formatLocalTime = (utcSlotIndex) => {
  const utcHour = Math.floor(utcSlotIndex);
  const utcMinute = Math.round((utcSlotIndex - utcHour) * 60);
  
  const localHour = utcToLocal(utcHour);
  const hour12 = localHour === 0 ? 12 : localHour > 12 ? localHour - 12 : localHour;
  const ampm = localHour < 12 ? 'AM' : 'PM';
  const minuteStr = String(utcMinute).padStart(2, '0');
  return `${hour12}:${minuteStr} ${ampm}`;
};

// Format slot time for display (24-hour format)
const formatLocalTime24 = (utcSlotIndex) => {
  const utcHour = Math.floor(utcSlotIndex);
  const utcMinute = Math.round((utcSlotIndex - utcHour) * 60);
  const localHour = utcToLocal(utcHour);
  return `${String(localHour).padStart(2, '0')}:${String(utcMinute).padStart(2, '0')}`;
};

// Get current local hour
const getCurrentLocalHour = () => {
  return new Date().getHours();
};

// Get current local minute
const getCurrentLocalMinute = () => {
  return new Date().getMinutes();
};

// TV Programming Blocks (matches backend tv_scheduler.py) - these are in UTC
const TV_PROGRAM_BLOCKS = [
  { hour: 6, name: "TECH MORNING RISE", desc: "Tech trends & innovation", icon: "💡", gradient: "from-cyan-600 to-blue-700" },
  { hour: 8, name: "THE MORNING SHOW", desc: "News, culture & buzz", icon: "☀️", gradient: "from-orange-500 to-amber-600" },
  { hour: 10, name: "CREATIVE HOUR", desc: "Art, vlogs & podcasts", icon: "🎨", gradient: "from-pink-500 to-rose-600" },
  { hour: 12, name: "LUNCHTIME BEATS", desc: "Music videos & performances", icon: "🎵", gradient: "from-purple-600 to-violet-700" },
  { hour: 14, name: "GAME ON", desc: "Gaming highlights & esports", icon: "🎮", gradient: "from-green-500 to-emerald-600" },
  { hour: 16, name: "SPORTS CENTRAL", desc: "Sports highlights & analysis", icon: "⚽", gradient: "from-red-500 to-rose-600" },
  { hour: 18, name: "EVENING VIBES", desc: "Music & entertainment mix", icon: "🌆", gradient: "from-indigo-500 to-purple-600" },
  { hour: 20, name: "PRIME TIME", desc: "Best of the best content", icon: "⭐", gradient: "from-amber-500 to-orange-600" },
  { hour: 22, name: "NIGHT OWL", desc: "Late night entertainment", icon: "🦉", gradient: "from-slate-600 to-zinc-700" },
  { hour: 0, name: "MIDNIGHT MIX", desc: "Overnight viewing", icon: "🌙", gradient: "from-violet-600 to-indigo-800" },
  { hour: 2, name: "DEEP NIGHT", desc: "Chill & documentary", icon: "✨", gradient: "from-blue-800 to-slate-900" },
  { hour: 4, name: "EARLY BIRD", desc: "Podcasts & wellness", icon: "🐦", gradient: "from-teal-500 to-cyan-600" },
];

const CATEGORY_COLORS = {
  sports: "#f97316",
  podcast: "#8b5cf6",
  music: "#d946ef",
  film: "#ec4899",
  tech: "#06b6d4",
  gaming: "#22c55e",
  news: "#eab308",
  culture: "#f43f5e",
  promo: "#7c3aed",
  documentary: "#0ea5e9",
  comedy: "#f59e0b",
  fitness: "#10b981",
  vlogs: "#6366f1",
  buzz: "#ef4444",
  creator_content: "#10b981",
};

const CATEGORY_LABELS = {
  sports: "Sports Highlights",
  music: "Music & Performances",
  podcast: "Podcasts & Interviews",
  gaming: "Gaming Content",
  film: "Film & Entertainment",
  news: "News & Updates",
  culture: "Culture & Lifestyle",
  tech: "Tech & Innovation",
  promo: "ZTVLIVE Promo",
  documentary: "Documentaries",
  comedy: "Comedy & Humor",
  fitness: "Fitness & Wellness",
  vlogs: "Vlogs & Lifestyle",
  buzz: "Viral & Trending",
  creator_content: "Creator Content",
};

const CONTENT_TYPES = [
  { id: "youtube", label: "YouTube Video", icon: Video },
  { id: "live_embed", label: "Live Stream Embed", icon: Radio },
  { id: "video", label: "Direct Video URL", icon: LinkIcon },
];

const CATEGORIES = ["sports", "music", "podcast", "gaming", "film", "news", "culture", "tech", "documentary", "comedy", "fitness", "vlogs", "buzz"];

// Get the current program block for an hour
const getProgramBlock = (hour) => {
  // Find the matching program block based on hour ranges
  // Each block starts at a specific hour and runs for ~2 hours
  for (let i = TV_PROGRAM_BLOCKS.length - 1; i >= 0; i--) {
    const block = TV_PROGRAM_BLOCKS[i];
    const nextBlock = TV_PROGRAM_BLOCKS[(i + 1) % TV_PROGRAM_BLOCKS.length];
    const blockEnd = nextBlock.hour;
    
    // Handle wraparound (e.g., block starting at 22 ends at 0)
    if (block.hour > blockEnd) {
      // Wraparound case
      if (hour >= block.hour || hour < blockEnd) {
        return block;
      }
    } else {
      // Normal case
      if (hour >= block.hour && hour < blockEnd) {
        return block;
      }
    }
  }
  return TV_PROGRAM_BLOCKS[0]; // Default fallback
};

export default function SchedulePage() {
  const [schedule, setSchedule] = useState([]);
  const [tvGuide, setTvGuide] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentHour, setCurrentHour] = useState(new Date().getUTCHours());
  const [currentLocalHour, setCurrentLocalHour] = useState(getCurrentLocalHour());
  const [serverTime, setServerTime] = useState(null);
  const [localTime, setLocalTime] = useState(new Date().toLocaleTimeString());
  const [timezone, setTimezone] = useState(getTimezoneName());
  const [scheduleDate, setScheduleDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState(0);
  const [creatorSlots, setCreatorSlots] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  // Preview modal
  const [previewSlot, setPreviewSlot] = useState(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [previewTimeLeft, setPreviewTimeLeft] = useState(60); // 60 second preview limit
  const [previewEnded, setPreviewEnded] = useState(false);
  const previewVideoRef = useRef(null);
  const previewTimerRef = useRef(null);
  const gridRef = useRef(null);
  
  // Subscribe modal
  const [subscribeModalSlot, setSubscribeModalSlot] = useState(null);
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeLoading, setSubscribeLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  
  // Quick Booking Modal (for Claim Slot)
  const [quickBookModal, setQuickBookModal] = useState(null);
  const [quickBookVideo, setQuickBookVideo] = useState(null);
  const [quickBookYouTubeUrl, setQuickBookYouTubeUrl] = useState("");
  const [quickBookTitle, setQuickBookTitle] = useState("");
  const [quickBookLoading, setQuickBookLoading] = useState(false);
  const [quickBookDetectingTRT, setQuickBookDetectingTRT] = useState(false);
  const [quickBookDetectedTRT, setQuickBookDetectedTRT] = useState(null);
  const [quickBookLibraryVideos, setQuickBookLibraryVideos] = useState([]);
  const [quickBookSelectedLibraryVideo, setQuickBookSelectedLibraryVideo] = useState(null);
  const [quickBookShowLibrary, setQuickBookShowLibrary] = useState(false);
  const [quickBookLoadingLibrary, setQuickBookLoadingLibrary] = useState(false);
  
  // Notification subscription
  const [notifySlot, setNotifySlot] = useState(null);
  const [subscribedSlots, setSubscribedSlots] = useState(() => {
    const saved = localStorage.getItem("ztv_subscribed_slots");
    return saved ? JSON.parse(saved) : [];
  });
  
  // Category browser
  const [categoryBrowser, setCategoryBrowser] = useState(null);
  const [categoryContent, setCategoryContent] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [arizonaTime, setArizonaTime] = useState(null);
  
  // Booking modal
  const [bookingSlot, setBookingSlot] = useState(null);
  const [holdMode, setHoldMode] = useState(false); // For "hold for later" booking
  const [bookingForm, setBookingForm] = useState({
    title: "",
    description: "",
    content_type: "youtube",
    video_url: "",
    thumbnail: "",
    category: "music"
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  
  // User info (would come from auth in production)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("ztv_user");
    return saved ? JSON.parse(saved) : null;
  });
  
  const navigate = useNavigate();

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, timeRes, syncRes] = await Promise.all([
        axios.get(`${API}/schedule?date=${selectedDate}`),
        axios.get(`${API}/schedule/time`),
        axios.get(`${API}/tv/sync`)
      ]);
      setSchedule(schedRes.data.schedule);
      setCurrentHour(schedRes.data.current_hour);
      setServerTime(schedRes.data.server_time);
      setScheduleDate(schedRes.data.schedule_date);
      setAvailableSlots(schedRes.data.available_slots);
      setCreatorSlots(schedRes.data.creator_slots);
      setArizonaTime(timeRes.data);
      
      // Set TV guide from the schedule data
      const guide = schedRes.data.schedule.map(slot => ({
        hour: slot.slot_index,
        content: {
          type: slot.is_creator_slot ? 'creator' : 'ai',
          program_name: slot.program_block || slot.highlight?.title,
          title: slot.highlight?.title,
          description: slot.highlight?.description,
          thumbnail: slot.highlight?.thumbnail,
          creator_name: slot.creator_info?.creator_name,
          categories: [slot.scheduled_category],
          is_bookable: slot.is_bookable,
          is_past: slot.is_past
        }
      }));
      setTvGuide(guide);
    } catch (error) {
      console.error("Error fetching schedule:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // Fetch category content for browsing
  const openCategoryBrowser = async (category) => {
    setCategoryBrowser(category);
    setCategoryLoading(true);
    try {
      const res = await axios.get(`${API}/schedule/category/${category}`);
      setCategoryContent(res.data.content);
    } catch (error) {
      console.error("Error fetching category content:", error);
      toast.error("Failed to load category content");
      setCategoryContent([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  const closeCategoryBrowser = () => {
    setCategoryBrowser(null);
    setCategoryContent([]);
  };

  useEffect(() => {
    fetchSchedule();
    const interval = setInterval(fetchSchedule, 60000);
    return () => clearInterval(interval);
  }, [fetchSchedule]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().getUTCHours());
      setCurrentLocalHour(getCurrentLocalHour());
      setLocalTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000); // Update every second for live clock
    return () => clearInterval(timer);
  }, []);

  // Scroll to current slot on load
  useEffect(() => {
    if (!loading && gridRef.current) {
      const currentMinuteRounded = Math.floor(new Date().getMinutes() / 15) * 15;
      const currentSlot = document.getElementById(`slot-${currentHour}-${currentMinuteRounded}`);
      if (currentSlot) {
        currentSlot.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [loading, currentHour]);

  const openPreview = async (slot) => {
    try {
      const res = await axios.get(`${API}/schedule/slot/${slot.id}`);
      setPreviewSlot(res.data);
      setPreviewPlaying(false);
      setPreviewTimeLeft(60); // Reset to 60 seconds
      setPreviewEnded(false);
    } catch (error) {
      console.error("Error fetching slot details:", error);
      setPreviewSlot({ ...slot, content: slot.highlight });
    }
  };

  const closePreview = () => {
    setPreviewSlot(null);
    setPreviewPlaying(false);
    setPreviewEnded(false);
    setPreviewTimeLeft(60);
    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
    }
    if (previewTimerRef.current) {
      clearInterval(previewTimerRef.current);
    }
  };

  const togglePreviewPlay = () => {
    if (previewEnded) {
      toast.info("Preview limit reached (60 seconds). Watch full content when it airs!");
      return;
    }
    if (previewVideoRef.current) {
      if (previewPlaying) {
        previewVideoRef.current.pause();
        if (previewTimerRef.current) {
          clearInterval(previewTimerRef.current);
        }
      } else {
        previewVideoRef.current.play();
        // Start countdown timer
        previewTimerRef.current = setInterval(() => {
          setPreviewTimeLeft(prev => {
            if (prev <= 1) {
              // Stop playback at 0
              if (previewVideoRef.current) {
                previewVideoRef.current.pause();
              }
              setPreviewPlaying(false);
              setPreviewEnded(true);
              clearInterval(previewTimerRef.current);
              toast.info("Preview ended. Tune in when this content airs!");
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      setPreviewPlaying(!previewPlaying);
    }
  };

  // Subscribe to slot notification
  const subscribeToSlot = (slot) => {
    const slotKey = `${slot.slot_date}_${slot.slot_index}`;
    if (subscribedSlots.includes(slotKey)) {
      // Unsubscribe
      const newSubs = subscribedSlots.filter(s => s !== slotKey);
      setSubscribedSlots(newSubs);
      localStorage.setItem("ztv_subscribed_slots", JSON.stringify(newSubs));
      toast.success("Notification cancelled");
    } else {
      // Show subscribe modal to collect email
      setSubscribeModalSlot(slot);
      setSubscribeEmail("");
      setPushEnabled(false);
      setPushSupported('Notification' in window && 'serviceWorker' in navigator);
    }
  };

  const handleEmailSubscribe = async (e) => {
    e.preventDefault();
    if (!subscribeEmail || !subscribeModalSlot) return;

    setSubscribeLoading(true);
    try {
      // Subscribe via API
      await axios.post(`${API}/fan-notifications/subscribe`, {
        email: subscribeEmail,
        creator_id: subscribeModalSlot.creator_id || null, // null = all creators
        notify_live: true,
        notify_scheduled: true
      });
      
      // Also save locally
      const slotKey = `${subscribeModalSlot.slot_date || scheduleDate}_${subscribeModalSlot.slot_index}`;
      const newSubs = [...subscribedSlots, slotKey];
      setSubscribedSlots(newSubs);
      localStorage.setItem("ztv_subscribed_slots", JSON.stringify(newSubs));
      
      toast.success(`You'll be notified at ${subscribeEmail} when this content airs!`);
      setSubscribeModalSlot(null);
    } catch (error) {
      toast.error("Failed to subscribe. Please try again.");
    } finally {
      setSubscribeLoading(false);
    }
  };

  const handlePushSubscribe = async () => {
    if (!pushSupported) {
      toast.error("Browser notifications not supported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        setPushEnabled(true);
        toast.success("Browser notifications enabled!");
        
        // If OneSignal is available, register
        const playerId = window.OneSignal?.User?.onesignalId;
        if (playerId && subscribeModalSlot?.creator_id) {
          await axios.post(`${API}/push/follow-creator`, {
            creator_id: subscribeModalSlot.creator_id,
            player_id: playerId
          });
        }
      } else {
        toast.error("Please allow notifications to receive alerts");
      }
    } catch (error) {
      toast.error("Failed to enable notifications");
    }
  };

  const isSubscribed = (slot) => {
    const slotKey = `${slot.slot_date || scheduleDate}_${slot.slot_index}`;
    return subscribedSlots.includes(slotKey);
  };

  const openBookingModal = (slot) => {
    if (!user) {
      toast.error("Please login to book a slot");
      navigate("/login?redirect=/schedule");
      return;
    }
    setBookingSlot(slot);
    setBookingForm({
      title: "",
      description: "",
      content_type: "youtube",
      video_url: "",
      thumbnail: "",
      category: slot.scheduled_category || "music"
    });
  };

  const closeBookingModal = () => {
    setBookingSlot(null);
    setBookingForm({
      title: "",
      description: "",
      content_type: "youtube",
      video_url: "",
      thumbnail: "",
      category: "music"
    });
  };

  const handleBookSlot = async () => {
    if (!bookingForm.title || !bookingForm.video_url) {
      toast.error("Please fill in title and video URL");
      return;
    }
    
    setBookingLoading(true);
    try {
      const res = await axios.post(`${API}/schedule/book`, {
        slot_date: bookingSlot.slot_date,
        slot_hour: bookingSlot.slot_index,
        ...bookingForm
      }, {
        params: {
          creator_id: user.id || user.email,
          creator_name: user.name || user.email?.split("@")[0],
          creator_email: user.email
        }
      });
      
      toast.success(res.data.message);
      closeBookingModal();
      fetchSchedule(); // Refresh schedule
    } catch (error) {
      console.error("Booking error:", error);
      toast.error(error.response?.data?.detail || "Failed to book slot");
    } finally {
      setBookingLoading(false);
    }
  };

  const watchNow = (slot) => {
    navigate(`/watch?schedule=${slot.id}`);
  };

  const formatTimeUntil = (minutes) => {
    if (minutes <= 0) return "Now Playing";
    if (minutes < 60) return `Starts in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `Starts in ${hours}h ${mins}m`;
  };

  const formatSlotTime = (hour, minute = 0) => {
    const date = new Date();
    date.setHours(hour, minute, 0);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Auto-detect TRT when YouTube URL is entered in quick book modal
  useEffect(() => {
    if (!quickBookYouTubeUrl || !quickBookYouTubeUrl.trim()) {
      setQuickBookDetectedTRT(null);
      return;
    }
    
    // Only detect for YouTube URLs
    if (!quickBookYouTubeUrl.includes('youtube.com') && !quickBookYouTubeUrl.includes('youtu.be')) {
      return;
    }
    
    const detectTRT = async () => {
      setQuickBookDetectingTRT(true);
      try {
        const res = await axios.post(`${API}/creator-schedule/detect-trt`, {
          video_url: quickBookYouTubeUrl
        });
        
        if (res.data.success && res.data.trt_seconds) {
          setQuickBookDetectedTRT(res.data.trt_seconds);
          toast.success(`Video duration: ${res.data.trt_formatted}`);
        }
      } catch (err) {
        console.log('TRT detection failed:', err);
      } finally {
        setQuickBookDetectingTRT(false);
      }
    };
    
    const timer = setTimeout(detectTRT, 800);
    return () => clearTimeout(timer);
  }, [quickBookYouTubeUrl]);

  // Fetch library videos when modal opens
  const fetchLibraryVideos = async () => {
    setQuickBookLoadingLibrary(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/creator-schedule/my-uploads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setQuickBookLibraryVideos(res.data.uploads || []);
    } catch (err) {
      console.log('Failed to fetch library:', err);
      setQuickBookLibraryVideos([]);
    } finally {
      setQuickBookLoadingLibrary(false);
    }
  };

  // Select video from library
  const selectLibraryVideo = async (video) => {
    setQuickBookSelectedLibraryVideo(video);
    setQuickBookTitle(video.title || video.original_name || "My Video");
    setQuickBookYouTubeUrl(""); // Clear YouTube URL
    setQuickBookVideo(null); // Clear file upload
    setQuickBookShowLibrary(false);
    
    // Set TRT from library video if available
    if (video.duration_seconds && video.duration_seconds > 0) {
      setQuickBookDetectedTRT(video.duration_seconds);
      toast.success(`Video duration: ${Math.floor(video.duration_seconds / 60)}m ${video.duration_seconds % 60}s`);
    } else {
      // Try to detect TRT if not available
      setQuickBookDetectingTRT(true);
      try {
        const res = await axios.post(`${API}/creator-schedule/detect-trt`, {
          file_id: video.file_id
        });
        
        if (res.data.success && res.data.trt_seconds) {
          setQuickBookDetectedTRT(res.data.trt_seconds);
          // Update the video object in our list
          setQuickBookSelectedLibraryVideo(prev => ({...prev, duration_seconds: res.data.trt_seconds}));
          toast.success(`Video duration detected: ${res.data.trt_formatted}`);
        } else {
          toast.warning("Could not detect video duration. Please set it manually.");
        }
      } catch (err) {
        console.log('TRT detection failed for library video:', err);
        toast.warning("Could not detect video duration.");
      } finally {
        setQuickBookDetectingTRT(false);
      }
    }
  };

  const handleQuickBookSubmit = async (e) => {
    e.preventDefault();
    if (!quickBookModal) return;
    
    // Validate - either YouTube URL, uploaded video, or library video
    if (!quickBookYouTubeUrl && !quickBookVideo && !quickBookSelectedLibraryVideo) {
      toast.error("Please enter a YouTube URL, upload a video, or select from library");
      return;
    }
    
    setQuickBookLoading(true);
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please login to schedule content");
        navigate("/login?redirect=/schedule");
        return;
      }
      
      // Prepare booking data
      const formData = new FormData();
      formData.append("slot_date", quickBookModal.date);
      formData.append("slot_start_hour", Math.floor(quickBookModal.hour));
      formData.append("slot_start_minute", quickBookModal.minute || 0);
      formData.append("title", quickBookTitle || "My Scheduled Content");
      
      // Determine content type
      if (quickBookSelectedLibraryVideo) {
        formData.append("content_type", "library");
        formData.append("video_url", `${API}/creator-schedule/video/${quickBookSelectedLibraryVideo.file_id}`);
        formData.append("file_id", quickBookSelectedLibraryVideo.file_id);
      } else if (quickBookVideo) {
        formData.append("content_type", "upload");
      } else {
        formData.append("content_type", "youtube");
      }
      
      // Include detected TRT if available
      if (quickBookDetectedTRT) {
        const durationMinutes = Math.ceil(quickBookDetectedTRT / 60);
        formData.append("duration_minutes", durationMinutes);
        formData.append("trt_seconds", quickBookDetectedTRT);
      }
      
      if (quickBookYouTubeUrl) {
        formData.append("video_url", quickBookYouTubeUrl);
      }
      if (quickBookVideo) {
        formData.append("video_file", quickBookVideo);
      }
      
      const res = await axios.post(`${API}/creator-schedule/book-slot`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (res.data.booking_id) {
        toast.success(`Scheduled for ${quickBookModal.displayTime}!`);
        setQuickBookModal(null);
        setQuickBookDetectedTRT(null);
        setQuickBookSelectedLibraryVideo(null);
        fetchSchedule(); // Refresh the schedule
      }
    } catch (error) {
      const msg = error.response?.data?.detail || "Failed to schedule content";
      toast.error(msg);
    } finally {
      setQuickBookLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <SEO 
        title="Schedule - Programming Guide"
        description="View the ZTVLIVE 24/7 streaming schedule. See what's playing now and coming up next. Music, sports, podcasts, gaming and more - all free to watch!"
        path="/schedule"
      />
      <Navigation />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          {/* Hero Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-900/50 via-zinc-900 to-zinc-900 border border-violet-500/20 p-6 md:p-8">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-red-600/10 rounded-full blur-3xl" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-red-600 rounded-lg">
                      <Tv className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl tracking-tight uppercase" data-testid="page-title">
                      TV GUIDE
                    </h1>
                    <Badge className="bg-red-600 text-white animate-pulse">LIVE</Badge>
                  </div>
                  <p className="text-zinc-400 text-lg max-w-xl">
                    24/7 programming schedule. Watch live or see what's coming up next.
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex flex-col items-end gap-1">
                    <span className="text-xs text-zinc-500">TODAY'S DATE</span>
                    <span className="text-lg font-heading text-white">
                      {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-1">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className={viewMode === 'grid' ? 'bg-violet-600' : ''}
                    >
                      <MonitorPlay className="w-4 h-4 mr-1" />
                      Grid
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className={viewMode === 'list' ? 'bg-violet-600' : ''}
                    >
                      <Calendar className="w-4 h-4 mr-1" />
                      List
                    </Button>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="relative z-10 mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Radio className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-zinc-400">LIVE NOW</span>
                  </div>
                  <p className="font-heading text-lg text-white truncate">
                    {getProgramBlock(currentHour).name}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-zinc-400">CREATOR SHOWS</span>
                  </div>
                  <p className="font-heading text-lg text-green-400">{creatorSlots}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    <span className="text-xs text-zinc-400">AVAILABLE SLOTS</span>
                  </div>
                  <p className="font-heading text-lg text-violet-400">{availableSlots}</p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-zinc-400 truncate" title={timezone}>YOUR TIME</span>
                  </div>
                  <p className="font-mono text-lg text-amber-400">
                    {localTime}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* TV Guide Grid */}
          {loading ? (
            <div className="space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex gap-4 p-4 bg-[#18181b] rounded-lg animate-pulse">
                  <div className="w-20 h-20 bg-zinc-800 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-zinc-800 rounded w-3/4" />
                    <div className="h-4 bg-zinc-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'grid' ? (
            /* Professional TV Guide Grid View */
            <motion.div 
              ref={gridRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
              data-testid="tv-guide-grid"
            >
              {/* Sort slots by local time, starting from current time */}
              {schedule
                .map(slot => ({
                  ...slot,
                  localHour: utcToLocal(Math.floor(slot.slot_index)),
                  localTimeDisplay: formatLocalTime(slot.slot_index)
                }))
                .sort((a, b) => {
                  // Sort by slot_index (which includes minutes as decimal)
                  const currentSlotIndex = currentHour + (new Date().getMinutes() / 60);
                  const aOffset = (a.slot_index - currentSlotIndex + 24) % 24;
                  const bOffset = (b.slot_index - currentSlotIndex + 24) % 24;
                  return aOffset - bOffset;
                })
                .map((slot, index) => {
                const slotHour = slot.slot_hour ?? Math.floor(slot.slot_index);
                const slotMinute = slot.slot_minute ?? Math.round((slot.slot_index - slotHour) * 60);
                const localHour = slot.localHour;
                const programBlock = getProgramBlock(slotHour);
                const guideItem = tvGuide.find(g => Math.floor(g.hour) === slotHour);
                const isNow = slot.is_current;
                const isPast = slot.is_past || false;
                const isCreatorSlot = slot.is_creator_slot || guideItem?.content?.type === 'creator';
                const isAvailable = slot.is_bookable && !isCreatorSlot;
                
                // Handle click on available slot - One-Click Claim
                const handleSlotClick = () => {
                  if (isAvailable) {
                    // Open quick booking modal with precise hour and minute
                    setQuickBookModal({
                      date: scheduleDate || new Date().toISOString().split('T')[0],
                      hour: slotHour,
                      minute: slotMinute,
                      displayTime: slot.localTimeDisplay
                    });
                    setQuickBookVideo(null);
                    setQuickBookYouTubeUrl("");
                    setQuickBookTitle("");
                  }
                };
                
                return (
                  <motion.div
                    key={`${slotHour}-${slotMinute}`}
                    id={`slot-${slotHour}-${slotMinute}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.01 }}
                    onClick={handleSlotClick}
                    className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                      isNow 
                        ? 'ring-2 ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' 
                        : isPast
                          ? 'opacity-50'
                          : isAvailable
                            ? 'cursor-pointer hover:ring-2 hover:ring-green-500 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                            : 'hover:ring-1 hover:ring-violet-500/50'
                    }`}
                    data-testid={`tv-guide-slot-${slotHour}-${slotMinute}`}
                  >
                    {/* Available Slot Indicator */}
                    {isAvailable && (
                      <div className="absolute top-2 right-2 z-10">
                        <Badge className="bg-green-600 text-white text-xs animate-pulse">
                          <Upload className="w-3 h-3 mr-1" />
                          CLAIM THIS SLOT
                        </Badge>
                      </div>
                    )}
                    
                    <div className={`flex ${isCreatorSlot ? 'bg-gradient-to-r from-green-900/40 via-zinc-900 to-zinc-900' : isAvailable ? 'bg-gradient-to-r from-green-900/20 via-zinc-900 to-zinc-900' : `bg-gradient-to-r ${programBlock.gradient} bg-opacity-20`}`}>
                      {/* Time Column - Shows LOCAL time */}
                      <div className={`w-28 md:w-32 flex-shrink-0 p-4 flex flex-col items-center justify-center border-r border-white/10 bg-gradient-to-br ${programBlock.gradient}`}>
                        <span className="text-3xl mb-1">{programBlock.icon}</span>
                        <span className="font-mono text-lg md:text-xl font-bold text-white">
                          {slot.localTimeDisplay}
                        </span>
                        {isNow && (
                          <Badge className="mt-2 bg-red-600 text-white text-[10px] animate-pulse">
                            NOW
                          </Badge>
                        )}
                      </div>
                      
                      {/* Content Column */}
                      <div className="flex-1 p-4 bg-zinc-900/80">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Program Name */}
                            <div className="flex items-center gap-2 mb-2">
                              {isCreatorSlot ? (
                                <>
                                  <Badge className="bg-green-600 text-white text-xs">
                                    <User className="w-3 h-3 mr-1" />
                                    CREATOR
                                  </Badge>
                                  <span className="text-green-400 text-sm font-medium">
                                    {guideItem?.content?.creator_name}
                                  </span>
                                </>
                              ) : (
                                <h3 className="font-heading text-lg md:text-xl tracking-wide text-white">
                                  {programBlock.name}
                                </h3>
                              )}
                            </div>
                            
                            {/* Content Title */}
                            <h4 className="font-medium text-white text-base md:text-lg line-clamp-1 mb-1">
                              {isCreatorSlot 
                                ? guideItem?.content?.title 
                                : slot?.highlight?.title || guideItem?.content?.program_name || programBlock.desc}
                            </h4>
                            
                            {/* Description */}
                            <p className="text-zinc-400 text-sm line-clamp-1">
                              {isCreatorSlot 
                                ? guideItem?.content?.description || 'Creator scheduled content'
                                : slot?.highlight?.description || guideItem?.content?.description || programBlock.desc}
                            </p>
                            
                            {/* Categories */}
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                              {isCreatorSlot ? (
                                <>
                                  <Badge 
                                    variant="outline" 
                                    className="border-green-500/50 text-green-400 text-xs"
                                  >
                                    <Star className="w-3 h-3 mr-1" />
                                    Featured Creator
                                  </Badge>
                                  {guideItem?.content?.duration_minutes && (
                                    <Badge variant="outline" className="border-zinc-600 text-zinc-400 text-xs">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {guideItem.content.duration_minutes} min
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                guideItem?.content?.categories?.map(cat => (
                                  <Badge 
                                    key={cat}
                                    style={{ backgroundColor: CATEGORY_COLORS[cat] || '#8b5cf6' }}
                                    className="text-white text-xs"
                                  >
                                    {cat}
                                  </Badge>
                                )) || (
                                  <Badge 
                                    style={{ backgroundColor: CATEGORY_COLORS[slot?.scheduled_category] || '#8b5cf6' }}
                                    className="text-white text-xs"
                                  >
                                    {slot?.scheduled_category || 'mixed'}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                          
                          {/* Thumbnail + Actions */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-2">
                            {(slot?.highlight?.thumbnail || guideItem?.content?.thumbnail) && (
                              <div className="relative w-32 h-20 md:w-40 md:h-24 rounded-lg overflow-hidden">
                                <img 
                                  src={slot?.highlight?.thumbnail || guideItem?.content?.thumbnail}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                                {isNow && (
                                  <div className="absolute inset-0 bg-red-600/20 flex items-center justify-center">
                                    <div className="w-12 h-12 rounded-full bg-red-600/80 flex items-center justify-center">
                                      <Play className="w-6 h-6 text-white" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Action Button */}
                            {isNow ? (
                              <Link to="/watch">
                                <Button size="sm" className="bg-red-600 hover:bg-red-500 w-full" data-testid={`watch-live-${slotHour}-${slotMinute}`}>
                                  <Play className="w-4 h-4 mr-1" />
                                  Watch Live
                                </Button>
                              </Link>
                            ) : isAvailable ? (
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-500 w-full"
                                onClick={(e) => { e.stopPropagation(); handleSlotClick(); }}
                                data-testid={`claim-slot-${slotHour}-${slotMinute}`}
                              >
                                <Upload className="w-4 h-4 mr-1" />
                                Claim Slot
                              </Button>
                            ) : !isPast && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="border-zinc-600 hover:border-violet-500 w-full"
                                onClick={(e) => { e.stopPropagation(); slot && openPreview(slot); }}
                                data-testid={`preview-${slotHour}-${slotMinute}`}
                              >
                                <Bell className="w-4 h-4 mr-1" />
                                Remind Me
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            /* Original List View */
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative"
            >
              <div className="absolute left-[4.5rem] top-0 bottom-0 w-px bg-zinc-800 hidden md:block" />

              <div className="space-y-4">
                {schedule.map((slot, i) => (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className={`relative flex gap-4 p-4 bg-[#18181b] border border-zinc-800 rounded-sm transition-colors ${
                      slot.is_current ? 'border-violet-500 shadow-[0_0_20px_rgba(139,92,246,0.2)]' : ''
                    } ${slot.is_creator_slot ? 'bg-gradient-to-r from-green-900/20 to-transparent border-green-500/30' : ''}
                    ${slot.highlight?.is_promo ? 'bg-gradient-to-r from-violet-900/20 to-transparent' : ''}`}
                    data-testid={`schedule-slot-${slot.id}`}
                  >
                    {/* Time */}
                    <div className="w-20 flex-shrink-0 text-center">
                      <div className="font-mono text-lg text-zinc-300">{slot.start_time}</div>
                      <div className="text-xs text-zinc-600">to {slot.end_time}</div>
                      {slot.is_current && (
                        <Badge className="mt-2 bg-red-600 text-white text-xs live-indicator">
                          NOW
                        </Badge>
                      )}
                      {!slot.is_current && slot.minutes_until <= 60 && (
                        <div className="mt-1 text-xs text-violet-400">
                          {formatTimeUntil(slot.minutes_until)}
                        </div>
                      )}
                    </div>

                    {/* Timeline dot */}
                    <div className={`hidden md:flex absolute left-[4.25rem] top-6 w-2 h-2 rounded-full z-10 ${
                      slot.is_current ? 'bg-red-500 animate-pulse' : 
                      slot.is_creator_slot ? 'bg-green-500' : 'bg-violet-500'
                    }`} />

                    {/* Content */}
                    <div className="flex-1 flex gap-4 cursor-pointer" onClick={() => openPreview(slot)}>
                      <div className="w-32 h-20 flex-shrink-0 rounded overflow-hidden relative group">
                        <img 
                          src={slot.highlight.thumbnail} 
                          alt={slot.highlight.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                        {slot.highlight?.is_promo && (
                          <Badge className="absolute top-1 left-1 bg-violet-600 text-[10px]">PROMO</Badge>
                        )}
                        {slot.is_creator_slot && (
                          <Badge className="absolute top-1 left-1 bg-green-600 text-[10px]">CREATOR</Badge>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            className="text-white text-xs"
                            style={{ backgroundColor: CATEGORY_COLORS[slot.scheduled_category] || '#8b5cf6' }}
                          >
                            {slot.scheduled_category?.toUpperCase()}
                          </Badge>
                          {slot.is_creator_slot && slot.creator_info && (
                            <Badge className="bg-green-600/20 text-green-400 text-xs border border-green-500/30">
                              <User className="w-3 h-3 mr-1" />
                              {slot.creator_info.creator_name}
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-heading text-lg tracking-tight line-clamp-1">
                          {slot.highlight.title}
                        </h3>
                        <p className="text-zinc-400 text-sm line-clamp-1 mt-1">
                          {slot.highlight.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {slot.highlight.duration}
                          </span>
                          <span>{slot.highlight.source}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {/* Notify Me Button - for future slots */}
                      {!slot.is_current && !slot.highlight?.is_promo && (
                        <Button 
                          variant="ghost"
                          size="icon"
                          className={`flex-shrink-0 ${isSubscribed(slot) ? 'text-yellow-400' : 'text-zinc-500 hover:text-yellow-400'}`}
                          onClick={() => subscribeToSlot(slot)}
                          title={isSubscribed(slot) ? "Cancel notification" : "Notify me when this airs"}
                        >
                          {isSubscribed(slot) ? <Bell className="w-5 h-5 fill-current" /> : <Bell className="w-5 h-5" />}
                        </Button>
                      )}
                      
                      {slot.is_current ? (
                        <Link to="/watch">
                          <Button className="bg-red-600 hover:bg-red-500 flex-shrink-0" data-testid={`watch-now-${slot.id}`}>
                            <Play className="w-4 h-4 mr-1" />
                            Watch Live
                          </Button>
                        </Link>
                      ) : slot.is_bookable ? (
                        <Button 
                          className="bg-green-600 hover:bg-green-500 flex-shrink-0" 
                          data-testid={`book-slot-${slot.id}`}
                          onClick={() => openBookingModal(slot)}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Book Slot
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          className="border-zinc-700 hover:border-violet-500 flex-shrink-0" 
                          data-testid={`preview-${slot.id}`}
                          onClick={() => openPreview(slot)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Want to Schedule Banner */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-12 p-6 bg-gradient-to-br from-violet-900/30 via-zinc-900 to-zinc-900 border border-violet-500/30 rounded-2xl"
          >
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-heading text-2xl tracking-wider mb-2">BECOME A ZTVLIVE CREATOR</h3>
                <p className="text-zinc-400 leading-relaxed max-w-2xl">
                  Get your content featured on our 24/7 live TV network! Schedule your videos, live streams, or social media content 
                  and reach our entire audience. Book up to 2 slots per day.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <Badge className="bg-green-600/20 text-green-400 border border-green-500/30">
                    <Check className="w-3 h-3 mr-1" />
                    Free to schedule
                  </Badge>
                  <Badge className="bg-violet-600/20 text-violet-400 border border-violet-500/30">
                    <Star className="w-3 h-3 mr-1" />
                    Verified creators auto-approved
                  </Badge>
                  <Badge className="bg-amber-600/20 text-amber-400 border border-amber-500/30">
                    <Users className="w-3 h-3 mr-1" />
                    Reach thousands of viewers
                  </Badge>
                </div>
              </div>
              <div className="flex-shrink-0">
                <Link to="/schedule-slot">
                  <Button size="lg" className="bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-500/20">
                    <Calendar className="w-5 h-5 mr-2" />
                    Schedule Your Slot
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={closePreview}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#18181b] border border-zinc-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Preview Header */}
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge 
                    style={{ backgroundColor: CATEGORY_COLORS[previewSlot.scheduled_category] || '#8b5cf6' }}
                    className="text-white"
                  >
                    {previewSlot.scheduled_category?.toUpperCase()}
                  </Badge>
                  <span className="text-zinc-400 text-sm">
                    {previewSlot.start_time} - {previewSlot.end_time} UTC
                  </span>
                  {previewSlot.is_current && (
                    <Badge className="bg-red-600 text-white animate-pulse">NOW PLAYING</Badge>
                  )}
                  {previewSlot.is_creator_slot && (
                    <Badge className="bg-green-600 text-white">CREATOR CONTENT</Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={closePreview}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Video Preview */}
              <div className="aspect-video bg-black relative">
                {/* Preview ended overlay */}
                {previewEnded && (
                  <div className="absolute inset-0 z-20 bg-black/90 flex flex-col items-center justify-center">
                    <div className="text-center">
                      <Clock className="w-12 h-12 text-violet-400 mx-auto mb-4" />
                      <h3 className="font-heading text-2xl mb-2">PREVIEW ENDED</h3>
                      <p className="text-zinc-400 mb-4">Tune in at {previewSlot.start_time} UTC to watch the full content!</p>
                      <div className="flex items-center justify-center gap-3">
                        <Button 
                          onClick={() => subscribeToSlot(previewSlot)}
                          className={isSubscribed(previewSlot) ? "bg-zinc-700" : "bg-violet-600 hover:bg-violet-500"}
                        >
                          {isSubscribed(previewSlot) ? (
                            <><BellOff className="w-4 h-4 mr-2" />Cancel Reminder</>
                          ) : (
                            <><Bell className="w-4 h-4 mr-2" />Remind Me</>
                          )}
                        </Button>
                        <Button variant="outline" onClick={closePreview}>
                          Close Preview
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Preview time indicator */}
                {!previewEnded && previewPlaying && (
                  <div className="absolute top-4 right-4 z-10 bg-black/70 px-3 py-1.5 rounded flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    <span className="font-mono text-sm">
                      {Math.floor(previewTimeLeft / 60)}:{(previewTimeLeft % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="text-xs text-zinc-400">preview</span>
                  </div>
                )}
                
                {previewSlot.content?.video_url?.includes('youtube.com') || previewSlot.content?.video_url?.includes('youtu.be') ? (
                  <div className="w-full h-full relative">
                    <iframe
                      src={`${previewSlot.content.video_url.replace('watch?v=', 'embed/')}?autoplay=0&rel=0&modestbranding=1&start=0&end=60`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={previewSlot.content.title}
                    />
                    <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1.5 rounded text-xs text-zinc-400">
                      Preview limited to 60 seconds
                    </div>
                  </div>
                ) : previewSlot.content?.video_url?.endsWith('.mp4') || previewSlot.content?.video_url?.startsWith('/') ? (
                  <>
                    <video
                      ref={previewVideoRef}
                      src={previewSlot.content.video_url}
                      className="w-full h-full object-contain"
                      muted={previewMuted}
                      playsInline
                      poster={previewSlot.content.thumbnail}
                    />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="bg-black/50 hover:bg-black/70"
                          onClick={togglePreviewPlay}
                          disabled={previewEnded}
                        >
                          {previewPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="bg-black/50 hover:bg-black/70"
                          onClick={() => setPreviewMuted(!previewMuted)}
                        >
                          {previewMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <img 
                      src={previewSlot.content?.thumbnail} 
                      alt={previewSlot.content?.title}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Content Details */}
              <div className="p-6">
                <h2 className="font-heading text-2xl tracking-tight mb-2">
                  {previewSlot.content?.title}
                </h2>
                <p className="text-zinc-400 mb-4">
                  {previewSlot.content?.description}
                </p>
                
                {previewSlot.content?.ai_commentary && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded bg-violet-600 flex items-center justify-center">
                        <span className="text-xs font-bold">AI</span>
                      </div>
                      <span className="text-sm text-zinc-400">ZTV Commentary</span>
                    </div>
                    <p className="text-zinc-300 italic">"{previewSlot.content.ai_commentary}"</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {previewSlot.content?.duration}
                    </span>
                    <span>{previewSlot.content?.source}</span>
                    {!previewSlot.is_current && previewSlot.minutes_until > 0 && (
                      <Badge className="bg-zinc-800 text-zinc-300">
                        {formatTimeUntil(previewSlot.minutes_until)}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {previewSlot.is_current ? (
                      <Link to="/watch">
                        <Button className="bg-red-600 hover:bg-red-500">
                          <Play className="w-4 h-4 mr-2" />
                          Watch Live
                        </Button>
                      </Link>
                    ) : previewSlot.is_bookable ? (
                      <Button 
                        className="bg-green-600 hover:bg-green-500"
                        onClick={() => {
                          closePreview();
                          openBookingModal(previewSlot);
                        }}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Book This Slot
                      </Button>
                    ) : (
                      <Button 
                        className="bg-violet-600 hover:bg-violet-500"
                        onClick={() => watchNow(previewSlot)}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Watch on Main Player
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Modal */}
      <AnimatePresence>
        {bookingSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={closeBookingModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#18181b] border border-zinc-700 rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Booking Header */}
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-xl tracking-wider">BOOK TIME SLOT</h3>
                  <p className="text-sm text-zinc-400">
                    {bookingSlot.slot_date} • {bookingSlot.start_time} - {bookingSlot.end_time} UTC
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={closeBookingModal}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Booking Form */}
              <div className="p-6 space-y-6">
                {/* Content Type Selection */}
                <div>
                  <Label className="text-zinc-400 mb-3 block">Content Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {CONTENT_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setBookingForm(f => ({ ...f, content_type: type.id }))}
                        className={`p-3 rounded border text-center transition-colors ${
                          bookingForm.content_type === type.id
                            ? 'border-violet-500 bg-violet-500/20'
                            : 'border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <type.icon className="w-5 h-5 mx-auto mb-1" />
                        <span className="text-xs">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <Label htmlFor="title" className="text-zinc-400">Title *</Label>
                  <Input
                    id="title"
                    value={bookingForm.title}
                    onChange={(e) => setBookingForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Enter content title"
                    className="mt-2 bg-zinc-900 border-zinc-700"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description" className="text-zinc-400">Description</Label>
                  <Textarea
                    id="description"
                    value={bookingForm.description}
                    onChange={(e) => setBookingForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe your content"
                    className="mt-2 bg-zinc-900 border-zinc-700 min-h-[80px]"
                  />
                </div>

                {/* Video URL */}
                <div>
                  <Label htmlFor="video_url" className="text-zinc-400">
                    {bookingForm.content_type === "youtube" ? "YouTube URL *" :
                     bookingForm.content_type === "live_embed" ? "Live Stream Embed URL *" :
                     "Video URL *"}
                  </Label>
                  <Input
                    id="video_url"
                    value={bookingForm.video_url}
                    onChange={(e) => setBookingForm(f => ({ ...f, video_url: e.target.value }))}
                    placeholder={
                      bookingForm.content_type === "youtube" ? "https://youtube.com/watch?v=..." :
                      bookingForm.content_type === "live_embed" ? "https://twitch.tv/... or social media live URL" :
                      "https://your-video-host.com/video.mp4"
                    }
                    className="mt-2 bg-zinc-900 border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    {bookingForm.content_type === "youtube" && "Paste your YouTube video link"}
                    {bookingForm.content_type === "live_embed" && "Your live stream will be embedded on ZTVLIVE"}
                    {bookingForm.content_type === "video" && "Direct link to MP4 or video file"}
                  </p>
                </div>

                {/* Category */}
                <div>
                  <Label className="text-zinc-400 mb-2 block">Category</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setBookingForm(f => ({ ...f, category: cat }))}
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${
                          bookingForm.category === cat
                            ? 'text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                        style={bookingForm.category === cat ? { backgroundColor: CATEGORY_COLORS[cat] } : {}}
                      >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Thumbnail (Optional) */}
                <div>
                  <Label htmlFor="thumbnail" className="text-zinc-400">Thumbnail URL (Optional)</Label>
                  <Input
                    id="thumbnail"
                    value={bookingForm.thumbnail}
                    onChange={(e) => setBookingForm(f => ({ ...f, thumbnail: e.target.value }))}
                    placeholder="https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg"
                    className="mt-2 bg-zinc-900 border-zinc-700"
                  />
                </div>

                {/* Info */}
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-zinc-400">
                      <p className="mb-1">Your content will be <strong className="text-white">auto-approved</strong> and will replace the default programming for this slot.</p>
                      <p>You can book up to <strong className="text-white">2 slots per day</strong>.</p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <Button 
                  className="w-full bg-green-600 hover:bg-green-500"
                  onClick={handleBookSlot}
                  disabled={bookingLoading}
                >
                  {bookingLoading ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Confirm Booking
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Browser Modal */}
      <AnimatePresence>
        {categoryBrowser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={closeCategoryBrowser}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#18181b] border border-zinc-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge 
                    style={{ backgroundColor: CATEGORY_COLORS[categoryBrowser] }}
                    className="text-white text-lg px-4 py-1"
                  >
                    {CATEGORY_LABELS[categoryBrowser] || categoryBrowser.toUpperCase()}
                  </Badge>
                  <span className="text-zinc-400">
                    {categoryContent.length} videos
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={closeCategoryBrowser}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content Grid */}
              <div className="p-6 overflow-y-auto max-h-[70vh]">
                {categoryLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="bg-zinc-800 rounded-lg aspect-video animate-pulse" />
                    ))}
                  </div>
                ) : categoryContent.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-zinc-400">No content available in this category yet.</p>
                    <p className="text-zinc-500 text-sm mt-2">Check back later or schedule your own content!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryContent.map((item) => (
                      <Link
                        key={item.id}
                        to={`/watch?video=${item.id}`}
                        className="group"
                        onClick={closeCategoryBrowser}
                      >
                        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-violet-500/50 transition-colors">
                          <div className="relative aspect-video">
                            <img 
                              src={item.thumbnail} 
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="w-12 h-12 text-white" />
                            </div>
                            {item.duration && (
                              <span className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs">
                                {item.duration}
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <h4 className="font-heading text-sm line-clamp-2">{item.title}</h4>
                            <p className="text-zinc-500 text-xs mt-1">{item.source}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Booking Modal */}
      <AnimatePresence>
        {quickBookModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setQuickBookModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              data-testid="quick-book-modal"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-green-500" />
                  <h3 className="font-semibold text-lg text-white">Schedule Content</h3>
                </div>
                <button 
                  onClick={() => setQuickBookModal(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="bg-green-600/20 border border-green-600/30 rounded-lg p-3 mb-4">
                <p className="text-green-400 font-semibold">
                  Slot: {quickBookModal.date} at {quickBookModal.displayTime}
                </p>
              </div>
              
              <form onSubmit={handleQuickBookSubmit} className="space-y-4">
                <div>
                  <Label className="text-zinc-400 text-sm mb-1 block">Content Title</Label>
                  <Input
                    type="text"
                    placeholder="My awesome video"
                    value={quickBookTitle}
                    onChange={(e) => setQuickBookTitle(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    data-testid="quick-book-title"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label className="text-zinc-400 text-sm">Choose your content:</Label>
                  
                  {/* Selected Library Video Display */}
                  {quickBookSelectedLibraryVideo && (
                    <div className="bg-green-900/30 border border-green-600 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-10 bg-zinc-700 rounded flex items-center justify-center">
                            <Video className="w-6 h-6 text-green-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm">{quickBookSelectedLibraryVideo.title || quickBookSelectedLibraryVideo.original_name}</p>
                            {quickBookDetectingTRT ? (
                              <p className="text-yellow-400 text-xs flex items-center gap-1">
                                <span className="w-3 h-3 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                                Detecting duration...
                              </p>
                            ) : quickBookDetectedTRT ? (
                              <p className="text-green-400 text-xs flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Duration: {Math.floor(quickBookDetectedTRT / 60)}m {quickBookDetectedTRT % 60}s
                              </p>
                            ) : (
                              <p className="text-yellow-400 text-xs">Duration unknown - will be detected on schedule</p>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setQuickBookSelectedLibraryVideo(null);
                            setQuickBookDetectedTRT(null);
                          }}
                          className="text-zinc-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Content Options - Only show if no library video selected */}
                  {!quickBookSelectedLibraryVideo && (
                    <>
                      {/* Pick from Library Option */}
                      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                        <Label className="text-zinc-300 text-sm mb-2 flex items-center gap-2">
                          <MonitorPlay className="w-4 h-4 text-green-500" />
                          Pick from My Library
                        </Label>
                        
                        {quickBookShowLibrary ? (
                          <div className="space-y-2">
                            {quickBookLoadingLibrary ? (
                              <div className="flex items-center justify-center py-4">
                                <span className="w-5 h-5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                                <span className="ml-2 text-zinc-400 text-sm">Loading your videos...</span>
                              </div>
                            ) : quickBookLibraryVideos.length > 0 ? (
                              <div className="max-h-48 overflow-y-auto space-y-2">
                                {quickBookLibraryVideos.map((video) => (
                                  <div
                                    key={video.file_id}
                                    onClick={() => selectLibraryVideo(video)}
                                    className="flex items-center gap-3 p-2 bg-zinc-900 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors"
                                  >
                                    <div className="w-12 h-8 bg-zinc-700 rounded flex items-center justify-center flex-shrink-0">
                                      <Video className="w-4 h-4 text-zinc-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white text-sm truncate">{video.title || video.original_name}</p>
                                      {video.duration_seconds ? (
                                        <p className="text-green-400 text-xs">
                                          {Math.floor(video.duration_seconds / 60)}m {video.duration_seconds % 60}s
                                        </p>
                                      ) : (
                                        <p className="text-yellow-400 text-xs">Duration unknown</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-zinc-400 text-sm py-2">No videos in your library yet</p>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setQuickBookShowLibrary(false)}
                              className="text-zinc-400 hover:text-white text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => {
                              setQuickBookShowLibrary(true);
                              fetchLibraryVideos();
                            }}
                            className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/50"
                          >
                            Browse My Library
                          </Button>
                        )}
                      </div>
                      
                      <div className="text-center text-zinc-500 text-sm">OR</div>
                  
                      {/* YouTube URL Option */}
                      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                        <Label className="text-zinc-300 text-sm mb-2 flex items-center gap-2">
                          <Video className="w-4 h-4 text-red-500" />
                          YouTube URL
                        </Label>
                        <Input
                          type="url"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={quickBookYouTubeUrl}
                          onChange={(e) => {
                            setQuickBookYouTubeUrl(e.target.value);
                            setQuickBookDetectedTRT(null);
                            if (e.target.value) setQuickBookVideo(null);
                          }}
                          className="bg-zinc-900 border-zinc-600 text-white"
                          data-testid="quick-book-youtube-url"
                        />
                        {/* TRT Detection Status */}
                        {quickBookDetectingTRT && (
                          <p className="text-yellow-400 text-xs mt-2 flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                            Detecting video duration...
                          </p>
                        )}
                        {quickBookDetectedTRT && !quickBookDetectingTRT && !quickBookSelectedLibraryVideo && (
                          <p className="text-green-400 text-xs mt-2 flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            Duration: {Math.floor(quickBookDetectedTRT / 60)}m {quickBookDetectedTRT % 60}s (auto-detected)
                          </p>
                        )}
                      </div>
                      
                      <div className="text-center text-zinc-500 text-sm">OR</div>
                      
                      {/* File Upload Option */}
                      <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                        <Label className="text-zinc-300 text-sm mb-2 flex items-center gap-2">
                          <Upload className="w-4 h-4 text-blue-500" />
                          Upload New Video
                        </Label>
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setQuickBookVideo(file);
                              setQuickBookYouTubeUrl("");
                            }
                          }}
                          className="w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500"
                          data-testid="quick-book-file"
                        />
                        {quickBookVideo && (
                          <p className="text-green-400 text-xs mt-2">
                            Selected: {quickBookVideo.name}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  disabled={quickBookLoading || (!quickBookYouTubeUrl && !quickBookVideo && !quickBookSelectedLibraryVideo)}
                  className="w-full bg-green-600 hover:bg-green-500"
                  data-testid="quick-book-submit"
                >
                  {quickBookLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Scheduling...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Schedule Content
                    </span>
                  )}
                </Button>
              </form>
              
              <p className="text-xs text-zinc-500 mt-4 text-center">
                Want more options? <Link to={`/schedule-slot?date=${quickBookModal.date}&hour=${quickBookModal.hour}`} className="text-violet-400 hover:underline">Use advanced scheduling</Link>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subscribe Modal */}
      <AnimatePresence>
        {subscribeModalSlot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSubscribeModalSlot(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              data-testid="subscribe-modal"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-semibold text-lg text-white">Get Notified!</h3>
                </div>
                <button 
                  onClick={() => setSubscribeModalSlot(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-zinc-400 mb-4">
                We'll send you a notification when <span className="text-white font-medium">"{subscribeModalSlot?.content?.title || subscribeModalSlot?.title || 'this content'}"</span> goes live at {subscribeModalSlot?.start_time} UTC.
              </p>
              
              <form onSubmit={handleEmailSubscribe} className="space-y-4">
                <div>
                  <Label className="text-zinc-400 text-sm mb-1 block">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={subscribeEmail}
                    onChange={(e) => setSubscribeEmail(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    required
                    data-testid="subscribe-email-input"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={subscribeLoading}
                  className="w-full bg-violet-600 hover:bg-violet-500"
                  data-testid="subscribe-email-btn"
                >
                  {subscribeLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Subscribing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      Notify Me via Email
                    </span>
                  )}
                </Button>
              </form>
              
              {pushSupported && (
                <div className="mt-4 pt-4 border-t border-zinc-700">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handlePushSubscribe}
                    disabled={pushEnabled}
                    className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                    data-testid="subscribe-push-btn"
                  >
                    {pushEnabled ? (
                      <span className="flex items-center gap-2 text-green-400">
                        <Check className="w-4 h-4" />
                        Browser Notifications Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        Also Enable Browser Notifications
                      </span>
                    )}
                  </Button>
                  <p className="text-xs text-zinc-500 mt-2 text-center">
                    Get instant alerts even when this tab is closed
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-800">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-violet-400" />
              <span className="font-heading text-xl tracking-wider">ZTVLIVE</span>
            </div>
            <p className="text-zinc-500 text-sm">
              24/7 Trending Highlights - Entertainment That Never Sleeps
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
