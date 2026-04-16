/**
 * LiveChat Component for ZTVLIVE Watch Page
 * 
 * Real-time chat functionality with:
 * - Message display with auto-scroll
 * - Message input
 * - Viewer count
 * - Chat toggle
 */

import { useState, useRef, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Users, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const LiveChat = memo(({
  messages = [],
  viewers = 0,
  isOpen = true,
  onToggle,
  onSendMessage,
  currentUser,
  disabled = false,
}) => {
  const [newMessage, setNewMessage] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current && isAtBottom) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isAtBottom]);

  // Handle scroll to detect if user is at bottom
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 50);
  };

  // Handle message send
  const handleSend = () => {
    if (!newMessage.trim() || disabled) return;
    onSendMessage?.(newMessage.trim());
    setNewMessage("");
    inputRef.current?.focus();
  };

  // Handle enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-red-500" />
          <span className="font-medium text-sm">Live Chat</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-zinc-400">
            <Users className="w-3 h-3" />
            <span>{viewers.toLocaleString()}</span>
          </div>
          
          {onToggle && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onToggle}
              className="h-6 w-6"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-2"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Be the first to say something!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <motion.div
              key={msg.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.isSystem ? 'items-center' : ''}`}
            >
              {msg.isSystem ? (
                <div className="bg-zinc-800/50 text-zinc-400 text-xs px-3 py-1 rounded-full">
                  {msg.text}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span 
                      className="text-xs font-medium"
                      style={{ color: msg.color || '#ef4444' }}
                    >
                      {msg.username || 'Anonymous'}
                    </span>
                    {msg.badges && msg.badges.map((badge, i) => (
                      <Badge key={i} variant="secondary" className="h-4 text-[10px] px-1">
                        {badge}
                      </Badge>
                    ))}
                    <span className="text-[10px] text-zinc-600">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 break-words">
                    {msg.text}
                  </p>
                </>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {!isAtBottom && messages.length > 5 && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => {
              chatContainerRef.current?.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
              });
            }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-lg hover:bg-red-500 transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
            New messages
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-800">
        {currentUser ? (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say something..."
              disabled={disabled}
              className="flex-1 bg-zinc-800 border-zinc-700 text-sm"
              maxLength={200}
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || disabled}
              size="icon"
              className="bg-red-600 hover:bg-red-500 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-zinc-500 text-sm mb-2">Sign in to chat</p>
            <Button
              variant="outline"
              size="sm"
              className="border-red-600 text-red-500"
            >
              Sign In
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

LiveChat.displayName = 'LiveChat';

export default LiveChat;
