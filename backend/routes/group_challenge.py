"""
ZTVLIVE Private Group Challenge System

This module enables players to:
- Create private groups with friends
- Invite players via email (guest play supported)
- See real-time answers from group members
- Compete on a group-specific leaderboard (Top 4)
- Voice/Video integration ready
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel, EmailStr
from typing import Dict, List, Optional, Set
from datetime import datetime, timezone, timedelta
import asyncio
import random
import uuid
import os
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/game/groups", tags=["Group Challenge"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "ztvlive")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ============== MODELS ==============

class CreateGroupRequest(BaseModel):
    name: str
    host_name: str
    host_email: Optional[str] = None
    is_permanent: bool = False  # True = reusable, False = one-time session
    max_members: int = 50

class InviteMembersRequest(BaseModel):
    emails: List[EmailStr]
    custom_message: Optional[str] = None

class JoinGroupRequest(BaseModel):
    player_name: str
    player_email: Optional[str] = None

class SubmitAnswerRequest(BaseModel):
    player_id: str
    answer: str
    question_number: int

class KickMemberRequest(BaseModel):
    member_id: str

# ============== IN-MEMORY GROUP STATE ==============

class GroupState:
    """Real-time state for an active group session"""
    def __init__(self, group_id: str):
        self.group_id = group_id
        self.connected_clients: Dict[str, WebSocket] = {}  # player_id -> WebSocket
        self.members: Dict[str, dict] = {}  # player_id -> member data
        self.current_answers: Dict[str, dict] = {}  # player_id -> {answer, timestamp}
        self.scores: Dict[str, int] = {}  # player_id -> total score
        self.question_history: List[dict] = []  # History of answers per question
        
    def add_member(self, player_id: str, member_data: dict):
        self.members[player_id] = member_data
        self.scores[player_id] = member_data.get("score", 0)
        
    def remove_member(self, player_id: str):
        self.members.pop(player_id, None)
        self.scores.pop(player_id, None)
        self.current_answers.pop(player_id, None)
        if player_id in self.connected_clients:
            del self.connected_clients[player_id]
            
    def record_answer(self, player_id: str, answer: str, question_number: int):
        self.current_answers[player_id] = {
            "answer": answer,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "question_number": question_number,
            "player_name": self.members.get(player_id, {}).get("name", "Anonymous")
        }
        
    def get_group_leaderboard(self) -> List[dict]:
        """Get top 4 players in the group"""
        sorted_scores = sorted(
            [(pid, self.scores.get(pid, 0)) for pid in self.members.keys()],
            key=lambda x: x[1],
            reverse=True
        )[:4]
        
        return [
            {
                "rank": i + 1,
                "player_id": pid,
                "player_name": self.members.get(pid, {}).get("name", "Anonymous"),
                "score": score,
                "is_host": self.members.get(pid, {}).get("is_host", False)
            }
            for i, (pid, score) in enumerate(sorted_scores)
        ]
        
    def get_live_answers(self) -> List[dict]:
        """Get all current answers (for real-time display)"""
        return [
            {
                "player_id": pid,
                "player_name": data.get("player_name", "Anonymous"),
                "answer": data.get("answer"),
                "timestamp": data.get("timestamp")
            }
            for pid, data in self.current_answers.items()
        ]
        
    def clear_answers_for_new_question(self):
        """Clear answers when a new question starts"""
        # Save to history first
        if self.current_answers:
            self.question_history.append({
                "answers": self.current_answers.copy(),
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        self.current_answers.clear()

# Active group sessions (in-memory)
active_groups: Dict[str, GroupState] = {}

def get_or_create_group_state(group_id: str) -> GroupState:
    if group_id not in active_groups:
        active_groups[group_id] = GroupState(group_id)
    return active_groups[group_id]

# ============== API ENDPOINTS ==============

@router.post("/create")
async def create_group(request: CreateGroupRequest):
    """Create a new private group challenge"""
    group_id = str(uuid.uuid4())[:8].upper()  # Short, shareable code
    invite_code = str(uuid.uuid4())[:12]
    host_id = str(uuid.uuid4())
    
    group_data = {
        "group_id": group_id,
        "invite_code": invite_code,
        "name": request.name,
        "host_id": host_id,
        "host_name": request.host_name,
        "host_email": request.host_email,
        "is_permanent": request.is_permanent,
        "max_members": request.max_members,
        "members": [{
            "player_id": host_id,
            "name": request.host_name,
            "email": request.host_email,
            "is_host": True,
            "joined_at": datetime.now(timezone.utc),
            "score": 0,
            "questions_answered": 0
        }],
        "created_at": datetime.now(timezone.utc),
        "status": "active",
        "total_questions_played": 0,
        "statistics": {
            "total_games": 0,
            "highest_score": 0,
            "most_active_player": None
        }
    }
    
    await db.game_groups.insert_one(group_data)
    
    # Initialize in-memory state
    group_state = get_or_create_group_state(group_id)
    group_state.add_member(host_id, {
        "name": request.host_name,
        "email": request.host_email,
        "is_host": True,
        "score": 0
    })
    
    base_url = os.environ.get('BASE_URL', 'https://www.ztvlivestream.com')
    
    return {
        "success": True,
        "group_id": group_id,
        "invite_code": invite_code,
        "invite_link": f"{base_url}/play?group={group_id}&code={invite_code}",
        "host_id": host_id,
        "message": f"Group '{request.name}' created! Share the invite link with friends."
    }


@router.get("/{group_id}")
async def get_group(group_id: str):
    """Get group details"""
    group = await db.game_groups.find_one(
        {"group_id": group_id},
        {"_id": 0}
    )
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Get live state if available
    group_state = active_groups.get(group_id)
    
    return {
        **group,
        "live_member_count": len(group_state.members) if group_state else 0,
        "leaderboard": group_state.get_group_leaderboard() if group_state else []
    }


@router.post("/{group_id}/join")
async def join_group(group_id: str, request: JoinGroupRequest, invite_code: Optional[str] = None):
    """Join a group as a guest or registered player"""
    group = await db.game_groups.find_one({"group_id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if group.get("status") != "active":
        raise HTTPException(status_code=400, detail="This group is no longer active")
    
    if len(group.get("members", [])) >= group.get("max_members", 50):
        raise HTTPException(status_code=400, detail="Group is full")
    
    # Check if email already in group
    existing = next(
        (m for m in group.get("members", []) if m.get("email") == request.player_email),
        None
    )
    if existing:
        return {
            "success": True,
            "player_id": existing["player_id"],
            "message": "Welcome back! You're already in this group.",
            "group_name": group["name"]
        }
    
    player_id = str(uuid.uuid4())
    
    member_data = {
        "player_id": player_id,
        "name": request.player_name,
        "email": request.player_email,
        "is_host": False,
        "is_guest": request.player_email is None,
        "joined_at": datetime.now(timezone.utc),
        "score": 0,
        "questions_answered": 0
    }
    
    # Add to database
    await db.game_groups.update_one(
        {"group_id": group_id},
        {"$push": {"members": member_data}}
    )
    
    # Add to live state
    group_state = get_or_create_group_state(group_id)
    group_state.add_member(player_id, {
        "name": request.player_name,
        "email": request.player_email,
        "is_host": False,
        "score": 0
    })
    
    # Broadcast join to group
    await broadcast_to_group(group_id, {
        "type": "member_joined",
        "player_id": player_id,
        "player_name": request.player_name,
        "member_count": len(group_state.members)
    })
    
    return {
        "success": True,
        "player_id": player_id,
        "group_name": group["name"],
        "member_count": len(group_state.members),
        "message": f"Welcome to {group['name']}!"
    }


@router.post("/{group_id}/invite")
async def invite_members(group_id: str, request: InviteMembersRequest, host_id: str):
    """Send email invites to join the group (host only)"""
    group = await db.game_groups.find_one({"group_id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if group.get("host_id") != host_id:
        raise HTTPException(status_code=403, detail="Only the host can send invites")
    
    base_url = os.environ.get('BASE_URL', 'https://www.ztvlivestream.com')
    invite_link = f"{base_url}/play?group={group_id}&code={group.get('invite_code')}"
    
    # Import email service
    from services.email_service import send_email
    
    sent_count = 0
    failed_emails = []
    
    for email in request.emails:
        try:
            html_content = get_group_invite_email_html(
                group_name=group["name"],
                host_name=group["host_name"],
                invite_link=invite_link,
                custom_message=request.custom_message
            )
            
            await send_email(
                to_email=email,
                subject=f"🎮 {group['host_name']} invited you to play ZTVLIVE!",
                html_content=html_content
            )
            sent_count += 1
            
            # Log invite
            await db.group_invites.insert_one({
                "group_id": group_id,
                "email": email,
                "sent_at": datetime.now(timezone.utc),
                "status": "sent"
            })
            
        except Exception as e:
            failed_emails.append({"email": email, "error": str(e)})
    
    return {
        "success": True,
        "sent_count": sent_count,
        "failed_emails": failed_emails,
        "invite_link": invite_link,
        "message": f"Sent {sent_count} invites!"
    }


@router.post("/{group_id}/answer")
async def submit_group_answer(group_id: str, request: SubmitAnswerRequest):
    """Submit an answer and broadcast to group in real-time"""
    group_state = active_groups.get(group_id)
    
    if not group_state:
        raise HTTPException(status_code=404, detail="Group session not found")
    
    if request.player_id not in group_state.members:
        raise HTTPException(status_code=403, detail="You're not a member of this group")
    
    # Record the answer
    group_state.record_answer(
        request.player_id,
        request.answer,
        request.question_number
    )
    
    # Broadcast to all group members (real-time answer visibility)
    await broadcast_to_group(group_id, {
        "type": "member_answered",
        "player_id": request.player_id,
        "player_name": group_state.members.get(request.player_id, {}).get("name", "Anonymous"),
        "answer": request.answer,
        "question_number": request.question_number,
        "live_answers": group_state.get_live_answers()
    })
    
    return {"success": True, "recorded": True}


@router.post("/{group_id}/update-score")
async def update_member_score(group_id: str, player_id: str, points: int):
    """Update a player's score after question results"""
    group_state = active_groups.get(group_id)
    
    if not group_state or player_id not in group_state.members:
        return {"success": False}
    
    group_state.scores[player_id] = group_state.scores.get(player_id, 0) + points
    
    # Update database
    await db.game_groups.update_one(
        {"group_id": group_id, "members.player_id": player_id},
        {"$inc": {"members.$.score": points, "members.$.questions_answered": 1}}
    )
    
    # Broadcast updated leaderboard
    await broadcast_to_group(group_id, {
        "type": "leaderboard_update",
        "leaderboard": group_state.get_group_leaderboard()
    })
    
    return {"success": True, "new_score": group_state.scores[player_id]}


