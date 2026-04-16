import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Calendar, Clock, Video, Upload, CheckCircle, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, Play, User, Tv, Radio, Film, Bell, BellRing, Link2,
  CalendarDays, CalendarRange, Type, Grid3X3, Timer, Shield, HeartPulse, ToggleLeft, ToggleRight,
  PartyPopper, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Navigation from "@/components/Navigation";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";

const API = '/api';

// Calendar view types
const CALENDAR_VIEWS = {
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year'
};

// Input modes
const INPUT_MODES = {
  CALENDAR: 'calendar',
  TEXT: 'text'
};

// Time slot component with notification button
function TimeSlot({ slot, onSelect, isSelected }) {
  const [notifyLoading, setNotifyLoading] = React.useState(false);
  const [isSubscribed, setIsSubscribed] = React.useState(false);

  const getSlotStyle = () => {
    if (slot.is_past) return "bg-zinc-800/30 text-zinc-600 cursor-not-allowed";
    if (!slot.is_available) return "bg-red-900/30 border-red-700/50";
    if (isSelected) return "bg-red-600 border-red-500 text-white";
    return "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 hover:border-red-500 cursor-pointer";
  };

  const handleNotifyClick = async (e) => {
    e.stopPropagation();
    if (!slot.booking_id || notifyLoading) return;
    
    setNotifyLoading(true);
    try {
      const token = localStorage.getItem("token");
      const playerId = localStorage.getItem("onesignal_player_id");
      
      const res = await axios.post(
        `/api/creator-schedule/notify/subscribe`,
        { booking_id: slot.booking_id, notification_type: "push" },
        { 
          headers: { 
            Authorization: token ? `Bearer ${token}` : undefined,
            "X-OneSignal-Player-Id": playerId
          }
        }
      );
      
      setIsSubscribed(true);
      toast.success(res.data.message || "You'll be notified!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to subscribe");
    } finally {
      setNotifyLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        if (slot.is_available && !slot.is_past) {
          console.log('Slot clicked:', slot);
          onSelect(slot);
        }
      }}
      disabled={!slot.is_available || slot.is_past}
      data-time-slot={slot.time_display}
      className={`p-2 rounded-lg border transition-all relative group text-left w-full ${getSlotStyle()}`}
    >
      <div className="text-xs font-mono">{slot.time_display}</div>
      {!slot.is_available && slot.booked_by && (
        <>
          <div className="text-[10px] truncate mt-1 text-zinc-400">
            {slot.booked_by}
          </div>
          {/* Notify button for booked slots */}
          {!slot.is_past && slot.booking_id && (
            <div
              onClick={handleNotifyClick}
              className={`absolute -top-1 -right-1 p-1 rounded-full transition-all ${
                isSubscribed 
                  ? "bg-green-600 text-white" 
                  : "bg-yellow-500 text-black hover:bg-yellow-400"
              } opacity-0 group-hover:opacity-100 cursor-pointer`}
              title={isSubscribed ? "Subscribed!" : "Notify me when this starts"}
            >
              {isSubscribed ? <BellRing className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
            </div>
          )}
        </>
      )}
    </button>
  );
}

// Day column component
function DayColumn({ day, selectedSlot, onSelectSlot }) {
  return (
    <div className="flex-1 min-w-[120px]">
      <div className="text-center p-2 bg-zinc-800 rounded-t-lg border-b border-zinc-700">
        <div className="font-semibold text-white">{day.day_name}</div>
        <div className="text-xs text-zinc-400">{day.date}</div>
      </div>
      <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 rounded-b-lg max-h-[400px] overflow-y-auto">
        {day.slots.map((slot, idx) => (
          <TimeSlot
            key={idx}
            slot={slot}
            isSelected={selectedSlot?.date === slot.date && selectedSlot?.hour === slot.hour && selectedSlot?.minute === slot.minute}
            onSelect={onSelectSlot}
          />
        ))}
      </div>
    </div>
  );
}

