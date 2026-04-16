#!/usr/bin/env python3
"""
ZTVLIVE OBS External Scene Switcher v2.0
=========================================
Controls OBS via WebSocket with 3-scene rotation support.
Rotation: LIVE ↔ PROMO → GAME → LIVE

REQUIREMENTS:
  pip install obsws-python requests

SETUP:
1. Enable OBS WebSocket: Tools > WebSocket Server Settings
2. Note port (default 4455) and set password
3. Create scenes: "LIVE FEED", "PROMO VIDEOS", "GAME SHOW"
4. Run: python ztvlive_obs_switcher_external.py --password YOUR_PASSWORD

SCENE BROWSER SOURCES:
  • LIVE FEED: https://ztvlivestream.com/obs-clean
  • PROMO VIDEOS: https://ztvlivestream.com/obs-promo
  • GAME SHOW: Your game overlay

Author: ZTVLIVE
Version: 2.0.0
"""

import argparse
import time
import sys
import json
from datetime import datetime

try:
    import requests
except ImportError:
    print("❌ requests not installed. Run: pip install requests")
    sys.exit(1)

try:
    import obsws_python as obsws
except ImportError:
    print("❌ obsws-python not installed. Run: pip install obsws-python")
    sys.exit(1)


# =============================================================================
# CONFIGURATION
# =============================================================================

API_BASE_URL = "https://ztvlivestream.com"

SCENE_LIVE = "LIVE FEED"
SCENE_PROMO = "PROMO VIDEOS"
SCENE_GAME = "GAME SHOW"

POLL_INTERVAL = 3
MIN_PROMO_DURATION = 8
GAME_DURATION = 15
MAX_PROMOS = 2


# =============================================================================
# SCENE SWITCHER CLASS
# =============================================================================

