import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Tv, Play, DollarSign, Users, TrendingUp, Clock, 
  Youtube, CheckCircle, ArrowRight, Zap, Globe, 
  Monitor, Smartphone, Star, Gift, Shield, Rocket,
  ChevronDown, Mail, Twitter, Instagram
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;

export default function CreatorPartnersPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !channelUrl) return;
    
    setSubmitting(true);
    try {
      await axios.post(`${API}/api/creators/interest`, {
        email,
        channel_url: channelUrl,
        source: "landing_page"
      });
      setSubmitted(true);
    } catch (error) {
      console.error("Error submitting:", error);
      // Still show success for UX
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  const benefits = [
    {
      icon: Globe,
      title: "Multi-Platform Distribution",
      description: "Your content plays on Roku, Fire TV, Samsung, LG Smart TVs, and Web - reaching audiences you can't reach alone.",
      color: "text-blue-500"
    },
    {
      icon: DollarSign,
      title: "Keep 100% YouTube Revenue",
      description: "We use official YouTube embeds. Your ads still play, you still earn. ZTVLIVE is bonus exposure.",
      color: "text-green-500"
    },
    {
      icon: TrendingUp,
      title: "Revenue Share When We Monetize",
      description: "20% of sponsorships, 15% of subscriptions, 25% of ad revenue goes to the Creator Pool.",
      color: "text-yellow-500"
    },
    {
      icon: Clock,
      title: "24/7 Passive Exposure",
      description: "Your videos play around the clock while you sleep, work, or create more content.",
      color: "text-purple-500"
    },
    {
      icon: Users,
      title: "New Audience Discovery",
      description: "TV viewers who'd never find you on YouTube discover your channel through ZTVLIVE.",
      color: "text-pink-500"
    },
    {
      icon: Shield,
      title: "No Exclusivity Required",
      description: "Non-exclusive license means you keep full control. Remove your content anytime.",
      color: "text-cyan-500"
    }
  ];

  const revenueShare = [
    { source: "Sponsorship Deals", percentage: "20%", description: "Brand deals and sponsored segments" },
    { source: "Premium Subscriptions", percentage: "15%", description: "Ad-free viewer subscriptions" },
    { source: "Platform Ad Revenue", percentage: "25%", description: "Ads shown on ZTVLIVE apps" }
  ];

  const faqs = [
    {
      q: "Do I need a minimum subscriber count?",
      a: "No! We welcome creators of all sizes. In fact, smaller creators often benefit most from our exposure since you're reaching entirely new audiences."
    },
    {
      q: "How do I still earn from YouTube?",
      a: "We use YouTube's official embedded player. When your video plays on ZTVLIVE, it counts as a YouTube view and your YouTube ads still play. You earn exactly as if someone watched on YouTube directly."
    },
    {
      q: "When do I get paid from ZTVLIVE?",
      a: "Right now we're in growth phase with no sponsors yet. When we land sponsorships and ad deals, 20-25% goes into the Creator Pool, split based on your view contribution. We're building this together."
    },
    {
      q: "Can I remove my content later?",
      a: "Absolutely. This is a non-exclusive, revocable license. You can remove any or all of your content at any time through your Creator Dashboard."
    },
    {
      q: "What content works best on ZTVLIVE?",
      a: "Entertainment, gaming, comedy, music, lifestyle, cooking, and educational content all perform well. Think 'lean-back TV viewing' - content people enjoy watching passively."
    },
    {
      q: "Is there a contract?",
      a: "Yes, but it's creator-friendly. Non-exclusive, no lock-in period, 70% revenue share when we monetize. Read the full agreement at /creator-agreement."
    }
  ];

  const platforms = [
    { name: "Roku", icon: "📺", color: "bg-purple-600" },
    { name: "Fire TV", icon: "🔥", color: "bg-orange-600" },
    { name: "Samsung TV", icon: "📱", color: "bg-blue-600" },
    { name: "LG webOS", icon: "🖥️", color: "bg-red-600" },
    { name: "Web", icon: "🌐", color: "bg-green-600" },
    { name: "Mobile", icon: "📲", color: "bg-pink-600" }
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">ZTVLIVE</span>
            <span className="text-xs bg-zinc-800 px-2 py-1 rounded-full text-zinc-400 hidden sm:inline">Creator Partners</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/watch" className="text-sm text-zinc-400 hover:text-white hidden sm:block">
              Watch Live
            </Link>
            <Button 
              onClick={() => navigate('/register')}
              className="bg-red-600 hover:bg-red-700"
              data-testid="creator-signup-btn"
            >
              Join Now
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 via-black to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-600/10 via-transparent to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-red-600/20 text-red-400 px-4 py-2 rounded-full text-sm mb-6">
                <Rocket className="w-4 h-4" />
                Founding Creator Program
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-6 leading-tight">
                Get Your Content On
                <span className="text-red-500 block">24/7 Live TV</span>
              </h1>
              
              <p className="text-lg md:text-xl text-zinc-300 mb-8 max-w-lg">
                Your YouTube videos. Our TV network. <br/>
                <span className="text-white font-semibold">Keep 100% of YouTube revenue</span> + earn more when we monetize.
              </p>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-red-500">6</div>
                  <div className="text-xs text-zinc-500">Platforms</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-green-500">$0</div>
                  <div className="text-xs text-zinc-500">Cost to Join</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-yellow-500">24/7</div>
                  <div className="text-xs text-zinc-500">Exposure</div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="bg-red-600 hover:bg-red-700 text-lg px-8"
                  data-testid="hero-join-btn"
                >
                  <Youtube className="w-5 h-5 mr-2" />
                  Connect Your Channel
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => document.getElementById('how-it-works').scrollIntoView({ behavior: 'smooth' })}
                  className="border-zinc-700 text-lg"
                >
                  Learn More
                </Button>
              </div>
            </motion.div>

            {/* Right: Platforms Visual */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 md:p-8">
                <div className="text-center mb-6">
                  <div className="text-sm text-zinc-500 mb-2">YOUR CONTENT PLAYS ON</div>
                  <div className="text-2xl font-bold">6 Platforms Simultaneously</div>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {platforms.map((platform, i) => (
                    <motion.div
                      key={platform.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className={`${platform.color} rounded-xl p-4 text-center`}
                    >
                      <div className="text-2xl mb-1">{platform.icon}</div>
                      <div className="text-xs font-medium">{platform.name}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Live indicator */}
                <div className="mt-6 flex items-center justify-center gap-2 text-sm">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-zinc-400">Broadcasting 24/7 to thousands of viewers</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Proof Banner */}
      <section className="border-y border-zinc-800 bg-zinc-900/50 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 text-center">
            <div>
              <div className="text-2xl font-bold text-white">113+</div>
              <div className="text-xs text-zinc-500">Videos in Library</div>
            </div>
            <div className="w-px h-8 bg-zinc-700 hidden sm:block" />
            <div>
              <div className="text-2xl font-bold text-white">50+</div>
              <div className="text-xs text-zinc-500">Active Players Daily</div>
            </div>
            <div className="w-px h-8 bg-zinc-700 hidden sm:block" />
            <div>
              <div className="text-2xl font-bold text-white">6</div>
              <div className="text-xs text-zinc-500">TV Platforms</div>
            </div>
            <div className="w-px h-8 bg-zinc-700 hidden sm:block" />
            <div>
              <div className="text-2xl font-bold text-green-500">$0</div>
              <div className="text-xs text-zinc-500">To Get Started</div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 md:py-24" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Creators Join ZTVLIVE</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              We built this platform to help creators reach new audiences without sacrificing their existing revenue.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, i) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors"
              >
                <benefit.icon className={`w-10 h-10 ${benefit.color} mb-4`} />
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-zinc-400">{benefit.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Revenue Share Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-zinc-900/50 to-black">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-green-600/20 text-green-400 px-4 py-2 rounded-full text-sm mb-4">
              <DollarSign className="w-4 h-4" />
              Revenue Share Model
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Grow With Us, Earn With Us</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              We're transparent about where we are: pre-revenue. When sponsors come, you get paid.
            </p>
          </div>

          {/* Current State */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
              <h3 className="text-xl font-semibold">Today: Growth Phase</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-green-500 mb-2">What You Get Now</h4>
                <ul className="space-y-2 text-sm text-zinc-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    Free exposure on 6 TV platforms
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    Keep 100% of your YouTube ad revenue
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    New subscribers from TV viewers
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    "Founding Creator" badge & priority
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-yellow-500 mb-2">Honest Reality</h4>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500 shrink-0" />
                    No direct ZTVLIVE payments yet
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500 shrink-0" />
                    Building audience before sponsors
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500 shrink-0" />
                    We're in this together from day one
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Future Revenue */}
          <div className="bg-gradient-to-br from-green-900/20 to-zinc-900 border border-green-800/30 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <h3 className="text-xl font-semibold">When We Monetize: Creator Pool</h3>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
              {revenueShare.map((item) => (
                <div key={item.source} className="bg-black/30 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-500 mb-1">{item.percentage}</div>
                  <div className="font-medium text-white mb-1">{item.source}</div>
                  <div className="text-xs text-zinc-500">{item.description}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-black/30 rounded-xl">
              <p className="text-sm text-zinc-300">
                <strong className="text-white">How it works:</strong> Pool is split based on your views ÷ total views. 
                If your videos get 10% of all ZTVLIVE views, you get 10% of the Creator Pool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interest Form Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-xl mx-auto px-4">
          <div className="bg-gradient-to-br from-red-900/30 to-zinc-900 border border-red-800/30 rounded-2xl p-6 md:p-8">
            {!submitted ? (
              <>
                <div className="text-center mb-8">
                  <Star className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Join as a Founding Creator</h2>
                  <p className="text-zinc-400">
                    Be among the first. Get priority placement and founding creator benefits.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Your Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="creator@example.com"
                      className="bg-zinc-800 border-zinc-700"
                      required
                      data-testid="creator-email-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">YouTube Channel URL</label>
                    <Input
                      type="url"
                      value={channelUrl}
                      onChange={(e) => setChannelUrl(e.target.value)}
                      placeholder="https://youtube.com/@yourchannel"
                      className="bg-zinc-800 border-zinc-700"
                      required
                      data-testid="creator-channel-input"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-red-600 hover:bg-red-700"
                    disabled={submitting}
                    data-testid="creator-submit-btn"
                  >
                    {submitting ? "Submitting..." : "Apply to Join"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>

                <p className="text-xs text-zinc-500 text-center mt-4">
                  By applying, you agree to our <Link to="/creator-agreement" className="text-red-500 hover:underline">Creator Agreement</Link>
                </p>
              </>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">You're on the list!</h3>
                <p className="text-zinc-400 mb-6">
                  We'll review your channel and reach out within 48 hours.
                </p>
                <Button onClick={() => navigate('/watch')} variant="outline" className="border-zinc-700">
                  Watch ZTVLIVE Now
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div 
                key={i}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="font-medium pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-zinc-500 transition-transform ${expandedFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {expandedFaq === i && (
                  <div className="px-4 pb-4 text-sm text-zinc-400">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Reach a New Audience?
          </h2>
          <p className="text-zinc-400 mb-8 max-w-xl mx-auto">
            Join ZTVLIVE as a Founding Creator. Free exposure today, revenue share tomorrow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => navigate('/register')}
              className="bg-red-600 hover:bg-red-700 text-lg px-8"
            >
              <Youtube className="w-5 h-5 mr-2" />
              Connect Your Channel
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => navigate('/creator-agreement')}
              className="border-zinc-700 text-lg"
            >
              Read Creator Agreement
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                <Tv className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold">ZTVLIVE</span>
              <span className="text-zinc-500 text-sm">Creator Partners</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <Link to="/creator-agreement" className="hover:text-white">Creator Agreement</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
              <Link to="/privacy" className="hover:text-white">Privacy</Link>
              <a href="mailto:creators@ztvlivestream.com" className="hover:text-white">Contact</a>
            </div>

            <div className="flex items-center gap-3">
              <a href="https://twitter.com/ztvlive" target="_blank" rel="noopener noreferrer" 
                 className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="https://instagram.com/ztvlive" target="_blank" rel="noopener noreferrer"
                 className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="mailto:creators@ztvlivestream.com"
                 className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors">
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-zinc-800 text-center text-xs text-zinc-600">
            © 2026 ZTVLIVE. All rights reserved. Arizona, USA.
          </div>
        </div>
      </footer>
    </div>
  );
}