@router.get("/{group_id}/leaderboard")
async def get_group_leaderboard(group_id: str):
    """Get the group's top 4 leaderboard"""
    group_state = active_groups.get(group_id)
    
    if not group_state:
        # Try to load from database
        group = await db.game_groups.find_one({"group_id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Build leaderboard from stored data
        members = group.get("members", [])
        sorted_members = sorted(members, key=lambda m: m.get("score", 0), reverse=True)[:4]
        
        return {
            "group_id": group_id,
            "group_name": group["name"],
            "leaderboard": [
                {
                    "rank": i + 1,
                    "player_id": m["player_id"],
                    "player_name": m["name"],
                    "score": m.get("score", 0),
                    "is_host": m.get("is_host", False)
                }
                for i, m in enumerate(sorted_members)
            ]
        }
    
    return {
        "group_id": group_id,
        "leaderboard": group_state.get_group_leaderboard(),
        "live_answers": group_state.get_live_answers()
    }


@router.post("/{group_id}/kick")
async def kick_member(group_id: str, request: KickMemberRequest, host_id: str):
    """Kick a member from the group (host only)"""
    group = await db.game_groups.find_one({"group_id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if group.get("host_id") != host_id:
        raise HTTPException(status_code=403, detail="Only the host can kick members")
    
    if request.member_id == host_id:
        raise HTTPException(status_code=400, detail="You can't kick yourself")
    
    # Remove from database
    await db.game_groups.update_one(
        {"group_id": group_id},
        {"$pull": {"members": {"player_id": request.member_id}}}
    )
    
    # Remove from live state
    group_state = active_groups.get(group_id)
    if group_state:
        member_name = group_state.members.get(request.member_id, {}).get("name", "Unknown")
        group_state.remove_member(request.member_id)
        
        # Notify the kicked player
        if request.member_id in group_state.connected_clients:
            try:
                await group_state.connected_clients[request.member_id].send_json({
                    "type": "kicked",
                    "message": "You have been removed from the group by the host."
                })
            except Exception:
                pass
        
        # Broadcast to remaining members
        await broadcast_to_group(group_id, {
            "type": "member_left",
            "player_id": request.member_id,
            "player_name": member_name,
            "member_count": len(group_state.members)
        })
    
    return {"success": True, "message": "Member removed from group"}


@router.delete("/{group_id}")
async def close_group(group_id: str, host_id: str):
    """Close/delete a group (host only)"""
    group = await db.game_groups.find_one({"group_id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if group.get("host_id") != host_id:
        raise HTTPException(status_code=403, detail="Only the host can close the group")
    
    # Update status
    await db.game_groups.update_one(
        {"group_id": group_id},
        {"$set": {"status": "closed", "closed_at": datetime.now(timezone.utc)}}
    )
    
    # Notify all members
    group_state = active_groups.get(group_id)
    if group_state:
        await broadcast_to_group(group_id, {
            "type": "group_closed",
            "message": "The host has closed this group. Thanks for playing!"
        })
        
        # Disconnect all
        for ws in list(group_state.connected_clients.values()):
            try:
                await ws.close()
            except Exception:
                pass
        
        del active_groups[group_id]
    
    return {"success": True, "message": "Group closed"}


@router.get("/{group_id}/statistics")
async def get_group_statistics(group_id: str):
    """Get group history and statistics"""
    group = await db.game_groups.find_one(
        {"group_id": group_id},
        {"_id": 0}
    )
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    members = group.get("members", [])
    
    # Calculate statistics
    total_score = sum(m.get("score", 0) for m in members)
    total_questions = sum(m.get("questions_answered", 0) for m in members)
    top_player = max(members, key=lambda m: m.get("score", 0)) if members else None
    
    return {
        "group_id": group_id,
        "group_name": group["name"],
        "created_at": group.get("created_at"),
        "is_permanent": group.get("is_permanent", False),
        "total_members": len(members),
        "total_score": total_score,
        "total_questions_answered": total_questions,
        "average_score": round(total_score / len(members), 1) if members else 0,
        "top_player": {
            "name": top_player["name"],
            "score": top_player.get("score", 0)
        } if top_player else None,
        "all_time_leaderboard": sorted(
            [{"name": m["name"], "score": m.get("score", 0)} for m in members],
            key=lambda x: x["score"],
            reverse=True
        )[:10]
    }


# ============== WEBSOCKET FOR REAL-TIME ==============

@router.websocket("/{group_id}/ws")
async def group_websocket(websocket: WebSocket, group_id: str, player_id: str):
    """WebSocket connection for real-time group updates"""
    await websocket.accept()
    
    group_state = get_or_create_group_state(group_id)
    group_state.connected_clients[player_id] = websocket
    
    try:
        # Send current state on connect
        await websocket.send_json({
            "type": "connected",
            "group_id": group_id,
            "leaderboard": group_state.get_group_leaderboard(),
            "live_answers": group_state.get_live_answers(),
            "member_count": len(group_state.members)
        })
        
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "answer":
                group_state.record_answer(
                    player_id,
                    data.get("answer"),
                    data.get("question_number", 0)
                )
                await broadcast_to_group(group_id, {
                    "type": "member_answered",
                    "player_id": player_id,
                    "player_name": group_state.members.get(player_id, {}).get("name"),
                    "answer": data.get("answer"),
                    "live_answers": group_state.get_live_answers()
                })
                
            elif data.get("type") == "new_question":
                group_state.clear_answers_for_new_question()
                
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        if player_id in group_state.connected_clients:
            del group_state.connected_clients[player_id]
        await broadcast_to_group(group_id, {
            "type": "member_disconnected",
            "player_id": player_id,
            "online_count": len(group_state.connected_clients)
        })


async def broadcast_to_group(group_id: str, message: dict):
    """Broadcast a message to all connected group members"""
    group_state = active_groups.get(group_id)
    if not group_state:
        return
    
    disconnected = []
    for player_id, ws in group_state.connected_clients.items():
        try:
            await ws.send_json(message)
        except Exception:
            disconnected.append(player_id)
    
    # Clean up disconnected clients
    for pid in disconnected:
        group_state.connected_clients.pop(pid, None)


# ============== EMAIL TEMPLATE ==============

def get_group_invite_email_html(group_name: str, host_name: str, invite_link: str, custom_message: Optional[str] = None) -> str:
    """Generate HTML email for group invite"""
    custom_section = f"""
        <div style="background-color: #262626; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 3px solid #10b981;">
            <p style="margin: 0; color: #e5e5e5; font-size: 14px; font-style: italic;">
                "{custom_message}"
            </p>
            <p style="margin: 10px 0 0; color: #737373; font-size: 12px;">— {host_name}</p>
        </div>
    """ if custom_message else ""
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #171717; border-radius: 16px; overflow: hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                                <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">🎮 You're Invited to Play!</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="margin: 0 0 20px; color: #e5e5e5; font-size: 18px;">
                                    <strong style="color: #10b981;">{host_name}</strong> wants you to join their private game group!
                                </p>
                                
                                <div style="background-color: #262626; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: center;">
                                    <p style="margin: 0 0 10px; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Group Name</p>
                                    <h2 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">{group_name}</h2>
                                </div>
                                
                                {custom_section}
                                
                                <p style="margin: 0 0 25px; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                                    Compete with friends in ZTVLIVE's 24/7 live trivia game! Answer questions together, 
                                    see each other's answers in real-time, and battle for the top spot on your private leaderboard.
                                </p>
                                
                                <p style="margin: 0 0 25px; color: #a3a3a3; font-size: 14px;">
                                    ✓ No account required - play as a guest<br>
                                    ✓ See your friends' answers live<br>
                                    ✓ Private group leaderboard (Top 4)<br>
                                    ✓ Win bragging rights!
                                </p>
                                
                                <a href="{invite_link}" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 18px;">
                                    Join Game Now →
                                </a>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 20px 30px; background-color: #0a0a0a; border-top: 1px solid #262626;">
                                <p style="margin: 0; color: #525252; font-size: 14px; text-align: center;">
                                    ZTVLIVE • Play. Compete. Win.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
