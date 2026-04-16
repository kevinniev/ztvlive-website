import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import {
  User, Calendar, Video, Eye, Play, Bell, Share2, ExternalLink,
  Youtube, Instagram, Twitter, Globe, Clock, Star, CheckCircle,
  Loader2, AlertCircle, Film, Users, Heart, MessageCircle
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";

const API = '/api';

const CreatorProfilePage = () => {
  const { username } = useParams();
  const [creator, setCreator] = useState(null);
  const [videos, setVideos] = useState([]);
  const [upcomingSlots, setUpcomingSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    if (username) {
      fetchCreatorProfile();
    }
  }, [username]);

  const fetchCreatorProfile = async () => {
    setLoading(true);
    try {
      // Fetch creator by username or ID
      const response = await axios.get(`${API}/creators/profile/${username}`);
      
      if (response.data?.creator) {
        setCreator(response.data.creator);
        setVideos(response.data.videos || []);
        setUpcomingSlots(response.data.upcoming_slots || []);
        setFollowerCount(response.data.follower_count || 0);
        
        // Check if current user is following
        const token = localStorage.getItem("token");
        if (token) {
          try {
            const followCheck = await axios.get(
              `${API}/creators/is-following/${response.data.creator.user_id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            setIsFollowing(followCheck.data?.is_following || false);
          } catch (e) {
            // Not logged in or error
          }
        }
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error("Profile fetch error:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please log in to follow creators");
      return;
    }

    try {
      if (isFollowing) {
        await axios.post(
          `${API}/creators/unfollow/${creator.user_id}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
        toast.success(`Unfollowed ${creator.name}`);
      } else {
        await axios.post(
          `${API}/creators/follow/${creator.user_id}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
        toast.success(`Now following ${creator.name}! You'll be notified when they go live.`);
      }
    } catch (error) {
      toast.error("Failed to update follow status");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const text = `Check out ${creator?.name} on ZTVLIVE!`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: creator?.name, text, url });
      } catch (e) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Profile link copied!");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Creator Not Found</h1>
          <p className="text-zinc-500 mb-4">We couldn't find a creator with that username.</p>
          <Button asChild>
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  // SEO structured data
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": creator?.name,
    "description": creator?.bio || `${creator?.name} is a content creator on ZTVLIVE`,
    "url": window.location.href,
    "image": creator?.avatar_url,
    "sameAs": [
      creator?.youtube_url,
      creator?.instagram_url,
      creator?.twitter_url,
      creator?.website_url
    ].filter(Boolean)
  };

  const creatorName = creator?.name || 'Creator';
  
  return (
    <>
      {/* SEO Meta Tags */}
      <Helmet>
        <title>{`${creatorName} | ZTVLIVE Creator`}</title>
        <meta name="description" content={creator?.bio || `Watch ${creatorName}'s content on ZTVLIVE - 24/7 Interactive Live TV`} />
        <meta property="og:title" content={`${creatorName} | ZTVLIVE Creator`} />
        <meta property="og:description" content={creator?.bio || `Watch ${creatorName}'s content on ZTVLIVE`} />
        <meta property="og:image" content={creator?.avatar_url || 'https://ztvlivestream.com/og-image.jpg'} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="profile" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${creatorName} | ZTVLIVE Creator`} />
        <meta name="twitter:description" content={creator?.bio || `Watch ${creatorName}'s content on ZTVLIVE`} />
        <link rel="canonical" href={window.location.href} />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-zinc-950 text-white">
        {/* Hero Banner */}
        <div 
          className="h-48 md:h-64 bg-gradient-to-r from-red-900/50 via-purple-900/50 to-zinc-900 relative"
          style={{
            backgroundImage: creator?.banner_url ? `url(${creator.banner_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
        </div>

        {/* Profile Header */}
        <div className="max-w-5xl mx-auto px-4 -mt-20 relative z-10">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
            {/* Avatar */}
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-red-600 to-purple-600 p-1">
              <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden">
                {creator?.avatar_url ? (
                  <img src={creator.avatar_url} alt={creator.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-5xl font-bold">{creator?.name?.charAt(0)}</span>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl md:text-4xl font-bold">{creator?.name}</h1>
                {creator?.is_verified && (
                  <CheckCircle className="w-6 h-6 text-blue-400" />
                )}
              </div>
              <p className="text-zinc-400 mb-4">@{creator?.username || username}</p>
              
              {/* Stats */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-1 text-sm">
                  <Users className="w-4 h-4 text-zinc-500" />
                  <span className="font-semibold">{followerCount.toLocaleString()}</span>
                  <span className="text-zinc-500">followers</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Video className="w-4 h-4 text-zinc-500" />
                  <span className="font-semibold">{videos.length}</span>
                  <span className="text-zinc-500">videos</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Eye className="w-4 h-4 text-zinc-500" />
                  <span className="font-semibold">{(creator?.total_views || 0).toLocaleString()}</span>
                  <span className="text-zinc-500">views</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={handleFollow}
                className={isFollowing 
                  ? "bg-zinc-800 hover:bg-zinc-700" 
                  : "bg-red-600 hover:bg-red-700"
                }
              >
                {isFollowing ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Following
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Follow
                  </>
                )}
              </Button>
              <Button variant="outline" className="border-zinc-700" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Bio */}
          {creator?.bio && (
            <p className="mt-6 text-zinc-300 max-w-2xl">{creator.bio}</p>
          )}

          {/* Social Links */}
          <div className="flex flex-wrap gap-3 mt-4">
            {creator?.youtube_url && (
              <a href={creator.youtube_url} target="_blank" rel="noopener noreferrer" 
                 className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-full text-sm hover:bg-zinc-700 transition-colors">
                <Youtube className="w-4 h-4 text-red-500" />
                YouTube
              </a>
            )}
            {creator?.instagram_url && (
              <a href={creator.instagram_url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-full text-sm hover:bg-zinc-700 transition-colors">
                <Instagram className="w-4 h-4 text-pink-500" />
                Instagram
              </a>
            )}
            {creator?.twitter_url && (
              <a href={creator.twitter_url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-full text-sm hover:bg-zinc-700 transition-colors">
                <Twitter className="w-4 h-4 text-blue-400" />
                Twitter
              </a>
            )}
            {creator?.website_url && (
              <a href={creator.website_url} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-full text-sm hover:bg-zinc-700 transition-colors">
                <Globe className="w-4 h-4 text-emerald-400" />
                Website
              </a>
            )}
          </div>
        </div>

        {/* Content Tabs */}
        <div className="max-w-5xl mx-auto px-4 py-8">
          <Tabs defaultValue="upcoming" className="space-y-6">
            <TabsList className="bg-zinc-900">
              <TabsTrigger value="upcoming" className="data-[state=active]:bg-red-600">
                <Calendar className="w-4 h-4 mr-2" />
                Upcoming
              </TabsTrigger>
              <TabsTrigger value="videos" className="data-[state=active]:bg-red-600">
                <Video className="w-4 h-4 mr-2" />
                Videos
              </TabsTrigger>
            </TabsList>

            {/* Upcoming Slots */}
            <TabsContent value="upcoming">
              {upcomingSlots.length === 0 ? (
                <div className="text-center py-12 bg-zinc-900 rounded-lg">
                  <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500">No upcoming scheduled slots</p>
                  <p className="text-sm text-zinc-600 mt-1">Follow to get notified when they schedule</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {upcomingSlots.map((slot, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 flex items-center gap-4"
                    >
                      <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Play className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{slot.title || "Scheduled Stream"}</h3>
                        <p className="text-sm text-zinc-400 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {formatDate(`${slot.slot_date}T${slot.slot_start_hour}:${slot.slot_start_minute || '00'}`)}
                        </p>
                      </div>
                      <Badge className="bg-emerald-600">Upcoming</Badge>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Videos */}
            <TabsContent value="videos">
              {videos.length === 0 ? (
                <div className="text-center py-12 bg-zinc-900 rounded-lg">
                  <Video className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500">No videos yet</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map((video, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all group cursor-pointer"
                    >
                      <div className="aspect-video bg-zinc-800 relative">
                        {video.thumbnail_url ? (
                          <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-12 h-12 text-zinc-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-12 h-12" />
                        </div>
                        {video.duration_seconds && (
                          <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-xs rounded">
                            {Math.floor(video.duration_seconds / 60)}:{String(video.duration_seconds % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium truncate">{video.title || "Untitled"}</h3>
                        <p className="text-sm text-zinc-500">
                          {(video.views || 0).toLocaleString()} views
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default CreatorProfilePage;
