import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Tv, Download, Play, Pause, Volume2, VolumeX, 
  Smartphone, Monitor, Square, Twitter, Instagram,
  Facebook, ExternalLink, Copy, Check, ArrowRight,
  Package, FileText, Zap, Radio, Flame, Youtube, Share2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const API = '/api';

// Official ZTVLIVE Social Links
const SOCIAL_LINKS = {
  youtube: "https://www.youtube.com/@ztvlivestream",
  facebook: "https://www.facebook.com/share/1FjPvy6Myj/",
  tiktok: "https://www.tiktok.com/@ztvlivestream",
  website: "https://www.ztvlivestream.com"
};

// Pre-filled captions for each platform
const SOCIAL_CAPTIONS = {
  twitter: {
    text: `🔥 ZTVLIVE is changing the game for creators:
• 70% revenue share
• Weekly payouts
• 24/7 distribution

Join now 👉 ${SOCIAL_LINKS.website}

#ZTVLIVE #ContentCreator #CreatorEconomy #GetPaid #LiveStreaming`,
    url: "https://twitter.com/intent/tweet"
  },
  tiktok: {
    text: `Getting paid to create content hits different 💰 Join ZTVLIVE and start earning what you deserve! 🔥

#ZTVLIVE #ContentCreator #CreatorEconomy #GetPaid #StreamingLife #TikTokCreator #MakeMoneyOnline #CreatorTips #LiveStreaming #WeeklyPayouts`,
    profile: SOCIAL_LINKS.tiktok
  },
  facebook: {
    text: `Ready to get paid what you're worth? 💰 ZTVLIVE offers 70% revenue share and weekly payouts to content creators. Join the movement! 🚀

✅ 70% Revenue Share
✅ Weekly Payouts  
✅ 24/7 Content Distribution
✅ Direct Fan Support & Tips

Sign up FREE: ${SOCIAL_LINKS.website}`,
    url: "https://www.facebook.com/sharer/sharer.php"
  },
  youtube: {
    title: "ZTVLIVE - Get Paid More for Your Content | Join Now",
    description: `Join ZTVLIVE today and start earning what you deserve! 💰

✅ 70% Revenue Share
✅ Weekly Payouts
✅ 24/7 Content Distribution
✅ Direct Fan Support & Tips

Sign up FREE: ${SOCIAL_LINKS.website}
Watch on Roku, Fire TV, and more!

#ZTVLIVE #ContentCreator #LiveStreaming #CreatorEconomy #GetPaid`,
    channel: SOCIAL_LINKS.youtube
  }
};

const AD_VIDEOS = [
  {
    id: "horizontal",
    name: "Horizontal 16:9 (Main)",
    description: "YouTube, Website, TV Ads, Facebook Feed",
    file: "/ztvlive_promo_premium.mp4",
    size: "1280x720",
    duration: "12s",
    platforms: ["YouTube", "Website", "TV", "Facebook"],
    icon: Monitor,
    aspect: "aspect-video"
  },
  {
    id: "events",
    name: "Events Promo",
    description: "Stream conferences, weddings & family events",
    file: "/ztvlive_events_promo.mp4",
    size: "1280x720",
    duration: "8s",
    platforms: ["All Platforms"],
    icon: Monitor,
    aspect: "aspect-video"
  },
  {
    id: "schedule",
    name: "Schedule & Share",
    description: "Show the scheduling feature",
    file: "/ztvlive_schedule_promo.mp4",
    size: "1280x720",
    duration: "8s",
    platforms: ["All Platforms"],
    icon: Monitor,
    aspect: "aspect-video"
  },
  {
    id: "notification",
    name: "Notifications",
    description: "Never miss a moment",
    file: "/ztvlive_notification_promo.mp4",
    size: "1280x720",
    duration: "8s",
    platforms: ["All Platforms"],
    icon: Monitor,
    aspect: "aspect-video"
  },
  {
    id: "install",
    name: "App Install",
    description: "Download on any device",
    file: "/ztvlive_app_install_promo.mp4",
    size: "1280x720",
    duration: "8s",
    platforms: ["All Platforms"],
    icon: Monitor,
    aspect: "aspect-video"
  },
  {
    id: "social",
    name: "Social Media Ad",
    description: "High-energy viral content",
    file: "/ztvlive_social_ad.mp4",
    size: "1280x720",
    duration: "8s",
    platforms: ["All Platforms"],
    icon: Monitor,
    aspect: "aspect-video"
  },
  {
    id: "vertical",
    name: "Vertical 9:16",
    description: "TikTok, Instagram Reels, YouTube Shorts",
    file: "/ztvlive_tiktok_vertical.mp4",
    size: "720x1280",
    duration: "8s",
    platforms: ["TikTok", "Reels", "Shorts"],
    icon: Smartphone,
    aspect: "aspect-[9/16]"
  }
];

