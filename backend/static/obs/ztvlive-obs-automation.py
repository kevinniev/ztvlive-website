#!/usr/bin/env python3
"""
ZTVLIVE OBS Automation Script
==============================
Automatically switches OBS scenes based on content safety.

Priority: Creator Content > Safe Watch Page > Promo/Game Fallback

Setup:
1. Install: pip install obsws-python requests
2. Enable OBS WebSocket (Tools > WebSocket Server Settings)
3. Configure scenes in OBS:
   - "Watch Page" - Browser source with watch page
   - "Promo" - Media source with promo video
   - "Game" - Browser source with game overlay
   - "Transition" - Stinger transition or graphic
4. Run this script: python ztvlive-obs-automation.py

"""

import time
import requests
import json
from datetime import datetime

# Configuration
API_URL = "https://ztvlivestream.com/api/obs/content-status"
POLL_INTERVAL = 2  # seconds

# OBS Scene Names (match your OBS scene names)
SCENES = {
    "WATCH_PAGE": "Watch Page",
    "CREATOR_CONTENT": "Watch Page",  # Same scene, different priority
    "PROMO": "Promo",
    "GAME": "Game Overlay",
    "TRANSITION": "Transition"
}

# Try to import OBS WebSocket
try:
    import obsws_python as obs
    OBS_AVAILABLE = True
except ImportError:
    print("⚠️  obsws-python not installed. Running in monitor-only mode.")
    print("   Install with: pip install obsws-python")
    OBS_AVAILABLE = False

class ZTVLiveOBSController:
    def __init__(self, obs_host="localhost", obs_port=4455, obs_password=""):
        self.api_url = API_URL
        self.current_scene = None
        self.last_status = None
        
        # Connect to OBS if available
        self.obs = None
        if OBS_AVAILABLE:
            try:
                self.obs = obs.ReqClient(host=obs_host, port=obs_port, password=obs_password)
                print(f"✅ Connected to OBS WebSocket at {obs_host}:{obs_port}")
                self.current_scene = self.obs.get_current_program_scene().current_program_scene_name
                print(f"   Current scene: {self.current_scene}")
            except Exception as e:
                print(f"❌ Could not connect to OBS: {e}")
                print("   Running in monitor-only mode")
                self.obs = None
    
    def get_content_status(self):
        """Fetch content status from ZTVLIVE API"""
        try:
            response = requests.get(self.api_url, timeout=5)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"⚠️  API error: {e}")
        return None
    
    def switch_scene(self, scene_key):
        """Switch OBS to the specified scene"""
        scene_name = SCENES.get(scene_key, SCENES["PROMO"])
        
        if self.obs and scene_name != self.current_scene:
            try:
                self.obs.set_current_program_scene(scene_name)
                self.current_scene = scene_name
                print(f"🎬 Switched to scene: {scene_name}")
                return True
            except Exception as e:
                print(f"❌ Scene switch error: {e}")
        return False
    
    def run(self):
        """Main automation loop"""
        print("\n" + "="*60)
        print("ZTVLIVE OBS Automation")
        print("="*60)
        print(f"API: {self.api_url}")
        print(f"Poll interval: {POLL_INTERVAL}s")
        print("="*60 + "\n")
        
        while True:
            try:
                status = self.get_content_status()
                
                if status:
                    content = status.get("current_content", {})
                    safety = status.get("safety", {})
                    recommendation = status.get("obs_recommendation", {})
                    
                    # Display status
                    now = datetime.now().strftime("%H:%M:%S")
                    title = content.get("title", "Unknown")[:40]
                    remaining = content.get("time_remaining", 0)
                    is_safe = safety.get("is_safe", False)
                    scene = recommendation.get("scene", "FALLBACK")
                    action = recommendation.get("action", "STAY")
                    
                    # Status indicator
                    safe_icon = "✅" if is_safe else "⚠️"
                    creator_icon = "🎬" if content.get("is_creator_content") else "📺"
                    
                    print(f"[{now}] {creator_icon} {title}... | {remaining}s left | {safe_icon} {scene} | {action}")
                    
                    # Auto-switch if needed
                    if action == "SWITCH":
                        switch_to = recommendation.get("switch_to", "PROMO")
                        reason = safety.get("reason", "Unknown")
                        print(f"         ↳ Switching to {switch_to}: {reason}")
                        self.switch_scene(switch_to)
                    elif action == "STAY" and scene in ["WATCH_PAGE", "CREATOR_CONTENT"]:
                        # Ensure we're on the watch page
                        if self.current_scene not in [SCENES["WATCH_PAGE"], SCENES["CREATOR_CONTENT"]]:
                            print(f"         ↳ Returning to Watch Page")
                            self.switch_scene(scene)
                    
                    self.last_status = status
                else:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️  No API response - keeping current scene")
                
                time.sleep(POLL_INTERVAL)
                
            except KeyboardInterrupt:
                print("\n\n👋 Stopping automation...")
                break
            except Exception as e:
                print(f"❌ Error: {e}")
                time.sleep(POLL_INTERVAL)


def main():
    print("""
    ╔═══════════════════════════════════════════════════════════╗
    ║              ZTVLIVE OBS AUTOMATION                       ║
    ║                                                           ║
    ║  Automatically switches scenes based on content safety    ║
    ║                                                           ║
    ║  Priority:                                                ║
    ║  1. Creator Content (if safe)                             ║
    ║  2. Watch Page (AI content)                               ║
    ║  3. Promo/Game (fallback)                                 ║
    ╚═══════════════════════════════════════════════════════════╝
    """)
    
    # OBS WebSocket settings (change these for your setup)
    OBS_HOST = "localhost"
    OBS_PORT = 4455
    OBS_PASSWORD = ""  # Leave empty if no password set
    
    controller = ZTVLiveOBSController(
        obs_host=OBS_HOST,
        obs_port=OBS_PORT,
        obs_password=OBS_PASSWORD
    )
    
    controller.run()


if __name__ == "__main__":
    main()
