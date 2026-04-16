import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Tv, Play, Pause, Volume2, VolumeX, Maximize, SkipForward,
  Flame, Radio, Music, Gamepad2, Mic, DollarSign, Users,
  ArrowRight, ExternalLink, Download, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";

// Promo playlist - loops 24/7
const PROMO_PLAYLIST = [
  {
    id: "premium",
    title: "ZTVLIVE - Create. Stream. Earn.",
    description: "The future of creator monetization is here",
    file: "/ztvlive_promo_premium.mp4",
    duration: 12,
    theme: "general",
    color: "from-red-600/30"
  },
  {
    id: "events",
    title: "Stream Your Events Live",
    description: "Share conferences, weddings & reunions with the world",
    file: "/ztvlive_events_promo.mp4",
    duration: 8,
    theme: "events",
    color: "from-blue-600/30"
  },
  {
    id: "gaming",
    title: "ZTVLIVE Gaming",
    description: "Stream your games. Get paid.",
    file: "/ztvlive_gaming_promo.mp4",
    duration: 8,
    theme: "gaming",
    color: "from-purple-600/30"
  },
  {
    id: "schedule",
    title: "Schedule & Share",
    description: "Book your slot. Invite friends & family.",
    file: "/ztvlive_schedule_promo.mp4",
    duration: 8,
    theme: "schedule",
    color: "from-violet-600/30"
  },
  {
    id: "music",
    title: "ZTVLIVE Music",
    description: "Share your music. Build your fanbase.",
    file: "/ztvlive_music_promo.mp4",
    duration: 8,
    theme: "music",
    color: "from-amber-600/30"
  },
  {
    id: "notification",
    title: "Never Miss a Moment",
    description: "Get notified when your favorite content goes live",
    file: "/ztvlive_notification_promo.mp4",
    duration: 8,
    theme: "notification",
    color: "from-yellow-600/30"
  },
  {
    id: "podcast",
    title: "ZTVLIVE Podcasts",
    description: "Start your podcast. Build your audience.",
    file: "/ztvlive_podcast_promo.mp4",
    duration: 8,
    theme: "podcast",
    color: "from-green-600/30"
  },
  {
    id: "install",
    title: "Download on Any Device",
    description: "Watch on Android, iOS, Desktop - anywhere!",
    file: "/ztvlive_app_install_promo.mp4",
    duration: 8,
    theme: "install",
    color: "from-cyan-600/30"
  },
  {
    id: "social",
    title: "Viral Highlights",
    description: "The best moments from across the platform",
    file: "/ztvlive_social_ad.mp4",
    duration: 8,
    theme: "social",
    color: "from-pink-600/30"
  }
];

