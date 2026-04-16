"""
ZTVLIVE 24/7 Live Game System

This module manages a continuously running game show that:
- Runs 24/7 with auto-rotating questions every 50 seconds
- Syncs all viewers to the same question/timer
- Tracks player scores and determines winners
- Sends prize notifications to 10-minute winners
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, List, Optional, Set
from datetime import datetime, timezone, timedelta
import asyncio
import random
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/api/live-game", tags=["Live Game"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "ztvlive")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ============== QUESTION BANK ==============
QUESTION_BANK = [
    {"question": "What's your favorite streaming platform?", "options": ["Netflix", "YouTube", "Disney+", "HBO Max"]},
    {"question": "Best pizza topping?", "options": ["Pepperoni", "Mushrooms", "Extra Cheese", "Pineapple"]},
    {"question": "Morning drink of choice?", "options": ["Coffee", "Tea", "Energy Drink", "Juice"]},
    {"question": "Favorite music genre?", "options": ["Pop", "Hip-Hop", "Rock", "Electronic"]},
    {"question": "Best social media app?", "options": ["TikTok", "Instagram", "Twitter/X", "YouTube"]},
    {"question": "Ideal vacation spot?", "options": ["Beach", "Mountains", "City", "Countryside"]},
    {"question": "Favorite movie genre?", "options": ["Action", "Comedy", "Drama", "Horror"]},
    {"question": "Best fast food?", "options": ["McDonald's", "Chick-fil-A", "Taco Bell", "Wendy's"]},
    {"question": "Dogs or cats?", "options": ["Dogs", "Cats", "Both", "Neither"]},
    {"question": "Favorite season?", "options": ["Spring", "Summer", "Fall", "Winter"]},
    {"question": "Best superhero?", "options": ["Spider-Man", "Batman", "Iron Man", "Superman"]},
    {"question": "Favorite gaming console?", "options": ["PlayStation", "Xbox", "Nintendo", "PC"]},
    {"question": "Morning or night person?", "options": ["Early Bird", "Night Owl", "Depends", "Both"]},
    {"question": "Favorite snack?", "options": ["Chips", "Candy", "Popcorn", "Fruit"]},
    {"question": "Best way to exercise?", "options": ["Gym", "Running", "Sports", "Walking"]},
    {"question": "Favorite type of cuisine?", "options": ["Italian", "Mexican", "Asian", "American"]},
    {"question": "Best way to relax?", "options": ["Watch TV", "Read", "Gaming", "Music"]},
    {"question": "Favorite drink?", "options": ["Soda", "Water", "Coffee", "Alcohol"]},
    {"question": "Best phone brand?", "options": ["Apple", "Samsung", "Google", "Other"]},
    {"question": "Favorite sport to watch?", "options": ["Football", "Basketball", "Soccer", "Baseball"]},
    {"question": "Best time to workout?", "options": ["Morning", "Afternoon", "Evening", "Night"]},
    {"question": "Favorite holiday?", "options": ["Christmas", "Halloween", "Thanksgiving", "New Year"]},
    {"question": "Best car brand?", "options": ["Toyota", "BMW", "Tesla", "Ford"]},
    {"question": "Favorite ice cream flavor?", "options": ["Vanilla", "Chocolate", "Strawberry", "Mint"]},
    {"question": "Best laptop brand?", "options": ["Apple", "Dell", "HP", "Lenovo"]},
]

# ============== GAME STATE ==============
class LiveGameState:
    def __init__(self):
        self.current_question_index = 0
        self.current_question = None
        self.question_start_time = None
        self.question_duration = 50  # seconds
        self.votes: Dict[str, int] = {}  # option -> count
        self.player_votes: Dict[str, str] = {}  # player_id -> selected option
        self.player_sessions: Dict[str, dict] = {}  # player_id -> session data
        self.connected_clients: Set[WebSocket] = set()
        self.ai_voters_active = True
        self.is_running = False
        self.question_number = 0
        self.last_results = None
        
    def get_time_remaining(self) -> int:
        if not self.question_start_time:
            return self.question_duration
        elapsed = (datetime.now(timezone.utc) - self.question_start_time).total_seconds()
        return max(0, int(self.question_duration - elapsed))
    
    def get_state(self) -> dict:
        return {
            "question": self.current_question,
            "question_number": self.question_number,
            "time_remaining": self.get_time_remaining(),
            "votes": self.votes.copy(),
            "total_votes": sum(self.votes.values()),
            "player_count": len(self.player_sessions),
            "is_live": self.is_running,
            "last_results": self.last_results
        }

# Global game state
live_game = LiveGameState()

# ============== AI VOTER SIMULATION ==============
async def simulate_ai_votes():
    """Add AI votes to make the game feel active"""
    while live_game.is_running:
        if live_game.current_question and live_game.get_time_remaining() > 5:
            # Add 1-3 AI votes every 2-5 seconds
            num_votes = random.randint(1, 3)
            for _ in range(num_votes):
                if live_game.current_question:
                    option = random.choice(live_game.current_question["options"])
                    live_game.votes[option] = live_game.votes.get(option, 0) + 1
        
        await asyncio.sleep(random.uniform(2, 5))

# ============== QUESTION ROTATION ==============
async def rotate_questions():
    """Main game loop - rotates questions every 50 seconds"""
    while live_game.is_running:
        # Select next question
        live_game.current_question = QUESTION_BANK[live_game.current_question_index % len(QUESTION_BANK)]
        live_game.current_question_index += 1
        live_game.question_number += 1
        live_game.question_start_time = datetime.now(timezone.utc)
        
        # Reset votes for new question
        live_game.votes = {opt: 0 for opt in live_game.current_question["options"]}
        
        # Add initial AI votes
        for opt in live_game.current_question["options"]:
            live_game.votes[opt] = random.randint(10, 50)
        
        # Broadcast new question to all clients
        await broadcast_state("new_question")
        
        # Wait for question duration
        await asyncio.sleep(live_game.question_duration)
        
        # Calculate results
        await calculate_results()
        
        # Small pause between questions
        await asyncio.sleep(3)

async def calculate_results():
    """Calculate results after question ends"""
    if not live_game.current_question:
        return
    
    total = sum(live_game.votes.values())
    if total == 0:
        return
    
    # Find winning option (most votes)
    winning_option = max(live_game.votes.keys(), key=lambda k: live_game.votes[k])
    winning_percent = round((live_game.votes[winning_option] / total) * 100)
    
    # Calculate results for each player
    results = {
        "question": live_game.current_question["question"],
        "winning_option": winning_option,
        "winning_percent": winning_percent,
        "vote_breakdown": {
            opt: {
                "count": live_game.votes[opt],
                "percent": round((live_game.votes[opt] / total) * 100)
            }
            for opt in live_game.current_question["options"]
        },
        "player_results": {}
    }
    
    # Update player scores
    for player_id, selected in live_game.player_votes.items():
        is_winner = selected == winning_option
        player_percent = results["vote_breakdown"].get(selected, {}).get("percent", 0)
        
        # Update player session
        if player_id in live_game.player_sessions:
            session = live_game.player_sessions[player_id]
            session["questions_answered"] = session.get("questions_answered", 0) + 1
            if is_winner:
                session["correct_answers"] = session.get("correct_answers", 0) + 1
            session["total_score"] = session.get("total_score", 0) + (1 if is_winner else 0)
            
            results["player_results"][player_id] = {
                "your_answer": selected,
                "your_percent": player_percent,
                "world_winner": winning_option,
                "world_percent": winning_percent,
                "won_point": is_winner,
                "total_score": session["total_score"],
                "questions_answered": session["questions_answered"]
            }
            
            # Check for 10-minute winner
            await check_winner(player_id, session)
    
    # Store results and clear player votes for next round
    live_game.last_results = results
    live_game.player_votes.clear()
    
    # Broadcast results
    await broadcast_state("results")

async def check_winner(player_id: str, session: dict):
    """Check if player qualifies as a winner after 10 minutes"""
    if not session.get("start_time"):
        return
    
    play_duration = (datetime.now(timezone.utc) - session["start_time"]).total_seconds()
    
    # Must play for at least 10 minutes (600 seconds)
    if play_duration < 600:
        return
    
    # Must have answered at least 10 questions
    if session.get("questions_answered", 0) < 10:
        return
    
    # Must have at least 60% correct
    correct = session.get("correct_answers", 0)
    answered = session.get("questions_answered", 1)
    accuracy = correct / answered
    
    if accuracy >= 0.6 and not session.get("winner_notified"):
        session["winner_notified"] = True
        session["won_at"] = datetime.now(timezone.utc).isoformat()
        
        # Store winner in database
        await db.live_game_winners.insert_one({
            "player_id": player_id,
            "session_id": session.get("session_id"),
            "score": session["total_score"],
            "questions_answered": answered,
            "accuracy": round(accuracy * 100),
            "play_duration_minutes": round(play_duration / 60, 1),
            "won_at": datetime.now(timezone.utc),
            "claimed": False
        })
        
        # Send winner notification via WebSocket
        for ws in live_game.connected_clients:
            try:
                await ws.send_json({
                    "type": "winner_notification",
                    "player_id": player_id,
                    "message": "Congratulations! You're a WINNER! Log in to claim your prize!",
                    "score": session["total_score"],
                    "accuracy": round(accuracy * 100)
                })
            except:
                pass

async def broadcast_state(event_type: str):
    """Broadcast current state to all connected clients"""
    state = live_game.get_state()
    state["event"] = event_type
    
    disconnected = set()
    for ws in live_game.connected_clients:
        try:
            await ws.send_json(state)
        except:
            disconnected.add(ws)
    
    # Clean up disconnected clients
    live_game.connected_clients -= disconnected

# ============== API ENDPOINTS ==============

@router.get("/state")
async def get_game_state():
    """Get current live game state"""
    state = live_game.get_state()
    
    # If time remaining < 15, indicate player should wait
    if state["time_remaining"] < 15:
        state["should_wait"] = True
        state["wait_message"] = f"Next question in {state['time_remaining'] + 3} seconds..."
    else:
        state["should_wait"] = False
    
    return state

@router.post("/join")
async def join_game(player_id: Optional[str] = None):
    """Join the live game"""
    if not player_id:
        player_id = str(uuid.uuid4())[:8]
    
    # Create or update player session
    if player_id not in live_game.player_sessions:
        live_game.player_sessions[player_id] = {
            "session_id": str(uuid.uuid4()),
            "player_id": player_id,
            "start_time": datetime.now(timezone.utc),
            "questions_answered": 0,
            "correct_answers": 0,
            "total_score": 0,
            "winner_notified": False
        }
    
    state = live_game.get_state()
    state["player_id"] = player_id
    state["session"] = live_game.player_sessions[player_id]
    
    # Check if should wait
    if state["time_remaining"] < 15:
        state["should_wait"] = True
        state["wait_message"] = f"Next question in {state['time_remaining'] + 3} seconds..."
    
    return state

class VoteRequest(BaseModel):
    player_id: str
    option: str

@router.post("/vote")
async def submit_vote(vote: VoteRequest):
    """Submit a vote for the current question"""
    if not live_game.current_question:
        raise HTTPException(400, "No active question")
    
    if vote.option not in live_game.current_question["options"]:
        raise HTTPException(400, "Invalid option")
    
    # Check if too late to vote (< 5 seconds)
    if live_game.get_time_remaining() < 5:
        raise HTTPException(400, "Too late to vote")
    
    # Check if already voted this round
    if vote.player_id in live_game.player_votes:
        raise HTTPException(400, "Already voted this round")
    
    # Record vote
    live_game.player_votes[vote.player_id] = vote.option
    live_game.votes[vote.option] = live_game.votes.get(vote.option, 0) + 1
    
    # Broadcast updated vote counts
    await broadcast_state("vote_update")
    
    return {
        "success": True,
        "your_vote": vote.option,
        "current_votes": live_game.votes
    }

@router.get("/player/{player_id}/stats")
async def get_player_stats(player_id: str):
    """Get player's current session stats"""
    if player_id not in live_game.player_sessions:
        raise HTTPException(404, "Player not found")
    
    session = live_game.player_sessions[player_id]
    play_duration = 0
    if session.get("start_time"):
        play_duration = (datetime.now(timezone.utc) - session["start_time"]).total_seconds()
    
    return {
        "player_id": player_id,
        "score": session.get("total_score", 0),
        "questions_answered": session.get("questions_answered", 0),
        "correct_answers": session.get("correct_answers", 0),
        "accuracy": round((session.get("correct_answers", 0) / max(session.get("questions_answered", 1), 1)) * 100),
        "play_duration_minutes": round(play_duration / 60, 1),
        "is_winner": session.get("winner_notified", False)
    }

