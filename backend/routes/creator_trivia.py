"""
ZTVLIVE Creator Trivia System
Loads creator-specific trivia questions based on broadcast schedule
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timezone
import random

router = APIRouter(prefix="/api/creator-trivia", tags=["Creator Trivia"])

# Creator profiles with trivia questions
CREATORS = {
    "todd_wiseman_jr": {
        "name": "Todd Wiseman Jr.",
        "slug": "todd_wiseman_jr",
        "niche": "documentary",
        "avatar": "🎬",
        "bio": "Emmy-winning filmmaker and documentarian",
        "trivia": [
            {
                "question": "Todd Wiseman Jr. is best known for directing documentaries about which city?",
                "options": ["Los Angeles", "New York City", "Chicago", "Miami"],
                "correct": 1
            },
            {
                "question": "What award has Todd Wiseman Jr. won for his filmmaking?",
                "options": ["Oscar", "Grammy", "Emmy", "Tony"],
                "correct": 2
            },
            {
                "question": "Todd's documentary style is often described as?",
                "options": ["Horror", "Cinéma vérité", "Animation", "Musical"],
                "correct": 1
            },
            {
                "question": "Which platform first featured Todd's breakout work?",
                "options": ["Netflix", "Vimeo", "YouTube", "HBO"],
                "correct": 1
            },
            {
                "question": "Todd Wiseman Jr. often films content about?",
                "options": ["Sports", "Urban life & culture", "Cooking", "Gaming"],
                "correct": 1
            },
            {
                "question": "What's Todd's preferred shooting style?",
                "options": ["Studio sets", "On-location street footage", "Green screen", "Underwater"],
                "correct": 1
            },
            {
                "question": "Todd has collaborated with brands like?",
                "options": ["Nike", "Apple", "Both", "Neither"],
                "correct": 2
            },
            {
                "question": "How long has Todd been creating content professionally?",
                "options": ["5 years", "10+ years", "2 years", "20+ years"],
                "correct": 1
            }
        ]
    },
    "sabrina_brier": {
        "name": "Sabrina Brier",
        "slug": "sabrina_brier",
        "niche": "comedy",
        "avatar": "😂",
        "bio": "Comedy creator and viral sensation",
        "trivia": [
            {
                "question": "Sabrina Brier is known for her comedy about?",
                "options": ["Politics", "Dating & relationships", "Sports", "Science"],
                "correct": 1
            },
            {
                "question": "Which platform made Sabrina famous?",
                "options": ["TikTok", "LinkedIn", "Twitter", "Pinterest"],
                "correct": 0
            },
            {
                "question": "Sabrina's comedy style is best described as?",
                "options": ["Slapstick", "Observational", "Dark humor", "Improv"],
                "correct": 1
            },
            {
                "question": "What's Sabrina's most viral video topic?",
                "options": ["Cooking fails", "Dating apps", "Work meetings", "Pet videos"],
                "correct": 1
            },
            {
                "question": "Sabrina often collaborates with?",
                "options": ["Musicians", "Other comedians", "Athletes", "Politicians"],
                "correct": 1
            },
            {
                "question": "Her content is popular with which demographic?",
                "options": ["Gen Z & Millennials", "Baby Boomers", "Gen X only", "Kids"],
                "correct": 0
            },
            {
                "question": "Sabrina's videos typically run?",
                "options": ["30+ minutes", "Under 3 minutes", "Exactly 10 minutes", "1 hour"],
                "correct": 1
            },
            {
                "question": "What makes Sabrina's content unique?",
                "options": ["Special effects", "Relatable everyday moments", "Celebrity guests", "Travel vlogs"],
                "correct": 1
            }
        ]
    },
    "sienna_mae": {
        "name": "Sienna Mae",
        "slug": "sienna_mae",
        "niche": "lifestyle",
        "avatar": "✨",
        "bio": "Body positivity advocate and lifestyle creator",
        "trivia": [
            {
                "question": "Sienna Mae is known for promoting?",
                "options": ["Fast fashion", "Body positivity", "Extreme diets", "Luxury brands"],
                "correct": 1
            },
            {
                "question": "Sienna's content primarily features?",
                "options": ["Gaming", "Dancing & lifestyle", "Cooking", "Tech reviews"],
                "correct": 1
            },
            {
                "question": "Which platform is Sienna most active on?",
                "options": ["Facebook", "TikTok", "LinkedIn", "Snapchat"],
                "correct": 1
            },
            {
                "question": "Sienna's message to followers is about?",
                "options": ["Making money", "Self-love & confidence", "Politics", "Travel"],
                "correct": 1
            }
        ]
    }
}

# Broadcast schedule (slot_hour in UTC)
BROADCAST_SCHEDULE = {
    14: "todd_wiseman_jr",    # 10:30 AM ET = 14:30 UTC (using 14 for the hour)
    15: "todd_wiseman_jr",    # 11:00 AM ET
    18: "sabrina_brier",      # 2:30 PM ET = 18:30 UTC
    19: "sabrina_brier",      # 3:00 PM ET
    20: "sienna_mae",         # 4:00 PM ET
    21: "sienna_mae",         # 5:00 PM ET
}


class TriviaQuestion(BaseModel):
    question: str
    options: List[str]
    creator_slug: str
    creator_name: str


class TriviaAnswer(BaseModel):
    creator_slug: str
    question_index: int
    selected_option: int
    voter_id: str


@router.get("/current-creator")
async def get_current_creator():
    """Get the creator for the current broadcast slot"""
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    
    creator_slug = BROADCAST_SCHEDULE.get(current_hour)
    
    if not creator_slug or creator_slug not in CREATORS:
        # Default to Todd for demo purposes
        creator_slug = "todd_wiseman_jr"
    
    creator = CREATORS[creator_slug]
    
    return {
        "slug": creator_slug,
        "name": creator["name"],
        "niche": creator["niche"],
        "avatar": creator["avatar"],
        "bio": creator["bio"],
        "question_count": len(creator["trivia"])
    }


@router.get("/question/{creator_slug}")
async def get_trivia_question(creator_slug: str, exclude_indices: str = ""):
    """Get a random trivia question for a creator"""
    if creator_slug not in CREATORS:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    creator = CREATORS[creator_slug]
    trivia = creator["trivia"]
    
    # Parse excluded indices
    excluded = set()
    if exclude_indices:
        try:
            excluded = set(int(x) for x in exclude_indices.split(","))
        except:
            pass
    
    # Get available questions
    available = [(i, q) for i, q in enumerate(trivia) if i not in excluded]
    
    if not available:
        # Reset - all questions used
        available = list(enumerate(trivia))
    
    idx, question = random.choice(available)
    
    return {
        "index": idx,
        "question": question["question"],
        "options": question["options"],
        "creator_slug": creator_slug,
        "creator_name": creator["name"],
        "creator_avatar": creator["avatar"]
    }


@router.post("/check-answer")
async def check_trivia_answer(answer: TriviaAnswer):
    """Check if a trivia answer is correct"""
    if answer.creator_slug not in CREATORS:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    creator = CREATORS[answer.creator_slug]
    trivia = creator["trivia"]
    
    if answer.question_index < 0 or answer.question_index >= len(trivia):
        raise HTTPException(status_code=400, detail="Invalid question index")
    
    question = trivia[answer.question_index]
    is_correct = answer.selected_option == question["correct"]
    
    return {
        "correct": is_correct,
        "correct_answer": question["correct"],
        "correct_option": question["options"][question["correct"]],
        "selected_option": question["options"][answer.selected_option] if 0 <= answer.selected_option < len(question["options"]) else None
    }


@router.get("/creators")
async def list_creators():
    """List all available creators"""
    return {
        "creators": [
            {
                "slug": slug,
                "name": data["name"],
                "niche": data["niche"],
                "avatar": data["avatar"],
                "question_count": len(data["trivia"])
            }
            for slug, data in CREATORS.items()
        ]
    }


@router.get("/schedule")
async def get_broadcast_schedule():
    """Get the broadcast schedule"""
    schedule = []
    for hour, slug in sorted(BROADCAST_SCHEDULE.items()):
        if slug in CREATORS:
            creator = CREATORS[slug]
            schedule.append({
                "hour_utc": hour,
                "creator_slug": slug,
                "creator_name": creator["name"],
                "niche": creator["niche"]
            })
    
    return {"schedule": schedule}
