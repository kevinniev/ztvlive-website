import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Download, 
  Tv, 
  Smartphone, 
  Monitor, 
  Tablet,
  Chrome,
  Apple,
  Play,
  ExternalLink,
  Check,
  Zap,
  Clock,
  RefreshCw,
  Wifi,
  AlertCircle,
  X,
  ArrowRight,
  Menu as MenuIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/contexts/TranslationContext";
import Navigation from "@/components/Navigation";

// Device detection utility
const detectDevice = () => {
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  
  // Check for TV platforms
  if (ua.includes('roku') || ua.includes('rokulike')) return 'roku';
  if (ua.includes('tizen')) return 'samsung_tv';
  if (ua.includes('webos') || ua.includes('web0s')) return 'lg_tv';
  if (ua.includes('firetv') || ua.includes('silk')) return 'fire_tv';
  if (ua.includes('android') && ua.includes('tv')) return 'android_tv';
  if (ua.includes('appletv')) return 'apple_tv';
  
  // Check for mobile devices
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (ua.includes('android')) {
    if (ua.includes('tablet') || (window.innerWidth > 600 && window.innerHeight > 600)) {
      return 'android_tablet';
    }
    return 'android';
  }
  
  // Check for desktop
  if (platform.includes('mac')) return 'mac';
  if (platform.includes('win')) return 'windows';
  if (platform.includes('linux')) return 'linux';
  
  return 'unknown';
};

// Check if PWA is installable
const checkPWAInstallable = () => {
  return 'BeforeInstallPromptEvent' in window || 
         window.matchMedia('(display-mode: standalone)').matches ||
         navigator.standalone;
};

// Check if already installed as PWA
const isPWAInstalled = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         navigator.standalone ||
         document.referrer.includes('android-app://');
};

// Browser detection for install instructions
const detectBrowser = () => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('chrome') && !ua.includes('edg/')) return 'chrome';
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  if (ua.includes('opera') || ua.includes('opr/')) return 'opera';
  return 'unknown';
};

