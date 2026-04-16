import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, UserPlus, Crown, Copy, Check, X, Mail, Send, Trophy, Zap, Link2, 
  Trash2, LogOut, Mic, MicOff, Video, VideoOff, MessageCircle, Upload,
  Play, Pause, SkipForward, Settings, Share2, Facebook, Instagram, Twitter,
  Youtube, Hash, Eye, EyeOff, Sparkles, FileText, Table, Presentation, QrCode,
  Phone, MessageSquare
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

// Custom TikTok icon since lucide doesn't have one
const TikTokIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// Custom WhatsApp icon
const WhatsAppIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// Custom Telegram icon
const TelegramIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * GroupChallenge - Enhanced Private Group Game Mode
 * Features: Passcode, Social Share, Custom Questions, Video Chat, Host Controls
 */
export default function GroupChallenge({ 
  onClose, 
  onJoinGroup,
  currentPlayerName,
  initialGroupId,
  initialPasscode
}) {
  const [mode, setMode] = useState(initialGroupId ? 'joining' : 'menu');
  const [groupData, setGroupData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Create group form
  const [groupName, setGroupName] = useState('');
  const [hostName, setHostName] = useState(currentPlayerName || '');
  const [hostEmail, setHostEmail] = useState('');
  const [isPermanent, setIsPermanent] = useState(false);
  const [enableVideo, setEnableVideo] = useState(true);
  
  // Join group form
  const [joinCode, setJoinCode] = useState(initialGroupId || '');
  const [joinPasscode, setJoinPasscode] = useState(initialPasscode || '');
  const [playerName, setPlayerName] = useState(currentPlayerName || '');
  
  // Auto-join if coming from invite link
  useEffect(() => {
    if (initialGroupId && mode === 'joining') {
      setMode('join');
    }
  }, [initialGroupId]);
  
  const createGroup = async () => {
    if (!groupName.trim() || !hostName.trim()) {
      toast.error('Please enter a group name and your name');
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/api/game/groups/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          host_name: hostName,
          host_email: hostEmail || null,
          is_permanent: isPermanent,
          enable_video: enableVideo,
          enable_passcode: true
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setGroupData({
          ...data,
          name: groupName,
          isHost: true
        });
        localStorage.setItem('ztvlive_group_host_id', data.host_id);
        localStorage.setItem('ztvlive_group_id', data.group_id);
        localStorage.setItem('ztvlive_player_name', hostName);
        setMode('lobby');
        toast.success('Group created! Share the passcode with friends.');
      }
    } catch (err) {
      toast.error('Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };
  
  const joinGroup = async () => {
    if (!joinCode.trim() || !playerName.trim()) {
      toast.error('Please enter the group code and your name');
      return;
    }
    
    setIsLoading(true);
    try {
      let groupId = joinCode;
      if (joinCode.includes('group=')) {
        const match = joinCode.match(/group=([^&]+)/);
        if (match) groupId = match[1];
      }
      
      const res = await fetch(`${API}/api/game/groups/${groupId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName,
          passcode: joinPasscode || null
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setGroupData({
          group_id: groupId,
          player_id: data.player_id,
          name: data.group_name,
          jitsi_room: data.jitsi_room,
          isHost: false
        });
        localStorage.setItem('ztvlive_group_player_id', data.player_id);
        localStorage.setItem('ztvlive_group_id', groupId);
        localStorage.setItem('ztvlive_player_name', playerName);
        setMode('lobby');
        toast.success(`Welcome to ${data.group_name}!`);
      } else {
        toast.error(data.detail || 'Failed to join group');
      }
    } catch (err) {
      toast.error('Failed to join group');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden"
      >
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-white" />
            <h2 className="text-white font-bold text-lg">Private Group Challenge</h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          <AnimatePresence mode="wait">
            {mode === 'menu' && (
              <MenuScreen 
                onCreateClick={() => setMode('create')}
                onJoinClick={() => setMode('join')}
              />
            )}
            
            {mode === 'create' && (
              <CreateGroupScreen
                groupName={groupName}
                setGroupName={setGroupName}
                hostName={hostName}
                setHostName={setHostName}
                hostEmail={hostEmail}
                setHostEmail={setHostEmail}
                isPermanent={isPermanent}
                setIsPermanent={setIsPermanent}
                enableVideo={enableVideo}
                setEnableVideo={setEnableVideo}
                isLoading={isLoading}
                onBack={() => setMode('menu')}
                onCreate={createGroup}
              />
            )}
            
            {mode === 'join' && (
              <JoinGroupScreen
                joinCode={joinCode}
                setJoinCode={setJoinCode}
                joinPasscode={joinPasscode}
                setJoinPasscode={setJoinPasscode}
                playerName={playerName}
                setPlayerName={setPlayerName}
                isLoading={isLoading}
                onBack={() => setMode('menu')}
                onJoin={joinGroup}
              />
            )}
            
            {mode === 'lobby' && groupData && (
              <GroupLobby 
                groupData={groupData}
                onStartPlaying={() => {
                  onJoinGroup?.(groupData);
                  onClose?.();
                }}
                onLeave={() => {
                  setGroupData(null);
                  setMode('menu');
                  localStorage.removeItem('ztvlive_group_id');
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============== MENU SCREEN ==============

function MenuScreen({ onCreateClick, onJoinClick }) {
  return (
    <motion.div
      key="menu"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <p className="text-zinc-400 text-sm text-center mb-6">
        Challenge your friends! Create a private group, share the passcode, and compete together.
      </p>
      
      <Button
        onClick={onCreateClick}
        className="w-full bg-green-600 hover:bg-green-500 text-white py-6 text-lg"
        data-testid="create-group-btn"
      >
        <Crown className="w-5 h-5 mr-2" />
        Create New Group
      </Button>
      
      <Button
        onClick={onJoinClick}
        variant="outline"
        className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 py-6 text-lg"
        data-testid="join-group-btn"
      >
        <UserPlus className="w-5 h-5 mr-2" />
        Join with Passcode
      </Button>
      
      <div className="pt-4 border-t border-zinc-800">
        <p className="text-zinc-500 text-xs text-center">
          No account needed • Video chat included • Import your own questions
        </p>
      </div>
    </motion.div>
  );
}

// ============== CREATE GROUP SCREEN ==============

function CreateGroupScreen({ 
  groupName, setGroupName, hostName, setHostName, hostEmail, setHostEmail,
  isPermanent, setIsPermanent, enableVideo, setEnableVideo, isLoading, onBack, onCreate 
}) {
  return (
    <motion.div
      key="create"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <button onClick={onBack} className="text-zinc-400 hover:text-white text-sm flex items-center gap-1">
        ← Back
      </button>
      
      <h3 className="text-white font-semibold text-lg">Create Your Group</h3>
      
      <div className="space-y-3">
        <div>
          <label className="text-zinc-400 text-sm block mb-1">Group Name *</label>
          <Input
            placeholder="e.g., Friday Night Trivia"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white"
            data-testid="group-name-input"
          />
        </div>
        
        <div>
          <label className="text-zinc-400 text-sm block mb-1">Your Name *</label>
          <Input
            placeholder="Your display name"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white"
            data-testid="host-name-input"
          />
        </div>
        
        <div>
          <label className="text-zinc-400 text-sm block mb-1">Your Email (optional)</label>
          <Input
            type="email"
            placeholder="For notifications"
            value={hostEmail}
            onChange={(e) => setHostEmail(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white"
          />
        </div>
        
        <div className="space-y-2 pt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableVideo}
              onChange={(e) => setEnableVideo(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700"
            />
            <span className="text-zinc-400 text-sm flex items-center gap-1">
              <Video className="w-4 h-4" /> Enable video chat
            </span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPermanent}
              onChange={(e) => setIsPermanent(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700"
            />
            <span className="text-zinc-400 text-sm">Make permanent (reusable)</span>
          </label>
        </div>
      </div>
      
      <Button
        onClick={onCreate}
        disabled={isLoading || !groupName.trim() || !hostName.trim()}
        className="w-full bg-green-600 hover:bg-green-500 text-white py-5"
        data-testid="submit-create-group"
      >
        {isLoading ? 'Creating...' : 'Create Group'}
      </Button>
    </motion.div>
  );
}

// ============== JOIN GROUP SCREEN ==============

function JoinGroupScreen({ 
  joinCode, setJoinCode, joinPasscode, setJoinPasscode, playerName, setPlayerName, 
  isLoading, onBack, onJoin 
}) {
  return (
    <motion.div
      key="join"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <button onClick={onBack} className="text-zinc-400 hover:text-white text-sm flex items-center gap-1">
        ← Back
      </button>
      
      <h3 className="text-white font-semibold text-lg">Join a Group</h3>
      
      <div className="space-y-3">
        <div>
          <label className="text-zinc-400 text-sm block mb-1">Group Code or Link *</label>
          <Input
            placeholder="e.g., ABC123XY"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="bg-zinc-800 border-zinc-700 text-white font-mono"
            data-testid="join-code-input"
          />
        </div>
        
        <div>
          <label className="text-zinc-400 text-sm block mb-1">Passcode (if required)</label>
          <Input
            placeholder="6-digit passcode"
            value={joinPasscode}
            onChange={(e) => setJoinPasscode(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white font-mono text-center text-xl tracking-widest"
            maxLength={6}
          />
        </div>
        
        <div>
          <label className="text-zinc-400 text-sm block mb-1">Your Name *</label>
          <Input
            placeholder="Your display name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="bg-zinc-800 border-zinc-700 text-white"
            data-testid="player-name-input"
          />
        </div>
      </div>
      
      <Button
        onClick={onJoin}
        disabled={isLoading || !joinCode.trim() || !playerName.trim()}
        className="w-full bg-green-600 hover:bg-green-500 text-white py-5"
        data-testid="submit-join-group"
      >
        {isLoading ? 'Joining...' : 'Join Group'}
      </Button>
    </motion.div>
  );
}

// ============== GROUP LOBBY ==============

function GroupLobby({ groupData, onStartPlaying, onLeave }) {
  const [members, setMembers] = useState([]);
  const [passcode, setPasscode] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedPasscode, setCopiedPasscode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedQuestions, setUploadedQuestions] = useState([]);
  const [showInviteOptions, setShowInviteOptions] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailList, setEmailList] = useState('');
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [showGameHistory, setShowGameHistory] = useState(false);
  const [gameHistory, setGameHistory] = useState([]);
  const fileInputRef = useRef(null);
  const ws = useRef(null);
  
  const inviteLink = `${window.location.origin}/play?group=${groupData.group_id}`;
  
  useEffect(() => {
    fetchGroupDetails();
    connectWebSocket();
    fetchGameHistory();
    
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [groupData.group_id]);
  
  const fetchGroupDetails = async () => {
    try {
      const res = await fetch(`${API}/api/game/groups/${groupData.group_id}`);
      const data = await res.json();
      setMembers(data.members || []);
      setPasscode(data.passcode || '');
      setUploadedQuestions(data.custom_questions || []);
    } catch (err) {
      console.error('Failed to fetch group');
    }
  };
  
  const connectWebSocket = () => {
    const playerId = groupData.host_id || groupData.player_id;
    const wsUrl = `${API.replace('http', 'ws')}/api/game/groups/${groupData.group_id}/ws?player_id=${playerId}`;
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'member_joined' || data.type === 'member_kicked') {
        fetchGroupDetails();
      }
      if (data.type === 'questions_uploaded') {
        setUploadedQuestions(prev => [...prev, ...(data.questions || [])]);
        toast.success(`${data.question_count} questions uploaded!`);
      }
    };
  };
  
  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };
  
  const copyPasscode = () => {
    navigator.clipboard.writeText(passcode);
    setCopiedPasscode(true);
    toast.success('Passcode copied!');
    setTimeout(() => setCopiedPasscode(false), 2000);
  };
  
  const shareToSocial = (platform) => {
    const text = `Join my ZTVLIVE UNUSUAL FUN game! 🎮 Code: ${passcode}`;
    const url = inviteLink;
    const fullMessage = `${text}\n\n${url}`;
    
    const shareUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(fullMessage)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      tiktok: null, // TikTok doesn't have direct share URL - will copy to clipboard
      instagram: null, // Instagram doesn't have direct share URL - will copy to clipboard
      youtube: null
    };
    
    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=500');
    } else {
      // Fallback for platforms without direct share URLs
      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
      try {
        navigator.clipboard.writeText(fullMessage).then(() => {
          toast.success(`Copied! Paste on ${platformName}`);
        }).catch(() => {
          // Fallback: show the text in a prompt
          toast.info(`Share this on ${platformName}: Code ${passcode}`);
        });
      } catch (e) {
        toast.info(`Share this on ${platformName}: Code ${passcode}`);
      }
    }
  };
  
  const downloadQRCode = () => {
    const svg = document.getElementById('group-qr-code');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 300, 300);
      
      const link = document.createElement('a');
      link.download = `ztvlive-${groupData.group_id}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    toast.success('QR Code downloaded!');
  };
  
  const fetchGameHistory = async () => {
    try {
      const res = await fetch(`${API}/api/players/games/history/${groupData.group_id}`);
      const data = await res.json();
      setGameHistory(data.games || []);
    } catch (err) {
      console.error('Failed to fetch game history');
    }
  };
  
  const sendEmailInvites = async () => {
    const emails = emailList.split(/[,\n]/).map(e => e.trim()).filter(e => e && e.includes('@'));
    
    if (emails.length === 0) {
      toast.error('Please enter valid email addresses');
      return;
    }
    
    setIsSendingEmails(true);
    try {
      const res = await fetch(
        `${API}/api/game/groups/${groupData.group_id}/invite?host_id=${groupData.host_id || groupData.player_id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            emails,
            custom_message: `Join my ZTVLIVE UNUSUAL FUN game! Use code: ${passcode}`
          })
        }
      );
      
      const data = await res.json();
      if (data.success) {
        toast.success(`Sent ${data.sent_count} invite(s)!`);
        setEmailList('');
        setShowEmailForm(false);
      } else {
        toast.error('Failed to send some invites');
      }
    } catch (err) {
      toast.error('Failed to send invites');
    } finally {
      setIsSendingEmails(false);
    }
  };
  
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('host_id', groupData.host_id || groupData.player_id);
      
      const res = await fetch(`${API}/api/game/groups/${groupData.group_id}/upload-questions`, {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      if (data.success) {
        setUploadedQuestions(data.questions);
        toast.success(`Imported ${data.questions_parsed} questions!`);
      } else {
        toast.error(data.detail || 'Failed to parse file');
      }
    } catch (err) {
      toast.error('Failed to upload questions');
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <motion.div
      key="lobby"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Group Header */}
      <div className="text-center">
        <h3 className="text-white font-bold text-xl">{groupData.name}</h3>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Badge className="bg-green-600/20 text-green-400">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Badge>
          {groupData.isHost && (
            <Badge className="bg-yellow-600/20 text-yellow-400">
              <Crown className="w-3 h-3 mr-1" /> Host
            </Badge>
          )}
        </div>
      </div>
      
      {/* Passcode Display */}
      {passcode && (
        <Card className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-700/50">
          <CardContent className="py-4 text-center">
            <p className="text-green-400 text-xs uppercase tracking-wider mb-1">Passcode</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-mono font-bold text-white tracking-[0.5em]">
                {passcode}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyPasscode}
                className="text-green-400"
              >
                {copiedPasscode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Share Options */}
      <Card className="bg-zinc-800/50 border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Share2 className="w-4 h-4 text-green-400" />
            Share & Invite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Copy Link */}
          <div className="flex gap-2">
            <Input
              value={inviteLink}
              readOnly
              className="bg-zinc-900 border-zinc-700 text-zinc-400 text-xs flex-1"
            />
            <Button onClick={copyLink} size="sm" className={copied ? 'bg-green-600' : 'bg-zinc-700'}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          
          {/* Social Share Buttons - Row 1: Main Social */}
          <div className="flex gap-2 justify-center flex-wrap">
            <Button size="sm" variant="outline" onClick={() => shareToSocial('facebook')} 
              className="border-blue-600/50 text-blue-400 hover:bg-blue-600/20" title="Share on Facebook">
              <Facebook className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => shareToSocial('twitter')}
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-700" title="Share on X/Twitter">
              <Twitter className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => shareToSocial('instagram')}
              className="border-pink-600/50 text-pink-400 hover:bg-pink-600/20" title="Copy for Instagram">
              <Instagram className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => shareToSocial('tiktok')}
              className="border-zinc-400/50 text-zinc-200 hover:bg-zinc-700" title="Copy for TikTok">
              <TikTokIcon className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => shareToSocial('youtube')}
              className="border-red-600/50 text-red-400 hover:bg-red-600/20" title="Copy for YouTube">
              <Youtube className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Social Share Buttons - Row 2: Direct Messaging */}
          <div className="flex gap-2 justify-center">
            <Button size="sm" onClick={() => shareToSocial('whatsapp')}
              className="bg-green-600 hover:bg-green-500 text-white flex-1" title="Share on WhatsApp">
              <WhatsAppIcon className="w-4 h-4 mr-1" />
              WhatsApp
            </Button>
            <Button size="sm" onClick={() => shareToSocial('telegram')}
              className="bg-blue-500 hover:bg-blue-400 text-white flex-1" title="Share on Telegram">
              <TelegramIcon className="w-4 h-4 mr-1" />
              Telegram
            </Button>
          </div>
          
          {/* QR Code */}
          <div className="pt-3 border-t border-zinc-700">
            <p className="text-zinc-400 text-xs text-center mb-2 flex items-center justify-center gap-1">
              <QrCode className="w-3 h-3" /> Scan to Join
            </p>
            <div className="flex flex-col items-center gap-2">
              <div className="bg-white p-2 rounded-lg">
                <QRCodeSVG 
                  id="group-qr-code"
                  value={inviteLink}
                  size={120}
                  level="M"
                  includeMargin={false}
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={downloadQRCode}
                className="text-zinc-400 hover:text-white text-xs"
              >
                <QrCode className="w-3 h-3 mr-1" /> Download QR
              </Button>
            </div>
          </div>
          
          {/* Email Invite Form */}
          <div className="pt-3 border-t border-zinc-700">
            {!showEmailForm ? (
              <Button
                onClick={() => setShowEmailForm(true)}
                variant="outline"
                size="sm"
                className="w-full border-zinc-600 text-zinc-300 hover:border-green-500"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Email Invites
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-zinc-400 text-xs">Enter email addresses (comma or newline separated):</p>
                <textarea
                  placeholder="friend1@email.com, friend2@email.com"
                  value={emailList}
                  onChange={(e) => setEmailList(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md p-2 text-white text-sm h-16 resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowEmailForm(false)}
                    className="flex-1 text-zinc-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={sendEmailInvites}
                    disabled={isSendingEmails || !emailList.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-500"
                  >
                    {isSendingEmails ? 'Sending...' : 'Send Invites'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Upload Questions (Host only) */}
      {groupData.isHost && (
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-400" />
              Your Questions
            </CardTitle>
            <CardDescription className="text-zinc-500 text-xs">
              Import from PowerPoint, Word, or Excel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              ref={fileInputRef}
              accept=".pptx,.ppt,.docx,.doc,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {uploadedQuestions.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className="bg-purple-600/20 text-purple-400">
                    <FileText className="w-3 h-3 mr-1" />
                    {uploadedQuestions.length} questions ready
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-zinc-400"
                  >
                    Replace
                  </Button>
                </div>
                <p className="text-zinc-500 text-xs">
                  Questions will be shown when you start playing
                </p>
              </div>
            ) : (
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                variant="outline"
                className="w-full border-dashed border-zinc-600 text-zinc-400 hover:border-purple-500 hover:text-purple-400"
              >
                {isUploading ? (
                  'Uploading...'
                ) : (
                  <>
                    <Presentation className="w-4 h-4 mr-2" />
                    Upload Questions
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Members List */}
      <Card className="bg-zinc-800/50 border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Players
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {members.map((member, idx) => (
              <div key={member.player_id || idx} className="flex items-center gap-2 py-1">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                  {member.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-white text-sm flex-1">{member.name}</span>
                {member.is_host && <Crown className="w-4 h-4 text-yellow-400" />}
                {member.is_co_host && <Badge className="bg-blue-600/20 text-blue-400 text-xs">Co-host</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Game History (if exists) */}
      {gameHistory.length > 0 && (
        <Card className="bg-zinc-800/50 border-zinc-700">
          <CardHeader className="pb-2">
            <CardTitle 
              className="text-white text-sm flex items-center gap-2 cursor-pointer"
              onClick={() => setShowGameHistory(!showGameHistory)}
            >
              <Trophy className="w-4 h-4 text-yellow-400" />
              Game History
              <Badge className="bg-zinc-700 text-zinc-300 text-xs ml-auto">
                {gameHistory.length} games
              </Badge>
            </CardTitle>
          </CardHeader>
          {showGameHistory && (
            <CardContent>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {gameHistory.map((game, idx) => (
                  <div key={game.game_id || idx} className="flex items-center justify-between py-2 border-b border-zinc-700/50 last:border-0">
                    <div>
                      <p className="text-white text-sm">Game #{gameHistory.length - idx}</p>
                      <p className="text-zinc-500 text-xs">
                        {game.questions_played} questions • {game.player_count} players
                      </p>
                    </div>
                    {game.winner && (
                      <div className="text-right">
                        <p className="text-yellow-400 text-sm flex items-center gap-1">
                          <Crown className="w-3 h-3" /> {game.winner.player_name}
                        </p>
                        <p className="text-zinc-500 text-xs">{game.winner.score} pts</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
      
      {/* Follow Us on Social - Prompt */}
      <Card className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-700/50">
        <CardContent className="py-3">
          <p className="text-white text-sm text-center mb-2">
            Follow us for updates & new games!
          </p>
          <div className="flex gap-2 justify-center">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                window.open('https://twitter.com/ztvlive', '_blank');
                fetch(`${API}/api/players/follow-social?platform=twitter`, { method: 'POST' });
              }}
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-700"
            >
              <Twitter className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                window.open('https://instagram.com/ztvlive', '_blank');
                fetch(`${API}/api/players/follow-social?platform=instagram`, { method: 'POST' });
              }}
              className="border-pink-600/50 text-pink-400 hover:bg-pink-600/20"
            >
              <Instagram className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                window.open('https://tiktok.com/@ztvlive', '_blank');
                fetch(`${API}/api/players/follow-social?platform=tiktok`, { method: 'POST' });
              }}
              className="border-zinc-400/50 text-zinc-200 hover:bg-zinc-700"
            >
              <TikTokIcon className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                window.open('https://youtube.com/@ztvlive', '_blank');
                fetch(`${API}/api/players/follow-social?platform=youtube`, { method: 'POST' });
              }}
              className="border-red-600/50 text-red-400 hover:bg-red-600/20"
            >
              <Youtube className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Action Buttons */}
      <div className="space-y-2 pt-2">
        <Button
          onClick={onStartPlaying}
          className="w-full bg-green-600 hover:bg-green-500 text-white py-5 text-lg"
          data-testid="start-playing-btn"
        >
          <Zap className="w-5 h-5 mr-2" />
          Start Playing!
        </Button>
        
        <Button onClick={onLeave} variant="ghost" className="w-full text-zinc-400 hover:text-red-400">
          <LogOut className="w-4 h-4 mr-2" />
          Leave Group
        </Button>
      </div>
    </motion.div>
  );
}

/**
 * GroupLeaderboard - Dual leaderboard showing Group Top 4 + Global Top 4
 */
export function GroupLeaderboard({ groupId, globalLeaderboard = [], className = "" }) {
  const [groupLeaderboard, setGroupLeaderboard] = useState([]);
  const [liveAnswers, setLiveAnswers] = useState([]);
  const ws = useRef(null);
  
  useEffect(() => {
    if (!groupId) return;
    
    fetchLeaderboard();
    connectWebSocket();
    
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [groupId]);
  
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API}/api/game/groups/${groupId}/leaderboard`);
      const data = await res.json();
      setGroupLeaderboard(data.leaderboard || []);
      setLiveAnswers(data.live_answers || []);
    } catch (err) {
      console.error('Failed to fetch leaderboard');
    }
  };
  
  const connectWebSocket = () => {
    const playerId = localStorage.getItem('ztvlive_group_player_id') || localStorage.getItem('ztvlive_group_host_id');
    const wsUrl = `${API.replace('http', 'ws')}/api/game/groups/${groupId}/ws?player_id=${playerId}`;
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.leaderboard) setGroupLeaderboard(data.leaderboard);
      if (data.live_answers) setLiveAnswers(data.live_answers);
    };
  };
  
  const getRankEmoji = (rank) => ['🥇', '🥈', '🥉', '4️⃣'][rank - 1] || `#${rank}`;
  
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {/* Group Top 4 */}
      <Card className="bg-green-900/20 border-green-700/50">
        <CardHeader className="pb-1 px-3 pt-3">
          <CardTitle className="text-white text-xs flex items-center gap-1">
            <Trophy className="w-3 h-3 text-green-400" />
            Your Group
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {groupLeaderboard.length > 0 ? (
            <div className="space-y-1">
              {groupLeaderboard.map((p) => (
                <div key={p.player_id} className="flex items-center gap-1 text-xs">
                  <span>{getRankEmoji(p.rank)}</span>
                  <span className="text-white truncate flex-1">{p.player_name}</span>
                  <span className="text-green-400 font-bold">{p.score}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-xs">No scores yet</p>
          )}
        </CardContent>
      </Card>
      
      {/* Global Top 4 */}
      <Card className="bg-zinc-800/50 border-zinc-700">
        <CardHeader className="pb-1 px-3 pt-3">
          <CardTitle className="text-white text-xs flex items-center gap-1">
            <Trophy className="w-3 h-3 text-yellow-400" />
            Global
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {globalLeaderboard.length > 0 ? (
            <div className="space-y-1">
              {globalLeaderboard.slice(0, 4).map((p, i) => (
                <div key={i} className="flex items-center gap-1 text-xs">
                  <span>{getRankEmoji(i + 1)}</span>
                  <span className="text-white truncate flex-1">{p.name || p.player_name}</span>
                  <span className="text-yellow-400 font-bold">{p.score}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-xs">Loading...</p>
          )}
        </CardContent>
      </Card>
      
      {/* Live Answers */}
      {liveAnswers.length > 0 && (
        <Card className="col-span-2 bg-blue-900/20 border-blue-700/50">
          <CardContent className="py-2 px-3">
            <p className="text-blue-400 text-xs mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Friends' Answers
            </p>
            <div className="flex flex-wrap gap-1">
              {liveAnswers.map((a, i) => (
                <Badge key={i} className="bg-blue-600/20 text-blue-300 text-xs">
                  {a.player_name}: {a.answer}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * HostControls - Game control panel for host/co-hosts
 */
export function HostControls({ groupId, isHost, onGameControl }) {
  const [gameStatus, setGameStatus] = useState('lobby');
  const [questionIndex, setQuestionIndex] = useState(-1);
  
  const sendControl = async (action) => {
    const controllerId = localStorage.getItem('ztvlive_group_host_id') || localStorage.getItem('ztvlive_group_player_id');
    
    try {
      const res = await fetch(`${API}/api/game/groups/${groupId}/game-control?controller_id=${controllerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const data = await res.json();
      if (data.game_status) setGameStatus(data.game_status);
      if (data.question_index !== undefined) setQuestionIndex(data.question_index);
      onGameControl?.(data);
    } catch (err) {
      toast.error('Control failed');
    }
  };
  
  if (!isHost) return null;
  
  return (
    <Card className="bg-zinc-800/80 border-zinc-700">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-zinc-400 text-xs">Host Controls</span>
          <div className="flex gap-2">
            {gameStatus === 'lobby' && (
              <Button size="sm" onClick={() => sendControl('start')} className="bg-green-600 hover:bg-green-500">
                <Play className="w-4 h-4 mr-1" /> Start
              </Button>
            )}
            {gameStatus === 'playing' && (
              <>
                <Button size="sm" onClick={() => sendControl('pause')} variant="outline">
                  <Pause className="w-4 h-4" />
                </Button>
                <Button size="sm" onClick={() => sendControl('next')} className="bg-blue-600 hover:bg-blue-500">
                  <SkipForward className="w-4 h-4 mr-1" /> Next
                </Button>
              </>
            )}
            {gameStatus === 'paused' && (
              <Button size="sm" onClick={() => sendControl('resume')} className="bg-green-600 hover:bg-green-500">
                <Play className="w-4 h-4 mr-1" /> Resume
              </Button>
            )}
            <Button size="sm" onClick={() => sendControl('show_results')} variant="outline">
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * JitsiVideoChat - Embedded Jitsi Meet for video chat
 */
export function JitsiVideoChat({ roomName, displayName, isHost, spotlightMember, onSpotlightChange }) {
  const jitsiContainerRef = useRef(null);
  const [jitsiApi, setJitsiApi] = useState(null);
  
  useEffect(() => {
    if (!roomName || !window.JitsiMeetExternalAPI) {
      // Load Jitsi script if not loaded
      if (!window.JitsiMeetExternalAPI) {
        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => initJitsi();
        document.head.appendChild(script);
      }
      return;
    }
    
    initJitsi();
    
    return () => {
      if (jitsiApi) jitsiApi.dispose();
    };
  }, [roomName]);
  
  const initJitsi = () => {
    if (!window.JitsiMeetExternalAPI || !jitsiContainerRef.current) return;
    
    const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
      roomName: roomName,
      parentNode: jitsiContainerRef.current,
      width: '100%',
      height: 300,
      userInfo: { displayName },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
        disableDeepLinking: true
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: ['microphone', 'camera', 'hangup', 'chat', 'fullscreen'],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: '#0a0a0a'
      }
    });
    
    setJitsiApi(api);
  };
  
  return (
    <Card className="bg-zinc-900 border-zinc-700 overflow-hidden">
      <div ref={jitsiContainerRef} className="w-full" style={{ minHeight: 300 }} />
      {isHost && (
        <CardContent className="py-2 border-t border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400 text-xs">Presenter Mode</span>
            <Button size="sm" variant="outline" onClick={() => onSpotlightChange?.('host')}>
              <Eye className="w-3 h-3 mr-1" /> Spotlight Me
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
