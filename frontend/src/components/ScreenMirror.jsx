import { useState, useCallback } from 'react';
import { Monitor, X, Smartphone, Laptop, Tv, Check } from 'lucide-react';

/**
 * Screen Mirror Component - Mirrors browser tab to Smart TV
 * Uses Presentation API when available, falls back to native sharing/instructions
 */

export function useScreenMirror() {
  const [isMirroring, setIsMirroring] = useState(false);
  const [presentationConnection, setPresentationConnection] = useState(null);

  // Check if Presentation API is available
  const isPresentationAvailable = typeof navigator !== 'undefined' && 
    'presentation' in navigator && 
    navigator.presentation;

  // Start screen mirroring using Presentation API
  const startMirror = useCallback(async () => {
    // Try Presentation API first (Chrome/Edge)
    if (isPresentationAvailable) {
      try {
        const presentationRequest = new PresentationRequest([window.location.href]);
        const connection = await presentationRequest.start();
        setPresentationConnection(connection);
        setIsMirroring(true);
        
        connection.onclose = () => {
          setIsMirroring(false);
          setPresentationConnection(null);
        };
        
        return { success: true, method: 'presentation' };
      } catch (e) {
        console.log('Presentation API failed:', e);
        // Fall through to alternatives
      }
    }

    // Try Web Share API for mobile (if supported)
    if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: 'ZTVLIVE - Watch on TV',
          text: 'Watch ZTVLIVE on your Smart TV',
          url: window.location.href
        });
        return { success: true, method: 'share' };
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.log('Share failed:', e);
        }
      }
    }

    // Return instructions for manual mirroring
    return { success: false, method: 'manual' };
  }, [isPresentationAvailable]);

  // Stop mirroring
  const stopMirror = useCallback(() => {
    if (presentationConnection) {
      try {
        presentationConnection.terminate();
      } catch (e) {}
      setPresentationConnection(null);
    }
    setIsMirroring(false);
  }, [presentationConnection]);

  return {
    isMirroring,
    startMirror,
    stopMirror,
    isPresentationAvailable
  };
}

/**
 * Screen Mirror Button Component
 */
export function ScreenMirrorButton({ 
  className = "",
  size = "md" 
}) {
  const [showInstructions, setShowInstructions] = useState(false);
  const { isMirroring, startMirror, stopMirror } = useScreenMirror();

  const handleMirrorClick = async () => {
    if (isMirroring) {
      stopMirror();
      return;
    }

    const result = await startMirror();
    
    if (!result.success || result.method === 'manual') {
      // Show instructions dialog
      setShowInstructions(true);
    }
  };

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  };

  const iconSizes = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };

  return (
    <>
      <button
        onClick={handleMirrorClick}
        className={`flex items-center justify-center rounded-full transition-all ${
          isMirroring 
            ? 'bg-green-600 text-white' 
            : 'bg-black/60 text-white hover:bg-black/80'
        } ${sizeClasses[size]} ${className}`}
        title={isMirroring ? 'Stop Screen Mirror' : 'Mirror to TV'}
        data-testid="screen-mirror-btn"
      >
        <Monitor className={iconSizes[size]} />
      </button>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4" onClick={() => setShowInstructions(false)}>
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Monitor className="w-6 h-6 text-green-400" />
                Mirror to TV
              </h3>
              <button 
                onClick={() => setShowInstructions(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-zinc-300 mb-4 text-sm">
              Mirror your screen to watch ZTVLIVE on your Smart TV while keeping the ZTVLIVE experience.
            </p>

            <div className="space-y-3">
              {/* Windows */}
              <div className="bg-zinc-800 rounded-lg p-3 flex items-start gap-3">
                <Laptop className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-white text-sm">Windows PC</div>
                  <div className="text-zinc-400 text-xs mt-1">
                    Press <kbd className="bg-zinc-700 px-1.5 py-0.5 rounded text-white">Win</kbd> + <kbd className="bg-zinc-700 px-1.5 py-0.5 rounded text-white">K</kbd> and select your TV
                  </div>
                </div>
                <Check className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />
              </div>

              {/* Mac */}
              <div className="bg-zinc-800 rounded-lg p-3 flex items-start gap-3">
                <Laptop className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-white text-sm">Mac</div>
                  <div className="text-zinc-400 text-xs mt-1">
                    Click AirPlay icon in menu bar → Select Apple TV or AirPlay TV
                  </div>
                </div>
                <Check className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />
              </div>

              {/* iPhone/iPad */}
              <div className="bg-zinc-800 rounded-lg p-3 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-pink-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-white text-sm">iPhone / iPad</div>
                  <div className="text-zinc-400 text-xs mt-1">
                    Control Center → Screen Mirroring → Select your TV
                  </div>
                </div>
                <Check className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />
              </div>

              {/* Android */}
              <div className="bg-zinc-800 rounded-lg p-3 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-white text-sm">Android</div>
                  <div className="text-zinc-400 text-xs mt-1">
                    Settings → Connected Devices → Cast → Select your TV
                  </div>
                </div>
                <Check className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />
              </div>

              {/* Smart TV Direct */}
              <div className="bg-zinc-800 rounded-lg p-3 flex items-start gap-3">
                <Tv className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-white text-sm">Smart TV Browser</div>
                  <div className="text-zinc-400 text-xs mt-1">
                    Open your TV's web browser and go to <span className="text-white font-mono">ztvlivestream.com</span>
                  </div>
                </div>
                <Check className="w-4 h-4 text-green-500 ml-auto flex-shrink-0" />
              </div>
            </div>

            <div className="mt-4 p-3 bg-green-900/30 border border-green-700/50 rounded-lg">
              <p className="text-green-300 text-xs">
                <strong>Tip:</strong> Make sure your device and TV are connected to the same WiFi network for mirroring to work.
              </p>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default ScreenMirrorButton;
