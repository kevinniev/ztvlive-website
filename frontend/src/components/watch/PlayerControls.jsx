/**
 * PlayerControls Component for ZTVLIVE Watch Page
 * 
 * Custom video playback controls with:
 * - Play/Pause
 * - Volume control with slider
 * - Progress bar with live position
 * - Skip forward/backward
 * - Fullscreen toggle
 */

import { useState, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Play, Pause, SkipForward, Rewind, FastForward,
  Volume2, VolumeX, Volume1, Maximize, Minimize,
  Radio, Subtitles
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PlayerControls = memo(({
  isPlaying,
  isMuted,
  volume,
  progress,
  duration,
  isLive,
  behindLive,
  isFullscreen,
  onPlayPause,
  onMuteToggle,
  onVolumeChange,
  onSeek,
  onSkipForward,
  onSkipBack,
  onGoLive,
  onFullscreenToggle,
  onCaptionsToggle,
  showCaptions,
  hidden = false,
}) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const volumeSliderRef = useRef(null);
  const progressBarRef = useRef(null);

  // Format time for display
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click
  const handleProgressClick = useCallback((e) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * duration;
    onSeek?.(newTime);
  }, [duration, onSeek]);

  // Handle volume slider
  const handleVolumeClick = useCallback((e) => {
    if (!volumeSliderRef.current) return;
    const rect = volumeSliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newVolume = Math.max(0, Math.min(1, x / rect.width));
    onVolumeChange?.(newVolume);
  }, [onVolumeChange]);

  // Get volume icon based on level
  const VolumeIcon = isMuted || volume === 0 
    ? VolumeX 
    : volume < 0.5 
      ? Volume1 
      : Volume2;

  if (hidden) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20">
      {/* Progress Bar */}
      <div 
        ref={progressBarRef}
        onClick={handleProgressClick}
        className="relative h-1 bg-zinc-700/50 cursor-pointer group hover:h-2 transition-all"
      >
        {/* Live position (red) */}
        <div 
          className="absolute inset-y-0 left-0 bg-red-600"
          style={{ width: `${isLive ? 100 : Math.min(100, progress + behindLive)}%` }}
        />
        
        {/* Current position (white) */}
        <div 
          className="absolute inset-y-0 left-0 bg-white"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
        
        {/* Hover preview dot */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${Math.min(100, progress)}%`, transform: 'translateX(-50%) translateY(-50%)' }}
        />
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <Button
            size="icon"
            variant="ghost"
            onClick={onPlayPause}
            className="text-white hover:bg-white/10"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </Button>

          {/* Rewind/Forward */}
          <Button
            size="icon"
            variant="ghost"
            onClick={onSkipBack}
            className="text-white hover:bg-white/10"
          >
            <Rewind className="w-4 h-4" />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            onClick={onSkipForward}
            className="text-white hover:bg-white/10"
          >
            <FastForward className="w-4 h-4" />
          </Button>

          {/* Volume Control */}
          <div 
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => !isDraggingVolume && setShowVolumeSlider(false)}
          >
            <Button
              size="icon"
              variant="ghost"
              onClick={onMuteToggle}
              className="text-white hover:bg-white/10"
            >
              <VolumeIcon className="w-5 h-5" />
            </Button>
            
            {/* Volume Slider */}
            <AnimatePresence>
              {showVolumeSlider && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 80, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="ml-2 overflow-hidden"
                >
                  <div 
                    ref={volumeSliderRef}
                    onClick={handleVolumeClick}
                    onMouseDown={() => setIsDraggingVolume(true)}
                    onMouseUp={() => setIsDraggingVolume(false)}
                    className="h-1 bg-zinc-600 rounded-full cursor-pointer relative"
                    style={{ width: 80 }}
                  >
                    <div 
                      className="absolute inset-y-0 left-0 bg-white rounded-full"
                      style={{ width: `${volume * 100}%` }}
                    />
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
                      style={{ left: `${volume * 100}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Time Display */}
          <span className="text-white text-xs ml-2 tabular-nums">
            {formatTime(progress * duration / 100)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Go Live button when behind */}
          {!isLive && behindLive > 5 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onGoLive}
              className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white text-xs"
            >
              <Radio className="w-3 h-3 mr-1" />
              Go Live
            </Button>
          )}

          {/* Closed Captions */}
          {onCaptionsToggle && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onCaptionsToggle}
              className={`text-white hover:bg-white/10 ${showCaptions ? 'bg-white/20' : ''}`}
            >
              <Subtitles className="w-5 h-5" />
            </Button>
          )}

          {/* Fullscreen */}
          <Button
            size="icon"
            variant="ghost"
            onClick={onFullscreenToggle}
            className="text-white hover:bg-white/10"
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5" />
            ) : (
              <Maximize className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});

PlayerControls.displayName = 'PlayerControls';

export default PlayerControls;
