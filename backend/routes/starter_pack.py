"""
ZTVLIVE New Player Starter Pack - Hybrid Trigger System
Rewards are queued on signup via invite, dispatched on first power-poll interaction.

Flow:
1. Signup via invite → Queue reward (status: PENDING_ACTIVATION)
2. First power-poll → Dispatch rewards via SendGrid → Update status to DISPATCHED
3. Increment leaderboard score for first-time engagement
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid
import os

router = APIRouter(prefix="/starter-pack", tags=["Starter Pack"])

# ============ REWARD CONSTANTS ============
REWARD_DDASH_5_USD = "REWARD_DDASH_5_USD"
REWARD_ZTV_3M_PRO = "REWARD_ZTV_3M_PRO"

# SendGrid template for welcome bonus
SENDGRID_TEMPLATE_ID = "d-ztv-welcome-bonus-v1"

# Referral bonus points for leaderboard
REFERRAL_BONUS_POINTS = 25

class RewardStatus(str, Enum):
    PENDING_ACTIVATION = "PENDING_ACTIVATION"
    DISPATCHED = "DISPATCHED"
    FAILED = "FAILED"

class QueueRewardRequest(BaseModel):
    user_id: str
    user_email: str
    referred_by: Optional[str] = None  # Creator's invite token/ID
    invite_token: Optional[str] = None

class PowerPollRequest(BaseModel):
    user_id: str
    poll_id: str
    choice: str
    username: Optional[str] = None

class RewardDispatchResponse(BaseModel):
    success: bool
    rewards_dispatched: List[str]
    message: str


# ============ QUEUE REWARDS ON SIGNUP ============
@router.post("/queue-rewards")
async def queue_starter_pack_rewards(request: QueueRewardRequest):
    """Queue the New Player Starter Pack rewards for a user who signed up via invite"""
    from server import db
    
    # Check if user already has pending/dispatched rewards
    existing = await db.user_rewards.find_one({"user_id": request.user_id})
    if existing:
        return {
            "success": False,
            "message": "User already has rewards queued or dispatched",
            "status": existing.get("status")
        }
    
    now = datetime.now(timezone.utc)
    
    # Create reward record with PENDING status
    reward_record = {
        "reward_id": str(uuid.uuid4()),
        "user_id": request.user_id,
        "user_email": request.user_email,
        "rewards": [REWARD_DDASH_5_USD, REWARD_ZTV_3M_PRO],
        "status": RewardStatus.PENDING_ACTIVATION.value,
        "referred_by": request.referred_by,
        "invite_token": request.invite_token,
        "queued_at": now,
        "activated_at": None,
        "dispatched_at": None,
        "transaction_id": None,
        "first_poll_id": None
    }
    
    await db.user_rewards.insert_one(reward_record)
    
    return {
        "success": True,
        "message": "Starter Pack queued! Complete your first poll to unlock rewards.",
        "reward_id": reward_record["reward_id"],
        "rewards_pending": [REWARD_DDASH_5_USD, REWARD_ZTV_3M_PRO]
    }


# ============ POWER POLL - TRIGGERS REWARD DISPATCH ============
@router.post("/power-poll")
async def power_poll_interaction(request: PowerPollRequest):
    """
    Handle power poll interaction.
    If this is the user's first poll and they have PENDING_ACTIVATION rewards,
    dispatch the rewards immediately.
    """
    from server import db
    
    now = datetime.now(timezone.utc)
    user_id = request.user_id
    
    # Record the poll interaction
    poll_record = {
        "poll_id": request.poll_id,
        "user_id": user_id,
        "choice": request.choice,
        "timestamp": now
    }
    await db.power_polls.insert_one(poll_record)
    
    # Check if user has pending rewards
    pending_reward = await db.user_rewards.find_one({
        "user_id": user_id,
        "status": RewardStatus.PENDING_ACTIVATION.value
    })
    
    rewards_dispatched = []
    leaderboard_bonus = 0
    
    if pending_reward:
        # This is their first interaction - DISPATCH REWARDS!
        try:
            # Generate reward codes
            doordash_code = f"ZTV-DASH-5-{uuid.uuid4().hex[:8].upper()}"
            pro_pass_code = f"ZTV-PRO-3M-{uuid.uuid4().hex[:8].upper()}"
            
            # Send email via SendGrid
            email_sent = await send_reward_email(
                to_email=pending_reward.get("user_email"),
                doordash_code=doordash_code,
                pro_pass_code=pro_pass_code,
                username=request.username or "ZTV Fan"
            )
            
            if email_sent:
                # Update reward status to DISPATCHED
                await db.user_rewards.update_one(
                    {"user_id": user_id, "status": RewardStatus.PENDING_ACTIVATION.value},
                    {"$set": {
                        "status": RewardStatus.DISPATCHED.value,
                        "activated_at": now,
                        "dispatched_at": now,
                        "first_poll_id": request.poll_id,
                        "transaction_id": f"TXN-{uuid.uuid4().hex[:12].upper()}",
                        "reward_codes": {
                            "doordash": doordash_code,
                            "pro_pass": pro_pass_code
                        }
                    }}
                )
                
                rewards_dispatched = [REWARD_DDASH_5_USD, REWARD_ZTV_3M_PRO]
                leaderboard_bonus = REFERRAL_BONUS_POINTS
                
                # Update leaderboard with first-time engagement bonus
                await update_leaderboard_bonus(user_id, request.username, leaderboard_bonus)
                
            else:
                # Mark as failed
                await db.user_rewards.update_one(
                    {"user_id": user_id},
                    {"$set": {"status": RewardStatus.FAILED.value}}
                )
                
        except Exception as e:
            print(f"Reward dispatch error: {e}")
            await db.user_rewards.update_one(
                {"user_id": user_id},
                {"$set": {"status": RewardStatus.FAILED.value, "error": str(e)}}
            )
    
    return {
        "success": True,
        "poll_recorded": True,
        "rewards_dispatched": rewards_dispatched,
        "leaderboard_bonus": leaderboard_bonus,
        "message": "Your $5 DoorDash coupon & 3-month Pro Pass have been sent to your email!" if rewards_dispatched else "Poll recorded!",
        "is_first_interaction": len(rewards_dispatched) > 0
    }


# ============ EMAIL DISPATCH VIA SENDGRID ============
async def send_reward_email(to_email: str, doordash_code: str, pro_pass_code: str, username: str) -> bool:
    """Send the welcome bonus email via SendGrid"""
    try:
        import httpx
        
        sendgrid_key = os.environ.get("SENDGRID_API_KEY")
        if not sendgrid_key:
            print("SendGrid API key not found")
            return False
        
        # Build email content (plain HTML, no dynamic template)
        email_data = {
            "personalizations": [{
                "to": [{"email": to_email}]
            }],
            "from": {
                "email": "admin@ztvlivestream.com",
                "name": "ZTVLIVE Rewards"
            },
            "subject": f"{username}, Your $5 DoorDash + Pro Pass Are Here!",
            "content": [{
                "type": "text/html",
                "value": f"""
                <html>
                <body style="font-family: Arial, sans-serif; background: #0a0a0a; color: #fff; padding: 20px;">
                    <div style="max-width: 600px; margin: 0 auto; background: #18181b; border-radius: 16px; padding: 32px;">
                        <h1 style="color: #facc15; margin-bottom: 8px;">🎊 Welcome to ZTVLIVE, {username}!</h1>
                        <p style="color: #a1a1aa;">Thanks for joining the fun! Here's your New Player Starter Pack:</p>
                        
                        <div style="background: #27272a; border-radius: 12px; padding: 20px; margin: 20px 0;">
                            <h3 style="color: #22c55e; margin: 0 0 8px 0;">🍕 $5 DoorDash Credit</h3>
                            <p style="color: #fff; font-size: 24px; font-family: monospace; background: #3f3f46; padding: 12px; border-radius: 8px; margin: 0;">
                                {doordash_code}
                            </p>
                            <p style="color: #71717a; font-size: 12px; margin-top: 8px;">Valid on orders $15+ in US, CA, AU, JP</p>
                        </div>
                        
                        <div style="background: #27272a; border-radius: 12px; padding: 20px; margin: 20px 0;">
                            <h3 style="color: #a855f7; margin: 0 0 8px 0;">⭐ 3-Month ZTVLIVE Pro Pass</h3>
                            <p style="color: #fff; font-size: 24px; font-family: monospace; background: #3f3f46; padding: 12px; border-radius: 8px; margin: 0;">
                                {pro_pass_code}
                            </p>
                            <p style="color: #71717a; font-size: 12px; margin-top: 8px;">Ad-free viewing, exclusive content, priority chat</p>
                        </div>
                        
                        <p style="color: #a1a1aa; text-align: center; margin-top: 24px;">
                            Keep playing trivia to climb the leaderboard and win more rewards! 🏆
                        </p>
                        
                        <div style="text-align: center; margin-top: 24px;">
                            <a href="https://ztvlivestream.com/watch" style="background: #facc15; color: #000; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: bold;">
                                Watch Live Now →
                            </a>
                        </div>
                    </div>
                </body>
                </html>
                """
            }]
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {sendgrid_key}",
                    "Content-Type": "application/json"
                },
                json=email_data
            )
            
            if response.status_code in [200, 202]:
                print(f"✅ Reward email sent to {to_email}")
                return True
            else:
                print(f"❌ SendGrid error: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        print(f"Email send error: {e}")
        return False


# ============ LEADERBOARD BONUS ============
async def update_leaderboard_bonus(user_id: str, username: str, bonus_points: int):
    """Add referral bonus points to leaderboard"""
    try:
        import httpx
        
        api_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
        
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{api_url}/api/game-analytics/leaderboard/score",
                json={
                    "player_id": user_id,
                    "username": username or f"Player_{user_id[:6]}",
                    "score": bonus_points,
                    "correct_answers": 0,
                    "creator_slug": "referral_bonus"
                }
            )
            print(f"✅ Leaderboard bonus +{bonus_points} for {user_id}")
    except Exception as e:
        print(f"Leaderboard bonus error: {e}")


# ============ CHECK REWARD STATUS ============
@router.get("/status/{user_id}")
async def get_reward_status(user_id: str):
    """Check the reward status for a user"""
    from server import db
    
    reward = await db.user_rewards.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not reward:
        return {
            "has_rewards": False,
            "status": None,
            "message": "No rewards found for this user"
        }
    
    return {
        "has_rewards": True,
        "status": reward.get("status"),
        "rewards": reward.get("rewards"),
        "queued_at": reward.get("queued_at"),
        "dispatched_at": reward.get("dispatched_at"),
        "reward_codes": reward.get("reward_codes") if reward.get("status") == "DISPATCHED" else None,
        "message": "Complete your first poll to unlock!" if reward.get("status") == "PENDING_ACTIVATION" else "Rewards sent to your email!"
    }


# ============ ADMIN: VIEW ALL PENDING REWARDS ============
@router.get("/admin/pending")
async def get_pending_rewards():
    """Admin endpoint to view all pending rewards"""
    from server import db
    
    pending = await db.user_rewards.find(
        {"status": RewardStatus.PENDING_ACTIVATION.value},
        {"_id": 0}
    ).to_list(100)
    
    dispatched = await db.user_rewards.find(
        {"status": RewardStatus.DISPATCHED.value},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "pending_count": len(pending),
        "dispatched_count": len(dispatched),
        "pending_rewards": pending,
        "recent_dispatched": dispatched[-10:] if dispatched else []
    }
