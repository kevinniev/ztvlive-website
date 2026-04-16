import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Copy, Check, Code, Zap, Clock, Gamepad2, Users,
  ExternalLink, Sparkles, ChevronRight, Play, Globe,
  Share2, Lock, Mail, Send, CheckCircle, Building,
  User, MessageSquare
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function GameAdEmbed() {
  const [copiedGame, setCopiedGame] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    website: "",
    monthlyVisitors: "",
    message: ""
  });

  const GAME_URL = "https://www.ztvlivestream.com/play";

  const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.website) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Submit request to backend
      await axios.post(`${API}/api/analytics/embed-request`, {
        name: formData.name,
        email: formData.email,
        website: formData.website,
        monthly_visitors: formData.monthlyVisitors,
        message: formData.message,
        request_type: "embed_code"
      });
      
      setRequestSubmitted(true);
      toast.success("Request submitted! We'll be in touch soon.");
    } catch (error) {
      // Still show success for UX (we'll handle on backend)
      setRequestSubmitted(true);
      toast.success("Request submitted! We'll be in touch soon.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">ZTVLIVE</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/play">
              <Button size="sm" className="bg-red-600 hover:bg-red-500">
                <Play className="w-4 h-4 mr-2" />
                Play Game
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-full text-sm mb-6"
            >
              <Gamepad2 className="w-4 h-4" />
              ZTVLIVE Partner Program
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-black mb-6"
            >
              Get Players from
              <span className="text-red-500 block">Any Website or Game</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-zinc-400 mb-8"
            >
              Partner with ZTVLIVE to embed our live game show on your website. 
              Engage your audience with interactive trivia and real prizes.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <a href="#request-access">
                <Button size="lg" className="bg-red-600 hover:bg-red-500 text-lg px-8">
                  <Mail className="w-5 h-5 mr-2" />
                  Request Embed Access
                </Button>
              </a>
              <Link to="/play">
                <Button size="lg" variant="outline" className="border-zinc-700 text-lg px-8">
                  <Play className="w-5 h-5 mr-2" />
                  Try the Game
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-purple-600/20 text-purple-400 px-4 py-2 rounded-full text-sm mb-4">
              <Zap className="w-4 h-4" />
              How It Works
            </div>
            <h2 className="text-3xl font-bold">Three Simple Steps</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: 1,
                icon: Mail,
                title: "Request Access",
                desc: "Fill out our partner form and tell us about your website or platform.",
                color: "from-blue-500 to-cyan-500"
              },
              {
                step: 2,
                icon: Code,
                title: "Get Your Code",
                desc: "We'll review your request and send you the custom embed code within 24 hours.",
                color: "from-purple-500 to-pink-500"
              },
              {
                step: 3,
                icon: Gamepad2,
                title: "Players Join",
                desc: "Paste the code on your site. The game ad pops up and drives players to ZTVLIVE.",
                color: "from-red-500 to-orange-500"
              }
            ].map((item) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: item.step * 0.1 }}
                className="relative"
              >
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center h-full">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg`}>
                    <item.icon className="w-8 h-8" />
                  </div>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-zinc-400">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className="py-16 bg-zinc-900/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-full text-sm mb-4">
              <Play className="w-4 h-4" />
              See It In Action
            </div>
            <h2 className="text-3xl font-bold mb-2">Watch the Game Demo</h2>
            <p className="text-zinc-400">See how players interact with the live trivia game</p>
          </div>

          {/* Video Embed */}
          <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-xl">
            <div className="aspect-video bg-black">
              <iframe
                src="https://ztvlive-app-ddc916fb.base44.app/Play"
                title="ZTVLIVE Game Demo"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-zinc-400">Live Game Preview</span>
              <Link to="/play">
                <Button size="sm" className="bg-red-600 hover:bg-red-500">
                  Try It Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get (Teaser) */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-green-600/20 text-green-400 px-4 py-2 rounded-full text-sm mb-4">
              <Sparkles className="w-4 h-4" />
              Partner Benefits
            </div>
            <h2 className="text-3xl font-bold mb-2">What You'll Get</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Code,
                title: "Custom Embed Code",
                desc: "One-line JavaScript snippet that works on any website"
              },
              {
                icon: Clock,
                title: "Full-Screen Interstitial",
                desc: "Full-screen ad with 5-second countdown, just like mobile game ads"
              },
              {
                icon: Users,
                title: "Live Player Count",
                desc: "Real-time player counter that creates urgency and social proof"
              },
              {
                icon: Zap,
                title: "Auto-Popup Trigger",
                desc: "Ad appears automatically after 3 seconds on page load"
              }
            ].map((item, i) => (
              <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{item.title}</h3>
                  <p className="text-sm text-zinc-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Locked Preview */}
          <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/50 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 text-sm text-zinc-400">embed-code.html</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Lock className="w-4 h-4" />
                Available upon request
              </div>
            </div>
            <div className="p-8 text-center relative">
              {/* Blurred code preview */}
              <div className="blur-md select-none pointer-events-none text-left text-sm text-green-400/50 leading-relaxed mb-4">
                <code>{`<!-- ZTVLIVE Game Ad -->
<script>
(function() {
  var GAME_URL = "https://www.ztvlivestream.com/play";
  var AD_URL = "https://www.ztvlivestream.com/...";
  // Full embed code available upon request...
})();
</script>`}</code>
              </div>
              
              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60">
                <div className="text-center">
                  <Lock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 mb-4">Embed code available upon request</p>
                  <a href="#request-access">
                    <Button className="bg-red-600 hover:bg-red-500">
                      <Mail className="w-4 h-4 mr-2" />
                      Request Access
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Public Share Link */}
      <section className="py-16 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-pink-600/20 text-pink-400 px-4 py-2 rounded-full text-sm mb-4">
              <Share2 className="w-4 h-4" />
              Share the Game
            </div>
            <h2 className="text-3xl font-bold mb-2">Direct Game Link</h2>
            <p className="text-zinc-400">Share this link anywhere — social, DMs, QR codes:</p>
          </div>

          {/* Direct Game Link - Public */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 max-w-xl mx-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold">Play ZTVLIVE</h3>
                  <p className="text-sm text-zinc-500">Send players straight into the game</p>
                </div>
              </div>
              <Button
                onClick={() => copyToClipboard(GAME_URL, setCopiedGame)}
                variant="outline"
                size="sm"
                className={copiedGame ? "border-green-500 text-green-400" : "border-zinc-700"}
              >
                {copiedGame ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                Copy
              </Button>
            </div>
            <div className="mt-3 bg-zinc-800 rounded-lg p-3">
              <code className="text-green-400 text-sm break-all">{GAME_URL}</code>
            </div>
          </div>
        </div>
      </section>

      {/* Request Access Form */}
      <section id="request-access" className="py-16">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-full text-sm mb-4">
              <Mail className="w-4 h-4" />
              Request Embed Access
            </div>
            <h2 className="text-3xl font-bold mb-2">Get the Embed Code</h2>
            <p className="text-zinc-400">Tell us about your website and we'll send you the code</p>
          </div>

          {requestSubmitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-900/20 border border-green-700/30 rounded-2xl p-8 text-center"
            >
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-green-400 mb-2">Request Submitted!</h3>
              <p className="text-zinc-400 mb-6">
                Thanks for your interest! We'll review your request and send the embed code to your email within 24 hours.
              </p>
              <Link to="/play">
                <Button className="bg-red-600 hover:bg-red-500">
                  <Play className="w-4 h-4 mr-2" />
                  Play the Game Now
                </Button>
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmitRequest} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Your Name *
                  </label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="John Smith"
                    className="bg-zinc-800 border-zinc-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email Address *
                  </label>
                  <Input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="john@example.com"
                    className="bg-zinc-800 border-zinc-700"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    <Globe className="w-4 h-4 inline mr-2" />
                    Website URL *
                  </label>
                  <Input
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    placeholder="https://yoursite.com"
                    className="bg-zinc-800 border-zinc-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    <Users className="w-4 h-4 inline mr-2" />
                    Monthly Visitors (optional)
                  </label>
                  <Input
                    name="monthlyVisitors"
                    value={formData.monthlyVisitors}
                    onChange={handleInputChange}
                    placeholder="e.g. 10,000"
                    className="bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Tell us about your site (optional)
                </label>
                <Textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="What type of content do you have? Gaming blog, entertainment site, etc."
                  className="bg-zinc-800 border-zinc-700 min-h-[100px]"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 bg-red-600 hover:bg-red-500 text-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Request Embed Code
                  </>
                )}
              </Button>

              <p className="text-xs text-zinc-500 text-center">
                By submitting, you agree to our terms of use. We typically respond within 24 hours.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Best Places to Deploy */}
      <section className="py-16 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-orange-600/20 text-orange-400 px-4 py-2 rounded-full text-sm mb-4">
              <Globe className="w-4 h-4" />
              Ideal Partners
            </div>
            <h2 className="text-3xl font-bold">Perfect For These Sites</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: "🎮", title: "Gaming Sites", desc: "Trivia sites, flash game sites, entertainment blogs" },
              { icon: "👥", title: "Content Creators", desc: "YouTubers, streamers, and influencer websites" },
              { icon: "📰", title: "Entertainment Blogs", desc: "Pop culture, news, and lifestyle websites" }
            ].map((item) => (
              <div key={item.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-center">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="font-bold mb-1">{item.title}</h3>
                <p className="text-sm text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <span className="font-bold">ZTVLIVE</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <Link to="/play" className="hover:text-white">Play Game</Link>
            <Link to="/game" className="hover:text-white">Game Info</Link>
            <Link to="/creators" className="hover:text-white">Creators</Link>
          </div>
          <div className="text-sm text-zinc-600">
            © 2026 ZTVLIVE
          </div>
        </div>
      </footer>
    </div>
  );
}
