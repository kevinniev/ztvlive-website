"""
ZTVLIVE Security & Rate Limiting Module
Protects creator data and detects suspicious activity
"""

import os
import time
import hashlib
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, List
from collections import defaultdict
from functools import wraps
import json

logger = logging.getLogger(__name__)

# ============ RATE LIMITING ============
# Track request counts per IP and endpoint
_rate_limit_store: Dict[str, Dict] = defaultdict(lambda: {"count": 0, "window_start": time.time()})
_blocked_ips: Dict[str, datetime] = {}
_suspicious_activity: List[Dict] = []

# Rate limit configurations
RATE_LIMITS = {
    "default": {"requests": 100, "window_seconds": 60},  # 100 req/min
    "auth": {"requests": 10, "window_seconds": 60},       # 10 login attempts/min
    "search": {"requests": 30, "window_seconds": 60},     # 30 searches/min
    "api_sensitive": {"requests": 20, "window_seconds": 60},  # 20 req/min for sensitive endpoints
    "export": {"requests": 5, "window_seconds": 300},     # 5 exports per 5 min
}

def get_client_ip(request) -> str:
    """Extract real client IP from request"""
    # Check for forwarded headers (behind proxy/load balancer)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"

def check_rate_limit(ip: str, endpoint_type: str = "default") -> Dict:
    """
    Check if request should be rate limited
    Returns: {"allowed": bool, "remaining": int, "reset_in": int}
    """
    # Check if IP is blocked
    if ip in _blocked_ips:
        block_until = _blocked_ips[ip]
        if datetime.now(timezone.utc) < block_until:
            return {
                "allowed": False,
                "remaining": 0,
                "reset_in": int((block_until - datetime.now(timezone.utc)).total_seconds()),
                "reason": "IP temporarily blocked due to suspicious activity"
            }
        else:
            del _blocked_ips[ip]
    
    config = RATE_LIMITS.get(endpoint_type, RATE_LIMITS["default"])
    key = f"{ip}:{endpoint_type}"
    
    now = time.time()
    window = _rate_limit_store[key]
    
    # Reset window if expired
    if now - window["window_start"] > config["window_seconds"]:
        _rate_limit_store[key] = {"count": 1, "window_start": now}
        return {
            "allowed": True,
            "remaining": config["requests"] - 1,
            "reset_in": config["window_seconds"]
        }
    
    # Increment and check
    window["count"] += 1
    remaining = config["requests"] - window["count"]
    reset_in = int(config["window_seconds"] - (now - window["window_start"]))
    
    if remaining < 0:
        # Log suspicious activity if repeatedly hitting limits
        log_suspicious_activity(ip, "rate_limit_exceeded", {
            "endpoint_type": endpoint_type,
            "count": window["count"],
            "limit": config["requests"]
        })
        return {
            "allowed": False,
            "remaining": 0,
            "reset_in": reset_in,
            "reason": "Rate limit exceeded"
        }
    
    return {
        "allowed": True,
        "remaining": remaining,
        "reset_in": reset_in
    }

def block_ip(ip: str, duration_minutes: int = 30, reason: str = ""):
    """Block an IP temporarily"""
    _blocked_ips[ip] = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
    log_suspicious_activity(ip, "ip_blocked", {
        "duration_minutes": duration_minutes,
        "reason": reason
    })
    logger.warning(f"Blocked IP {ip} for {duration_minutes} minutes: {reason}")

def unblock_ip(ip: str):
    """Unblock an IP"""
    if ip in _blocked_ips:
        del _blocked_ips[ip]
        logger.info(f"Unblocked IP {ip}")

# ============ SUSPICIOUS ACTIVITY DETECTION ============

SUSPICIOUS_PATTERNS = {
    "bulk_scraping": {
        "threshold": 50,  # 50+ rapid requests
        "window_seconds": 30,
        "action": "block",
        "block_minutes": 60
    },
    "auth_brute_force": {
        "threshold": 10,  # 10 failed logins
        "window_seconds": 300,
        "action": "block",
        "block_minutes": 30
    },
    "data_export_abuse": {
        "threshold": 5,
        "window_seconds": 600,
        "action": "alert",
        "block_minutes": 0
    }
}

_activity_tracker: Dict[str, List[float]] = defaultdict(list)