class ZTVLiveSceneSwitcher:
    def __init__(self, host, port, password):
        self.host = host
        self.port = port
        self.password = password
        self.obs = None
        
        # State tracking
        self.current_scene = None
        self.scene_start_time = 0
        self.promo_count = 0
        self.consecutive_errors = 0
        self.running = False
        self.last_api_response = None
    
    def log(self, message, level="INFO"):
        """Log with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        prefix = {"INFO": "ℹ️", "WARN": "⚠️", "ERROR": "❌", "SUCCESS": "✅"}.get(level, "")
        print(f"[{timestamp}] {prefix} {message}")
    
    def connect(self):
        """Connect to OBS WebSocket"""
        try:
            self.obs = obsws.ReqClient(
                host=self.host,
                port=self.port,
                password=self.password
            )
            self.log(f"Connected to OBS at {self.host}:{self.port}", "SUCCESS")
            return True
        except Exception as e:
            self.log(f"Failed to connect to OBS: {e}", "ERROR")
            return False
    
    def disconnect(self):
        """Disconnect from OBS"""
        if self.obs:
            try:
                self.obs.base_client.ws.close()
            except:
                pass
            self.obs = None
            self.log("Disconnected from OBS")
    
    def get_current_scene(self):
        """Get current OBS scene"""
        try:
            response = self.obs.get_current_program_scene()
            return response.current_program_scene_name
        except Exception as e:
            self.log(f"Error getting scene: {e}", "ERROR")
            return None
    
    def get_available_scenes(self):
        """Get list of all scenes"""
        try:
            response = self.obs.get_scene_list()
            return [s['sceneName'] for s in response.scenes]
        except:
            return []
    
    def switch_scene(self, scene_name):
        """Switch to specified scene"""
        try:
            available = self.get_available_scenes()
            if scene_name not in available:
                self.log(f"Scene '{scene_name}' not found! Available: {available}", "ERROR")
                return False
            
            old_scene = self.current_scene
            self.obs.set_current_program_scene(scene_name)
            self.current_scene = scene_name
            self.scene_start_time = time.time()
            
            # Track promo count
            if scene_name == SCENE_PROMO:
                self.promo_count += 1
            elif scene_name == SCENE_LIVE:
                self.promo_count = 0
            
            self.log(f"🎬 {old_scene} → {scene_name}")
            
            # Notify API
            self.notify_scene_change(scene_name, f"From {old_scene}")
            
            return True
        except Exception as e:
            self.log(f"Error switching scene: {e}", "ERROR")
            return False
    
    def notify_scene_change(self, scene, reason):
        """Notify API of scene change"""
        try:
            url = f"{API_BASE_URL}/api/obs/scene-change"
            requests.post(url, params={"scene": scene, "reason": reason}, timeout=3)
        except:
            pass
    
    def fetch_recommendation(self):
        """Fetch scene recommendation from API"""
        try:
            url = f"{API_BASE_URL}/api/obs/scene"
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            data = response.json()
            self.consecutive_errors = 0
            self.last_api_response = data
            return data
        except Exception as e:
            self.consecutive_errors += 1
            if self.consecutive_errors <= 3:
                self.log(f"API error ({self.consecutive_errors}): {e}", "WARN")
            return None
    
    def get_time_in_scene(self):
        """Get seconds in current scene"""
        return time.time() - self.scene_start_time
    
    def determine_next_scene(self, api_data):
        """
        Determine target scene based on rotation logic.
        
        Rotation: LIVE → PROMO (2x) → GAME (15s) → LIVE
        """
        recommended = api_data.get("scene", "LIVE") if api_data else "PROMO"
        is_live_ready = api_data.get("is_live_ready", False) if api_data else False
        
        current = self.get_current_scene()
        time_in_scene = self.get_time_in_scene()
        
        # PROMO LOGIC
        if current == SCENE_PROMO:
            if self.promo_count >= MAX_PROMOS and time_in_scene >= MIN_PROMO_DURATION:
                return SCENE_GAME
            return SCENE_PROMO
        
        # GAME LOGIC
        elif current == SCENE_GAME:
            if time_in_scene >= GAME_DURATION:
                if is_live_ready:
                    return SCENE_LIVE
                else:
                    self.promo_count = 0
                    return SCENE_PROMO
            return SCENE_GAME
        
        # LIVE LOGIC
        else:
            if recommended == "PROMO" or not is_live_ready:
                self.promo_count = 0
                return SCENE_PROMO
            return SCENE_LIVE
    
    def process_tick(self):
        """Process one tick of the switcher"""
        self.current_scene = self.get_current_scene()
        
        api_data = self.fetch_recommendation()
        
        # Safety: switch to promo on persistent errors
        if self.consecutive_errors >= 3 and self.current_scene == SCENE_LIVE:
            self.log("Multiple API errors, switching to PROMO", "WARN")
            self.switch_scene(SCENE_PROMO)
            self.promo_count = 0
            return
        
        target = self.determine_next_scene(api_data)
        
        # Log status
        time_in_scene = self.get_time_in_scene()
        is_live_ready = api_data.get("is_live_ready", False) if api_data else False
        reason = api_data.get("reason", "Unknown") if api_data else "No API"
        
        status = f"Scene: {self.current_scene} ({time_in_scene:.0f}s) | Target: {target} | Live: {'✓' if is_live_ready else '✗'} | Promos: {self.promo_count}"
        
        if target != self.current_scene:
            self.log(status)
            self.switch_scene(target)
        else:
            # Print status occasionally
            if int(time_in_scene) % 10 == 0:
                print(f"  {status}")
    
    def run(self):
        """Main loop"""
        self.running = True
        self.current_scene = self.get_current_scene()
        self.scene_start_time = time.time()
        
        print("\n" + "="*60)
        print("  ZTVLIVE OBS Scene Switcher v2.0")
        print("="*60)
        print(f"  Current scene: {self.current_scene}")
        print(f"  Polling every: {POLL_INTERVAL}s")
        print(f"  Rotation: LIVE → PROMO ({MAX_PROMOS}x) → GAME ({GAME_DURATION}s) → LIVE")
        print("="*60)
        print("  Press Ctrl+C to stop\n")
        
        try:
            while self.running:
                self.process_tick()
                time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            print("\n\n🛑 Stopped by user")
        finally:
            self.running = False


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="ZTVLIVE OBS Auto Scene Switcher v2.0",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
SCENE ROTATION:
  LIVE → PROMO (2 videos) → GAME (15 sec) → LIVE

BROWSER SOURCE URLS:
  • LIVE FEED:    https://ztvlivestream.com/obs-clean
  • PROMO VIDEOS: https://ztvlivestream.com/obs-promo
  • GAME SHOW:    Your game overlay

EXAMPLE:
  python %(prog)s --password my_secret_password
        """
    )
    
    parser.add_argument("--host", default="localhost", help="OBS host (default: localhost)")
    parser.add_argument("--port", type=int, default=4455, help="OBS port (default: 4455)")
    parser.add_argument("--password", required=True, help="OBS WebSocket password")
    parser.add_argument("--api-url", default="https://ztvlivestream.com", help="ZTVLIVE API URL")
    parser.add_argument("--scene-live", default="LIVE FEED", help="Live scene name")
    parser.add_argument("--scene-promo", default="PROMO VIDEOS", help="Promo scene name")
    parser.add_argument("--scene-game", default="GAME SHOW", help="Game scene name")
    parser.add_argument("--interval", type=int, default=3, help="Poll interval (default: 3)")
    parser.add_argument("--promo-duration", type=int, default=8, help="Min promo duration (default: 8)")
    parser.add_argument("--game-duration", type=int, default=15, help="Game duration (default: 15)")
    parser.add_argument("--max-promos", type=int, default=2, help="Max promos before game (default: 2)")
    
    args = parser.parse_args()
    
    # Update config
    global API_BASE_URL, SCENE_LIVE, SCENE_PROMO, SCENE_GAME
    global POLL_INTERVAL, MIN_PROMO_DURATION, GAME_DURATION, MAX_PROMOS
    
    API_BASE_URL = args.api_url
    SCENE_LIVE = args.scene_live
    SCENE_PROMO = args.scene_promo
    SCENE_GAME = args.scene_game
    POLL_INTERVAL = args.interval
    MIN_PROMO_DURATION = args.promo_duration
    GAME_DURATION = args.game_duration
    MAX_PROMOS = args.max_promos
    
    print(f"\nConnecting to OBS at {args.host}:{args.port}...")
    
    switcher = ZTVLiveSceneSwitcher(args.host, args.port, args.password)
    
    if not switcher.connect():
        print("\n❌ Could not connect to OBS. Check:")
        print("   1. OBS is running")
        print("   2. WebSocket enabled: Tools > WebSocket Server Settings")
        print("   3. Port and password are correct")
        sys.exit(1)
    
    try:
        switcher.run()
    finally:
        switcher.disconnect()


if __name__ == "__main__":
    main()
