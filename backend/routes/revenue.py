"""
Revenue Management Routes for ZTVLIVE Admin Dashboard
- Ad placement settings
- Subscription tier management
- Creator payout tracking
"""

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import secrets

router = APIRouter(prefix="/revenue", tags=["Revenue"])

# MongoDB connection will be injected
db = None

def set_db(database):
    global db
    db = database

# ============ AD SETTINGS ============

@router.get("/ads/settings")
async def get_ad_settings():
    """Get current ad placement settings"""
    settings = await db.ad_settings.find_one({"id": "global"})
    
    if not settings:
        # Return default settings
        return {
            "id": "global",
            "pre_roll_enabled": True,
            "pre_roll_frequency": 1,
            "mid_roll_enabled": False,
            "mid_roll_interval_seconds": 300,
            "post_roll_enabled": False,
            "banner_enabled": True,
            "overlay_enabled": False,
            "ad_free_for_subscribers": True,
            "updated_at": None,
            "updated_by": None
        }
    
    settings.pop("_id", None)
    return settings

@router.put("/ads/settings")
async def update_ad_settings(
    pre_roll_enabled: Optional[bool] = None,
    pre_roll_frequency: Optional[int] = None,
    mid_roll_enabled: Optional[bool] = None,
    mid_roll_interval_seconds: Optional[int] = None,
    post_roll_enabled: Optional[bool] = None,
    banner_enabled: Optional[bool] = None,
    overlay_enabled: Optional[bool] = None,
    ad_free_for_subscribers: Optional[bool] = None,
    admin_id: str = None
):
    """Update ad placement settings"""
    update_data = {"updated_at": datetime.now(timezone.utc)}
    if admin_id:
        update_data["updated_by"] = admin_id
    
    if pre_roll_enabled is not None:
        update_data["pre_roll_enabled"] = pre_roll_enabled
    if pre_roll_frequency is not None:
        update_data["pre_roll_frequency"] = pre_roll_frequency
    if mid_roll_enabled is not None:
        update_data["mid_roll_enabled"] = mid_roll_enabled
    if mid_roll_interval_seconds is not None:
        update_data["mid_roll_interval_seconds"] = mid_roll_interval_seconds
    if post_roll_enabled is not None:
        update_data["post_roll_enabled"] = post_roll_enabled
    if banner_enabled is not None:
        update_data["banner_enabled"] = banner_enabled
    if overlay_enabled is not None:
        update_data["overlay_enabled"] = overlay_enabled
    if ad_free_for_subscribers is not None:
        update_data["ad_free_for_subscribers"] = ad_free_for_subscribers
    
    await db.ad_settings.update_one(
        {"id": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "Ad settings updated successfully", "updated": update_data}

# ============ SUBSCRIPTION TIERS ============

@router.get("/subscriptions/tiers")
async def get_subscription_tiers():
    """Get all subscription tiers"""
    tiers = await db.subscription_tiers.find({}, {"_id": 0}).to_list(100)
    
    if not tiers:
        # Return default tiers
        default_tiers = [
            {
                "id": "free",
                "name": "Free",
                "price_monthly": 0,
                "price_yearly": 0,
                "features": ["Access to live stream", "Basic quality", "Ads supported"],
                "is_active": True,
                "max_devices": 1,
                "ad_free": False,
                "hd_quality": False,
                "downloads_enabled": False
            },
            {
                "id": "basic",
                "name": "Basic",
                "price_monthly": 4.99,
                "price_yearly": 49.99,
                "features": ["Ad-free viewing", "HD quality", "2 devices"],
                "is_active": True,
                "max_devices": 2,
                "ad_free": True,
                "hd_quality": True,
                "downloads_enabled": False
            },
            {
                "id": "premium",
                "name": "Premium",
                "price_monthly": 9.99,
                "price_yearly": 99.99,
                "features": ["Ad-free viewing", "4K quality", "5 devices", "Offline downloads", "Early access"],
                "is_active": True,
                "max_devices": 5,
                "ad_free": True,
                "hd_quality": True,
                "downloads_enabled": True
            }
        ]
        return {"tiers": default_tiers, "total": len(default_tiers)}
    
    return {"tiers": tiers, "total": len(tiers)}

@router.post("/subscriptions/tiers")
async def create_subscription_tier(
    name: str,
    price_monthly: float,
    price_yearly: float,
    features: List[str],
    max_devices: int = 1,
    ad_free: bool = False,
    hd_quality: bool = True,
    downloads_enabled: bool = False
):
    """Create a new subscription tier"""
    tier_id = secrets.token_hex(8)
    tier_data = {
        "id": tier_id,
        "name": name,
        "price_monthly": price_monthly,
        "price_yearly": price_yearly,
        "features": features,
        "is_active": True,
        "max_devices": max_devices,
        "ad_free": ad_free,
        "hd_quality": hd_quality,
        "downloads_enabled": downloads_enabled,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.subscription_tiers.insert_one(tier_data)
    tier_data.pop("_id", None)
    
    return {"message": "Tier created successfully", "tier": tier_data}

@router.put("/subscriptions/tiers/{tier_id}")
async def update_subscription_tier(
    tier_id: str,
    name: Optional[str] = None,
    price_monthly: Optional[float] = None,
    price_yearly: Optional[float] = None,
    features: Optional[List[str]] = None,
    is_active: Optional[bool] = None,
    max_devices: Optional[int] = None,
    ad_free: Optional[bool] = None,
    hd_quality: Optional[bool] = None,
    downloads_enabled: Optional[bool] = None
):
    """Update a subscription tier"""
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if name is not None:
        update_data["name"] = name
    if price_monthly is not None:
        update_data["price_monthly"] = price_monthly
    if price_yearly is not None:
        update_data["price_yearly"] = price_yearly
    if features is not None:
        update_data["features"] = features
    if is_active is not None:
        update_data["is_active"] = is_active
    if max_devices is not None:
        update_data["max_devices"] = max_devices
    if ad_free is not None:
        update_data["ad_free"] = ad_free
    if hd_quality is not None:
        update_data["hd_quality"] = hd_quality
    if downloads_enabled is not None:
        update_data["downloads_enabled"] = downloads_enabled
    
    result = await db.subscription_tiers.update_one(
        {"id": tier_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    return {"message": "Tier updated successfully"}

@router.delete("/subscriptions/tiers/{tier_id}")
async def delete_subscription_tier(tier_id: str):
    """Delete a subscription tier"""
    result = await db.subscription_tiers.delete_one({"id": tier_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    return {"message": "Tier deleted successfully"}

# ============ CREATOR PAYOUTS ============

@router.get("/payouts")
async def get_creator_payouts(
    status: Optional[str] = None,
    limit: int = 50
):
    """Get creator payouts"""
    query = {}
    if status:
        query["status"] = status
    
    payouts = await db.creator_payouts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"payouts": payouts, "total": len(payouts)}

@router.post("/payouts")
async def create_creator_payout(
    creator_id: str,
    creator_name: str,
    creator_email: str,
    amount: float,
    views_count: int = 0,
    tips_amount: float = 0.0,
    ad_revenue_share: float = 0.0,
    period_start: str = None,
    period_end: str = None
):
    """Create a new creator payout"""
    payout_id = secrets.token_hex(16)
    now = datetime.now(timezone.utc)
    
    payout_data = {
        "id": payout_id,
        "creator_id": creator_id,
        "creator_name": creator_name,
        "creator_email": creator_email,
        "amount": amount,
        "status": "pending",
        "period_start": period_start or (now - timedelta(days=30)).isoformat(),
        "period_end": period_end or now.isoformat(),
        "views_count": views_count,
        "tips_amount": tips_amount,
        "ad_revenue_share": ad_revenue_share,
        "payment_method": None,
        "transaction_id": None,
        "processed_at": None,
        "created_at": now
    }
    
    await db.creator_payouts.insert_one(payout_data)
    payout_data.pop("_id", None)
    
    return {"message": "Payout created successfully", "payout": payout_data}

@router.put("/payouts/{payout_id}/status")
async def update_payout_status(
    payout_id: str,
    status: str,
    transaction_id: Optional[str] = None,
    payment_method: Optional[str] = None
):
    """Update payout status"""
    valid_statuses = ["pending", "processing", "completed", "failed"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )
    
    update_data = {"status": status}
    if transaction_id:
        update_data["transaction_id"] = transaction_id
    if payment_method:
        update_data["payment_method"] = payment_method
    if status == "completed":
        update_data["processed_at"] = datetime.now(timezone.utc)
    
    result = await db.creator_payouts.update_one(
        {"id": payout_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payout not found")
    
    return {"message": "Payout status updated successfully"}

# ============ REVENUE SUMMARY ============

@router.get("/summary")
async def get_revenue_summary(days: int = 30):
    """Get revenue summary for admin dashboard"""
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get tips from database
    tips_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    tips_result = await db.tips.aggregate(tips_pipeline).to_list(1)
    tips_revenue = tips_result[0]["total"] if tips_result else 0
    
    # Get subscription revenue (mock for now)
    subscription_revenue = 0
    subs_count = await db.subscriptions.count_documents({
        "status": "active",
        "start_date": {"$gte": start_date}
    })
    
    # Get payout stats
    pending_payouts_cursor = await db.creator_payouts.aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    pending_payouts = pending_payouts_cursor[0]["total"] if pending_payouts_cursor else 0
    
    completed_payouts_cursor = await db.creator_payouts.aggregate([
        {"$match": {"status": "completed", "processed_at": {"$gte": start_date}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    completed_payouts = completed_payouts_cursor[0]["total"] if completed_payouts_cursor else 0
    
    # Top earning creators
    top_creators_cursor = db.creator_payouts.aggregate([
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$creator_id",
            "name": {"$first": "$creator_name"},
            "total_earned": {"$sum": "$amount"},
            "payout_count": {"$sum": 1}
        }},
        {"$sort": {"total_earned": -1}},
        {"$limit": 10}
    ])
    top_creators = []
    async for doc in top_creators_cursor:
        top_creators.append({
            "creator_id": doc["_id"],
            "name": doc["name"],
            "total_earned": doc["total_earned"],
            "payout_count": doc["payout_count"]
        })
    
    # Ad revenue (estimated based on views)
    total_views = await db.content_views.count_documents({
        "timestamp": {"$gte": start_date}
    })
    ad_revenue = total_views * 0.002  # $0.002 per view estimate
    
    total_revenue = tips_revenue + subscription_revenue + ad_revenue
    
    return {
        "period_days": days,
        "total_revenue": round(total_revenue, 2),
        "ad_revenue": round(ad_revenue, 2),
        "subscription_revenue": round(subscription_revenue, 2),
        "tips_revenue": round(tips_revenue, 2),
        "pending_payouts": round(pending_payouts, 2),
        "completed_payouts": round(completed_payouts, 2),
        "active_subscriptions": subs_count,
        "top_earning_creators": top_creators,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