def detect_suspicious_pattern(ip: str, pattern_type: str) -> bool:
    """
    Detect if an IP is exhibiting a suspicious pattern
    Returns True if suspicious activity detected
    """
    if pattern_type not in SUSPICIOUS_PATTERNS:
        return False
    
    config = SUSPICIOUS_PATTERNS[pattern_type]
    key = f"{ip}:{pattern_type}"
    now = time.time()
    
    # Clean old entries
    _activity_tracker[key] = [
        t for t in _activity_tracker[key] 
        if now - t < config["window_seconds"]
    ]
    
    # Add current activity
    _activity_tracker[key].append(now)
    
    # Check threshold
    if len(_activity_tracker[key]) >= config["threshold"]:
        if config["action"] == "block" and config["block_minutes"] > 0:
            block_ip(ip, config["block_minutes"], f"Suspicious pattern: {pattern_type}")
        
        log_suspicious_activity(ip, pattern_type, {
            "count": len(_activity_tracker[key]),
            "threshold": config["threshold"],
            "action": config["action"]
        })
        
        # Clear tracker after action
        _activity_tracker[key] = []
        return True
    
    return False

def log_suspicious_activity(ip: str, activity_type: str, details: Dict):
    """Log suspicious activity for admin review"""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip": ip,
        "activity_type": activity_type,
        "details": details,
        "severity": "high" if "block" in str(details.get("action", "")) else "medium"
    }
    _suspicious_activity.append(entry)
    
    # Keep only last 1000 entries
    if len(_suspicious_activity) > 1000:
        _suspicious_activity.pop(0)
    
    logger.warning(f"Suspicious activity: {entry}")

def get_suspicious_activity_log(limit: int = 100) -> List[Dict]:
    """Get recent suspicious activity for admin review"""
    return list(reversed(_suspicious_activity[-limit:]))

def get_blocked_ips() -> List[Dict]:
    """Get list of currently blocked IPs"""
    now = datetime.now(timezone.utc)
    return [
        {
            "ip": ip,
            "blocked_until": blocked_until.isoformat(),
            "remaining_minutes": int((blocked_until - now).total_seconds() / 60)
        }
        for ip, blocked_until in _blocked_ips.items()
        if blocked_until > now
    ]

# ============ DATA PROTECTION ============

def sanitize_creator_for_public(creator: Dict) -> Dict:
    """
    Remove sensitive data from creator object before public exposure
    NEVER expose: password_hash, email, phone, full address, payment info
    """
    safe_fields = [
        "id", "name", "username", "display_name", "bio", "profile_image",
        "banner_image", "social_links", "category", "follower_count",
        "video_count", "total_views", "verified", "joined_date",
        "is_featured", "badges"
    ]
    
    sanitized = {}
    for field in safe_fields:
        if field in creator:
            sanitized[field] = creator[field]
    
    # Generate safe public ID if needed
    if "id" not in sanitized and "_id" in creator:
        sanitized["id"] = str(creator["_id"])
    
    return sanitized

def hash_sensitive_data(data: str) -> str:
    """Hash sensitive data for logging (don't log raw PII)"""
    return hashlib.sha256(data.encode()).hexdigest()[:12]

# ============ API KEY VALIDATION ============

_api_keys: Dict[str, Dict] = {}

def generate_api_key(name: str, permissions: List[str]) -> str:
    """Generate a new API key for external integrations"""
    import secrets
    key = f"ztv_{secrets.token_urlsafe(32)}"
    _api_keys[key] = {
        "name": name,
        "permissions": permissions,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used": None,
        "request_count": 0
    }
    return key

def validate_api_key(key: str, required_permission: str = None) -> Dict:
    """
    Validate an API key and check permissions
    Returns: {"valid": bool, "name": str, "error": str}
    """
    if not key or not key.startswith("ztv_"):
        return {"valid": False, "error": "Invalid API key format"}
    
    if key not in _api_keys:
        return {"valid": False, "error": "API key not found"}
    
    key_data = _api_keys[key]
    
    if required_permission and required_permission not in key_data["permissions"]:
        return {"valid": False, "error": f"Missing permission: {required_permission}"}
    
    # Update usage
    key_data["last_used"] = datetime.now(timezone.utc).isoformat()
    key_data["request_count"] += 1
    
    return {"valid": True, "name": key_data["name"]}

# ============ SECURITY STATS ============

def get_security_stats() -> Dict:
    """Get security overview for admin dashboard"""
    return {
        "blocked_ips_count": len([ip for ip, t in _blocked_ips.items() if t > datetime.now(timezone.utc)]),
        "suspicious_activities_24h": len([
            a for a in _suspicious_activity 
            if datetime.fromisoformat(a["timestamp"].replace("Z", "+00:00")) > datetime.now(timezone.utc) - timedelta(hours=24)
        ]),
        "high_severity_alerts": len([
            a for a in _suspicious_activity[-100:] 
            if a.get("severity") == "high"
        ]),
        "rate_limit_hits": sum(
            1 for key, data in _rate_limit_store.items() 
            if data["count"] > RATE_LIMITS.get(key.split(":")[-1], RATE_LIMITS["default"])["requests"] * 0.8
        ),
        "api_keys_active": len(_api_keys),
        "last_threat_detected": _suspicious_activity[-1]["timestamp"] if _suspicious_activity else None
    }
