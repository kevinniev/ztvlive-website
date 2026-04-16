import React from 'react';

const RokuPreview = () => {
  // Content data matching the Roku BrightScript v7
  const rows = [
    {
      title: "LIVE NOW",
      items: [
        {
          title: "ZTVLIVE 24/7",
          description: "Watch Live Stream",
          image: "https://images.unsplash.com/photo-1658046413536-6e5933dfd939?w=400",
          live: true
        }
      ]
    },
    {
      title: "PLAY & WIN",
      items: [
        {
          title: "Live Trivia",
          description: "Answer & Win Prizes",
          image: "https://images.unsplash.com/photo-1719494207635-f84507a03971?w=400"
        },
        {
          title: "Daily Challenge",
          description: "New Questions Daily",
          image: "https://images.unsplash.com/photo-1573804638247-94ba5a291b76?w=400"
        },
        {
          title: "Prize Wheel",
          description: "Spin to Win",
          image: "https://images.unsplash.com/photo-1752085777042-f70b4cf31d53?w=400"
        },
        {
          title: "Leaderboard",
          description: "Top Players",
          image: "https://images.unsplash.com/photo-1659080907103-1cabe53c5662?w=400"
        }
      ]
    },
    {
      title: "MUSIC",
      items: [
        {
          title: "Afrobeats",
          description: "African Hits",
          image: "https://images.unsplash.com/photo-1544476613-a6ad8bb6862c?w=400"
        },
        {
          title: "Hip-Hop",
          description: "Top 50 Rap",
          image: "https://images.unsplash.com/photo-1612321933939-9945b77f8479?w=400"
        },
        {
          title: "R&B Vibes",
          description: "Soul & Smooth",
          image: "https://images.unsplash.com/photo-1585729704181-d252db554814?w=400"
        },
        {
          title: "Pop Hits",
          description: "Trending Now",
          image: "https://images.unsplash.com/photo-1762674541520-354b784e7abc?w=400"
        }
      ]
    },
    {
      title: "ENTERTAINMENT",
      items: [
        {
          title: "Gaming",
          description: "Esports & Streams",
          image: "https://images.unsplash.com/photo-1770177267441-1d8dadda4feb?w=400"
        },
        {
          title: "Podcasts",
          description: "Talk & Listen",
          image: "https://images.unsplash.com/photo-1709846487437-7445553bb6ed?w=400"
        },
        {
          title: "Comedy",
          description: "Stand-Up & Laughs",
          image: "https://images.unsplash.com/photo-1766532573885-8bd94537f1c4?w=400"
        },
        {
          title: "Film & TV",
          description: "Movies & Shows",
          image: "https://images.unsplash.com/photo-1762417420551-2fec32ed3595?w=400"
        }
      ]
    },
    {
      title: "SPORTS",
      items: [
        {
          title: "Live Games",
          description: "Watch Now",
          image: "https://images.unsplash.com/photo-1563299796-b729d0af54a5?w=400"
        },
        {
          title: "Highlights",
          description: "Best Plays",
          image: "https://images.unsplash.com/photo-1641135698530-8d919344c0e5?w=400"
        },
        {
          title: "Boxing & MMA",
          description: "Fight Night",
          image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400"
        },
        {
          title: "Basketball",
          description: "Court Action",
          image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400"
        }
      ]
    },
    {
      title: "MORE",
      items: [
        {
          title: "News",
          description: "Breaking Stories",
          image: "https://images.unsplash.com/photo-1742805382148-48e9953ad797?w=400"
        },
        {
          title: "Lifestyle",
          description: "Wellness & Tips",
          image: "https://images.unsplash.com/photo-1635367216109-aa3353c0c22e?w=400"
        },
        {
          title: "Tech",
          description: "Innovation & Gadgets",
          image: "https://images.unsplash.com/photo-1707166919487-a7d4439c9a89?w=400"
        },
        {
          title: "Concerts",
          description: "Live Performances",
          image: "https://images.unsplash.com/photo-1647168285321-7509a33bf1d7?w=400"
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* TV Frame Indicator */}
      <div className="bg-gradient-to-r from-purple-900/30 to-transparent p-2 text-center text-sm text-gray-400 border-b border-gray-800">
        📺 ROKU CHANNEL PREVIEW (v3.2.0) - 6 Categories: LIVE NOW, PLAY & WIN, MUSIC, ENTERTAINMENT, SPORTS, MORE
      </div>

      {/* Roku UI Container - 16:9 aspect ratio */}
      <div className="max-w-[1400px] mx-auto" style={{ aspectRatio: '16/9' }}>
        
        {/* Header Bar */}
        <div className="bg-black/90 px-8 py-3 flex items-center justify-between border-b-2 border-red-600/80">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="w-12 h-12 bg-red-600 flex items-center justify-center">
              <span className="text-2xl font-bold">Z</span>
            </div>
            <div>
              <div className="text-xl font-bold">ZTVLIVE</div>
              <div className="text-red-600 text-sm">24/7 Live TV</div>
            </div>
          </div>
          {/* Live Badge */}
          <div className="bg-red-600 px-6 py-2 font-bold">
            LIVE
          </div>
        </div>

        {/* Hero Section */}
        <div className="px-8 py-3">
          <div className="bg-[#1a1a1a] rounded-sm flex overflow-hidden" style={{ height: '180px' }}>
            {/* Left - Text Content */}
            <div className="p-5 flex flex-col justify-center" style={{ width: '55%' }}>
              <div className="bg-red-600 text-white text-xs font-bold px-3 py-1 inline-block w-fit mb-2">
                LIVE NOW
              </div>
              <h1 className="text-2xl font-bold mb-1">24/7 Interactive</h1>
              <h2 className="text-2xl font-bold text-red-600 mb-2">Game Show</h2>
              <p className="text-gray-400 text-sm mb-3">
                Play along and win real prizes every 10 minutes!
              </p>
              <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 w-fit transition-colors text-sm">
                Watch Live
              </button>
            </div>
            {/* Right - Hero Image */}
            <div className="relative" style={{ width: '45%' }}>
              <div className="absolute inset-1 border border-red-600/30">
                <img 
                  src="https://images.unsplash.com/photo-1658046413536-6e5933dfd939?w=800" 
                  alt="Live Stream"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-black/80 px-3 py-1">
                  <span className="text-red-600 text-xs font-bold">NOW PLAYING</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Rows */}
        <div className="px-8 space-y-3 overflow-hidden" style={{ maxHeight: 'calc(100% - 280px)' }}>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex}>
              <h3 className="text-sm font-bold mb-1 text-white/90">{row.title}</h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {row.items.map((item, itemIndex) => (
                  <div 
                    key={itemIndex} 
                    className={`flex-shrink-0 group cursor-pointer transition-transform hover:scale-105 ${
                      rowIndex === 0 && itemIndex === 0 ? 'ring-2 ring-red-600' : ''
                    }`}
                    style={{ width: '160px' }}
                  >
                    <div className="relative overflow-hidden rounded-sm" style={{ height: '90px' }}>
                      <img 
                        src={item.image} 
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      {item.live && (
                        <div className="absolute top-1 right-1 bg-red-600 px-2 py-0.5 text-xs font-bold">
                          LIVE
                        </div>
                      )}
                    </div>
                    <div className="mt-1">
                      <div className="text-xs font-semibold truncate">{item.title}</div>
                      <div className="text-xs text-gray-500 truncate">{item.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-gray-900 p-4 mt-4 text-center text-sm text-gray-400">
        <p className="font-semibold text-white mb-2">Categories: LIVE NOW | PLAY & WIN | MUSIC | ENTERTAINMENT | SPORTS | MORE</p>
        <p>Version 3.2.0 • All images are copyright-free from Unsplash</p>
        <p className="mt-1">Download: <a href="/api/releases/roku/ZTVLIVE_Premium_v7.zip" className="text-red-500 hover:underline">ZTVLIVE_Premium_v7.zip</a></p>
      </div>
    </div>
  );
};

export default RokuPreview;
