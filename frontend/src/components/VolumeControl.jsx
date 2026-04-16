import { useState, useCallback, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Volume1 } from 'lucide-react';

/**
 * YouTubeStyleVolumeControl - Volume control that works like YouTube/Facebook
 * - Click speaker icon to mute/unmute
 * - Hover to show slider (desktop)
 * - Tap to show slider (mobile)
 * - Drag slider to adjust volume
 * - Slider auto-hides after interaction
 */
export default function VolumeControl({
  volume = 0.7,
  isMuted = false,
  onVolumeChange,
  onMuteToggle,
  size = 'md',
  className = '',
  showLabel = false,
}) {
  const [showSlider, setShowSlider] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const hideTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  // Determine which volume icon to show
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  // Size classes
  const sizeClasses = {
    sm: { button: 'w-8 h-8', icon: 'w-4 h-4', slider: 'w-16 h-1' },
    md: { button: 'w-10 h-10', icon: 'w-5 h-5', slider: 'w-20 h-1.5' },
    lg: { button: 'w-12 h-12', icon: 'w-6 h-6', slider: 'w-24 h-2' },
  };

  const sizes = sizeClasses[size] || sizeClasses.md;

  // Show slider and set auto-hide timer
  const showVolumeSlider = useCallback(() => {
    clearTimeout(hideTimeoutRef.current);
    setShowSlider(true);
  }, []);

  // Hide slider after delay
  const hideVolumeSlider = useCallback(() => {
    if (isDragging) return;
    hideTimeoutRef.current = setTimeout(() => {
      setShowSlider(false);
    }, 1500);
  }, [isDragging]);

  // Handle volume change from slider
  const handleVolumeChange = useCallback((e) => {
    e.stopPropagation();
    const newVolume = parseFloat(e.target.value);
    onVolumeChange?.(newVolume);
    
    // If changing volume from 0, unmute
    if (newVolume > 0 && isMuted) {
      onMuteToggle?.();
    }
    
    // Reset hide timer
    clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setShowSlider(false);
    }, 2000);
  }, [onVolumeChange, onMuteToggle, isMuted]);

  // Handle mute toggle
  const handleMuteToggle = useCallback((e) => {
    e.stopPropagation();
    onMuteToggle?.();
    
    // Show slider briefly after unmuting
    if (isMuted) {
      showVolumeSlider();
      hideTimeoutRef.current = setTimeout(() => {
        setShowSlider(false);
      }, 2000);
    }
  }, [onMuteToggle, isMuted, showVolumeSlider]);

  // Handle touch start on mobile
  const handleTouchStart = useCallback((e) => {
    e.stopPropagation();
    showVolumeSlider();
  }, [showVolumeSlider]);

  // Track dragging state
  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    clearTimeout(hideTimeoutRef.current);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    hideTimeoutRef.current = setTimeout(() => {
      setShowSlider(false);
    }, 1500);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Calculate slider fill percentage
  const fillPercent = isMuted ? 0 : volume * 100;

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center ${className}`}
      onMouseEnter={showVolumeSlider}
      onMouseLeave={hideVolumeSlider}
      onTouchStart={handleTouchStart}
    >
      {/* Mute/Unmute Button */}
      <button
        onClick={handleMuteToggle}
        className={`${sizes.button} flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-all active:scale-95`}
        data-testid="volume-btn"
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        <VolumeIcon className={sizes.icon} />
      </button>

      {/* Volume Slider Container */}
      <div
        className={`flex items-center overflow-hidden transition-all duration-300 ease-out ${
          showSlider ? 'ml-2 opacity-100' : 'ml-0 w-0 opacity-0'
        }`}
        style={{ width: showSlider ? '80px' : '0px' }}
      >
        {/* Slider Track */}
        <div className="relative w-full">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            onMouseDown={handleDragStart}
            onMouseUp={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className={`w-full ${sizes.slider} appearance-none bg-transparent cursor-pointer relative z-10`}
            style={{
              background: `linear-gradient(to right, white ${fillPercent}%, rgba(255,255,255,0.3) ${fillPercent}%)`,
              borderRadius: '4px',
            }}
            data-testid="volume-slider"
          />
          
          {/* Custom slider thumb styles */}
          <style>{`
            input[data-testid="volume-slider"]::-webkit-slider-thumb {
              appearance: none;
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: white;
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              transition: transform 0.1s;
            }
            input[data-testid="volume-slider"]::-webkit-slider-thumb:hover {
              transform: scale(1.2);
            }
            input[data-testid="volume-slider"]::-webkit-slider-thumb:active {
              transform: scale(1.1);
            }
            input[data-testid="volume-slider"]::-moz-range-thumb {
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: white;
              cursor: pointer;
              border: none;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
          `}</style>
        </div>
      </div>

      {/* Volume percentage label (optional) */}
      {showLabel && showSlider && (
        <span className="ml-2 text-xs text-white/80 min-w-[30px]">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      )}
    </div>
  );
}

/**
 * Simple mute button for minimal UI
 */
export function MuteButton({ isMuted, onToggle, size = 'md', className = '' }) {
  const VolumeIcon = isMuted ? VolumeX : Volume2;
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
      className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white transition-all active:scale-95 ${className}`}
      data-testid="mute-btn"
      aria-label={isMuted ? 'Unmute' : 'Mute'}
    >
      <VolumeIcon className={iconSizes[size]} />
    </button>
  );
}
