// API Configuration - Use relative paths for production compatibility
// This allows the frontend to work on any domain without hardcoded URLs

// For API calls, use relative path which will use the same domain
export const API = '/api';

// For WebSocket connections, we need to construct the URL based on current location
export const getWebSocketURL = () => {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

export const WS_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : '';

export default API;
