import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import {
  Heart, DollarSign, Send, Tv, ArrowRight, Check, Loader2,
  Coffee, Gift, Star, Crown, MessageCircle, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const API = '/api';

const PACKAGE_ICONS = {
  coffee: Coffee,
  lunch: Gift,
  support: Heart,
  sponsor: Star,
  patron: Crown
};

export default function TipCreatorPage() {
  const { creatorId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  
  const [creator, setCreator] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);

  useEffect(() => {
    fetchData();
  }, [creatorId]);

  useEffect(() => {
    // Check payment status if returning from Stripe
    if (sessionId) {
      pollPaymentStatus(sessionId);
    }
  }, [sessionId]);

  const fetchData = async () => {
    try {
      const [packagesRes] = await Promise.all([
        axios.get(`${API}/payments/packages`)
      ]);
      
      setPackages(packagesRes.data.packages);
      
      // For demo, set a default creator
      setCreator({
        user_id: creatorId || "demo_creator",
        name: "Creator",
        picture: null,
        bio: "Content creator on ZTVLIVE"
      });
      
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (sid, attempts = 0) => {
    const maxAttempts = 5;
    
    if (attempts >= maxAttempts) {
      setPaymentStatus({ status: "timeout", message: "Payment status check timed out" });
      return;
    }

    try {
      const response = await axios.get(`${API}/payments/status/${sid}`);
      
      if (response.data.payment_status === "paid") {
        setPaymentStatus({ 
          status: "success", 
          message: "Thank you for your support!",
          amount: response.data.amount
        });
        toast.success("Payment successful! Thank you!");
        return;
      } else if (response.data.status === "expired") {
        setPaymentStatus({ status: "expired", message: "Payment session expired" });
        return;
      }
      
      // Continue polling
      setTimeout(() => pollPaymentStatus(sid, attempts + 1), 2000);
      
    } catch (error) {
      console.error("Error checking payment:", error);
      setTimeout(() => pollPaymentStatus(sid, attempts + 1), 2000);
    }
  };

  const handleTip = async (packageId = null) => {
    setProcessing(true);
    
    try {
      const originUrl = window.location.origin;
      
      let response;
      if (packageId) {
        response = await axios.post(`${API}/payments/tip`, {
          package_id: packageId,
          creator_id: creatorId || "demo_creator",
          origin_url: originUrl,
          message: message || null
        });
      } else {
        // Custom amount
        const amount = parseFloat(customAmount);
        if (isNaN(amount) || amount < 1 || amount > 1000) {
          toast.error("Amount must be between $1 and $1000");
          setProcessing(false);
          return;
        }
        
        response = await axios.post(`${API}/payments/custom-tip`, {
          amount: amount,
          creator_id: creatorId || "demo_creator",
          origin_url: originUrl,
          message: message || null
        });
      }
      
      // Redirect to Stripe checkout
      window.location.href = response.data.checkout_url;
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to process payment");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
      </div>
    );
  }

  // Payment success state
  if (paymentStatus?.status === "success") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
          <p className="text-gray-400 mb-6">
            Thank you for supporting the creator with ${paymentStatus.amount?.toFixed(2)}!
          </p>
          <Link to="/">
            <Button className="bg-red-600 hover:bg-red-700">
              Back to ZTVLIVE
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">ZTVLIVE</span>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Creator Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 bg-zinc-800 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
            {creator?.picture ? (
              <img src={creator.picture} alt={creator.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-12 h-12 text-gray-500" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Support {creator?.name || "this Creator"}
          </h1>
          <p className="text-gray-400">
            Show your appreciation with a tip!
          </p>
        </motion.div>

        {/* Tip Packages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6"
        >
          <h2 className="text-lg font-bold text-white mb-4">Choose an Amount</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {packages.map((pkg) => {
              const Icon = PACKAGE_ICONS[pkg.id] || Heart;
              const isSelected = selectedPackage === pkg.id;
              
              return (
                <button
                  key={pkg.id}
                  onClick={() => {
                    setSelectedPackage(pkg.id);
                    setCustomAmount("");
                  }}
                  className={`p-4 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-red-600/20 border-red-500 text-white"
                      : "bg-zinc-800/50 border-zinc-700 text-gray-300 hover:border-zinc-600"
                  }`}
                  data-testid={`tip-package-${pkg.id}`}
                >
                  <div className="text-2xl mb-2">{pkg.emoji}</div>
                  <p className="font-bold">${pkg.amount.toFixed(2)}</p>
                  <p className="text-sm text-gray-400">{pkg.name}</p>
                </button>
              );
            })}
          </div>

          {/* Custom Amount */}
          <div className="border-t border-zinc-800 pt-4">
            <p className="text-gray-400 text-sm mb-2">Or enter a custom amount</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedPackage(null);
                  }}
                  placeholder="Enter amount"
                  className="pl-10 bg-zinc-800/50 border-zinc-700 text-white"
                  data-testid="custom-tip-amount"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-bold text-white">Add a Message (Optional)</h2>
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say something nice..."
            className="bg-zinc-800/50 border-zinc-700 text-white"
            rows={3}
            data-testid="tip-message"
          />
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            onClick={() => handleTip(selectedPackage)}
            disabled={processing || (!selectedPackage && !customAmount)}
            className="w-full h-14 bg-red-600 hover:bg-red-700 text-white text-lg"
            data-testid="submit-tip-btn"
          >
            {processing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Heart className="w-5 h-5 mr-2" />
                Send Tip
                {selectedPackage && ` - $${packages.find(p => p.id === selectedPackage)?.amount.toFixed(2)}`}
                {customAmount && ` - $${parseFloat(customAmount).toFixed(2)}`}
              </>
            )}
          </Button>
          
          <p className="text-center text-gray-500 text-sm mt-4">
            Secure payment powered by Stripe
          </p>
        </motion.div>
      </main>
    </div>
  );
}

// Success page component
export function TipSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    if (sessionId) {
      checkPayment(sessionId);
    }
  }, [sessionId]);

  const checkPayment = async (sid, attempts = 0) => {
    if (attempts >= 5) {
      setStatus("timeout");
      return;
    }

    try {
      const response = await axios.get(`${API}/payments/status/${sid}`);
      
      if (response.data.payment_status === "paid") {
        setStatus("success");
        return;
      }
      
      setTimeout(() => checkPayment(sid, attempts + 1), 2000);
    } catch {
      setTimeout(() => checkPayment(sid, attempts + 1), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center"
      >
        {status === "checking" && (
          <>
            <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
            <p className="text-white">Verifying payment...</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Thank You!</h1>
            <p className="text-gray-400 mb-6">Your tip has been sent successfully!</p>
            <Link to="/">
              <Button className="bg-red-600 hover:bg-red-700">
                Back to ZTVLIVE
              </Button>
            </Link>
          </>
        )}
        
        {status === "timeout" && (
          <>
            <p className="text-white mb-4">Payment verification timed out</p>
            <p className="text-gray-400 text-sm mb-6">
              Your payment may still have been processed. Please check your email for confirmation.
            </p>
            <Link to="/">
              <Button className="bg-red-600 hover:bg-red-700">
                Back to ZTVLIVE
              </Button>
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}

// Cancel page component
export function TipCancelPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center"
      >
        <h1 className="text-2xl font-bold text-white mb-2">Payment Cancelled</h1>
        <p className="text-gray-400 mb-6">No worries! You can try again anytime.</p>
        <Link to="/">
          <Button className="bg-red-600 hover:bg-red-700">
            Back to ZTVLIVE
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
