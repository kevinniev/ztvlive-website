import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Share2, Twitter, Facebook, Linkedin, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const BASE_URL = 'https://www.ztvlivestream.com';

// Custom hook for dynamic SEO meta tags
function useSEO({ title, description, image, url, type = 'article', publishedAt, author }) {
  useEffect(() => {
    // Update document title
    if (title) {
      document.title = title;
    }

    // Helper to update or create meta tag
    const setMeta = (selector, attribute, value) => {
      let meta = document.querySelector(selector);
      if (!meta) {
        meta = document.createElement('meta');
        if (selector.includes('property=')) {
          meta.setAttribute('property', selector.match(/property="([^"]+)"/)[1]);
        } else if (selector.includes('name=')) {
          meta.setAttribute('name', selector.match(/name="([^"]+)"/)[1]);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute(attribute, value);
    };

    // Basic meta
    if (description) {
      setMeta('meta[name="description"]', 'content', description);
    }

    // Open Graph tags
    if (title) {
      setMeta('meta[property="og:title"]', 'content', title);
    }
    if (description) {
      setMeta('meta[property="og:description"]', 'content', description);
    }
    if (image) {
      setMeta('meta[property="og:image"]', 'content', image);
      setMeta('meta[property="og:image:width"]', 'content', '1200');
      setMeta('meta[property="og:image:height"]', 'content', '630');
    }
    if (url) {
      setMeta('meta[property="og:url"]', 'content', url);
    }
    if (type) {
      setMeta('meta[property="og:type"]', 'content', type);
    }
    setMeta('meta[property="og:site_name"]', 'content', 'ZTVLIVE');

    // Article-specific OG tags
    if (type === 'article' && publishedAt) {
      setMeta('meta[property="article:published_time"]', 'content', publishedAt);
      setMeta('meta[property="article:author"]', 'content', author || 'ZTVLIVE');
    }

    // Twitter Card tags
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    setMeta('meta[name="twitter:site"]', 'content', '@ztvlive');
    if (title) {
      setMeta('meta[name="twitter:title"]', 'content', title);
    }
    if (description) {
      setMeta('meta[name="twitter:description"]', 'content', description);
    }
    if (image) {
      setMeta('meta[name="twitter:image"]', 'content', image);
    }

    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    if (url) {
      canonicalLink.href = url;
    }

  }, [title, description, image, url, type, publishedAt, author]);
}

// Blog post data
const BLOG_POSTS = [
  {
    id: 'big-screen-dreams',
    title: 'Big Screen Dreams: Why Professional OTT Distribution is the Future for Sports and Music',
    subtitle: 'Experience Live Sports & Concerts Like Never Before on Your Big Screen',
    heroImage: 'https://customer-assets.emergentagent.com/job_best-bites-live/artifacts/5qzu6t9b_idBqfgHFvQl.webp',
    publishedAt: '2026-03-30T09:00:00Z',
    readTime: '6 min read',
    category: 'OTT Distribution',
    excerpt: 'Mobile streaming proved demand. It did not solve presentation, reliability, or scale. Professional OTT distribution puts your live content on the platforms viewers already use daily.',
    content: `
## THE SHIFT IS REAL: MOBILE-ONLY IS NOT THE END GAME

Mobile streaming proved demand. It did not solve presentation, reliability, or scale. Sports and music are "big moment" content. Fans want the living-room screen, stable playback, and clean audio. They want a real channel experience, not a link buried in a bio.

Professional OTT distribution puts your live content on the platforms viewers already use daily:

- **Roku**
- **Amazon Fire TV**
- **Samsung TV**
- **LG TV**

**ZTVLIVE** is built for this shift. We are a 24/7 live streaming OTT platform designed for sports and music programming, delivered with professional broadcast discipline.

## QUALITY IS NOT OPTIONAL

On a phone, viewers tolerate imperfections. On a TV, they do not. Big-screen viewers notice frame drops and poor audio. ZTVLIVE meets NBC/CBS-style expectations because our team brings **15+ years of broadcast experience**. That experience means consistent signal flow and "looks like TV" presentation standards.

## 24/7 LIVE STREAMING WINS: CHANNELS BEAT ONE-OFF LINKS

One stream is an event. A channel is a destination. A 24/7 presence creates habit, and habit builds revenue. ZTVLIVE focuses on the channel model: always-on programming, structured blocks, and a clear schedule.

### FOR SPORTS ORGANIZATIONS:
- Pre-game coverage & live games
- Post-game analysis & highlights
- Sponsor segments

### FOR MUSIC & EVENTS:
- Live performances & festival blocks
- Interviews & music video rotations
- Recurring fan experiences

## CROSS-PLATFORM CONSISTENCY

Viewers expect the app to work on their TV. ZTVLIVE is built around consistency. Same channel identity and same show timing across Roku, Fire TV, Samsung, and LG. **Reliability is the brand.**

## ONLY ON ZTVLIVE: THE UNUSUAL FUN GAME SHOW

We offer exclusive programming designed for big-screen viewing and high-frequency engagement.

- **What it is:** A fast-moving, broadcast-style interactive game show.
- **Why it matters:** It keeps the channel active 24/7 and trains audiences to return on a schedule.

---

*Ready to bring your content to the big screen? [Get started with ZTVLIVE today](/submit).*
    `
  },
  {
    id: 'flip-the-script',
    title: "Flip the Script on Monetization: How ZTV's 70% Revenue Share and Mystery Money Are Empowering Creators",
    subtitle: '70% Revenue Share • Mystery Money • Instant PayPal Payouts',
    heroImage: 'https://customer-assets.emergentagent.com/job_best-bites-live/artifacts/8bvmz3vd_jUUYCXIRG0R.webp',
    publishedAt: '2026-03-30T15:00:00Z',
    readTime: '8 min read',
    category: 'Creator Economy',
    excerpt: "Creators fail when monetization math is slow and stacked against them. ZTVLIVE is built to fix that with a direct model and creator-first numbers.",
    content: `
## THE PROBLEM: MONETIZATION SHOULDN'T BE A GUESSING GAME

Creators fail when monetization math is slow and stacked against them. Common friction points like shrinking revenue splits and delayed payouts kill momentum. ZTVLIVE is built to fix that with a direct model and creator-first numbers.

## THE ZTVLIVE DIFFERENCE: 70% REVENUE SHARE

ZTVLIVE runs an **industry-leading 70% revenue share** for creators. This changes your operating plan:

- More money per transaction.
- More room for promos and giveaways.
- A clearer path to predictable monthly income.

Whether you are a music artist, a fitness coach, or a nonprofit, the platform split shouldn't erase your margin.

## "ONLY ON ZTVLIVE": THE MYSTERY MONEY STARTER PACK

This is the feature people talk about. Only on ZTVLIVE, creators can plug into a high-visibility, high-energy feature designed to trigger action immediately.

### The core promise:

- Mystery Box messaging that drives clicks.
- A "Reveal" button that creates urgency.
- **Instant PayPal payouts** for winners.

This isn't "points"—it's **real money, fast**. It rewards action, not just passive watching.

## THE UNUSUAL FUN GAME SHOW ENERGY

Mystery Money is positioned like a live TV moment. It creates a "must-see" vibe that keeps viewers watching longer. Longer watch time means more chances to convert.

### INTRO SCRIPT FOR CREATORS:

> "Welcome to ZTVLIVE. If you're watching on Roku or Fire TV, grab your phone and scan the QR code on screen. Every ten minutes, we're picking three winners: $5, $10, and $15. When you see the Mystery Box, hit Reveal. Payouts land instantly via PayPal. Stay locked—the next drop is coming up."

## THE 3-MONTH PRO ACCESS BONUS

We include a **3-month Pro access bonus** to help you do more, faster. Pro access removes "upgrade to unlock" dead ends and gives you the tools to test your formats and build a repeatable show from day one.

## HOW TO LAUNCH (STEP-BY-STEP)

1. **Register:** Create your account at ztvlivestream.com.
2. **Dashboard:** Set your show title, schedule, and PayPal routing.
3. **Submit:** Treat every stream like a TV "episode."
4. **Promote:** Use one link and one promise—70% revenue share and instant payouts.

---

*Ready to flip the script? [Start creating on ZTVLIVE today](/submit).*
    `
  },
  {
    id: 'mystery-money-playbook',
    title: 'The Mystery Money Playbook: How ZTVLIVE Creators Are Earning Daily',
    subtitle: '70% Revenue Share • Dopamine-Driven Rewards • Instant PayPal Payouts',
    heroImage: 'https://cdn.marblism.com/3RFgi5bedK-.webp',
    publishedAt: '2026-03-31T10:00:00Z',
    readTime: '7 min read',
    category: 'Creator Economy',
    excerpt: 'Welcome to the professional evolution of the creator economy. ZTVLIVE provides a high-performance environment where creators earn 70% of revenue with our dopamine-driven Mystery Money reward system.',
    content: `
## THE 70 PERCENT REVENUE REVOLUTION

Most platforms take a significant portion of your hard-earned revenue. ZTVLIVE prioritizes the creator. We offer a **70% revenue share**. This is the foundation of our creator ecosystem.

When you stream on ZTVLIVE, you keep the vast majority of what you earn. This industry-leading split applies to various revenue streams within the platform. Higher margins mean you can reinvest in your content faster.

## UNDERSTANDING THE MYSTERY MONEY SYSTEM

Monetization on ZTVLIVE is interactive. We utilize a "Mystery Money" system. This system creates a **game show atmosphere** for any stream, regardless of the niche.

The system functions on a recurring prize cadence. Every 10 minutes, the platform facilitates a high-energy reward event. Three winners are selected: **$5, $10, and $15**. This cycle repeats throughout your broadcast. It keeps viewers tuned in and creates a "must-see" environment.

## THE PSYCHOLOGY OF THE REVEAL BUTTON

The core of our engagement strategy is the **"Reveal" button**. This is a dopamine-driven feature. Viewers do not simply receive rewards; they interact with them.

The "Reveal" button mimics the excitement of a mystery box or a television game show. When a prize is triggered, the viewer must engage with the interface to see their reward. This interaction increases session duration and builds anticipation.

## DAILY LIQUIDITY WITH INSTANT PAYPAL PAYOUTS

Waiting 30 to 60 days for a payout is outdated. ZTVLIVE focuses on **daily liquidity**. Our platform integrates with PayPal for instant payouts. When you earn money, you can access it. No long holding periods.

1. **Earn** revenue through streams and the Mystery Money system.
2. **Trigger** your payout.
3. **Receive** funds via PayPal.

## CREATING THE GAME SHOW VIBE: A SCRIPT FOR SUCCESS

To maximize your earnings, you must adopt a professional broadcast tone. Use this script:

> "Welcome back to the broadcast! We are five minutes away from our next Mystery Money Reveal. Only on ZTVLIVE, we are giving away cash every ten minutes. We've got three winners coming up for $5, $10, and $15. If you are watching on Roku or Fire TV, scan the QR code on your screen right now to join the action!"

## WHY OTT BEATS TRADITIONAL SOCIAL MEDIA

Social media platforms are cluttered. OTT (Over-The-Top) media is different. When a viewer opens the ZTVLIVE app on their Roku or Fire TV, they are making a conscious decision to watch. They are **lean-back viewers**. They stay longer. They engage more deeply.

- **Higher retention** compared to scroll-based feeds
- **Premium ad inventory** valued by sponsors
- **Direct relationship** with your audience

---

*Ready to start earning daily? [Join the Mystery Money revolution on ZTVLIVE](/submit).*
    `
  },
  {
    id: 'tiktok-to-tv',
    title: 'From TikTok to TV: How to Turn Your Following into a 24/7 Channel',
    subtitle: 'Go Big Screen on Roku & Fire TV • Own Your Audience • Build a Broadcast Network',
    heroImage: 'https://cdn.marblism.com/5W4knHVxWgU.webp',
    publishedAt: '2026-03-31T14:00:00Z',
    readTime: '6 min read',
    category: 'Creator Growth',
    excerpt: 'Short-form video is a powerful discovery tool, but attention is fragmented. Transitioning to a professional 24/7 OTT channel on ZTVLIVE signals authority and changes how fans perceive your value.',
    content: `
## THE POWER OF THE BIG SCREEN

Television remains the most prestigious medium for content. Big-screen content implies high production value. Mobile apps are built for distraction; Smart TV apps (Roku, Fire TV) are built for **immersion**. By launching a channel on ZTVLIVE, you move from "content creator" to "broadcast network."

## WHY OTT BEATS SOCIAL MEDIA ALGORITHMS

Social platforms control your reach. An OTT channel on ZTVLIVE gives you direct access:

1. **Brand Ownership:** You own the destination.
2. **Permanent Presence:** Your content is available 24/7.
3. **Higher Ad Value:** Advertisers pay a premium for TV inventory.

## LEVERAGING 15+ YEARS OF BROADCAST EXPERIENCE

Building a TV channel is technically demanding. ZTVLIVE brings over **15 years of professional broadcast experience** to your brand. We handle the technical pipeline from your studio to the viewer's living room. You focus on the content; we focus on the engineering.

## THE BROADCAST MIX STRATEGY

You don't need to start from scratch. Use the mix strategy:

- **Live Anchors:** Scheduled live shows.
- **VOD Loops:** Replays of your best content.
- **Creator Shorts:** 60-second segments repurposed from social feeds.
- **Interactive Segments:** The ZTV Unusual Fun Game Show.

## MONETIZATION: THE MYSTERY MONEY SYSTEM

Only on ZTVLIVE, the Unusual Fun Game Show rewards viewers every 10 minutes ($5, $10, $15). This creates a **dopamine loop** that keeps people from changing the channel. This increased retention leads to higher ad revenue and better sponsorship.

## INTRODUCING YOUR AUDIENCE TO THE BIG SCREEN

Use this script to announce the move:

> "You've watched us on your phones. But now, it's time for the Big Screen. We are officially live 24/7 on ZTVLIVE! Catch us on Roku and Fire TV for the full cinematic experience. Every ten minutes, we're giving away Mystery Money. Grab your remote and join the revolution!"

## THE FUTURE IS OTT

The "Link in Bio" era is over. The **"Channel on the TV"** era has begun. Stop being a guest on someone else's platform. Become the owner of your own TV network with ZTVLIVE.

---

*Ready for the Big Screen? [Launch your 24/7 channel on ZTVLIVE today](/submit).*
    `
  },
  {
    id: 'march-madness-big-screen',
    title: 'March Madness on the Big Screen: Why OTT Beats Mobile for Live Sports',
    subtitle: 'Championship Season Demands Big Screen Reliability • 4K Sports • Interactive Engagement',
    heroImage: 'https://cdn.marblism.com/IuvzhY-K0Sc.webp',
    publishedAt: '2026-03-31T18:00:00Z',
    readTime: '5 min read',
    category: 'Live Sports',
    excerpt: 'March Madness represents the pinnacle of high-stakes sports. Every second counts. For the full tournament experience, OTT platforms like Roku and Fire TV are the superior choice.',
    content: `
## THE MARCH MADNESS PHENOMENON: A CHAMPIONSHIP SEASON

March Madness represents the pinnacle of high-stakes sports. Every second counts. To witness these moments, the viewing environment must match the intensity of the game. Fans demand reliability, scale, and a communal experience. For the full tournament experience, Over-The-Top (OTT) platforms like Roku and Fire TV are the superior choice.

## THE LIMITATIONS OF MOBILE VIEWING

Watching a fast-paced basketball game on a six-inch screen obscures critical details. You miss the floor spacing and the tactical signals. Technical hurdles like latency, battery drain, and interruptive notifications further degrade the experience. Mobile is isolated; **March Madness is communal**.

## THE OTT ADVANTAGE: CINEMATIC SPORTS DELIVERY

OTT devices like Roku and Amazon Fire TV transform your living room into a stadium.

1. **Superior Visual Fidelity:** 4K resolution and HDR make every detail vivid.
2. **Communal Viewing:** A big screen brings people together for watch parties.
3. **Hardware Stability:** Dedicated streaming hardware means fewer crashes during peak traffic.

## ZTVLIVE: 15 YEARS OF BROADCAST EXCELLENCE

Reliability is not an accident. ZTVLIVE leverages over **15 years of professional broadcast experience** to ensure NBC-quality stability. Our architecture uses advanced CDNs to minimize latency and handle massive concurrent viewership without buffering.

## EXCLUSIVE ENGAGEMENT: THE MYSTERY MONEY SYSTEM

Only on ZTVLIVE is the viewing experience interactive. We solved "commercial fatigue" with the Unusual Fun Game Show and the Mystery Money system.

- **Every 10 Minutes:** A new reward cycle begins.
- **Three Winners:** $5, $10, and $15 prizes.
- **Interactive Reveal:** Viewers use their phones to "Reveal" prizes triggered on the TV.

## INTRO VIDEO SCRIPT: THE CHAMPIONSHIP BROADCAST

> "Welcome to the Big Screen! You are watching the tournament as it was meant to be seen: in stunning HD, right here on ZTVLIVE. Forget the small screen and the laggy mobile apps. We are bringing you NBC-quality stability on your Roku and Fire TV! Plus, we're giving away cash every ten minutes. Scan the QR code on your screen right now to join the Mystery Money reveal!"

## CONCLUSION: UPGRADE YOUR TOURNAMENT EXPERIENCE

March Madness is too important for mobile viewing. Upgrade to the big screen. Download ZTVLIVE on your Roku or Fire TV today and experience the stability of 15 years of broadcast expertise.

---

*Ready for championship-quality streaming? [Watch on ZTVLIVE today](/watch).*
    `
  },
  {
    id: 'global-reach-translation',
    title: 'ZTVLIVE Goes Global: 20+ Languages Now Available for Worldwide Audience',
    subtitle: 'Breaking Language Barriers in Live TV Streaming',
    heroImage: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=1200&h=630&fit=crop',
    publishedAt: '2026-04-13T10:00:00Z',
    readTime: '5 min read',
    category: 'Platform Updates',
    excerpt: "ZTVLIVE is now accessible to viewers worldwide with full UI translation in 20+ languages including Spanish, French, German, Chinese, Japanese, Korean, Arabic, Hindi, and more.",
    content: `
## BREAKING DOWN LANGUAGE BARRIERS

Today marks a significant milestone for ZTVLIVE. We are officially launching support for **20+ languages**, making our 24/7 live streaming platform accessible to viewers around the globe.

### SUPPORTED LANGUAGES:

- **European:** English, Spanish, French, German, Italian, Portuguese, Russian, Polish, Dutch
- **Asian:** Chinese (Simplified), Japanese, Korean, Hindi, Vietnamese, Thai, Indonesian, Malay
- **Middle Eastern:** Arabic, Turkish
- **Southeast Asian:** Filipino/Tagalog

## HOW IT WORKS

Our new **Global Language Selector** is available on every page:

1. **Watch Page:** Change language from the top-right controls
2. **Game Page:** Fully translated gameplay experience
3. **Creator Dashboard:** Manage your content in your native language
4. **Navigation:** All menus and buttons adapt instantly

## REAL-TIME UI TRANSLATION

When you select a language, the entire interface updates:

- **Live Chat:** "Chat en Vivo" (Spanish) or "实时聊天" (Chinese)
- **Share & Invite:** "Partager & Inviter" (French) or "공유 & 초대" (Korean)
- **Download App:** Translated prompts for all platforms

## FOR CREATORS: REACH A GLOBAL AUDIENCE

This feature isn't just for viewers. As a creator, you can now:

- **Connect with international fans** who prefer their native language
- **Expand your reach** to non-English speaking markets
- **Build global communities** around your content

## THE TECHNOLOGY

Our translation system is powered by:

- **Pre-translated UI strings** for instant loading (no API delays)
- **Automatic browser language detection** for first-time visitors
- **Persistent language preferences** saved locally

---

*Ready to reach a global audience? Start streaming on ZTVLIVE today!*
    `
  },
  {
    id: 'smart-stream-technology',
    title: 'Smart Stream Technology: How ZTVLIVE Eliminates Buffering Forever',
    subtitle: 'Auto-Recovery, Freeze Detection & Promo Video Fallback',
    heroImage: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1200&h=630&fit=crop',
    publishedAt: '2026-04-12T14:00:00Z',
    readTime: '6 min read',
    category: 'Technology',
    excerpt: "Our new Smart Stream Technology detects frozen frames, silent audio, and buffering issues in real-time—then automatically switches to ZTVLIVE promo content to keep your broadcast seamless.",
    content: `
## THE PROBLEM WITH LIVE STREAMING

Every live streaming platform faces the same challenges:

- **Frozen frames** at the end of videos
- **Buffering issues** during high traffic
- **Silent audio** when tracks fail to load
- **Embedding errors** from content restrictions

Traditional platforms show spinning wheels, error messages, or blank screens. **ZTVLIVE solves this differently.**

## INTRODUCING: SMART STREAM TECHNOLOGY

Our new intelligent streaming system monitors your broadcast in real-time:

### 1. FREEZE FRAME DETECTION

- **Monitors video progress** every 2 seconds
- **Detects frozen content** when playback time doesn't advance
- **Triggers auto-recovery** after 4 seconds of no movement

### 2. AUTO-PROMO FALLBACK

When an issue is detected, ZTVLIVE automatically:

1. Pauses the problematic content
2. Switches to curated **ZTVLIVE promo videos**
3. Displays "📺 ZTVLIVE Promo" badge
4. Returns to live content when the issue resolves

### 3. CONTENT HEALTH MONITORING

- **Real-time health checks** on all scheduled content
- **Automatic disabling** of videos with embedding errors
- **Auto-replenishment** when library falls below threshold

## FOR BROADCASTERS

This means:

- **Zero viewer drop-off** from technical issues
- **Professional appearance** maintained 24/7
- **No manual intervention** required

## THE TECHNICAL DETAILS

Our system uses:

- **Freeze Frame Watchdog:** Monitors player state every 2 seconds
- **Promo Video Pool:** 4+ curated ZTVLIVE promotional clips
- **Content Health API:** Real-time library monitoring
- **Auto-Replenishment:** Adds fresh content when >50 videos are disabled

---

*Experience buffering-free streaming. Watch ZTVLIVE now!*
    `
  },
  {
    id: 'creator-upload-guide',
    title: 'The Complete Creator Upload Guide: 6 Ways to Get Your Content on ZTVLIVE',
    subtitle: 'File Upload, YouTube Import, TikTok, Reels, Streams & Scheduling',
    heroImage: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200&h=630&fit=crop',
    publishedAt: '2026-04-11T11:00:00Z',
    readTime: '7 min read',
    category: 'Creator Growth',
    excerpt: "From direct file uploads to bulk YouTube imports, ZTVLIVE offers 6 different ways to get your content on 24/7 TV. Here's your complete guide to maximizing your reach.",
    content: `
## 6 WAYS TO UPLOAD YOUR CONTENT

ZTVLIVE offers multiple pathways to get your content on our 24/7 broadcast:

### 1. DIRECT FILE UPLOAD

**Supported Formats:** MP4, MOV, WebM, FLV, AVI, MKV
**Max Size:** 500MB per file

Simply drag and drop your video files. They'll be processed and added to your library within minutes.

### 2. YOUTUBE LINK IMPORT

Have a YouTube video? Just paste the URL:

- Works with any public YouTube video
- Automatically extracts metadata
- Preserves video quality

### 3. BULK YOUTUBE CHANNEL IMPORT

This is the **fastest way** to build your library:

1. Go to **Creator Dashboard → Import YouTube Channel**
2. Enter your YouTube channel URL
3. Select which videos to import
4. Click "Import All" — done in 30 seconds!

### 4. TIKTOK, SHORTS & REELS IMPORT

Short-form content works great on TV! Our system:

- **Auto-reframes** vertical videos to TV format
- **Adds blur background** for cinematic look
- **Preserves audio quality**

### 5. LIVE STREAM URL

Already have a stream running? Submit your:

- **HLS Stream** (.m3u8 URL)
- **RTMP Stream** (rtmp:// URL)

Your live content goes straight to the 24/7 broadcast.

### 6. SCHEDULE PRIME TIME SLOTS

Book specific time slots on our schedule:

- **15-minute blocks** available
- **Prime time placement** for maximum views
- **Recurring schedule** options

## QUALITY REQUIREMENTS

For the best viewer experience:

- **Minimum:** 720p HD
- **Recommended:** 1080p Full HD
- **Audio:** Clear stereo audio

Our system automatically filters content below 720p to maintain broadcast quality.

## GETTING STARTED

1. **Sign up** at ztvlivestream.com
2. **Access Dashboard** after login
3. **Choose your upload method**
4. **Watch your content go live!**

---

*Ready to reach millions? [Start uploading now](/upload-and-earn).*
    `
  },
  {
    id: 'download-app-everywhere',
    title: 'ZTVLIVE is Now on Every Screen: Roku, Fire TV, Samsung, LG & Mobile',
    subtitle: 'Download the Free App and Start Watching Instantly',
    heroImage: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=1200&h=630&fit=crop',
    publishedAt: '2026-04-10T09:00:00Z',
    readTime: '4 min read',
    category: 'Platform Updates',
    excerpt: "ZTVLIVE is available everywhere you watch. Download our free app on Roku, Amazon Fire TV, Samsung Smart TV, LG Smart TV, and mobile devices.",
    content: `
## WATCH ZTVLIVE ANYWHERE

We believe great content should be accessible on any screen. That's why ZTVLIVE is now available on:

### SMART TV PLATFORMS

- **Roku:** Available on all Roku devices
- **Amazon Fire TV:** Fire Stick, Fire TV Cube, Fire TV
- **Samsung Smart TV:** 2018 and newer models
- **LG Smart TV:** webOS 4.0 and newer

### MOBILE & WEB

- **iOS App:** iPhone and iPad
- **Android App:** All Android devices
- **Web Browser:** Any modern browser

## HOW TO DOWNLOAD

### ROKU
1. Press Home on your Roku remote
2. Select "Streaming Channels"
3. Search for "ZTVLIVE"
4. Click "Add Channel"

### AMAZON FIRE TV
1. Go to "Find" → "Search"
2. Type "ZTVLIVE"
3. Select and click "Get"

### SAMSUNG TV
1. Press Home on your remote
2. Go to "Apps"
3. Search for "ZTVLIVE"
4. Click "Install"

### LG TV
1. Press Home button
2. Open "LG Content Store"
3. Search "ZTVLIVE"
4. Click "Install"

## WHAT YOU GET

- **24/7 Live Streaming** — Always something new to watch
- **Interactive Game Show** — Play and win real prizes
- **Multi-Language Support** — 20+ languages available
- **High-Quality Video** — Up to 1080p HD
- **Free to Watch** — No subscription required

## SYNC ACROSS DEVICES

Start watching on your TV, continue on your phone:

- Same account across all platforms
- Watch history synced
- Preferences saved

---

*Download ZTVLIVE today and start watching!*
    `
  }
];

// Category color mapping
const getCategoryColor = (category) => {
  const colors = {
    'OTT Distribution': 'bg-purple-600',
    'Creator Economy': 'bg-green-600',
    'Creator Growth': 'bg-blue-600',
    'Live Sports': 'bg-red-600',
    'Platform Updates': 'bg-cyan-600',
    'Technology': 'bg-orange-600',
  };
  return colors[category] || 'bg-purple-600';
};

// Simple markdown renderer
function renderMarkdown(content) {
  // Split into lines and process
  const lines = content.trim().split('\n');
  const elements = [];
  let currentList = [];
  let listType = null;
  
  const flushList = () => {
    if (currentList.length > 0) {
      if (listType === 'ul') {
        elements.push(
          <ul key={elements.length} className="list-disc list-inside space-y-2 mb-4 text-zinc-300">
            {currentList.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        );
      } else {
        elements.push(
          <ol key={elements.length} className="list-decimal list-inside space-y-2 mb-4 text-zinc-300">
            {currentList.map((item, i) => <li key={i}>{item}</li>)}
          </ol>
        );
      }
      currentList = [];
      listType = null;
    }
  };

  lines.forEach((line, idx) => {
    // Headers
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={idx} className="text-2xl font-bold text-white mt-8 mb-4">
          {line.replace('## ', '')}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={idx} className="text-xl font-semibold text-purple-400 mt-6 mb-3">
          {line.replace('### ', '')}
        </h3>
      );
    } else if (line.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={idx} className="border-l-4 border-purple-500 pl-4 py-2 my-4 bg-purple-900/20 rounded-r-lg text-zinc-300 italic">
          {line.replace('> ', '')}
        </blockquote>
      );
    } else if (line.startsWith('- ')) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      // Parse bold text
      const text = line.replace('- ', '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
      currentList.push(<span dangerouslySetInnerHTML={{ __html: text }} />);
    } else if (line.match(/^\d+\. /)) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      const text = line.replace(/^\d+\. /, '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
      currentList.push(<span dangerouslySetInnerHTML={{ __html: text }} />);
    } else if (line === '---') {
      flushList();
      elements.push(<hr key={idx} className="border-zinc-700 my-8" />);
    } else if (line.trim()) {
      flushList();
      // Parse inline formatting
      let text = line
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-purple-400 hover:text-purple-300 underline">$1</a>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      elements.push(
        <p key={idx} className="text-zinc-300 mb-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: text }} />
      );
    }
  });
  
  flushList();
  return elements;
}