export default function PromoPlaylistPage() {
  const videoRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [loopCount, setLoopCount] = useState(0);

  const currentPromo = PROMO_PLAYLIST[currentIndex];

  const playNext = useCallback(() => {
    setCurrentIndex(prev => {
      const nextIndex = (prev + 1) % PROMO_PLAYLIST.length;
      if (nextIndex === 0) {
        setLoopCount(c => c + 1);
      }
      return nextIndex;
    });
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      playNext();
    };

    video.addEventListener('ended', handleEnded);
    
    // Auto-play when video changes
    video.play().catch(() => {});
    setIsPlaying(true);

    return () => {
      video.removeEventListener('ended', handleEnded);
    };
  }, [currentIndex, playNext]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current?.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const skipToNext = () => {
    playNext();
    toast.info(`Playing: ${PROMO_PLAYLIST[(currentIndex + 1) % PROMO_PLAYLIST.length].title}`);
  };

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <main className="pt-4">
        {/* Video Player Section */}
        <div className="relative bg-black">
          <div className="max-w-6xl mx-auto">
            <div className="aspect-video relative overflow-hidden rounded-none md:rounded-2xl md:mx-4">
              {/* Video */}
              <video
                ref={videoRef}
                key={currentPromo.file}
                src={currentPromo.file}
                className="w-full h-full object-cover"
                autoPlay
                muted={isMuted}
                playsInline
                data-testid="promo-playlist-video"
              />

              {/* Gradient Overlays */}
              <div className={`absolute inset-0 bg-gradient-to-t ${currentPromo.color} to-transparent opacity-50`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

              {/* Top Badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <Badge className="bg-red-600 text-white animate-pulse">
                  <span className="w-2 h-2 bg-white rounded-full mr-2" />
                  24/7 PROMO STREAM
                </Badge>
                <Badge className="bg-black/60 text-white">
                  Loop #{loopCount + 1}
                </Badge>
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                <motion.div
                  key={currentPromo.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4"
                >
                  <Badge className="bg-white/20 text-white mb-2">
                    {currentIndex + 1} / {PROMO_PLAYLIST.length}
                  </Badge>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    {currentPromo.title}
                  </h2>
                  <p className="text-gray-300">{currentPromo.description}</p>
                </motion.div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="w-12 h-12 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                      data-testid="playlist-play-btn"
                    >
                      {isPlaying ? (
                        <Pause className="w-6 h-6 text-white" />
                      ) : (
                        <Play className="w-6 h-6 text-white ml-0.5" />
                      )}
                    </button>
                    <button
                      onClick={toggleMute}
                      className="w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                      data-testid="playlist-mute-btn"
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-white" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                    <button
                      onClick={skipToNext}
                      className="w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                      data-testid="playlist-skip-btn"
                    >
                      <SkipForward className="w-5 h-5 text-white" />
                    </button>
                  </div>
                  
                  <button
                    onClick={handleFullscreen}
                    className="w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                  >
                    <Maximize className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Playlist Thumbnails */}
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h3 className="text-lg font-bold text-white mb-4">Up Next</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {PROMO_PLAYLIST.map((promo, index) => (
              <button
                key={promo.id}
                onClick={() => setCurrentIndex(index)}
                className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${
                  index === currentIndex
                    ? "border-red-500 ring-2 ring-red-500/50"
                    : "border-transparent hover:border-zinc-700"
                }`}
              >
                <video
                  src={promo.file}
                  className="w-full h-full object-cover"
                  muted
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-white text-sm font-medium truncate">{promo.title}</p>
                </div>
                {index === currentIndex && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-red-600 text-white text-xs">
                      NOW PLAYING
                    </Badge>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-gradient-to-br from-red-900/30 via-zinc-900 to-purple-900/30 border border-zinc-800 rounded-2xl p-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Join ZTVLIVE?
            </h2>
            <p className="text-gray-400 mb-6 max-w-xl mx-auto">
              Start earning 70% revenue share with weekly payouts. Stream 24/7, reach millions of viewers.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Link to="/login">
                <Button size="lg" className="bg-red-600 hover:bg-red-500">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Join as Creator
                </Button>
              </Link>
              <Link to="/ad-kit">
                <Button size="lg" variant="outline" className="border-zinc-700 text-white">
                  <Download className="w-5 h-5 mr-2" />
                  Download Ad Kit
                </Button>
              </Link>
            </div>

            {/* Watch on TV */}
            <div className="border-t border-zinc-800 pt-6">
              <p className="text-gray-500 text-sm mb-4">Also available on</p>
              <div className="flex flex-wrap justify-center gap-4">
                <a href="https://channelstore.roku.com" target="_blank" rel="noopener noreferrer">
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 px-4 py-2 hover:bg-purple-500/30 cursor-pointer">
                    <Tv className="w-4 h-4 mr-2" />
                    Roku
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Badge>
                </a>
                <a href="https://www.amazon.com/gp/search?keywords=ztvlive" target="_blank" rel="noopener noreferrer">
                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 px-4 py-2 hover:bg-orange-500/30 cursor-pointer">
                    <Flame className="w-4 h-4 mr-2" />
                    Fire TV
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Badge>
                </a>
                <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/30 px-4 py-2">
                  <Radio className="w-4 h-4 mr-2" />
                  Apple TV
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-6 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} ZTVLIVE. Promos generated with Sora 2 AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
