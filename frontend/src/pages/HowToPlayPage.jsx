import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Play, Users, Trophy, Zap, Share2, Copy, Check,
  Gamepad2, Gift, Clock, Star, ChevronRight, Volume2
} from "lucide-react";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function HowToPlayPage() {
  const [copied, setCopied] = useState(false);
  const [liveStats, setLiveStats] = useState({ players: 0 });

  // Fetch live player count
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(`${API}/api/live-survey/state`);
        setLiveStats({ players: res.data.player_count || 0 });
      } catch (e) {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleShare = async () => {
    const shareData = {
      title: 'How to Play ZTVLIVE',
      text: 'Watch how to play the ZTVLIVE live trivia game and win real prizes!',
      url: 'https://www.ztvlivestream.com/howtoplay'
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Link copied!");
      }
    } catch (e) {
      await navigator.clipboard.writeText(shareData.url);
      toast.success("Link copied!");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText('https://www.ztvlivestream.com/howtoplay');
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">ZTVLIVE</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              {liveStats.players} playing now
            </div>
            <Link to="/play">
              <Button className="bg-red-600 hover:bg-red-500">
                <Play className="w-4 h-4 mr-2" />
                Play Now
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Title Section */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-full text-sm mb-4"
          >
            <Play className="w-4 h-4" />
            Video Tutorial
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-black mb-4"
          >
            How to Play <span className="text-red-500">ZTVLIVE</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-zinc-400 max-w-2xl mx-auto"
          >
            Watch this quick video to learn how to play and win real prizes in our 24/7 live trivia game show!
          </motion.p>
        </div>

        {/* Video Player */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="relative rounded-2xl overflow-hidden border-2 border-red-600/30 shadow-2xl shadow-red-500/20 mb-8"
        >
          {/* Video Container */}
          <div className="relative aspect-video bg-black">
            <iframe
              src="https://ztvlive-app-ddc916fb.base44.app/Play"
              title="How to Play ZTVLIVE"
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          
          {/* Video Controls Bar */}
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 border-t border-zinc-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Volume2 className="w-4 h-4 text-red-500" />
                <span className="text-zinc-300">Click video to enable sound</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleShare}
                className="border-zinc-700 text-zinc-300 hover:text-white"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Link to="/play">
                <Button size="sm" className="bg-red-600 hover:bg-red-500">
                  <Play className="w-4 h-4 mr-2" />
                  Play Now
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Quick Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: Zap, title: "100% Free", desc: "No download or signup required", color: "text-green-400" },
            { icon: Gift, title: "Real Prizes", desc: "Win DoorDash & cash prizes", color: "text-yellow-400" },
            { icon: Clock, title: "24/7 Live", desc: "New round every 10 minutes", color: "text-purple-400" }
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 text-center"
            >
              <item.icon className={`w-8 h-8 mx-auto mb-3 ${item.color}`} />
              <h3 className="font-bold mb-1">{item.title}</h3>
              <p className="text-sm text-zinc-400">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Share Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-r from-red-900/20 to-zinc-900 border border-red-800/30 rounded-2xl p-6 md:p-8"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold mb-2">Share This Video</h2>
              <p className="text-zinc-400">Help your friends learn how to play and win!</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-4 py-2 w-full sm:w-auto">
                <code className="text-green-400 text-sm">ztvlivestream.com/howtoplay</code>
              </div>
              <Button
                onClick={copyLink}
                className={copied ? "bg-green-600" : "bg-red-600 hover:bg-red-500"}
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Play?</h2>
          <p className="text-zinc-400 mb-6">Join {liveStats.players > 0 ? liveStats.players : 'thousands of'} players competing right now!</p>
          <Link to="/play">
            <Button size="lg" className="bg-red-600 hover:bg-red-500 text-lg px-8 py-6 h-auto">
              <Gamepad2 className="w-6 h-6 mr-2" />
              Start Playing Now
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <span className="font-bold">ZTVLIVE</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link to="/play" className="hover:text-white">Play Game</Link>
            <Link to="/watch" className="hover:text-white">Watch Stream</Link>
            <Link to="/game" className="hover:text-white">Game Info</Link>
          </div>
          <div className="text-sm text-zinc-600">© 2026 ZTVLIVE</div>
        </div>
      </footer>
    </div>
  );
}
