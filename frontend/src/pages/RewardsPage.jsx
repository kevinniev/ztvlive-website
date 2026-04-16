import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gift, Clock, CheckCircle, AlertCircle, Copy, ExternalLink, Inbox, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function RewardsPage() {
  const [email, setEmail] = useState("");
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Check if email is stored
  useEffect(() => {
    const stored = localStorage.getItem('ztv_rewards_email');
    if (stored) {
      setEmail(stored);
      fetchRewards(stored);
    }
  }, []);

  const fetchRewards = async (emailToFetch) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/game-show/inbox/${encodeURIComponent(emailToFetch)}`);
      setRewards(res.data);
      setSubmitted(true);
      localStorage.setItem('ztv_rewards_email', emailToFetch);
    } catch (error) {
      toast.error("Failed to load rewards");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error("Please enter a valid email");
      return;
    }
    fetchRewards(email);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard!");
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isExpired = (expiresAt) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-purple-950/20 to-zinc-950">
      <Navigation />
      
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl mb-6"
          >
            <Gift className="w-10 h-10 text-white" />
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Rewards</span> Inbox
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            View and redeem rewards you've won from ZTVLIVE UNUSUAL FUN SHOW!
          </p>
        </div>

        {/* Email lookup form */}
        {!submitted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 mb-8"
          >
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
              <Input
                type="email"
                placeholder="Enter your email to view rewards..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-zinc-800 border-zinc-700 text-white h-12"
              />
              <Button 
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 h-12 px-8"
              >
                {loading ? "Loading..." : (
                  <>
                    <Inbox className="w-4 h-4 mr-2" />
                    View Rewards
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        )}

        {/* Rewards list */}
        {submitted && rewards && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-white">{rewards.total_claimed}</p>
                <p className="text-zinc-500 text-sm">Total Claimed</p>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-green-400">{rewards.active_rewards?.length || 0}</p>
                <p className="text-zinc-500 text-sm">Active</p>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center col-span-2 md:col-span-1">
                <p className="text-3xl font-black text-zinc-500">{rewards.expired_rewards?.length || 0}</p>
                <p className="text-zinc-500 text-sm">Expired</p>
              </div>
            </div>

            {/* Change email */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-zinc-400">
                Showing rewards for <span className="text-white font-semibold">{rewards.email}</span>
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSubmitted(false);
                  setRewards(null);
                }}
                className="text-zinc-400 hover:text-white"
              >
                Change email
              </Button>
            </div>

            {/* Active rewards */}
            {rewards.active_rewards?.length > 0 ? (
              <div className="space-y-4 mb-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  Active Rewards
                </h2>
                
                {rewards.active_rewards.map((reward, idx) => (
                  <motion.div
                    key={reward.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-zinc-900/80 border border-zinc-700 rounded-xl overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="text-5xl">{reward.logo}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-bold text-white">{reward.sponsor}</h3>
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          </div>
                          <p className="text-purple-400 font-semibold mb-2">{reward.reward_title}</p>
                          <p className="text-zinc-400 text-sm mb-4">{reward.reward_description}</p>
                          
                          {/* Code box */}
                          <div className="bg-zinc-800 rounded-lg p-4 flex items-center justify-between">
                            <div>
                              <p className="text-zinc-500 text-xs mb-1">YOUR CODE</p>
                              <p className="text-2xl font-mono font-black text-yellow-400">{reward.reward_code}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyCode(reward.reward_code)}
                              className="border-zinc-600"
                            >
                              <Copy className="w-4 h-4 mr-1" />
                              Copy
                            </Button>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-4 text-sm">
                            <span className="text-zinc-500 flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              Expires {formatDate(reward.expires_at)}
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span className="text-zinc-500">
                              Won on {formatDate(reward.claimed_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center mb-8">
                <Gift className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Active Rewards</h3>
                <p className="text-zinc-500 mb-6">Play ZTVLIVE UNUSUAL FUN SHOW to win exclusive rewards!</p>
                <Button 
                  onClick={() => window.location.href = '/watch'}
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  Play Now
                </Button>
              </div>
            )}

            {/* Expired rewards */}
            {rewards.expired_rewards?.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-zinc-500 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Expired Rewards
                </h2>
                
                {rewards.expired_rewards.map((reward, idx) => (
                  <div
                    key={reward.id}
                    className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-6 opacity-60"
                  >
                    <div className="flex items-start gap-4">
                      <div className="text-4xl grayscale">{reward.logo}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-zinc-400">{reward.sponsor}</h3>
                          <Badge variant="outline" className="text-zinc-500 border-zinc-700">
                            Expired
                          </Badge>
                        </div>
                        <p className="text-zinc-500">{reward.reward_title}</p>
                        <p className="text-zinc-600 text-sm mt-2">
                          Expired on {formatDate(reward.expires_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-zinc-500 mb-4">Want to win more rewards?</p>
          <Button
            onClick={() => window.location.href = '/watch'}
            size="lg"
            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Play UNUSUAL FUN SHOW
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
