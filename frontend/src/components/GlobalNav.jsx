import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Tv, Gamepad2, ArrowLeft, Menu, X, User, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * GlobalNav - Persistent floating navigation that appears on EVERY page
 * Ensures users can always:
 * - Go Home
 * - Watch Live
 * - Play Game
 * - Go Back (to dashboard or previous page)
 */
export default function GlobalNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for logged in user
    const storedUser = localStorage.getItem('ztvlive_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Close menu on route change
  useEffect(() => {
    setIsExpanded(false);
  }, [location.pathname]);

  // Don't show on certain pages (pages with their own nav)
  const hiddenPaths = ['/roku', '/obs', '/broadcast', '/play'];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) {
    return null;
  }

  const handleBack = () => {
    // Smart back navigation
    const currentPath = location.pathname;
    
    // If on login/signup, go home
    if (currentPath === '/login' || currentPath === '/register' || currentPath === '/signup') {
      navigate('/');
      return;
    }
    
    // If on creator pages, go to creator dashboard
    if (currentPath.startsWith('/creator/') && currentPath !== '/creator/dashboard') {
      navigate('/creator/dashboard');
      return;
    }
    
    // If on admin pages, go to admin dashboard
    if (currentPath.startsWith('/admin/') && currentPath !== '/admin/dashboard') {
      navigate('/admin/dashboard');
      return;
    }
    
    // Try browser back, or go home
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // Share/Invite functionality
  const handleShare = async () => {
    const shareUrl = "https://www.ztvlivestream.com/watch?ref=invite";
    const shareTitle = "ZTVLIVE - 24/7 Live Streaming";
    const shareText = "🎮 Join me on ZTVLIVE! Watch live music, play games, and win prizes! 🏆";
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        return;
      } catch (e) {
        // User cancelled or share failed
      }
    }
    
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      toast.success("Invite link copied! Share with friends 🎉");
    } catch (e) {
      toast.error("Could not copy link");
    }
  };

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Tv, label: "Watch", href: "/watch" },
    { icon: Gamepad2, label: "Play", href: "/play" },
    { icon: Download, label: "Download App", href: "/download", isHighlight: true },
    { icon: Share2, label: "Share & Invite", onClick: handleShare, isAction: true },
    { icon: User, label: user ? "Dashboard" : "Login", href: user ? "/creator/dashboard" : "/login" },
  ];

  const isActive = (href) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href.split('?')[0]);
  };

  return (
    <>
      {/* Floating Back Button - Always visible */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={handleBack}
        className="fixed bottom-4 left-4 z-50 w-12 h-12 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-full flex items-center justify-center text-white hover:bg-zinc-800 hover:border-zinc-600 transition-all shadow-lg"
        data-testid="global-back-btn"
      >
        <ArrowLeft className="w-5 h-5" />
      </motion.button>

      {/* Floating Nav Button - Bottom Right */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="absolute bottom-16 right-0 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-xl p-2 shadow-xl mb-2"
            >
              <div className="flex flex-col gap-1 min-w-[160px]">
                {navItems.map((item) => (
                  item.isAction ? (
                    <button
                      key={item.label}
                      onClick={() => {
                        item.onClick();
                        setIsExpanded(false);
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      data-testid={`global-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ) : (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                        item.isHighlight
                          ? "bg-green-600 text-white hover:bg-green-500"
                          : isActive(item.href)
                          ? "bg-red-600 text-white"
                          : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                      }`}
                      data-testid={`global-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  )
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isExpanded 
              ? "bg-red-600 text-white" 
              : "bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 text-white hover:bg-zinc-800"
          }`}
          data-testid="global-nav-toggle"
        >
          {isExpanded ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </motion.div>
    </>
  );
}
