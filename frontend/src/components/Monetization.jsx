import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Eye, DollarSign, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Sponsor/Ad Placement Component for Monetization
export function SponsorBanner({ position = "top", className = "" }) {
  const [sponsor, setSponsor] = useState(null);
  
  // Simulated sponsor data - replace with real ad network integration
  const sponsors = [
    { id: 1, name: "TechBrand Pro", tagline: "Future of Innovation", color: "#06b6d4", cta: "Learn More", url: "#" },
    { id: 2, name: "SportsFit", tagline: "Gear Up for Greatness", color: "#f97316", cta: "Shop Now", url: "#" },
    { id: 3, name: "StreamPlus", tagline: "Entertainment Unlimited", color: "#8b5cf6", cta: "Try Free", url: "#" },
    { id: 4, name: "MusicWave", tagline: "Feel the Beat", color: "#d946ef", cta: "Listen Now", url: "#" },
  ];

  useEffect(() => {
    // Rotate sponsors every 30 seconds
    const randomSponsor = sponsors[Math.floor(Math.random() * sponsors.length)];
    setSponsor(randomSponsor);
    
    const interval = setInterval(() => {
      const newSponsor = sponsors[Math.floor(Math.random() * sponsors.length)];
      setSponsor(newSponsor);
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (!sponsor) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border-y border-zinc-700 py-2 ${className}`}
    >
      <div className="container mx-auto px-4 flex items-center justify-center gap-4">
        <Badge className="bg-zinc-700 text-zinc-300 text-xs">Sponsored</Badge>
        <span className="text-sm font-medium" style={{ color: sponsor.color }}>{sponsor.name}</span>
        <span className="text-zinc-400 text-sm hidden sm:inline">- {sponsor.tagline}</span>
        <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-600 hover:bg-zinc-700">
          {sponsor.cta}
        </Button>
      </div>
    </motion.div>
  );
}

// In-Feed Ad Component
export function InFeedAd({ index = 0 }) {
  const ads = [
    { title: "Boost Your Stream", description: "Get 10x more viewers with StreamBoost Pro", cta: "Start Free Trial", image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400" },
    { title: "Creator Tools Bundle", description: "Everything you need to create viral content", cta: "Get 50% Off", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400" },
    { title: "Gaming Gear Sale", description: "Top rated equipment for pro gamers", cta: "Shop Now", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400" },
  ];

  const ad = ads[index % ads.length];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-lg overflow-hidden"
    >
      <div className="relative">
        <img src={ad.image} alt={ad.title} className="w-full h-32 object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        <Badge className="absolute top-2 right-2 bg-zinc-800/80 text-xs">Ad</Badge>
      </div>
      <div className="p-4">
        <h4 className="font-heading text-lg mb-1">{ad.title}</h4>
        <p className="text-zinc-400 text-sm mb-3">{ad.description}</p>
        <Button size="sm" className="w-full bg-red-600 hover:bg-red-500">{ad.cta}</Button>
      </div>
    </motion.div>
  );
}

// Revenue Stats Dashboard Component (for admin/creator view)
export function RevenueStats() {
  const stats = {
    totalViews: 2450000,
    revenue: 4850,
    cpm: 1.98,
    engagement: 8.7,
    subscribers: 125000,
    growthRate: 23.5,
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-heading text-xl tracking-wider">Revenue Analytics</h3>
        <Badge className="bg-green-600/20 text-green-400 border border-green-600/30">
          +{stats.growthRate}% This Month
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
            <Eye className="w-4 h-4" /> Total Views
          </div>
          <div className="font-heading text-2xl">{(stats.totalViews / 1000000).toFixed(1)}M</div>
        </div>
        
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
            <DollarSign className="w-4 h-4" /> Est. Revenue
          </div>
          <div className="font-heading text-2xl text-green-400">${stats.revenue.toLocaleString()}</div>
        </div>
        
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
            <BarChart3 className="w-4 h-4" /> CPM Rate
          </div>
          <div className="font-heading text-2xl">${stats.cpm}</div>
        </div>
        
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
            <TrendingUp className="w-4 h-4" /> Engagement
          </div>
          <div className="font-heading text-2xl">{stats.engagement}%</div>
        </div>
        
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
            <Users className="w-4 h-4" /> Subscribers
          </div>
          <div className="font-heading text-2xl">{(stats.subscribers / 1000).toFixed(0)}K</div>
        </div>
        
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
            <DollarSign className="w-4 h-4" /> Monthly Goal
          </div>
          <div className="font-heading text-2xl text-amber-400">$5,000</div>
          <div className="w-full bg-zinc-700 rounded-full h-2 mt-2">
            <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${(stats.revenue / 5000) * 100}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Trending Topics Component for Homepage
export function TrendingTopics() {
  const topics = [
    { rank: 1, topic: "NBA Playoffs 2026", category: "Sports", posts: "2.4M", trend: "up" },
    { rank: 2, topic: "Burna Boy World Tour", category: "Music", posts: "1.8M", trend: "up" },
    { rank: 3, topic: "AI Generated Movies", category: "Tech", posts: "980K", trend: "up" },
    { rank: 4, topic: "Shannon Sharpe Podcast", category: "Podcast", posts: "750K", trend: "up" },
    { rank: 5, topic: "Afrobeats Awards 2026", category: "Culture", posts: "620K", trend: "up" },
  ];

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
      <h3 className="font-heading text-lg tracking-wider mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-red-400" />
        Trending Now
      </h3>
      <div className="space-y-3">
        {topics.map((topic) => (
          <div key={topic.rank} className="flex items-center gap-3 hover:bg-zinc-800/50 p-2 rounded cursor-pointer transition-colors">
            <span className="font-heading text-xl text-zinc-500 w-6">{topic.rank}</span>
            <div className="flex-1">
              <div className="font-medium">{topic.topic}</div>
              <div className="text-xs text-zinc-500">{topic.posts} posts · {topic.category}</div>
            </div>
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default { SponsorBanner, InFeedAd, RevenueStats, TrendingTopics };
