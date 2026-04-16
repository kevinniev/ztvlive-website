import { useState } from "react";
import { Mail, CheckCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import axios from "axios";

const API = '/api';

export default function NewsletterSignup({ variant = "inline", onClose }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/newsletter/subscribe`, { email });
      setSubscribed(true);
      toast.success("Welcome to ZTVLIVE! Check your inbox for updates.");
      
      // Track conversion
      if (window.posthog) {
        window.posthog.capture('newsletter_signup', { email_domain: email.split('@')[1] });
      }
    } catch (error) {
      if (error.response?.status === 409) {
        toast.info("You're already subscribed!");
        setSubscribed(true);
      } else {
        toast.error("Could not subscribe. Try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className={`${variant === "popup" ? "p-6 bg-zinc-900 rounded-xl border border-zinc-800" : ""} text-center`}>
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-white font-medium">You're on the list!</p>
        <p className="text-zinc-400 text-sm mt-1">Watch for exclusive updates in your inbox.</p>
      </div>
    );
  }

  // Popup variant (modal-style)
  if (variant === "popup") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 max-w-md w-full relative">
          <button 
            onClick={onClose}
            className="absolute top-3 right-3 text-zinc-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white">Stay Connected</h3>
            <p className="text-zinc-400 mt-2 text-sm">
              Get exclusive updates, new releases, and special offers from ZTVLIVE
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-800 border-zinc-700 text-white"
              required
            />
            <Button 
              type="submit" 
              className="w-full bg-red-600 hover:bg-red-500"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Subscribe Now
            </Button>
          </form>
          
          <p className="text-zinc-500 text-xs text-center mt-4">
            No spam. Unsubscribe anytime.
          </p>
        </div>
      </div>
    );
  }

  // Inline variant (for footer/sections)
  return (
    <div className="bg-gradient-to-r from-red-900/30 to-zinc-900 rounded-xl p-6 border border-red-900/30">
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
            <Mail className="w-5 h-5 text-red-500" />
            Join the ZTVLIVE Community
          </h3>
          <p className="text-zinc-400 text-sm mt-1">
            Get exclusive content, updates, and creator opportunities
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="flex gap-2 w-full md:w-auto">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white min-w-[200px]"
            required
          />
          <Button 
            type="submit" 
            className="bg-red-600 hover:bg-red-500 whitespace-nowrap"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// Hook to show popup after delay
export function useNewsletterPopup(delayMs = 30000) {
  const [showPopup, setShowPopup] = useState(false);

  useState(() => {
    // Check if user already subscribed or dismissed
    const dismissed = localStorage.getItem('newsletter_dismissed');
    const subscribed = localStorage.getItem('newsletter_subscribed');
    
    if (!dismissed && !subscribed) {
      const timer = setTimeout(() => {
        setShowPopup(true);
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [delayMs]);

  const dismiss = () => {
    setShowPopup(false);
    localStorage.setItem('newsletter_dismissed', Date.now().toString());
  };

  return { showPopup, dismiss };
}
