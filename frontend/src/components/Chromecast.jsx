import { useState, useEffect, useCallback, useRef } from 'react';
import { Cast, Monitor, Tv, ExternalLink, X } from 'lucide-react';

/**
 * Chromecast Hook - Manages Google Cast integration
 * Allows viewers to cast ZTVLIVE content to their TV
 */

// Cast application ID - using default media receiver for YouTube content
const CAST_RECEIVER_APP_ID = 'CC1AD845';

export function useChromecast() {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castDevice, setCastDevice] = useState(null);
  const [castSession, setCastSession] = useState(null);
  const castContextRef = useRef(null);
  const initAttempted = useRef(false);

  // Initialize Cast SDK
  useEffect(() => {
    // Skip if already attempted or SSR
    if (initAttempted.current || typeof window === 'undefined') return;
    initAttempted.current = true;

    // Define the initialization callback
    window['__onGCastApiAvailable'] = (isAvailable) => {
      if (isAvailable && window.cast && window.cast.framework) {
        initializeCast();
      }
    };

    // Load Cast SDK if not already loaded
    if (!document.querySelector('script[src*="cast_sender"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.async = true;
      script.onerror = () => {
        console.log('Cast SDK failed to load - Chromecast not available');
      };
      document.head.appendChild(script);
    } else if (window.cast && window.cast.framework) {
      initializeCast();
    }

    return () => {
      // Cleanup
      if (castContextRef.current) {
        try {
          castContextRef.current.endCurrentSession(true);
        } catch (e) {}
      }
    };
  }, []);

  const initializeCast = useCallback(() => {
    // Safety check for Cast SDK availability
    if (typeof window === 'undefined' || 
        !window.cast || 
        !window.cast.framework ||
        !window.chrome ||
        !window.chrome.cast) {
      console.log('Cast SDK not fully available');
      return;
    }

    try {
      const context = window.cast.framework.CastContext.getInstance();
      castContextRef.current = context;

      context.setOptions({
        receiverApplicationId: CAST_RECEIVER_APP_ID,
        autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        resumeSavedSession: true
      });

      // Listen for cast state changes
      context.addEventListener(
        window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        (event) => {
          const state = event.castState;
          setIsCastAvailable(state !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE);
          setIsCasting(state === window.cast.framework.CastState.CONNECTED);
        }
      );

      // Listen for session state changes
      context.addEventListener(
        window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        () => {
          const session = context.getCurrentSession();
          setCastSession(session);
          
          if (session) {
            const device = session.getCastDevice();
            setCastDevice(device ? device.friendlyName : null);
          } else {
            setCastDevice(null);
          }
        }
      );

      // Check initial state
      const initialState = context.getCastState();
      setIsCastAvailable(initialState !== window.cast.framework.CastState.NO_DEVICES_AVAILABLE);

      console.log('Cast SDK initialized');
    } catch (e) {
      console.error('Error initializing Cast:', e);
    }
  }, []);

  // Start casting
  const startCast = useCallback(async () => {
    if (!window.cast || !window.cast.framework) return false;
    try {
      const context = window.cast.framework.CastContext.getInstance();
      await context.requestSession();
      return true;
    } catch (e) {
      console.error('Error starting cast:', e);
      return false;
    }
  }, []);

  // Stop casting
  const stopCast = useCallback(() => {
    if (!window.cast || !window.cast.framework) return;
    try {
      const context = window.cast.framework.CastContext.getInstance();
      context.endCurrentSession(true);
      setIsCasting(false);
      setCastDevice(null);
    } catch (e) {
      console.error('Error stopping cast:', e);
    }
  }, []);

  // Cast a video URL
  const castVideo = useCallback(async (videoUrl, title, thumbnail) => {
    if (!window.cast || !window.chrome || !window.chrome.cast) return false;
    try {
      const context = window.cast.framework.CastContext.getInstance();
      let session = context.getCurrentSession();

      if (!session) {
        await context.requestSession();
        session = context.getCurrentSession();
      }

      if (!session) {
        console.error('No cast session available');
        return false;
      }

      // Create media info
      const mediaInfo = new window.chrome.cast.media.MediaInfo(videoUrl, 'video/mp4');
      mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = title || 'ZTVLIVE';
      mediaInfo.metadata.subtitle = 'ZTVLIVE 24/7 Streaming';
      
      if (thumbnail) {
        mediaInfo.metadata.images = [{ url: thumbnail }];
      }

      // Load media
      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;

      await session.loadMedia(request);
      console.log('Media loaded on cast device');
      return true;
    } catch (e) {
      console.error('Error casting video:', e);
      return false;
    }
  }, []);

  // Cast YouTube video by ID
  const castYouTube = useCallback(async (videoId, title, startTime = 0) => {
    if (!window.cast || !window.chrome || !window.chrome.cast) return false;
    try {
      const context = window.cast.framework.CastContext.getInstance();
      let session = context.getCurrentSession();

      if (!session) {
        await context.requestSession();
        session = context.getCurrentSession();
      }

      if (!session) {
        console.error('No cast session available');
        return false;
      }

      // For YouTube, we use the YouTube receiver
      const mediaInfo = new window.chrome.cast.media.MediaInfo(videoId, 'video/youtube');
      mediaInfo.contentId = videoId;
      mediaInfo.streamType = window.chrome.cast.media.StreamType.BUFFERED;
      mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
      mediaInfo.metadata.title = title || 'ZTVLIVE';
      mediaInfo.metadata.subtitle = 'ZTVLIVE 24/7 Streaming';
      mediaInfo.metadata.images = [{ 
        url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` 
      }];

      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      request.autoplay = true;
      request.currentTime = startTime;

      await session.loadMedia(request);
      console.log('YouTube video loaded on cast device');
      return true;
    } catch (e) {
      console.error('Error casting YouTube:', e);
      return false;
    }
  }, []);

  // Control playback on cast device
  const castControl = useCallback({
    play: () => {
      if (castSession && window.cast) {
        const player = new window.cast.framework.RemotePlayer();
        const controller = new window.cast.framework.RemotePlayerController(player);
        if (player.isPaused) {
          controller.playOrPause();
        }
      }
    },
    pause: () => {
      if (castSession && window.cast) {
        const player = new window.cast.framework.RemotePlayer();
        const controller = new window.cast.framework.RemotePlayerController(player);
        if (!player.isPaused) {
          controller.playOrPause();
        }
      }
    },
    seek: (time) => {
      if (castSession && window.cast) {
        const player = new window.cast.framework.RemotePlayer();
        const controller = new window.cast.framework.RemotePlayerController(player);
        player.currentTime = time;
        controller.seek();
      }
    },
    setVolume: (volume) => {
      if (castSession && window.cast) {
        const player = new window.cast.framework.RemotePlayer();
        const controller = new window.cast.framework.RemotePlayerController(player);
        player.volumeLevel = volume;
        controller.setVolumeLevel();
      }
    },
    mute: () => {
      if (castSession && window.cast) {
        const player = new window.cast.framework.RemotePlayer();
        const controller = new window.cast.framework.RemotePlayerController(player);
        controller.muteOrUnmute();
      }
    }
  }, [castSession]);

  return {
    isCastAvailable,
    isCasting,
    castDevice,
    startCast,
    stopCast,
    castVideo,
    castYouTube,
    castControl
  };
}

/**
 * CastButton Component - Enhanced with multiple casting options
 * Supports Chromecast, Roku, Screen Mirroring
 */
export function CastButton({ 
  videoId, 
  title, 
  startTime = 0,
  className = "",
  size = "md" 
}) {
  const [showMenu, setShowMenu] = useState(false);
  const { 
    isCastAvailable, 
    isCasting, 
    castDevice, 
    startCast, 
    stopCast, 
    castYouTube 
  } = useChromecast();

  const handleChromecast = async () => {
    setShowMenu(false);
    if (isCasting) {
      stopCast();
    } else {
      const started = await startCast();
      if (started && videoId) {
        await castYouTube(videoId, title, startTime);
      }
    }
  };

  const handleRoku = () => {
    setShowMenu(false);
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(startTime)}`;
    window.open(youtubeUrl, '_blank');
    setTimeout(() => {
      alert('To cast to Roku:\n\n1. Open the YouTube app on your Roku\n2. On your phone/tablet, open the YouTube app\n3. Tap the Cast icon in YouTube\n4. Select your Roku device\n5. Play this video: ' + title);
    }, 500);
  };

  const handleScreenMirror = () => {
    setShowMenu(false);
    alert('Screen Mirroring Instructions:\n\n' +
      'Windows: Press Win + K\n' +
      'Mac: Click AirPlay icon in menu bar\n' +
      'iPhone/iPad: Control Center → Screen Mirroring\n' +
      'Android: Settings → Connected devices → Cast\n\n' +
      'Make sure your TV and device are on the same WiFi.');
  };

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  };

  // Always show the button (not just when Chromecast is available)
  return (
    <div className="relative">
      <button
        onClick={() => isCasting ? handleChromecast() : setShowMenu(!showMenu)}
        className={`flex items-center justify-center rounded-full transition-all ${
          isCasting 
            ? 'bg-blue-600 text-white' 
            : 'bg-black/60 text-white hover:bg-black/80'
        } ${sizeClasses[size]} ${className}`}
        title={isCasting ? `Casting to ${castDevice} - Click to stop` : 'Cast to TV'}
        data-testid="cast-button"
      >
        {isCasting ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
            <circle cx="5" cy="19" r="3" fill="currentColor"/>
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
          </svg>
        )}
      </button>

      {/* Cast Options Menu */}
      {showMenu && !isCasting && (
        <div className="absolute bottom-full right-0 mb-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-2 min-w-[200px] z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 mb-2">
            <span className="text-white font-medium text-sm">Cast to TV</span>
            <button onClick={() => setShowMenu(false)} className="text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Chromecast Option */}
          {isCastAvailable && (
            <button
              onClick={handleChromecast}
              className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Cast className="w-5 h-5 text-blue-400" />
              <div className="text-left">
                <div className="text-sm font-medium">Chromecast</div>
                <div className="text-xs text-zinc-400">Google Cast devices</div>
              </div>
            </button>
          )}
          
          {/* Roku Option */}
          <button
            onClick={handleRoku}
            className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Tv className="w-5 h-5 text-purple-400" />
            <div className="text-left">
              <div className="text-sm font-medium">Roku</div>
              <div className="text-xs text-zinc-400">Cast via YouTube app</div>
            </div>
          </button>
          
          {/* Screen Mirroring Option */}
          <button
            onClick={handleScreenMirror}
            className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Monitor className="w-5 h-5 text-green-400" />
            <div className="text-left">
              <div className="text-sm font-medium">Screen Mirror</div>
              <div className="text-xs text-zinc-400">AirPlay, Miracast</div>
            </div>
          </button>
          
          {/* Open in YouTube */}
          <button
            onClick={() => {
              setShowMenu(false);
              window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ExternalLink className="w-5 h-5 text-red-400" />
            <div className="text-left">
              <div className="text-sm font-medium">Open in YouTube</div>
              <div className="text-xs text-zinc-400">Use YouTube's cast</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default CastButton;
