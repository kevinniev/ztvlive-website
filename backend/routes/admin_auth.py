"""
Admin Authentication Routes for ZTVLIVE
- JWT-based authentication
- Role-based access control
- Session management
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Request
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import hashlib
import secrets
import jwt
import os

router = APIRouter(prefix="/admin-auth", tags=["Admin Auth"])

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# MongoDB connection will be injected
db = None

def set_db(database):
    global db
    db = database

def hash_password(password: str) -> str:
    """Hash password with SHA-256 + salt"""
    salt = os.environ.get("ADMIN_PASSWORD_SALT", "ztvlive_admin_salt_2026")
    return hashlib.sha256(f"{password}{salt}".encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == password_hash

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=JWT_EXPIRATION_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_admin(authorization: str = Header(None)) -> dict:
    """Get current admin user from token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    admin = await db.admin_users.find_one({"id": admin_id})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    
    if not admin.get("is_active", False):
        raise HTTPException(status_code=403, detail="Account disabled")
    
    # Remove sensitive data
    admin.pop("_id", None)
    admin.pop("password_hash", None)
    
    return admin

async def require_role(admin: dict, required_roles: list) -> bool:
    """Check if admin has required role"""
    if admin.get("role") not in required_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return True

@router.post("/login")
async def admin_login(email: str, password: str):
    """Admin login endpoint"""
    admin = await db.admin_users.find_one({"email": email.lower()})
    
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(password, admin.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not admin.get("is_active", False):
        raise HTTPException(status_code=403, detail="Account disabled")
    
    # Update last login
    await db.admin_users.update_one(
        {"id": admin["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    # Create token
    token = create_access_token({"sub": admin["id"], "role": admin.get("role")})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": admin["id"],
            "email": admin["email"],
            "name": admin["name"],
            "role": admin.get("role", "viewer"),
            "avatar_url": admin.get("avatar_url")
        },
        "expires_in": JWT_EXPIRATION_HOURS * 3600
    }

@router.post("/register")
async def admin_register(
    email: str,
    password: str,
    name: str,
    admin_code: str = None
):
    """Register new admin (requires admin code for first admin or super_admin approval)"""
    # Check if any admin exists
    admin_count = await db.admin_users.count_documents({})
    
    if admin_count == 0:
        # First admin - create as super_admin with special code
        if admin_code != "ZTVLIVE_FIRST_ADMIN_2026":
            raise HTTPException(status_code=403, detail="Invalid admin code")
        role = "super_admin"
    else:
        # Subsequent admins need super_admin to create them
        raise HTTPException(
            status_code=403, 
            detail="Only super admins can create new admin accounts"
        )
    
    # Check if email exists
    existing = await db.admin_users.find_one({"email": email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create admin
    admin_id = secrets.token_hex(16)
    admin_data = {
        "id": admin_id,
        "email": email.lower(),
        "password_hash": hash_password(password),
        "name": name,
        "role": role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "last_login": None,
        "avatar_url": None
    }
    
    await db.admin_users.insert_one(admin_data)
    
    # Create token
    token = create_access_token({"sub": admin_id, "role": role})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": admin_id,
            "email": email.lower(),
            "name": name,
            "role": role
        },
        "expires_in": JWT_EXPIRATION_HOURS * 3600
    }

@router.get("/me")
async def get_current_admin_profile(admin: dict = Depends(get_current_admin)):
    """Get current admin profile"""
    return admin

@router.post("/create-admin")
async def create_admin_user(
    email: str,
    password: str,
    name: str,
    role: str = "viewer",
    admin: dict = Depends(get_current_admin)
):
    """Create new admin user (super_admin only)"""
    await require_role(admin, ["super_admin"])
    
    # Check if email exists
    existing = await db.admin_users.find_one({"email": email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    valid_roles = ["super_admin", "manager", "viewer"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
    
    # Create admin
    admin_id = secrets.token_hex(16)
    admin_data = {
        "id": admin_id,
        "email": email.lower(),
        "password_hash": hash_password(password),
        "name": name,
        "role": role,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "last_login": None,
        "avatar_url": None,
        "created_by": admin["id"]
    }
    
    await db.admin_users.insert_one(admin_data)
    
    return {
        "message": "Admin created successfully",
        "admin": {
            "id": admin_id,
            "email": email.lower(),
            "name": name,
            "role": role
        }
    }

@router.get("/users")
async def list_admin_users(admin: dict = Depends(get_current_admin)):
    """List all admin users (super_admin and manager only)"""
    await require_role(admin, ["super_admin", "manager"])
    
    admins = await db.admin_users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return {"admins": admins, "total": len(admins)}

@router.delete("/users/{admin_id}")
async def delete_admin_user(admin_id: str, admin: dict = Depends(get_current_admin)):
    """Delete admin user (super_admin only)"""
    await require_role(admin, ["super_admin"])
    
    if admin_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.admin_users.delete_one({"id": admin_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    return {"message": "Admin deleted successfully"}

@router.put("/users/{admin_id}/role")
async def update_admin_role(
    admin_id: str,
    new_role: str,
    admin: dict = Depends(get_current_admin)
):
    """Update admin role (super_admin only)"""
    await require_role(admin, ["super_admin"])
    
    valid_roles = ["super_admin", "manager", "viewer"]
    if new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")
    
    result = await db.admin_users.update_one(
        {"id": admin_id},
        {"$set": {"role": new_role}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    return {"message": "Role updated successfully"}

@router.post("/logout")
async def admin_logout(admin: dict = Depends(get_current_admin)):
    """Logout admin (token invalidation would require a blacklist in production)"""
    return {"message": "Logged out successfully"}

@router.post("/forgot-password")
async def forgot_password(email: str):
    """Request password reset - generates a reset token"""
    admin = await db.admin_users.find_one({"email": email.lower()})
    
    if not admin:
        # Don't reveal if email exists for security
        return {"message": "If an account exists with this email, a reset link has been sent"}
    
    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    reset_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    
    # Store reset token
    await db.admin_users.update_one(
        {"id": admin["id"]},
        {"$set": {
            "reset_token": reset_token,
            "reset_token_expiry": reset_expiry
        }}
    )
    
    # In production, send email with reset link
    # For now, return the token (in production, this would be sent via email)
    base_url = os.environ.get('BASE_URL', 'https://www.ztvlivestream.com')
    reset_link = f"{base_url}/admin/reset-password?token={reset_token}"
    
    return {
        "message": "If an account exists with this email, a reset link has been sent",
        "reset_link": reset_link,  # Remove this in production - send via email instead
        "expires_in_minutes": 60
    }

@router.post("/reset-password")
async def reset_password(token: str, new_password: str):
    """Reset password using reset token"""
    admin = await db.admin_users.find_one({"reset_token": token})
    
    if not admin:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    # Check token expiry
    expiry = admin.get("reset_token_expiry")
    if not expiry or expiry < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    # Update password and clear reset token
    await db.admin_users.update_one(
        {"id": admin["id"]},
        {
            "$set": {"password_hash": hash_password(new_password)},
            "$unset": {"reset_token": "", "reset_token_expiry": ""}
        }
    )
    
    return {"message": "Password reset successfully. You can now login with your new password."}

@router.post("/change-password")
async def change_password(
    current_password: str,
    new_password: str,
    admin: dict = Depends(get_current_admin)
):
    """Change password for logged in admin"""
    # Get admin with password hash
    admin_full = await db.admin_users.find_one({"id": admin["id"]})
    
    if not verify_password(current_password, admin_full.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    await db.admin_users.update_one(
        {"id": admin["id"]},
        {"$set": {"password_hash": hash_password(new_password)}}
    )
    
    return {"message": "Password changed successfully"}