@router.get("/leaderboard")
async def get_leaderboard():
    """Get current session leaderboard"""
    players = []
    for pid, session in live_game.player_sessions.items():
        answered = session.get("questions_answered", 0)
        if answered > 0:
            players.append({
                "player_id": pid,
                "score": session.get("total_score", 0),
                "questions": answered,
                "accuracy": round((session.get("correct_answers", 0) / answered) * 100)
            })
    
    # Sort by score, then accuracy
    players.sort(key=lambda x: (x["score"], x["accuracy"]), reverse=True)
    
    return {"leaderboard": players[:20]}

@router.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    """WebSocket connection for real-time game updates"""
    await websocket.accept()
    live_game.connected_clients.add(websocket)
    
    # Ensure player has a session
    if player_id not in live_game.player_sessions:
        live_game.player_sessions[player_id] = {
            "session_id": str(uuid.uuid4()),
            "player_id": player_id,
            "start_time": datetime.now(timezone.utc),
            "questions_answered": 0,
            "correct_answers": 0,
            "total_score": 0,
            "winner_notified": False
        }
    
    try:
        # Send current state immediately
        state = live_game.get_state()
        state["event"] = "connected"
        state["player_id"] = player_id
        await websocket.send_json(state)
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30)
                
                if data.get("type") == "vote":
                    option = data.get("option")
                    if option and option in live_game.current_question.get("options", []):
                        if player_id not in live_game.player_votes and live_game.get_time_remaining() >= 5:
                            live_game.player_votes[player_id] = option
                            live_game.votes[option] = live_game.votes.get(option, 0) + 1
                            await websocket.send_json({"type": "vote_confirmed", "option": option})
                            await broadcast_state("vote_update")
                
                elif data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                    
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat", "time_remaining": live_game.get_time_remaining()})
                
    except WebSocketDisconnect:
        pass
    finally:
        live_game.connected_clients.discard(websocket)

# ============== GAME MANAGEMENT ==============

async def start_live_game():
    """Start the 24/7 live game"""
    if live_game.is_running:
        return
    
    live_game.is_running = True
    
    # Start question rotation
    asyncio.create_task(rotate_questions())
    
    # Start AI voter simulation
    asyncio.create_task(simulate_ai_votes())
    
    print("[LiveGame] 24/7 Live Game started!")

async def stop_live_game():
    """Stop the live game"""
    live_game.is_running = False

@router.post("/admin/start")
async def admin_start_game():
    """Admin endpoint to start the live game"""
    await start_live_game()
    return {"status": "started", "message": "24/7 Live Game is now running"}

@router.post("/admin/stop")
async def admin_stop_game():
    """Admin endpoint to stop the live game"""
    await stop_live_game()
    return {"status": "stopped", "message": "Live Game stopped"}

@router.get("/admin/status")
async def admin_game_status():
    """Get admin status of the live game"""
    return {
        "is_running": live_game.is_running,
        "current_question_number": live_game.question_number,
        "connected_players": len(live_game.connected_clients),
        "active_sessions": len(live_game.player_sessions),
        "time_remaining": live_game.get_time_remaining()
    }