export default function AppDownloadPage() {
  const { t } = useTranslation();
  const [deviceType, setDeviceType] = useState('unknown');
  const [browserType, setBrowserType] = useState('unknown');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installError, setInstallError] = useState(null);
  
  useEffect(() => {
    setDeviceType(detectDevice());
    setBrowserType(detectBrowser());
    setIsInstalled(isPWAInstalled());
    
    // Listen for PWA install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallModal(false);
    });
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);
  
  const handlePWAInstall = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        setShowInstallModal(true);
        console.error('PWA install error:', err);
      }
    } else {
      // Show manual install instructions modal
      setShowInstallModal(true);
    }
  };
  
  // Get browser-specific install instructions
  const getInstallInstructions = () => {
    const device = deviceType;
    const browser = browserType;
    
    if (device === 'ios') {
      return {
        title: 'Install on iPhone/iPad',
        steps: [
          'Tap the Share button (box with arrow) at the bottom of Safari',
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" in the top right corner',
          'ZTVLIVE icon will appear on your home screen!'
        ],
        note: 'Make sure you\'re using Safari browser',
        icon: '📱'
      };
    }
    
    if (device === 'android' || device === 'android_tablet') {
      return {
        title: 'Install on Android',
        steps: [
          'Tap the menu button (⋮) in Chrome',
          'Tap "Install app" or "Add to Home screen"',
          'Tap "Install" to confirm',
          'Find ZTVLIVE on your home screen!'
        ],
        note: 'Works best in Chrome browser',
        icon: '📱'
      };
    }
    
    if (device === 'windows') {
      if (browser === 'chrome') {
        return {
          title: 'Install on Windows (Chrome)',
          steps: [
            'Look for the install icon (⊕) in the address bar (right side)',
            'Click the install icon',
            'Click "Install" in the popup',
            'ZTVLIVE will open as a desktop app!'
          ],
          note: 'If you don\'t see the icon, click the menu (⋮) → "Install ZTVLIVE..."',
          icon: '💻'
        };
      }
      if (browser === 'edge') {
        return {
          title: 'Install on Windows (Edge)',
          steps: [
            'Look for the install icon (⊕) in the address bar (right side)',
            'Or click the menu (⋯) → Apps → Install ZTVLIVE',
            'Click "Install" to confirm',
            'ZTVLIVE will be added to your Start menu!'
          ],
          note: 'Edge provides the best PWA experience on Windows',
          icon: '💻'
        };
      }
      return {
        title: 'Install on Windows',
        steps: [
          'Open this page in Chrome or Edge browser',
          'Look for the install icon in the address bar',
          'Click "Install" to add ZTVLIVE to your desktop',
          'The app will open in its own window!'
        ],
        note: 'Chrome or Edge required for installation',
        icon: '💻'
      };
    }
    
    if (device === 'mac') {
      if (browser === 'safari') {
        return {
          title: 'Install on Mac (Safari)',
          steps: [
            'Click File in the menu bar',
            'Select "Add to Dock..."',
            'Click "Add" to confirm',
            'Find ZTVLIVE in your Dock!'
          ],
          note: 'Requires macOS Sonoma or later',
          icon: '🍎'
        };
      }
      return {
        title: 'Install on Mac (Chrome)',
        steps: [
          'Look for the install icon (⊕) in the address bar',
          'Or click the menu (⋮) → "Install ZTVLIVE..."',
          'Click "Install" to confirm',
          'ZTVLIVE will be added to your Applications!'
        ],
        note: 'Also works in Safari on macOS Sonoma+',
        icon: '🍎'
      };
    }
    
    return {
      title: 'Install ZTVLIVE App',
      steps: [
        'Look for the install icon in your browser\'s address bar',
        'Or open browser menu and look for "Install" option',
        'Click to install ZTVLIVE',
        'The app will be added to your device!'
      ],
      note: 'Works best in Chrome, Edge, or Safari',
      icon: '📲'
    };
  };

  // Platform-specific download data
  const platforms = {
    smart_tv: [
      {
        id: 'roku',
        name: 'Roku',
        icon: Tv,
        color: 'from-purple-600 to-indigo-700',
        status: 'available',
        downloadUrl: 'https://channelstore.roku.com/search/ztvlive',
        instructions: 'Search "ZTVLIVE" in the Roku Channel Store',
        features: ['Auto-updates', '4K Support', 'Voice Control']
      },
      {
        id: 'fire_tv',
        name: 'Amazon Fire TV',
        icon: Tv,
        color: 'from-orange-500 to-red-600',
        status: 'available',
        downloadUrl: 'https://www.amazon.com/dp/B0ZTVLIVE',
        instructions: 'Search "ZTVLIVE" on your Fire TV or use the Amazon Appstore',
        features: ['Auto-updates', 'Alexa Compatible', 'HDR Support']
      },
      {
        id: 'samsung_tv',
        name: 'Samsung Smart TV',
        icon: Tv,
        color: 'from-blue-500 to-blue-700',
        status: 'coming_soon',
        downloadUrl: null,
        instructions: 'Tizen app coming soon! Use TV browser: ztvlivestream.com/watch',
        features: ['Native App Q2 2026', 'Web App Available Now']
      },
      {
        id: 'lg_tv',
        name: 'LG Smart TV',
        icon: Tv,
        color: 'from-pink-500 to-red-600',
        status: 'coming_soon',
        downloadUrl: null,
        instructions: 'webOS app coming soon! Use TV browser: ztvlivestream.com/watch',
        features: ['Native App Q2 2026', 'Web App Available Now']
      },
      {
        id: 'android_tv',
        name: 'Android TV / Google TV',
        icon: Tv,
        color: 'from-green-500 to-teal-600',
        status: 'available',
        downloadUrl: 'https://play.google.com/store/apps/details?id=com.ztvlive.tv',
        instructions: 'Download from Google Play on your TV',
        features: ['Auto-updates', 'Chromecast Built-in', 'Google Assistant']
      },
      {
        id: 'apple_tv',
        name: 'Apple TV',
        icon: Apple,
        color: 'from-gray-700 to-gray-900',
        status: 'coming_soon',
        downloadUrl: null,
        instructions: 'tvOS app coming Q3 2026. Use AirPlay from iPhone/iPad now!',
        features: ['AirPlay Supported', 'Native App Coming']
      }
    ],
    mobile: [
      {
        id: 'ios',
        name: 'iPhone & iPad',
        icon: Apple,
        color: 'from-gray-800 to-black',
        status: 'pwa',
        downloadUrl: null,
        instructions: 'Tap Share → "Add to Home Screen" in Safari',
        features: ['Works offline', 'Push notifications', 'Auto-updates']
      },
      {
        id: 'android',
        name: 'Android Phone & Tablet',
        icon: Smartphone,
        color: 'from-green-500 to-green-700',
        status: 'pwa',
        downloadUrl: 'https://play.google.com/store/apps/details?id=com.ztvlive.app',
        instructions: 'Install from Play Store or tap "Install App" in Chrome',
        features: ['Background play', 'Push notifications', 'Auto-updates']
      }
    ],
    desktop: [
      {
        id: 'windows',
        name: 'Windows PC',
        icon: Monitor,
        color: 'from-blue-500 to-blue-700',
        status: 'pwa',
        downloadUrl: null,
        instructions: 'Click "Install" in the browser address bar (Chrome/Edge)',
        features: ['Desktop shortcuts', 'Windowed mode', 'System tray']
      },
      {
        id: 'mac',
        name: 'Mac',
        icon: Apple,
        color: 'from-gray-600 to-gray-800',
        status: 'pwa',
        downloadUrl: null,
        instructions: 'Click the install icon in Safari/Chrome address bar',
        features: ['Dock icon', 'Full-screen mode', 'Touch Bar support']
      },
      {
        id: 'chromebook',
        name: 'Chromebook',
        icon: Chrome,
        color: 'from-yellow-500 to-red-500',
        status: 'pwa',
        downloadUrl: null,
        instructions: 'Click the install icon in Chrome address bar',
        features: ['Works offline', 'Auto-updates', 'System integration']
      }
    ]
  };
  
  // Get recommended platform based on device
  const getRecommendedPlatform = () => {
    switch (deviceType) {
      case 'ios':
        return platforms.mobile.find(p => p.id === 'ios');
      case 'android':
      case 'android_tablet':
        return platforms.mobile.find(p => p.id === 'android');
      case 'mac':
        return platforms.desktop.find(p => p.id === 'mac');
      case 'windows':
        return platforms.desktop.find(p => p.id === 'windows');
      case 'roku':
        return platforms.smart_tv.find(p => p.id === 'roku');
      case 'fire_tv':
        return platforms.smart_tv.find(p => p.id === 'fire_tv');
      case 'samsung_tv':
        return platforms.smart_tv.find(p => p.id === 'samsung_tv');
      case 'lg_tv':
        return platforms.smart_tv.find(p => p.id === 'lg_tv');
      case 'android_tv':
        return platforms.smart_tv.find(p => p.id === 'android_tv');
      default:
        return platforms.desktop.find(p => p.id === 'windows');
    }
  };
  
  const recommended = getRecommendedPlatform();
  
  const renderPlatformCard = (platform, isRecommended = false) => {
    const Icon = platform.icon;
    const isComingSoon = platform.status === 'coming_soon';
    const isPWA = platform.status === 'pwa';
    
    return (
      <motion.div
        key={platform.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card 
          className={`bg-zinc-800/50 border-zinc-700 overflow-hidden relative ${isRecommended ? 'ring-2 ring-green-500' : ''}`}
          data-testid={`platform-card-${platform.id}`}
        >
          {isRecommended && (
            <div className="absolute top-2 right-2 z-10">
              <Badge className="bg-green-600 text-white">
                <Zap className="w-3 h-3 mr-1" />
                Recommended
              </Badge>
            </div>
          )}
          
          <div className={`h-20 bg-gradient-to-r ${platform.color} flex items-center justify-center`}>
            <Icon className="w-10 h-10 text-white" />
          </div>
          
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              {platform.name}
              {isComingSoon && (
                <Badge variant="outline" className="text-yellow-400 border-yellow-400/50 text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  Coming Soon
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-zinc-400 text-sm">
              {platform.instructions}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-3">
            {/* Features */}
            <div className="flex flex-wrap gap-1">
              {platform.features.map((feature, idx) => (
                <Badge key={idx} variant="secondary" className="bg-zinc-700 text-zinc-300 text-xs">
                  <Check className="w-3 h-3 mr-1 text-green-400" />
                  {feature}
                </Badge>
              ))}
            </div>
            
            {/* Action Button */}
            {isComingSoon ? (
              <Button 
                disabled
                className="w-full bg-zinc-700 text-zinc-400 cursor-not-allowed"
              >
                <Clock className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            ) : isPWA ? (
              <Button 
                onClick={handlePWAInstall}
                disabled={isInstalled}
                className={`w-full ${isInstalled ? 'bg-zinc-700 text-zinc-400' : isRecommended ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'} text-white`}
                data-testid={`install-pwa-${platform.id}`}
              >
                {isInstalled ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Already Installed
                  </>
                ) : deferredPrompt ? (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Install App
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Install App
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={() => window.open(platform.downloadUrl, '_blank')}
                className={`w-full ${isRecommended ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'} text-white`}
                data-testid={`download-${platform.id}`}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Get App
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-900 to-black text-white">
      <Navigation />
      
      {/* Install Instructions Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowInstallModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getInstallInstructions().icon}</span>
                  <h2 className="text-white font-bold text-lg">{getInstallInstructions().title}</h2>
                </div>
                <button 
                  onClick={() => setShowInstallModal(false)} 
                  className="text-white/80 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="p-5 space-y-4">
                {/* Visual Browser Mockup */}
                {(deviceType === 'windows' || deviceType === 'mac') && (
                  <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                    <p className="text-zinc-400 text-xs mb-2 text-center">Look for this in your browser:</p>
                    {/* Browser address bar mockup */}
                    <div className="bg-zinc-700 rounded-lg p-2 flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/50" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                        <div className="w-3 h-3 rounded-full bg-green-500/50" />
                      </div>
                      <div className="flex-1 bg-zinc-600 rounded px-3 py-1 flex items-center justify-between">
                        <span className="text-zinc-400 text-xs">ztvlivestream.com</span>
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="w-6 h-6 bg-green-500 rounded flex items-center justify-center cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-white" />
                        </motion.div>
                      </div>
                      <div className="w-6 h-6 bg-zinc-600 rounded flex items-center justify-center">
                        <MenuIcon className="w-4 h-4 text-zinc-400" />
                      </div>
                    </div>
                    <p className="text-green-400 text-xs mt-2 text-center flex items-center justify-center gap-1">
                      <ArrowRight className="w-3 h-3" /> Click the green download icon!
                    </p>
                  </div>
                )}
                
                {/* iOS Safari visual */}
                {deviceType === 'ios' && (
                  <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                    <p className="text-zinc-400 text-xs mb-2 text-center">In Safari, tap Share:</p>
                    <div className="flex justify-center gap-4 py-3">
                      <motion.div 
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center"
                      >
                        <ExternalLink className="w-6 h-6 text-white" />
                      </motion.div>
                      <div className="flex flex-col items-center">
                        <ArrowRight className="w-6 h-6 text-green-400" />
                        <span className="text-green-400 text-xs mt-1">Then "Add to Home Screen"</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Android Chrome visual */}
                {(deviceType === 'android' || deviceType === 'android_tablet') && (
                  <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                    <p className="text-zinc-400 text-xs mb-2 text-center">In Chrome, tap the menu:</p>
                    <div className="flex justify-center items-center gap-4 py-3">
                      <motion.div 
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-10 h-10 bg-zinc-700 rounded flex items-center justify-center"
                      >
                        <span className="text-white font-bold text-lg">⋮</span>
                      </motion.div>
                      <ArrowRight className="w-6 h-6 text-green-400" />
                      <div className="bg-zinc-700 rounded-lg px-3 py-2">
                        <span className="text-green-400 text-sm">Install app</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Step by step instructions */}
                <ol className="space-y-3">
                  {getInstallInstructions().steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-sm flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-zinc-300 text-sm pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
                
                <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                  <p className="text-zinc-400 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    {getInstallInstructions().note}
                  </p>
                </div>
                
                {/* Alternative: Play Store / App Store links where applicable */}
                {(deviceType === 'android' || deviceType === 'android_tablet') && (
                  <div className="pt-2 border-t border-zinc-700">
                    <p className="text-zinc-500 text-xs text-center mb-2">Or get from Play Store:</p>
                    <Button
                      onClick={() => window.open('https://play.google.com/store/apps/details?id=com.ztvlive.app', '_blank')}
                      variant="outline"
                      className="w-full border-green-600/50 text-green-400 hover:bg-green-600/20"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Open Play Store
                    </Button>
                  </div>
                )}
                
                <Button
                  onClick={() => setShowInstallModal(false)}
                  className="w-full bg-green-600 hover:bg-green-500 text-white"
                >
                  Got it!
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Hero Section */}
      <div className="pt-20 pb-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Download <span className="text-green-400">ZTVLIVE</span>
            </h1>
            <p className="text-zinc-400 text-lg mb-6">
              Watch 24/7 live streaming on any device - TV, mobile, tablet, or desktop
            </p>
            
            {/* Key Features */}
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <div className="flex items-center gap-2 text-zinc-300">
                <RefreshCw className="w-5 h-5 text-green-400" />
                <span>Auto-Updates</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Wifi className="w-5 h-5 text-blue-400" />
                <span>24/7 Live</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span>No Buffering</span>
              </div>
            </div>
          </motion.div>
          
          {/* Already Installed Badge */}
          {isInstalled && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-2 bg-green-600/20 border border-green-500/30 text-green-400 px-4 py-2 rounded-full mb-6"
            >
              <Check className="w-5 h-5" />
              ZTVLIVE is already installed on this device!
            </motion.div>
          )}
        </div>
      </div>

      {/* Recommended Section */}
      {recommended && !isInstalled && (
        <div className="max-w-4xl mx-auto px-4 mb-10">
          <h2 className="text-xl font-semibold mb-4 text-center text-zinc-300">
            <Zap className="w-5 h-5 inline mr-2 text-green-400" />
            Best for Your Device
          </h2>
          <div className="max-w-md mx-auto">
            {renderPlatformCard(recommended, true)}
          </div>
        </div>
      )}

      {/* Smart TV Section */}
      <div className="max-w-6xl mx-auto px-4 pb-10">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Tv className="w-6 h-6 text-purple-400" />
          Smart TVs & Streaming Devices
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {platforms.smart_tv.map(platform => renderPlatformCard(platform))}
        </div>
      </div>

      {/* Mobile Section */}
      <div className="max-w-6xl mx-auto px-4 pb-10">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-green-400" />
          Mobile & Tablet
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {platforms.mobile.map(platform => renderPlatformCard(platform))}
        </div>
      </div>

      {/* Desktop Section */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Monitor className="w-6 h-6 text-blue-400" />
          Desktop & Laptop
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {platforms.desktop.map(platform => renderPlatformCard(platform))}
        </div>
      </div>

      {/* PWA Install Instructions */}
      <div className="max-w-4xl mx-auto px-4 pb-20">
        <Card className="bg-zinc-800/30 border-zinc-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-green-400" />
              How to Install the Web App
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-white">Chrome / Edge</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Click the install icon in address bar</li>
                  <li>Or click menu (⋮) → "Install app"</li>
                  <li>Confirm installation</li>
                </ol>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-white">Safari (iOS)</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Tap the Share button</li>
                  <li>Scroll and tap "Add to Home Screen"</li>
                  <li>Tap "Add" to confirm</li>
                </ol>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-white">Firefox</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Click menu (☰)</li>
                  <li>Select "Install this site as an app"</li>
                  <li>Confirm installation</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
