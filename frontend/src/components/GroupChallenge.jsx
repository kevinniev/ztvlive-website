import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Crown, 
  Copy, 
  Check, 
  X, 
  Mail, 
  Send,
  Trophy,
  Zap,
  Link2,
  Trash2,
  LogOut,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';

/**
 * GroupChallenge - Private group game mode for ZTVLIVE
 * Allows players to create groups, invite friends, and compete on a private leaderboard
 */
export default function GroupChallenge({ 
  onClose, 
  onJoinGroup,
  currentPlayerId,
  currentPlayerName 
}) {
  const [mode, setMode] = useState('menu'); // menu, create, join, lobby
  const [groupData, setGroupData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Create group form
  const [groupName, setGroupName] = useState('');
  const [hostName, setHostName] = useState(currentPlayerName || '');
  const [hostEmail, setHostEmail] = useState('');
  const [isPermanent, setIsPermanent] = useState(false);
  
  // Join group form
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState(currentPlayerName || '');
  
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
          is_permanent: isPermanent
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setGroupData({
          ...data,
          name: groupName,
          isHost: true
        });
        // Store host info
        localStorage.setItem('ztvlive_group_host_id', data.host_id);
        localStorage.setItem('ztvlive_group_id', data.group_id);
        setMode('lobby');
        toast.success('Group created! Share the invite link with friends.');
      } else {
        toast.error(data.message || 'Failed to create group');
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
      // Extract group ID from code or link
      let groupId = joinCode;
      if (joinCode.includes('group=')) {
        const match = joinCode.match(/group=([^&]+)/);
        if (match) groupId = match[1];
      }
      
      const res = await fetch(`${API}/api/game/groups/${groupId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setGroupData({
          group_id: groupId,
          player_id: data.player_id,
          name: data.group_name,
          isHost: false
        });
        localStorage.setItem('ztvlive_group_player_id', data.player_id);
        localStorage.setItem('ztvlive_group_id', groupId);
        setMode('lobby');
        toast.success(`Welcome to ${data.group_name}!`);
      } else {
        toast.error(data.message || 'Failed to join group');
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
        {/* Header */}
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
            {/* Main Menu */}
            {mode === 'menu' && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-zinc-400 text-sm text-center mb-6">
                  Challenge your friends! Create a private group and compete together on your own leaderboard.
                </p>
                
                <Button
                  onClick={() => setMode('create')}
                  className="w-full bg-green-600 hover:bg-green-500 text-white py-6 text-lg"
                  data-testid="create-group-btn"
                >
                  <Crown className="w-5 h-5 mr-2" />
                  Create New Group
                </Button>
                
                <Button
                  onClick={() => setMode('join')}
                  variant="outline"
                  className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800 py-6 text-lg"
                  data-testid="join-group-btn"
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  Join Existing Group
                </Button>
                
                <div className="pt-4 border-t border-zinc-800">
                  <p className="text-zinc-500 text-xs text-center">
                    No account required • Invite via email • See friends' answers live
                  </p>
                </div>
              </motion.div>
            )}
            
            {/* Create Group Form */}
            {mode === 'create' && (
              <motion.div
                key="create"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <button 
                  onClick={() => setMode('menu')}
                  className="text-zinc-400 hover:text-white text-sm flex items-center gap-1"
                >
                  ← Back
                </button>
                
                <h3 className="text-white font-semibold text-lg">Create Your Group</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-zinc-400 text-sm block mb-1">Group Name *</label>
                    <Input
                      placeholder="e.g., The Trivia Squad"
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
                      placeholder="For game notifications"
                      value={hostEmail}
                      onChange={(e) => setHostEmail(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="permanent"
                      checked={isPermanent}
                      onChange={(e) => setIsPermanent(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-700"
                    />
                    <label htmlFor="permanent" className="text-zinc-400 text-sm">
                      Make group permanent (reusable for future games)
                    </label>
                  </div>
                </div>
                
                <Button
                  onClick={createGroup}
                  disabled={isLoading || !groupName.trim() || !hostName.trim()}
                  className="w-full bg-green-600 hover:bg-green-500 text-white py-5"
                  data-testid="submit-create-group"
                >
                  {isLoading ? 'Creating...' : 'Create Group'}
                </Button>
              </motion.div>
            )}
            
            {/* Join Group Form */}
            {mode === 'join' && (
              <motion.div
                key="join"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <button 
                  onClick={() => setMode('menu')}
                  className="text-zinc-400 hover:text-white text-sm flex items-center gap-1"
                >
                  ← Back
                </button>
                
                <h3 className="text-white font-semibold text-lg">Join a Group</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-zinc-400 text-sm block mb-1">Group Code or Invite Link *</label>
                    <Input
                      placeholder="Enter code or paste link"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white"
                      data-testid="join-code-input"
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
                  onClick={joinGroup}
                  disabled={isLoading || !joinCode.trim() || !playerName.trim()}
                  className="w-full bg-green-600 hover:bg-green-500 text-white py-5"
                  data-testid="submit-join-group"
                >
                  {isLoading ? 'Joining...' : 'Join Group'}
                </Button>
              </motion.div>
            )}
            
            {/* Group Lobby */}
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

/**
 * GroupLobby - Shows group members, invite options, and leaderboard
 */
function GroupLobby({ groupData, onStartPlaying, onLeave }) {
  const [members, setMembers] = useState([]);
  const [inviteEmails, setInviteEmails] = useState('');
  const [copied, setCopied] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const ws = useRef(null);
  
  const inviteLink = groupData.invite_link || 
    `${window.location.origin}/play?group=${groupData.group_id}`;
  
  useEffect(() => {
    // Connect to WebSocket for real-time updates
    const playerId = groupData.host_id || groupData.player_id || 
      localStorage.getItem('ztvlive_group_player_id');
    
    if (playerId && groupData.group_id) {
      const wsUrl = `${API.replace('http', 'ws')}/api/game/groups/${groupData.group_id}/ws?player_id=${playerId}`;
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected' || data.type === 'member_joined' || data.type === 'member_left') {
          fetchMembers();
        }
      };
      
      ws.current.onerror = () => {
        console.log('WebSocket error - falling back to polling');
      };
    }
    
    fetchMembers();
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [groupData.group_id]);
  
  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API}/api/game/groups/${groupData.group_id}`);
      const data = await res.json();
      if (data.members) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to fetch members');
    }
  };
  
  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success('Invite link copied!');
    setTimeout(() => setCopied(false), 2000);
  };
  
  const sendInvites = async () => {
    const emails = inviteEmails.split(/[,\n]/).map(e => e.trim()).filter(e => e);
    if (emails.length === 0) {
      toast.error('Please enter at least one email');
      return;
    }
    
    setIsInviting(true);
    try {
      const res = await fetch(
        `${API}/api/game/groups/${groupData.group_id}/invite?host_id=${groupData.host_id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emails })
        }
      );
      
      const data = await res.json();
      if (data.success) {
        toast.success(`Sent ${data.sent_count} invite(s)!`);
        setInviteEmails('');
        setShowInviteForm(false);
      } else {
        toast.error(data.message || 'Failed to send invites');
      }
    } catch (err) {
      toast.error('Failed to send invites');
    } finally {
      setIsInviting(false);
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
        <Badge className="bg-green-600/20 text-green-400 mt-1">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </Badge>
        {groupData.isHost && (
          <Badge className="bg-yellow-600/20 text-yellow-400 ml-2">
            <Crown className="w-3 h-3 mr-1" />
            Host
          </Badge>
        )}
      </div>
      
      {/* Invite Section */}
      <Card className="bg-zinc-800/50 border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-green-400" />
            Invite Friends
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
            <Button
              onClick={copyLink}
              size="sm"
              className={copied ? 'bg-green-600' : 'bg-zinc-700'}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          
          {/* Email Invites (Host only) */}
          {groupData.isHost && (
            <>
              {!showInviteForm ? (
                <Button
                  onClick={() => setShowInviteForm(true)}
                  variant="outline"
                  size="sm"
                  className="w-full border-zinc-700 text-zinc-300"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Email Invites
                </Button>
              ) : (
                <div className="space-y-2">
                  <textarea
                    placeholder="Enter email addresses (comma or newline separated)"
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-md p-2 text-white text-sm h-20 resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowInviteForm(false)}
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={sendInvites}
                      disabled={isInviting}
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-500"
                    >
                      {isInviting ? 'Sending...' : 'Send Invites'}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Members List */}
      <Card className="bg-zinc-800/50 border-zinc-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Group Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {members.map((member, idx) => (
              <div 
                key={member.player_id || idx}
                className="flex items-center justify-between py-2 border-b border-zinc-700/50 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                    {member.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      {member.name}
                      {member.is_host && (
                        <Crown className="w-3 h-3 text-yellow-400 inline ml-1" />
                      )}
                    </p>
                    <p className="text-zinc-500 text-xs">
                      Score: {member.score || 0}
                    </p>
                  </div>
                </div>
                {member.is_guest && (
                  <Badge variant="outline" className="text-zinc-500 border-zinc-600 text-xs">
                    Guest
                  </Badge>
                )}
              </div>
            ))}
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
          Start Playing Together!
        </Button>
        
        <Button
          onClick={onLeave}
          variant="ghost"
          className="w-full text-zinc-400 hover:text-red-400"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Leave Group
        </Button>
      </div>
    </motion.div>
  );
}

/**
 * GroupLeaderboard - Shows top 4 players in the group (displayed alongside global leaderboard)
 */
export function GroupLeaderboard({ groupId, className = "" }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [liveAnswers, setLiveAnswers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const ws = useRef(null);
  
  useEffect(() => {
    if (!groupId) return;
    
    const playerId = localStorage.getItem('ztvlive_group_player_id') || 
      localStorage.getItem('ztvlive_group_host_id');
    
    // Connect WebSocket
    const wsUrl = `${API.replace('http', 'ws')}/api/game/groups/${groupId}/ws?player_id=${playerId}`;
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
      if (data.live_answers) {
        setLiveAnswers(data.live_answers);
      }
      if (data.type === 'leaderboard_update') {
        setLeaderboard(data.leaderboard);
      }
      if (data.type === 'member_answered') {
        setLiveAnswers(data.live_answers || []);
      }
    };
    
    // Initial fetch
    fetchLeaderboard();
    
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [groupId]);
  
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API}/api/game/groups/${groupId}/leaderboard`);
      const data = await res.json();
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      if (data.group_name) setGroupName(data.group_name);
      if (data.live_answers) setLiveAnswers(data.live_answers);
    } catch (err) {
      console.error('Failed to fetch group leaderboard');
    }
  };
  
  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return 'from-yellow-500 to-amber-600';
      case 2: return 'from-gray-400 to-gray-500';
      case 3: return 'from-amber-600 to-orange-700';
      default: return 'from-zinc-600 to-zinc-700';
    }
  };
  
  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };
  
  return (
    <Card className={`bg-zinc-800/80 border-zinc-700 backdrop-blur-sm ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Trophy className="w-4 h-4 text-green-400" />
          {groupName || 'Group'} Leaderboard
        </CardTitle>
        <CardDescription className="text-zinc-500 text-xs">
          Top 4 in your group
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Top 4 Leaderboard */}
        {leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((player) => (
              <motion.div
                key={player.player_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/50"
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getRankColor(player.rank)} flex items-center justify-center text-white font-bold text-xs`}>
                  {getRankIcon(player.rank)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {player.player_name}
                    {player.is_host && <Crown className="w-3 h-3 text-yellow-400 inline ml-1" />}
                  </p>
                </div>
                <span className="text-green-400 font-bold text-sm">
                  {player.score} pts
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm text-center py-4">
            No scores yet - start answering!
          </p>
        )}
        
        {/* Live Answers Section */}
        {liveAnswers.length > 0 && (
          <div className="pt-3 border-t border-zinc-700">
            <p className="text-zinc-400 text-xs mb-2 flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-400" />
              Live Answers
            </p>
            <div className="space-y-1">
              {liveAnswers.slice(0, 5).map((answer, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400">{answer.player_name}:</span>
                  <Badge className="bg-blue-600/20 text-blue-400 text-xs">
                    {answer.answer}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