const SQUARE_NOTE = "For Instagram Feed (1:1 Square): Use the Horizontal video and crop to center in your video editor, or let Instagram auto-crop when posting.";

export default function AdKitPage() {
  const [playing, setPlaying] = useState({});
  const [muted, setMuted] = useState({});
  const [copied, setCopied] = useState(false);
  const videoRefs = useRef({});

  const togglePlay = (id) => {
    const video = videoRefs.current[id];
    if (video) {
      if (video.paused) {
        video.play();
        setPlaying(prev => ({ ...prev, [id]: true }));
      } else {
        video.pause();
        setPlaying(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  const toggleMute = (id) => {
    const video = videoRefs.current[id];
    if (video) {
      video.muted = !video.muted;
      setMuted(prev => ({ ...prev, [id]: video.muted }));
    }
  };

  const downloadVideo = (file, name) => {
    const link = document.createElement('a');
    link.href = file;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloading ${name}...`);
  };

  const downloadAllAsZip = () => {
    toast.loading("Preparing your download...", { id: "zip-download" });
    
    // Create download link
    const link = document.createElement('a');
    link.href = `${API}/ad-kit/download-all`;
    link.download = "ZTVLIVE_Ad_Kit.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      toast.success("Download started! Check your downloads folder.", { id: "zip-download" });
    }, 1000);
  };

  // Share to Social functions
  const shareToTwitter = () => {
    const url = `${SOCIAL_CAPTIONS.twitter.url}?text=${encodeURIComponent(SOCIAL_CAPTIONS.twitter.text)}`;
    window.open(url, '_blank', 'width=600,height=400');
    toast.success("Opening Twitter with pre-filled post!");
  };

  const shareToFacebook = () => {
    const url = `${SOCIAL_CAPTIONS.facebook.url}?u=${encodeURIComponent(SOCIAL_LINKS.website)}&quote=${encodeURIComponent(SOCIAL_CAPTIONS.facebook.text)}`;
    window.open(url, '_blank', 'width=600,height=400');
    toast.success("Opening Facebook with pre-filled post!");
  };

  const copyTikTokCaption = () => {
    navigator.clipboard.writeText(SOCIAL_CAPTIONS.tiktok.text);
    toast.success("TikTok caption copied! Open TikTok to paste.");
    // Also open TikTok profile
    setTimeout(() => {
      window.open(SOCIAL_LINKS.tiktok, '_blank');
    }, 500);
  };

  const copyYouTubeDescription = () => {
    const fullText = `${SOCIAL_CAPTIONS.youtube.title}\n\n${SOCIAL_CAPTIONS.youtube.description}`;
    navigator.clipboard.writeText(fullText);
    toast.success("YouTube title & description copied!");
    // Open YouTube channel
    setTimeout(() => {
      window.open(SOCIAL_LINKS.youtube, '_blank');
    }, 500);
  };

  const copyInstagramCaption = () => {
    const caption = `Getting paid to create content hits different 💰 Join @ztvlivestream and start earning what you deserve! Link in bio 🔥

#ZTVLIVE #ContentCreator #CreatorEconomy #GetPaid #StreamingLife #ReelsCreator #MakeMoneyOnline #LiveStreaming #24x7Live #WeeklyPayouts`;
    navigator.clipboard.writeText(caption);
    toast.success("Instagram caption copied!");
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied!");
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Tv className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">ZTVLIVE</span>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={copyShareLink}
              className="border-zinc-700 text-gray-300"
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Share Kit"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mb-4">
            MARKETING RESOURCES
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Social Media Ad Kit
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-6">
            Professional promo videos optimized for every platform. Download and use to promote ZTVLIVE or your creator channel.
          </p>
          
          {/* Download All Button */}
          <Button
            onClick={downloadAllAsZip}
            size="lg"
            className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
            data-testid="download-all-btn"
          >
            <Package className="w-5 h-5 mr-2" />
            Download All (ZIP with Captions & Hashtags)
          </Button>
        </motion.div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {AD_VIDEOS.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden"
            >
              {/* Video Player */}
              <div className={`relative bg-black ${video.id === 'vertical' ? 'max-h-[400px] flex justify-center' : ''}`}>
                <video
                  ref={el => videoRefs.current[video.id] = el}
                  src={video.file}
                  className={`${video.id === 'vertical' ? 'h-[400px] w-auto' : 'w-full'} object-contain`}
                  loop
                  muted
                  playsInline
                  data-testid={`ad-video-${video.id}`}
                />
                
                {/* Controls Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePlay(video.id)}
                        className="w-10 h-10 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors"
                        data-testid={`play-${video.id}`}
                      >
                        {playing[video.id] ? (
                          <Pause className="w-5 h-5 text-white" />
                        ) : (
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleMute(video.id)}
                        className="w-10 h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                      >
                        {muted[video.id] !== false ? (
                          <VolumeX className="w-5 h-5 text-white" />
                        ) : (
                          <Volume2 className="w-5 h-5 text-white" />
                        )}
                      </button>
                    </div>
                    <Badge className="bg-black/60 text-white">
                      {video.size}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <video.icon className="w-5 h-5 text-red-500" />
                      {video.name}
                    </h3>
                    <p className="text-gray-400">{video.description}</p>
                  </div>
                  <Badge className="bg-zinc-800 text-gray-300">
                    {video.duration}
                  </Badge>
                </div>

                {/* Platforms */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {video.platforms.map(platform => (
                    <Badge
                      key={platform}
                      className="bg-zinc-800/50 text-gray-400 border border-zinc-700"
                    >
                      {platform}
                    </Badge>
                  ))}
                </div>

                {/* Download Button */}
                <Button
                  onClick={() => downloadVideo(video.file, `ztvlive_${video.id}_promo.mp4`)}
                  className="w-full bg-red-600 hover:bg-red-500"
                  data-testid={`download-${video.id}`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download {video.name}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Square Format Note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-zinc-800/30 border border-zinc-700 rounded-xl p-4 mb-12"
        >
          <div className="flex items-start gap-3">
            <Square className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium">Instagram Feed (1:1 Square)</p>
              <p className="text-gray-400 text-sm">{SQUARE_NOTE}</p>
            </div>
          </div>
        </motion.div>

        {/* Usage Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 mb-12"
        >
          <h2 className="text-2xl font-bold text-white mb-6">How to Use These Videos</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-zinc-800/50 rounded-xl">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3">
                <Instagram className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-bold text-white mb-2">Instagram & TikTok</h3>
              <p className="text-gray-400 text-sm">
                Use the Vertical 9:16 video for Reels, Stories, and TikTok posts. Optimized for mobile-first viewing.
              </p>
            </div>
            
            <div className="p-4 bg-zinc-800/50 rounded-xl">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center mb-3">
                <Monitor className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="font-bold text-white mb-2">YouTube & Website</h3>
              <p className="text-gray-400 text-sm">
                Use the Horizontal 16:9 video for YouTube ads, website embeds, and desktop-focused campaigns.
              </p>
            </div>
            
            <div className="p-4 bg-zinc-800/50 rounded-xl">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-3">
                <Facebook className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="font-bold text-white mb-2">Facebook & Twitter</h3>
              <p className="text-gray-400 text-sm">
                Both formats work! Use Horizontal for feed posts, Vertical for Stories and mobile feeds.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Share to Social Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gradient-to-br from-blue-900/20 via-zinc-900 to-pink-900/20 border border-zinc-800 rounded-2xl p-8 mb-12"
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Share2 className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Share to Social</h2>
            <p className="text-gray-400">Click to post with optimized captions - ready to go!</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Twitter/X */}
            <button
              onClick={shareToTwitter}
              className="flex flex-col items-center p-4 bg-zinc-800/50 hover:bg-[#1DA1F2]/20 border border-zinc-700 hover:border-[#1DA1F2]/50 rounded-xl transition-all group"
              data-testid="share-twitter"
            >
              <Twitter className="w-8 h-8 text-[#1DA1F2] mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-white font-medium text-sm">Twitter/X</span>
              <span className="text-gray-500 text-xs">Post now</span>
            </button>

            {/* Facebook */}
            <button
              onClick={shareToFacebook}
              className="flex flex-col items-center p-4 bg-zinc-800/50 hover:bg-[#4267B2]/20 border border-zinc-700 hover:border-[#4267B2]/50 rounded-xl transition-all group"
              data-testid="share-facebook"
            >
              <Facebook className="w-8 h-8 text-[#4267B2] mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-white font-medium text-sm">Facebook</span>
              <span className="text-gray-500 text-xs">Share now</span>
            </button>

            {/* TikTok */}
            <button
              onClick={copyTikTokCaption}
              className="flex flex-col items-center p-4 bg-zinc-800/50 hover:bg-pink-500/20 border border-zinc-700 hover:border-pink-500/50 rounded-xl transition-all group"
              data-testid="share-tiktok"
            >
              <svg className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" fill="#ff0050"/>
              </svg>
              <span className="text-white font-medium text-sm">TikTok</span>
              <span className="text-gray-500 text-xs">Copy caption</span>
            </button>

            {/* Instagram */}
            <button
              onClick={copyInstagramCaption}
              className="flex flex-col items-center p-4 bg-zinc-800/50 hover:bg-gradient-to-br hover:from-purple-500/20 hover:to-pink-500/20 border border-zinc-700 hover:border-pink-500/50 rounded-xl transition-all group"
              data-testid="share-instagram"
            >
              <Instagram className="w-8 h-8 text-pink-500 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-white font-medium text-sm">Instagram</span>
              <span className="text-gray-500 text-xs">Copy caption</span>
            </button>

            {/* YouTube */}
            <button
              onClick={copyYouTubeDescription}
              className="flex flex-col items-center p-4 bg-zinc-800/50 hover:bg-red-500/20 border border-zinc-700 hover:border-red-500/50 rounded-xl transition-all group"
              data-testid="share-youtube"
            >
              <Youtube className="w-8 h-8 text-red-500 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-white font-medium text-sm">YouTube</span>
              <span className="text-gray-500 text-xs">Copy desc</span>
            </button>
          </div>

          {/* Follow Us */}
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <p className="text-gray-500 text-sm text-center mb-3">Follow ZTVLIVE Official</p>
            <div className="flex justify-center gap-3">
              <a href={SOCIAL_LINKS.youtube} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-red-500 transition-colors">
                <Youtube className="w-6 h-6" />
              </a>
              <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#4267B2] transition-colors">
                <Facebook className="w-6 h-6" />
              </a>
              <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-500 transition-colors">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                </svg>
              </a>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-12"
        >
          <p className="text-gray-400 mb-4">Ready to start creating?</p>
          <Link to="/login">
            <Button size="lg" className="bg-red-600 hover:bg-red-500">
              Join ZTVLIVE as Creator
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>

        {/* Watch on Roku/FireTV Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-purple-900/30 via-zinc-900 to-red-900/30 border border-zinc-800 rounded-3xl p-8 md:p-12 text-center"
        >
          <div className="flex justify-center gap-4 mb-6">
            <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center">
              <Tv className="w-7 h-7 text-purple-400" />
            </div>
            <div className="w-14 h-14 bg-orange-500/20 rounded-2xl flex items-center justify-center">
              <Flame className="w-7 h-7 text-orange-400" />
            </div>
            <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center">
              <Radio className="w-7 h-7 text-blue-400" />
            </div>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Watch ZTVLIVE on Your TV
          </h2>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Stream 24/7 viral content on your big screen. Available on Roku, Fire TV, Apple TV, and more streaming devices.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 px-4 py-2 text-sm">
              <Tv className="w-4 h-4 mr-2" />
              Roku
            </Badge>
            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 px-4 py-2 text-sm">
              <Flame className="w-4 h-4 mr-2" />
              Fire TV
            </Badge>
            <Badge className="bg-gray-500/20 text-gray-300 border-gray-500/30 px-4 py-2 text-sm">
              <Tv className="w-4 h-4 mr-2" />
              Apple TV
            </Badge>
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 px-4 py-2 text-sm">
              <Monitor className="w-4 h-4 mr-2" />
              Smart TVs
            </Badge>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://channelstore.roku.com/search/ztvlive" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-500 w-full sm:w-auto">
                <Tv className="w-5 h-5 mr-2" />
                Get on Roku
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>
            <a href="https://www.amazon.com/gp/search?keywords=ztvlive" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white w-full sm:w-auto">
                <Flame className="w-5 h-5 mr-2" />
                Get on Fire TV
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>
            <Link to="/watch">
              <Button size="lg" variant="outline" className="border-zinc-700 text-gray-300 hover:text-white w-full sm:w-auto">
                <Play className="w-5 h-5 mr-2" />
                Watch Online
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-4 mt-12">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} ZTVLIVE. Videos generated with Sora 2 AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
