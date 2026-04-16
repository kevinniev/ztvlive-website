"""
ZTVLIVE UNUSUAL FUN GAME SHOW - CYBER CHAOS
Interactive live polling game with AI host commentary
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone, timedelta
import asyncio
import json
import uuid
import random
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/game-show", tags=["game-show"])

# TTS for AI host voice
try:
    from emergentintegrations.llm.openai import OpenAITextToSpeech
    tts_client = OpenAITextToSpeech(api_key=os.getenv("EMERGENT_LLM_KEY"))
except Exception as e:
    print(f"TTS initialization warning: {e}")
    tts_client = None

# In-memory storage for active games (in production, use Redis)
active_games: Dict[str, dict] = {}
game_connections: Dict[str, List[WebSocket]] = {}

# AI Simulated Players - Diverse names pool
AI_PLAYER_NAMES = [
    # American names
    "Mike_T", "Sarah_J", "Chris_R", "Emily_K", "Jake_D", "Ava_M", "Brandon_L", "Jessica_P",
    "Tyler_S", "Megan_H", "Austin_B", "Brittany_G", "Kyle_W", "Amanda_F", "Nick_C", "Rachel_V",
    # International names
    "Yuki_42", "Carlos_MX", "Fatima_AE", "Raj_IN", "Anna_PL", "Wei_CN", "Olga_RU", "Pierre_FR",
    "Hans_DE", "Sofia_BR", "Aisha_NG", "Jun_KR", "Maria_ES", "Ahmed_EG", "Sakura_JP", "Dmitri_UA",
    # Gaming style names
    "xXGamerXx", "ProPlayer99", "NightOwl33", "StreamKing", "TriviaWiz", "QuizMaster", "BrainStorm",
    "WinnerWinner", "ChampMode", "TopTier_", "EliteGamer", "BossLevel", "MaxPoints", "GoldStar",
    # Fun usernames
    "PizzaLover", "CoffeeAddict", "NightVibes", "ChillMode", "GoodVibes", "HappyDays", "SunnyDay",
    "MoonChild", "StarGazer", "DreamChaser", "Wanderer_", "Explorer42", "Adventurer", "Seeker_X",
    # Numbers style
    "Player_001", "User_2847", "Gamer_9999", "Fan_1234", "Viewer_567", "Guest_8901", "Member_345",
    "Anonymous_7", "Unknown_99", "Mystery_42", "Shadow_11", "Phantom_23", "Ghost_55", "Spirit_77",
    # Pop culture references
    "IronFan", "WebHead", "BatFan_", "StarLord", "Grogu_Fan", "Witcher_", "Elden_Lord", "Dragonborn",
    "Vault_Boy", "MasterChef", "Survivor_", "BigBro_Fan", "RealityTV", "StreamLife", "ViralKing"
]

# AI simulation settings
AI_MIN_PLAYERS = 50  # Minimum AI players per game
AI_MAX_PLAYERS = 500  # Maximum AI players per game
AI_VOTE_INTERVAL_MS = 500  # Vote every 500ms on average

# Fun questions pool for the game
FUN_QUESTIONS = [
    {"question": "What's your favorite ice cream flavor?", "options": ["Vanilla", "Chocolate", "Strawberry", "Mint Chip"]},
    {"question": "Best pizza topping?", "options": ["Pepperoni", "Mushrooms", "Pineapple", "Extra Cheese"]},
    {"question": "Morning person or night owl?", "options": ["Early Bird", "Night Owl", "Depends", "Both!"]},
    {"question": "Cats or Dogs?", "options": ["Cats", "Dogs", "Both", "Neither"]},
    {"question": "Beach or Mountains?", "options": ["Beach", "Mountains", "City", "Countryside"]},
    {"question": "Coffee or Tea?", "options": ["Coffee", "Tea", "Both", "Neither"]},
    {"question": "Favorite music genre?", "options": ["Pop", "Rock", "Hip-Hop", "Country"]},
    {"question": "Best streaming day?", "options": ["Friday Night", "Saturday", "Sunday", "Weekdays"]},
    {"question": "Favorite season?", "options": ["Spring", "Summer", "Fall", "Winter"]},
    {"question": "Sweet or Savory snacks?", "options": ["Sweet", "Savory", "Both", "Healthy Only"]},
    {"question": "Best superhero?", "options": ["Batman", "Spider-Man", "Superman", "Iron Man"]},
    {"question": "Favorite social media?", "options": ["TikTok", "Instagram", "YouTube", "Twitter/X"]},
    {"question": "Morning workout or evening?", "options": ["Morning", "Evening", "Afternoon", "Never"]},
    {"question": "Favorite movie genre?", "options": ["Action", "Comedy", "Drama", "Horror"]},
    {"question": "Best fast food?", "options": ["McDonald's", "Chick-fil-A", "Taco Bell", "Wendy's"]},
]

# Ad content for between rounds
AD_CONTENT = [
    {"id": "ad1", "title": "Become a ZTVLIVE Creator", "description": "Keep 70% of your revenue!", "cta": "Sign Up Now", "url": "/schedule-slot", "duration": 10},
    {"id": "ad2", "title": "Download ZTVLIVE App", "description": "Watch on Roku, Fire TV & Samsung", "cta": "Get the App", "url": "/download", "duration": 8},
    {"id": "ad3", "title": "ZTVLIVE Premium", "description": "Ad-free streaming + exclusive content", "cta": "Go Premium", "url": "/premium", "duration": 10},
]

# Sponsor rewards - sent to winner's inbox
SPONSOR_REWARDS = [
    {
        "id": "doordash",
        "sponsor": "DoorDash",
        "logo": "🍔",
        "reward_title": "$5 OFF Your Next Order",
        "reward_code": "ZTVLIVE5",
        "reward_description": "Use code ZTVLIVE5 at checkout for $5 off any order $15+",
        "expires_days": 7,
        "color": "#FF3008"
    },
    {
        "id": "spotify",
        "sponsor": "Spotify",
        "logo": "🎵",
        "reward_title": "1 Month Premium FREE",
        "reward_code": "ZTVSPOT30",
        "reward_description": "Redeem at spotify.com/redeem for 1 month of Spotify Premium",
        "expires_days": 14,
        "color": "#1DB954"
    },
    {
        "id": "uber",
        "sponsor": "Uber",
        "logo": "🚗",
        "reward_title": "$10 OFF Your Next Ride",
        "reward_code": "ZTVRIDE10",
        "reward_description": "Apply code in Uber app for $10 off your next ride",
        "expires_days": 7,
        "color": "#000000"
    },
    {
        "id": "netflix",
        "sponsor": "Netflix",
        "logo": "🎬",
        "reward_title": "Free Weekend Pass",
        "reward_code": "ZTVFLIX",
        "reward_description": "48-hour unlimited streaming access - new users only",
        "expires_days": 3,
        "color": "#E50914"
    },
    {
        "id": "ztvlive",
        "sponsor": "ZTVLIVE Premium",
        "logo": "⭐",
        "reward_title": "7 Days Premium FREE",
        "reward_code": "WINNER7",
        "reward_description": "Ad-free viewing + exclusive content for 7 days!",
        "expires_days": 30,
        "color": "#A855F7"
    }
]

# In-memory reward inbox (in production, use MongoDB)
reward_inbox: Dict[str, List[dict]] = {}


class CreateGameRequest(BaseModel):
    question: Optional[str] = None
    options: Optional[List[str]] = None
    duration_seconds: int = 50
    use_random: bool = True


class VoteRequest(BaseModel):
    game_id: str
    option_index: int
    voter_id: Optional[str] = None


class ClaimRewardRequest(BaseModel):
    email: str
    voter_id: str
    game_id: str
    reward_id: str


class TTSRequest(BaseModel):
    text: str
    speed: float = 1.0
    lang: str = "en"  # Language code for translation


@router.post("/tts")
async def generate_host_voice(request: TTSRequest):
    """Generate AI host voice commentary using OpenAI TTS - supports multiple languages"""
    if not tts_client:
        raise HTTPException(status_code=503, detail="TTS service unavailable")
    
    try:
        text_to_speak = request.text
        
        # If not English, translate the text first
        if request.lang != "en":
            try:
                from services.translation import translate_text
                text_to_speak = await translate_text(request.text, request.lang, "en")
            except Exception as e:
                print(f"Translation for TTS failed: {e}")
                # Continue with original text if translation fails
        
        # Use energetic voice for game show host
        audio_base64 = await tts_client.generate_speech_base64(
            text=text_to_speak,
            model="tts-1",  # Fast model for real-time
            voice="nova",   # Energetic, upbeat voice - works well for all languages
            speed=min(max(request.speed, 0.5), 2.0)  # Clamp speed
        )
        
        return {"audio_base64": audio_base64, "success": True, "translated_text": text_to_speak}
        
    except Exception as e:
        print(f"TTS generation error: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@router.post("/create")
async def create_game(request: CreateGameRequest):
    """Create a new game/poll"""
    game_id = str(uuid.uuid4())[:8]
    
    # Use random question or custom
    if request.use_random or not request.question:
        q = random.choice(FUN_QUESTIONS)
        question = q["question"]
        options = q["options"]
    else:
        question = request.question
        options = request.options or ["Option A", "Option B", "Option C", "Option D"]
    
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(seconds=request.duration_seconds)
    
    game = {
        "id": game_id,
        "question": question,
        "options": options,
        "votes": {opt: 0 for opt in options},
        "voters": [],  # Track voter IDs to prevent double voting
        "total_votes": 0,
        "created_at": now.isoformat(),
        "end_time": end_time.isoformat(),
        "duration_seconds": request.duration_seconds,
        "status": "active",
        "winner": None
    }
    
    active_games[game_id] = game
    game_connections[game_id] = []
    
    # Schedule game end
    asyncio.create_task(end_game_after_delay(game_id, request.duration_seconds))
    
    # Start AI player simulation
    asyncio.create_task(simulate_ai_players(game_id, request.duration_seconds))
    
    # QR code URL will be generated on frontend with correct origin
    
    return {
        "game_id": game_id,
        "question": question,
        "options": options,
        "duration_seconds": request.duration_seconds,
        "end_time": end_time.isoformat()
    }


async def simulate_ai_players(game_id: str, duration: int):
    """Simulate AI players voting throughout the game to make it feel alive"""
    print(f"[AI SIM] Starting AI simulation for game {game_id} with {duration}s duration")
    
    if game_id not in active_games:
        print(f"[AI SIM] Game {game_id} not found in active_games")
        return
    
    game = active_games[game_id]
    options = game["options"]
    num_options = len(options)
    
    # Determine how many AI players for this game (random within range)
    total_ai_players = random.randint(AI_MIN_PLAYERS, AI_MAX_PLAYERS)
    print(f"[AI SIM] Simulating {total_ai_players} AI players for game {game_id}")
    
    # Calculate vote distribution - make some options more popular (realistic)
    # Create weighted distribution (some answers are more popular)
    weights = [random.uniform(0.5, 2.0) for _ in range(num_options)]
    total_weight = sum(weights)
    normalized_weights = [w / total_weight for w in weights]
    
    # Distribute votes over time (more at start, steady middle, rush at end)
    # Phase 1: Initial rush (first 10%) - 30% of votes
    # Phase 2: Steady middle (10-80%) - 40% of votes
    # Phase 3: Final rush (last 20%) - 30% of votes
    
    phase1_votes = int(total_ai_players * 0.30)
    phase2_votes = int(total_ai_players * 0.40)
    phase3_votes = total_ai_players - phase1_votes - phase2_votes
    
    used_names = set()
    
    async def add_ai_vote():
        if game_id not in active_games or active_games[game_id]["status"] != "active":
            return
        
        game = active_games[game_id]
        
        # Pick a random option based on weighted distribution
        option_index = random.choices(range(num_options), weights=normalized_weights)[0]
        option = options[option_index]
        
        # Generate unique AI player ID and name
        ai_id = f"ai_{uuid.uuid4().hex[:8]}"
        
        # Pick a unique name
        available_names = [n for n in AI_PLAYER_NAMES if n not in used_names]
        if not available_names:
            ai_name = f"Player_{random.randint(1000, 9999)}"
        else:
            ai_name = random.choice(available_names)
            used_names.add(ai_name)
        
        # Add vote
        if ai_id not in game["voters"]:
            game["votes"][option] = game["votes"].get(option, 0) + 1
            game["total_votes"] += 1
            game["voters"].append(ai_id)
            
            # Broadcast update to connected clients
            await broadcast_game_update(game_id, {
                "type": "vote_update",
                "votes": game["votes"],
                "total_votes": game["total_votes"],
                "latest_voter": ai_name
            })
    
    # Phase 1: Initial rush (first 10% of time)
    phase1_duration = duration * 0.10
    phase1_interval = phase1_duration / max(phase1_votes, 1)
    for _ in range(phase1_votes):
        if game_id not in active_games or active_games[game_id]["status"] != "active":
            return
        await add_ai_vote()
        await asyncio.sleep(max(0.1, phase1_interval + random.uniform(-0.1, 0.1)))
    
    # Phase 2: Steady middle (10-80% of time)
    phase2_duration = duration * 0.70
    phase2_interval = phase2_duration / max(phase2_votes, 1)
    for _ in range(phase2_votes):
        if game_id not in active_games or active_games[game_id]["status"] != "active":
            return
        await add_ai_vote()
        await asyncio.sleep(max(0.2, phase2_interval + random.uniform(-0.2, 0.3)))
    
    # Phase 3: Final rush (last 20% of time)
    phase3_duration = duration * 0.20
    phase3_interval = phase3_duration / max(phase3_votes, 1)
    for _ in range(phase3_votes):
        if game_id not in active_games or active_games[game_id]["status"] != "active":
            return
        await add_ai_vote()
        await asyncio.sleep(max(0.05, phase3_interval + random.uniform(-0.05, 0.1)))


async def end_game_after_delay(game_id: str, delay: int):
    """End game after specified delay"""
    await asyncio.sleep(delay)
    
    if game_id in active_games:
        game = active_games[game_id]
        game["status"] = "ended"
        
        # Determine winner
        if game["total_votes"] > 0:
            winner = max(game["votes"].items(), key=lambda x: x[1])
            game["winner"] = {"option": winner[0], "votes": winner[1]}
        else:
            game["winner"] = {"option": "No votes!", "votes": 0}
        
        # Select a random sponsor reward for winners
        reward = random.choice(SPONSOR_REWARDS)
        game["reward"] = reward
        
        # Notify all connected clients
        await broadcast_game_update(game_id, {
            "type": "game_ended",
            "game": game,
            "reward": reward,
            "ad": random.choice(AD_CONTENT)
        })
        
        # Keep game in memory for 5 minutes after ending (so vote page can still show results)
        await asyncio.sleep(300)
        if game_id in active_games:
            del active_games[game_id]
        if game_id in game_connections:
            del game_connections[game_id]


@router.post("/vote")
async def submit_vote(request: VoteRequest):
    """Submit a vote for a game"""
    game_id = request.game_id
    
    if game_id not in active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = active_games[game_id]
    
    if game["status"] != "active":
        raise HTTPException(status_code=400, detail="Voting has ended")
    
    if request.option_index < 0 or request.option_index >= len(game["options"]):
        raise HTTPException(status_code=400, detail="Invalid option")
    
    # Generate voter ID if not provided
    voter_id = request.voter_id or str(uuid.uuid4())[:12]
    
    # Check for double voting
    if voter_id in game["voters"]:
        raise HTTPException(status_code=400, detail="You have already voted!")
    
    # Record vote
    option = game["options"][request.option_index]
    game["votes"][option] += 1
    game["total_votes"] += 1
    game["voters"].append(voter_id)
    
    # Broadcast update to all viewers
    await broadcast_game_update(game_id, {
        "type": "vote_update",
        "votes": game["votes"],
        "total_votes": game["total_votes"]
    })
    
    return {
        "success": True,
        "message": f"Vote recorded for {option}!",
        "voter_id": voter_id,
        "current_votes": game["votes"],
        "total_votes": game["total_votes"]
    }


@router.get("/game/{game_id}")
async def get_game(game_id: str):
    """Get current game state"""
    if game_id not in active_games:
        # Return a friendly error that the vote page can handle
        return {
            "id": game_id,
            "status": "not_found",
            "error": "Game not found or has ended",
            "remaining_seconds": 0
        }
    
    game = active_games[game_id]
    
    # Calculate remaining time
    try:
        end_time = datetime.fromisoformat(game["end_time"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        remaining = max(0, (end_time - now).total_seconds())
    except Exception:
        remaining = 0
    
    return {
        **game,
        "remaining_seconds": int(remaining)
    }


@router.get("/active")
async def get_active_games():
    """Get all active games"""
    active = [g for g in active_games.values() if g["status"] == "active"]
    return {"games": active, "count": len(active)}


@router.post("/claim-reward")
async def claim_reward(request: ClaimRewardRequest):
    """Claim a reward - requires email signup"""
    import re
    
    # Validate email
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, request.email):
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    # Check if game exists and has ended
    if request.game_id not in active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = active_games[request.game_id]
    
    if game["status"] != "ended":
        raise HTTPException(status_code=400, detail="Game has not ended yet")
    
    # Check if user voted in this game
    if request.voter_id not in game["voters"]:
        raise HTTPException(status_code=400, detail="You did not participate in this game")
    
    # Check if user voted for the winning option
    winner_option = game["winner"]["option"] if game["winner"] else None
    
    # Find the reward
    reward = next((r for r in SPONSOR_REWARDS if r["id"] == request.reward_id), None)
    if not reward:
        reward = game.get("reward", SPONSOR_REWARDS[0])
    
    # Create reward entry
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=reward.get("expires_days", 7))
    
    reward_entry = {
        "id": str(uuid.uuid4())[:8],
        "email": request.email,
        "game_id": request.game_id,
        "question": game["question"],
        "winner": winner_option,
        "sponsor": reward["sponsor"],
        "logo": reward["logo"],
        "reward_title": reward["reward_title"],
        "reward_code": reward["reward_code"],
        "reward_description": reward["reward_description"],
        "claimed_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "status": "claimed"
    }
    
    # Store in inbox
    if request.email not in reward_inbox:
        reward_inbox[request.email] = []
    
    # Check for duplicate claims
    existing = [r for r in reward_inbox[request.email] if r["game_id"] == request.game_id]
    if existing:
        raise HTTPException(status_code=400, detail="You have already claimed this reward")
    
    reward_inbox[request.email].append(reward_entry)
    
    return {
        "success": True,
        "message": f"Reward sent to {request.email}!",
        "reward": reward_entry
    }


@router.get("/inbox/{email}")
async def get_reward_inbox(email: str):
    """Get all rewards for an email"""
    rewards = reward_inbox.get(email, [])
    
    # Filter out expired rewards
    now = datetime.now(timezone.utc)
    active_rewards = []
    expired_rewards = []
    
    for r in rewards:
        expires = datetime.fromisoformat(r["expires_at"].replace("Z", "+00:00"))
        if expires > now:
            active_rewards.append(r)
        else:
            r["status"] = "expired"
            expired_rewards.append(r)
    
    return {
        "email": email,
        "active_rewards": active_rewards,
        "expired_rewards": expired_rewards,
        "total_claimed": len(rewards)
    }


@router.get("/sponsors")
async def get_sponsors():
    """Get list of current sponsors"""
    return {"sponsors": SPONSOR_REWARDS}


@router.get("/questions")
async def get_question_pool():
    """Get pool of fun questions for admins"""
    return {"questions": FUN_QUESTIONS}


@router.post("/questions/add")
async def add_question(question: str, options: List[str]):
    """Add a new question to the pool"""
    FUN_QUESTIONS.append({"question": question, "options": options})
    return {"success": True, "total_questions": len(FUN_QUESTIONS)}


@router.websocket("/ws/{game_id}")
async def game_websocket(websocket: WebSocket, game_id: str):
    """WebSocket for real-time game updates"""
    await websocket.accept()
    
    if game_id not in game_connections:
        game_connections[game_id] = []
    
    game_connections[game_id].append(websocket)
    
    try:
        # Send current game state
        if game_id in active_games:
            game = active_games[game_id]
            end_time = datetime.fromisoformat(game["end_time"].replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            remaining = max(0, (end_time - now).total_seconds())
            
            await websocket.send_json({
                "type": "game_state",
                "game": game,
                "remaining_seconds": int(remaining)
            })
        
        # Keep connection alive and listen for messages
        while True:
            _ = await websocket.receive_text()
            # Handle any client messages if needed
            
    except WebSocketDisconnect:
        if game_id in game_connections:
            game_connections[game_id].remove(websocket)


async def broadcast_game_update(game_id: str, data: dict):
    """Broadcast update to all connected clients"""
    if game_id in game_connections:
        disconnected = []
        for ws in game_connections[game_id]:
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(ws)
        
        # Clean up disconnected clients
        for ws in disconnected:
            game_connections[game_id].remove(ws)


# Cleanup old games periodically
async def cleanup_old_games():
    """Remove games older than 1 hour"""
    while True:
        await asyncio.sleep(3600)  # Run every hour
        now = datetime.now(timezone.utc)
        to_remove = []
        
        for game_id, game in active_games.items():
            created = datetime.fromisoformat(game["created_at"].replace("Z", "+00:00"))
            if (now - created).total_seconds() > 3600:
                to_remove.append(game_id)
        
        for game_id in to_remove:
            del active_games[game_id]
            if game_id in game_connections:
                del game_connections[game_id]
