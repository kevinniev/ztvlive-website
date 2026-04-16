/**
 * OneSignal Push Notification Hook for ZTVLIVE
 * Handles push notification subscription and creator following
 */

import { useState, useEffect, useCallback } from 'react';

const API = '';

// Helper to safely access OneSignal
const getOneSignal = () => {
  return window.OneSignal;
};

export const useOneSignal = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(true);

  // Initialize and check subscription status
  useEffect(() => {
    const initOneSignal = async () => {
      try {
        // Wait for OneSignal to be ready
        const OneSignal = getOneSignal();
        if (!OneSignal) {
          console.log('OneSignal not loaded yet');
          setLoading(false);
          return;
        }

        // Check if push is supported
        const supported = await OneSignal.Notifications.isPushSupported();
        setIsSupported(supported);

        if (!supported) {
          console.log('Push notifications not supported');
          setLoading(false);
          return;
        }

        // Get current permission status
        const perm = await OneSignal.Notifications.permission;
        setPermission(perm ? 'granted' : 'default');

        // Check if already subscribed
        const subscribed = await OneSignal.User.PushSubscription.optedIn;
        setIsSubscribed(subscribed);

        // Get player ID if subscribed
        if (subscribed) {
          const id = await OneSignal.User.PushSubscription.id;
          setPlayerId(id);
          
          // Store in localStorage for offline access
          if (id) {
            localStorage.setItem('onesignal_player_id', id);
          }
        }

        // Listen for subscription changes
        OneSignal.User.PushSubscription.addEventListener('change', (event) => {
          setIsSubscribed(event.current.optedIn);
          if (event.current.id) {
            setPlayerId(event.current.id);
            localStorage.setItem('onesignal_player_id', event.current.id);
          }
        });

        setLoading(false);
      } catch (error) {
        console.error('OneSignal initialization error:', error);
        setLoading(false);
      }
    };

    // Wait for OneSignal SDK to load
    if (window.OneSignalDeferred) {
      window.OneSignalDeferred.push(initOneSignal);
    } else {
      setTimeout(initOneSignal, 1000);
    }
  }, []);

  // Request push notification permission
  const requestPermission = useCallback(async () => {
    try {
      const OneSignal = getOneSignal();
      if (!OneSignal) return false;

      // Show the native permission prompt
      await OneSignal.Slidedown.promptPush();
      
      // Check if permission was granted
      const subscribed = await OneSignal.User.PushSubscription.optedIn;
      setIsSubscribed(subscribed);

      if (subscribed) {
        const id = await OneSignal.User.PushSubscription.id;
        setPlayerId(id);
        localStorage.setItem('onesignal_player_id', id);

        // Register subscription with backend
        try {
          await fetch(`${API}/api/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player_id: id,
              user_id: localStorage.getItem('user_id'),
              device_type: 'web'
            })
          });
        } catch (e) {
          console.error('Failed to register subscription:', e);
        }
      }

      return subscribed;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }, []);

  // Follow a creator
  const followCreator = useCallback(async (creatorId, creatorName) => {
    let currentPlayerId = playerId || localStorage.getItem('onesignal_player_id');
    
    // If not subscribed, request permission first
    if (!currentPlayerId) {
      const granted = await requestPermission();
      if (!granted) {
        return { success: false, error: 'notification_denied' };
      }
      
      // Get the new player ID
      const OneSignal = getOneSignal();
      currentPlayerId = await OneSignal?.User?.PushSubscription?.id;
      
      if (!currentPlayerId) {
        return { success: false, error: 'no_player_id' };
      }
    }

    try {
      const response = await fetch(`${API}/api/push/follow-creator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: creatorId,
          creator_name: creatorName,
          player_id: currentPlayerId,
          user_id: localStorage.getItem('user_id')
        })
      });

      const data = await response.json();
      return { success: true, ...data };
    } catch (error) {
      console.error('Follow creator error:', error);
      return { success: false, error: error.message };
    }
  }, [playerId, requestPermission]);

  // Unfollow a creator
  const unfollowCreator = useCallback(async (creatorId) => {
    const currentPlayerId = playerId || localStorage.getItem('onesignal_player_id');
    
    if (!currentPlayerId) {
      return { success: false, error: 'not_subscribed' };
    }

    try {
      const response = await fetch(`${API}/api/push/unfollow-creator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: creatorId,
          player_id: currentPlayerId
        })
      });

      const data = await response.json();
      return { success: true, ...data };
    } catch (error) {
      console.error('Unfollow creator error:', error);
      return { success: false, error: error.message };
    }
  }, [playerId]);

  // Check if following a creator
  const checkFollowing = useCallback(async (creatorId) => {
    const currentPlayerId = playerId || localStorage.getItem('onesignal_player_id');
    
    if (!currentPlayerId) {
      return false;
    }

    try {
      const response = await fetch(
        `${API}/api/push/is-following/${creatorId}?player_id=${currentPlayerId}`
      );
      const data = await response.json();
      return data.is_following;
    } catch (error) {
      console.error('Check following error:', error);
      return false;
    }
  }, [playerId]);

  // Get list of creators being followed
  const getFollowing = useCallback(async () => {
    const currentPlayerId = playerId || localStorage.getItem('onesignal_player_id');
    
    if (!currentPlayerId) {
      return [];
    }

    try {
      const response = await fetch(
        `${API}/api/push/following?player_id=${currentPlayerId}`
      );
      const data = await response.json();
      return data.following || [];
    } catch (error) {
      console.error('Get following error:', error);
      return [];
    }
  }, [playerId]);

  return {
    isSupported,
    isSubscribed,
    playerId,
    permission,
    loading,
    requestPermission,
    followCreator,
    unfollowCreator,
    checkFollowing,
    getFollowing
  };
};

export default useOneSignal;
