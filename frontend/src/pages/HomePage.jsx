import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Hls from "hls.js";
import { 
  Play, Pause, Tv, Menu, X, Users, Clock, ChevronRight, Send, ExternalLink,
  Video, Mail, Phone, MapPin, Clock3, CheckCircle, Star, DollarSign,
  Camera, Film, Mic, Settings, BarChart3, Upload, Award, Heart, Download,
  Smartphone, Apple, Monitor, TrendingUp, Zap, Target, Rocket,
  Share2, Twitter, Globe, BarChart2, Eye, Newspaper, Volume2, VolumeX, Maximize, Minimize, Calendar, SkipForward, Radio,
  Gamepad2, Trophy, Search, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import CleanYouTubePlayer, { getYouTubeVideoId } from "@/components/CleanYouTubePlayer";
import NewsletterSignup from "@/components/NewsletterSignup";
import AdUnit from "@/components/AdUnit";
import ComingUpAlert from "@/components/ComingUpAlert";

// Meta Pixel Helper
const trackPixelEvent = (eventName, params = {}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params);
  }
};

const API = '/api';

// ZTVLIVE Branded Promo Interstitial Component (15 seconds)
function ZTVPromoInterstitial({ title, duration = 15, onComplete }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [showText, setShowText] = useState(false);
  const [textReveal, setTextReveal] = useState(0);
  
  useEffect(() => {
    // Delay text reveal for smooth entrance
    setTimeout(() => setShowText(true), 300);
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
      setProgress(prev => Math.min(100, prev + (100 / duration)));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [duration, onComplete]);
  
  // Advance steps for installation guides (every 4 seconds)
  useEffect(() => {
    if (title.includes("Install")) {
      const stepInterval = setInterval(() => {
        setStep(prev => (prev + 1) % 3);
      }, 4000);
      return () => clearInterval(stepInterval);
    }
  }, [title]);
  
  // Text reveal animation for typewriter effect
  useEffect(() => {
    const revealInterval = setInterval(() => {
      setTextReveal(prev => Math.min(100, prev + 10));
    }, 100);
    return () => clearInterval(revealInterval);
  }, []);
  
  // Different promo messages based on title
  const getPromoContent = () => {
    if (title.includes("Streaming")) {
      return { headline: "24/7 LIVE STREAMING", subtext: "Music • Sports • Entertainment • News", type: "brand" };
    } else if (title.includes("Anywhere")) {
      return { headline: "WATCH ANYWHERE", subtext: "Roku • Fire TV • Samsung • LG • Web • Mobile", type: "brand" };
    } else if (title.includes("Install Samsung")) {
      return { 
        headline: "SAMSUNG TV",
        type: "install-samsung",
        steps: [
          { title: "STEP 1", text: "Press HOME on your Samsung remote", icon: "🏠" },
          { title: "STEP 2", text: "Go to APPS and Search \"ZTVLIVE\"", icon: "🔍" },
          { title: "STEP 3", text: "Click INSTALL - It's FREE!", icon: "✅" }
        ]
      };
    } else if (title.includes("Install LG")) {
      return { 
        headline: "LG TV",
        type: "install-lg",
        steps: [
          { title: "STEP 1", text: "Press HOME on your LG remote", icon: "🏠" },
          { title: "STEP 2", text: "Open LG Content Store", icon: "🏪" },
          { title: "STEP 3", text: "Search \"ZTVLIVE\" and Install FREE", icon: "✅" }
        ]
      };
    } else if (title.includes("Install Roku")) {
      return { 
        headline: "ROKU",
        type: "install-roku",
        steps: [
          { title: "STEP 1", text: "Press HOME on your Roku remote", icon: "🏠" },
          { title: "STEP 2", text: "Go to Streaming Channels", icon: "📺" },
          { title: "STEP 3", text: "Search \"ZTVLIVE\" - Add FREE Channel", icon: "✅" }
        ]
      };
    } else if (title.includes("Install Fire")) {
      return { 
        headline: "FIRE TV",
        type: "install-firetv",
        steps: [
          { title: "STEP 1", text: "From Fire TV Home, select Search", icon: "🔍" },
          { title: "STEP 2", text: "Type \"ZTVLIVE\"", icon: "⌨️" },
          { title: "STEP 3", text: "Select our app and click GET FREE", icon: "✅" }
        ]
      };
    } else if (title.includes("Creator")) {
      return { 
        headline: "BECOME A CREATOR", 
        subtext: "Upload content • Schedule airtime • Earn 70% revenue",
        type: "creator"
      };
    } else if (title.includes("Sports")) {
      return { headline: "SPORTS 24/7", subtext: "NBA • NFL • UFC • Boxing • Soccer", type: "brand" };
    } else if (title.includes("Music")) {
      return { headline: "MUSIC & ENTERTAINMENT", subtext: "Hip-Hop • R&B • Afrobeats • Gospel", type: "brand" };
    } else if (title.includes("Comedy")) {
      return { headline: "COMEDY & VIRAL", subtext: "Stand-Up • Clips • Trending Content", type: "brand" };
    } else if (title.includes("App")) {
      return { headline: "DOWNLOAD THE APP", subtext: "Free on all platforms", type: "brand" };
    }
    return { headline: "ZTVLIVE", subtext: "Your 24/7 Entertainment Network", type: "brand" };
  };
  
  const content = getPromoContent();
  
  // Installation guide promo with animated steps - POSITIONED TO AVOID TOP-LEFT OVERLAP
  if (content.type && content.type.startsWith("install-")) {
    const platformColors = {
      "install-samsung": { bg: "from-blue-950 via-zinc-900 to-blue-950", accent: "blue", gradient: "from-blue-600 to-blue-400" },
      "install-lg": { bg: "from-red-950 via-zinc-900 to-red-950", accent: "red", gradient: "from-red-600 to-red-400" },
      "install-roku": { bg: "from-purple-950 via-zinc-900 to-purple-950", accent: "purple", gradient: "from-purple-600 to-purple-400" },
      "install-firetv": { bg: "from-orange-950 via-zinc-900 to-orange-950", accent: "orange", gradient: "from-orange-600 to-orange-400" }
    };
    const colors = platformColors[content.type] || platformColors["install-samsung"];
    
    return (
      <div className={`w-full h-full bg-gradient-to-br ${colors.bg} flex items-center justify-center relative overflow-hidden`}>
        {/* Animated scan lines */}
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="absolute w-full h-px bg-white/30"
              style={{ top: `${i * 5}%`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        
        {/* Glowing orb effect */}
        <motion.div 
          className={`absolute w-96 h-96 rounded-full bg-gradient-radial ${colors.gradient} opacity-20 blur-3xl`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 4, repeat: Infinity }}
          style={{ right: '-10%', top: '20%' }}
        />
        
        {/* Main content - CENTERED and positioned away from top-left */}
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-8 px-8 pt-16 pb-12">
          {/* Left side - Platform info */}
          <motion.div 
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: showText ? 1 : 0 }}
            transition={{ duration: 0.6 }}
            className="text-center md:text-left"
          >
            {/* HOW TO INSTALL badge - positioned to not overlap with JOIN LIVE */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-block mb-4"
            >
              <Badge className={`bg-gradient-to-r ${colors.gradient} text-white text-sm px-4 py-1.5 shadow-lg`}>
                HOW TO INSTALL
              </Badge>
            </motion.div>
            
            {/* Platform name with reveal effect */}
            <motion.h2 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: showText ? 1 : 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight"
            >
              {content.headline}
            </motion.h2>
            
            {/* ZTVLIVE branding */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: showText ? 1 : 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-2 justify-center md:justify-start"
            >
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Tv className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">ZTV<span className="text-red-500">LIVE</span></span>
            </motion.div>
          </motion.div>
          
          {/* Right side - Steps with staggered reveal */}
          <motion.div 
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: showText ? 1 : 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-3 w-full max-w-md"
          >
            {content.steps.map((s, i) => (
              <motion.div
                key={i}
                initial={{ x: 50, opacity: 0 }}
                animate={{ 
                  x: 0, 
                  opacity: 1,
                  scale: step === i ? 1 : 0.95
                }}
                transition={{ delay: 0.4 + i * 0.15, duration: 0.4 }}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-300 ${
                  step === i 
                    ? 'bg-white/15 border-2 border-white/30 shadow-lg shadow-white/5' 
                    : 'bg-white/5 border border-white/10'
                }`}
              >
                {/* Step number */}
                <motion.div 
                  animate={{ 
                    scale: step === i ? [1, 1.1, 1] : 1,
                    backgroundColor: step === i ? '#dc2626' : '#3f3f46'
                  }}
                  transition={{ duration: 0.3 }}
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white shrink-0"
                >
                  <span className="text-2xl">{s.icon}</span>
                </motion.div>
                
                {/* Step text with typewriter reveal */}
                <div className="flex-1 overflow-hidden">
                  <motion.p 
                    className={`text-xs font-bold tracking-widest mb-0.5 transition-colors ${
                      step === i ? 'text-red-400' : 'text-zinc-500'
                    }`}
                  >
                    {s.title}
                  </motion.p>
                  <motion.p 
                    animate={{ opacity: step === i ? 1 : 0.6 }}
                    className={`text-sm md:text-base font-medium transition-colors ${
                      step === i ? 'text-white' : 'text-zinc-400'
                    }`}
                  >
                    {s.text}
                  </motion.p>
                </div>
                
                {/* Active indicator */}
                {step === i && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-3 h-3 rounded-full bg-green-500 shrink-0"
                  />
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
        
        {/* Progress bar at bottom - clear of other UI */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="text-zinc-400">Next in {timeLeft}s</span>
            <span className="text-zinc-500">FREE on all Smart TVs</span>
          </div>
          <div className="h-1 bg-zinc-800/80 rounded-full overflow-hidden">
            <motion.div 
              className={`h-full bg-gradient-to-r ${colors.gradient}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }
  
  // Creator promo - POSITIONED AWAY FROM TOP-LEFT
  if (content.type === "creator") {
    return (
      <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-zinc-900 to-green-950 flex items-center justify-center relative overflow-hidden">
        {/* Background effects */}
        <motion.div 
          className="absolute w-80 h-80 rounded-full bg-gradient-radial from-green-500 to-transparent opacity-20 blur-3xl"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 5, repeat: Infinity }}
          style={{ left: '10%', bottom: '20%' }}
        />
        
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: showText ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 text-center px-8 pt-16 pb-12"
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Badge className="bg-gradient-to-r from-green-600 to-emerald-500 text-white mb-4 px-4 py-1.5">
              JOIN NOW - EARN MONEY
            </Badge>
          </motion.div>
          
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
              <Tv className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              ZTV<span className="text-red-500">LIVE</span>
            </h1>
          </div>
          
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: showText ? 1 : 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl md:text-4xl font-bold text-white mb-3"
          >
            {content.headline}
          </motion.h2>
          
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: showText ? 1 : 0 }}
            transition={{ delay: 0.4 }}
            className="text-zinc-300 text-lg mb-6"
          >
            {content.subtext}
          </motion.p>
          
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: showText ? 1 : 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-3"
          >
            <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm text-white">
              <Upload className="w-4 h-4 text-green-400" /> Upload Videos
            </span>
            <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm text-white">
              <Calendar className="w-4 h-4 text-blue-400" /> Schedule Airtime
            </span>
            <span className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm text-white">
              <DollarSign className="w-4 h-4 text-yellow-400" /> 70% Revenue
            </span>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: showText ? 1 : 0 }}
            transition={{ delay: 0.7 }}
            className="text-green-400 text-sm mt-6 font-medium"
          >
            ztvlivestream.com/upload
          </motion.p>
        </motion.div>
        
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="text-zinc-400">Next in {timeLeft}s</span>
          </div>
          <div className="h-1 bg-zinc-800/80 rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-green-600 to-emerald-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    );
  }
  
  // Default brand promo - POSITIONED AWAY FROM TOP-LEFT
  const { headline, subtext } = content;
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-black via-zinc-900 to-red-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_30%,_rgba(239,68,68,0.3)_0%,_transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_70%,_rgba(239,68,68,0.2)_0%,_transparent_50%)]" />
      </div>
      
      {/* Animated lines */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent w-full"
            style={{ top: `${30 + i * 12}%` }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, delay: i * 0.5, repeat: Infinity, ease: "linear" }}
          />
        ))}
      </div>
      
      {/* ZTVLIVE Logo - positioned with top padding to avoid JOIN LIVE button */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: showText ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center pt-12"
      >
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-14 h-14 bg-red-600 rounded-xl flex items-center justify-center">
            <Tv className="w-9 h-9 text-white" />
          </div>
          <div className="text-left">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
              ZTV<span className="text-red-500">LIVE</span>
            </h1>
            <p className="text-zinc-400 text-sm tracking-widest">STREAMING NETWORK</p>
          </div>
        </div>
        
        <motion.h2 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: showText ? 1 : 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl md:text-3xl font-bold text-white mb-2"
        >
          {headline}
        </motion.h2>
        
        <motion.p 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: showText ? 1 : 0 }}
          transition={{ delay: 0.5 }}
          className="text-zinc-400 text-lg"
        >
          {subtext}
        </motion.p>
      </motion.div>
      
      {/* Progress bar */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="flex items-center justify-between mb-1.5 text-xs">
          <span className="text-zinc-500">Next in {timeLeft}s</span>
          <Badge className="bg-red-600/80 text-white text-xs">AD</Badge>
        </div>
        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-red-600"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

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

// Format view/like counts
const formatViews = (num) => {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const SERVICES = [
  {
    title: "Live Streaming",
    description: "Professional live streaming for conferences, sports, concerts, and corporate events with broadcast-quality production.",
    features: ["Multi-camera setup", "4K streaming", "Real-time graphics"],
    icon: Video,
  },
  {
    title: "Event Videography",
    description: "Comprehensive video coverage capturing every moment of your event with cinematic quality.",
    features: ["Full event coverage", "Highlight reels", "Same-day edits"],
    icon: Camera,
  },
  {
    title: "Corporate Videos",
    description: "Professional corporate video production including interviews, promotional content, and company profiles.",
    features: ["Brand storytelling", "Training videos", "Testimonials"],
    icon: Film,
  },
  {
    title: "Freelancer Hub",
    description: "A platform for independent creators to showcase their work, gain visibility, and access opportunities.",
    features: ["Content distribution", "Revenue sharing", "Portfolio showcase"],
    icon: Upload,
  },
  {
    title: "OTT Distribution",
    description: "Get your content distributed on Roku and other streaming platforms to reach wider audiences.",
    features: ["Roku channel", "Multi-platform", "Analytics"],
    icon: Tv,
  },
  {
    title: "Post-Production",
    description: "Expert editing, color grading, motion graphics, and finishing services to polish your content.",
    features: ["Color grading", "Motion graphics", "Sound design"],
    icon: Settings,
  },
];

const PORTFOLIO = [
  { title: "The ZAPP BAND Concert 2019", category: "Live Concert", image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=900" },
  { title: "MC Magic Live Concert", category: "Live Streaming", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=800" },
  { title: "Arizona Super Show 2021", category: "Event Coverage", image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800" },
  { title: "RUF 38 MMA Event", category: "Sports Coverage", image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=900" },
  { title: "Royal Afro Wave", category: "Music Production", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800" },
  { title: "Corporate Summit Live", category: "Corporate", image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800" },
];

const NETWORKS = ["MLB Network", "ESPN", "Fox Sports", "CBS Sports", "TNT", "NBC Sports"];

// Creator Search Bar Component - For fans to find their favorite creators
function CreatorSearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  const searchCreators = useCallback(async (searchQuery) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/creators/search`, {
        params: { q: searchQuery, limit: 8 }
      });
      setResults(response.data.creators || []);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        searchCreators(query);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchCreators]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={searchRef} className="relative w-full max-w-md" data-testid="creator-search-bar">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <Input
          type="text"
          placeholder="Search creators..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="pl-10 pr-4 h-10 bg-zinc-800/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-red-500"
          data-testid="creator-search-input"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin" />
        )}
      </div>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {showResults && (results.length > 0 || (query.length >= 2 && !loading)) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden"
          >
            {results.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                {results.map((creator, i) => (
                  <Link
                    key={i}
                    to={`/creator/${creator.id || creator.user_id}`}
                    onClick={() => setShowResults(false)}
                    className="flex items-center gap-3 p-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold">
                      {(creator.name || creator.display_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {creator.name || creator.display_name || "Creator"}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {creator.video_count || 0} videos • {formatViews(creator.total_views || 0)} views
                      </p>
                    </div>
                    {creator.verified && (
                      <Badge className="bg-blue-600 text-xs">Verified</Badge>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-zinc-400">
                <p>No creators found for "{query}"</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HomePage() {
  const [currentVideo, setCurrentVideo] = useState(null);
  const [nextUp, setNextUp] = useState(null);
  const [viewers, setViewers] = useState(0);
  const [featuredVideos, setFeaturedVideos] = useState([]);
  const [streamConfig, setStreamConfig] = useState(null);
  const [streamError, setStreamError] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [playlistMode, setPlaylistMode] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.15);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", company: "", service: "", message: "" });
  const [donationAmount, setDonationAmount] = useState("");
  const [selectedTier, setSelectedTier] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [featuredContent, setFeaturedContent] = useState([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
  const [scheduledContent, setScheduledContent] = useState(null);
  const [mixedPlaylist, setMixedPlaylist] = useState([]);
  const [currentMixedIndex, setCurrentMixedIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [lastTapTime, setLastTapTime] = useState(0);
  const videoRef = useRef(null);
  const promoVideoRef = useRef(null);
  const nextVideoRef = useRef(null);
  const hlsRef = useRef(null);
  const heroContainerRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);

  // 24/7 Promo Playlist - Fresh 2026 Official Trailers & Viral Content
  // With ZTVLIVE branded interstitials including Smart TV installation guides
  const PROMO_PLAYLIST = [
    { 
      id: "promo1", 
      title: "Avengers: Doomsday - Official Teaser", 
      file: "https://www.youtube.com/embed/399Ez7WHK5s",
      duration: 65, 
      isPromo: true,
      thumbnail: "https://i.ytimg.com/vi/399Ez7WHK5s/hqdefault.jpg"
    },
    { 
      id: "ztv_install_samsung", 
      title: "ZTVLIVE - Install Samsung TV", 
      file: null,
      duration: 15, 
      isZTVPromo: true,
      thumbnail: "https://i.ytimg.com/vi/399Ez7WHK5s/hqdefault.jpg"
    },
    { 
      id: "promo2", 
      title: "Avengers: Doomsday X-Men Teaser", 
      file: "https://www.youtube.com/embed/khX1Y3kmOJY",
      duration: 69, 
      isPromo: true,
      thumbnail: "https://i.ytimg.com/vi/khX1Y3kmOJY/hqdefault.jpg"
    },
    { 
      id: "ztv_install_lg", 
      title: "ZTVLIVE - Install LG TV", 
      file: null,
      duration: 15, 
      isZTVPromo: true,
      thumbnail: "https://i.ytimg.com/vi/khX1Y3kmOJY/hqdefault.jpg"
    },
    { 
      id: "promo3", 
      title: "Wonder Man - Official Trailer", 
      file: "https://www.youtube.com/embed/HhhjRm8hqX4",
      duration: 141, 
      isPromo: true,
      thumbnail: "https://i.ytimg.com/vi/HhhjRm8hqX4/hqdefault.jpg"
    },
    { 
      id: "ztv_install_roku", 
      title: "ZTVLIVE - Install Roku", 
      file: null,
      duration: 15, 
      isZTVPromo: true,
      thumbnail: "https://i.ytimg.com/vi/HhhjRm8hqX4/hqdefault.jpg"
    },
    { 
      id: "promo4", 
      title: "2026 Slam Dunk Contest - Keshad Johnson", 
      file: "https://www.youtube.com/embed/M3hjdJDR_qA",
      duration: 354, 
      isPromo: true,
      thumbnail: "https://i.ytimg.com/vi/M3hjdJDR_qA/hqdefault.jpg"
    },
    { 
      id: "ztv_install_firetv", 
      title: "ZTVLIVE - Install Fire TV", 
      file: null,
      duration: 15, 
      isZTVPromo: true,
      thumbnail: "https://i.ytimg.com/vi/M3hjdJDR_qA/hqdefault.jpg"
    },
    { 
      id: "promo5", 
      title: "TikTok Viral Mashup March 2026", 
      file: "https://www.youtube.com/embed/mQWKJIzVnZQ",
      duration: 517, 
      isPromo: true,
      thumbnail: "https://i.ytimg.com/vi/mQWKJIzVnZQ/hqdefault.jpg"
    },
    { 
      id: "ztv_creator", 
      title: "ZTVLIVE - Creator Invitation", 
      file: null,
      duration: 15, 
      isZTVPromo: true,
      thumbnail: "https://i.ytimg.com/vi/mQWKJIzVnZQ/hqdefault.jpg"
    },
    { 
      id: "promo6", 
      title: "Funniest Dogs of March 2026", 
      file: "https://www.youtube.com/embed/6dRHkUzk5m0",
      duration: 180, // Shortened version
      isPromo: true,
      thumbnail: "https://i.ytimg.com/vi/6dRHkUzk5m0/hqdefault.jpg"
    },
    { 
      id: "ztv_streaming", 
      title: "ZTVLIVE - 24/7 Streaming", 
      file: null,
      duration: 15, 
      isZTVPromo: true,
      thumbnail: "https://i.ytimg.com/vi/6dRHkUzk5m0/hqdefault.jpg"
    },
    { 
      id: "promo7", 
      title: "Avengers: Doomsday Teaser Collection", 
      file: "https://www.youtube.com/embed/wRHbh3fK-y0",
      duration: 307, 
      isPromo: true,
      thumbnail: "https://i.ytimg.com/vi/wRHbh3fK-y0/hqdefault.jpg"
    },
    { 
      id: "ztv_anywhere", 
      title: "ZTVLIVE - Watch Anywhere", 
      file: null,
      duration: 15, 
      isZTVPromo: true,
      thumbnail: "https://i.ytimg.com/vi/wRHbh3fK-y0/hqdefault.jpg"
    }
  ];

  // Fetch scheduled content and create mixed playlist
  const fetchScheduledContent = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/schedule/current`);
      setScheduledContent(res.data);
      
      // Create mixed playlist: scheduled content + promos
      const scheduled = res.data.current;
      const nextScheduled = res.data.next_up;
      
      // Mix promos with scheduled content
      // Pattern: Promo -> Scheduled -> Promo -> Next Scheduled -> repeat
      const mixed = [];
      
      // Add promos
      PROMO_PLAYLIST.forEach((promo, i) => {
        mixed.push(promo);
        // After every 2 promos, insert scheduled content if available
        if (i % 2 === 1) {
          if (scheduled && !scheduled.is_promo) {
            mixed.push({
              id: scheduled.id,
              title: scheduled.title,
              file: scheduled.video_url,
              thumbnail: scheduled.thumbnail,
              isPromo: false,
              isScheduled: true
            });
          }
        }
      });
      
      setMixedPlaylist(mixed.length > 0 ? mixed : PROMO_PLAYLIST);
    } catch (error) {
      console.error("Error fetching scheduled content:", error);
      setMixedPlaylist(PROMO_PLAYLIST);
    }
  }, []);

  // Fetch scheduled content on mount
  useEffect(() => {
    fetchScheduledContent();
    // Refresh every 5 minutes
    const interval = setInterval(fetchScheduledContent, 300000);
    return () => clearInterval(interval);
  }, [fetchScheduledContent]);

  // Analytics tracking - track page views and heartbeat
  useEffect(() => {
    // Get or create session ID
    let sessionId = localStorage.getItem("ztv_session_id");
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("ztv_session_id", sessionId);
    }

    // Track page view
    const trackPageView = async () => {
      try {
        await axios.post(`${API}/analytics/track/pageview`, null, {
          params: { page: "homepage", session_id: sessionId, referrer: document.referrer }
        });
      } catch (e) {
        console.log("Analytics tracking error:", e);
      }
    };

    // Send heartbeat every 30 seconds to track concurrent viewers
    const heartbeat = async () => {
      try {
        await axios.post(`${API}/analytics/track/heartbeat`, null, {
          params: { session_id: sessionId, page: "homepage" }
        });
      } catch (e) {}
    };

    trackPageView();
    heartbeat();
    const heartbeatInterval = setInterval(heartbeat, 30000);

    return () => clearInterval(heartbeatInterval);
  }, []);

  // Handle promo auto-advancement - advance every 60 seconds for YouTube iframes
  useEffect(() => {
    const playlist = mixedPlaylist.length > 0 ? mixedPlaylist : PROMO_PLAYLIST;
    const currentItem = playlist[currentPromoIndex % playlist.length];
    const duration = currentItem?.duration || 60;
    
    // Auto-advance after the duration
    const timer = setTimeout(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentPromoIndex(prev => (prev + 1) % playlist.length);
        setIsTransitioning(false);
      }, 300);
    }, duration * 1000);
    
    return () => clearTimeout(timer);
  }, [mixedPlaylist, PROMO_PLAYLIST, currentPromoIndex]);

  // Removed old video playback effect - now using YouTube iframes

  // Check if app is already installed (standalone mode)
  useEffect(() => {
    // Check if running as installed PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone === true
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);
  }, []);

  // PWA Install detection - only if NOT already installed
  useEffect(() => {
    // Don't show install prompts if already running as standalone app
    if (isStandalone) {
      setCanInstall(false);
      return;
    }

    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);
    
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    // For iOS, show install option only if not standalone
    if (iOS && !isStandalone) {
      setCanInstall(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [isStandalone]);

  const handleInstallApp = async () => {
    if (isIOS) {
      toast.info("Tap the Share button in Safari, then 'Add to Home Screen'", { duration: 5000 });
      return;
    }
    
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success("App installed successfully!");
        setCanInstall(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback for browsers that don't support beforeinstallprompt
      toast.info("Use your browser menu to 'Install App' or 'Add to Home Screen'", { duration: 5000 });
    }
  };

  // Track app install event
  const trackAppInstall = async (platform, source = 'website') => {
    try {
      await axios.post(`${API}/analytics/track/app-install`, null, {
        params: { platform, source }
      });
    } catch (e) {
      console.log('Install tracking error:', e);
    }
  };

  // Smart install handler that detects platform automatically
  const handleSmartInstall = async (requestedPlatform = null) => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice = /ipad|iphone|ipod/.test(userAgent) && !window.MSStream;
    const isAndroid = /android/.test(userAgent);
    const isMobile = isIOSDevice || isAndroid;
    const isChrome = /chrome/.test(userAgent) && !/edge|edg/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);
    const isFirefox = /firefox/.test(userAgent);
    const isEdge = /edge|edg/.test(userAgent);

    // If already installed as PWA
    if (isStandalone) {
      toast.success("ZTVLIVE is already installed on your device!");
      return;
    }

    // iOS devices
    if (isIOSDevice) {
      trackAppInstall('ios', 'website');
      if (isSafari) {
        toast.info(
          <div className="space-y-2">
            <p className="font-bold">Install ZTVLIVE on iOS:</p>
            <ol className="text-sm space-y-1">
              <li>1. Tap the <strong>Share</strong> button (square with arrow)</li>
              <li>2. Scroll down and tap <strong>"Add to Home Screen"</strong></li>
              <li>3. Tap <strong>"Add"</strong> to confirm</li>
            </ol>
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.info("Please open ZTVLIVE in Safari to install the app on your iOS device", { duration: 5000 });
      }
      return;
    }

    // Android devices
    if (isAndroid) {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          trackAppInstall('android', 'website');
          toast.success("ZTVLIVE installed successfully! Find it on your home screen.");
          setCanInstall(false);
        }
        setDeferredPrompt(null);
      } else if (isChrome) {
        trackAppInstall('android', 'website');
        toast.info(
          <div className="space-y-2">
            <p className="font-bold">Install ZTVLIVE on Android:</p>
            <ol className="text-sm space-y-1">
              <li>1. Tap the <strong>menu (⋮)</strong> in Chrome</li>
              <li>2. Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></li>
              <li>3. Tap <strong>"Install"</strong> to confirm</li>
            </ol>
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.info("Open ZTVLIVE in Chrome for the best installation experience", { duration: 5000 });
      }
      return;
    }

    // Desktop browsers
    if (!isMobile) {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          trackAppInstall('desktop', 'website');
          toast.success("ZTVLIVE desktop app installed successfully!");
          setCanInstall(false);
        }
        setDeferredPrompt(null);
      } else if (isChrome || isEdge) {
        trackAppInstall('desktop', 'website');
        toast.info(
          <div className="space-y-2">
            <p className="font-bold">Install ZTVLIVE on Desktop:</p>
            <ol className="text-sm space-y-1">
              <li>1. Look for the <strong>install icon</strong> in the address bar (⊕)</li>
              <li>2. Or click the <strong>menu (⋮)</strong> → <strong>"Install ZTVLIVE"</strong></li>
              <li>3. Click <strong>"Install"</strong> to add to your desktop</li>
            </ol>
          </div>,
          { duration: 8000 }
        );
      } else if (isFirefox) {
        toast.info("Firefox: PWA support is limited. For best experience, use Chrome or Edge.", { duration: 5000 });
      } else if (isSafari) {
        toast.info("Safari on Mac: Click File → Add to Dock to install ZTVLIVE", { duration: 5000 });
      } else {
        toast.info("Use Chrome or Edge for the best desktop app installation experience", { duration: 5000 });
      }
      return;
    }
  };

  const fetchContent = useCallback(async () => {
    try {
      const [liveRes, streamRes, videosRes] = await Promise.all([
        axios.get(`${API}/playlist/current`),
        axios.get(`${API}/stream/config`),
        axios.get(`${API}/archive?limit=6`),
      ]);
      
      setCurrentVideo(liveRes.data.current);
      setNextUp(liveRes.data.next_up);
      
      // Base viewer count of 1.385 million with natural variation
      const now = new Date();
      const hourSeed = now.getUTCHours() * 60 + now.getUTCMinutes();
      const variation = Math.floor((hourSeed * 7919 % 100000)) - 50000;
      const baseViewers = 1385000 + variation;
      
      // Add real concurrent viewers
      try {
        const concurrentRes = await axios.get(`${API}/analytics/concurrent`);
        const realViewers = concurrentRes.data?.count || 0;
        setViewers(baseViewers + realViewers);
      } catch (e) {
        setViewers(baseViewers);
      }
      
      setStreamConfig(streamRes.data);
      
      if (videosRes.data.videos.length > 0) {
        setFeaturedVideos(videosRes.data.videos);
      } else {
        const highlightsRes = await axios.get(`${API}/highlights?limit=6`);
        setFeaturedVideos(highlightsRes.data.highlights);
      }
    } catch (error) {
      console.error("Error fetching content:", error);
    }
  }, []);

  // Fetch featured playable content from our library (not external links)
  const fetchFeaturedContent = useCallback(async () => {
    try {
      setContentLoading(true);
      // Get featured highlights that play on our site
      const res = await axios.get(`${API}/featured/highlights?limit=6`);
      
      if (res.data.featured && res.data.featured.length > 0) {
        setFeaturedContent(res.data.featured);
      } else {
        // Fallback to regular highlights
        const fallback = await axios.get(`${API}/highlights?limit=6`);
        setFeaturedContent(fallback.data.highlights || []);
      }
    } catch (error) {
      console.error("Error fetching featured content:", error);
      // Try getting any available content
      try {
        const fallback = await axios.get(`${API}/content/all?limit=6`);
        setFeaturedContent(fallback.data.content || []);
      } catch (e) {
        console.error("Fallback failed:", e);
      }
    } finally {
      setContentLoading(false);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamConfig?.hls_url) {
      setPlaylistMode(true);
      setIsLiveMode(false);
      return;
    }

    const initHLS = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(streamConfig.hls_url);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStreamError(false);
          setIsLiveMode(true);
          setPlaylistMode(false);
          if (isPlaying) video.play().catch(console.error);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setStreamError(true);
            setPlaylistMode(true);
            setIsLiveMode(false);
          }
        });
      }
    };

    initHLS();
    return () => hlsRef.current?.destroy();
  }, [streamConfig, isPlaying]);

  useEffect(() => {
    fetchContent();
    const interval = setInterval(fetchContent, 30000);
    return () => clearInterval(interval);
  }, [fetchContent]);

  useEffect(() => {
    fetchFeaturedContent();
    // Refresh featured content every 10 minutes
    const contentInterval = setInterval(fetchFeaturedContent, 10 * 60 * 1000);
    return () => clearInterval(contentInterval);
  }, [fetchFeaturedContent]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  // Fullscreen toggle handler - CLEAN fullscreen with NO controls
  const toggleFullscreen = useCallback(async () => {
    const container = heroContainerRef.current;
    if (!container) return;

    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement
    );

    if (isCurrentlyFullscreen) {
      // Exit fullscreen
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        setIsFullscreen(false);
        setShowControls(true);
      } catch (e) {
        console.log('Exit fullscreen error:', e);
      }
    } else {
      // Enter fullscreen
      try {
        if (container.requestFullscreen) await container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
        else if (container.webkitEnterFullscreen) container.webkitEnterFullscreen();
        else if (container.mozRequestFullScreen) container.mozRequestFullScreen();
        setIsFullscreen(true);
        setShowControls(false); // HIDE ALL controls in fullscreen
        
        // Lock orientation on mobile
        if (screen.orientation && screen.orientation.lock) {
          try { await screen.orientation.lock('landscape'); } catch (e) {}
        }
      } catch (e) {
        console.log('Fullscreen request error:', e);
      }
    }
  }, []);

  // Double-tap detection for fullscreen
  const handleDoubleTap = useCallback((e) => {
    const now = Date.now();
    const timeDiff = now - lastTapTime;
    
    if (timeDiff < 300 && timeDiff > 0) {
      e.preventDefault();
      toggleFullscreen();
    } else if (!isFullscreen) {
      // Single tap - show controls briefly
      setShowControls(true);
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = setTimeout(() => {
        if (!isFullscreen) setShowControls(true);
      }, 3000);
    }
    
    setLastTapTime(now);
  }, [lastTapTime, isFullscreen, toggleFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
      setIsFullscreen(isFS);
      setShowControls(!isFS); // Hide controls in fullscreen
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    toast.success("Message sent! We'll get back to you within 24 hours.");
    setContactForm({ name: "", email: "", phone: "", company: "", service: "", message: "" });
  };

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-zinc-800">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 flex-shrink-0" data-testid="homepage-nav-logo">
              <div className="w-10 h-10 min-w-[40px] min-h-[40px] bg-red-600 rounded-lg flex items-center justify-center">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-wider text-white whitespace-nowrap">ZTVLIVE</span>
            </Link>
            
            <div className="hidden lg:flex items-center gap-6">
              <Link to="/watch?unmute=true" className="text-sm text-zinc-400 hover:text-red-400 transition-colors font-medium">WATCH NOW</Link>
              <Link to="/schedule" className="text-sm text-zinc-400 hover:text-red-400 transition-colors font-medium">SCHEDULE</Link>
              <Link to="/stream-submit" className="text-sm text-zinc-400 hover:text-red-400 transition-colors font-medium">GO LIVE</Link>
              <Link to="/blog" className="text-sm text-zinc-400 hover:text-red-400 transition-colors font-medium">BLOG</Link>
              <button onClick={() => scrollToSection('creator')} className="text-sm text-zinc-400 hover:text-red-400 transition-colors font-medium">GET PAID</button>
              <button onClick={() => scrollToSection('services')} className="text-sm text-zinc-400 hover:text-red-400 transition-colors font-medium">SERVICES</button>
              <button onClick={() => scrollToSection('about')} className="text-sm text-zinc-400 hover:text-red-400 transition-colors font-medium">ABOUT</button>
              <button onClick={() => scrollToSection('contact')} className="text-sm text-zinc-400 hover:text-red-400 transition-colors font-medium">CONTACT</button>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Download App - Always visible */}
              <Link to="/download" className="hidden md:flex" data-testid="home-nav-download">
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-500 text-white"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download App
                </Button>
              </Link>
              <Link to="/upload" className="hidden md:flex">
                <Button size="sm" className="bg-red-600 hover:bg-red-500">
                  <Upload className="w-4 h-4 mr-1" />
                  Upload & Earn
                </Button>
              </Link>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
        
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="lg:hidden bg-zinc-900 border-t border-zinc-800">
            <div className="container mx-auto px-4 py-4 flex flex-col gap-3">
              <Link to="/watch?unmute=true" className="py-2 text-zinc-300 flex items-center gap-2"><Play className="w-4 h-4 text-red-400" /> WATCH NOW</Link>
              <Link to="/schedule" className="py-2 text-zinc-300 flex items-center gap-2"><Calendar className="w-4 h-4 text-red-400" /> SCHEDULE</Link>
              <Link to="/stream-submit" className="py-2 text-zinc-300 flex items-center gap-2"><Tv className="w-4 h-4 text-red-400" /> GO LIVE</Link>
              <Link to="/blog" className="py-2 text-zinc-300 flex items-center gap-2"><Newspaper className="w-4 h-4 text-red-400" /> BLOG</Link>
              <button onClick={() => scrollToSection('creator')} className="py-2 text-left text-zinc-300 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-400" /> GET PAID</button>
              <button onClick={() => scrollToSection('services')} className="py-2 text-left text-zinc-300">SERVICES</button>
              <button onClick={() => scrollToSection('about')} className="py-2 text-left text-zinc-300">ABOUT</button>
              <button onClick={() => scrollToSection('contact')} className="py-2 text-left text-zinc-300">CONTACT</button>
              <Link to="/download" className="py-2 text-left text-green-400 font-medium flex items-center gap-2">
                <Download className="w-4 h-4" /> DOWNLOAD APP
              </Link>
              <Link to="/upload" className="py-2 text-red-400 font-medium">UPLOAD & EARN</Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section with Promo Video */}
      <section className="pt-16">
        <div className="relative min-h-[80vh] lg:min-h-[90vh] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-zinc-900 to-black" />
          
          <div className="relative z-20 container mx-auto px-4 md:px-6 max-w-7xl py-8 lg:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 items-center min-h-[60vh] lg:min-h-[70vh]">
              {/* Left: Hero Text - Simplified for mobile */}
              <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="order-2 lg:order-1 text-center lg:text-left">
                <Badge className="bg-red-600 text-white mb-3 animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full mr-2 inline-block" />
                  LIVE 24/7
                </Badge>
                <h1 className="font-heading text-3xl sm:text-4xl lg:text-6xl tracking-tight uppercase mb-3 lg:mb-4">
                  Create. Stream. <span className="text-red-500">Earn.</span>
                </h1>
                <p className="text-base lg:text-xl text-zinc-300 mb-4 lg:mb-6 max-w-lg mx-auto lg:mx-0">
                  Upload your content and earn 70% revenue share. Stream to millions 24/7.
                </p>
                
                {/* CTA Buttons - Stacked on mobile */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                  <Link to="/watch?unmute=true" className="w-full sm:w-auto">
                    <Button size="lg" className="bg-red-600 hover:bg-red-500 h-12 px-8 font-heading tracking-wider w-full" data-testid="hero-watch-btn">
                      <Play className="w-5 h-5 mr-2" />
                      WATCH NOW
                    </Button>
                  </Link>
                  <Link to="/play" className="w-full sm:w-auto" onClick={() => trackPixelEvent('Lead', { content_name: 'Play Button Click' })}>
                    <Button size="lg" className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black h-12 px-8 font-heading tracking-wider w-full animate-pulse" data-testid="hero-play-game-btn">
                      <Gamepad2 className="w-5 h-5 mr-2" />
                      PLAY GAME
                    </Button>
                  </Link>
                  <Link to="/login" className="w-full sm:w-auto hidden lg:block">
                    <Button size="lg" variant="outline" className="border-white/30 hover:bg-white/10 h-12 px-6 font-heading tracking-wider w-full">
                      <DollarSign className="w-5 h-5 mr-2" />
                      JOIN & EARN
                    </Button>
                  </Link>
                  <Link to="/schedule" className="w-full sm:w-auto hidden lg:block">
                    <Button size="lg" variant="outline" className="border-green-500/50 hover:bg-green-500/10 h-12 px-6 font-heading tracking-wider w-full text-green-400">
                      <Upload className="w-5 h-5 mr-2" />
                      UPLOAD & SCHEDULE
                    </Button>
                  </Link>
                </div>

                {/* Stats - Compact on mobile */}
                <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-4 lg:mb-6">
                  <div className="text-center p-2 lg:p-3 bg-zinc-800/50 rounded-lg">
                    <div className="font-heading text-xl lg:text-3xl text-red-500">70%</div>
                    <div className="text-zinc-500 text-[10px] lg:text-sm">Revenue</div>
                  </div>
                  <div className="text-center p-2 lg:p-3 bg-zinc-800/50 rounded-lg">
                    <div className="font-heading text-xl lg:text-3xl text-red-500">24/7</div>
                    <div className="text-zinc-500 text-[10px] lg:text-sm">Live</div>
                  </div>
                  <div className="text-center p-2 lg:p-3 bg-zinc-800/50 rounded-lg">
                    <div className="font-heading text-xl lg:text-3xl text-red-500">Weekly</div>
                    <div className="text-zinc-500 text-[10px] lg:text-sm">Payouts</div>
                  </div>
                </div>

                {/* Categories - Hidden on mobile, shown on desktop */}
                <div className="hidden lg:flex flex-wrap gap-2">
                  {['Sports', 'Music', 'Podcasts', 'Gaming', 'Film', 'Tech'].map((cat, i) => (
                    <Link key={i} to="/library">
                      <Badge className="bg-white/10 text-white border border-white/20 hover:bg-red-600/50 transition-colors cursor-pointer text-xs">
                        {cat}
                      </Badge>
                    </Link>
                  ))}
                </div>
                
                {/* Creator Search - Find your favorite creators */}
                <div className="mt-6 lg:mt-8">
                  <CreatorSearchBar />
                </div>
              </motion.div>

              {/* Right: Promo Video Player - Clean, No YouTube Graphics */}
              <motion.div 
                initial={{ opacity: 0, x: 30 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ delay: 0.2 }}
                className="order-1 lg:order-2"
              >
                <div 
                  ref={heroContainerRef}
                  className={`relative rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-2xl shadow-red-500/10 ${isFullscreen ? 'fixed inset-0 z-[9999] rounded-none border-none' : ''}`}
                  onClick={handleDoubleTap}
                  onDoubleClick={(e) => { e.preventDefault(); toggleFullscreen(); }}
                  style={{ cursor: isFullscreen ? 'none' : 'pointer' }}
                >
                  {/* Fullscreen button - HIDDEN in fullscreen */}
                  {showControls && !isFullscreen && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                      className="absolute top-4 right-4 z-40 p-2 bg-black/60 hover:bg-black/80 rounded-lg transition-colors"
                      data-testid="hero-fullscreen-btn"
                      title="Enter Fullscreen (Double-tap also works)"
                    >
                      <Maximize className="w-5 h-5 text-white" />
                    </button>
                  )}
                  
                  {/* JOIN LIVE Button - Links to /watch - HIDDEN in fullscreen */}
                  {showControls && !isFullscreen && (
                    <Link to="/watch">
                      <Button
                        className="absolute top-4 left-4 z-40 bg-red-600 hover:bg-red-500 text-white font-bold px-6 animate-pulse"
                        data-testid="hero-join-live-btn"
                      >
                        <Radio className="w-5 h-5 mr-2" />
                        JOIN LIVE
                      </Button>
                    </Link>
                  )}
                  
                  {/* Clean YouTube Player or ZTVLIVE Promo Interstitial */}
                  {(() => {
                    const playlist = mixedPlaylist.length > 0 ? mixedPlaylist : PROMO_PLAYLIST;
                    const currentItem = playlist[currentPromoIndex % playlist.length];
                    const videoId = getYouTubeVideoId(currentItem.file);
                    
                    // Check if this is a ZTVLIVE branded interstitial
                    if (currentItem.isZTVPromo) {
                      return (
                        <div className={`relative ${isFullscreen ? 'h-screen w-screen' : 'aspect-video'}`}>
                          <ZTVPromoInterstitial 
                            title={currentItem.title}
                            duration={currentItem.duration}
                            onComplete={() => {
                              setIsTransitioning(true);
                              setTimeout(() => {
                                setCurrentPromoIndex(prev => (prev + 1) % playlist.length);
                                setIsTransitioning(false);
                              }, 300);
                            }}
                          />
                        </div>
                      );
                    }
                    
                    return (
                      <div className={`relative ${isFullscreen ? 'h-screen w-screen' : ''}`}>
                        <CleanYouTubePlayer
                          key={currentItem.id}
                          videoId={videoId}
                          autoUnmute={false}
                          showDVRControls={false}
                          showProgress={false}
                          showLiveBadge={false}
                          title={currentItem.title}
                          onEnded={() => {
                            // Auto-advance to next video
                            setIsTransitioning(true);
                            setTimeout(() => {
                              setCurrentPromoIndex(prev => (prev + 1) % playlist.length);
                              setIsTransitioning(false);
                            }, 300);
                          }}
                          className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'} ${isFullscreen ? 'h-screen w-screen' : ''}`}
                        />
                        
                        {/* Overlay badges - HIDDEN in fullscreen */}
                        {showControls && !isFullscreen && (
                        <div className="absolute top-14 left-4 flex gap-2 z-30 pointer-events-none">
                          <Badge className="bg-red-600 text-white animate-pulse">
                            <span className="w-2 h-2 bg-white rounded-full mr-1" />
                            24/7 LIVE
                          </Badge>
                          <Badge className="bg-black/60 text-white">
                            <Star className="w-3 h-3 mr-1" />
                            OFFICIAL
                          </Badge>
                        </div>
                        )}
                        
                        {/* Video info - HIDDEN in fullscreen */}
                        {showControls && !isFullscreen && (
                        <div className="absolute bottom-16 left-4 right-4 z-30 pointer-events-none">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm opacity-80">
                              {currentPromoIndex + 1}/{playlist.length} • {currentItem.title}
                            </p>
                            {currentItem.isScheduled && (
                              <Badge className="bg-violet-600/80 text-white text-xs">SCHEDULED</Badge>
                            )}
                          </div>
                        </div>
                        )}
                        
                        {/* Skip to next button - HIDDEN in fullscreen */}
                        {showControls && !isFullscreen && (
                        <div className="absolute bottom-20 right-4 z-30">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsTransitioning(true);
                              setTimeout(() => {
                                setCurrentPromoIndex(prev => (prev + 1) % playlist.length);
                                setIsTransitioning(false);
                              }, 200);
                            }}
                            className="bg-black/60 hover:bg-black/80 text-white rounded-full"
                            data-testid="hero-skip-btn"
                          >
                            <SkipForward className="w-4 h-4 mr-1" />
                            Next
                          </Button>
                        </div>
                        )}
                        
                        {/* Volume Control - ALWAYS VISIBLE */}
                        <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsMuted(!isMuted);
                            }}
                            className="h-10 w-10 bg-black/70 hover:bg-black/90 text-white rounded-full"
                            data-testid="hero-volume-btn"
                          >
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                          </Button>
                          {/* Volume slider */}
                          <div className="hidden md:flex items-center bg-black/70 rounded-full px-3 py-2 gap-2">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={isMuted ? 0 : volume}
                              onChange={(e) => {
                                const newVolume = parseFloat(e.target.value);
                                setVolume(newVolume);
                                setIsMuted(newVolume === 0);
                              }}
                              className="w-20 h-1 accent-red-500 cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-white text-xs w-8">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                          </div>
                        </div>
                        
                        {/* Fullscreen exit button - visible in fullscreen */}
                        {isFullscreen && (
                          <div className="absolute bottom-4 right-4 z-40">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-12 w-12 bg-black/60 text-white hover:bg-black/80 rounded-full"
                              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                              data-testid="hero-fullscreen-exit-btn"
                            >
                              <Minimize className="w-6 h-6" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Promo Thumbnails - HIDDEN in fullscreen */}
                {!isFullscreen && (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {(mixedPlaylist.length > 0 ? mixedPlaylist.slice(0, 4) : PROMO_PLAYLIST).map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => setCurrentPromoIndex(idx)}
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                        idx === currentPromoIndex
                          ? "border-red-500 ring-2 ring-red-500/30"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      {item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                      ) : item.file?.endsWith('.mp4') || item.file?.startsWith('/') ? (
                        <video src={item.file} className="w-full h-full object-cover" muted preload="metadata" />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <Play className="w-4 h-4 text-zinc-500" />
                        </div>
                      )}
                      {idx === currentPromoIndex && (
                        <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                          <Play className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {item.isScheduled && (
                        <div className="absolute top-1 left-1">
                          <Badge className="bg-violet-600 text-[8px] px-1">LIVE</Badge>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                )}

                {/* CTA Below Video - HIDDEN in fullscreen */}
                {!isFullscreen && (
                <div className="mt-4 flex items-center justify-center gap-4">
                  <Link to="/schedule">
                    <Button variant="ghost" className="text-zinc-400 hover:text-white">
                      <Calendar className="w-4 h-4 mr-1" />
                      Full Schedule
                    </Button>
                  </Link>
                  <Link to="/watch">
                    <Button className="bg-red-600 hover:bg-red-500 text-white font-semibold">
                      <Radio className="w-4 h-4 mr-1" />
                      Watch Live Now
                    </Button>
                  </Link>
                </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Creator Revolution Promo Banner */}
      <section className="py-8 bg-gradient-to-r from-red-900 via-purple-900 to-red-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLThoLTEydjJoMTJ2LTJ6bTAtOGgtMTJ2MmgxMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="container mx-auto px-4 md:px-6 max-w-7xl relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                <span className="text-2xl">🛑</span>
                <Badge className="bg-yellow-500 text-black font-bold animate-pulse">THE HARSH TRUTH</Badge>
              </div>
              <h3 className="font-heading text-xl md:text-2xl text-white mb-2">
                OVER 50% OF CREATORS ARE STUCK UNDER THE $10K CEILING!
              </h3>
              <p className="text-zinc-300 text-sm md:text-base max-w-xl">
                Big platforms keep the lion's share while you settle for scraps. 
                <span className="text-yellow-400 font-bold"> ZTVLIVE puts 70% in YOUR pocket.</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/promo-library">
                <Button size="lg" className="bg-white text-red-600 hover:bg-zinc-100 font-bold">
                  <Play className="w-5 h-5 mr-2" />
                  Watch Promo
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 font-bold">
                  <Rocket className="w-5 h-5 mr-2" />
                  JOIN THE REVOLUTION
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Latest from the Blog */}
      <section className="py-12 bg-zinc-950">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <Newspaper className="w-5 h-5 text-purple-400" />
              <span className="font-heading text-purple-400 tracking-wider text-sm">INSIGHTS</span>
            </div>
            <h2 className="font-heading text-2xl md:text-3xl text-white mb-2">Latest from the Blog</h2>
            <p className="text-zinc-400 text-sm md:text-base max-w-xl mx-auto">
              OTT distribution strategies, creator monetization tips, and building the future of live streaming.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Article 1: Mystery Money Playbook (NEW) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Link to="/blog/mystery-money-playbook" className="group block" data-testid="blog-card-mystery-money">
                <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-purple-500/50 transition-all">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src="https://cdn.marblism.com/3RFgi5bedK-.webp"
                      alt="The Mystery Money Playbook"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
                    <Badge className="absolute bottom-3 left-3 bg-green-600 text-white text-xs">
                      Creator Economy
                    </Badge>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Mar 31
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock3 className="w-3 h-3" />
                        7 min read
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-lg mb-2 group-hover:text-purple-400 transition-colors line-clamp-2">
                      The Mystery Money Playbook: How ZTVLIVE Creators Are Earning Daily
                    </h3>
                    <p className="text-zinc-400 text-sm line-clamp-2">
                      Welcome to the professional evolution of the creator economy. 70% revenue share and dopamine-driven Mystery Money rewards.
                    </p>
                    <div className="flex items-center text-purple-400 text-sm font-semibold mt-3 group-hover:text-purple-300">
                      Read Article
                      <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>

            {/* Article 2: TikTok to TV (NEW) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Link to="/blog/tiktok-to-tv" className="group block" data-testid="blog-card-tiktok-tv">
                <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-purple-500/50 transition-all">
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src="https://cdn.marblism.com/5W4knHVxWgU.webp"
                      alt="From TikTok to TV"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
                    <Badge className="absolute bottom-3 left-3 bg-purple-600 text-white text-xs">
                      Creator Growth
                    </Badge>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Mar 31
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock3 className="w-3 h-3" />
                        6 min read
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-lg mb-2 group-hover:text-purple-400 transition-colors line-clamp-2">
                      From TikTok to TV: How to Turn Your Following into a 24/7 Channel
                    </h3>
                    <p className="text-zinc-400 text-sm line-clamp-2">
                      The "Link in Bio" era is over. Become the owner of your own TV network with ZTVLIVE on Roku & Fire TV.
                    </p>
                    <div className="flex items-center text-purple-400 text-sm font-semibold mt-3 group-hover:text-purple-300">
                      Read Article
                      <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>

          <div className="text-center mt-8">
            <Link to="/blog">
              <Button variant="outline" className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10">
                <Newspaper className="w-4 h-4 mr-2" />
                View All Articles
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Links Section - For SEO Internal Linking */}
      <section className="py-12 bg-zinc-900/50">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/schedule" className="group p-6 bg-zinc-800/50 hover:bg-blue-600/20 border border-zinc-700/50 hover:border-blue-500/50 rounded-xl transition-all duration-300">
              <Calendar className="w-8 h-8 text-blue-400 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-lg mb-1">Schedule</h3>
              <p className="text-sm text-zinc-400">View programming guide</p>
            </Link>
            <Link to="/browse" className="group p-6 bg-zinc-800/50 hover:bg-purple-600/20 border border-zinc-700/50 hover:border-purple-500/50 rounded-xl transition-all duration-300">
              <Film className="w-8 h-8 text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-lg mb-1">Browse</h3>
              <p className="text-sm text-zinc-400">Explore all content</p>
            </Link>
            <Link to="/play" className="group p-6 bg-zinc-800/50 hover:bg-green-600/20 border border-zinc-700/50 hover:border-green-500/50 rounded-xl transition-all duration-300">
              <Gamepad2 className="w-8 h-8 text-green-400 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-lg mb-1">Play Game</h3>
              <p className="text-sm text-zinc-400">Win prizes live</p>
            </Link>
            <Link to="/rewards" className="group p-6 bg-zinc-800/50 hover:bg-amber-600/20 border border-zinc-700/50 hover:border-amber-500/50 rounded-xl transition-all duration-300">
              <Trophy className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-bold text-lg mb-1">Rewards</h3>
              <p className="text-sm text-zinc-400">Claim your prizes</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Trending Now - Featured Playable Content */}
      <section className="py-16 bg-gradient-to-b from-zinc-950 to-zinc-900">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }} 
            className="flex items-center justify-between mb-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-red-600/20 px-4 py-2 rounded-full">
                <Zap className="w-4 h-4 text-red-500 animate-pulse" />
                <span className="font-heading text-red-400 tracking-wider text-sm">TRENDING</span>
              </div>
              <h2 className="font-heading text-2xl md:text-3xl tracking-tight uppercase">Featured Highlights</h2>
            </div>
            <Link to="/library">
              <Button variant="ghost" className="text-zinc-400 hover:text-white font-heading tracking-wider text-sm">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </motion.div>

          {contentLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-zinc-800/50 rounded-lg overflow-hidden animate-pulse">
                  <div className="h-40 bg-zinc-700"></div>
                  <div className="p-4">
                    <div className="h-4 bg-zinc-700 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-zinc-700 rounded w-full"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : featuredContent.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredContent.map((video, index) => (
                <motion.div
                  key={video.id || index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link 
                    to={`/video/${video.id}`}
                    className="group block bg-zinc-800/30 hover:bg-zinc-800/60 border border-zinc-700/50 hover:border-red-500/30 rounded-lg overflow-hidden transition-all duration-300"
                  >
                    <div className="relative h-40 overflow-hidden">
                      <img 
                        src={video.thumbnail} 
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=225&fit=crop';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                          <Play className="w-6 h-6 text-white ml-1" />
                        </div>
                      </div>
                      {video.duration && (
                        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                          {video.duration}
                        </span>
                      )}
                      {video.trending_score > 90 && (
                        <span className="absolute top-2 left-2 bg-amber-500 text-black text-xs px-2 py-1 rounded font-bold">
                          HOT
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge 
                          className="text-xs text-white" 
                          style={{ backgroundColor: CATEGORY_COLORS[video.category] || '#71717a' }}
                        >
                          {video.category?.toUpperCase()}
                        </Badge>
                      </div>
                      <h3 className="font-heading text-sm tracking-tight line-clamp-2 group-hover:text-red-400 transition-colors">
                        {video.title}
                      </h3>
                      <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1 text-green-400">
                          <Eye className="w-3 h-3" />
                          {video.views ? formatViews(video.views) : '0'} views
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                          <Heart className="w-3 h-3" />
                          {video.likes ? formatViews(video.likes) : '0'}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Loading featured content...</p>
            </div>
          )}
        </div>
      </section>

      {/* Watch ZTV Live Section */}
      <section id="watch" className="py-20 bg-zinc-900/50">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <Badge className="bg-red-600/20 text-red-400 border border-red-600/30 mb-4">WATCH ZTV LIVE</Badge>
            <h2 className="font-heading text-4xl md:text-5xl tracking-tight uppercase">Your Destination for Live Content</h2>
            <p className="text-zinc-400 mt-3 max-w-2xl mx-auto">
              Tune in to our live broadcasts featuring concerts, sports events, corporate shows, and original creator content on Roku, Fire TV, Samsung, LG, and web.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative rounded-lg overflow-hidden bg-black">
                <div className="aspect-video relative">
                  {currentVideo && (
                    <>
                      {isLiveMode && streamConfig?.hls_url && !streamError ? (
                        <video ref={videoRef} className="w-full h-full object-cover" poster={currentVideo.thumbnail} playsInline muted={isMuted} />
                      ) : (
                        <img src={currentVideo.thumbnail} alt={currentVideo.title} className="w-full h-full object-cover" />
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        {isLiveMode ? (
                          <Badge className="bg-red-600 text-white animate-pulse"><span className="w-2 h-2 bg-white rounded-full mr-2" />LIVE</Badge>
                        ) : (
                          <Badge className="bg-violet-600 text-white">AUTO-PLAYLIST</Badge>
                        )}
                        <Badge className="bg-black/60 text-white"><Users className="w-3 h-3 mr-1" />{viewers.toLocaleString()}</Badge>
                      </div>

                      <Link to="/watch?unmute=true" className="absolute inset-0 flex items-center justify-center group">
                        <div className="w-20 h-20 bg-red-600/90 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_40px_rgba(220,38,38,0.5)]">
                          <Play className="w-10 h-10 ml-1" />
                        </div>
                      </Link>

                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <h3 className="font-heading text-2xl tracking-tight uppercase line-clamp-2">{currentVideo.title}</h3>
                        <p className="text-zinc-400 text-sm mt-1">{playlistMode ? "Watch our highlight reel or visit our full streaming page" : "Live broadcast in progress"}</p>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
              <div className="mt-4 flex justify-center">
                <Link to="/watch?unmute=true">
                  <Button className="bg-red-600 hover:bg-red-500 font-heading tracking-wider">
                    <ExternalLink className="w-4 h-4 mr-2" />OPEN FULL STREAM PLAYER
                  </Button>
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                <h4 className="font-heading text-lg tracking-wider mb-4">STREAM INFO</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-500">Status</span><span className={isLiveMode ? "text-red-500" : "text-violet-400"}>{isLiveMode ? "Live Broadcast" : "Promo Loop"}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Platforms</span><span>Roku, Fire TV, Samsung, LG, Web</span></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Quality</span><span>1080p</span></div>
                </div>
              </div>

              {nextUp && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                  <h4 className="font-heading text-lg tracking-wider mb-4">UP NEXT</h4>
                  <div className="flex gap-3">
                    <div className="w-24 h-16 rounded overflow-hidden flex-shrink-0">
                      <img src={nextUp.thumbnail} alt={nextUp.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-heading text-sm line-clamp-2">{nextUp.title}</h5>
                      <Badge className="mt-1 text-xs text-white" style={{ backgroundColor: CATEGORY_COLORS[nextUp.category] || '#8b5cf6' }}>{nextUp.category?.toUpperCase()}</Badge>
                    </div>
                  </div>
                </div>
              )}

              <Link to="/watch?unmute=true" className="block">
                <Button variant="outline" className="w-full border-zinc-700 hover:border-red-500 font-heading tracking-wider">
                  VIEW FULL STREAMING PAGE <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <img src="https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?q=80&w=900" alt="Video editing" className="rounded-lg" />
              <div className="mt-4 inline-block bg-red-600 text-white font-heading text-3xl px-6 py-3 rounded">15+ Years Experience</div>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Badge className="bg-red-600/20 text-red-400 border border-red-600/30 mb-4">About ZTV LIVE</Badge>
              <h2 className="font-heading text-4xl md:text-5xl tracking-tight uppercase mb-6">Premier Video Production That Exceeds Expectations</h2>
              <p className="text-zinc-400 mb-6 leading-relaxed">
                At ZTV LIVE, we believe you deserve access to premier video production standards. Our collaborative approach ensures your vision becomes reality, with meticulous attention to every frame, sound, and transition.
              </p>
              
              <ul className="space-y-3 mb-8">
                {["Broadcast-quality production standards", "Experienced team from major networks", "End-to-end project management", "Competitive pricing with flexible packages"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3"><CheckCircle className="w-5 h-5 text-green-500" /><span>{item}</span></li>
                ))}
              </ul>

              <div>
                <h4 className="font-heading text-lg tracking-wider mb-3">Industry Experience</h4>
                <p className="text-zinc-500 text-sm mb-3">Our CEO has worked with major networks as Technical Director and Video Engineer:</p>
                <div className="flex flex-wrap gap-2">
                  {NETWORKS.map((network, i) => (
                    <Badge key={i} variant="secondary" className="bg-zinc-800 text-zinc-300">{network}</Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-zinc-900/50">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <Badge className="bg-red-600/20 text-red-400 border border-red-600/30 mb-4">What We Offer</Badge>
            <h2 className="font-heading text-4xl md:text-5xl tracking-tight uppercase">Our Services</h2>
            <p className="text-zinc-400 mt-3 max-w-2xl mx-auto">From live streaming to post-production, we offer comprehensive video production services tailored to your needs.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((service, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-red-500/50 transition-colors group">
                <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-red-600/30 transition-colors">
                  <service.icon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="font-heading text-xl tracking-wider mb-3">{service.title}</h3>
                <p className="text-zinc-400 text-sm mb-4">{service.description}</p>
                <ul className="space-y-2">
                  {service.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-zinc-500">
                      <CheckCircle className="w-4 h-4 text-green-500" />{feature}
                    </li>
                  ))}
                </ul>
                <Button variant="link" className="text-red-400 hover:text-red-300 p-0 mt-4" onClick={() => scrollToSection('contact')}>
                  Learn More <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Ad Unit - Between Services and Creator Section */}
      <section className="py-8 bg-zinc-900/30">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <AdUnit 
            slot="5009244786" 
            format="horizontal"
            className="min-h-[90px]"
          />
        </div>
      </section>

      {/* Creator Program Section */}
      <section id="creator" className="py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Badge className="bg-green-600/20 text-green-400 border border-green-600/30 mb-4">Creator Program</Badge>
              <h2 className="font-heading text-4xl md:text-5xl tracking-tight uppercase mb-6">Earn Money From Your Content</h2>
              <p className="text-zinc-400 mb-8">
                Join our Creator Program and earn 70% revenue share on all ad revenue from your content. Get featured on Roku, Fire TV, Samsung, LG, and web platforms.
              </p>

              <div className="flex gap-6 mb-8">
                <div className="text-center"><div className="font-heading text-4xl text-green-500">70%</div><div className="text-zinc-500 text-sm">Revenue Share</div></div>
                <div className="text-center"><div className="font-heading text-4xl text-green-500">$1.75</div><div className="text-zinc-500 text-sm">Per 1K Views</div></div>
                <div className="text-center"><div className="font-heading text-4xl text-green-500">$50</div><div className="text-zinc-500 text-sm">Min Payout</div></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {[
                  { title: "Broadcast Your Content", desc: "Get your videos featured on our Roku, Fire TV, Samsung, and LG channels" },
                  { title: "70% Revenue Share", desc: "Earn $1.75 per 1,000 views. Request payouts via PayPal" },
                  { title: "Build Your Audience", desc: "Gain exposure and grow your following" },
                  { title: "Track Your Earnings", desc: "Real-time dashboard to monitor views and earnings" },
                ].map((item, i) => (
                  <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <h4 className="font-heading text-sm tracking-wider mb-1">{item.title}</h4>
                    <p className="text-zinc-500 text-xs">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Link to="/upload">
                  <Button className="bg-green-600 hover:bg-green-500 font-heading tracking-wider">Join Creator Program</Button>
                </Link>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
              <img src="https://images.unsplash.com/photo-1598387993281-cecf8b71a8f8?q=80&w=900" alt="Content creator" className="rounded-lg" />
              <div className="absolute bottom-4 left-4 bg-green-600 text-white font-heading text-xl px-4 py-2 rounded">$1.75 Per 1,000 Views</div>
              <div className="absolute top-4 right-4 bg-black/80 text-white font-heading px-4 py-2 rounded">200+ Active Creators</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Featured Creators Section */}
      <section id="featured-creators" className="py-20 bg-zinc-900/50">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <Badge className="bg-amber-600/20 text-amber-400 border border-amber-600/30 mb-4">Top Performers</Badge>
            <h2 className="font-heading text-4xl md:text-5xl tracking-tight uppercase">Featured Creators</h2>
            <p className="text-zinc-400 mt-3 max-w-2xl mx-auto">Meet our top-performing creators who are earning money while entertaining audiences on Roku, Fire TV, Samsung, LG, and web.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: "Marcus Johnson", handle: "@marcusjfilms", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200", category: "Sports", views: "2.4M", earnings: "$4,200", badge: "Top Earner" },
              { name: "Sarah Chen", handle: "@sarahcreates", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200", category: "Music", views: "1.8M", earnings: "$3,150", badge: "Rising Star" },
              { name: "DevonTheCreator", handle: "@devonthecreator", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200", category: "Podcast", views: "1.2M", earnings: "$2,100", badge: "Fan Favorite" },
              { name: "Elena Rodriguez", handle: "@elenarodriguez", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200", category: "Film", views: "980K", earnings: "$1,715", badge: "New Creator" },
            ].map((creator, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-amber-500/50 transition-all group text-center">
                <div className="relative inline-block mb-4">
                  <img src={creator.avatar} alt={creator.name} className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/50 group-hover:border-amber-500 transition-colors" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                </div>
                <h3 className="font-heading text-lg tracking-wider">{creator.name}</h3>
                <p className="text-zinc-500 text-sm mb-2">{creator.handle}</p>
                <Badge className="mb-4" style={{ backgroundColor: CATEGORY_COLORS[creator.category.toLowerCase()] || '#8b5cf6' }}>{creator.category}</Badge>
                
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-800">
                  <div>
                    <div className="font-heading text-xl text-amber-400">{creator.views}</div>
                    <div className="text-zinc-500 text-xs">Total Views</div>
                  </div>
                  <div>
                    <div className="font-heading text-xl text-green-400">{creator.earnings}</div>
                    <div className="text-zinc-500 text-xs">Earned</div>
                  </div>
                </div>
                
                <Badge className="mt-4 bg-amber-600/20 text-amber-300 border border-amber-600/30">{creator.badge}</Badge>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-zinc-400 mb-4">Ready to join our creator community and start earning?</p>
            <Link to="/upload">
              <Button className="bg-amber-600 hover:bg-amber-500 font-heading tracking-wider">
                <Award className="w-4 h-4 mr-2" />
                BECOME A FEATURED CREATOR
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pro Bono Section */}
      <section id="probono" className="py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <Badge className="bg-violet-600/20 text-violet-400 border border-violet-600/30 mb-4">Pro Bono Services</Badge>
            <h2 className="font-heading text-4xl md:text-5xl tracking-tight uppercase">Donation-Based Coverage</h2>
            <p className="text-zinc-400 mt-3 max-w-2xl mx-auto">
              We believe in giving back. Nonprofit organizations and low-budget clients can access our professional videography services through our donation-based program.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              { tier: "Basic", price: 500, features: ["Single camera coverage", "Up to 2 hours", "Basic editing", "Digital delivery"] },
              { tier: "Standard", price: 1000, popular: true, features: ["Multi-camera setup", "Up to 4 hours", "Professional editing", "Highlight reel", "Social media cuts"] },
              { tier: "Premium", price: 1500, features: ["Full production crew", "Full day coverage", "Live streaming option", "Complete post-production", "Multiple deliverables"] },
            ].map((plan, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className={`bg-zinc-900 border rounded-lg p-6 ${plan.popular ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-zinc-800'}`}>
                {plan.popular && <Badge className="bg-violet-600 text-white mb-4">MOST POPULAR</Badge>}
                <div className="font-heading text-4xl mb-1">${plan.price}</div>
                <div className="text-zinc-500 mb-4">{plan.tier}</div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-500" />{feature}</li>
                  ))}
                </ul>
                <Button 
                  className={plan.popular ? "w-full bg-violet-600 hover:bg-violet-500" : "w-full"} 
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => setSelectedTier(plan.price)}
                >
                  Select
                </Button>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Heart, title: "Community Support", desc: "Your donation helps us provide quality video services to nonprofits and community organizations." },
              { icon: Star, title: "Professional Quality", desc: "Same broadcast-quality production you'd expect from our paid services." },
              { icon: DollarSign, title: "Tax Deductible", desc: "Donations may be tax-deductible. We'll provide documentation for your records." },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-violet-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h4 className="font-heading text-lg tracking-wider mb-1">{item.title}</h4>
                  <p className="text-zinc-500 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio/Our Work Section */}
      <section id="portfolio" className="py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center justify-between mb-12">
            <div>
              <Badge className="bg-red-600/20 text-red-400 border border-red-600/30 mb-4">Our Work</Badge>
              <h2 className="font-heading text-4xl md:text-5xl tracking-tight uppercase">Featured Projects</h2>
            </div>
            <Link to="/library" className="hidden md:flex">
              <Button variant="outline" className="border-zinc-700 hover:border-red-500 font-heading tracking-wider">
                VIEW ALL CONTENT <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PORTFOLIO.map((project, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="group relative rounded-lg overflow-hidden">
                <div className="aspect-video">
                  <img src={project.image} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <Badge className="bg-red-600/80 text-white text-xs mb-2">{project.category}</Badge>
                  <h3 className="font-heading text-lg">{project.title}</h3>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 text-center md:hidden">
            <Link to="/library">
              <Button className="bg-red-600 hover:bg-red-500 font-heading tracking-wider">VIEW ALL CONTENT</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Launch Campaign & Revenue Projections */}
      <section id="launch" className="py-20 bg-gradient-to-b from-zinc-950 via-violet-950/20 to-zinc-950">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }} 
            className="text-center mb-12"
          >
            <Badge className="bg-violet-600/20 text-violet-400 border border-violet-600/30 mb-4">
              <Rocket className="w-3 h-3 mr-1" />
              OFFICIAL LAUNCH
            </Badge>
            <h2 className="font-heading text-4xl md:text-5xl tracking-tight uppercase mb-4">
              <span className="text-violet-400">ZTVLIVE</span> IS NOW LIVE
            </h2>
            <p className="text-zinc-400 max-w-3xl mx-auto text-lg">
              Join the 24/7 streaming revolution. Real trending content, AI-powered commentary, and creator revenue sharing. 
              Be part of something viral.
            </p>
          </motion.div>

          {/* Campaign Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
              { label: "Launch Month", value: "March 2026", icon: Rocket, color: "violet" },
              { label: "Content Categories", value: "9+", icon: Film, color: "blue" },
              { label: "Creator Revenue Share", value: "70%", icon: DollarSign, color: "green" },
              { label: "News Sources", value: "50K+", icon: Newspaper, color: "amber" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-center"
              >
                <stat.icon className={`w-6 h-6 mx-auto mb-2 text-${stat.color}-400`} />
                <div className={`font-heading text-2xl md:text-3xl text-${stat.color}-400`}>{stat.value}</div>
                <div className="text-zinc-500 text-xs">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Share Campaign CTA */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }}
            className="text-center"
          >
            <h3 className="font-heading text-2xl mb-4">HELP US LAUNCH</h3>
            <p className="text-zinc-400 mb-6 max-w-xl mx-auto">
              Share ZTVLIVE with your network. Every share helps us grow and means more revenue for creators.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a 
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("🚀 Just discovered @ZTVLIVE - A 24/7 streaming platform with AI-curated viral content! Creators earn 70% revenue. Check it out:")}&url=${encodeURIComponent("https://www.ztvlivestream.com")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-[#1DA1F2] hover:bg-[#1a8cd8]">
                  <Twitter className="w-4 h-4 mr-2" />
                  Share on Twitter
                </Button>
              </a>
              <Button 
                variant="outline" 
                className="border-zinc-600"
                onClick={() => {
                  navigator.clipboard.writeText("https://www.ztvlivestream.com");
                  toast.success("Link copied to clipboard!");
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
              <Link to="/upload">
                <Button className="bg-green-600 hover:bg-green-500">
                  <Upload className="w-4 h-4 mr-2" />
                  Submit Content & Earn
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex justify-center gap-8 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span>www.ztvlivestream.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4" />
                <span>Available on Roku, Fire TV, Samsung & LG</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-zinc-900/50">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <Badge className="bg-red-600/20 text-red-400 border border-red-600/30 mb-4">Get In Touch</Badge>
            <h2 className="font-heading text-4xl md:text-5xl tracking-tight uppercase">Let's Create Together</h2>
            <p className="text-zinc-400 mt-3 max-w-2xl mx-auto">Ready to elevate your brand through stunning video content? Contact us today to discuss your project.</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { icon: Mail, title: "Email Us", value: "admin@ztvlivestream.com", href: "mailto:admin@ztvlivestream.com" },
                { icon: Phone, title: "Call Us", value: "(480) 305-3794", href: "tel:+14803053794" },
                { icon: MapPin, title: "Location", value: "United States" },
                { icon: Clock3, title: "Response Time", value: "Within 24 hours" },
              ].map((item, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                  <item.icon className="w-6 h-6 text-red-400 mb-3" />
                  <h4 className="font-heading text-sm tracking-wider mb-1">{item.title}</h4>
                  {item.href ? (
                    <a href={item.href} className="text-zinc-300 hover:text-white transition-colors">{item.value}</a>
                  ) : (
                    <p className="text-zinc-300">{item.value}</p>
                  )}
                </div>
              ))}
            </div>

            <motion.form initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label htmlFor="name">Name *</Label><Input id="name" required value={contactForm.name} onChange={(e) => setContactForm({...contactForm, name: e.target.value})} className="bg-zinc-900 border-zinc-800" /></div>
                <div><Label htmlFor="email">Email *</Label><Input id="email" type="email" required value={contactForm.email} onChange={(e) => setContactForm({...contactForm, email: e.target.value})} className="bg-zinc-900 border-zinc-800" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label htmlFor="phone">Phone</Label><Input id="phone" value={contactForm.phone} onChange={(e) => setContactForm({...contactForm, phone: e.target.value})} className="bg-zinc-900 border-zinc-800" /></div>
                <div><Label htmlFor="company">Company</Label><Input id="company" value={contactForm.company} onChange={(e) => setContactForm({...contactForm, company: e.target.value})} className="bg-zinc-900 border-zinc-800" /></div>
              </div>
              <div>
                <Label>Service Interested In</Label>
                <Select value={contactForm.service} onValueChange={(value) => setContactForm({...contactForm, service: value})}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800"><SelectValue placeholder="Select a service..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live-streaming">Live Streaming</SelectItem>
                    <SelectItem value="event-videography">Event Videography</SelectItem>
                    <SelectItem value="corporate">Corporate Video Production</SelectItem>
                    <SelectItem value="post-production">Post-Production & Editing</SelectItem>
                    <SelectItem value="pro-bono">Pro Bono / Donation-Based Coverage</SelectItem>
                    <SelectItem value="content-submission">Content Submission (Freelancer)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="message">Message *</Label><Textarea id="message" required rows={4} value={contactForm.message} onChange={(e) => setContactForm({...contactForm, message: e.target.value})} className="bg-zinc-900 border-zinc-800" /></div>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-500 h-12 font-heading tracking-wider">SEND MESSAGE</Button>
            </motion.form>
          </div>
        </div>
      </section>

      {/* Download App Section - Only show if NOT installed as PWA */}
      {!isStandalone && (
      <section id="download" className="py-16 bg-gradient-to-b from-zinc-900 to-[#09090b]">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <Badge className="bg-green-600 mb-4">FREE DOWNLOAD</Badge>
            <h2 className="font-heading text-4xl md:text-5xl tracking-tight uppercase mb-4">
              GET THE <span className="text-green-400">ZTV LIVE</span> APP
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Download our app directly to your device. Available on mobile, desktop, and Smart TVs.
            </p>
          </motion.div>

          {/* Mobile & Desktop Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            {/* Android/Chrome */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center hover:border-green-600/50 transition-colors"
            >
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="font-heading text-xl mb-2">ANDROID</h3>
              <p className="text-zinc-500 text-sm mb-4">Chrome, Samsung, Firefox & more</p>
              <Button 
                onClick={() => handleSmartInstall('android')}
                className="w-full bg-green-600 hover:bg-green-500"
                data-testid="install-android-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Install Now
              </Button>
            </motion.div>

            {/* iOS */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center hover:border-blue-600/50 transition-colors"
            >
              <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Apple className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="font-heading text-xl mb-2">iPHONE & iPAD</h3>
              <p className="text-zinc-500 text-sm mb-4">Add to Home Screen via Safari</p>
              <Button 
                onClick={() => handleSmartInstall('ios')}
                className="w-full bg-blue-600 hover:bg-blue-500"
                data-testid="install-ios-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Install Now
              </Button>
            </motion.div>

            {/* Desktop */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center hover:border-violet-600/50 transition-colors"
            >
              <div className="w-16 h-16 bg-violet-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Monitor className="w-8 h-8 text-violet-400" />
              </div>
              <h3 className="font-heading text-xl mb-2">DESKTOP</h3>
              <p className="text-zinc-500 text-sm mb-4">Windows, Mac & Linux</p>
              <Button 
                onClick={() => handleSmartInstall('desktop')}
                className="w-full bg-violet-600 hover:bg-violet-500"
                data-testid="install-desktop-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Install Now
              </Button>
            </motion.div>
          </div>

          {/* Smart TV Section */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }}
            className="text-center mb-6 mt-12"
          >
            <Badge className="bg-red-600 mb-4">SMART TV APPS</Badge>
            <h3 className="font-heading text-2xl md:text-3xl tracking-tight uppercase mb-2">
              WATCH ON YOUR <span className="text-red-400">BIG SCREEN</span>
            </h3>
            <p className="text-zinc-500 text-sm">Available on all major Smart TV platforms</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {/* Roku */}
            <motion.a 
              href="https://channelstore.roku.com/details/ztvlive"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center hover:border-purple-500/50 transition-all hover:scale-105 cursor-pointer group"
              data-testid="download-roku-btn"
            >
              <div className="w-14 h-14 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Tv className="w-7 h-7 text-purple-400" />
              </div>
              <h4 className="font-heading text-lg mb-1">ROKU</h4>
              <p className="text-zinc-500 text-xs mb-3">Channel Store</p>
              <span className="text-purple-400 text-xs font-medium group-hover:underline flex items-center justify-center gap-1">
                <ExternalLink className="w-3 h-3" /> Get Channel
              </span>
            </motion.a>

            {/* Fire TV */}
            <motion.a 
              href="https://www.amazon.com/dp/B0XXXXXXXXX"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center hover:border-orange-500/50 transition-all hover:scale-105 cursor-pointer group"
              data-testid="download-firetv-btn"
            >
              <div className="w-14 h-14 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Zap className="w-7 h-7 text-orange-400" />
              </div>
              <h4 className="font-heading text-lg mb-1">FIRE TV</h4>
              <p className="text-zinc-500 text-xs mb-3">Amazon Appstore</p>
              <span className="text-orange-400 text-xs font-medium group-hover:underline flex items-center justify-center gap-1">
                <ExternalLink className="w-3 h-3" /> Get App
              </span>
            </motion.a>

            {/* Samsung TV */}
            <motion.a 
              href="https://www.samsung.com/apps/tv"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center hover:border-blue-500/50 transition-all hover:scale-105 cursor-pointer group"
              data-testid="download-samsung-btn"
            >
              <div className="w-14 h-14 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Tv className="w-7 h-7 text-blue-400" />
              </div>
              <h4 className="font-heading text-lg mb-1">SAMSUNG</h4>
              <p className="text-zinc-500 text-xs mb-3">Tizen Smart TV</p>
              <span className="text-blue-400 text-xs font-medium group-hover:underline flex items-center justify-center gap-1">
                <ExternalLink className="w-3 h-3" /> Get App
              </span>
            </motion.a>

            {/* LG TV */}
            <motion.a 
              href="https://www.lg.com/us/tvs/webos"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center hover:border-red-500/50 transition-all hover:scale-105 cursor-pointer group"
              data-testid="download-lg-btn"
            >
              <div className="w-14 h-14 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Tv className="w-7 h-7 text-red-400" />
              </div>
              <h4 className="font-heading text-lg mb-1">LG TV</h4>
              <p className="text-zinc-500 text-xs mb-3">webOS Content Store</p>
              <span className="text-red-400 text-xs font-medium group-hover:underline flex items-center justify-center gap-1">
                <ExternalLink className="w-3 h-3" /> Get App
              </span>
            </motion.a>
          </div>

          <motion.div 
            initial={{ opacity: 0 }} 
            whileInView={{ opacity: 1 }} 
            viewport={{ once: true }}
            className="mt-10 text-center"
          >
            <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-400">
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Works Offline</span>
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> No App Store</span>
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> Auto Updates</span>
              <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-400" /> 100% Free</span>
            </div>
          </motion.div>
        </div>
      </section>
      )}

      {/* Newsletter Signup Section */}
      <section className="py-12 bg-zinc-900/50">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <NewsletterSignup variant="inline" />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-800">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-10 h-10 min-w-[40px] min-h-[40px] bg-red-600 rounded-lg flex items-center justify-center"><Tv className="w-6 h-6 text-white" /></div>
              <span className="font-bold text-xl tracking-wider text-white whitespace-nowrap">ZTVLIVE</span>
            </div>
            
            {/* Social Links */}
            <div className="flex items-center gap-4">
              <a href="https://www.youtube.com/@ztvlivestream" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-zinc-800 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors" data-testid="footer-youtube" title="YouTube">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              </a>
              <a href="https://www.facebook.com/share/1FjPvy6Myj/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-zinc-800 hover:bg-[#4267B2] rounded-full flex items-center justify-center transition-colors" data-testid="footer-facebook" title="Facebook">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="https://www.tiktok.com/@ztvlivestream" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-zinc-800 hover:bg-pink-600 rounded-full flex items-center justify-center transition-colors" data-testid="footer-tiktok" title="TikTok">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
              </a>
              <a href="https://x.com/ztvlivestream" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-zinc-800 hover:bg-zinc-600 rounded-full flex items-center justify-center transition-colors" data-testid="footer-twitter" title="X (Twitter)">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://www.instagram.com/ztvlivestream" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-zinc-800 hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 rounded-full flex items-center justify-center transition-colors" data-testid="footer-instagram" title="Instagram">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
              <Link to="/watch" className="hover:text-white transition-colors">Watch Live</Link>
              <Link to="/schedule" className="hover:text-white transition-colors">Schedule</Link>
              <Link to="/browse" className="hover:text-white transition-colors">Browse</Link>
              <Link to="/library" className="hover:text-white transition-colors">Library</Link>
              <Link to="/play" className="hover:text-white transition-colors">Play Game</Link>
              <a href="mailto:admin@ztvlivestream.com" className="hover:text-white transition-colors">Contact</a>
              <Link to="/ad-kit" className="hover:text-white transition-colors">Ad Kit</Link>
              {!isStandalone && (
                <button onClick={() => handleSmartInstall()} className="hover:text-green-400 transition-colors">Get App</button>
              )}
            </div>
          </div>
          <div className="mt-8 text-center text-xs text-zinc-600">© 2026 ZTV LIVE. All rights reserved. | <a href="https://www.ztvlivestream.com" className="hover:text-white">www.ztvlivestream.com</a></div>
        </div>
      </footer>
      
      {/* Coming Up Alert */}
      <ComingUpAlert />
    </div>
  );
}
