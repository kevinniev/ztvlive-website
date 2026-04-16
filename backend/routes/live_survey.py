"""
ZTVLIVE 24/7 Live Survey Game - Family Feud Style

Players type their own answers to open-ended questions.
No multiple choice - pure survey style where majority wins.

Features:
- Open-ended questions (type your answer)
- Real-time % of people who chose same answer
- Top 4 answers revealed at countdown zero (10 second display)
- 10-minute game batches with 10 questions each
- Email prize claim system
- Synced across all platforms (mobile, PC, tablet, Roku)
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, List, Optional, Set
from datetime import datetime, timezone, timedelta
from collections import Counter
import logging

# Enhanced logging for Mystery Money bonus triggers
logger = logging.getLogger("LiveSurvey")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter('[%(asctime)s] [MYSTERY_MONEY] %(message)s'))
logger.addHandler(handler)
import asyncio
import random
import uuid
import re
from motor.motor_asyncio import AsyncIOMotorClient
import os

router = APIRouter(prefix="/api/live-survey", tags=["Live Survey Game"])

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "ztvlive")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ============== OPEN-ENDED QUESTIONS - PERSONAL "YOU" STYLE ==============
SURVEY_QUESTIONS = [
    # Food & Drinks
    "What's YOUR go-to drink when you're thirsty?",
    "What flavor of coffee do YOU like?",
    "What's YOUR favorite pizza topping?",
    "What's YOUR favorite ice cream flavor?",
    "What's YOUR go-to snack when watching TV?",
    "What do YOU order at a coffee shop?",
    "What's YOUR favorite breakfast food?",
    "What fast food restaurant do YOU prefer?",
    "What's YOUR favorite candy?",
    "What's in YOUR refrigerator right now?",
    
    # Daily Life
    "What's the first thing YOU do when you wake up?",
    "What do YOU always carry with you?",
    "What do YOU do to relax after work?",
    "What do YOU do on a rainy day?",
    "What do YOU do on weekends?",
    "What makes YOU happy?",
    "What's YOUR morning routine like?",
    "How do YOU de-stress after a long day?",
    "What time do YOU usually go to bed?",
    "What's YOUR guilty pleasure?",
    
    # Entertainment
    "What streaming service do YOU use most?",
    "What's YOUR favorite movie genre?",
    "What video game do YOU play most?",
    "What TV show are YOU watching now?",
    "What music genre do YOU listen to?",
    "What's YOUR favorite app on your phone?",
    "What social media do YOU use most?",
    "What's YOUR favorite YouTube channel type?",
    "Who's YOUR favorite celebrity?",
    "What podcast do YOU listen to?",
    
    # Sports & Activities
    "What sport do YOU like to watch?",
    "What's YOUR favorite team?",
    "Who do YOU think will win the NBA Finals this year?",
    "What exercise do YOU do to stay fit?",
    "What's YOUR favorite outdoor activity?",
    "What hobby do YOU enjoy?",
    "What car brand would YOU drive?",
    "What's YOUR dream vacation destination?",
    
    # Personal
    "Mom or Dad - who do YOU prefer?",
    "What's YOUR biggest fear?",
    "What superpower would YOU want?",
    "What's YOUR zodiac sign?",
    "Are YOU a morning person or night owl?",
    "Dogs or cats - what do YOU prefer?",
    "What's YOUR favorite color?",
    "What's YOUR favorite season?",
    "Beach or mountains - where would YOU go?",
    "What's YOUR dream job?",
    
    # Opinion
    "What's the best phone brand in YOUR opinion?",
    "What's the best car brand in YOUR opinion?",
    "What makes a good friend in YOUR opinion?",
    "Cash or card - how do YOU pay?",
    "Early bird or night owl - which are YOU?",
    "City or countryside - where would YOU live?",
    "What's YOUR New Year's resolution?",
    "What skill do YOU wish you had?",
    "What's YOUR pet peeve?",
    "What advice would YOU give your younger self?",
    
    # Pop Culture & Trends
    "What's YOUR favorite social media platform right now?",
    "What movie are YOU most excited for this year?",
    "What's YOUR favorite streaming show of 2026?",
    "Which artist has YOUR favorite new album?",
    "What tech gadget do YOU want most?",
    "What video game are YOU playing right now?",
    "Who's YOUR favorite content creator?",
    "What meme makes YOU laugh every time?",
    "What trend do YOU think is overrated?",
    "What's YOUR hot take on AI?",
    
    # Would You Rather Style
    "Netflix or YouTube - where do YOU spend more time?",
    "iPhone or Android - which side are YOU on?",
    "Coffee or energy drinks - what keeps YOU going?",
    "Uber or driving yourself - how do YOU get around?",
    "Online shopping or in-store - how do YOU buy?",
    "Text or call - how do YOU prefer to communicate?",
    "Summer vacation or winter holiday - what do YOU prefer?",
    "Early morning workout or late night exercise?",
    "Cooking at home or ordering food?",
    "Reading books or watching documentaries?",
    
    # Life & Experiences
    "What's the best concert YOU've ever been to?",
    "What's YOUR most used emoji?",
    "What's YOUR go-to karaoke song?",
    "What's something everyone loves but YOU don't?",
    "What's YOUR unpopular opinion?",
    "What do YOU collect?",
    "What's YOUR comfort TV show?",
    "What do YOU always forget?",
    "What's YOUR hidden talent?",
    "What did YOU want to be as a kid?",
    
    # Quick Fire
    "Favorite fast food chain?",
    "Best pizza topping?",
    "Worst household chore?",
    "Best day of the week?",
    "Favorite holiday?",
    "Best Disney movie?",
    "Favorite superhero?",
    "Best midnight snack?",
    "Favorite board game?",
    "Best smell in the world?",
    
    # ===== EDUCATION & LEARNING =====
    "What subject did YOU enjoy most in school?",
    "What's the most useful skill YOU learned?",
    "What book changed YOUR life?",
    "What language would YOU like to learn?",
    "What do YOU wish schools taught?",
    "Who was YOUR favorite teacher and why?",
    "What's the best way YOU learn new things?",
    "What online course would YOU take?",
    "What historical period fascinates YOU most?",
    "What scientific discovery amazes YOU?",
    
    # ===== PERSONAL GROWTH =====
    "What habit are YOU trying to build?",
    "What's YOUR biggest accomplishment?",
    "What fear have YOU overcome?",
    "What motivates YOU to keep going?",
    "What's the best advice YOU ever received?",
    "What would YOU tell your 10-year-old self?",
    "What mistake taught YOU the most?",
    "How do YOU practice self-care?",
    "What goal are YOU working towards?",
    "What's YOUR definition of success?",
    
    # ===== RELATIONSHIPS & FAMILY =====
    "What quality do YOU value most in a friend?",
    "How do YOU show someone YOU care?",
    "What's YOUR love language?",
    "What family tradition do YOU cherish?",
    "What makes a relationship work in YOUR opinion?",
    "How do YOU handle disagreements?",
    "What's the best gift YOU ever received?",
    "Who inspires YOU the most?",
    "What do YOU admire in others?",
    "How do YOU make new friends?",
    
    # ===== CAREER & WORK =====
    "What's YOUR dream career?",
    "What skill would help YOUR career most?",
    "Do YOU prefer working alone or in a team?",
    "What motivates YOU at work?",
    "What's YOUR biggest professional goal?",
    "Remote work or office - what do YOU prefer?",
    "What industry interests YOU most?",
    "What would YOU do if money wasn't an issue?",
    "What's YOUR side hustle or passion project?",
    "What work achievement are YOU proud of?",
    
    # ===== HEALTH & WELLNESS =====
    "What do YOU do to stay healthy?",
    "What's YOUR favorite way to exercise?",
    "How do YOU manage stress?",
    "What helps YOU sleep better?",
    "What's YOUR go-to healthy meal?",
    "How do YOU stay mentally healthy?",
    "What wellness trend do YOU follow?",
    "Morning run or evening gym - what's YOUR preference?",
    "What's YOUR biggest health goal?",
    "Meditation or journaling - what works for YOU?",
    
    # ===== MONEY & FINANCE =====
    "What's YOUR best money-saving tip?",
    "What would YOU do with a million dollars?",
    "Spend or save - what's YOUR approach?",
    "What's the best investment in YOUR opinion?",
    "What purchase do YOU regret?",
    "What's worth spending money on?",
    "How did YOU learn about money?",
    "What financial goal are YOU working on?",
    "Cash, card, or digital payment - what do YOU use?",
    "What's YOUR approach to budgeting?",
    
    # ===== TECHNOLOGY & FUTURE =====
    "What tech innovation excites YOU most?",
    "How has technology changed YOUR life?",
    "What app could YOU not live without?",
    "AI - helpful or concerning - what do YOU think?",
    "What future technology do YOU want to see?",
    "How much screen time do YOU have daily?",
    "What's YOUR favorite tech brand?",
    "VR or AR - which interests YOU more?",
    "What technology frustrates YOU?",
    "How do YOU stay safe online?",
    
    # ===== ENVIRONMENT & WORLD =====
    "What do YOU do to help the environment?",
    "What global issue concerns YOU most?",
    "What change would YOU make in the world?",
    "Electric car or gas car - what do YOU prefer?",
    "How do YOU reduce YOUR carbon footprint?",
    "What country would YOU like to visit?",
    "City or nature - where do YOU feel at peace?",
    "What endangered animal would YOU save?",
    "Solar or wind energy - what do YOU support?",
    "What does YOUR ideal world look like?",
    
    # ===== CREATIVITY & ARTS =====
    "What creative hobby do YOU enjoy?",
    "What's YOUR favorite art form?",
    "Do YOU prefer making or watching art?",
    "What instrument would YOU learn?",
    "What's YOUR favorite painting or artwork?",
    "Writing or drawing - what do YOU prefer?",
    "What creative skill do YOU admire?",
    "Photography or videography - what interests YOU?",
    "What inspires YOUR creativity?",
    "What would YOU create if you had unlimited resources?",
    
    # ===== PHILOSOPHY & THINKING =====
    "What's YOUR purpose in life?",
    "What does happiness mean to YOU?",
    "What do YOU think happens after death?",
    "Nature or nurture - what shapes us more?",
    "What's YOUR biggest life question?",
    "Do YOU believe in fate or free will?",
    "What would YOU change about human nature?",
    "What's the meaning of life to YOU?",
    "Past or future - where would YOU travel?",
    "What legacy do YOU want to leave?",
    
    # ===== FUN & HYPOTHETICAL =====
    "If YOU could have dinner with anyone, who?",
    "What would YOUR superpower be?",
    "What would YOU name YOUR autobiography?",
    "If YOU were famous, what for?",
    "What fictional world would YOU live in?",
    "What would YOUR dream house look like?",
    "If YOU could master anything instantly, what?",
    "What animal would YOU be and why?",
    "What era would YOU time travel to?",
    "What's on YOUR bucket list?",
    
    # ===== CULTURE & SOCIETY =====
    "What tradition from another culture do YOU admire?",
    "What social change do YOU want to see?",
    "What value do YOU think society needs more of?",
    "Urban or rural life - what suits YOU?",
    "What brings YOUR community together?",
    "What cultural event do YOU look forward to?",
    "How has YOUR culture shaped YOU?",
    "What stereotype about YOUR generation is wrong?",
    "What do YOU think the next generation needs to know?",
    "What makes YOUR country unique?",
    
    # ===== MINDSET & ATTITUDE =====
    "How do YOU stay positive?",
    "What's YOUR approach to failure?",
    "Optimist or realist - which are YOU?",
    "How do YOU deal with criticism?",
    "What keeps YOU grounded?",
    "What's YOUR mantra or motto?",
    "How do YOU bounce back from setbacks?",
    "What mindset shift changed YOUR life?",
    "How do YOU stay motivated?",
    "What are YOU grateful for today?",
    
    # ===== COMMUNICATION & EXPRESSION =====
    "How do YOU express YOUR feelings?",
    "What's YOUR communication style?",
    "Public speaking - love it or hate it?",
    "How do YOU handle difficult conversations?",
    "What language do YOU wish YOU spoke?",
    "Writing or talking - how do YOU express yourself?",
    "What topic could YOU talk about for hours?",
    "How do YOU listen actively?",
    "What makes someone a good communicator?",
    "Voice message or text - what do YOU prefer?",
    
    # ===== ADVENTURE & EXPLORATION =====
    "What adventure do YOU want to go on?",
    "Mountains or ocean - what calls to YOU?",
    "What's the craziest thing YOU've done?",
    "Solo travel or group trip - what do YOU prefer?",
    "What's YOUR most memorable trip?",
    "Where would YOU go if YOU could teleport?",
    "What extreme sport would YOU try?",
    "Camping or hotel - how do YOU travel?",
    "What hidden gem have YOU discovered?",
    "What's on YOUR travel bucket list?",
    
    # ===== SIMPLE DAILY CHOICES =====
    "Tea or coffee - what's YOUR choice?",
    "Sweet or savory - what do YOU crave?",
    "Morning shower or night shower?",
    "Alarm snoozer or early riser?",
    "Planner or spontaneous - which are YOU?",
    "Shoes on or off at home?",
    "Windows open or AC - how do YOU cool down?",
    "Toilet paper over or under?",
    "Socks to bed or barefoot?",
    "Phone on silent or always ringing?",
    
    # ===== THOUGHT-PROVOKING QUESTIONS (Require Real Human Thought) =====
    
    # Education & Learning
    "What subject should be taught in every school?",
    "What's the most important lesson school DOESN'T teach?",
    "What skill will be essential in 10 years?",
    "What's the best way to teach children about money?",
    "What historical event should everyone learn about?",
    "What book should be required reading for everyone?",
    "How would YOU fix the education system?",
    "What age should kids start learning coding?",
    "What's more valuable - street smarts or book smarts?",
    "What subject do YOU wish YOU paid more attention to?",
    
    # Ethics & Morality
    "Is it ever okay to lie to protect someone?",
    "What's more important - loyalty or honesty?",
    "Should wealthy people be required to give to charity?",
    "Is revenge ever justified?",
    "What's the biggest ethical issue of our time?",
    "Should there be limits on free speech?",
    "Is it wrong to eat meat?",
    "What makes someone a good person?",
    "Can a bad deed be erased by good deeds?",
    "What's the difference between right and legal?",
    
    # Science & Discovery
    "What scientific mystery would YOU most like solved?",
    "Should we colonize Mars or fix Earth first?",
    "What invention would change the world the most?",
    "Do YOU think aliens exist?",
    "What's the most important scientific discovery ever?",
    "Should we fear artificial intelligence?",
    "What disease should we cure first?",
    "How will humans evolve in 1000 years?",
    "What's more important - space exploration or ocean exploration?",
    "Should human cloning be allowed?",
    
    # Society & Politics
    "What's the biggest problem facing your generation?",
    "How do YOU think we should handle climate change?",
    "What law would YOU create if you could?",
    "What law would YOU abolish?",
    "Should voting be mandatory?",
    "What's the ideal age for retirement?",
    "Should college be free for everyone?",
    "What's more important - freedom or security?",
    "How should countries handle immigration?",
    "What's the solution to homelessness?",
    
    # Human Nature
    "Are people born good or does society corrupt them?",
    "What drives people more - love or fear?",
    "Can people truly change?",
    "What makes humans unique from other animals?",
    "Is jealousy ever healthy?",
    "What's the root cause of most conflicts?",
    "Are humans naturally selfish or generous?",
    "What emotion is the most powerful?",
    "Why do people seek power?",
    "What's the biggest flaw in human nature?",
    
    # Life Decisions
    "What's more important - career or family?",
    "Is it better to have loved and lost or never loved at all?",
    "What age is too young to get married?",
    "Should you follow your passion or follow the money?",
    "Is it better to be a big fish in a small pond or vice versa?",
    "What's the ideal number of children to have?",
    "City life or country life - which is better for raising kids?",
    "Should you stay in a job you hate for financial security?",
    "Is it okay to give up on a dream?",
    "What's more important - being right or being kind?",
    
    # Relationships
    "What's the #1 thing that makes a relationship work?",
    "Can men and women be just friends?",
    "What's the biggest relationship red flag?",
    "Is it possible to love two people at once?",
    "What's more important in a partner - looks or personality?",
    "Should couples share all their passwords?",
    "How long should you date before getting engaged?",
    "What's the secret to a lasting marriage?",
    "Can long-distance relationships work?",
    "What's the biggest mistake people make in relationships?",
    
    # Success & Achievement
    "What does success mean to YOU?",
    "Is talent or hard work more important?",
    "What's the biggest obstacle to success?",
    "Can money buy happiness?",
    "What's better - job security or job satisfaction?",
    "Is failure necessary for success?",
    "What habit separates successful people from others?",
    "Should you share your goals or keep them private?",
    "What's more important - the journey or the destination?",
    "What would YOU sacrifice for success?",
    
    # Technology & Future
    "What technology has helped humanity the most?",
    "What technology has hurt humanity the most?",
    "Will robots take over most jobs?",
    "Should children have smartphones?",
    "At what age should kids use social media?",
    "Is social media making us more connected or more isolated?",
    "What technology do YOU wish existed?",
    "Would YOU get a chip implanted in your brain?",
    "What's the biggest threat from technology?",
    "How will technology change education?",
    
    # Deep Philosophical
    "Why do bad things happen to good people?",
    "What happens after we die?",
    "Is there such a thing as destiny?",
    "Do we have free will or is everything predetermined?",
    "What is the purpose of suffering?",
    "Is it better to know painful truths or live in blissful ignorance?",
    "What makes life worth living?",
    "Is time linear or just our perception?",
    "Does everything happen for a reason?",
    "What would YOU ask the universe if it could answer?",
    
    # Creativity & Expression
    "What art form best expresses human emotion?",
    "Is graffiti art or vandalism?",
    "What makes a song a masterpiece?",
    "Should controversial art be banned?",
    "What's more important - originality or skill?",
    "Can AI create real art?",
    "What inspires creativity the most?",
    "Is acting a form of lying?",
    "What movie changed YOUR perspective on life?",
    "What song best describes YOUR life right now?",
    
    # Health & Wellness
    "What's more important - physical or mental health?",
    "Should healthcare be free for everyone?",
    "What's the best way to handle stress?",
    "How much sleep do YOU really need?",
    "What's the healthiest diet?",
    "Is it ever okay to lie to a doctor?",
    "Should junk food have warning labels?",
    "What's more important - quantity or quality of life?",
    "How do YOU define mental wellness?",
    "What health advice do most people ignore?",
    
    # Money & Finance
    "What's the best age to start saving for retirement?",
    "Should you lend money to family?",
    "What's the smartest financial decision YOU ever made?",
    "Is it wrong to be wealthy while others suffer?",
    "What's the first thing YOU'd buy if you won the lottery?",
    "Should kids get an allowance?",
    "What's better - renting or owning a home?",
    "How much is enough money?",
    "Should parents leave equal inheritance to all children?",
    "What's the biggest financial mistake people make?",
    
    # Parenting & Family
    "What's the most important value to teach children?",
    "Should parents be strict or lenient?",
    "What age should kids get their first phone?",
    "Is spanking ever acceptable?",
    "What's the best way to handle a child's tantrum?",
    "Should kids be allowed to fail?",
    "What's the hardest part of being a parent?",
    "How do YOU balance work and family?",
    "What did YOUR parents do right?",
    "What would YOU do differently than your parents?",
    
    # World Issues
    "What's the biggest threat to humanity?",
    "Can world peace ever be achieved?",
    "What country has the best quality of life?",
    "How should the world handle refugees?",
    "What's the solution to poverty?",
    "Should nuclear weapons be abolished?",
    "What's the most pressing environmental issue?",
    "Can capitalism and sustainability coexist?",
    "What's the most overlooked global problem?",
    "If YOU were world leader, what would YOU change first?",
    
    # Personal Reflection
    "What's YOUR greatest strength?",
    "What's YOUR biggest weakness?",
    "What are YOU most proud of?",
    "What do YOU regret the most?",
    "What lesson took YOU the longest to learn?",
    "What would YOUR childhood self think of YOU now?",
    "What's the bravest thing YOU've ever done?",
    "What's YOUR biggest insecurity?",
    "When do YOU feel most alive?",
    "What would YOU tell yourself 5 years ago?",
    
    # Hypothetical Scenarios
    "If YOU could live in any era, which would it be?",
    "If YOU could have any job for a day, what would it be?",
    "If YOU could talk to any historical figure, who?",
    "If YOU could solve one world problem, which one?",
    "If YOU could live anywhere in the world, where?",
    "If YOU could be any age forever, what age?",
    "If YOU could have any animal as a pet, which one?",
    "If YOU could witness any event in history, which one?",
    "If YOU had to eat one food forever, what would it be?",
    "If YOU could read minds, would YOU want to?",
    
    # Opinion Questions
    "What's overrated that everyone loves?",
    "What's underrated that deserves more attention?",
    "What trend needs to die?",
    "What trend deserves to come back?",
    "What's the most annoying thing people do?",
    "What's the best decade for music?",
    "What makes someone attractive?",
    "What's the best compliment YOU've ever received?",
    "What's the worst advice people commonly give?",
    "What's the best piece of advice YOU ever got?",
    
    # Cultural & Generational
    "What will YOUR generation be remembered for?",
    "What do older generations not understand?",
    "What do younger generations not understand?",
    "What tradition should we keep?",
    "What tradition should we abandon?",
    "What's YOUR generation's biggest contribution?",
    "What's YOUR generation's biggest mistake?",
    "How has YOUR culture influenced YOU?",
    "What cultural norm needs to change?",
    "What makes YOUR hometown special?",
    
    # Work & Career
    "What makes a great leader?",
    "What's the worst job YOU've ever had?",
    "What makes a workplace toxic?",
    "Should you be friends with coworkers?",
    "What's more important - passion or practicality?",
    "How do YOU handle workplace conflict?",
    "What's the best career advice YOU've received?",
    "Is work-life balance possible?",
    "What industry will grow the most?",
    "What job will disappear in 20 years?",
    
    # Simple But Deep
    "What's ONE word that describes YOU?",
    "What's YOUR biggest dream?",
    "What scares YOU the most?",
    "What gives YOUR life meaning?",
    "Who has influenced YOU the most?",
    "What do YOU stand for?",
    "What would YOU die for?",
    "What do YOU live for?",
    "What truth do YOU believe that others don't?",
    "What question do YOU wish people asked YOU?",
    
    # Fun But Thought-Provoking
    "What would YOUR dream day look like?",
    "If YOUR life was a movie, what genre would it be?",
    "What would YOUR autobiography be titled?",
    "What would be YOUR entrance song?",
    "What would YOUR alter ego be named?",
    "If YOU were a superhero, what would YOUR power be?",
    "What would YOUR last meal on Earth be?",
    "If YOU could master one skill overnight, which one?",
    "What would YOU do with an extra hour each day?",
    "If money didn't exist, what would YOU do?",
    
    # Quick Decision Questions
    "Fight one horse-sized duck or 100 duck-sized horses?",
    "Would YOU rather be famous or anonymous?",
    "Would YOU rather know how or when YOU'll die?",
    "Would YOU rather be rich and alone or poor with friends?",
    "Would YOU rather relive the past or see the future?",
    "Would YOU rather never work or never have free time?",
    "Would YOU rather have more time or more money?",
    "Would YOU rather be smart or happy?",
    "Would YOU rather be liked or respected?",
    "Would YOU rather change the past or see the future?",
]

# ============== GAME STATE ==============
class LiveSurveyState:
    def __init__(self):
        self.current_question = None
        self.question_start_time = None
        self.question_duration = 50  # 50 seconds for answering
        self.results_duration = 10   # 10 seconds to show results
        self.batch_duration = 600    # 10 minutes per batch
        
        # Current batch tracking
        self.batch_start_time = None
        self.batch_id = None
        self.batch_number = 0
        
        # Track used questions in current batch (no repeats)
        self.used_questions_in_batch: Set[str] = set()
        
        # Answer tracking for current question
        self.answers: Dict[str, str] = {}  # player_id -> answer
        self.answer_counts: Counter = Counter()  # normalized_answer -> count
        
        # Player sessions for current batch (real + AI)
        self.player_sessions: Dict[str, dict] = {}
        
        # AI player count for display (simulated active players)
        self.ai_player_count = 0
        
        # Connected WebSocket clients
        self.connected_clients: Set[WebSocket] = set()
        
        # Game state
        self.is_running = False
        self.question_number = 0
        self.showing_results = False
        self.last_results = None
        
        # NEW: Lightning Round state
        self.lightning_round = False
        self.lightning_round_multiplier = 2
        self.lightning_question_duration = 30  # 30 seconds for lightning
        
        # NEW: Typing indicators (player_id -> timestamp)
        self.typing_players: Dict[str, datetime] = {}
        
        # NEW: Recent events for celebrations
        self.recent_events: List[dict] = []
        
    # Lazy/unhelpful answers to filter out from top answers display
    LAZY_ANSWERS = {
        "idk", "i dont know", "i don't know", "dont know", "don't know",
        "maybe", "not sure", "unsure", "probably", "idc", "i dont care",
        "whatever", "anything", "nothing", "none", "na", "n/a", "no idea",
        "dunno", "no clue", "who knows", "depends", "it depends", "both",
        "either", "neither", "yes", "no", "ok", "okay", "sure", "nope",
        "yep", "yeah", "nah", "meh", "eh", "um", "uh", "hmm", "lol",
        "haha", "lmao", "bruh", "same", "true", "false", "test", "testing",
        "asdf", "qwerty", "abc", "123", "hi", "hello", "hey"
    }
    
    def normalize_answer(self, answer: str) -> str:
        """Normalize answer for grouping similar responses"""
        if not answer:
            return ""
        # Lowercase, strip whitespace, remove punctuation
        normalized = answer.lower().strip()
        normalized = re.sub(r'[^\w\s]', '', normalized)
        # Remove common articles
        normalized = re.sub(r'^(the|a|an)\s+', '', normalized)
        return normalized.strip()
    
    def is_lazy_answer(self, answer: str) -> bool:
        """Check if answer is lazy/unhelpful"""
        normalized = self.normalize_answer(answer)
        return normalized in self.LAZY_ANSWERS or len(normalized) < 2
    
    def get_time_remaining(self) -> int:
        if not self.question_start_time:
            return self.question_duration
        elapsed = (datetime.now(timezone.utc) - self.question_start_time).total_seconds()
        return max(0, int(self.question_duration - elapsed))
    
    def get_batch_time_remaining(self) -> int:
        if not self.batch_start_time:
            return self.batch_duration
        elapsed = (datetime.now(timezone.utc) - self.batch_start_time).total_seconds()
        return max(0, int(self.batch_duration - elapsed))
    
    def get_answer_percentage(self, answer: str) -> int:
        """Get percentage of players who gave same answer"""
        if not self.answer_counts:
            return 0
        normalized = self.normalize_answer(answer)
        total = sum(self.answer_counts.values())
        if total == 0:
            return 0
        return round((self.answer_counts.get(normalized, 0) / total) * 100)
    
    def get_same_answer_count(self, answer: str) -> int:
        """Get count of players who gave same answer"""
        normalized = self.normalize_answer(answer)
        return self.answer_counts.get(normalized, 0)
    
    def get_top_answers(self, count: int = 4) -> List[dict]:
        """Get top N answers with counts and percentages, filtering out lazy answers"""
        if not self.answer_counts:
            return []
        total = sum(self.answer_counts.values())
        
        # Filter out lazy answers from display
        filtered_answers = [
            (answer, cnt) for answer, cnt in self.answer_counts.most_common(count * 3)
            if not self.is_lazy_answer(answer)
        ][:count]
        
        return [
            {
                "answer": answer,
                "count": cnt,
                "percent": round((cnt / total) * 100) if total > 0 else 0
            }
            for answer, cnt in filtered_answers
        ]
    
    def get_total_players(self) -> int:
        """Get total player count (real + AI) for display"""
        real_players = len([p for p in self.player_sessions if not p.startswith("ai_")])
        return real_players + self.ai_player_count
    
    def get_total_answers(self) -> int:
        """Get total answers submitted"""
        return sum(self.answer_counts.values())
    
    def get_state(self) -> dict:
        """Get synced game state for all platforms"""
        # Clean up old typing indicators (older than 3 seconds)
        now = datetime.now(timezone.utc)
        self.typing_players = {
            k: v for k, v in self.typing_players.items() 
            if (now - v).total_seconds() < 3
        }
        
        # Get typing player names (without AI prefix)
        typing_names = []
        for player_id in list(self.typing_players.keys())[:5]:  # Max 5 shown
            if player_id in self.player_sessions:
                name = self.player_sessions[player_id].get("name", "Player")
                if not name.startswith("ai_"):
                    typing_names.append(name)
        
        return {
            "question": self.current_question,
            "question_number": self.question_number,
            "time_remaining": self.get_time_remaining(),
            "batch_time_remaining": self.get_batch_time_remaining(),
            "batch_number": self.batch_number,
            "total_answers": self.get_total_answers(),
            "player_count": self.get_total_players(),  # Synced across all platforms
            "is_live": self.is_running,
            "showing_results": self.showing_results,
            "top_answers": self.get_top_answers(4) if self.showing_results else [],
            "last_results": self.last_results,
            # NEW: Lightning round state
            "lightning_round": self.lightning_round,
            "lightning_multiplier": self.lightning_round_multiplier if self.lightning_round else 1,
            # NEW: Typing indicators
            "typing_players": typing_names,
            # NEW: Recent celebration events
            "recent_events": self.recent_events[-5:] if self.recent_events else []
        }

# Global game state
survey_game = LiveSurveyState()

# ============== AI VOTER SIMULATION ==============
AI_COMMON_ANSWERS = {
    "drink": ["water", "coke", "coffee", "juice", "tea", "pepsi", "sprite", "lemonade"],
    "coffee": ["latte", "cappuccino", "black coffee", "iced coffee", "mocha", "espresso", "americano"],
    "pizza": ["pepperoni", "cheese", "mushrooms", "sausage", "pineapple", "bacon", "supreme"],
    "ice cream": ["vanilla", "chocolate", "strawberry", "mint", "cookie dough", "cookies and cream"],
    "snack": ["chips", "popcorn", "candy", "fruit", "cookies", "crackers", "pretzels"],
    "breakfast": ["eggs", "cereal", "pancakes", "toast", "bacon", "oatmeal", "waffles"],
    "fast food": ["mcdonald's", "chick-fil-a", "wendy's", "taco bell", "burger king", "subway"],
    "candy": ["snickers", "reese's", "m&ms", "skittles", "kit kat", "twix"],
    "refrigerator": ["milk", "eggs", "cheese", "leftovers", "water", "butter", "fruit"],
    
    "wake up": ["check phone", "brush teeth", "shower", "coffee", "bathroom", "stretch"],
    "carry": ["phone", "wallet", "keys", "id", "chapstick", "earbuds"],
    "relax": ["watch tv", "sleep", "read", "music", "gaming", "bath", "walk"],
    "rainy": ["sleep", "watch tv", "read", "movies", "stay inside", "video games"],
    "weekend": ["sleep", "relax", "go out", "watch tv", "sports", "shopping", "family"],
    "happy": ["family", "friends", "music", "food", "money", "love", "vacation"],
    "stress": ["sleep", "exercise", "music", "eat", "talk", "meditate", "walk"],
    "bed": ["10pm", "11pm", "midnight", "9pm", "12am", "1am", "depends"],
    "guilty": ["junk food", "tv", "sleeping in", "shopping", "candy", "ice cream"],
    
    "streaming": ["netflix", "youtube", "disney+", "hulu", "hbo max", "amazon prime"],
    "movie": ["action", "comedy", "horror", "drama", "romance", "sci-fi", "thriller"],
    "game": ["fortnite", "minecraft", "call of duty", "gta", "fifa", "roblox", "2k"],
    "tv show": ["the office", "friends", "stranger things", "game of thrones", "breaking bad"],
    "music": ["hip hop", "pop", "rock", "r&b", "country", "rap", "edm"],
    "app": ["tiktok", "instagram", "youtube", "twitter", "snapchat", "spotify"],
    "social": ["tiktok", "instagram", "facebook", "twitter", "snapchat", "youtube"],
    "youtube": ["gaming", "music", "vlogs", "comedy", "tutorials", "sports"],
    "celebrity": ["beyonce", "drake", "lebron", "taylor swift", "dwayne johnson", "zendaya"],
    
    "sport": ["football", "basketball", "soccer", "baseball", "tennis", "golf"],
    "team": ["lakers", "warriors", "cowboys", "patriots", "yankees", "bulls"],
    "nba": ["celtics", "lakers", "nuggets", "warriors", "heat", "bucks"],
    "exercise": ["running", "gym", "walking", "weights", "yoga", "none"],
    "outdoor": ["hiking", "beach", "park", "camping", "biking", "swimming"],
    "hobby": ["gaming", "reading", "cooking", "music", "sports", "art"],
    "car": ["toyota", "honda", "ford", "bmw", "tesla", "chevrolet", "mercedes"],
    "vacation": ["hawaii", "europe", "caribbean", "disney", "beach", "mountains"],
    
    "mom or dad": ["mom", "dad", "both", "mom", "mom", "dad", "neither"],
    "fear": ["spiders", "heights", "death", "snakes", "dark", "failure", "public speaking"],
    "superpower": ["flying", "invisibility", "time travel", "super strength", "teleportation", "mind reading"],
    "zodiac": ["leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius"],
    "morning or night": ["morning", "night", "night", "morning", "night owl", "morning person"],
    "dogs or cats": ["dogs", "cats", "dogs", "both", "dogs", "cats", "neither"],
    "color": ["blue", "red", "green", "purple", "black", "pink", "white"],
    "season": ["summer", "fall", "spring", "winter", "summer", "fall"],
    "beach or mountain": ["beach", "mountains", "beach", "both", "beach", "mountains"],
    "dream job": ["doctor", "athlete", "actor", "business owner", "musician", "travel"],
    
    "phone": ["iphone", "samsung", "apple", "android", "iphone", "google pixel"],
    "car brand": ["toyota", "honda", "tesla", "bmw", "mercedes", "ford"],
    "pay": ["card", "cash", "card", "apple pay", "cash", "debit"],
    "city or country": ["city", "country", "suburbs", "city", "country", "city"],
    "resolution": ["lose weight", "exercise", "save money", "eat healthy", "quit smoking"],
    "skill": ["cooking", "music", "languages", "coding", "sports", "art"],
    "pet peeve": ["loud chewing", "being late", "lying", "rudeness", "traffic"],
    
    # NEW: Pop Culture answers
    "social media platform": ["tiktok", "instagram", "twitter", "youtube", "snapchat", "reddit"],
    "excited for": ["avengers", "batman", "marvel", "disney", "dune", "star wars"],
    "content creator": ["mrbeast", "pewdiepie", "kai cenat", "dream", "markiplier", "adin ross"],
    "meme": ["cat memes", "dog memes", "relatable", "dank memes", "twitter memes"],
    "overrated": ["tiktok", "influencers", "crypto", "nfts", "ai", "nothing"],
    "ai": ["scary", "cool", "helpful", "taking over", "amazing", "concerning"],
    
    # NEW: Would You Rather answers
    "netflix or": ["netflix", "youtube", "both", "netflix", "youtube"],
    "iphone or android": ["iphone", "android", "iphone", "samsung", "both"],
    "uber or": ["uber", "drive", "lyft", "depends", "uber"],
    "text or call": ["text", "call", "text", "facetime", "text", "neither"],
    "cooking or ordering": ["cooking", "ordering", "both", "delivery", "cooking"],
    
    # NEW: Quick fire answers
    "fast food chain": ["mcdonald's", "chick-fil-a", "wendy's", "taco bell", "five guys"],
    "pizza topping": ["pepperoni", "cheese", "sausage", "mushroom", "pineapple"],
    "chore": ["dishes", "laundry", "cleaning", "vacuuming", "cooking"],
    "day of the week": ["friday", "saturday", "sunday", "thursday", "friday"],
    "holiday": ["christmas", "thanksgiving", "halloween", "new years", "fourth of july"],
    "disney": ["lion king", "frozen", "moana", "toy story", "finding nemo"],
    "superhero": ["spider-man", "batman", "iron man", "superman", "wolverine"],
    "midnight snack": ["chips", "cereal", "ice cream", "pizza", "leftovers"],
    "board game": ["monopoly", "uno", "chess", "scrabble", "clue"],
    "smell": ["fresh cookies", "coffee", "rain", "vanilla", "bacon", "flowers"],
    
    # NEW: Experience answers  
    "concert": ["beyonce", "drake", "taylor swift", "travis scott", "bad bunny"],
    "emoji": ["😂", "❤️", "🔥", "💀", "😭", "🙏"],
    "karaoke": ["bohemian rhapsody", "sweet caroline", "dont stop believin", "my way"],
    "everyone loves": ["avocado", "coffee", "marvel movies", "pop music", "disney"],
    "unpopular opinion": ["water is overrated", "dogs are better", "pineapple on pizza"],
    "collect": ["sneakers", "cards", "funko pops", "records", "books", "nothing"],
    "comfort show": ["the office", "friends", "how i met your mother", "seinfeld"],
    "forget": ["keys", "names", "passwords", "charger", "wallet"],
    "hidden talent": ["singing", "cooking", "dancing", "drawing", "none"],
    "kid": ["astronaut", "doctor", "athlete", "teacher", "vet", "firefighter"],
}

# ============== YES/NO QUESTION DETECTION ==============
YES_NO_PATTERNS = [
    # Direct Yes/No starters (must be at start of question)
    r"^do you\b", r"^are you\b", r"^is it\b", r"^have you\b", r"^will you\b",
    r"^can you\b", r"^should\b", r"^would you\b", r"^could you\b", r"^did you\b",
    r"^does\b", r"^has\b", r"^was\b", r"^were\b", r"^is\s+\w+\b",
    # Boolean choice patterns (can be anywhere)
    r"\byes or no\b", r"\btrue or false\b", r"\bagree or disagree\b",
    # "Is it ever okay" patterns (must be at start)
    r"^is it ever\b", r"^is it okay\b", r"^is it wrong\b", r"^is it right\b",
    r"^is it possible\b", r"^is it better\b",
    # Opinion Yes/No - ONLY at start of question (fixed false positives)
    r"^do you believe\b", r"^do you think\b", r"^do you agree\b",
]

BINARY_CHOICE_PATTERNS = [
    # "X or Y" patterns - these need exactly 2 options
    (r"(.+)\s+or\s+(.+)\s*[-–—]\s*(?:which|what)", 2),  # "X or Y - which/what"
    (r"^(.+)\s+or\s+(.+)\?$", 2),  # "X or Y?" at end
    (r"(.+)\s+vs\.?\s+(.+)", 2),  # "X vs Y"
]

def is_yes_no_question(question: str) -> bool:
    """Detect if question expects Yes/No answer"""
    q_lower = question.lower().strip()
    for pattern in YES_NO_PATTERNS:
        if re.search(pattern, q_lower):
            return True
    return False

def extract_binary_choices(question: str) -> Optional[List[str]]:
    """Extract the two options from 'X or Y' style questions"""
    q_lower = question.lower().strip()
    
    # Pattern: "X or Y - which/what do YOU prefer?"
    match = re.search(r"^(.+?)\s+or\s+(.+?)\s*[-–—]\s*(?:which|what|where|how)", q_lower)
    if match:
        opt1 = match.group(1).strip().title()
        opt2 = match.group(2).strip().split()[0].title()  # Take first word of second option
        return [opt1, opt2, "Both", "Neither"]
    
    # Pattern: "X or Y?" at end of question 
    # e.g., "Netflix or YouTube - where do YOU spend more time?"
    # e.g., "Dogs or cats - what do YOU prefer?"
    for keyword in ["netflix", "youtube", "iphone", "android", "dogs", "cats", "beach", "mountain", 
                    "coffee", "tea", "morning", "night", "city", "country", "uber", "drive",
                    "text", "call", "cooking", "ordering", "mom", "dad", "summer", "winter"]:
        if keyword in q_lower:
            # Check if it's an "or" question
            if " or " in q_lower:
                parts = q_lower.split(" or ")
                if len(parts) >= 2:
                    # Extract clean options
                    opt1 = parts[0].split()[-1].title()  # Last word before "or"
                    opt2_words = parts[1].split()
                    opt2 = opt2_words[0].title() if opt2_words else "Other"
                    return [opt1, opt2, "Both", "Neither"]
    
    return None

def get_ai_answers_for_question(question: str) -> List[str]:
    """Get contextual AI answers based on question type and keywords"""
    question_lower = question.lower()
    
    # === STEP 1: Check for Yes/No questions ===
    if is_yes_no_question(question):
        logger.info(f"[AI-ANSWERS] Detected YES/NO question: '{question[:50]}...'")
        return ["Yes", "No"]
    
    # === STEP 2: Check for binary choice questions (X or Y) ===
    binary_choices = extract_binary_choices(question)
    if binary_choices:
        logger.info(f"[AI-ANSWERS] Detected BINARY question: '{question[:50]}...' → {binary_choices}")
        return binary_choices
    
    # === STEP 3: Extended keyword matching for specific answers ===
    extended_answers = {
        # Temperature/Weather
        "cool down": ["ac", "air conditioning", "fan", "cold shower", "ice water", "swimming", "shade", "windows open"],
        "windows": ["ac", "air conditioning", "fan", "windows open", "both", "depends on weather"],
        "ac": ["ac", "windows open", "fan", "both", "air conditioning", "depends"],
        "hot": ["ac", "fan", "cold drink", "swimming", "ice cream", "shade", "cold shower"],
        "warm": ["ac", "fan", "cold drink", "light clothes", "cold shower"],
        
        # Time/Schedule
        "wake up": ["check phone", "bathroom", "brush teeth", "shower", "coffee", "stretch", "alarm snooze"],
        "morning": ["coffee", "shower", "breakfast", "exercise", "news", "meditation"],
        "night": ["read", "tv", "phone", "sleep", "music", "podcast"],
        "sleep": ["10pm", "11pm", "midnight", "9pm", "late", "depends", "whenever tired"],
        "bed": ["10pm", "11pm", "midnight", "9pm", "12am", "1am", "depends"],
        
        # Food & Drinks
        "thirsty": ["water", "juice", "soda", "tea", "coffee", "gatorade", "lemonade"],
        "drink": ["water", "coke", "coffee", "juice", "tea", "pepsi", "sprite", "lemonade"],
        "coffee": ["latte", "cappuccino", "black coffee", "iced coffee", "mocha", "espresso", "americano"],
        "pizza": ["pepperoni", "cheese", "mushrooms", "sausage", "meat lovers", "supreme", "margherita"],
        "ice cream": ["vanilla", "chocolate", "strawberry", "mint chocolate chip", "cookie dough", "cookies and cream"],
        "snack": ["chips", "popcorn", "fruit", "cookies", "crackers", "nuts", "candy"],
        "breakfast": ["eggs", "cereal", "pancakes", "toast", "bacon", "oatmeal", "waffles", "bagel"],
        "fast food": ["mcdonald's", "chick-fil-a", "wendy's", "taco bell", "burger king", "subway", "five guys"],
        "candy": ["snickers", "reese's", "m&ms", "skittles", "kit kat", "twix", "starburst"],
        "refrigerator": ["milk", "eggs", "cheese", "leftovers", "water", "butter", "vegetables", "fruit"],
        "topping": ["pepperoni", "cheese", "sausage", "mushrooms", "peppers", "olives", "bacon"],
        
        # Entertainment
        "streaming": ["netflix", "youtube", "disney+", "hulu", "hbo max", "amazon prime", "peacock"],
        "movie": ["action", "comedy", "horror", "drama", "romance", "sci-fi", "thriller", "animation"],
        "game": ["fortnite", "minecraft", "call of duty", "gta", "fifa", "nba 2k", "roblox", "zelda"],
        "tv show": ["the office", "friends", "stranger things", "game of thrones", "breaking bad", "succession"],
        "music": ["hip hop", "pop", "rock", "r&b", "country", "rap", "edm", "latin"],
        "app": ["tiktok", "instagram", "youtube", "twitter", "snapchat", "spotify", "whatsapp"],
        "social": ["tiktok", "instagram", "facebook", "twitter", "snapchat", "youtube", "reddit"],
        "youtube": ["gaming", "music", "vlogs", "comedy", "tutorials", "sports", "cooking"],
        "celebrity": ["beyonce", "drake", "lebron", "taylor swift", "the rock", "zendaya", "bad bunny"],
        
        # Sports
        "sport": ["football", "basketball", "soccer", "baseball", "tennis", "golf", "hockey"],
        "team": ["lakers", "warriors", "cowboys", "patriots", "yankees", "bulls", "chiefs"],
        "nba": ["celtics", "lakers", "nuggets", "warriors", "heat", "bucks", "76ers"],
        "exercise": ["running", "gym", "walking", "weights", "yoga", "swimming", "biking"],
        "outdoor": ["hiking", "beach", "park", "camping", "biking", "swimming", "fishing"],
        "hobby": ["gaming", "reading", "cooking", "music", "sports", "art", "gardening"],
        
        # History & Culture
        "historical period": ["ancient rome", "medieval", "renaissance", "1920s", "1960s", "victorian era", "ancient egypt"],
        "era": ["ancient rome", "medieval", "renaissance", "1920s", "1960s", "victorian era", "ancient egypt"],
        "fascinate": ["ancient civilizations", "space", "world wars", "dinosaurs", "ancient egypt", "medieval times"],
        "time travel": ["1960s", "medieval times", "ancient rome", "1920s", "the future", "ancient egypt"],
        
        # Knowledge & Learning
        "subject": ["math", "science", "history", "english", "art", "music", "pe"],
        "school": ["math", "science", "history", "english", "art", "music", "pe"],
        "learn": ["new language", "coding", "music", "cooking", "art", "self-defense"],
        "language": ["spanish", "french", "japanese", "mandarin", "german", "italian", "korean"],
        
        # Abstract/Opinion
        "purpose": ["family", "happiness", "helping others", "success", "love", "making a difference"],
        "meaning": ["family", "love", "happiness", "helping others", "success", "experiences"],
        "define": ["happiness", "success", "love", "family", "health", "freedom"],
        "legacy": ["helping others", "family", "career", "impact", "kindness", "memories"],
        
        # Lifestyle
        "relax": ["watch tv", "sleep", "read", "music", "gaming", "bath", "walk", "meditation"],
        "rainy": ["sleep", "watch tv", "read", "movies", "stay inside", "video games", "cozy up"],
        "weekend": ["sleep in", "relax", "go out", "family time", "sports", "shopping", "chores"],
        "happy": ["family", "friends", "music", "food", "money", "love", "vacation", "pets"],
        "stress": ["exercise", "music", "sleep", "talk to someone", "meditate", "walk", "deep breaths"],
        "guilty": ["junk food", "tv binging", "sleeping in", "shopping", "candy", "social media"],
        
        # Career & Work
        "industry": ["tech", "healthcare", "finance", "entertainment", "education", "marketing"],
        "career": ["doctor", "engineer", "teacher", "business owner", "artist", "lawyer"],
        "job": ["remote work", "creative field", "leadership", "helping others", "tech", "travel"],
        "work": ["hybrid", "remote", "office", "team", "solo", "flexible hours"],
        "boss": ["supportive", "understanding", "inspiring", "flexible", "respectful"],
        "coworker": ["friendly", "helpful", "professional", "collaborative", "fun"],
        
        # Purchases & Regrets
        "purchase": ["expensive item", "impulse buy", "subscription", "clothes", "gadget"],
        "regret": ["not saving", "wrong relationship", "not taking risks", "impulse buy"],
        "worth it": ["experiences", "travel", "education", "health", "quality items"],
        
        # Preferences
        "mom or dad": ["Mom", "Dad", "Both", "Neither"],
        "dogs or cats": ["Dogs", "Cats", "Both", "Neither"],
        "color": ["blue", "red", "green", "purple", "black", "pink", "white", "yellow"],
        "season": ["summer", "fall", "spring", "winter", "fall", "summer"],
        "beach or mountain": ["Beach", "Mountains", "Both", "Neither"],
        
        # Tech
        "phone": ["iphone", "samsung", "android", "apple", "pixel", "iphone"],
        "iphone or android": ["iPhone", "Android", "Both", "Neither"],
        "tech": ["AI", "smartphones", "electric cars", "VR", "social media", "gaming"],
        "gadget": ["smartphone", "laptop", "smartwatch", "headphones", "tablet"],
        
        # Binary Choice Questions - specific mappings
        "netflix or youtube": ["Netflix", "YouTube", "Both", "Neither"],
        "coffee or tea": ["Coffee", "Tea", "Both", "Neither"],
        "text or call": ["Text", "Call", "Both", "Neither"],
        "uber or driving": ["Uber", "Drive", "Both", "Depends"],
        "uber or lyft": ["Uber", "Lyft", "Both", "Neither"],
        "morning or night": ["Morning", "Night", "Both", "Neither"],
        "early bird or night owl": ["Morning Person", "Night Owl", "Both", "Neither"],
        "city or country": ["City", "Country", "Suburbs", "Neither"],
        "cooking or ordering": ["Cooking", "Ordering", "Both", "Depends"],
        "summer or winter": ["Summer", "Winter", "Both", "Neither"],
        "reading or watching": ["Reading", "Watching", "Both", "Neither"],
        "online or in-store": ["Online", "In-Store", "Both", "Depends"],
        "cash or card": ["Cash", "Card", "Both", "Digital"],
        "renting or owning": ["Renting", "Owning", "Depends", "Neither"],
        
        # Money & Finance
        "money": ["budgeting", "saving", "investing", "working", "allowance", "experience"],
        "teach children": ["allowance", "saving", "budgeting", "chores for money", "piggy bank", "experience"],
        "save money": ["cook at home", "budget", "cut subscriptions", "thrift stores", "coupons"],
        "financial": ["budgeting", "investing", "saving", "planning", "education"],
        "lottery": ["pay off debt", "invest", "buy a house", "travel", "help family", "save"],
        "spend": ["experiences", "food", "travel", "family", "hobbies", "savings"],
        "budget": ["apps", "spreadsheet", "50/30/20 rule", "envelope method", "automatic"],
        
        # Life Advice & Lessons
        "advice": ["be yourself", "work hard", "save money", "be kind", "follow dreams", "stay healthy"],
        "lesson": ["patience", "kindness", "hard work", "money management", "relationships"],
        "regret": ["not taking risks", "not spending time with family", "not saving", "not traveling"],
        "accomplish": ["graduated", "got a job", "started a business", "helped others", "traveled"],
        "proud": ["family", "career", "helping others", "education", "personal growth"],
        "grateful": ["family", "health", "friends", "opportunity", "life", "love"],
        "mistake": ["not saving", "wrong relationship", "not following dreams", "being lazy"],
        "younger self": ["save money", "be confident", "take risks", "enjoy life", "study harder"],
        
        # Compliments & Personal
        "compliment": ["you're kind", "you're smart", "you're funny", "you're beautiful", "you're inspiring"],
        "best thing": ["family", "friends", "job", "health", "love", "success"],
        "worst thing": ["losing someone", "failure", "regret", "heartbreak", "illness"],
        
        # Generation/Contribution
        "generation": ["technology", "social media", "awareness", "creativity", "diversity", "innovation"],
        "contribution": ["technology", "internet", "social change", "innovation", "music", "activism"],
    }
    
    # === STEP 4: Check extended keyword answers ===
    for keyword, answers in extended_answers.items():
        if keyword in question_lower:
            logger.info(f"[AI-ANSWERS] Matched keyword '{keyword}' → {answers[:3]}...")
            return answers
    
    # === STEP 5: Check original AI_COMMON_ANSWERS ===
    for keyword, answers in AI_COMMON_ANSWERS.items():
        if keyword in question_lower:
            return answers
    
    # === STEP 6: Better default fallback ===
    logger.info(f"[AI-ANSWERS] No keyword match for: '{question[:50]}...' - using defaults")
    return [
        "family", "friends", "music", "travel", "food", "health", 
        "money", "love", "happiness", "success", "freedom", "peace"
    ]

async def simulate_ai_answers():
    """Add AI answers to make the game feel active"""
    while survey_game.is_running:
        if survey_game.current_question and survey_game.get_time_remaining() > 10 and not survey_game.showing_results:
            # Add 2-4 AI answers every 3-5 seconds
            num_answers = random.randint(2, 4)
            ai_options = get_ai_answers_for_question(survey_game.current_question)
            
            for _ in range(num_answers):
                answer = random.choice(ai_options)
                ai_id = f"ai_{uuid.uuid4().hex[:6]}"
                
                normalized = survey_game.normalize_answer(answer)
                if normalized:
                    survey_game.answers[ai_id] = answer
                    survey_game.answer_counts[normalized] += 1
            
            # Broadcast answer update
            await broadcast_answer_update()
        
        await asyncio.sleep(random.uniform(3, 5))

async def simulate_ai_players():
    """Simulate AI player count fluctuations"""
    while survey_game.is_running:
        # Fluctuate AI player count between 20-80
        base = random.randint(30, 60)
        variation = random.randint(-10, 10)
        survey_game.ai_player_count = max(20, base + variation)
        await asyncio.sleep(random.uniform(5, 10))

# ============== QUESTION ROTATION ==============
# Global question history to avoid repetition across batches
_question_history: List[str] = []
_shuffled_question_pool: List[str] = []
# 24-hour tracking: {question: timestamp} - persists questions used in last 24 hours
_24h_question_tracker: Dict[str, datetime] = {}
QUESTION_COOLDOWN_HOURS = 24  # No repeat for 24 hours

def _ensure_shuffled_pool():
    """Ensure we have a shuffled pool of questions"""
    global _shuffled_question_pool
    if not _shuffled_question_pool:
        # Create a fresh shuffled copy of all questions
        _shuffled_question_pool = SURVEY_QUESTIONS.copy()
        random.shuffle(_shuffled_question_pool)

def _clean_expired_questions():
    """Remove questions older than 24 hours from tracker"""
    global _24h_question_tracker
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=QUESTION_COOLDOWN_HOURS)
    _24h_question_tracker = {
        q: ts for q, ts in _24h_question_tracker.items() 
        if ts > cutoff
    }

def _is_question_on_cooldown(question: str) -> bool:
    """Check if question was used in last 24 hours"""
    _clean_expired_questions()
    return question in _24h_question_tracker

def _mark_question_used(question: str):
    """Mark question as used with current timestamp"""
    _24h_question_tracker[question] = datetime.now(timezone.utc)

def get_next_question() -> str:
    """Get next question with 24-hour deduplication"""
    global _shuffled_question_pool
    
    _ensure_shuffled_pool()
    _clean_expired_questions()
    
    # Find a question that's not on cooldown
    attempts = 0
    max_attempts = len(SURVEY_QUESTIONS) * 2
    
    while attempts < max_attempts:
        if not _shuffled_question_pool:
            # Reshuffle when pool is empty
            _shuffled_question_pool = SURVEY_QUESTIONS.copy()
            random.shuffle(_shuffled_question_pool)
        
        # Take from the shuffled pool
        question = _shuffled_question_pool.pop(0)
        
        # Check 24-hour cooldown
        if not _is_question_on_cooldown(question):
            # Mark as used
            _mark_question_used(question)
            survey_game.used_questions_in_batch.add(question)
            logger.info(f"[24H-TRACKER] Selected: '{question[:40]}...' | {len(_24h_question_tracker)} questions on cooldown")
            return question
        
        # Put it back at the end if on cooldown
        _shuffled_question_pool.append(question)
        attempts += 1
    
    # Fallback: If ALL questions are on cooldown (unlikely with 600+ questions)
    # Clear the oldest half of cooldown tracker and try again
    logger.warning(f"[24H-TRACKER] All questions on cooldown! Clearing oldest...")
    sorted_questions = sorted(_24h_question_tracker.items(), key=lambda x: x[1])
    _24h_question_tracker.clear()
    # Keep only the newest half
    for q, ts in sorted_questions[len(sorted_questions)//2:]:
        _24h_question_tracker[q] = ts
    
    if not _shuffled_question_pool:
        _shuffled_question_pool = SURVEY_QUESTIONS.copy()
        random.shuffle(_shuffled_question_pool)
    
    question = _shuffled_question_pool.pop(0)
    _mark_question_used(question)
    survey_game.used_questions_in_batch.add(question)
    return question

async def rotate_questions():
    """Main game loop - rotates questions and manages 10-min batches"""
    while survey_game.is_running:
        # Check if new batch needed
        if survey_game.batch_start_time is None or survey_game.get_batch_time_remaining() <= 0:
            await start_new_batch()
        
        # Select next question (no repeats in batch)
        survey_game.question_number += 1
        survey_game.current_question = get_next_question()
        survey_game.question_start_time = datetime.now(timezone.utc)
        survey_game.showing_results = False
        
        # Reset answers for new question
        survey_game.answers.clear()
        survey_game.answer_counts.clear()
        
        # Add initial AI answers (20-40)
        ai_options = get_ai_answers_for_question(survey_game.current_question)
        for _ in range(random.randint(20, 40)):
            answer = random.choice(ai_options)
            normalized = survey_game.normalize_answer(answer)
            if normalized:
                survey_game.answer_counts[normalized] += 1
        
        # Broadcast new question to ALL platforms
        await broadcast_state("new_question")
        
        # Wait for question duration (50 seconds)
        await asyncio.sleep(survey_game.question_duration)
        
        # Show results for 10 seconds
        await show_results()
        await asyncio.sleep(survey_game.results_duration)
        
        # Check batch end
        if survey_game.get_batch_time_remaining() <= 0:
            await end_batch()

async def start_new_batch():
    """Start a new 10-minute game batch"""
    survey_game.batch_number += 1
    survey_game.batch_id = str(uuid.uuid4())
    survey_game.batch_start_time = datetime.now(timezone.utc)
    survey_game.player_sessions.clear()
    survey_game.used_questions_in_batch.clear()  # Reset used questions
    survey_game.question_number = 0
    
    print(f"[LiveSurvey] New batch #{survey_game.batch_number} started!")
    await broadcast_state("new_batch")

async def show_results():
    """Show results when question countdown hits zero"""
    survey_game.showing_results = True
    
    top_answers = survey_game.get_top_answers(4)
    winning_answer = top_answers[0] if top_answers else None
    
    # Enhanced logging for Mystery Money sync
    logger.info(f"📊 QUESTION #{survey_game.question_number} RESULTS | Batch #{survey_game.batch_number}")
    logger.info(f"   Question: '{survey_game.current_question}'")
    logger.info(f"   Total Answers: {len(survey_game.answers)} | Top Answer: {winning_answer['answer'] if winning_answer else 'N/A'} ({winning_answer['count'] if winning_answer else 0} votes)")
    
    # Calculate player results
    player_results = {}
    winners_this_round = []
    
    for player_id, answer in survey_game.answers.items():
        if player_id.startswith("ai_"):
            continue  # Skip AI players
            
        normalized = survey_game.normalize_answer(answer)
        your_percent = survey_game.get_answer_percentage(answer)
        is_winner = winning_answer and normalized == survey_game.normalize_answer(winning_answer["answer"])
        
        # Update player session
        if player_id in survey_game.player_sessions:
            session = survey_game.player_sessions[player_id]
            session["questions_answered"] = session.get("questions_answered", 0) + 1
            if is_winner:
                session["score"] = session.get("score", 0) + 1
                winners_this_round.append({
                    "player_id": player_id[:12],
                    "new_score": session["score"],
                    "answer": answer
                })
        
        player_results[player_id] = {
            "your_answer": answer,
            "your_percent": your_percent,
            "won_point": is_winner
        }
    
    # Log bonus triggers
    if winners_this_round:
        logger.info(f"   🏆 BONUS TRIGGERS: {len(winners_this_round)} players matched top answer!")
        for w in winners_this_round[:5]:  # Log first 5 winners
            logger.info(f"      → {w['player_id']}... scored! (Total: {w['new_score']}) Answer: '{w['answer']}'")
    
    survey_game.last_results = {
        "question": survey_game.current_question,
        "top_answers": top_answers,
        "player_results": player_results
    }
    
    # Broadcast results to ALL platforms
    await broadcast_state("results")

async def end_batch():
    """End current batch and determine winners"""
    logger.info(f"🎯 BATCH #{survey_game.batch_number} ENDING...")
    
    # Find top scorers
    scores = []
    for player_id, session in survey_game.player_sessions.items():
        if not player_id.startswith("ai_"):
            scores.append({
                "player_id": player_id,
                "score": session.get("score", 0),
                "questions_answered": session.get("questions_answered", 0)
            })
    
    scores.sort(key=lambda x: x["score"], reverse=True)
    winners = scores[:3] if len(scores) >= 3 else scores
    
    # Enhanced logging for Mystery Money batch end
    logger.info("   📈 BATCH STATS:")
    logger.info(f"      Total Players: {len(survey_game.player_sessions)}")
    logger.info(f"      Real Players: {len(scores)}")
    logger.info(f"      Questions Played: {survey_game.question_number}")
    
    if winners:
        logger.info("   🏆 MYSTERY MONEY JACKPOT WINNERS:")
        for i, w in enumerate(winners, 1):
            prize_tier = ["$500", "$100", "$50"][i-1] if i <= 3 else "$25"
            logger.info(f"      #{i} {w['player_id'][:12]}... | Score: {w['score']}/{w['questions_answered']} | Prize: {prize_tier}")
    else:
        logger.info("   ⚠️ No real players this batch")
    
    # Save batch results
    await db.survey_batches.insert_one({
        "batch_id": survey_game.batch_id,
        "batch_number": survey_game.batch_number,
        "winners": winners,
        "total_players": len(survey_game.player_sessions),
        "real_players": len(scores),
        "ended_at": datetime.now(timezone.utc)
    })
    
    logger.info(f"   ✅ Batch #{survey_game.batch_number} saved to database")
    
    # Broadcast batch end
    await broadcast_to_all({
        "event": "batch_end",
        "batch_number": survey_game.batch_number,
        "winners": winners
    })
    
    print(f"[LiveSurvey] Batch #{survey_game.batch_number} ended. Winners: {winners}")

# ============== WEBSOCKET BROADCASTING ==============
async def broadcast_to_all(data: dict):
    """Broadcast to ALL connected clients (synced across platforms)"""
    if not survey_game.connected_clients:
        return
    
    disconnected = set()
    for ws in survey_game.connected_clients:
        try:
            await ws.send_json(data)
        except Exception:
            disconnected.add(ws)
    
    for ws in disconnected:
        survey_game.connected_clients.discard(ws)

async def broadcast_state(event_type: str):
    """Broadcast current game state with event type"""
    state = survey_game.get_state()
    state["event"] = event_type
    await broadcast_to_all(state)

async def broadcast_answer_update():
    """Broadcast answer count update"""
    await broadcast_to_all({
        "event": "answer_update",
        "total_answers": survey_game.get_total_answers(),
        "player_count": survey_game.get_total_players()
    })

# ============== API ENDPOINTS ==============
class JoinRequest(BaseModel):
    player_id: Optional[str] = None
    device_type: Optional[str] = None  # mobile, tablet, desktop, tv
    user_agent: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    name: Optional[str] = None

class AnswerRequest(BaseModel):
    player_id: str
    answer: str
    lang: str = "en"  # Player's language for answer normalization

class ClaimPrizeRequest(BaseModel):
    player_id: str
    email: str

@router.get("/state")
async def get_game_state():
    """Get current synced game state - same for all platforms"""
    return survey_game.get_state()

@router.post("/join")
async def join_game(req: JoinRequest):
    """Join the game and get a player ID"""
    player_id = req.player_id or f"player_{uuid.uuid4().hex[:8]}"
    
    if player_id not in survey_game.player_sessions:
        survey_game.player_sessions[player_id] = {
            "joined_at": datetime.now(timezone.utc).isoformat(),
            "score": 0,
            "questions_answered": 0,
            "device_type": req.device_type or "unknown",
            "country": req.country or "unknown",
            "city": req.city,
            "name": req.name,
            "user_agent": req.user_agent
        }
    else:
        # Update device/location if re-joining
        if req.device_type:
            survey_game.player_sessions[player_id]["device_type"] = req.device_type
        if req.country:
            survey_game.player_sessions[player_id]["country"] = req.country
        if req.city:
            survey_game.player_sessions[player_id]["city"] = req.city
        if req.name:
            survey_game.player_sessions[player_id]["name"] = req.name
    
    return {
        "player_id": player_id,
        "batch_number": survey_game.batch_number,
        "current_question": survey_game.current_question,
        "time_remaining": survey_game.get_time_remaining(),
        "batch_time_remaining": survey_game.get_batch_time_remaining(),
        "player_count": survey_game.get_total_players()
    }

@router.post("/answer")
async def submit_answer(req: AnswerRequest):
    """Submit an answer to the current question"""
    if not survey_game.current_question:
        raise HTTPException(400, "No active question")
    
    if survey_game.showing_results:
        raise HTTPException(400, "Results are being shown")
    
    if survey_game.get_time_remaining() < 5:
        raise HTTPException(400, "Time's up! Wait for next question")
    
    # Check if already answered
    if req.player_id in survey_game.answers:
        raise HTTPException(400, "Already answered this question")
    
    # Normalize answer - if non-English, first translate to English for matching
    normalized = survey_game.normalize_answer(req.answer)
    if not normalized:
        raise HTTPException(400, "Invalid answer")
    
    # If answer is in non-English language, normalize to English for matching
    if req.lang != "en":
        try:
            from services.translation import normalize_answer_to_english
            # Run async normalization
            english_normalized = await normalize_answer_to_english(req.answer, req.lang)
            if english_normalized:
                normalized = survey_game.normalize_answer(english_normalized)
        except Exception as e:
            # Fallback to basic normalization if translation fails
            logger.warning(f"Translation normalization failed: {e}")
    
    survey_game.answers[req.player_id] = req.answer
    survey_game.answer_counts[normalized] += 1
    
    # Ensure player session exists
    if req.player_id not in survey_game.player_sessions:
        survey_game.player_sessions[req.player_id] = {
            "joined_at": datetime.now(timezone.utc).isoformat(),
            "score": 0,
            "questions_answered": 0,
            "lang": req.lang  # Store player's language
        }
    
    # Calculate same answer stats
    same_percent = survey_game.get_answer_percentage(req.answer)
    same_count = survey_game.get_same_answer_count(req.answer)
    
    # Broadcast answer update to sync all platforms
    await broadcast_answer_update()
    
    return {
        "success": True,
        "your_answer": req.answer,
        "same_answer_percent": same_percent,
        "same_answer_count": same_count,
        "total_answers": survey_game.get_total_answers()
    }

@router.post("/claim-prize")
async def claim_prize(req: ClaimPrizeRequest):
    """Claim prize with email - sends confirmation via SendGrid"""
    import httpx
    import os
    
    # Save claim to database
    claim_doc = {
        "player_id": req.player_id,
        "email": req.email,
        "batch_number": survey_game.batch_number,
        "claimed_at": datetime.now(timezone.utc),
        "email_sent": False,
        "status": "pending"
    }
    
    await db.prize_claims.insert_one(claim_doc)
    
    # Send prize claim email via SendGrid
    try:
        sendgrid_key = os.environ.get("SENDGRID_API_KEY")
        sender_email = os.environ.get("SENDGRID_SENDER_EMAIL", "admin@ztvlivestream.com")
        
        if sendgrid_key:
            # Build prize email HTML
            email_html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #fff; margin: 0; padding: 20px; }}
                    .container {{ max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 30px; }}
                    .header {{ text-align: center; margin-bottom: 30px; }}
                    .logo {{ font-size: 32px; font-weight: 900; color: #dc2626; letter-spacing: -1px; }}
                    .prize-box {{ background: linear-gradient(135deg, rgba(220,38,38,0.2) 0%, rgba(147,51,234,0.2) 100%); border: 2px solid rgba(220,38,38,0.5); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; }}
                    .prize-title {{ font-size: 18px; color: #f87171; margin-bottom: 10px; }}
                    .prize-value {{ font-size: 36px; font-weight: 900; color: #22c55e; }}
                    .details {{ background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin: 20px 0; }}
                    .detail-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }}
                    .label {{ color: #9ca3af; }}
                    .value {{ color: #fff; font-weight: 600; }}
                    .cta {{ display: block; text-align: center; background: linear-gradient(135deg, #dc2626 0%, #9333ea 100%); color: #fff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; margin-top: 20px; }}
                    .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">ZTVLIVE</div>
                        <p style="color: #9ca3af; margin: 5px 0;">UNUSUAL FUN GAME SHOW</p>
                    </div>
                    
                    <h2 style="text-align: center; color: #fff;">🎉 PRIZE CLAIM CONFIRMED!</h2>
                    
                    <div class="prize-box">
                        <div class="prize-title">MYSTERY MONEY JACKPOT</div>
                        <div class="prize-value">$5 - $500</div>
                        <p style="color: #9ca3af; font-size: 14px;">Prize will be revealed within 24 hours</p>
                    </div>
                    
                    <div class="details">
                        <div class="detail-row">
                            <span class="label">Batch Number</span>
                            <span class="value">#{survey_game.batch_number}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Player ID</span>
                            <span class="value">{req.player_id[:12]}...</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Claim Time</span>
                            <span class="value">{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</span>
                        </div>
                        <div class="detail-row" style="border-bottom: none;">
                            <span class="label">Status</span>
                            <span class="value" style="color: #fbbf24;">⏳ Processing</span>
                        </div>
                    </div>
                    
                    <p style="color: #9ca3af; text-align: center; font-size: 14px;">
                        Your prize claim has been received! We'll send another email when your prize is ready.
                    </p>
                    
                    <a href="https://www.ztvlivestream.com/play" class="cta">
                        KEEP PLAYING FOR MORE PRIZES
                    </a>
                    
                    <div class="footer">
                        <p>© 2025 ZTVLIVE - Unusual Fun Game Show</p>
                        <p>Questions? Reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            payload = {
                "personalizations": [{"to": [{"email": req.email}]}],
                "from": {"email": sender_email, "name": "ZTVLIVE Game Show"},
                "subject": f"🎉 ZTVLIVE Prize Claim Confirmed - Batch #{survey_game.batch_number}",
                "content": [{"type": "text/html", "value": email_html}]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    headers={
                        "Authorization": f"Bearer {sendgrid_key}",
                        "Content-Type": "application/json"
                    },
                    json=payload,
                    timeout=10.0
                )
                
                if response.status_code in [200, 202]:
                    # Update claim status
                    await db.prize_claims.update_one(
                        {"player_id": req.player_id, "batch_number": survey_game.batch_number},
                        {"$set": {"email_sent": True, "email_sent_at": datetime.now(timezone.utc)}}
                    )
                    print(f"✅ Prize claim email sent to {req.email}")
                else:
                    print(f"❌ SendGrid error: {response.status_code} - {response.text}")
    
    except Exception as e:
        print(f"❌ Failed to send prize claim email: {e}")
    
    return {"success": True, "message": "Prize claimed! Check your email for confirmation."}

@router.get("/leaderboard")
async def get_leaderboard():
    """Get current batch leaderboard"""
    scores = []
    for player_id, session in survey_game.player_sessions.items():
        if not player_id.startswith("ai_"):
            scores.append({
                "player_id": player_id[:8] + "...",
                "score": session.get("score", 0),
                "questions_answered": session.get("questions_answered", 0)
            })
    
    scores.sort(key=lambda x: x["score"], reverse=True)
    return {"leaderboard": scores[:10]}

@router.get("/share-qr")
async def get_share_info():
    """Get QR code info for social sharing"""
    return {
        "play_url": "https://www.ztvlivestream.com/play",
        "share_text": "Join me on ZTVLIVE! Play the live survey game and win prizes! 🎮🏆",
        "hashtags": ["ZTVLIVE", "LiveSurvey", "WinPrizes", "FamilyFeud"],
        "qr_url": "https://www.ztvlivestream.com/play"
    }


# ============== ADMIN ENDPOINTS ==============
@router.get("/admin/prize-claims")
async def get_prize_claims(limit: int = 50):
    """Get recent prize claims for admin dashboard"""
    claims = await db.prize_claims.find(
        {},
        {"_id": 0}
    ).sort("claimed_at", -1).limit(limit).to_list(length=limit)
    
    return {
        "claims": claims,
        "total": await db.prize_claims.count_documents({})
    }

@router.get("/admin/batch-stats")
async def get_batch_stats():
    """Get current batch statistics"""
    return {
        "current_batch": survey_game.batch_number,
        "players_this_batch": len(survey_game.player_sessions),
        "questions_this_batch": survey_game.question_number,
        "total_answers": survey_game.get_total_answers(),
        "batch_time_remaining": survey_game.get_batch_time_remaining(),
        "is_running": survey_game.is_running,
        "current_question": survey_game.current_question,
        "showing_results": survey_game.showing_results
    }

@router.get("/admin/real-player-analytics")
async def get_real_player_analytics():
    """Get detailed analytics for REAL players only (no AI/virtual)"""
    
    # Filter out AI players
    real_players = {
        pid: session for pid, session in survey_game.player_sessions.items()
        if not pid.startswith("ai_") and not pid.startswith("virtual_")
    }
    
    total_real = len(real_players)
    
    # Device breakdown
    device_counts = {"mobile": 0, "tablet": 0, "desktop": 0, "tv": 0, "unknown": 0}
    for session in real_players.values():
        device = session.get("device_type", "unknown").lower()
        if device in device_counts:
            device_counts[device] += 1
        else:
            device_counts["unknown"] += 1
    
    # Country breakdown
    country_counts = {}
    for session in real_players.values():
        country = session.get("country", "Unknown")
        if country and country != "unknown":
            country_counts[country] = country_counts.get(country, 0) + 1
    
    # Sort countries by count
    top_countries = sorted(country_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # City breakdown  
    city_counts = {}
    for session in real_players.values():
        city = session.get("city")
        if city:
            city_counts[city] = city_counts.get(city, 0) + 1
    
    top_cities = sorted(city_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Active players (answered at least 1 question)
    active_players = len([s for s in real_players.values() if s.get("questions_answered", 0) > 0])
    
    # Players with scores
    scored_players = len([s for s in real_players.values() if s.get("score", 0) > 0])
    
    # Average score
    scores = [s.get("score", 0) for s in real_players.values() if s.get("questions_answered", 0) > 0]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    
    # Recent joins (last 5 minutes)
    now = datetime.now(timezone.utc)
    recent_count = 0
    for session in real_players.values():
        joined_str = session.get("joined_at")
        if joined_str:
            try:
                joined = datetime.fromisoformat(joined_str.replace('Z', '+00:00'))
                if (now - joined).total_seconds() < 300:
                    recent_count += 1
            except:
                pass
    
    return {
        "total_real_players": total_real,
        "ai_players_excluded": len(survey_game.player_sessions) - total_real,
        "active_players": active_players,
        "scored_players": scored_players,
        "average_score": avg_score,
        "recent_joins_5min": recent_count,
        "device_breakdown": device_counts,
        "device_percentages": {
            k: round(v / total_real * 100, 1) if total_real > 0 else 0
            for k, v in device_counts.items()
        },
        "top_countries": [{"country": c, "count": n} for c, n in top_countries],
        "top_cities": [{"city": c, "count": n} for c, n in top_cities],
        "current_batch": survey_game.batch_number,
        "current_question": survey_game.question_number,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/admin/live-players")
async def get_live_players():
    """Get list of all real players currently in game with details"""
    
    players = []
    for pid, session in survey_game.player_sessions.items():
        # Skip AI players
        if pid.startswith("ai_") or pid.startswith("virtual_"):
            continue
            
        players.append({
            "player_id": pid[:12] + "...",
            "name": session.get("name", "Anonymous"),
            "device_type": session.get("device_type", "unknown"),
            "country": session.get("country", "Unknown"),
            "city": session.get("city"),
            "score": session.get("score", 0),
            "questions_answered": session.get("questions_answered", 0),
            "joined_at": session.get("joined_at")
        })
    
    # Sort by score
    players.sort(key=lambda x: x["score"], reverse=True)
    
    return {
        "players": players,
        "total": len(players),
        "batch": survey_game.batch_number
    }


# ============== WEBSOCKET ENDPOINT ==============
@router.websocket("/ws/{player_id}")
async def websocket_endpoint(websocket: WebSocket, player_id: str):
    await websocket.accept()
    survey_game.connected_clients.add(websocket)
    
    # Ensure player session exists
    if player_id not in survey_game.player_sessions:
        survey_game.player_sessions[player_id] = {
            "joined_at": datetime.now(timezone.utc).isoformat(),
            "score": 0,
            "questions_answered": 0
        }
    
    # Send current state immediately
    state = survey_game.get_state()
    state["event"] = "connected"
    state["session"] = survey_game.player_sessions.get(player_id)
    await websocket.send_json(state)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "answer":
                answer = data.get("answer", "").strip()
                if answer and survey_game.get_time_remaining() >= 5 and not survey_game.showing_results:
                    if player_id not in survey_game.answers:
                        normalized = survey_game.normalize_answer(answer)
                        if normalized:
                            survey_game.answers[player_id] = answer
                            survey_game.answer_counts[normalized] += 1
                            
                            # Send confirmation
                            await websocket.send_json({
                                "event": "answer_confirmed",
                                "answer": answer,
                                "same_percent": survey_game.get_answer_percentage(answer),
                                "same_count": survey_game.get_same_answer_count(answer),
                                "total_answers": survey_game.get_total_answers()
                            })
                            
                            # Broadcast update to all
                            await broadcast_answer_update()
            
            elif data.get("type") == "typing":
                # NEW: Mark player as typing
                survey_game.typing_players[player_id] = datetime.now(timezone.utc)
            
            elif data.get("type") == "ping":
                # Send heartbeat with synced state
                await websocket.send_json({
                    "event": "pong",
                    "time_remaining": survey_game.get_time_remaining(),
                    "batch_time_remaining": survey_game.get_batch_time_remaining(),
                    "total_answers": survey_game.get_total_answers(),
                    "player_count": survey_game.get_total_players(),
                    "same_percent": survey_game.get_answer_percentage(survey_game.answers.get(player_id, "")),
                    "lightning_round": survey_game.lightning_round,
                    "typing_players": [
                        survey_game.player_sessions[pid].get("name", "Player")
                        for pid in list(survey_game.typing_players.keys())[:5]
                        if pid in survey_game.player_sessions and not pid.startswith("ai_")
                    ]
                })
    
    except WebSocketDisconnect:
        pass
    finally:
        survey_game.connected_clients.discard(websocket)

# ============== GAME LIFECYCLE ==============
async def start_survey_game():
    """Start the 24/7 survey game"""
    if survey_game.is_running:
        return
    
    survey_game.is_running = True
    survey_game.ai_player_count = random.randint(30, 50)
    
    print("[LiveSurvey] Starting 24/7 survey game...")
    
    # Start background tasks
    asyncio.create_task(rotate_questions())
    asyncio.create_task(simulate_ai_answers())
    asyncio.create_task(simulate_ai_players())

async def stop_survey_game():
    """Stop the survey game"""
    survey_game.is_running = False
    print("[LiveSurvey] Survey game stopped.")

# ============== NEW: TYPING INDICATOR ==============
@router.post("/typing")
async def player_typing(player_id: str):
    """Mark a player as currently typing"""
    if player_id and player_id in survey_game.player_sessions:
        survey_game.typing_players[player_id] = datetime.now(timezone.utc)
        # Broadcast typing update
        await broadcast_to_all({
            "event": "typing_update",
            "typing_players": [
                survey_game.player_sessions[pid].get("name", "Player")
                for pid in list(survey_game.typing_players.keys())[:5]
                if pid in survey_game.player_sessions and not pid.startswith("ai_")
            ]
        })
    return {"status": "ok"}

# ============== NEW: LIGHTNING ROUND ==============
@router.post("/admin/lightning-round/start")
async def start_lightning_round():
    """Start a lightning round (admin only) - faster questions, 2x points"""
    survey_game.lightning_round = True
    survey_game.question_duration = survey_game.lightning_question_duration
    
    # Add celebration event
    survey_game.recent_events.append({
        "type": "lightning_start",
        "message": "⚡ LIGHTNING ROUND! 2X POINTS!",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Broadcast to all
    await broadcast_to_all({
        "event": "lightning_round_start",
        "multiplier": survey_game.lightning_round_multiplier,
        "message": "⚡ LIGHTNING ROUND! 2X POINTS!"
    })
    
    print("[LiveSurvey] ⚡ LIGHTNING ROUND STARTED!")
    return {"status": "started", "multiplier": survey_game.lightning_round_multiplier}

@router.post("/admin/lightning-round/stop")
async def stop_lightning_round():
    """Stop lightning round (admin only)"""
    survey_game.lightning_round = False
    survey_game.question_duration = 600  # Back to 10 minutes
    
    # Add event
    survey_game.recent_events.append({
        "type": "lightning_end",
        "message": "Lightning round ended",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Broadcast
    await broadcast_to_all({
        "event": "lightning_round_end",
        "message": "Lightning round ended - back to normal"
    })
    
    print("[LiveSurvey] Lightning round ended.")
    return {"status": "stopped"}

@router.get("/admin/lightning-round/status")
async def get_lightning_status():
    """Get lightning round status"""
    return {
        "active": survey_game.lightning_round,
        "multiplier": survey_game.lightning_round_multiplier if survey_game.lightning_round else 1
    }

# ============== NEW: CELEBRATION EVENTS ==============
@router.post("/admin/celebration")
async def trigger_celebration(event_type: str = "confetti", message: str = ""):
    """Trigger a celebration event on all screens (admin only)"""
    event = {
        "type": event_type,
        "message": message or "🎉 CELEBRATION!",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    survey_game.recent_events.append(event)
    
    # Broadcast celebration
    await broadcast_to_all({
        "event": "celebration",
        "celebration_type": event_type,
        "message": message or "🎉 CELEBRATION!"
    })
    
    return {"status": "triggered", "event": event}

