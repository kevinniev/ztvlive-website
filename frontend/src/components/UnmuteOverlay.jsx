import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

const UnmuteOverlay = ({ isMuted, onUnmute }) => {
  const [isVisible, setIsVisible] = useState(isMuted);

  useEffect(() => {
    setIsVisible(isMuted);
  }, [isMuted]);

  if (!isVisible) return null;

  return (
    <div 
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer transition-all hover:bg-black/40"
      onClick={() => {
        onUnmute();
        setIsVisible(false);
      }}
    >
      <div className="flex flex-col items-center gap-4 text-white animate-pulse">
        <div className="p-6 rounded-full bg-red-600 shadow-xl shadow-red-600/40">
          <VolumeX className="w-12 h-12" />
        </div>
        <p className="text-xl font-bold tracking-wider">TAP TO UNMUTE</p>
        <p className="text-sm text-zinc-300">Experience ZTVLIVE with full sound</p>
      </div>
    </div>
  );
};

export default UnmuteOverlay;