export default function BlogPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [selectedPost, setSelectedPost] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');

  // Get unique categories
  const categories = ['All', ...new Set(BLOG_POSTS.map(p => p.category))];

  // Filter posts by category
  const filteredPosts = activeCategory === 'All' 
    ? BLOG_POSTS 
    : BLOG_POSTS.filter(p => p.category === activeCategory);

  // Get current post for SEO
  const currentPost = slug ? BLOG_POSTS.find(p => p.id === slug) : null;

  // Get related articles (same category, excluding current)
  const relatedArticles = currentPost 
    ? BLOG_POSTS.filter(p => p.id !== currentPost.id && p.category === currentPost.category).slice(0, 2)
    : [];
  
  // If not enough related in same category, add from other categories
  const additionalRelated = currentPost && relatedArticles.length < 2
    ? BLOG_POSTS.filter(p => p.id !== currentPost.id && p.category !== currentPost.category).slice(0, 2 - relatedArticles.length)
    : [];
  
  const allRelated = [...relatedArticles, ...additionalRelated];

  // Dynamic SEO for blog pages
  useSEO({
    title: currentPost 
      ? `${currentPost.title} | ZTVLIVE Blog`
      : 'ZTVLIVE Blog | OTT Distribution & Creator Monetization Insights',
    description: currentPost 
      ? currentPost.excerpt
      : 'The latest insights on OTT distribution, creator monetization, and building the future of live streaming. Learn how ZTVLIVE empowers creators with 70% revenue share.',
    image: currentPost 
      ? currentPost.heroImage
      : 'https://customer-assets.emergentagent.com/job_best-bites-live/artifacts/5qzu6t9b_idBqfgHFvQl.webp',
    url: currentPost 
      ? `${BASE_URL}/blog/${currentPost.id}`
      : `${BASE_URL}/blog`,
    type: currentPost ? 'article' : 'website',
    publishedAt: currentPost?.publishedAt,
    author: 'ZTVLIVE'
  });

  // Handle URL-based article routing
  useEffect(() => {
    if (slug) {
      const post = BLOG_POSTS.find(p => p.id === slug);
      if (post) {
        setSelectedPost(slug);
      }
    } else {
      setSelectedPost(null);
    }
  }, [slug]);

  // Add JSON-LD structured data for articles
  useEffect(() => {
    // Remove any existing blog JSON-LD
    const existing = document.querySelector('script[data-blog-jsonld]');
    if (existing) existing.remove();

    if (currentPost) {
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": currentPost.title,
        "description": currentPost.excerpt,
        "image": currentPost.heroImage,
        "author": {
          "@type": "Organization",
          "name": "ZTVLIVE",
          "url": "https://www.ztvlivestream.com"
        },
        "publisher": {
          "@type": "Organization",
          "name": "ZTVLIVE",
          "logo": {
            "@type": "ImageObject",
            "url": "https://www.ztvlivestream.com/logo512.png"
          }
        },
        "datePublished": currentPost.publishedAt,
        "dateModified": currentPost.publishedAt,
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": `${BASE_URL}/blog/${currentPost.id}`
        },
        "articleSection": currentPost.category
      };

      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-blog-jsonld', 'true');
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    } else {
      // Blog listing page structured data
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": "ZTVLIVE Blog",
        "description": "The latest insights on OTT distribution, creator monetization, and building the future of live streaming.",
        "url": `${BASE_URL}/blog`,
        "publisher": {
          "@type": "Organization",
          "name": "ZTVLIVE",
          "logo": {
            "@type": "ImageObject",
            "url": "https://www.ztvlivestream.com/logo512.png"
          }
        },
        "blogPost": BLOG_POSTS.map(post => ({
          "@type": "BlogPosting",
          "headline": post.title,
          "description": post.excerpt,
          "image": post.heroImage,
          "datePublished": post.publishedAt,
          "url": `${BASE_URL}/blog/${post.id}`
        }))
      };

      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-blog-jsonld', 'true');
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const script = document.querySelector('script[data-blog-jsonld]');
      if (script) script.remove();
    };
  }, [currentPost]);

  const sharePost = (post, platform) => {
    const url = encodeURIComponent(`https://www.ztvlivestream.com/blog/${post.id}`);
    const text = encodeURIComponent(post.title);
    
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    };
    
    window.open(urls[platform], '_blank', 'width=600,height=400');
  };

  const copyLink = (post) => {
    navigator.clipboard?.writeText(`https://www.ztvlivestream.com/blog/${post.id}`);
    toast.success('Link copied!');
  };

  const handleSelectPost = (postId) => {
    navigate(`/blog/${postId}`);
  };

  const handleBackToBlog = () => {
    navigate('/blog');
  };

  // Single post view
  if (selectedPost) {
    const post = BLOG_POSTS.find(p => p.id === selectedPost);
    if (!post) return null;

    return (
      <div className="min-h-screen bg-zinc-950">
        {/* Hero Image */}
        <div className="relative h-[40vh] sm:h-[50vh] overflow-hidden">
          <img 
            src={post.heroImage} 
            alt={post.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
          
          {/* Back Button */}
          <button
            onClick={handleBackToBlog}
            data-testid="back-to-blog-btn"
            className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 bg-zinc-900/80 backdrop-blur-sm rounded-full text-white hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </button>
        </div>

        {/* Article Content */}
        <div className="max-w-3xl mx-auto px-4 -mt-20 relative z-10">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className={`px-3 py-1 ${getCategoryColor(post.category)} text-white text-xs font-semibold rounded-full`}>
              {post.category}
            </span>
            <span className="flex items-center gap-1 text-zinc-400 text-sm">
              <Calendar className="w-4 h-4" />
              {new Date(post.publishedAt).toLocaleDateString('en-US', { 
                month: 'long', day: 'numeric', year: 'numeric' 
              })}
            </span>
            <span className="flex items-center gap-1 text-zinc-400 text-sm">
              <Clock className="w-4 h-4" />
              {post.readTime}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            {post.title}
          </h1>
          
          <p className="text-xl text-zinc-400 mb-6">{post.subtitle}</p>

          {/* Share Buttons */}
          <div className="flex items-center gap-2 mb-8 pb-8 border-b border-zinc-800">
            <span className="text-zinc-500 text-sm mr-2">Share:</span>
            <button
              onClick={() => sharePost(post, 'twitter')}
              className="p-2 bg-zinc-800 hover:bg-[#1DA1F2]/20 rounded-full transition-colors"
            >
              <Twitter className="w-4 h-4 text-[#1DA1F2]" />
            </button>
            <button
              onClick={() => sharePost(post, 'facebook')}
              className="p-2 bg-zinc-800 hover:bg-[#4267B2]/20 rounded-full transition-colors"
            >
              <Facebook className="w-4 h-4 text-[#4267B2]" />
            </button>
            <button
              onClick={() => sharePost(post, 'linkedin')}
              className="p-2 bg-zinc-800 hover:bg-[#0077B5]/20 rounded-full transition-colors"
            >
              <Linkedin className="w-4 h-4 text-[#0077B5]" />
            </button>
            <button
              onClick={() => copyLink(post)}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
            >
              <Share2 className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          {/* Article Body */}
          <article className="prose prose-invert max-w-none">
            {renderMarkdown(post.content)}
          </article>

          {/* Related Articles */}
          {allRelated.length > 0 && (
            <div className="mt-12 pt-8 border-t border-zinc-800">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <ChevronRight className="w-5 h-5 text-purple-400" />
                Related Articles
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {allRelated.map((related) => (
                  <Link 
                    key={related.id} 
                    to={`/blog/${related.id}`}
                    className="group block"
                    data-testid={`related-${related.id}`}
                  >
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all">
                      <div className="relative h-32 overflow-hidden">
                        <img 
                          src={related.heroImage} 
                          alt={related.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent" />
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-purple-600/80 text-white text-[10px] font-semibold rounded-full">
                          {related.category}
                        </span>
                      </div>
                      <div className="p-4">
                        <h4 className="font-semibold text-white text-sm group-hover:text-purple-400 transition-colors line-clamp-2">
                          {related.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                          <Clock className="w-3 h-3" />
                          {related.readTime}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="mt-12 mb-16 p-8 bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl border border-purple-500/30 text-center">
            <h3 className="text-2xl font-bold text-white mb-3">Ready to Get Started?</h3>
            <p className="text-zinc-300 mb-6">Join ZTVLIVE and start streaming to millions on Roku, Fire TV, and more.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/submit">
                <Button className="bg-purple-600 hover:bg-purple-500 px-8">
                  Start Creating
                </Button>
              </Link>
              <Link to="/play">
                <Button variant="outline" className="border-zinc-600 text-white hover:bg-zinc-800 px-8">
                  Play the Game
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Blog listing
  return (
    <div className="min-h-screen bg-zinc-950" data-testid="blog-listing-page">
      {/* Header */}
      <header className="bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" data-testid="blog-home-link">
            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center">
              <span className="text-xl font-black text-white">Z</span>
            </div>
            <span className="text-xl font-bold text-white">ZTVLIVE Blog</span>
          </Link>
          <Link to="/play" data-testid="blog-play-btn">
            <Button className="bg-purple-600 hover:bg-purple-500">
              Play Now
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-900/30 via-zinc-900 to-pink-900/30 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            ZTVLIVE Insights
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            The latest on OTT distribution, creator monetization, and building the future of live streaming.
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="max-w-6xl mx-auto px-4 pt-8">
        <div className="flex flex-wrap items-center gap-2 justify-center">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              data-testid={`filter-${category.toLowerCase().replace(/\s+/g, '-')}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === category
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700/50 hover:text-white'
              }`}
            >
              {category}
              {category !== 'All' && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({BLOG_POSTS.filter(p => p.category === category).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Blog Posts */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              data-testid={`blog-card-${post.id}`}
              className="group bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all cursor-pointer"
              onClick={() => handleSelectPost(post.id)}
            >
              {/* Hero Image */}
              <div className="relative h-56 overflow-hidden">
                <img 
                  src={post.heroImage} 
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent" />
                <span className={`absolute bottom-4 left-4 px-3 py-1 ${getCategoryColor(post.category)} text-white text-xs font-semibold rounded-full`}>
                  {post.category}
                </span>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center gap-3 text-sm text-zinc-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(post.publishedAt).toLocaleDateString('en-US', { 
                      month: 'short', day: 'numeric' 
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {post.readTime}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-white mb-3 group-hover:text-purple-400 transition-colors line-clamp-2">
                  {post.title}
                </h2>

                <p className="text-zinc-400 mb-4 line-clamp-3">
                  {post.excerpt}
                </p>

                <div className="flex items-center text-purple-400 font-semibold group-hover:text-purple-300">
                  Read Article
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Content?
          </h2>
          <p className="text-zinc-300 mb-8 max-w-2xl mx-auto">
            Join ZTVLIVE and reach audiences on Roku, Fire TV, Samsung, and LG with professional 24/7 streaming.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/submit">
              <Button className="bg-white text-zinc-900 hover:bg-zinc-200 px-8 py-3 text-lg font-semibold">
                Get Started Free
              </Button>
            </Link>
            <Link to="/play">
              <Button variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-3 text-lg">
                Try the Game
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-zinc-900 border-t border-zinc-800 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center">
              <span className="text-sm font-black text-white">Z</span>
            </div>
            <span className="text-zinc-400">© 2026 ZTVLIVE. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://twitter.com/ztvlive" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white">
              <Twitter className="w-5 h-5" />
            </a>
            <a href="https://facebook.com/ztvlive" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white">
              <Facebook className="w-5 h-5" />
            </a>
            <a href="https://linkedin.com/company/ztvlive" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white">
              <Linkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
