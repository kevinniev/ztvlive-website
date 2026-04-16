import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Play, Share2, Download, Tv, DollarSign, Rocket, X, Copy, Check, Twitter, Facebook, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import Navigation from '../components/Navigation';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function PromoLibraryPage() {
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePromo, setSharePromo] = useState(null);
  const [copied, setCopied] = useState(false);

  const promos = [
    {
      id: '70-revolution-final',
      title: 'The 70% Revolution (OFFICIAL)',
      description: 'Join the 70% Revolution! Sports, News, Tech 24/7. Keep 70% of your revenue. Visit ztvlivestream.com',
      icon: Rocket,
      color: 'from-red-600 to-purple-600',
      videoUrl: `${API}/api/static/promo/ztvlive_70_revolution_FINAL.mp4`,
      thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=450&fit=crop',
      duration: '0:23',
      featured: true,
      isNew: true
    },
    {
      id: '70-revolution-tiktok',
      title: 'The 70% Revolution (TikTok/Reels)',
      description: 'Vertical format optimized for TikTok, Instagram Reels, YouTube Shorts',
      icon: Rocket,
      color: 'from-pink-500 to-rose-600',
      videoUrl: `${API}/api/static/promo/ztvlive_TIKTOK_REELS.mp4`,
      thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=450&fit=crop',
      duration: '0:23',
      format: '9:16 Vertical'
    },
    {
      id: '70-revolution-twitter',
      title: 'The 70% Revolution (Twitter/X)',
      description: 'Horizontal format optimized for Twitter/X with @ZTVLIVE handle',
      icon: Rocket,
      color: 'from-blue-500 to-cyan-600',
      videoUrl: `${API}/api/static/promo/ztvlive_TWITTER_X.mp4`,
      thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=450&fit=crop',
      duration: '0:23',
      format: '16:9 Horizontal'
    },
    {
      id: 'creator-revolution',
      title: 'Creator Revolution',
      description: 'THE HARSH TRUTH: 50% of creators stuck under $10K! Join the revolution - 70% revenue share.',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-600',
      videoUrl: `${API}/api/download/promo/creator-revolution`,
      thumbnail: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=450&fit=crop',
      duration: '0:32'
    },
    {
      id: 'big-screen-dreams',
      title: 'Big Screen Dreams',
      description: 'Cinematic promo showcasing TV platform reach - Roku, Fire TV, Samsung, LG',
      icon: Tv,
      color: 'from-purple-500 to-indigo-600',
      videoUrl: `${API}/api/download/promo/big-screen-dreams`,
      thumbnail: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&h=450&fit=crop',
      duration: '0:35'
    }
  ];

  const handleWatch = (promo) => {
    setSelectedPromo(promo);
  };

  const handleShare = (promo, e) => {
    e?.stopPropagation();
    setSharePromo(promo);
    setShowShareModal(true);
    setCopied(false);
  };

  const copyLink = async () => {
    const shareUrl = `${window.location.origin}/promo-library?watch=${sharePromo.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const shareToSocial = (platform) => {
    const shareUrl = `${window.location.origin}/promo-library?watch=${sharePromo.id}`;
    const text = `Check out this promo from ZTVLIVE: "${sharePromo.title}" - ${sharePromo.description}`;
    
    let url;
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`;
        break;
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + shareUrl)}`;
        break;
      default:
        return;
    }
    window.open(url, '_blank', 'width=600,height=400');
    setShowShareModal(false);
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `ZTVLIVE Promo: ${sharePromo.title}`,
          text: sharePromo.description,
          url: `${window.location.origin}/promo-library?watch=${sharePromo.id}`
        });
        setShowShareModal(false);
      } catch (err) {
        if (err.name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <Navigation />
      
      {/* Header */}
      <div className="pt-24 pb-8 px-4 bg-gradient-to-b from-red-900/20 to-transparent">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            ZTVLIVE Promo Library
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Watch and share our promotional videos. Help spread the word about the 70% creator revolution!
          </p>
        </div>
      </div>

      {/* Video Player Section (when a promo is selected) */}
      {selectedPromo && (
        <div className="max-w-4xl mx-auto px-4 mb-8">
          <div className="relative bg-zinc-900 rounded-xl overflow-hidden">
            <div className="aspect-video">
              <video
                src={selectedPromo.videoUrl}
                controls
                autoPlay
                className="w-full h-full"
                poster={selectedPromo.thumbnail}
              >
                Your browser does not support video playback.
              </video>
            </div>
            <div className="p-4 border-t border-zinc-800">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold mb-1">{selectedPromo.title}</h2>
                  <p className="text-zinc-400 text-sm">{selectedPromo.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={(e) => handleShare(selectedPromo, e)}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="share-playing-promo"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  <Button
                    onClick={() => window.open(selectedPromo.videoUrl, '_blank')}
                    variant="outline"
                    className="border-zinc-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promo Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <h3 className="text-xl font-semibold mb-6">
          {selectedPromo ? 'More Promos' : 'All Promos'}
        </h3>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promos.map((promo) => {
            const Icon = promo.icon;
            const isPlaying = selectedPromo?.id === promo.id;
            
            return (
              <Card 
                key={promo.id} 
                className={`bg-zinc-900 border-zinc-800 overflow-hidden cursor-pointer transition-all hover:scale-105 hover:border-red-500 ${isPlaying ? 'ring-2 ring-red-500' : ''}`}
                onClick={() => handleWatch(promo)}
                data-testid={`promo-card-${promo.id}`}
              >
                <div className="relative">
                  <div className={`aspect-video bg-gradient-to-br ${promo.color} flex items-center justify-center relative overflow-hidden`}>
                    <img 
                      src={promo.thumbnail} 
                      alt={promo.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-black/30" />
                    <Icon className="w-16 h-16 text-white/90 relative z-10" />
                    
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                      <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                        <Play className="w-8 h-8 text-white ml-1" />
                      </div>
                    </div>
                    
                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-xs">
                      {promo.duration}
                    </div>
                    
                    {isPlaying && (
                      <div className="absolute top-2 left-2 bg-red-600 px-2 py-0.5 rounded text-xs font-bold">
                        NOW PLAYING
                      </div>
                    )}
                  </div>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2 flex-wrap">
                    {promo.title}
                    {promo.featured && (
                      <span className="text-xs bg-yellow-500 text-black px-1.5 py-0.5 rounded">FEATURED</span>
                    )}
                    {promo.isNew && (
                      <span className="text-xs bg-green-500 text-black px-1.5 py-0.5 rounded animate-pulse">NEW</span>
                    )}
                    {promo.format && (
                      <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">{promo.format}</span>
                    )}
                  </h3>
                  <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
                    {promo.description}
                  </p>
                  
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      onClick={(e) => { e.stopPropagation(); handleWatch(promo); }}
                      data-testid={`watch-${promo.id}`}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Watch
                    </Button>
                    <Button 
                      variant="outline"
                      className="border-zinc-700 hover:bg-zinc-800"
                      onClick={(e) => { e.stopPropagation(); window.open(promo.videoUrl, '_blank'); }}
                      data-testid={`download-${promo.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline"
                      className="border-zinc-700 hover:bg-zinc-800"
                      onClick={(e) => handleShare(promo, e)}
                      data-testid={`share-${promo.id}`}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center p-8 bg-gradient-to-r from-red-900/30 to-purple-900/30 rounded-2xl border border-red-800/30">
          <h3 className="text-2xl font-bold mb-3">Ready to Join the Revolution?</h3>
          <p className="text-zinc-400 mb-6 max-w-xl mx-auto">
            Become a ZTVLIVE creator and keep 70% of your revenue. Schedule your content on our 24/7 live TV network.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => window.location.href = '/register'}
            >
              <Rocket className="w-4 h-4 mr-2" />
              Create Account
            </Button>
            <Button 
              variant="outline" 
              className="border-zinc-700"
              onClick={() => window.location.href = '/schedule-slot'}
            >
              Schedule Content
            </Button>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && sharePromo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowShareModal(false)}>
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 border border-zinc-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Share Promo</h3>
              <button onClick={() => setShowShareModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-zinc-400 mb-4">Share "{sharePromo.title}" with your audience</p>
            
            {/* Copy Link */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/promo-library?watch=${sharePromo.id}`}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
              />
              <Button onClick={copyLink} className="bg-zinc-800 hover:bg-zinc-700">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            
            {/* Social Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Button 
                onClick={() => shareToSocial('twitter')}
                className="bg-[#1DA1F2] hover:bg-[#1a8cd8]"
              >
                <Twitter className="w-4 h-4 mr-1" /> Twitter
              </Button>
              <Button 
                onClick={() => shareToSocial('facebook')}
                className="bg-[#4267B2] hover:bg-[#365899]"
              >
                <Facebook className="w-4 h-4 mr-1" /> Facebook
              </Button>
              <Button 
                onClick={() => shareToSocial('whatsapp')}
                className="bg-[#25D366] hover:bg-[#1da851]"
              >
                <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
              </Button>
            </div>
            
            {/* Native Share (mobile) */}
            {navigator.share && (
              <Button onClick={nativeShare} className="w-full bg-red-600 hover:bg-red-700">
                <Share2 className="w-4 h-4 mr-2" /> More Sharing Options
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
