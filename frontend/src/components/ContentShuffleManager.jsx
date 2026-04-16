import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Shuffle, RefreshCw, Play, Plus, Trash2, Music, Film, 
  Gamepad2, Newspaper, Trophy, Sparkles, Check, Clock,
  ListMusic, Filter, Save, Zap, SkipForward, Globe
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const API = '/api';

const CATEGORY_ICONS = {
  music_pop: Music,
  music_hiphop: Music,
  music_latin: Music,
  sports_highlights: Trophy,
  comedy_standup: Sparkles,
  news_trending: Newspaper,
  documentaries: Film,
  gaming: Gamepad2,
  viral_trending: Zap,
  kpop: Music,
  world_music: Globe,
};

const CATEGORY_COLORS = {
  music_pop: "bg-pink-600",
  music_hiphop: "bg-purple-600",
  music_latin: "bg-orange-600",
  sports_highlights: "bg-green-600",
  comedy_standup: "bg-yellow-600",
  news_trending: "bg-blue-600",
  documentaries: "bg-cyan-600",
  gaming: "bg-red-600",
  viral_trending: "bg-fuchsia-600",
  kpop: "bg-rose-600",
  world_music: "bg-emerald-600",
};

export default function ContentShuffleManager() {
  const [categories, setCategories] = useState({});
  const [playlist, setPlaylist] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  
  // Mood options for shuffle
  const MOODS = [
    { id: "energetic", label: "Energetic", emoji: "⚡", color: "bg-yellow-600" },
    { id: "chill", label: "Chill", emoji: "😌", color: "bg-blue-600" },
    { id: "comedic", label: "Comedic", emoji: "😂", color: "bg-pink-600" },
    { id: "hype", label: "Hype", emoji: "🔥", color: "bg-red-600" },
    { id: "educational", label: "Educational", emoji: "📚", color: "bg-green-600" },
  ];
  
  // New content form
  const [newContent, setNewContent] = useState({
    title: "",
    video_url: "",
    duration_seconds: 180,
    category: "music_pop",
    genre: "pop"
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [catRes, playlistRes, statsRes] = await Promise.all([
        axios.get(`${API}/content-manager/categories`),
        axios.get(`${API}/content-manager/playlist`),
        axios.get(`${API}/content-manager/stats`)
      ]);
      
      setCategories(catRes.data);
      setPlaylist(playlistRes.data.playlist || []);
      setStats(statsRes.data);
      
      // Select all categories by default
      if (selectedCategories.length === 0) {
        setSelectedCategories(catRes.data.categories || []);
      }
    } catch (err) {
      console.error("Failed to fetch content data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategories.length]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleShuffle = async (mood = null) => {
    setShuffling(true);
    try {
      const res = await axios.post(`${API}/content-manager/shuffle`, {
        mood: mood || selectedMood
      });
      
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to shuffle playlist");
    } finally {
      setShuffling(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await axios.post(`${API}/content-manager/refresh`, {
        categories: selectedCategories.length > 0 ? selectedCategories : null,
        max_items_per_category: 10,
        total_max_items: 100
      });
      
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error("Failed to refresh playlist");
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearShuffle = async () => {
    try {
      await axios.post(`${API}/content-manager/clear`);
      toast.success("Shuffle cleared! Returning to normal TV schedule.");
      fetchData();
    } catch (err) {
      toast.error("Failed to clear shuffle");
    }
  };

  const handleSkipVideo = async () => {
    setSkipping(true);
    try {
      const res = await axios.post(`${API}/content-manager/skip`);
      toast.success(res.data.message);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to skip video");
    } finally {
      setSkipping(false);
    }
  };

  const handleAddContent = async () => {
    if (!newContent.title || !newContent.video_url) {
      toast.error("Title and Video URL are required");
      return;
    }
    
    try {
      await axios.post(`${API}/content-manager/add`, newContent);
      toast.success(`Added "${newContent.title}" to library`);
      setNewContent({
        title: "",
        video_url: "",
        duration_seconds: 180,
        category: "music_pop",
        genre: "pop"
      });
      setShowAddForm(false);
    } catch (err) {
      toast.error("Failed to add content");
    }
  };

  const toggleCategory = (cat) => {
    setSelectedCategories(prev => 
      prev.includes(cat) 
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    );
  };

  const selectAllCategories = () => {
    setSelectedCategories(categories.categories || []);
  };

  const clearCategories = () => {
    setSelectedCategories([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="content-shuffle-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListMusic className="w-6 h-6 text-green-500" />
            Content Shuffle & Refresh
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Mix up the 24/7 playlist to keep content fresh
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowAddForm(!showAddForm)}
            className="border-zinc-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Content
          </Button>
        </div>
      </div>

      {/* Action Buttons - Always visible */}
      <Card className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-green-600/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              {stats?.active ? (
                <>
                  <div>
                    <p className="text-xs text-zinc-400">Active Playlist</p>
                    <p className="text-2xl font-bold text-white">{stats.total_items} items</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">Total Runtime</p>
                    <p className="text-2xl font-bold text-green-400">{stats.total_runtime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">Last Shuffled</p>
                    <p className="text-sm text-zinc-300">
                      {stats.last_shuffled ? new Date(stats.last_shuffled).toLocaleString() : "Never"}
                    </p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-lg font-bold text-yellow-400">No Playlist Active</p>
                  <p className="text-sm text-zinc-400">Click a button to create your first shuffle!</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {/* SKIP BUTTON - Most Important */}
                {stats?.active && (
                  <Button 
                    onClick={handleSkipVideo}
                    disabled={skipping}
                    className="bg-orange-600 hover:bg-orange-500"
                    size="lg"
                    title="Skip current video if stuck or broken"
                  >
                    <SkipForward className={`w-5 h-5 mr-2 ${skipping ? 'animate-pulse' : ''}`} />
                    {skipping ? "Skipping..." : "Skip Video"}
                  </Button>
                )}
                <Button 
                  onClick={handleShuffle}
                  disabled={shuffling || !stats?.active}
                  className="bg-green-600 hover:bg-green-700"
                  size="lg"
                  title="Reorder current videos based on viewer interest"
                >
                  <Shuffle className={`w-5 h-5 mr-2 ${shuffling ? 'animate-spin' : ''}`} />
                  {shuffling ? "Shuffling..." : "Shuffle Order"}
                </Button>
                <Button 
                  onClick={handleRefresh}
                  disabled={refreshing || selectedCategories.length === 0}
                  variant="outline"
                  className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
                  size="lg"
                  title="Replace ALL videos with fresh content (no duplicates)"
                >
                  <RefreshCw className={`w-5 h-5 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? "Loading New..." : "Full Refresh (New Videos)"}
                </Button>
                {stats?.active && (
                  <Button 
                    onClick={handleClearShuffle}
                    variant="outline"
                    className="border-red-600 text-red-400 hover:bg-red-600/20"
                    size="lg"
                  >
                    <Trash2 className="w-5 h-5 mr-2" />
                    Clear & Reset
                  </Button>
                )}
              </div>
              <div className="text-xs text-zinc-500 flex flex-wrap gap-4">
                <span><strong>Skip:</strong> Advance to next video</span>
                <span><strong>Shuffle:</strong> Reorder current playlist</span>
                <span><strong>Full Refresh:</strong> Load entirely new videos (no repeats)</span>
              </div>
            </div>
          </div>
          {selectedCategories.length === 0 && (
            <p className="text-yellow-400 text-sm mt-2">⚠️ Select at least one category below to enable Full Refresh</p>
          )}
          {!stats?.active && (
            <p className="text-blue-400 text-sm mt-2">💡 Click "Full Refresh" first to load videos, then use "Shuffle" to reorder</p>
          )}
          
          {/* Mood-based Quick Shuffle */}
          {stats?.active && (
            <div className="mt-4 pt-4 border-t border-zinc-700">
              <p className="text-sm text-zinc-400 mb-2">Quick Shuffle by Mood:</p>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((mood) => (
                  <Button
                    key={mood.id}
                    onClick={() => handleShuffle(mood.id)}
                    disabled={shuffling}
                    variant="outline"
                    size="sm"
                    className={`${selectedMood === mood.id ? mood.color : 'border-zinc-600'} hover:${mood.color}`}
                  >
                    <span className="mr-1">{mood.emoji}</span>
                    {mood.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Selector */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-500" />
              Select Categories to Include
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllCategories}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearCategories}>
                Clear
              </Button>
            </div>
          </div>
          <CardDescription>
            Choose which genres to include in the shuffle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {(categories.categories || []).map((cat) => {
              const Icon = CATEGORY_ICONS[cat] || Music;
              const color = CATEGORY_COLORS[cat] || "bg-zinc-600";
              const isSelected = selectedCategories.includes(cat);
              const count = categories.counts?.[cat] || 0;
              
              return (
                <motion.div
                  key={cat}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleCategory(cat)}
                  className={`
                    p-3 rounded-lg cursor-pointer border-2 transition-all
                    ${isSelected 
                      ? `${color} border-white/50` 
                      : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium truncate">
                      {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline" className="text-xs">
                      {count} videos
                    </Badge>
                    {isSelected && <Check className="w-4 h-4 text-green-400" />}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Content Form */}
      {showAddForm && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-500" />
              Add New Content
            </CardTitle>
            <CardDescription>
              Add embeddable YouTube videos to your library
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Video Title"
                value={newContent.title}
                onChange={(e) => setNewContent({...newContent, title: e.target.value})}
                className="bg-zinc-800 border-zinc-700"
              />
              <Input
                placeholder="YouTube Embed URL (e.g., https://www.youtube.com/embed/xxxxx)"
                value={newContent.video_url}
                onChange={(e) => setNewContent({...newContent, video_url: e.target.value})}
                className="bg-zinc-800 border-zinc-700"
              />
              <Input
                type="number"
                placeholder="Duration (seconds)"
                value={newContent.duration_seconds}
                onChange={(e) => setNewContent({...newContent, duration_seconds: parseInt(e.target.value) || 180})}
                className="bg-zinc-800 border-zinc-700"
              />
              <select
                value={newContent.category}
                onChange={(e) => setNewContent({...newContent, category: e.target.value})}
                className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white"
              >
                {(categories.categories || []).map(cat => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleAddContent} className="bg-purple-600 hover:bg-purple-700">
                <Save className="w-4 h-4 mr-2" />
                Add to Library
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Playlist Preview */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="w-5 h-5 text-green-500" />
            Current Playlist Preview
            <Badge variant="outline" className="ml-2">
              {playlist.length} items
            </Badge>
          </CardTitle>
          <CardDescription>
            First 20 items in the current shuffle order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {playlist.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <ListMusic className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>No playlist active</p>
              <p className="text-sm mt-1">Click "Shuffle Now" or "Full Refresh" to create one</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {playlist.slice(0, 20).map((item, idx) => {
                const Icon = CATEGORY_ICONS[item.source_category] || Music;
                const color = CATEGORY_COLORS[item.source_category] || "bg-zinc-600";
                
                return (
                  <div 
                    key={`${item.id}-${idx}`}
                    className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded-lg"
                  >
                    <div className={`w-8 h-8 ${color} rounded flex items-center justify-center text-xs font-bold`}>
                      {idx + 1}
                    </div>
                    <Icon className="w-4 h-4 text-zinc-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.title}</p>
                      <p className="text-xs text-zinc-500">{item.genre || item.category}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <Clock className="w-3 h-3" />
                      {Math.floor(item.duration_seconds / 60)}:{(item.duration_seconds % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                );
              })}
              {playlist.length > 20 && (
                <p className="text-center text-zinc-500 text-sm py-2">
                  + {playlist.length - 20} more items...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {stats?.category_breakdown && Object.keys(stats.category_breakdown).length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.category_breakdown).map(([cat, count]) => {
                const Icon = CATEGORY_ICONS[cat] || Music;
                const color = CATEGORY_COLORS[cat] || "bg-zinc-600";
                
                return (
                  <div key={cat} className={`p-3 ${color}/20 rounded-lg border border-${color.replace('bg-', '')}/30`}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="text-sm truncate">
                        {cat.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-white mt-1">{count}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
