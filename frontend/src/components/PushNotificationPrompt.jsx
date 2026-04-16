/**
 * Push Notification Prompt Component
 * Shows a prompt to enable push notifications for ZTVLIVE
 */

import React, { useState, useEffect } from 'react';
import { Bell, BellRing, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/button';
import useOneSignal from '../hooks/useOneSignal';

const PushNotificationPrompt = ({ showAfterSeconds = 10 }) => {
  const { 
    isSupported, 
    isSubscribed, 
    requestPermission, 
    loading 
  } = useOneSignal();
  
  const [show, setShow] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show on roku-tv broadcast page or broadcast-view
    if (window.location.pathname.includes('roku-tv') || 
        window.location.pathname.includes('roku-broadcast') ||
        window.location.pathname.includes('broadcast-view')) {
      return;
    }
    
    // Check if user has already dismissed this session
    const hasDissmissed = sessionStorage.getItem('push_prompt_dismissed');
    const hasSeenBefore = localStorage.getItem('push_prompt_seen');
    
    if (hasDissmissed || hasSeenBefore === 'true') {
      return;
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      if (isSupported && !isSubscribed && !loading) {
        setShow(true);
        localStorage.setItem('push_prompt_seen', 'true');
      }
    }, showAfterSeconds * 1000);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, loading, showAfterSeconds]);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const success = await requestPermission();
      if (success) {
        setShow(false);
      }
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem('push_prompt_dismissed', 'true');
  };

  // Don't show if not supported, already subscribed, or dismissed
  if (!isSupported || isSubscribed || dismissed || loading) {
    return null;
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm w-full mx-4 sm:mx-0"
          data-testid="push-notification-prompt"
        >
          <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
            {/* Header gradient */}
            <div className="h-1 bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500" />
            
            <div className="p-4">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-zinc-700 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>

              {/* Content */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
                    <Bell className="w-6 h-6 text-red-500" />
                  </div>
                </div>
                
                <div className="flex-1 pr-6">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    Never Miss a Moment
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Get notified when your favorite creators go live on ZTVLIVE!
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleEnable}
                  disabled={requesting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  data-testid="enable-notifications-btn"
                >
                  {requesting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <BellRing className="w-4 h-4 mr-2" />
                      Enable Notifications
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDismiss}
                  className="text-gray-400 hover:text-white"
                >
                  Later
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PushNotificationPrompt;
