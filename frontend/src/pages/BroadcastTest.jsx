import { useEffect, useRef } from "react";

/**
 * TEST BROADCAST PAGE - Uses a guaranteed embeddable video
 * Route: /broadcast-test
 */
export default function BroadcastTest() {
  const playerRef = useRef(null);

  useEffect(() => {
    // Load YouTube API
    if (window.YT && window.YT.Player) {
      initPlayer();
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = initPlayer;
  }, []);

  const initPlayer = () => {
    const container = document.getElementById('test-player');
    if (!container) {
      setTimeout(initPlayer, 200);
      return;
    }

    playerRef.current = new window.YT.Player('test-player', {
      // Rick Astley - Never Gonna Give You Up (always embeddable)
      videoId: 'dQw4w9WgXcQ',
      playerVars: {
        autoplay: 1,
        mute: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        showinfo: 0,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 0,
        playsinline: 1,
        loop: 1,
        playlist: 'dQw4w9WgXcQ',
      },
      events: {
        onReady: (e) => {
          e.target.setVolume(50);
          e.target.playVideo();
        },
      }
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#000',
      overflow: 'hidden',
    }}>
      <div 
        id="test-player"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
