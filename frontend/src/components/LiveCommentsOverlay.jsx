import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, X, Heart, Flame, ThumbsUp, Star, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = '';
const WS_URL = typeof window !== 'undefined' 
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : '';

// Emoji reactions
const REACTIONS = [
  { emoji: "❤️", icon: Heart, color: "#ef4444" },
  { emoji: "🔥", icon: Flame, color: "#f97316" },
  { emoji: "👍", icon: ThumbsUp, color: "#3b82f6" },
  { emoji: "⭐", icon: Star, color: "#eab308" },
  { emoji: "😂", icon: Smile, color: "#22c55e" },
];

// Single comment bubble that floats up
function CommentBubble({ comment, onComplete }) {
  const randomX = Math.random() * 20 - 10; // -10 to 10
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, x: randomX }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      onAnimationComplete={() => {
        // Auto-remove after 8 seconds
        setTimeout(onComplete, 8000);
      }}
      className="flex items-start gap-2 mb-2"
    >
      {/* Avatar */}
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{ backgroundColor: comment.color || "#6366f1" }}
      >
        {comment.avatar ? (
          <img src={comment.avatar} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          comment.username?.[0]?.toUpperCase() || "?"
        )}
      </div>
      
      {/* Message */}
      <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 max-w-[280px]">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm" style={{ color: comment.color || "#fff" }}>
            {comment.username}
          </span>
          {comment.is_verified && (
            <span className="text-blue-400 text-xs">✓</span>
          )}
        </div>
        <p className="text-white text-sm break-words">{comment.message}</p>
      </div>
    </motion.div>
  );
}

// Floating reaction animation
function FloatingReaction({ emoji, onComplete }) {
  const randomX = 10 + Math.random() * 80; // 10-90% from left
  
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 0.5 }}
      animate={{ 
        opacity: [1, 1, 0],
        y: -150,
        scale: [0.5, 1.2, 1]
      }}
      transition={{ duration: 2, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      className="absolute bottom-20 text-3xl pointer-events-none"
      style={{ left: `${randomX}%` }}
    >
      {emoji}
    </motion.div>
  );
}

export default function LiveCommentsOverlay({ 
  isVisible = true, 
  user = null,
  onToggle
}) {
  const [comments, setComments] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const wsRef = useRef(null);
  const commentsEndRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      wsRef.current = new WebSocket(`${WS_URL}/ws/live-comments`);
      
      wsRef.current.onopen = () => {
        console.log("Live comments connected");
        setIsConnected(true);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "live_comment") {
            setComments(prev => {
              const newComments = [...prev, { ...data, _key: `${data.id}_${Date.now()}` }];
              // Keep only last 30 comments
              return newComments.slice(-30);
            });
          } else if (data.type === "reaction") {
            setReactions(prev => [...prev, { ...data, _key: `${Date.now()}_${Math.random()}` }]);
          }
        } catch (e) {
          console.error("Failed to parse message:", e);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log("Live comments disconnected");
        setIsConnected(false);
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
      
      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (e) {
      console.error("Failed to connect:", e);
    }
  }, []);

  // Load recent comments on mount
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const res = await fetch(`${API}/api/live-comments/recent?limit=20`);
        const data = await res.json();
        if (data.comments) {
          setComments(data.comments.map((c, i) => ({ ...c, _key: `initial_${i}` })));
        }
      } catch (e) {
        console.error("Failed to load recent comments:", e);
      }
    };
    
    loadRecent();
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Send comment
  const sendComment = () => {
    if (!message.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const colors = ["#f97316", "#8b5cf6", "#22c55e", "#ec4899", "#06b6d4", "#eab308"];
    
    wsRef.current.send(JSON.stringify({
      type: "comment",
      username: user?.display_name || user?.name || "Viewer",
      message: message.trim(),
      user_id: user?.user_id,
      avatar: user?.picture,
      is_verified: user?.is_verified || false,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    
    setMessage("");
  };

  // Send reaction
  const sendReaction = (emoji) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      type: "reaction",
      emoji,
      user_id: user?.user_id
    }));
  };

  // Remove comment from display
  const removeComment = (key) => {
    setComments(prev => prev.filter(c => c._key !== key));
  };

  // Remove reaction from display
  const removeReaction = (key) => {
    setReactions(prev => prev.filter(r => r._key !== key));
  };

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-30">
      {/* Floating Reactions */}
      <AnimatePresence>
        {reactions.map((reaction) => (
          <FloatingReaction
            key={reaction._key}
            emoji={reaction.emoji}
            onComplete={() => removeReaction(reaction._key)}
          />
        ))}
      </AnimatePresence>
      
      {/* Comments Overlay - Left side */}
      <div className="absolute left-4 bottom-24 w-80 max-h-[50%] overflow-hidden pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {comments.map((comment) => (
            <CommentBubble
              key={comment._key}
              comment={comment}
              onComplete={() => removeComment(comment._key)}
            />
          ))}
        </AnimatePresence>
        <div ref={commentsEndRef} />
      </div>
      
      {/* Controls - Bottom right */}
      <div className="absolute right-4 bottom-24 flex flex-col items-end gap-2 pointer-events-auto">
        {/* Reaction Buttons */}
        <div className="flex gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-2">
          {REACTIONS.map((r) => (
            <button
              key={r.emoji}
              onClick={() => sendReaction(r.emoji)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-95"
              title={`Send ${r.emoji}`}
            >
              {r.emoji}
            </button>
          ))}
        </div>
        
        {/* Toggle comment input */}
        <button
          onClick={() => setShowInput(!showInput)}
          className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg transition-all"
          data-testid="toggle-comment-input"
        >
          {showInput ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        </button>
      </div>
      
      {/* Comment Input */}
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-4 right-4 pointer-events-auto"
          >
            <div className="bg-black/80 backdrop-blur-md rounded-xl p-3 flex items-center gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendComment()}
                placeholder={user ? "Say something..." : "Sign in to comment"}
                disabled={!user}
                className="bg-white/10 border-white/20 text-white placeholder-white/50 flex-1"
                maxLength={200}
                data-testid="live-comment-input"
              />
              <Button
                onClick={sendComment}
                disabled={!message.trim() || !user}
                className="bg-red-600 hover:bg-red-700"
                data-testid="send-comment-btn"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {!isConnected && (
              <p className="text-yellow-400 text-xs mt-1 text-center">Reconnecting...</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
