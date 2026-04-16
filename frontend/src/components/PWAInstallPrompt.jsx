import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Don't show on broadcast pages
    if (window.location.pathname.includes('roku-tv') || 
        window.location.pathname.includes('roku-broadcast') ||
        window.location.pathname.includes('broadcast-view')) {
      return;
    }
    
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if dismissed recently
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 3000); // Show after 3 seconds
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // For iOS, show prompt after delay if not installed
    if (iOS && !standalone) {
      setTimeout(() => setShowPrompt(true), 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading text-lg text-white tracking-wider">Install ZTV LIVE</h3>
              <p className="text-zinc-400 text-sm mt-1">
                {isIOS 
                  ? 'Tap the share button and "Add to Home Screen" for the best experience.'
                  : 'Install our app for quick access and offline viewing.'}
              </p>
            </div>
            <button 
              onClick={handleDismiss}
              className="text-zinc-500 hover:text-white transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isIOS ? (
            <div className="mt-4 p-3 bg-zinc-800 rounded-lg">
              <p className="text-sm text-zinc-300">
                <span className="font-medium">How to install:</span>
              </p>
              <ol className="mt-2 text-sm text-zinc-400 space-y-1">
                <li>1. Tap the <span className="text-white">Share</span> button in Safari</li>
                <li>2. Scroll down and tap <span className="text-white">Add to Home Screen</span></li>
                <li>3. Tap <span className="text-white">Add</span> to confirm</li>
              </ol>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <Button 
                onClick={handleInstall}
                className="flex-1 bg-red-600 hover:bg-red-500 font-heading tracking-wider"
              >
                <Download className="w-4 h-4 mr-2" />
                INSTALL APP
              </Button>
              <Button 
                onClick={handleDismiss}
                variant="outline"
                className="border-zinc-700 hover:bg-zinc-800"
              >
                Not Now
              </Button>
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-zinc-800/50 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 text-center">
            Works offline • No app store needed • Free
          </p>
        </div>
      </div>
    </div>
  );
}
