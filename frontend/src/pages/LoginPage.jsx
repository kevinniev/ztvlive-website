import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, Tv, ArrowRight, Loader2, Calendar, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const API = '/api';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

export default function LoginPage({ defaultMode = "login" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(defaultMode === "login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState(null);
  const [rememberMe, setRememberMe] = useState(true); // Default to true for convenience
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: ""
  });

  // Auto-fill email if remembered
  useEffect(() => {
    const savedEmail = localStorage.getItem('ztvlive_remembered_email');
    if (savedEmail) {
      setForm(prev => ({ ...prev, email: savedEmail }));
    }
  }, []);

  // Check for redirect parameter and show appropriate message
  useEffect(() => {
    const redirect = searchParams.get('redirect');
    if (redirect === '/schedule-slot') {
      setRedirectMessage({
        icon: Calendar,
        title: 'Schedule Your Content',
        message: 'Log in or create an account to schedule your videos on ZTVLIVE\'s 24/7 live TV.'
      });
    } else if (redirect?.includes('upload')) {
      setRedirectMessage({
        icon: Video,
        title: 'Upload Your Videos',
        message: 'Log in or create an account to upload and share your content with millions of viewers.'
      });
    }
  }, [searchParams]);

  const handleGoogleLogin = () => {
    // Use dynamic redirect URL based on current origin
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleLocalAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const payload = isLogin 
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name };

      const response = await axios.post(`${API}${endpoint}`, payload, {
        withCredentials: true
      });

      if (response.data.success) {
        localStorage.setItem('ztvlive_user', JSON.stringify(response.data.user));
        if (response.data.session_token) {
          localStorage.setItem('token', response.data.session_token);
        }
        
        // Remember email if checkbox is checked
        if (rememberMe && form.email) {
          localStorage.setItem('ztvlive_remembered_email', form.email);
        } else {
          localStorage.removeItem('ztvlive_remembered_email');
        }
        
        toast.success(isLogin ? "Welcome back!" : "Account created successfully!");
        
        // Check for redirect param
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get('redirect') || '/creator/dashboard';
        
        navigate(redirectTo, { 
          replace: true,
          state: { user: response.data.user }
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 via-black to-purple-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(220,38,38,0.3),transparent_50%)]" />
        
        <div className="relative z-10 flex flex-col justify-center p-12">
          <Link to="/" className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
              <Tv className="w-7 h-7 text-white" />
            </div>
            <span className="text-3xl font-bold text-white tracking-tight">ZTVLIVE</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-4xl font-bold text-white mb-6">
              Create. Stream. <span className="text-red-500">Earn.</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8">
              Upload your videos. Get paid for every view. No subscriber requirements. No waiting.
            </p>

            {/* Stats that matter to creators */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="text-2xl font-bold text-green-500">70%</div>
                <div className="text-xs text-gray-400">Revenue Share</div>
              </div>
              <div className="text-center p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="text-2xl font-bold text-green-500">$0</div>
                <div className="text-xs text-gray-400">Requirements</div>
              </div>
              <div className="text-center p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="text-2xl font-bold text-green-500">Weekly</div>
                <div className="text-xs text-gray-400">Payouts</div>
              </div>
            </div>

            <div className="space-y-4">
              {[
                "No subscribers needed - earn from day 1",
                "70% revenue share (vs YouTube's 55%)",
                "Weekly payouts - $50 minimum",
                "Your content on Roku & Fire TV",
                "Keep 100% of tips from fans"
              ].map((benefit, i) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-gray-300">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* Right Panel - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <Link to="/" className="flex lg:hidden items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">ZTVLIVE</span>
          </Link>

          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8">
            {/* Redirect Message Banner */}
            {redirectMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-600/20 border border-red-600/30 rounded-lg"
              >
                <div className="flex items-start gap-3">
                  <redirectMessage.icon className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-white">{redirectMessage.title}</h3>
                    <p className="text-sm text-zinc-300">{redirectMessage.message}</p>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                {isLogin ? "Welcome Back" : "Join ZTVLIVE"}
              </h2>
              <p className="text-gray-400">
                {isLogin ? "Sign in to your creator account" : "Create your creator account"}
              </p>
            </div>

            {/* Google OAuth Button */}
            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              className="w-full h-12 bg-white hover:bg-gray-100 text-black border-0 mb-6"
              data-testid="google-login-btn"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-zinc-900/50 text-gray-500">or continue with email</span>
              </div>
            </div>

            {/* Local Auth Form */}
            <form onSubmit={handleLocalAuth} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label htmlFor="name" className="text-gray-300">Full Name</Label>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <Input
                      id="name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name"
                      className="pl-10 h-12 bg-zinc-800/50 border-zinc-700 text-white"
                      autoComplete="name"
                      autoCapitalize="words"
                      required={!isLogin}
                      data-testid="signup-name-input"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="email" className="text-gray-300">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="pl-10 h-12 bg-zinc-800/50 border-zinc-700 text-white"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    required
                    data-testid="auth-email-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="pl-10 pr-10 h-12 bg-zinc-800/50 border-zinc-700 text-white"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                    data-testid="auth-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              {isLogin && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-400">Remember my email</span>
                  </label>
                  <button type="button" className="text-sm text-red-500 hover:text-red-400">
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white"
                data-testid="auth-submit-btn"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Sign In" : "Create Account"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-gray-400 hover:text-white transition-colors"
                data-testid="toggle-auth-mode"
              >
                {isLogin ? (
                  <>Don't have an account? <span className="text-red-500">Sign up</span></>
                ) : (
                  <>Already have an account? <span className="text-red-500">Sign in</span></>
                )}
              </button>
            </div>
          </div>

          <p className="text-center text-gray-500 text-sm mt-6">
            By continuing, you agree to ZTVLIVE's{" "}
            <Link to="/creator-agreement" className="text-red-500 hover:underline">
              Creator Agreement
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-red-500 hover:underline">
              Privacy Policy
            </Link>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
