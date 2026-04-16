import { useState } from "react";
import { motion } from "framer-motion";
import { Gift, Mail, CheckCircle, Inbox, Trophy, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// Demo page showing the reward claim flow
export default function RewardDemo() {
  const [phase, setPhase] = useState("claim"); // claim, success
  const [email, setEmail] = useState("");

  const reward = {
    sponsor: "DoorDash",
    logo: "🍔",
    reward_title: "$5 OFF Your Next Order",
    reward_code: "ZTVLIVE5",
    reward_description: "Use code ZTVLIVE5 at checkout for $5 off any order $15+",
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };

  const handleClaim = () => {
    if (email && email.includes('@')) {
      setPhase("success");
    }
  };

  if (phase === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-zinc-900 to-emerald-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-zinc-900/80 p-8 rounded-3xl max-w-md w-full text-center border-2 border-green-500/50"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-4" />
          </motion.div>
          
          <h2 className="text-3xl font-black text-white mb-2">REWARD SENT!</h2>
          <p className="text-green-400 text-lg mb-4">Check your inbox at <span className="font-bold">{email}</span></p>
          
          <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
            <p className="text-6xl mb-2">{reward.logo}</p>
            <p className="text-white font-bold">{reward.reward_title}</p>
            <div className="bg-black/30 rounded-lg p-3 mt-2">
              <p className="text-zinc-400 text-xs mb-1">YOUR CODE:</p>
              <p className="text-2xl font-mono font-black text-yellow-400">{reward.reward_code}</p>
            </div>
            <p className="text-zinc-500 text-xs mt-2">
              Expires: {new Date(reward.expires_at).toLocaleDateString()}
            </p>
          </div>
          
          <Button 
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-lg py-6 font-bold"
            onClick={() => window.location.href = '/watch'}
          >
            <Play className="w-5 h-5 mr-2" />
            PLAY ANOTHER ROUND
          </Button>
          
          <p className="text-zinc-500 text-xs mt-4">
            Powered by ZTVLIVE • View all rewards at /rewards
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-zinc-900 to-pink-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-zinc-900/80 p-8 rounded-3xl max-w-md w-full text-center border-2 border-purple-500/50"
      >
        {/* Winner badge */}
        <div className="mb-4">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-2" />
          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-lg px-4 py-1">
            <Gift className="w-4 h-4 mr-2" />
            YOU WON!
          </Badge>
        </div>
        
        {/* Reward info */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-7xl mb-4"
        >
          {reward.logo}
        </motion.div>
        
        <h2 className="text-2xl font-black text-white mb-2">{reward.sponsor}</h2>
        <p className="text-xl text-yellow-400 font-bold mb-2">{reward.reward_title}</p>
        <p className="text-zinc-400 text-sm mb-6">{reward.reward_description}</p>
        
        {/* Email capture form */}
        <div className="bg-zinc-800/50 rounded-xl p-4 mb-4">
          <p className="text-purple-300 text-sm mb-3 flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Enter your email to claim your reward
          </p>
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-zinc-900 border-purple-500/50 text-white text-center mb-3"
          />
          <Button 
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-lg py-6 font-bold"
            onClick={handleClaim}
            disabled={!email}
          >
            <Inbox className="w-5 h-5 mr-2" />
            SEND TO MY INBOX
          </Button>
        </div>
        
        <p className="text-purple-300 text-xs italic">
          "Congratulations! Your reward is waiting - just enter your email!"
        </p>
      </motion.div>
    </div>
  );
}
