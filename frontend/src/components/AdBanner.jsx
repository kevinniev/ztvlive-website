import { useEffect, useRef } from "react";

/**
 * AdSense Display Ad Component
 * Uses Google AdSense with Publisher ID: ca-pub-4098362511040786
 */
export default function AdBanner({ 
  slot = "auto",
  format = "auto",
  responsive = true,
  style = {},
  className = ""
}) {
  const adRef = useRef(null);
  const isLoaded = useRef(false);

  useEffect(() => {
    if (isLoaded.current) return;
    
    try {
      // Push ad after component mounts
      if (window.adsbygoogle && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        isLoaded.current = true;
      }
    } catch (error) {
      console.log("AdSense error:", error);
    }
  }, []);

  return (
    <div className={`adsense-container ${className}`} style={style}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", ...style }}
        data-ad-client="ca-pub-4098362511040786"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}

/**
 * In-Feed Ad Component
 * For ads within content lists
 */
export function InFeedAd({ layoutKey = "-fb+5w+4e-db+86", className = "" }) {
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
      console.log("AdSense in-feed error:", error);
    }
  }, []);

  return (
    <div className={`adsense-infeed ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-4098362511040786"
        data-ad-format="fluid"
        data-ad-layout-key={layoutKey}
      />
    </div>
  );
}

/**
 * Multiplex Ad Component
 * Grid-style ad unit for related content
 */
export function MultiplexAd({ className = "" }) {
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
      console.log("AdSense multiplex error:", error);
    }
  }, []);

  return (
    <div className={`adsense-multiplex ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-4098362511040786"
        data-ad-format="autorelaxed"
      />
    </div>
  );
}

/**
 * Sponsorship Banner Component
 * Custom managed ad placements for direct sponsors
 */
export function SponsorBanner({ 
  sponsor = null,
  fallbackText = "Advertise with ZTVLIVE",
  onClick = () => {}
}) {
  if (sponsor) {
    return (
      <a 
        href={sponsor.url} 
        target="_blank" 
        rel="noopener noreferrer sponsored"
        className="block bg-gradient-to-r from-zinc-900 to-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors"
        onClick={onClick}
      >
        <div className="flex items-center gap-4">
          {sponsor.logo && (
            <img 
              src={sponsor.logo} 
              alt={sponsor.name}
              className="h-10 w-auto object-contain"
            />
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Sponsored</p>
            <p className="text-white font-medium">{sponsor.name}</p>
            {sponsor.tagline && (
              <p className="text-gray-400 text-sm">{sponsor.tagline}</p>
            )}
          </div>
        </div>
      </a>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-dashed border-zinc-700 rounded-lg p-4 text-center">
      <p className="text-gray-500 text-sm">{fallbackText}</p>
      <a href="mailto:ads@ztvlivestream.com" className="text-red-500 text-sm hover:underline">
        Contact for rates
      </a>
    </div>
  );
}
