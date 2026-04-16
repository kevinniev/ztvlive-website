/**
 * NotifyMe Button Component
 * Allows users to follow creators and get push notifications
 */

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import useOneSignal from '../hooks/useOneSignal';

const NotifyMeButton = ({ 
  creatorId, 
  creatorName, 
  variant = 'default', 
  size = 'default',
  showText = true,
  className = ''
}) => {
  const { 
    isSupported, 
    isSubscribed, 
    followCreator, 
    unfollowCreator, 
    checkFollowing, 
    loading: sdkLoading 
  } = useOneSignal();
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [justFollowed, setJustFollowed] = useState(false);

  // Check initial following status
  useEffect(() => {
    const checkStatus = async () => {
      if (!sdkLoading && creatorId) {
        const following = await checkFollowing(creatorId);
        setIsFollowing(following);
        setLoading(false);
      }
    };
    checkStatus();
  }, [creatorId, sdkLoading, checkFollowing]);

  const handleClick = async () => {
    setActionLoading(true);
    
    try {
      if (isFollowing) {
        const result = await unfollowCreator(creatorId);
        if (result.success) {
          setIsFollowing(false);
        }
      } else {
        const result = await followCreator(creatorId, creatorName);
        if (result.success) {
          setIsFollowing(true);
          setJustFollowed(true);
          // Reset animation after 2 seconds
          setTimeout(() => setJustFollowed(false), 2000);
        } else if (result.error === 'notification_denied') {
          console.log('User denied notifications');
        }
      }
    } catch (error) {
      console.error('Notify me action error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Don't show if notifications not supported
  if (!isSupported && !sdkLoading) {
    return null;
  }

  // Loading state
  if (loading || sdkLoading) {
    return (
      <Button 
        variant={variant} 
        size={size} 
        disabled 
        className={className}
        data-testid="notify-me-loading"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {showText && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  return (
    <Button
      variant={isFollowing ? 'secondary' : variant}
      size={size}
      onClick={handleClick}
      disabled={actionLoading}
      className={`transition-all duration-300 ${justFollowed ? 'scale-105' : ''} ${className}`}
      data-testid={`notify-me-${creatorId}`}
    >
      {actionLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        justFollowed ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <BellRing className="h-4 w-4" />
        )
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {showText && (
        <span className="ml-2">
          {actionLoading 
            ? 'Processing...' 
            : isFollowing 
              ? (justFollowed ? 'Following!' : 'Notifications On')
              : 'Notify Me'
          }
        </span>
      )}
    </Button>
  );
};

export default NotifyMeButton;
