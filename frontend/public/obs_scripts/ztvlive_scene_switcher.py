"""
ZTVLIVE OBS Auto Scene Switcher v2.0
=====================================
This script automatically switches OBS scenes based on the ZTVLIVE API.
Supports 3-scene rotation: LIVE ↔ PROMO → GAME → LIVE

SETUP INSTRUCTIONS:
1. In OBS, go to Tools > Scripts
2. Click the "+" button and add this script
3. Configure your scene names to match your OBS setup
4. Click "Start Auto-Switch" to begin

SCENE SETUP:
- LIVE FEED: Browser source → https://ztvlivestream.com/obs-clean
- PROMO VIDEOS: Browser source → https://ztvlivestream.com/obs-promo
- GAME SHOW: Your game overlay/feed

ROTATION FLOW:
When issues detected: LIVE → PROMO (2 promos) → GAME (15s) → LIVE
When recovering: PROMO → GAME → LIVE

Author: ZTVLIVE
Version: 2.0.0
"""

import obspython as obs
import urllib.request
import urllib.error
import json
import time
from datetime import datetime

# =============================================================================
# CONFIGURATION - Edit these to match your OBS scene names
# =============================================================================

# Your ZTVLIVE API base URL
API_BASE_URL = "https://ztvlivestream.com"

# Scene names in OBS (must match EXACTLY - case sensitive!)
SCENE_LIVE = "Creator Content"
SCENE_PROMO = "PROMO VIDEOS"
SCENE_GAME = "Game Feed"

# Timing settings
POLL_INTERVAL = 3           # How often to check API (seconds)
MIN_PROMO_DURATION = 8      # Minimum time on promo scene (seconds)
GAME_DURATION = 15          # Time to show game scene (seconds)
MAX_PROMOS = 2              # Max promos before transitioning to game

# Enable logging
DEBUG_LOGGING = True

# =============================================================================
# INTERNAL STATE
# =============================================================================

current_scene = None
scene_start_time = 0
promo_count = 0
consecutive_errors = 0
is_running = False
last_api_response = None

def log(message, level="INFO"):
    """Log a message with timestamp"""
    if DEBUG_LOGGING or level == "ERROR":
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [ZTVLIVE] [{level}] {message}")

def get_timestamp():
    return time.time()

# =============================================================================
# OBS SCENE MANAGEMENT
# =============================================================================

def get_available_scenes():
    """Get list of all scene names in OBS"""
    scenes = obs.obs_frontend_get_scenes()
    scene_names = []
    for scene in scenes:
        name = obs.obs_source_get_name(scene)
        scene_names.append(name)
    obs.source_list_release(scenes)
    return scene_names

def get_current_obs_scene():
    """Get the currently active scene in OBS"""
    current = obs.obs_frontend_get_current_scene()
    if current:
        name = obs.obs_source_get_name(current)
        obs.obs_source_release(current)
        return name
    return None

def switch_to_scene(scene_name):
    """Switch OBS to the specified scene"""
    global current_scene, scene_start_time, promo_count
    
    available = get_available_scenes()
    if scene_name not in available:
        log(f"Scene '{scene_name}' not found! Available: {available}", "ERROR")
        return False
    
    scene_source = obs.obs_get_source_by_name(scene_name)
    if scene_source:
        obs.obs_frontend_set_current_scene(scene_source)
        obs.obs_source_release(scene_source)
        
        old_scene = current_scene
        current_scene = scene_name
        scene_start_time = get_timestamp()
        
        # Track promo count
        if scene_name == SCENE_PROMO:
            promo_count += 1
        elif scene_name == SCENE_LIVE:
            promo_count = 0  # Reset on return to live
        
        # Notify API of scene change
        notify_api_scene_change(scene_name, f"Switched from {old_scene}")
        
        log(f"🎬 Switched: {old_scene} → {scene_name}")
        return True
    
    return False

def notify_api_scene_change(scene, reason):
    """Notify API that scene has changed"""
    try:
        url = f"{API_BASE_URL}/api/obs/scene-change?scene={scene}&reason={reason}"
        req = urllib.request.Request(url, method='POST', headers={'User-Agent': 'ZTVLIVE-OBS/2.0'})
        urllib.request.urlopen(req, timeout=3)
    except:
        pass  # Non-critical

# =============================================================================
# API COMMUNICATION
# =============================================================================

def fetch_scene_recommendation():
    """Fetch the recommended scene from ZTVLIVE API"""
    global consecutive_errors, last_api_response
    
    try:
        url = f"{API_BASE_URL}/api/obs/scene"
        req = urllib.request.Request(url, headers={'User-Agent': 'ZTVLIVE-OBS/2.0'})
        
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            consecutive_errors = 0
            last_api_response = data
            return data
            
    except urllib.error.URLError as e:
        consecutive_errors += 1
        log(f"API error ({consecutive_errors}): {e}", "ERROR")
        return None
    except Exception as e:
        consecutive_errors += 1
        log(f"Unexpected error: {e}", "ERROR")
        return None

# =============================================================================
# SCENE ROTATION LOGIC
# =============================================================================

