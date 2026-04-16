import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SEO Head Component - Manages canonical tags and page-specific meta
 * Fixes Google Search Console issues:
 * - Duplicate without user-selected canonical
 * - Alternate page with proper canonical tag
 */

// Map of route aliases to their canonical URLs
const CANONICAL_ROUTES = {
  '/': '/',
  '/watch': '/watch',
  '/schedule': '/schedule',
  '/trending': '/browse',
  '/browse': '/browse',
  '/library': '/library',
  '/login': '/login',
  '/register': '/register',
  '/join': '/register',      // Alias -> canonical
  '/signup': '/register',    // Alias -> canonical
  '/sign-up': '/register',   // Alias -> canonical
  '/about': '/about',
  '/contact': '/contact',
  '/services': '/services',
  '/get-paid': '/get-paid',
  '/go-live': '/go-live',
  '/upload': '/upload-and-earn',           // Alias -> canonical
  '/upload-and-earn': '/upload-and-earn',
  '/creator/dashboard': '/creator/dashboard',
  '/creator/youtube-import': '/creator/youtube-import',
  '/creator/import': '/creator/youtube-import',  // Alias -> canonical
  '/creator/schedule': '/creator/schedule',
  '/schedule-slot': '/creator/schedule',   // Alias -> canonical
  '/terms': '/terms-of-service',           // Alias -> canonical
  '/tos': '/terms-of-service',             // Alias -> canonical
  '/terms-of-service': '/terms-of-service',
  '/creator-agreement': '/creator-agreement',
  '/privacy': '/privacy',
  '/downloads': '/promo-downloads',
  '/promo-videos': '/promo-downloads',       // Alias -> canonical
  '/promo-downloads': '/promo-downloads',
  '/download': '/download',                  // App download page
  '/get-app': '/download',                   // Alias -> canonical
  '/install': '/download',                   // Alias -> canonical
  '/roku': '/roku',
  '/firetv': '/firetv',
  '/samsung': '/samsung',
  '/lg': '/lg',
  '/password/reset': '/password/reset',
  '/forgot-password': '/password/reset',   // Alias -> canonical
  '/reset-password': '/password/reset',    // Alias -> canonical
};

