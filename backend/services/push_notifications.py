"""
OneSignal Push Notification Service for ZTVLIVE
Handles web push notifications for "Notify Me" feature
"""

import os
import httpx
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class OneSignalService:
    """Service for sending push notifications via OneSignal"""
    
    def __init__(self):
        self._app_id = None
        self._api_key = None
        self.base_url = "https://api.onesignal.com"
    
    @property
    def app_id(self):
        if self._app_id is None:
            self._app_id = os.environ.get('ONESIGNAL_APP_ID', '')
        return self._app_id
    
    @property
    def api_key(self):
        if self._api_key is None:
            self._api_key = os.environ.get('ONESIGNAL_API_KEY', '')
        return self._api_key
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for OneSignal API requests"""
        return {
            "Authorization": f"Key {self.api_key}",
            "Content-Type": "application/json; charset=utf-8"
        }
    
    async def send_notification(
        self,
        headings: Dict[str, str],
        contents: Dict[str, str],
        player_ids: Optional[List[str]] = None,
        external_user_ids: Optional[List[str]] = None,
        segments: Optional[List[str]] = None,
        filters: Optional[List[Dict]] = None,
        data: Optional[Dict[str, Any]] = None,
        url: Optional[str] = None,
        chrome_web_image: Optional[str] = None,
        big_picture: Optional[str] = None,
        ttl: int = 86400,  # 24 hours
    ) -> Dict[str, Any]:
        """
        Send a push notification via OneSignal
        
        Args:
            headings: Title in different languages {"en": "Title"}
            contents: Message in different languages {"en": "Message"}
            player_ids: List of OneSignal player IDs (subscription IDs)
            external_user_ids: List of external user IDs
            segments: Target segments like ["Subscribed Users"]
            filters: Advanced filtering options
            data: Custom data to include with notification
            url: URL to open when notification is clicked
            chrome_web_image: Large image for Chrome web notifications
            big_picture: Large image for Android
            ttl: Time to live in seconds
        """
        if not self.app_id or not self.api_key:
            logger.error("OneSignal not configured")
            return {"error": "OneSignal not configured"}
        
        payload = {
            "app_id": self.app_id,
            "headings": headings,
            "contents": contents,
            "ttl": ttl,
        }
        
        # Set targeting
        if player_ids:
            payload["include_player_ids"] = player_ids
        elif external_user_ids:
            payload["include_external_user_ids"] = external_user_ids
            payload["channel_for_external_user_ids"] = "push"
        elif segments:
            payload["included_segments"] = segments
        elif filters:
            payload["filters"] = filters
        else:
            # Default to all subscribed users
            payload["included_segments"] = ["Subscribed Users"]
        
        # Optional fields
        if data:
            payload["data"] = data
        if url:
            payload["url"] = url
        if chrome_web_image:
            payload["chrome_web_image"] = chrome_web_image
        if big_picture:
            payload["big_picture"] = big_picture
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/notifications",
                    json=payload,
                    headers=self._get_headers()
                )
                
                result = response.json()
                
                if response.status_code == 200:
                    logger.info(f"Notification sent successfully: {result.get('id', 'unknown')}")
                    return result
                else:
                    logger.error(f"OneSignal error: {response.status_code} - {result}")
                    return {"error": result}
                    
        except Exception as e:
            logger.error(f"Failed to send notification: {str(e)}")
            return {"error": str(e)}
    
    async def send_creator_live_notification(
        self,
        creator_id: str,
        creator_name: str,
        video_title: str,
        video_thumbnail: Optional[str] = None,
        scheduled_time: Optional[datetime] = None,
        follower_player_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send notification when a creator's content is about to go live
        
        Args:
            creator_id: The creator's user ID
            creator_name: Creator's display name
            video_title: Title of the content going live
            video_thumbnail: Thumbnail URL for the notification
            scheduled_time: When the content will go live
            follower_player_ids: List of follower OneSignal player IDs
        """
        if not follower_player_ids:
            logger.info(f"No followers to notify for creator {creator_name}")
            return {"status": "no_followers"}
        
        # Format time if provided
        time_str = ""
        if scheduled_time:
            time_str = f" at {scheduled_time.strftime('%I:%M %p')}"
        
        headings = {
            "en": f"🔴 {creator_name} is going LIVE!"
        }
        
        contents = {
            "en": f'"{video_title}" starts{time_str} on ZTVLIVE'
        }
        
        data = {
            "type": "creator_live",
            "creator_id": creator_id,
            "creator_name": creator_name,
            "video_title": video_title,
            "action": "watch_live"
        }
        
        return await self.send_notification(
            headings=headings,
            contents=contents,
            player_ids=follower_player_ids,
            data=data,
            url="https://www.ztvlivestream.com/watch",
            chrome_web_image=video_thumbnail,
            big_picture=video_thumbnail
        )
    
    async def send_content_reminder(
        self,
        creator_name: str,
        video_title: str,
        minutes_until_live: int,
        follower_player_ids: List[str],
        video_thumbnail: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send a reminder notification before content goes live
        """
        if not follower_player_ids:
            return {"status": "no_followers"}
        
        headings = {
            "en": f"⏰ {creator_name} starts in {minutes_until_live} minutes!"
        }
        
        contents = {
            "en": f'"{video_title}" is coming up on ZTVLIVE - don\'t miss it!'
        }
        
        return await self.send_notification(
            headings=headings,
            contents=contents,
            player_ids=follower_player_ids,
            url="https://www.ztvlivestream.com/watch",
            chrome_web_image=video_thumbnail
        )
    
    async def send_new_upload_notification(
        self,
        creator_id: str,
        creator_name: str,
        video_title: str,
        video_id: str,
        follower_player_ids: List[str],
        video_thumbnail: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Notify followers when a creator uploads new content
        """
        if not follower_player_ids:
            return {"status": "no_followers"}
        
        headings = {
            "en": f"📹 {creator_name} uploaded new content!"
        }
        
        contents = {
            "en": f'"{video_title}" - Watch now on ZTVLIVE'
        }
        
        data = {
            "type": "new_upload",
            "creator_id": creator_id,
            "video_id": video_id
        }
        
        return await self.send_notification(
            headings=headings,
            contents=contents,
            player_ids=follower_player_ids,
            data=data,
            url=f"https://www.ztvlivestream.com/watch?v={video_id}",
            chrome_web_image=video_thumbnail
        )
    
    async def register_device(
        self,
        player_id: str,
        external_user_id: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Update device registration with tags and external user ID
        """
        if not self.app_id or not self.api_key:
            return {"error": "OneSignal not configured"}
        
        payload = {
            "app_id": self.app_id
        }
        
        if external_user_id:
            payload["external_user_id"] = external_user_id
        if tags:
            payload["tags"] = tags
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.put(
                    f"{self.base_url}/players/{player_id}",
                    json=payload,
                    headers=self._get_headers()
                )
                
                return response.json()
                
        except Exception as e:
            logger.error(f"Failed to register device: {str(e)}")
            return {"error": str(e)}
    
    async def add_tag_to_user(
        self,
        player_id: str,
        tag_key: str,
        tag_value: str
    ) -> Dict[str, Any]:
        """Add a tag to a user's device"""
        return await self.register_device(
            player_id=player_id,
            tags={tag_key: tag_value}
        )

    async def send_collab_accepted_notification(
        self,
        owner_player_ids: List[str],
        collaborator_name: str,
        video_title: str,
        collab_id: str,
        revenue_split: int
    ) -> Dict[str, Any]:
        """
        Notify video owner when a collaborator accepts their invite
        """
        if not owner_player_ids:
            return {"status": "no_player_ids"}
        
        headings = {
            "en": f"🤝 {collaborator_name} accepted your collab!"
        }
        
        contents = {
            "en": f'Collaboration on "{video_title}" is now active. {revenue_split}% revenue share agreed.'
        }
        
        data = {
            "type": "collab_accepted",
            "collab_id": collab_id,
            "collaborator_name": collaborator_name,
            "action": "view_collab"
        }
        
        return await self.send_notification(
            headings=headings,
            contents=contents,
            player_ids=owner_player_ids,
            data=data,
            url="https://www.ztvlivestream.com/creator/dashboard?tab=collabs"
        )

    async def send_collab_invite_notification(
        self,
        invitee_player_ids: List[str],
        owner_name: str,
        video_title: str,
        collab_id: str,
        revenue_split: int
    ) -> Dict[str, Any]:
        """
        Notify user when they receive a collab invite
        """
        if not invitee_player_ids:
            return {"status": "no_player_ids"}
        
        headings = {
            "en": f"🎬 {owner_name} wants to collaborate!"
        }
        
        contents = {
            "en": f'Collab invite for "{video_title}" with {revenue_split}% revenue share.'
        }
        
        data = {
            "type": "collab_invite",
            "collab_id": collab_id,
            "owner_name": owner_name,
            "action": "view_invite"
        }
        
        return await self.send_notification(
            headings=headings,
            contents=contents,
            player_ids=invitee_player_ids,
            data=data,
            url="https://www.ztvlivestream.com/creator/dashboard?tab=collabs"
        )

    async def send_schedule_reminder_notification(
        self,
        creator_player_ids: List[str],
        video_title: str,
        slot_date: str,
        slot_time: str,
        minutes_until: int,
        booking_id: str
    ) -> Dict[str, Any]:
        """
        Notify creator when their scheduled slot is approaching
        """
        if not creator_player_ids:
            return {"status": "no_player_ids"}
        
        time_text = f"{minutes_until} minutes" if minutes_until < 60 else f"{minutes_until // 60} hour{'s' if minutes_until >= 120 else ''}"
        
        headings = {
            "en": f"⏰ Your slot starts in {time_text}!"
        }
        
        contents = {
            "en": f'"{video_title}" goes live at {slot_time}. Get ready!'
        }
        
        data = {
            "type": "schedule_reminder",
            "booking_id": booking_id,
            "minutes_until": minutes_until,
            "action": "view_schedule"
        }
        
        return await self.send_notification(
            headings=headings,
            contents=contents,
            player_ids=creator_player_ids,
            data=data,
            url="https://www.ztvlivestream.com/creator/dashboard?tab=schedule"
        )

    async def send_optimal_time_notification(
        self,
        creator_player_ids: List[str],
        suggested_date: str,
        suggested_time: str,
        confidence_score: int,
        reason: str
    ) -> Dict[str, Any]:
        """
        Notify creator about optimal scheduling times based on AI analysis
        """
        if not creator_player_ids:
            return {"status": "no_player_ids"}
        
        headings = {
            "en": f"💡 Optimal scheduling opportunity!"
        }
        
        contents = {
            "en": f'{suggested_date} at {suggested_time} is {confidence_score}% optimal. {reason}'
        }
        
        data = {
            "type": "optimal_time_suggestion",
            "suggested_date": suggested_date,
            "suggested_time": suggested_time,
            "confidence_score": confidence_score,
            "action": "view_schedule"
        }
        
        return await self.send_notification(
            headings=headings,
            contents=contents,
            player_ids=creator_player_ids,
            data=data,
            url="https://www.ztvlivestream.com/creator/dashboard?tab=collabs"
        )


# Singleton instance
onesignal_service = OneSignalService()