def get_time_in_current_scene():
    """Get seconds spent in current scene"""
    return get_timestamp() - scene_start_time

def should_stay_on_promo():
    """Check if we should stay on promo scene"""
    if current_scene != SCENE_PROMO:
        return False
    
    time_in_scene = get_time_in_current_scene()
    
    # Stay if minimum duration not met
    if time_in_scene < MIN_PROMO_DURATION:
        return True
    
    # Stay if we haven't shown enough promos
    if promo_count < MAX_PROMOS:
        return True
    
    return False

def should_stay_on_game():
    """Check if we should stay on game scene"""
    if current_scene != SCENE_GAME:
        return False
    
    time_in_scene = get_time_in_current_scene()
    return time_in_scene < GAME_DURATION

def determine_next_scene(api_data):
    """
    Determine what scene to switch to based on API recommendation and rotation rules.
    
    Rotation: LIVE → PROMO → PROMO → GAME → LIVE
    """
    global promo_count
    
    recommended = api_data.get("scene", "LIVE") if api_data else "PROMO"
    is_live_ready = api_data.get("is_live_ready", False) if api_data else False
    
    current = get_current_obs_scene()
    time_in_scene = get_time_in_current_scene()
    
    log(f"Current: {current}, Recommended: {recommended}, Live ready: {is_live_ready}, Time: {time_in_scene:.1f}s, Promos: {promo_count}")
    
    # PROMO SCENE LOGIC
    if current == SCENE_PROMO:
        # Check if we should transition to GAME
        if promo_count >= MAX_PROMOS and time_in_scene >= MIN_PROMO_DURATION:
            log(f"Transitioning PROMO → GAME (showed {promo_count} promos)")
            return SCENE_GAME
        
        # Stay on promo
        return SCENE_PROMO
    
    # GAME SCENE LOGIC
    elif current == SCENE_GAME:
        # Check if game duration is complete
        if time_in_scene >= GAME_DURATION:
            if is_live_ready:
                log("Transitioning GAME → LIVE (content ready)")
                return SCENE_LIVE
            else:
                log("GAME complete but LIVE not ready, going back to PROMO")
                promo_count = 0  # Reset promo count
                return SCENE_PROMO
        
        # Stay on game
        return SCENE_GAME
    
    # LIVE SCENE LOGIC
    else:
        if recommended == "PROMO" or not is_live_ready:
            log(f"Issue detected, transitioning LIVE → PROMO")
            promo_count = 0  # Reset promo count for new rotation
            return SCENE_PROMO
        
        # Stay on live
        return SCENE_LIVE

def process_scene_switching():
    """Main processing function called by timer"""
    global current_scene, promo_count
    
    # Update current scene state
    current_scene = get_current_obs_scene()
    
    # Fetch API recommendation
    api_data = fetch_scene_recommendation()
    
    # On persistent API errors, switch to promo for safety
    if consecutive_errors >= 3 and current_scene == SCENE_LIVE:
        log("Multiple API errors, switching to PROMO for safety", "ERROR")
        switch_to_scene(SCENE_PROMO)
        promo_count = 0
        return
    
    # Determine target scene
    target_scene = determine_next_scene(api_data)
    
    # Switch if needed
    if target_scene != current_scene:
        switch_to_scene(target_scene)

def timer_callback():
    """Called periodically by OBS"""
    if not is_running:
        return
    process_scene_switching()

# =============================================================================
# OBS SCRIPT INTERFACE
# =============================================================================

def script_description():
    return """
<h2>ZTVLIVE Auto Scene Switcher v2.0</h2>
<p>Automatically switches between Creator Content, Promo, and Game scenes based on playback state.</p>

<h3>Scene Rotation:</h3>
<pre>
When issues detected:
  Creator Content → PROMO (2x) → GAME (15s) → Creator Content

Scene URLs for browser sources:
  • Creator Content: https://ztvlivestream.com/obs-creator
  • PROMO: https://ztvlivestream.com/obs-promo
  • GAME: Your game overlay
</pre>

<h3>Setup:</h3>
<ol>
<li>Create scenes: "Creator Content", "PROMO VIDEOS", "Game Feed"</li>
<li>Add browser sources to each</li>
<li>Configure scene names below to match</li>
<li>Click "Start Auto-Switch"</li>
</ol>
"""

