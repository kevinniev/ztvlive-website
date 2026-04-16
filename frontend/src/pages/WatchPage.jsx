import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import Marquee from "react-fast-marquee";
import Hls from "hls.js";
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Heart, Share2, 
  MessageSquare, Users, Tv, ChevronRight, Menu, X, Send,
  SkipForward, Radio, RefreshCw, TrendingUp, Wifi, WifiOff, Clock, Calendar,
  Rewind, FastForward, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { SponsorBanner, TrendingTopics } from "@/components/Monetization";
import Navigation from "@/components/Navigation";
import UnmuteOverlay from "@/components/UnmuteOverlay";

const API = '/api';
const WS_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : '';

const CATEGORY_COLORS = {
  sports: "#f97316",
  podcast: "#8b5cf6",
  music: "#d946ef",
  film: "#ec4899",
  tech: "#06b6d4",
  gaming: "#22c55e",
  news: "#eab308",
  culture: "#f43f5e",
  afrobeats: "#10b981",
  other: "#71717a",
};

export default function WatchPage() {
  const [searchParams] = useSearchParams();
  const scheduleSlot = searchParams.get('schedule');
  
  const [currentVideo, setCurrentVideo] = useState(null);
  const [nextUp, setNextUp] = useState(null);
  const [viewers, setViewers] = useState(0);
  const [tickers, setTickers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [videoComments, setVideoComments] = useState([]);
  const [upcomingVideos, setUpcomingVideos] = useState([]);
  const [streamConfig, setStreamConfig] = useState(null);
  const [streamError, setStreamError] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [playlistMode, setPlaylistMode] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [liked, setLiked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentUsername, setCommentUsername] = useState(() => {
    return localStorage.getItem("ztv_username") || `Viewer${Math.floor(Math.random() * 9999)}`;
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [scheduleInfo, setScheduleInfo] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [arizonaTime, setArizonaTime] = useState(null);
  const [watchMode, setWatchMode] = useState("live");
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const wsRef = useRef(null);
  const chatScrollRef = useRef(null);

  const [commentSettings, setCommentSettings] = useState({ comments_enabled: true });
  const [liveSync, setLiveSync] = useState(null);
  const [isPastContent, setIsPastContent] = useState(false);

  const fetchLiveSync = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/tv/sync`);
      setLiveSync({
        arizona_display: new Date(res.data.server_time).toLocaleTimeString('en-US', { 
          timeZone: 'America/Phoenix',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) + ' MST',
        current_hour: new Date(res.data.server_time).getHours(),
        current_minute: new Date(res.data.server_time).getMinutes(),
        sync: {
          sync_to_position: res.data.elapsed_seconds || 0,
          progress_percent: res.data.progress_percent || 0
        },
        current_content: res.data.current_content,
        remaining_seconds: res.data.remaining_seconds,
        next_up: res.data.next_up
      });
      setArizonaTime({
        arizona_display: new Date(res.data.server_time).toLocaleTimeString('en-US', { 
          timeZone: 'America/Phoenix',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) + ' MST',
        arizona_hour: new Date(res.data.server_time).getHours(),
        arizona_minute: new Date(res.data.server_time).getMinutes()
      });
    } catch (error) {
      try {
        const res = await axios.get(`${API}/schedule/live-sync`);
        setLiveSync(res.data);
        setArizonaTime({
          arizona_display: res.data.arizona_display,
          arizona_hour: res.data.current_hour,
          arizona_minute: res.data.current_minute
        });
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    fetchLiveSync();
    const interval = setInterval(fetchLiveSync, 10000);
    return () => clearInterval(interval);
  }, [fetchLiveSync]);

  const fetchComments = useCallback(async (videoId, targetLiveMode) => {
    if (!videoId) return;
    try {
      const endpoint = targetLiveMode ? `${API}/comments/live` : `${API}/comments/${videoId}`;
      const res = await axios.get(endpoint);
      setVideoComments(res.data.comments || []);
      setCommentSettings(res.data.settings || { comments_enabled: true });
    } catch (error) {}
  }, []);

  const fetchContent = useCallback(async () => {
    try {
      if (scheduleSlot) {
        const [slotRes, tickerRes, chatRes, streamRes, contentRes] = await Promise.all([
          axios.get(`${API}/schedule/slot/${scheduleSlot}`),
          axios.get(`${API}/trending/ticker`),
          axios.get(`${API}/chat/messages`),
          axios.get(`${API}/stream/config`),
          axios.get(`${API}/content/all?limit=8`),
        ]);
        
        const slotData = slotRes.data;
        setCurrentVideo(slotData.content);
        setScheduleInfo(slotData);
        setTimeRemaining(slotData.minutes_until);
        setViewers(Math.floor(Math.random() * 10000) + 2000);
        setTickers(tickerRes.data.tickers);
        setChatMessages(chatRes.data.messages);
        setStreamConfig(streamRes.data);
        setUpcomingVideos(contentRes.data.content.slice(0, 4));
        
        if (slotData.content?.id) {
          fetchComments(slotData.content.id, false);
        }
        return;
      }
      
      const [tvSyncRes, tickerRes, chatRes, streamRes, contentRes] = await Promise.all([
        axios.get(`${API}/tv/now-playing`),
        axios.get(`${API}/trending/ticker`),
        axios.get(`${API}/chat/messages`),
        axios.get(`${API}/stream/config`),
        axios.get(`${API}/content/all?limit=8`),
      ]);
      
      const current = tvSyncRes.data.current_content;
      const transformedCurrent = current ? {
        id: current.id,
        title: current.title,
        video_url: current.embed_url || current.video_url,
        thumbnail: current.thumbnail,
        duration: current.duration,
        source: current.source,
        category: current.category,
        is_creator_content: current.is_creator_content,
        creator_name: current.creator_name
      } : null;
      
      setCurrentVideo(transformedCurrent);
      
      let newLiveMode = isLiveMode;
      if (transformedCurrent?.is_creator_content) {
        newLiveMode = false;
        setIsLiveMode(false);
        setPlaylistMode(true);
      }
      
      setNextUp(tvSyncRes.data.next_up?.content || null);
      setScheduleInfo({
        current_slot: `${Math.floor(tvSyncRes.data.elapsed_seconds / 60)}:${String(tvSyncRes.data.elapsed_seconds % 60).padStart(2, '0')}`,
        elapsed_seconds: tvSyncRes.data.elapsed_seconds,
        remaining_seconds: tvSyncRes.data.remaining_seconds,
        progress_percent: tvSyncRes.data.progress_percent
      });
      setTimeRemaining(Math.ceil(tvSyncRes.data.remaining_seconds / 60));
      setViewers(Math.floor(Math.random() * 10000) + 2000);
      setTickers(tickerRes.data.tickers);
      setChatMessages(chatRes.data.messages);
      setStreamConfig(streamRes.data);
      setUpcomingVideos(contentRes.data.content.slice(0, 4));
      
      if (newLiveMode) {
        fetchComments("live_stream", true);
      } else if (current?.id) {
        fetchComments(current.id, false);
      }
    } catch (error) {}
  }, [scheduleSlot, fetchComments]);

  useEffect(() => {
    fetchContent();
    const interval = setInterval(fetchContent, 30000);
    return () => clearInterval(interval);
  }, [fetchContent]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  const watchFromBeginning = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setWatchMode("beginning");
    }
  };

  const joinLive = () => {
    if (videoRef.current && liveSync) {
      videoRef.current.currentTime = liveSync.sync?.sync_to_position || 0;
      videoRef.current.play();
      setWatchMode("live");
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
      setIsPlaying(!videoRef.current.paused);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Navigation />
      <main className="pt-4 pb-16">
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-lg overflow-hidden bg-black"
              >
                <div className="aspect-video relative">
                  <UnmuteOverlay isMuted={isMuted} onUnmute={() => setIsMuted(false)} />
                  <video
                    ref={videoRef}
                    className={`w-full h-full object-contain bg-black ${isLiveMode && !streamError ? 'block' : 'hidden'}`}
                    playsInline
                    muted={isMuted}
                    autoPlay
                  />
                  {((!isLiveMode || streamError) || currentVideo?.is_creator_content) && currentVideo && (
                    <iframe
                      src={currentVideo.video_url?.includes('watch?v=') 
                        ? `https://www.youtube.com/embed/${currentVideo.video_url.split('watch?v=')[1].split('&')[0]}?autoplay=1&mute=${isMuted ? 1 : 0}` 
                        : currentVideo.video_url}
                      className="w-full h-full"
                      allow="autoplay; fullscreen"
                    />
                  )}
                </div>
              </motion.div>

              {scheduleInfo && (
                <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">Current Slot</p>
                    <p className="font-heading text-lg">{scheduleInfo.current_slot}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-400">Arizona Time</p>
                    <p className="font-mono text-lg text-yellow-400">{arizonaTime?.arizona_display}</p>
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={watchFromBeginning}>From Start</Button>
                <Button size="sm" className="bg-red-600" onClick={joinLive}>Join Live</Button>
              </div>

              {nextUp && (
                <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-4">
                  <div className="w-24 h-16 rounded overflow-hidden flex-shrink-0">
                    <img src={nextUp.thumbnail} alt={nextUp.title} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 uppercase">UP NEXT</p>
                    <h3 className="font-heading text-lg truncate">{nextUp.title}</h3>
                  </div>
                </div>
              )}

              <Link to="/play">
                <div className="mt-4 p-6 rounded-xl bg-gradient-to-r from-purple-900 to-red-900 border-2 border-purple-500/50">
                   <h3 className="text-xl font-bold">Play the Live Game</h3>
                   <p className="text-sm text-zinc-300">Win real prizes every 10 minutes!</p>
                </div>
              </Link>
            </div>

            <div className="lg:col-span-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg h-[500px] flex flex-col">
                <div className="p-4 border-b border-zinc-800 font-heading">LIVE CHAT</div>
                <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
                  {videoComments.map((c, i) => (
                    <div key={i} className="mb-2"><span className="font-bold" style={{color: c.color}}>{c.username}: </span>{c.message}</div>
                  ))}
                </ScrollArea>
                <form onSubmit={handleSubmitComment} className="p-4 border-t border-zinc-800 flex gap-2">
                  <input 
                    type="text" 
                    value={newComment} 
                    onChange={(e) => setNewComment(e.target.value)} 
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm"
                    placeholder="Chat..." 
                  />
                  <Button type="submit" size="sm">Send</Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