// Page-specific titles and descriptions
const PAGE_META = {
  '/': {
    title: 'ZTVLIVE | 24/7 Live TV - Upload Videos & Earn 70% Revenue Share',
    description: 'Create. Stream. Earn. Upload your videos to ZTVLIVE and earn 70% revenue share from millions of viewers on Roku, Fire TV, Samsung, and LG Smart TVs. Free 24/7 streaming.',
  },
  '/watch': {
    title: 'Watch Live | ZTVLIVE - Free 24/7 Streaming',
    description: 'Watch ZTVLIVE now! Free 24/7 live streaming music, sports, entertainment. No subscription required. Available on web, Roku, and Smart TVs.',
  },
  '/register': {
    title: 'Join ZTVLIVE | Start Earning 70% Revenue Share Today',
    description: 'Join the creator revolution! ZTVLIVE offers 70% revenue share (vs YouTube 55%), weekly payouts, and broadcast to millions on Roku, Fire TV, Samsung & LG. No subscriber requirements.',
  },
  '/get-paid': {
    title: 'Get Paid | ZTVLIVE Creator Monetization - 70% Revenue Share',
    description: 'Earn 70% revenue share with ZTVLIVE. Weekly payouts, $5-15 per 1K views. The fairest creator payout in streaming. Start earning from day one.',
  },
  '/go-live': {
    title: 'Go Live | Broadcast on ZTVLIVE to Millions',
    description: 'Start broadcasting on ZTVLIVE. Reach millions on Roku, Fire TV, Samsung, and LG smart TVs. Submit your HLS or RTMP stream.',
  },
  '/upload-and-earn': {
    title: 'Upload & Earn | ZTVLIVE Creator Upload - 70% Revenue Share',
    description: 'Upload your videos to ZTVLIVE and earn 70% revenue share. Supports MP4, MOV, WebM, MKV. Import from YouTube, TikTok, Instagram Reels. Weekly payouts.',
  },
  '/upload': {
    title: 'Upload Content | ZTVLIVE - Earn 70% Revenue Share',
    description: 'Upload videos to ZTVLIVE. Support for MP4, MOV, WebM, FLV, AVI, MKV up to 500MB. Import from YouTube Shorts, TikTok, Instagram Reels.',
  },
  '/creator/dashboard': {
    title: 'Creator Dashboard | ZTVLIVE - Manage Your Content',
    description: 'Manage your ZTVLIVE content. View analytics, track earnings, import YouTube channel, upload new videos, and schedule prime time slots.',
  },
  '/creator/youtube-import': {
    title: 'YouTube Import | ZTVLIVE - Import Your Entire Channel',
    description: 'Import your entire YouTube channel to ZTVLIVE in 30 seconds. Bulk import all videos. Earn 70% revenue share instead of YouTube 55%.',
  },
  '/creator/schedule': {
    title: 'Schedule Content | ZTVLIVE - Book Prime Time Slots',
    description: 'Schedule your content on ZTVLIVE 24/7 stream. Book prime time slots for maximum views and earnings.',
  },
  '/schedule': {
    title: 'TV Schedule | ZTVLIVE Programming Guide',
    description: 'See what\'s on ZTVLIVE. 24/7 programming schedule for music, sports, entertainment and more.',
  },
  '/trending': {
    title: 'Trending Now | ZTVLIVE Hot Content',
    description: 'Discover trending content on ZTVLIVE. The hottest music, videos, and entertainment.',
  },
  '/terms-of-service': {
    title: 'Terms of Service | ZTVLIVE',
    description: 'ZTVLIVE Terms of Service. Read our terms and conditions for using the platform.',
  },
  '/creator-agreement': {
    title: 'Creator Agreement | ZTVLIVE',
    description: 'ZTVLIVE Creator Agreement. Terms for content creators and revenue sharing.',
  },
  '/downloads': {
    title: 'Promo Videos | ZTVLIVE Marketing Materials',
    description: 'Download official ZTVLIVE promo videos for marketing and social media.',
  },
  '/promo-downloads': {
    title: 'Promo Videos | ZTVLIVE Marketing Materials',
    description: 'Download official ZTVLIVE promo videos for marketing and social media.',
  },
  '/download': {
    title: 'Download ZTVLIVE App | Smart TV, Mobile & Desktop',
    description: 'Download ZTVLIVE on Roku, Fire TV, Samsung, LG, Android, iOS, Windows, Mac. Watch 24/7 live streaming with auto-updates and no buffering.',
  },
  '/password/reset': {
    title: 'Reset Password | ZTVLIVE',
    description: 'Reset your ZTVLIVE account password. Enter your email to receive reset instructions.',
  },
  '/browse': {
    title: 'Browse Content | ZTVLIVE',
    description: 'Browse and discover content on ZTVLIVE. Find your favorite creators and shows.',
  },
};

const BASE_URL = 'https://www.ztvlivestream.com';

export default function SEOHead() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  useEffect(() => {
    // Determine canonical URL
    const canonicalPath = CANONICAL_ROUTES[currentPath] || currentPath;
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;
    
    // Update or create canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;
    
    // Update Open Graph URL
    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.content = canonicalUrl;
    }
    
    // Update Twitter URL
    let twitterUrl = document.querySelector('meta[name="twitter:url"]');
    if (twitterUrl) {
      twitterUrl.content = canonicalUrl;
    }
    
    // Get page-specific meta or use defaults
    const meta = PAGE_META[canonicalPath] || PAGE_META['/'];
    
    // Update title
    if (meta.title) {
      document.title = meta.title;
      
      let ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.content = meta.title;
      
      let twitterTitle = document.querySelector('meta[name="twitter:title"]');
      if (twitterTitle) twitterTitle.content = meta.title;
    }
    
    // Update description
    if (meta.description) {
      let descMeta = document.querySelector('meta[name="description"]');
      if (descMeta) descMeta.content = meta.description;
      
      let ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.content = meta.description;
      
      let twitterDesc = document.querySelector('meta[name="twitter:description"]');
      if (twitterDesc) twitterDesc.content = meta.description;
    }
    
    // Handle noindex for alias pages (Google should only index canonical)
    let robotsMeta = document.querySelector('meta[name="robots"]');
    const isAliasPage = CANONICAL_ROUTES[currentPath] && CANONICAL_ROUTES[currentPath] !== currentPath;
    
    if (isAliasPage && robotsMeta) {
      // Tell search engines this is an alternate, follow canonical
      robotsMeta.content = 'noindex, follow';
    } else if (robotsMeta) {
      // Normal indexable page
      robotsMeta.content = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
    }
    
  }, [currentPath]);
  
  return null; // This component only manages document head, renders nothing
}
