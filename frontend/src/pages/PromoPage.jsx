import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Share2,
  Twitter, Facebook, Linkedin, Link2, Copy, Check,
  Tv, ArrowRight, Users, DollarSign, Zap, Globe,
  ChevronRight, Star, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function PromoPage() {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const promoVideoUrl = "/ztvlive_promo_premium.mp4";
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = "ZTVLIVE - Create. Stream. Earn. | 24/7 Live Content Platform";
  const shareDescription = "Join ZTVLIVE - Get paid more and faster. 24/7 live streaming, AI-powered content, direct fan support.";

  useEffect(() => {
    // Auto-play muted on load
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, []);

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
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied to clipboard!");
  };

  const shareToSocial = (platform) => {
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
    };
    window.open(urls[platform], '_blank', 'width=600,height=400');
    setShowShareMenu(false);
  };

  const features = [
    { icon: DollarSign, title: "Higher Earnings", desc: "Get paid more than other platforms" },
    { icon: Zap, title: "Fast Payouts", desc: "Weekly payments, no waiting" },
    { icon: Globe, title: "24/7 Distribution", desc: "Your content always streaming" },
    { icon: Users, title: "Direct Fan Support", desc: "Tips and subscriptions" }
  ];

  const stats = [
    { value: "10K+", label: "Active Creators" },
    { value: "$2M+", label: "Paid to Creators" },
    { value: "50M+", label: "Monthly Views" },
    { value: "24/7", label: "Live Content" }
  ];

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Tv className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">ZTVLIVE</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link to="/watch">
                <Button variant="ghost" className="text-gray-300 hover:text-white">
                  Watch Now
                </Button>
              </Link>
              <Link to="/login">
                <Button className="bg-red-600 hover:bg-red-700 text-white" data-testid="promo-join-btn">
                  Join Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Video */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mb-4">
              <Star className="w-3 h-3 mr-1" />
              Official Promo
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              Create. Stream. <span className="text-red-500">Earn.</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              The future of creator monetization is here. Join thousands earning more with ZTVLIVE.
            </p>
          </motion.div>

          {/* Video Player */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl shadow-red-500/10"
          >
            <div className="aspect-video relative">
              <video
                ref={videoRef}
                src={promoVideoUrl}
                className="w-full h-full object-cover"
                loop
                muted={isMuted}
                playsInline
                data-testid="promo-video"
              />

              {/* Video Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              {/* Play/Pause Overlay */}
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center group"
                data-testid="video-play-toggle"
              >
                {!isPlaying && (
                  <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                )}
              </button>

              {/* Video Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 text-white" />
                    ) : (
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={toggleMute}
                    className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    data-testid="video-mute-toggle"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5 text-white" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFullscreen}
                    className="w-10 h-10 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <Maximize className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Share Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-4 mt-8"
          >
            <span className="text-gray-400">Share this video:</span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => shareToSocial('twitter')}
              className="border-zinc-700 text-gray-300 hover:bg-[#1DA1F2] hover:text-white hover:border-[#1DA1F2]"
              data-testid="share-twitter"
            >
              <Twitter className="w-4 h-4 mr-2" />
              Twitter
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => shareToSocial('facebook')}
              className="border-zinc-700 text-gray-300 hover:bg-[#4267B2] hover:text-white hover:border-[#4267B2]"
              data-testid="share-facebook"
            >
              <Facebook className="w-4 h-4 mr-2" />
              Facebook
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => shareToSocial('linkedin')}
              className="border-zinc-700 text-gray-300 hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5]"
              data-testid="share-linkedin"
            >
              <Linkedin className="w-4 h-4 mr-2" />
              LinkedIn
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="border-zinc-700 text-gray-300 hover:text-white"
              data-testid="copy-link-btn"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Copy Link
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Why ZTVLIVE Section */}
      <section className="py-16 px-4 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why Creators Choose ZTVLIVE
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              We built ZTVLIVE to give creators what they deserve - higher earnings, faster payments, and more control.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-red-500/50 transition-colors"
              >
                <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-4xl md:text-5xl font-bold text-white mb-2">{stat.value}</p>
                <p className="text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="bg-gradient-to-br from-red-600/20 via-zinc-900 to-purple-600/20 border border-zinc-800 rounded-3xl p-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Start Earning?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Join ZTVLIVE today and start getting paid for your content.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login">
                <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white px-8" data-testid="cta-join-btn">
                  Start Streaming Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/watch">
                <Button size="lg" variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800 px-8">
                  Watch Live Content
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">ZTVLIVE</span>
          </Link>
          
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} ZTVLIVE. All rights reserved.
          </p>
          
          <div className="flex items-center gap-4">
            <a href="#" className="text-gray-400 hover:text-white">Terms</a>
            <a href="#" className="text-gray-400 hover:text-white">Privacy</a>
            <a href="#" className="text-gray-400 hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
