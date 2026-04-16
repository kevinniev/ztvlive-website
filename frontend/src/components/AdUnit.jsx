import { useEffect, useRef } from 'react';

/**
 * Google AdSense Ad Component
 * Place this component where you want ads to appear
 * 
 * Usage:
 * <AdUnit slot="1234567890" format="auto" />
 * <AdUnit slot="1234567890" format="rectangle" style={{ width: 300, height: 250 }} />
 */
export default function AdUnit({ 
  slot, 
  format = "auto", 
  responsive = true,
  style = {},
  className = ""
}) {
  const adRef = useRef(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    // Only load ad once
    if (isLoaded.current) return;
    
    try {
      // Push ad to AdSense
      if (window.adsbygoogle && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isLoaded.current = true;
      }
    } catch (error) {
      console.error('AdSense error:', error);
    }
  }, []);

  // Don't render if no slot provided
  if (!slot) return null;

  return (
    <div className={`ad-container ${className}`} style={{ textAlign: 'center', ...style }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ 
          display: 'block',
          ...style 
        }}
        data-ad-client="ca-pub-4098362511040786"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}

/**
 * In-feed Ad for content lists
 */
export function InFeedAd({ slot, layoutKey }) {
  const adRef = useRef(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    if (isLoaded.current) return;
    
    try {
      if (window.adsbygoogle && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isLoaded.current = true;
      }
    } catch (error) {
      console.error('AdSense error:', error);
    }
  }, []);

  if (!slot) return null;

  return (
    <ins
      ref={adRef}
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client="ca-pub-4098362511040786"
      data-ad-slot={slot}
      data-ad-format="fluid"
      data-ad-layout-key={layoutKey || "-fb+5w+4e-db+86"}
    />
  );
}

/**
 * Sticky Ad for sidebar or bottom
 */
export function StickyAd({ slot, position = "bottom" }) {
  const adRef = useRef(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    if (isLoaded.current) return;
    
    try {
      if (window.adsbygoogle && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isLoaded.current = true;
      }
    } catch (error) {
      console.error('AdSense error:', error);
    }
  }, []);

  if (!slot) return null;

  const positionStyles = {
    bottom: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40 },
    sidebar: { position: 'sticky', top: 80 }
  };

  return (
    <div style={positionStyles[position] || positionStyles.bottom}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-4098362511040786"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

/**
 * Ad placeholder for development/testing
 * Shows a visual placeholder when ads aren't loading
 */
export function AdPlaceholder({ width = 300, height = 250, label = "Advertisement" }) {
  return (
    <div 
      className="bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center"
      style={{ width, height }}
    >
      <span className="text-zinc-500 text-sm">{label}</span>
    </div>
  );
}