export default function CreatorSchedulePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookingRules, setBookingRules] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [myBookings, setMyBookings] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  
  // New: Calendar view and input mode states
  const [calendarView, setCalendarView] = useState(CALENDAR_VIEWS.WEEK);
  const [inputMode, setInputMode] = useState(INPUT_MODES.CALENDAR);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  
  // New: Text input mode states
  const [textDate, setTextDate] = useState('');
  const [textTime, setTextTime] = useState('');
  const [textDuration, setTextDuration] = useState('');
  const [parsedDuration, setParsedDuration] = useState(60);
  
  const [searchParams] = useSearchParams();
  
  // Get URL params for pre-selected video
  const preSelectedVideoId = searchParams.get('video');
  const preSelectedTitle = searchParams.get('title');
  const preSelectedVideoUrl = searchParams.get('video_url');
  
  // Booking form state - Enhanced with smart features
  const [bookingForm, setBookingForm] = useState(() => {
    // Initialize with URL params if present
    const initialState = {
      title: preSelectedTitle ? decodeURIComponent(preSelectedTitle) : "",
      description: "",
      video_url: preSelectedVideoUrl ? decodeURIComponent(preSelectedVideoUrl) : "",
      stream_url: "",
      duration_minutes: 60,
      category: "creator_content",
      content_type: preSelectedVideoUrl ? (preSelectedVideoUrl.includes('youtube') ? "youtube" : "library") : "youtube",
      thumbnail_url: "",
      // Smart features
      enable_auto_cutoff: true,
      enable_reminder: true,
      enable_health_check: false
    };
    return initialState;
  });
  const [selectedVideoInfo, setSelectedVideoInfo] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [myUploads, setMyUploads] = useState([]);
  
  // Show booking form if video is pre-selected
  const [showBookingForm, setShowBookingForm] = useState(() => {
    return !!(preSelectedVideoId || preSelectedTitle || preSelectedVideoUrl);
  });
  
  // New: Pending confirmations (reminders)
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  
  // Celebration modal state
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);
  
  // Trigger confetti animation
  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  // Parse natural language duration
  const parseDurationText = useCallback(async (text) => {
    if (!text.trim()) {
      setParsedDuration(60);
      return;
    }
    
    try {
      const res = await axios.post(`${API}/smart-schedule/parse-duration?duration_text=${encodeURIComponent(text)}`);
      setParsedDuration(res.data.minutes);
      setBookingForm(prev => ({ ...prev, duration_minutes: res.data.minutes }));
    } catch (err) {
      // Fallback: basic parsing
      const text_lower = text.toLowerCase();
      let minutes = 60;
      
      const hourMatch = text_lower.match(/(\d+)\s*h/);
      const minMatch = text_lower.match(/(\d+)\s*m/);
      
      if (hourMatch) minutes = parseInt(hourMatch[1]) * 60;
      if (minMatch) minutes += parseInt(minMatch[1]);
      if (!hourMatch && !minMatch) {
        const numMatch = text.match(/(\d+)/);
        if (numMatch) minutes = parseInt(numMatch[1]);
      }
      
      setParsedDuration(Math.min(480, Math.max(5, minutes)));
      setBookingForm(prev => ({ ...prev, duration_minutes: Math.min(480, Math.max(5, minutes)) }));
    }
  }, []);

  // State for TRT detection
  const [detectingTRT, setDetectingTRT] = useState(false);
  const [detectedTRT, setDetectedTRT] = useState(null);

  // Auto-detect video TRT from YouTube URL or library video
  const detectVideoTRT = useCallback(async (videoUrl) => {
    if (!videoUrl || !videoUrl.trim()) {
      setDetectedTRT(null);
      return;
    }
    
    setDetectingTRT(true);
    
    try {
      // First try YouTube detection
      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        const res = await axios.post(`${API}/creator-schedule/detect-trt`, { 
          video_url: videoUrl 
        });
        
        if (res.data.trt_seconds && res.data.trt_seconds > 0) {
          const minutes = Math.ceil(res.data.trt_seconds / 60);
          setDetectedTRT(res.data.trt_seconds);
          setParsedDuration(minutes);
          setBookingForm(prev => ({ ...prev, duration_minutes: minutes }));
          toast.success(`Video duration detected: ${Math.floor(res.data.trt_seconds / 60)}m ${res.data.trt_seconds % 60}s`);
        }
      } else if (videoUrl.includes('/video/') || videoUrl.startsWith('vid_')) {
        // Library video - fetch from upload record
        const fileId = videoUrl.includes('/video/') 
          ? videoUrl.split('/video/')[1].split('?')[0]
          : videoUrl;
        
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API}/creator-schedule/upload/${fileId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data.duration_seconds && res.data.duration_seconds > 0) {
          const minutes = Math.ceil(res.data.duration_seconds / 60);
          setDetectedTRT(res.data.duration_seconds);
          setParsedDuration(minutes);
          setBookingForm(prev => ({ ...prev, duration_minutes: minutes }));
          toast.success(`Video duration detected: ${Math.floor(res.data.duration_seconds / 60)}m ${res.data.duration_seconds % 60}s`);
        }
      }
    } catch (err) {
      console.error('TRT detection failed:', err);
      // Don't show error toast - just keep the manual duration
    } finally {
      setDetectingTRT(false);
    }
  }, []);

  // Auto-detect TRT when video URL changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (bookingForm.video_url && bookingForm.video_url.trim()) {
        detectVideoTRT(bookingForm.video_url);
      }
    }, 800); // Debounce
    return () => clearTimeout(timer);
  }, [bookingForm.video_url, detectVideoTRT]);

  // Debounced duration parsing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (textDuration) {
        parseDurationText(textDuration);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [textDuration, parseDurationText]);

  // Fetch pending confirmations (reminders)
  useEffect(() => {
    const fetchPendingConfirmations = async () => {
      if (!user) return;
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API}/smart-schedule/pending-reminders`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPendingConfirmations(res.data.pending_confirmations || []);
      } catch (err) {
        console.error("Failed to fetch pending confirmations:", err);
      }
    };
    fetchPendingConfirmations();
  }, [user]);

  // Handle event confirmation (from reminder)
  const handleConfirmEvent = async (bookingId, action) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/smart-schedule/booking/${bookingId}/confirm`, 
        { action },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success(`Event ${action === 'confirm' ? 'confirmed' : 'cancelled'}!`);
      setPendingConfirmations(prev => prev.filter(p => p.booking_id !== bookingId));
      
      // Refresh bookings
      const bookingsRes = await axios.get(`${API}/creator-schedule/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyBookings(bookingsRes.data.bookings || []);
    } catch (err) {
      toast.error("Failed to update event status");
    }
  };

  // Generate calendar dates for different views
  const getCalendarDates = useCallback(() => {
    const dates = [];
    const today = new Date(currentViewDate);
    
    if (calendarView === CALENDAR_VIEWS.WEEK) {
      // Show 7 days starting from today
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date);
      }
    } else if (calendarView === CALENDAR_VIEWS.MONTH) {
      // Show current month
      const year = today.getFullYear();
      const month = today.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // Get today's date at midnight for comparison (include today)
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
        const dateMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (dateMidnight >= todayMidnight) { // Include today and future dates
          dates.push(new Date(d));
        }
      }
    } else if (calendarView === CALENDAR_VIEWS.YEAR) {
      // Show next 12 months (first day of each)
      for (let i = 0; i < 12; i++) {
        const date = new Date(today);
        date.setMonth(today.getMonth() + i);
        date.setDate(1);
        dates.push(date);
      }
    }
    
    return dates;
  }, [currentViewDate, calendarView]);

  // Navigate calendar
  const navigateCalendar = (direction) => {
    const newDate = new Date(currentViewDate);
    if (calendarView === CALENDAR_VIEWS.WEEK) {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (calendarView === CALENDAR_VIEWS.MONTH) {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setFullYear(newDate.getFullYear() + direction);
    }
    setCurrentViewDate(newDate);
  };

  // Handle text mode slot selection
  const handleTextModeSubmit = () => {
    if (!textDate || !textTime) {
      toast.error("Please enter both date and time");
      return;
    }
    
    // Parse the date (accept various formats)
    let parsedDate;
    try {
      // Try different date formats
      if (textDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        parsedDate = new Date(textDate);
      } else if (textDate.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
        const [m, d, y] = textDate.split('/');
        parsedDate = new Date(y.length === 2 ? `20${y}` : y, m - 1, d);
      } else if (textDate.match(/^\d{1,2}-\d{1,2}-\d{2,4}$/)) {
        const [m, d, y] = textDate.split('-');
        parsedDate = new Date(y.length === 2 ? `20${y}` : y, m - 1, d);
      } else {
        // Try natural parsing
        parsedDate = new Date(textDate);
      }
      
      if (isNaN(parsedDate.getTime())) {
        throw new Error("Invalid date");
      }
    } catch (e) {
      toast.error("Invalid date format. Try YYYY-MM-DD or MM/DD/YYYY");
      return;
    }
    
    // Parse the time
    let hour, minute = 0;
    const timeMatch = textTime.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i);
    if (timeMatch) {
      hour = parseInt(timeMatch[1]);
      minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3]?.toLowerCase();
      
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
    } else {
      toast.error("Invalid time format. Try HH:MM or HH:MM AM/PM");
      return;
    }
    
    const dateStr = parsedDate.toISOString().split('T')[0];
    
    // Create a virtual slot for the text input
    setSelectedSlot({
      date: dateStr,
      hour: hour,
      minute: minute,
      time_display: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      is_available: true,
      is_text_input: true
    });
    setShowBookingForm(true);
    toast.success(`Selected ${dateStr} at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };

  // Check for invite token AND pre-selected slot from TV Guide AND pre-selected video from library
  useEffect(() => {
    const inviteToken = searchParams.get('invite');
    const preSelectedDate = searchParams.get('date');
    const preSelectedHour = searchParams.get('hour');
    const preSelectedVideoId = searchParams.get('video');
    const preSelectedTitle = searchParams.get('title');
    const preSelectedVideoUrl = searchParams.get('video_url');
    
    // Check if there's a video selected from Creator Library
    const savedVideo = localStorage.getItem('selectedVideoForSchedule');
    const savedSlot = localStorage.getItem('selectedSlotForSchedule');
    
    if (savedVideo) {
      try {
        const video = JSON.parse(savedVideo);
        setBookingForm(prev => ({
          ...prev,
          title: video.title || prev.title,
          video_url: video.video_url || prev.video_url,
          content_type: 'library',
          duration_minutes: video.duration_minutes || (video.duration_seconds ? Math.ceil(video.duration_seconds / 60) : prev.duration_minutes),
          thumbnail_url: video.thumbnail_url || ''
        }));
        // Store full video info for display
        setSelectedVideoInfo(video);
        setShowBookingForm(true);
        // Clear the saved video so it doesn't persist across visits
        localStorage.removeItem('selectedVideoForSchedule');
        
        // Show toast with video name
        toast.success(`"${video.title}" loaded! Now pick a time slot.`);
      } catch (e) {
        console.error("Error parsing saved video:", e);
      }
    }
    
    // Restore previously selected slot if returning from library
    if (savedSlot) {
      try {
        const slot = JSON.parse(savedSlot);
        setSelectedSlot(slot);
        localStorage.removeItem('selectedSlotForSchedule');
      } catch (e) {
        console.error("Error parsing saved slot:", e);
      }
    }
    
    if (inviteToken) {
      validateInvite(inviteToken);
    }
    
    // Store pre-selected slot info for after data loads
    if (preSelectedDate && preSelectedHour) {
      localStorage.setItem('ztv_preselect_slot', JSON.stringify({
        date: preSelectedDate,
        hour: parseInt(preSelectedHour)
      }));
    }
    
    // Pre-fill booking form with video from URL params
    if (preSelectedVideoId || preSelectedTitle) {
      setBookingForm(prev => ({
        ...prev,
        title: preSelectedTitle ? decodeURIComponent(preSelectedTitle) : prev.title,
        video_url: preSelectedVideoUrl ? decodeURIComponent(preSelectedVideoUrl) : prev.video_url,
        content_type: preSelectedVideoUrl?.includes('youtube') ? 'youtube' : 'library'
      }));
      // Show the booking form automatically
      setShowBookingForm(true);
      toast.info("Video selected! Now pick a time slot to schedule it.");
    }
  }, [searchParams]);

  const validateInvite = async (token) => {
    try {
      const res = await axios.get(`${API}/creator-schedule/invite/${token}`);
      if (res.data.valid) {
        toast.success(`Welcome ${res.data.creator_name || 'Creator'}! You've been invited to schedule content.`);
        // Accept the invite if user is logged in
        const storedToken = localStorage.getItem("token");
        if (storedToken) {
          await axios.post(`${API}/creator-schedule/invite/${token}/accept`, {}, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
        }
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        toast.error(err.response?.data?.detail || "Invalid invite link");
      }
    }
  };

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for stored user first
        const storedUser = localStorage.getItem("ztvlive_user");
        const token = localStorage.getItem("token");
        
        if (!storedUser && !token) {
          // Preserve the date/hour params in the redirect
          const currentParams = new URLSearchParams(window.location.search);
          const redirectUrl = `/schedule-slot${currentParams.toString() ? '?' + currentParams.toString() : ''}`;
          navigate(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
          return;
        }
        
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          return;
        }
        
        // Fallback: try to fetch user with token
        if (token) {
          const res = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(res.data);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        // If stored user exists, use that
        const storedUser = localStorage.getItem("ztvlive_user");
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          navigate("/login?redirect=/schedule-slot");
        }
      }
    };
    checkAuth();
  }, [navigate]);

  // Fetch available slots
  useEffect(() => {
    const fetchSlots = async () => {
      try {
        setLoading(true);
        // Get user's timezone
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await axios.get(`${API}/creator-schedule/available-slots?days_ahead=7&user_timezone=${encodeURIComponent(userTimezone)}`);
        setAvailableSlots(res.data.available_slots || []);
        setBookingRules(res.data.booking_rules);
        
        // Check for pre-selected slot from URL params or localStorage (One-Click Claim)
        const currentParams = new URLSearchParams(window.location.search);
        const urlDate = currentParams.get('date');
        const urlHour = currentParams.get('hour');
        const preSelect = localStorage.getItem('ztv_preselect_slot');
        
        let targetDate = urlDate;
        let targetHour = urlHour ? parseInt(urlHour) : null;
        
        if (!targetDate && preSelect) {
          const stored = JSON.parse(preSelect);
          targetDate = stored.date;
          targetHour = stored.hour;
          localStorage.removeItem('ztv_preselect_slot');
        }
        
        if (targetDate && targetHour !== null) {
          // Find the matching slot
          const slots = res.data.available_slots || [];
          for (const day of slots) {
            const matchingSlot = day.slots.find(s => 
              s.date === targetDate && s.hour === targetHour && s.is_available && !s.is_past
            );
            if (matchingSlot) {
              setSelectedSlot(matchingSlot);
              setShowBookingForm(true);
              toast.success(`Selected ${String(targetHour).padStart(2,'0')}:00 slot - Fill in your content details!`);
              break;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch slots:", err);
        toast.error("Failed to load available time slots");
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      fetchSlots();
    }
  }, [user]);

  // Auto-scroll to current time when slots are loaded
  useEffect(() => {
    if (availableSlots.length > 0 && calendarView === CALENDAR_VIEWS.WEEK) {
      // Get current hour rounded down to nearest 30-min slot
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes() >= 30 ? 30 : 0;
      const targetSlotTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      
      // Find and scroll to the slot element
      setTimeout(() => {
        const slotElements = document.querySelectorAll('[data-time-slot]');
        for (const el of slotElements) {
          if (el.dataset.timeSlot === targetSlotTime) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      }, 500);
    }
  }, [availableSlots, calendarView]);

  // Fetch user's bookings
  useEffect(() => {
    const fetchMyBookings = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API}/creator-schedule/my-bookings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMyBookings(res.data.bookings || []);
      } catch (err) {
        console.error("Failed to fetch bookings:", err);
      }
    };
    
    if (user) {
      fetchMyBookings();
    }
  }, [user]);

  const handleSlotSelect = (slot) => {
    console.log('Slot selected:', slot);
    setSelectedSlot(slot);
    setShowBookingForm(true);
  };

  const handleBookSlot = async (e) => {
    e.preventDefault();
    
    if (!selectedSlot) {
      toast.error("Please select a time slot first");
      return;
    }
    
    if (!bookingForm.title.trim()) {
      toast.error("Please enter a title for your content");
      return;
    }
    
    // Validate based on content type
    if (bookingForm.content_type === "youtube") {
      if (!bookingForm.video_url.trim()) {
        toast.error("Please enter a YouTube URL");
        return;
      }
      if (!bookingForm.video_url.includes("youtube.com") && !bookingForm.video_url.includes("youtu.be")) {
        toast.error("Please enter a valid YouTube URL");
        return;
      }
    } else if (bookingForm.content_type === "library") {
      if (!bookingForm.video_url.trim()) {
        toast.error("No video selected from library. Please go back and select a video.");
        return;
      }
    } else if (bookingForm.content_type === "upload") {
      if (!uploadedFile) {
        toast.error("Please upload a video file");
        return;
      }
    }
    
    setSubmitting(true);
    const token = localStorage.getItem("token");
    
    try {
      let videoUrl = bookingForm.video_url;
      let fileId = null;

      // If uploading, first upload the file
      if (bookingForm.content_type === "upload" && uploadedFile) {
        setUploading(true);
        toast.info("Uploading video...");
        
        const formData = new FormData();
        formData.append("file", uploadedFile);
        formData.append("title", bookingForm.title);
        formData.append("description", bookingForm.description);
        formData.append("category", bookingForm.category);
        
        const uploadRes = await axios.post(`${API}/creator-schedule/upload-video`, formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data"
          }
        });
        
        fileId = uploadRes.data.file_id;
        videoUrl = `${window.location.origin}/api/creator-schedule/video/${fileId}`;
        setUploading(false);
      }

      // Now book the slot using Smart Scheduling API
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const bookingPayload = {
        slot_date: selectedSlot.date,
        slot_time: `${String(selectedSlot.hour).padStart(2, '0')}:${String(selectedSlot.minute || 0).padStart(2, '0')}`,
        duration_minutes: bookingForm.duration_minutes,
        title: bookingForm.title,
        description: bookingForm.description,
        content_type: bookingForm.content_type,
        video_url: bookingForm.content_type === 'live_stream' ? null : videoUrl,
        stream_url: bookingForm.content_type === 'live_stream' ? bookingForm.stream_url : null,
        category: bookingForm.category,
        enable_auto_cutoff: bookingForm.enable_auto_cutoff,
        enable_reminder: bookingForm.enable_reminder,
        enable_health_check: bookingForm.enable_health_check && bookingForm.content_type === 'live_stream',
        user_timezone: userTimezone
      };

      const res = await axios.post(
        `${API}/smart-schedule/book`,
        bookingPayload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Check if we should show celebration
      if (res.data.show_confetti) {
        triggerConfetti();
        setCelebrationData({
          title: bookingForm.title,
          date: selectedSlot.date,
          time: `${String(selectedSlot.hour).padStart(2, '0')}:${String(selectedSlot.minute || 0).padStart(2, '0')}`,
          message: res.data.message
        });
        setShowCelebrationModal(true);
      } else {
        toast.success(res.data.message);
      }
      
      // Reset form
      setShowBookingForm(false);
      setSelectedSlot(null);
      setUploadedFile(null);
      setBookingForm({
        title: "",
        description: "",
        video_url: "",
        stream_url: "",
        duration_minutes: 60,
        category: "creator_content",
        content_type: "youtube",
        enable_auto_cutoff: true,
        enable_reminder: true,
        enable_health_check: false
      });
      
      // Reset text inputs
      setTextDate('');
      setTextTime('');
      setTextDuration('');
      setParsedDuration(60);
      
      // Refresh slots and bookings
      const slotsRes = await axios.get(`${API}/creator-schedule/available-slots?days_ahead=7`);
      setAvailableSlots(slotsRes.data.available_slots || []);
      
      const bookingsRes = await axios.get(`${API}/creator-schedule/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyBookings(bookingsRes.data.bookings || []);
      
    } catch (err) {
      console.error("Booking failed:", err);
      toast.error(err.response?.data?.detail || "Failed to book slot");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/creator-schedule/cancel/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success("Booking cancelled");
      
      // Refresh
      const bookingsRes = await axios.get(`${API}/creator-schedule/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyBookings(bookingsRes.data.bookings || []);
      
      const slotsRes = await axios.get(`${API}/creator-schedule/available-slots?days_ahead=7`);
      setAvailableSlots(slotsRes.data.available_slots || []);
      
    } catch (err) {
      toast.error("Failed to cancel booking");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "pending":
        return <Badge className="bg-yellow-600"><AlertCircle className="w-3 h-3 mr-1" />Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-600"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case "cancelled":
        return <Badge className="bg-zinc-600">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Tv className="w-10 h-10 text-red-500" />
            <h1 className="text-4xl font-bold">Schedule Your Slot</h1>
          </div>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Book a time slot on ZTVLIVE's 24/7 live TV schedule. Your content will be broadcast to viewers worldwide at your scheduled time.
          </p>
          
          {/* Booking Rules */}
          {bookingRules && (
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              <Badge variant="outline" className="border-zinc-700">
                <Clock className="w-3 h-3 mr-1" />
                5 min - 8 hour slots
              </Badge>
              <Badge variant="outline" className="border-zinc-700">
                <Calendar className="w-3 h-3 mr-1" />
                Book 1 min - 30 days ahead
              </Badge>
            </div>
          )}
          
          {/* Input Mode & Calendar View Toggle */}
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {/* Input Mode Toggle */}
            <div className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-1">
              <Button
                size="sm"
                variant={inputMode === INPUT_MODES.CALENDAR ? "default" : "ghost"}
                onClick={() => setInputMode(INPUT_MODES.CALENDAR)}
                className={inputMode === INPUT_MODES.CALENDAR ? "bg-red-600" : ""}
              >
                <Grid3X3 className="w-4 h-4 mr-1" />
                Calendar
              </Button>
              <Button
                size="sm"
                variant={inputMode === INPUT_MODES.TEXT ? "default" : "ghost"}
                onClick={() => setInputMode(INPUT_MODES.TEXT)}
                className={inputMode === INPUT_MODES.TEXT ? "bg-red-600" : ""}
              >
                <Type className="w-4 h-4 mr-1" />
                Text Input
              </Button>
            </div>
            
            {/* Calendar View Toggle (only shown in calendar mode) */}
            {inputMode === INPUT_MODES.CALENDAR && (
              <div className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-1">
                <Button
                  size="sm"
                  variant={calendarView === CALENDAR_VIEWS.WEEK ? "default" : "ghost"}
                  onClick={() => setCalendarView(CALENDAR_VIEWS.WEEK)}
                  className={calendarView === CALENDAR_VIEWS.WEEK ? "bg-violet-600" : ""}
                >
                  <CalendarDays className="w-4 h-4 mr-1" />
                  Week
                </Button>
                <Button
                  size="sm"
                  variant={calendarView === CALENDAR_VIEWS.MONTH ? "default" : "ghost"}
                  onClick={() => setCalendarView(CALENDAR_VIEWS.MONTH)}
                  className={calendarView === CALENDAR_VIEWS.MONTH ? "bg-violet-600" : ""}
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Month
                </Button>
                <Button
                  size="sm"
                  variant={calendarView === CALENDAR_VIEWS.YEAR ? "default" : "ghost"}
                  onClick={() => setCalendarView(CALENDAR_VIEWS.YEAR)}
                  className={calendarView === CALENDAR_VIEWS.YEAR ? "bg-violet-600" : ""}
                >
                  <CalendarRange className="w-4 h-4 mr-1" />
                  Year
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Earnings Preview Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-green-900/30 via-zinc-900 to-emerald-900/30 border border-green-500/30 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                  <span className="text-3xl">💰</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Your Earnings Potential</h2>
                  <p className="text-zinc-400 text-sm">70% revenue share on all your content views</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 md:gap-8 w-full md:w-auto">
                <div className="text-center p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                  <div className="text-2xl font-bold text-green-400">$5-15</div>
                  <div className="text-xs text-zinc-500 mt-1">Per 1K views</div>
                </div>
                <div className="text-center p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                  <div className="text-2xl font-bold text-emerald-400">$50-150</div>
                  <div className="text-xs text-zinc-500 mt-1">30-min slot avg</div>
                </div>
                <div className="text-center p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                  <div className="text-2xl font-bold text-yellow-400">$200+</div>
                  <div className="text-xs text-zinc-500 mt-1">Prime Time slot</div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex flex-wrap gap-3 justify-center md:justify-start">
              <Badge className="bg-green-600/20 text-green-400 border border-green-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Weekly payouts
              </Badge>
              <Badge className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                No minimum threshold
              </Badge>
              <Badge className="bg-yellow-600/20 text-yellow-400 border border-yellow-500/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Prime Time = 2x earnings
              </Badge>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Mobile: Floating Booking Button when slot is selected */}
          {selectedSlot && (
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black via-black/95 to-transparent p-4 pt-8">
              <div className="bg-zinc-900 border border-green-600/50 rounded-xl p-3 shadow-lg shadow-green-600/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-400">Selected Slot</p>
                    <p className="text-sm font-semibold text-white truncate">
                      {selectedSlot.date} at {selectedSlot.time_display}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setShowBookingForm(true);
                      // Scroll to booking form on mobile
                      setTimeout(() => {
                        document.getElementById('mobile-booking-form')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold px-4"
                  >
                    Book Now
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Pending Confirmations Banner */}
          {pendingConfirmations.length > 0 && (
            <div className="lg:col-span-3">
              <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4">
                <h3 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Events Needing Confirmation ({pendingConfirmations.length})
                </h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingConfirmations.map((event) => (
                    <div key={event.booking_id} className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                      <div className="font-medium text-white truncate mb-1">{event.title}</div>
                      <div className="text-sm text-zinc-400 mb-3">
                        {event.slot_date} at {event.slot_time}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-500"
                          onClick={() => handleConfirmEvent(event.booking_id, 'confirm')}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-red-700 text-red-400 hover:bg-red-900/30"
                          onClick={() => handleConfirmEvent(event.booking_id, 'cancel')}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TV Guide / Available Slots */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500" />
                {inputMode === INPUT_MODES.CALENDAR ? 'Available Time Slots' : 'Enter Date & Time'}
              </h2>
              
              {inputMode === INPUT_MODES.TEXT ? (
                /* Text Input Mode */
                <div className="space-y-6 py-4">
                  <div className="bg-zinc-800/50 rounded-lg p-6 border border-zinc-700">
                    <h3 className="font-medium text-white mb-4">Type your preferred date and time</h3>
                    
                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Date Input */}
                      <div>
                        <Label className="text-zinc-400 mb-2 block">Date</Label>
                        <Input
                          type="text"
                          value={textDate}
                          onChange={(e) => setTextDate(e.target.value)}
                          placeholder="YYYY-MM-DD or MM/DD/YYYY"
                          className="bg-zinc-900 border-zinc-600"
                        />
                        <p className="text-xs text-zinc-500 mt-1">e.g., 2026-04-15 or 04/15/2026</p>
                      </div>
                      
                      {/* Time Input */}
                      <div>
                        <Label className="text-zinc-400 mb-2 block">Time</Label>
                        <Input
                          type="text"
                          value={textTime}
                          onChange={(e) => setTextTime(e.target.value)}
                          placeholder="HH:MM or HH:MM AM/PM"
                          className="bg-zinc-900 border-zinc-600"
                        />
                        <p className="text-xs text-zinc-500 mt-1">e.g., 14:30 or 2:30 PM</p>
                      </div>
                      
                      {/* Duration Input */}
                      <div>
                        <Label className="text-zinc-400 mb-2 block">Duration</Label>
                        <Input
                          type="text"
                          value={textDuration}
                          onChange={(e) => setTextDuration(e.target.value)}
                          placeholder="e.g., 2h 30m or 90 minutes"
                          className="bg-zinc-900 border-zinc-600"
                        />
                        <p className="text-xs text-zinc-500 mt-1">
                          {textDuration ? `Parsed: ${parsedDuration} minutes` : 'Natural language supported'}
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      onClick={handleTextModeSubmit}
                      className="mt-6 bg-red-600 hover:bg-red-500"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Select This Slot
                    </Button>
                  </div>
                  
                  {/* Quick Date Shortcuts */}
                  <div>
                    <Label className="text-zinc-400 mb-2 block">Quick Select</Label>
                    <div className="flex flex-wrap gap-2">
                      {['Today', 'Tomorrow', 'This Weekend', 'Next Week'].map((quick) => (
                        <Button
                          key={quick}
                          variant="outline"
                          size="sm"
                          className="border-zinc-700 hover:border-red-500"
                          onClick={() => {
                            const today = new Date();
                            let date = new Date();
                            
                            if (quick === 'Today') {
                              // Keep today
                            } else if (quick === 'Tomorrow') {
                              date.setDate(today.getDate() + 1);
                            } else if (quick === 'This Weekend') {
                              const dayOfWeek = today.getDay();
                              const daysUntilSat = (6 - dayOfWeek + 7) % 7 || 7;
                              date.setDate(today.getDate() + daysUntilSat);
                            } else if (quick === 'Next Week') {
                              date.setDate(today.getDate() + 7);
                            }
                            
                            setTextDate(date.toISOString().split('T')[0]);
                          }}
                        >
                          {quick}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Calendar Mode */
                <>
                  {/* Calendar Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="sm" onClick={() => navigateCalendar(-1)}>
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div className="text-center">
                      <span className="font-semibold text-white">
                        {calendarView === CALENDAR_VIEWS.WEEK && `Week of ${currentViewDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                        {calendarView === CALENDAR_VIEWS.MONTH && currentViewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        {calendarView === CALENDAR_VIEWS.YEAR && `${currentViewDate.getFullYear()} - ${currentViewDate.getFullYear() + 1}`}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigateCalendar(1)}>
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mb-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-zinc-800 border border-zinc-700 rounded" />
                      <span className="text-zinc-400">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-900/30 border border-red-700/50 rounded" />
                      <span className="text-zinc-400">Booked</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-600 border border-red-500 rounded" />
                      <span className="text-zinc-400">Selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-zinc-800/30 rounded" />
                      <span className="text-zinc-400">Past/Unavailable</span>
                    </div>
                  </div>
              
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-4">
                  {availableSlots.map((day, idx) => (
                    <DayColumn
                      key={idx}
                      day={day}
                      selectedSlot={selectedSlot}
                      onSelectSlot={handleSlotSelect}
                    />
                  ))}
                </div>
              )}
              </>
              )}
            </div>
          </div>

          {/* Booking Form / My Bookings */}
          <div className="space-y-6" id="mobile-booking-form">
            {/* Booking Form */}
            {/* Booking Form - Show when slot is selected OR when video is pre-selected */}
            {(showBookingForm && selectedSlot) || (showBookingForm && bookingForm.video_url) ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
              >
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Video className="w-5 h-5 text-red-500" />
                  {bookingForm.video_url && !selectedSlot ? "Select a Time Slot" : "Book This Slot"}
                </h3>
                
                {/* Pre-selected Video Banner */}
                {bookingForm.video_url && bookingForm.title && (
                  <div className="bg-gradient-to-r from-purple-900/30 to-red-900/30 border border-purple-600/30 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-600/30 rounded-lg flex items-center justify-center">
                        <Film className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-zinc-400">Scheduling from your library</div>
                        <div className="font-medium text-white truncate">{bookingForm.title}</div>
                      </div>
                      <Badge className="bg-purple-600/50 text-purple-300">Library</Badge>
                    </div>
                  </div>
                )}
                
                {/* No slot selected yet - prompt to pick one */}
                {!selectedSlot && bookingForm.video_url && (
                  <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Click on an available slot in the calendar to schedule your video
                    </p>
                  </div>
                )}
                
                {selectedSlot && (
                  <div className="bg-zinc-800 rounded-lg p-3 mb-4">
                    <div className="text-sm text-zinc-400">Selected Time</div>
                    <div className="text-lg font-bold">
                      {selectedSlot.date} at {selectedSlot.time_display}
                    </div>
                  </div>
                )}
                
                <form onSubmit={handleBookSlot} className="space-y-4">
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Content Title *</label>
                    <Input
                      value={bookingForm.title}
                      onChange={(e) => setBookingForm({...bookingForm, title: e.target.value})}
                      placeholder="e.g., Live Music Session with DJ Mike"
                      className="bg-zinc-800 border-zinc-700"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Description</label>
                    <Textarea
                      value={bookingForm.description}
                      onChange={(e) => setBookingForm({...bookingForm, description: e.target.value})}
                      placeholder="Tell viewers what to expect..."
                      className="bg-zinc-800 border-zinc-700"
                      rows={3}
                    />
                  </div>
                  
                  {/* Content Type Selector */}
                  <div>
                    <label className="text-sm text-zinc-400 mb-2 block">Content Source</label>
                    <div className="grid grid-cols-4 gap-2">
                      {/* From Library - Auto-navigate if no video selected */}
                      <button
                        type="button"
                        onClick={() => {
                          // If no video is selected, navigate to library to pick one
                          if (!bookingForm.video_url || bookingForm.content_type !== "library") {
                            // Store current slot selection before navigating
                            if (selectedSlot) {
                              localStorage.setItem('selectedSlotForSchedule', JSON.stringify(selectedSlot));
                            }
                            navigate('/creator/library?select=true&returnTo=/schedule-slot');
                          } else {
                            setBookingForm({...bookingForm, content_type: "library"});
                          }
                        }}
                        className={`p-3 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                          bookingForm.content_type === "library" 
                            ? "bg-purple-600 border-purple-500 text-white" 
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        <Film className="w-4 h-4" />
                        <span className="text-xs">Library</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingForm({...bookingForm, content_type: "youtube"})}
                        className={`p-3 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                          bookingForm.content_type === "youtube" 
                            ? "bg-red-600 border-red-500 text-white" 
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        <Video className="w-4 h-4" />
                        <span className="text-xs">YouTube</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingForm({...bookingForm, content_type: "live_stream", enable_health_check: true})}
                        className={`p-3 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                          bookingForm.content_type === "live_stream" 
                            ? "bg-red-600 border-red-500 text-white" 
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        <Radio className="w-4 h-4" />
                        <span className="text-xs">Live</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingForm({...bookingForm, content_type: "upload"})}
                        className={`p-3 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                          bookingForm.content_type === "upload" 
                            ? "bg-red-600 border-red-500 text-white" 
                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                        }`}
                      >
                        <Upload className="w-4 h-4" />
                        <span className="text-xs">Upload</span>
                      </button>
                    </div>
                  </div>

                  {/* From Library - Shows pre-selected video info */}
                  {bookingForm.content_type === "library" && (
                    <div className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-purple-600/30 rounded-lg flex items-center justify-center">
                          <Film className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-white">Video from Your Library</h4>
                          <p className="text-xs text-zinc-400">Ready to schedule</p>
                        </div>
                        {!bookingForm.video_url && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate('/creator/library?select=true&returnTo=/schedule')}
                            className="border-purple-500 text-purple-400 hover:bg-purple-600/20"
                          >
                            <Film className="w-4 h-4 mr-1" /> Browse Library
                          </Button>
                        )}
                      </div>
                      
                      {/* Show selected video with thumbnail */}
                      {bookingForm.title && bookingForm.video_url && (
                        <div className="bg-zinc-900/50 rounded-lg p-3 flex gap-4">
                          {(selectedVideoInfo?.thumbnail_url || selectedVideoInfo?.youtube_id) && (
                            <img
                              src={selectedVideoInfo?.thumbnail_url || `https://img.youtube.com/vi/${selectedVideoInfo?.youtube_id}/hqdefault.jpg`}
                              alt={bookingForm.title}
                              className="w-32 h-20 object-cover rounded"
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-white mb-1">{bookingForm.title}</p>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              {bookingForm.duration_minutes && (
                                <Badge className="bg-purple-600">
                                  <Clock className="w-3 h-3 mr-1" /> {bookingForm.duration_minutes} min
                                </Badge>
                              )}
                              {selectedVideoInfo?.youtube_id && (
                                <Badge className="bg-red-600">
                                  YouTube
                                </Badge>
                              )}
                            </div>
                            <Button 
                              variant="link" 
                              size="sm" 
                              className="text-purple-400 p-0 h-auto mt-2"
                              onClick={() => navigate('/creator/library?select=true&returnTo=/schedule')}
                            >
                              Change Video
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {!bookingForm.video_url && (
                        <p className="text-sm text-yellow-400 mt-2">
                          Click "Browse Library" to select a video from your uploads.
                        </p>
                      )}
                    </div>
                  )}

                  {/* YouTube URL Input */}
                  {bookingForm.content_type === "youtube" && (
                    <div>
                      <label className="text-sm text-zinc-400 mb-1 block">YouTube URL *</label>
                      <Input
                        value={bookingForm.video_url}
                        onChange={(e) => setBookingForm({...bookingForm, video_url: e.target.value})}
                        placeholder="https://youtube.com/watch?v=..."
                        className="bg-zinc-800 border-zinc-700"
                        required={bookingForm.content_type === "youtube"}
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Make sure your video is public and embeddable
                      </p>
                    </div>
                  )}

                  {/* Live Stream URL Input */}
                  {bookingForm.content_type === "live_stream" && (
                    <div>
                      <label className="text-sm text-zinc-400 mb-1 block">Live Stream URL *</label>
                      <Input
                        value={bookingForm.stream_url}
                        onChange={(e) => setBookingForm({...bookingForm, stream_url: e.target.value})}
                        placeholder="https://twitch.tv/yourstream or YouTube Live URL"
                        className="bg-zinc-800 border-zinc-700"
                        required={bookingForm.content_type === "live_stream"}
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Twitch, YouTube Live, or any embeddable stream URL
                      </p>
                    </div>
                  )}

                  {/* Video Upload */}
                  {bookingForm.content_type === "upload" && (
                    <div>
                      <label className="text-sm text-zinc-400 mb-1 block">Upload Video *</label>
                      <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center hover:border-red-500 transition-colors">
                        <input
                          type="file"
                          accept="video/*,.mp4,.mov,.webm,.flv,.avi,.mkv,.m4v"
                          onChange={(e) => setUploadedFile(e.target.files[0])}
                          className="hidden"
                          id="video-upload"
                        />
                        <label htmlFor="video-upload" className="cursor-pointer">
                          {uploadedFile ? (
                            <div className="text-green-400">
                              <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                              <p className="font-medium">{uploadedFile.name}</p>
                              <p className="text-xs text-zinc-500">{(uploadedFile.size / (1024*1024)).toFixed(1)} MB</p>
                            </div>
                          ) : (
                            <div className="text-zinc-400">
                              <Upload className="w-8 h-8 mx-auto mb-2" />
                              <p>Click to select video file</p>
                              <p className="text-xs text-zinc-500 mt-1">MP4, WebM, MOV (max 500MB)</p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Duration</label>
                    {inputMode === INPUT_MODES.TEXT && textDuration ? (
                      <div className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white">
                        <span className="text-green-400">{parsedDuration} minutes</span>
                        <span className="text-zinc-500 text-sm ml-2">(from "{textDuration}")</span>
                      </div>
                    ) : (
                      <select
                        value={bookingForm.duration_minutes}
                        onChange={(e) => setBookingForm({...bookingForm, duration_minutes: parseInt(e.target.value)})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white"
                      >
                        <option value={5}>5 minutes</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                        <option value={180}>3 hours</option>
                        <option value={240}>4 hours</option>
                        <option value={360}>6 hours</option>
                        <option value={480}>8 hours</option>
                      </select>
                    )}
                  </div>
                  
                  {/* Smart Features Section */}
                  <div className="border-t border-zinc-700 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-violet-400" />
                      Smart Features
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Auto-Cutoff Toggle */}
                      <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Timer className="w-5 h-5 text-blue-400" />
                          <div>
                            <div className="text-sm font-medium text-white">Auto-Cutoff</div>
                            <div className="text-xs text-zinc-500">Switch to playlist when time ends</div>
                          </div>
                        </div>
                        <Switch
                          checked={bookingForm.enable_auto_cutoff}
                          onCheckedChange={(checked) => setBookingForm({...bookingForm, enable_auto_cutoff: checked})}
                        />
                      </div>
                      
                      {/* 1-Week Reminder Toggle */}
                      <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Bell className="w-5 h-5 text-yellow-400" />
                          <div>
                            <div className="text-sm font-medium text-white">1-Week Reminder</div>
                            <div className="text-xs text-zinc-500">Get notified to confirm event</div>
                          </div>
                        </div>
                        <Switch
                          checked={bookingForm.enable_reminder}
                          onCheckedChange={(checked) => setBookingForm({...bookingForm, enable_reminder: checked})}
                        />
                      </div>
                      
                      {/* Health Check Toggle (only for live streams) */}
                      {bookingForm.content_type === 'live_stream' && (
                        <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <HeartPulse className="w-5 h-5 text-green-400" />
                            <div>
                              <div className="text-sm font-medium text-white">Dead Stream Detection</div>
                              <div className="text-xs text-zinc-500">Auto-fallback if stream dies</div>
                            </div>
                          </div>
                          <Switch
                            checked={bookingForm.enable_health_check}
                            onCheckedChange={(checked) => setBookingForm({...bookingForm, enable_health_check: checked})}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm text-zinc-400 mb-1 block">Category</label>
                    <select
                      value={bookingForm.category}
                      onChange={(e) => setBookingForm({...bookingForm, category: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white"
                    >
                      <option value="creator_content">Creator Content</option>
                      <option value="music">Music</option>
                      <option value="podcast">Podcast</option>
                      <option value="gaming">Gaming</option>
                      <option value="entertainment">Entertainment</option>
                      <option value="education">Education</option>
                    </select>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-zinc-700"
                      onClick={() => {
                        setShowBookingForm(false);
                        setSelectedSlot(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      disabled={submitting}
                    >
                      {submitting ? "Booking..." : "Book Slot"}
                    </Button>
                  </div>
                </form>
              </motion.div>
            ) : null}

            {/* My Bookings */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Film className="w-5 h-5 text-red-500" />
                My Bookings
              </h3>
              
              {myBookings.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No bookings yet</p>
                  <p className="text-sm">Select a time slot to get started!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myBookings.slice(0, 5).map((booking) => (
                    <div
                      key={booking.booking_id}
                      className="bg-zinc-800 rounded-lg p-3 border border-zinc-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium truncate flex-1">{booking.title}</div>
                        {getStatusBadge(booking.status)}
                      </div>
                      <div className="text-sm text-zinc-400 mb-2">
                        {booking.slot_date} at {booking.slot_start_hour.toString().padStart(2, '0')}:{(booking.slot_start_minute || 0).toString().padStart(2, '0')}
                      </div>
                      <div className="text-xs text-zinc-500 mb-2">
                        Duration: {booking.duration_minutes} minutes
                      </div>
                      {(booking.status === "pending" || booking.status === "approved") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-zinc-700 text-red-400 hover:bg-red-900/20"
                          onClick={() => handleCancelBooking(booking.booking_id)}
                        >
                          Cancel Booking
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Help Section */}
            <div className="bg-gradient-to-br from-red-900/20 to-zinc-900 border border-red-800/30 rounded-xl p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <User className="w-5 h-5 text-red-500" />
                Creator Tips
              </h3>
              <ul className="text-sm text-zinc-400 space-y-2">
                <li>• <strong>Verified creators</strong> get instant approval</li>
                <li>• New creators need admin review (usually within 24h)</li>
                <li>• Book slots starting from 1 minute ahead</li>
                <li>• Make sure your YouTube video is public</li>
                <li>• Promote your slot on social media!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Celebration Modal */}
      <AnimatePresence>
        {showCelebrationModal && celebrationData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowCelebrationModal(false)}
            data-testid="celebration-modal"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-gradient-to-br from-zinc-900 via-red-900/20 to-zinc-900 rounded-2xl p-8 max-w-md w-full border border-red-500/30 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                {/* Party Icon */}
                <motion.div 
                  className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-yellow-500 via-red-500 to-pink-500 rounded-full flex items-center justify-center"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <PartyPopper className="w-12 h-12 text-white" />
                </motion.div>
                
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
                  You're Going LIVE!
                </h2>
                
                <p className="text-zinc-300 mb-6">
                  {celebrationData.message}
                </p>
                
                {/* Slot Details */}
                <div className="bg-zinc-800/50 rounded-xl p-4 mb-6 text-left">
                  <div className="flex items-center gap-2 text-zinc-400 mb-2">
                    <Film className="w-4 h-4" />
                    <span className="text-sm">Content</span>
                  </div>
                  <p className="font-semibold text-white mb-3">{celebrationData.title}</p>
                  
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-red-400" />
                      <span className="text-sm">{celebrationData.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-red-400" />
                      <span className="text-sm">{celebrationData.time}</span>
                    </div>
                  </div>
                </div>
                
                {/* Countdown Preview */}
                <div className="text-sm text-zinc-400 mb-6">
                  <Sparkles className="w-4 h-4 inline mr-1" />
                  A countdown will appear as your airtime approaches!
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-zinc-700 hover:bg-zinc-800"
                    onClick={() => setShowCelebrationModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500"
                    onClick={() => {
                      setShowCelebrationModal(false);
                      navigate('/watch');
                    }}
                  >
                    <Tv className="w-4 h-4 mr-2" />
                    Watch Live
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
