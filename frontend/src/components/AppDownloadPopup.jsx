import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tv, Download, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/TranslationContext";

/**
 * AppDownloadPopup - Shows a popup promoting ZTVLIVE app download
 * Appears after 1 minute (60 seconds) of user being on the site
 * Only shows once per session (stored in sessionStorage)
 */
export default function AppDownloadPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { t } = useTranslation();
  
  useEffect(() => {
    // Check if already dismissed this session
    const dismissed = sessionStorage.getItem('app_popup_dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }
    
    // Show popup after 60 seconds (1 minute)
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 60000);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem('app_popup_dismissed', 'true');
  };
  
  if (isDismissed) return null;
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.8 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
          data-testid="app-download-popup"
        >
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 text-zinc-400 hover:text-white transition-colors z-10"
              data-testid="popup-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-green-600 to-green-500 px-4 py-3">
              <span className="text-white font-bold text-sm tracking-wide">
                {t('free_download') || 'FREE DOWNLOAD'}
              </span>
            </div>
            
            {/* Content */}
            <div className="p-4">
              <h3 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
                {t('get_app_popup_title') || 'GET THE'} 
                <span className="text-green-400">ZTVLIVE</span> 
                {!t('get_app_popup_title') && 'APP'}
              </h3>
              <p className="text-zinc-400 text-sm mb-4">
                {t('get_app_popup_subtitle') || 'Watch on Roku, Fire TV, Samsung & LG Smart TVs'}
              </p>
              
              {/* Platform icons */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1 text-zinc-500">
                  <Tv className="w-4 h-4" />
                  <span className="text-xs">Roku</span>
                </div>
                <div className="flex items-center gap-1 text-zinc-500">
                  <Tv className="w-4 h-4" />
                  <span className="text-xs">Fire TV</span>
                </div>
                <div className="flex items-center gap-1 text-zinc-500">
                  <Smartphone className="w-4 h-4" />
                  <span className="text-xs">Mobile</span>
                </div>
              </div>
              
              {/* CTA Button - Links to App Download Page */}
              <Link to="/download" onClick={handleDismiss}>
                <Button
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                  data-testid="popup-download-btn"
                >
                  <Download className="w-5 h-5" />
                  {t('get_app_popup_cta') || 'Free Download'}
                </Button>
              </Link>
              
              {/* Skip link */}
              <button
                onClick={handleDismiss}
                className="w-full mt-2 text-zinc-500 hover:text-zinc-300 text-xs py-1 transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * AppDownloadBanner - A slim banner version for the header/navigation
 * Always visible as a button in the navigation
 */
export function AppDownloadButton({ className = "", variant = "default" }) {
  const { t } = useTranslation();
  
  if (variant === "nav") {
    return (
      <Link to="/download" data-testid="nav-download-btn">
        <Button
          size="sm"
          className={`bg-green-600 hover:bg-green-500 text-white font-semibold gap-1 ${className}`}
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">{t('download_app') || 'Download App'}</span>
        </Button>
      </Link>
    );
  }
  
  return (
    <Link to="/download" data-testid="download-app-btn">
      <Button
        className={`bg-green-600 hover:bg-green-500 text-white font-bold gap-2 ${className}`}
      >
        <Download className="w-5 h-5" />
        {t('download_app') || 'Download App'}
      </Button>
    </Link>
  );
}
