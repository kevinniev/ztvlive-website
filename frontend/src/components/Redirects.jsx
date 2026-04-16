import { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

/**
 * Redirect component for old/legacy URLs
 * Redirects to the appropriate new URL
 */
export function RedirectToWatch() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/watch', { replace: true });
  }, [navigate]);
  return null;
}

export function RedirectToLibrary() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/library', { replace: true });
  }, [navigate]);
  return null;
}

export function RedirectToLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    // Preserve any query params like ?redirect=
    navigate('/login' + location.search, { replace: true });
  }, [navigate, location]);
  return null;
}

export function RedirectToRegister() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/register', { replace: true });
  }, [navigate]);
  return null;
}

export function RedirectToHome() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);
  return null;
}

export function RedirectToTrending() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/browse', { replace: true });
  }, [navigate]);
  return null;
}

// Generic redirect that shows a message before redirecting
export function LegacyRedirect({ to, message }) {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(to, { replace: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [navigate, to]);
  
  return null;
}
