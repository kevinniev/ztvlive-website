"""
ZTVLIVE Security Configuration
==============================
This file contains security settings and blocked patterns.
"""

# Blocked IP addresses (add suspicious IPs here)
BLOCKED_IPS = set()

# Rate limiting settings
RATE_LIMITS = {
    "login": {"requests": 5, "window": 300},  # 5 attempts per 5 minutes
    "api": {"requests": 100, "window": 60},   # 100 requests per minute
    "search": {"requests": 30, "window": 60}, # 30 searches per minute
}

# Suspicious patterns to detect
SUSPICIOUS_PATTERNS = [
    r"<script.*?>",  # XSS attempts
    r"\$where",      # NoSQL injection
    r"\$regex.*\.\*", # Regex DoS
    r"javascript:",  # XSS via URL
    r"data:text/html", # Data URI XSS
]

# Allowed admin emails (move to env in production)
ADMIN_EMAILS = [
    "admin@ztvlivestream.com",
    "kevin@ztvlive.com",
]

# Security headers
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
}

def is_ip_blocked(ip: str) -> bool:
    return ip in BLOCKED_IPS

def block_ip(ip: str):
    BLOCKED_IPS.add(ip)

def unblock_ip(ip: str):
    BLOCKED_IPS.discard(ip)
