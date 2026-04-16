import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv, Menu, X, Play, Film, Home, Calendar, Upload, Settings,
  DollarSign, User, LogOut, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminNotifications from "./AdminNotifications";

export default function Navigation({ 
  transparent = false,
  onInstallApp = null,
  canInstall = false,
  isStandalone = false
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for logged in user
    const storedUser = localStorage.getItem('ztvlive_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.log("Invalid user data");
      }
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { href: "/", label: "HOME", icon: Home },
    { href: "/watch?unmute=true", label: "WATCH", icon: Tv },
    { href: "/play", label: "PLAY", icon: Play },
    { href: "/schedule", label: "SCHEDULE", icon: Calendar },
    { href: "/library", label: "LIBRARY", icon: Film },
  ];

  const isActive = (href) => {
    const hrefPath = href.split('?')[0]; // Extract path without query params
    if (hrefPath === "/") return location.pathname === "/";
    return location.pathname.startsWith(hrefPath);
  };

  const bgClass = transparent && !scrolled
    ? "bg-transparent"
    : "bg-black/95 backdrop-blur-xl";

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${bgClass} border-b border-zinc-800/50`}>
        <div className="container mx-auto px-4 md:px-6 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            {/* Logo - Fixed Size */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0" data-testid="nav-logo">
              <div className="w-10 h-10 min-w-[40px] min-h-[40px] bg-red-600 rounded-lg flex items-center justify-center">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-wider text-white whitespace-nowrap">ZTVLIVE</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                    isActive(link.href)
                      ? "text-white bg-red-600/20"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                  data-testid={`nav-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              {/* Admin Notifications */}
              {user?.role === 'admin' && (
                <AdminNotifications isAdmin={true} />
              )}
              
              {/* Install App Button - Always visible */}
              <Link to="/download" className="hidden md:flex">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-500 text-white"
                  data-testid="nav-download-app"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download App
                </Button>
              </Link>

              {/* Auth Buttons */}
              {user ? (
                <Link to="/creator/dashboard" className="hidden md:flex">
                  <Button size="sm" variant="ghost" className="text-zinc-300 hover:text-white">
                    <User className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <Link to="/login" className="hidden md:flex">
                  <Button size="sm" className="bg-red-600 hover:bg-red-500" data-testid="nav-join-btn">
                    Join as Creator
                  </Button>
                </Link>
              )}

              {/* Upload Button */}
              <Link to="/submit" className="hidden md:flex">
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white">
                  <Upload className="w-4 h-4 mr-1" />
                  Upload
                </Button>
              </Link>

              {/* Mobile Menu Toggle */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="mobile-menu-toggle"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-16 z-40 lg:hidden"
          >
            <div className="bg-zinc-900/98 backdrop-blur-xl border-b border-zinc-800 shadow-xl">
              <div className="container mx-auto px-4 py-4">
                <div className="flex flex-col gap-1">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive(link.href)
                          ? "bg-red-600/20 text-white"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      <link.icon className={`w-5 h-5 ${isActive(link.href) ? "text-red-500" : "text-zinc-500"}`} />
                      {link.label}
                    </Link>
                  ))}

                  <div className="border-t border-zinc-800 my-2" />

                  {/* Mobile-only links */}
                  <Link
                    to="/submit"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-300 hover:bg-zinc-800"
                  >
                    <Upload className="w-5 h-5 text-zinc-500" />
                    Upload Content
                  </Link>

                  {user ? (
                    <Link
                      to="/creator/dashboard"
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-zinc-300 hover:bg-zinc-800"
                    >
                      <User className="w-5 h-5 text-zinc-500" />
                      Creator Dashboard
                    </Link>
                  ) : (
                    <Link
                      to="/login"
                      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600/20 text-red-400"
                    >
                      <User className="w-5 h-5 text-red-500" />
                      Join as Creator
                    </Link>
                  )}

                  {/* Download App - Always visible in mobile menu */}
                  <Link
                    to="/download"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-600/20 text-green-400"
                    data-testid="mobile-download-app"
                  >
                    <Download className="w-5 h-5 text-green-500" />
                    Download App
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for fixed nav */}
      <div className="h-16" />
    </>
  );
}
