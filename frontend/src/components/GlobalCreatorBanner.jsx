import React, { useState, useEffect } from "react";
import CreatorLiveBanner from "./CreatorLiveBanner";
import axios from "axios";

const API = '/api';

/**
 * GlobalCreatorBanner - Wrapper component that shows CreatorLiveBanner
 * for logged-in creators with upcoming or live content.
 * Automatically hides when user is not logged in or has no upcoming content.
 */
const GlobalCreatorBanner = () => {
  const [user, setUser] = useState(null);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const checkUser = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setUser(null);
          return;
        }
        
        const response = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data && response.data.user_id) {
          setUser(response.data);
        } else {
          setUser(null);
        }
      } catch (error) {
        setUser(null);
      }
    };
    
    checkUser();
    
    // Re-check when localStorage changes (login/logout)
    const handleStorageChange = () => {
      checkUser();
    };
    
    window.addEventListener("storage", handleStorageChange);
    
    // Also check periodically in case of session changes
    const interval = setInterval(checkUser, 60000);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Only show if user is logged in
  if (!user || !showBanner) return null;

  return (
    <CreatorLiveBanner 
      userId={user.user_id} 
      onClose={() => setShowBanner(false)}
    />
  );
};

export default GlobalCreatorBanner;