def script_properties():
    """Define script properties/settings"""
    props = obs.obs_properties_create()
    
    # API Settings
    obs.obs_properties_add_text(props, "api_url", "API Base URL", obs.OBS_TEXT_DEFAULT)
    
    # Scene Names
    obs.obs_properties_add_text(props, "scene_live", "LIVE Scene Name", obs.OBS_TEXT_DEFAULT)
    obs.obs_properties_add_text(props, "scene_promo", "PROMO Scene Name", obs.OBS_TEXT_DEFAULT)
    obs.obs_properties_add_text(props, "scene_game", "GAME Scene Name", obs.OBS_TEXT_DEFAULT)
    
    # Timing Settings
    obs.obs_properties_add_int(props, "poll_interval", "Poll Interval (sec)", 1, 30, 1)
    obs.obs_properties_add_int(props, "min_promo", "Min Promo Duration (sec)", 3, 60, 1)
    obs.obs_properties_add_int(props, "game_duration", "Game Duration (sec)", 5, 60, 1)
    obs.obs_properties_add_int(props, "max_promos", "Max Promos Before Game", 1, 5, 1)
    
    # Debug
    obs.obs_properties_add_bool(props, "debug", "Enable Debug Logging")
    
    # Control Buttons
    obs.obs_properties_add_button(props, "start_btn", "▶ Start Auto-Switch", start_callback)
    obs.obs_properties_add_button(props, "stop_btn", "⏹ Stop Auto-Switch", stop_callback)
    obs.obs_properties_add_button(props, "test_btn", "🔌 Test API Connection", test_callback)
    obs.obs_properties_add_button(props, "status_btn", "📊 Show Status", status_callback)
    
    return props

def script_defaults(settings):
    """Set default values"""
    obs.obs_data_set_default_string(settings, "api_url", "https://ztvlivestream.com")
    obs.obs_data_set_default_string(settings, "scene_live", "Creator Content")
    obs.obs_data_set_default_string(settings, "scene_promo", "PROMO VIDEOS")
    obs.obs_data_set_default_string(settings, "scene_game", "Game Feed")
    obs.obs_data_set_default_int(settings, "poll_interval", 3)
    obs.obs_data_set_default_int(settings, "min_promo", 8)
    obs.obs_data_set_default_int(settings, "game_duration", 15)
    obs.obs_data_set_default_int(settings, "max_promos", 2)
    obs.obs_data_set_default_bool(settings, "debug", True)

def script_update(settings):
    """Called when settings change"""
    global API_BASE_URL, SCENE_LIVE, SCENE_PROMO, SCENE_GAME
    global POLL_INTERVAL, MIN_PROMO_DURATION, GAME_DURATION, MAX_PROMOS, DEBUG_LOGGING
    
    API_BASE_URL = obs.obs_data_get_string(settings, "api_url")
    SCENE_LIVE = obs.obs_data_get_string(settings, "scene_live")
    SCENE_PROMO = obs.obs_data_get_string(settings, "scene_promo")
    SCENE_GAME = obs.obs_data_get_string(settings, "scene_game")
    POLL_INTERVAL = obs.obs_data_get_int(settings, "poll_interval")
    MIN_PROMO_DURATION = obs.obs_data_get_int(settings, "min_promo")
    GAME_DURATION = obs.obs_data_get_int(settings, "game_duration")
    MAX_PROMOS = obs.obs_data_get_int(settings, "max_promos")
    DEBUG_LOGGING = obs.obs_data_get_bool(settings, "debug")

def start_callback(props, prop):
    """Start auto-switching"""
    global is_running, scene_start_time, current_scene, promo_count
    
    if is_running:
        log("Already running!")
        return True
    
    is_running = True
    current_scene = get_current_obs_scene()
    scene_start_time = get_timestamp()
    promo_count = 0
    
    obs.timer_add(timer_callback, POLL_INTERVAL * 1000)
    log(f"✅ Auto-switch started (polling every {POLL_INTERVAL}s)")
    log(f"   Scenes: LIVE={SCENE_LIVE}, PROMO={SCENE_PROMO}, GAME={SCENE_GAME}")
    return True

def stop_callback(props, prop):
    """Stop auto-switching"""
    global is_running
    
    if not is_running:
        log("Not running!")
        return True
    
    is_running = False
    obs.timer_remove(timer_callback)
    log("⏹ Auto-switch stopped")
    return True

def test_callback(props, prop):
    """Test API connection"""
    log("Testing API connection...")
    data = fetch_scene_recommendation()
    
    if data:
        log(f"✅ API connected!")
        log(f"   Scene: {data.get('scene')}")
        log(f"   Reason: {data.get('reason')}")
        log(f"   Live Ready: {data.get('is_live_ready')}")
    else:
        log("❌ API connection failed!", "ERROR")
    
    return True

def status_callback(props, prop):
    """Show current status"""
    global current_scene, promo_count, scene_start_time
    
    current = get_current_obs_scene()
    time_in_scene = get_time_in_current_scene() if scene_start_time > 0 else 0
    
    log("📊 Current Status:")
    log(f"   Running: {is_running}")
    log(f"   Scene: {current}")
    log(f"   Time in scene: {time_in_scene:.1f}s")
    log(f"   Promo count: {promo_count}")
    log(f"   API errors: {consecutive_errors}")
    
    if last_api_response:
        log(f"   Last API: {last_api_response.get('scene')} - {last_api_response.get('reason')}")
    
    return True

def script_load(settings):
    """Called when script loads"""
    log("ZTVLIVE OBS Script v2.0 loaded")
    log(f"Scenes: LIVE={SCENE_LIVE}, PROMO={SCENE_PROMO}, GAME={SCENE_GAME}")

def script_unload():
    """Called when script unloads"""
    global is_running
    
    if is_running:
        is_running = False
        obs.timer_remove(timer_callback)
    
    log("ZTVLIVE OBS Script unloaded")
