"""
ZTVLIVE Email Service
SendGrid integration for sending creator notifications
"""

import os
import logging
from typing import Optional
from datetime import datetime, timezone
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content, HtmlContent

logger = logging.getLogger(__name__)

# Database reference (set from server.py)
db = None

def set_database(database):
    global db
    db = database


class EmailError(Exception):
    """Custom exception for email errors"""
    pass


def get_sendgrid_client() -> Optional[SendGridAPIClient]:
    """Get SendGrid client if API key is configured"""
    api_key = os.environ.get("SENDGRID_API_KEY")
    if not api_key:
        logger.warning("SENDGRID_API_KEY not configured - emails will be logged only")
        return None
    return SendGridAPIClient(api_key)


def get_sender_email() -> str:
    """Get verified sender email"""
    return os.environ.get("SENDGRID_SENDER_EMAIL", "noreply@ztvlivestream.com")


async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: Optional[str] = None
) -> dict:
    """
    Send email via SendGrid
    
    Returns dict with status and message_id
    """
    sg = get_sendgrid_client()
    sender = get_sender_email()
    
    # Log the email attempt
    email_log = {
        "to_email": to_email,
        "from_email": sender,
        "subject": subject,
        "html_content": html_content[:500] + "..." if len(html_content) > 500 else html_content,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    if not sg:
        # No API key - log only
        email_log["status"] = "logged_only"
        email_log["error"] = "SENDGRID_API_KEY not configured"
        if db is not None:
            await db.email_logs.insert_one(email_log)
        logger.info(f"📧 EMAIL (not sent - no API key): To={to_email}, Subject={subject}")
        return {"status": "logged_only", "message": "Email logged but not sent - no API key"}
    
    try:
        message = Mail(
            from_email=Email(sender, "ZTVLIVE"),
            to_emails=To(to_email),
            subject=subject,
            html_content=HtmlContent(html_content)
        )
        
        if plain_content:
            message.add_content(Content("text/plain", plain_content))
        
        response = sg.send(message)
        
        email_log["status"] = "sent"
        email_log["status_code"] = response.status_code
        email_log["message_id"] = response.headers.get("X-Message-Id", "")
        
        if db is not None:
            await db.email_logs.insert_one(email_log)
        
        logger.info(f"📧 EMAIL SENT: To={to_email}, Subject={subject}, Status={response.status_code}")
        
        return {
            "status": "sent",
            "status_code": response.status_code,
            "message_id": email_log["message_id"]
        }
        
    except Exception as e:
        email_log["status"] = "failed"
        email_log["error"] = str(e)
        
        if db is not None:
            await db.email_logs.insert_one(email_log)
        
        logger.error(f"📧 EMAIL FAILED: To={to_email}, Error={str(e)}")
        raise EmailError(f"Failed to send email: {str(e)}")


# ============ EMAIL TEMPLATES ============

def get_video_live_email_html(creator_name: str, video_title: str, video_url: str) -> str:
    """Generate HTML email for video going live notification"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #171717; border-radius: 16px; overflow: hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center;">
                                <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">🔴 Your Video is LIVE!</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="margin: 0 0 20px; color: #e5e5e5; font-size: 18px;">
                                    Hey <strong style="color: #dc2626;">{creator_name}</strong>!
                                </p>
                                
                                <p style="margin: 0 0 30px; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                                    Great news! Your video is now playing on ZTVLIVE's 24/7 live channel. 
                                    This is your moment to shine! 🌟
                                </p>
                                
                                <div style="background-color: #262626; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                                    <p style="margin: 0 0 10px; color: #737373; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Now Playing</p>
                                    <h2 style="margin: 0; color: white; font-size: 20px; font-weight: 600;">"{video_title}"</h2>
                                </div>
                                
                                <p style="margin: 0 0 30px; color: #a3a3a3; font-size: 16px; line-height: 1.6;">
                                    Share this with your friends and followers to get more views, likes, and comments! 
                                    The more engagement, the better your chances of being featured again.
                                </p>
                                
                                <a href="{video_url}" style="display: inline-block; background-color: #dc2626; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                    Watch Now →
                                </a>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 20px 30px; background-color: #0a0a0a; border-top: 1px solid #262626;">
                                <p style="margin: 0; color: #525252; font-size: 14px; text-align: center;">
                                    ZTVLIVE • Create. Stream. Earn.
                                </p>
                                <p style="margin: 10px 0 0; color: #404040; font-size: 12px; text-align: center;">
                                    <a href="{os.environ.get('BASE_URL', 'https://www.ztvlivestream.com')}" style="color: #dc2626; text-decoration: none;">www.ztvlivestream.com</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def get_new_like_email_html(creator_name: str, liker_name: str, video_title: str, video_url: str, total_likes: int) -> str:
    """Generate HTML email for new like notification"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #171717; border-radius: 16px; overflow: hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #ec4899 0%, #be185d 100%); padding: 25px; text-align: center;">
                                <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">❤️ New Like!</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 30px;">
                                <p style="margin: 0 0 15px; color: #e5e5e5; font-size: 16px;">
                                    Hey {creator_name}!
                                </p>
                                
                                <p style="margin: 0 0 20px; color: #a3a3a3; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #ec4899;">{liker_name}</strong> just liked your video "<strong style="color: white;">{video_title}</strong>"
                                </p>
                                
                                <div style="background-color: #262626; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
                                    <p style="margin: 0; color: #ec4899; font-size: 32px; font-weight: bold;">{total_likes}</p>
                                    <p style="margin: 5px 0 0; color: #737373; font-size: 12px; text-transform: uppercase;">Total Likes</p>
                                </div>
                                
                                <a href="{video_url}" style="display: inline-block; background-color: #ec4899; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                                    View Video
                                </a>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 15px 30px; background-color: #0a0a0a; border-top: 1px solid #262626;">
                                <p style="margin: 0; color: #404040; font-size: 12px; text-align: center;">
                                    ZTVLIVE • <a href="https://www.ztvlivestream.com" style="color: #ec4899; text-decoration: none;">www.ztvlivestream.com</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def get_new_comment_email_html(creator_name: str, commenter_name: str, video_title: str, comment: str, video_url: str) -> str:
    """Generate HTML email for new comment notification"""
    # Truncate comment if too long
    display_comment = comment[:200] + "..." if len(comment) > 200 else comment
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #171717; border-radius: 16px; overflow: hidden;">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 25px; text-align: center;">
                                <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">💬 New Comment!</h1>
                            </td>
                        </tr>
                        
                        <!-- Content -->
                        <tr>
                            <td style="padding: 30px;">
                                <p style="margin: 0 0 15px; color: #e5e5e5; font-size: 16px;">
                                    Hey {creator_name}!
                                </p>
                                
                                <p style="margin: 0 0 20px; color: #a3a3a3; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #3b82f6;">{commenter_name}</strong> commented on your video "<strong style="color: white;">{video_title}</strong>"
                                </p>
                                
                                <div style="background-color: #262626; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 3px solid #3b82f6;">
                                    <p style="margin: 0; color: #e5e5e5; font-size: 15px; line-height: 1.5; font-style: italic;">
                                        "{display_comment}"
                                    </p>
                                </div>
                                
                                <a href="{video_url}" style="display: inline-block; background-color: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                                    Reply to Comment
                                </a>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 15px 30px; background-color: #0a0a0a; border-top: 1px solid #262626;">
                                <p style="margin: 0; color: #404040; font-size: 12px; text-align: center;">
                                    ZTVLIVE • <a href="https://www.ztvlivestream.com" style="color: #3b82f6; text-decoration: none;">www.ztvlivestream.com</a>
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


# ============ SEND NOTIFICATION EMAILS ============

async def send_video_live_email(to_email: str, creator_name: str, video_title: str, video_id: str):
    """Send email when creator's video goes live"""
    base_url = os.environ.get('BASE_URL', 'https://www.ztvlivestream.com')
    video_url = f"{base_url}/watch?v={video_id}"
    html = get_video_live_email_html(creator_name, video_title, video_url)
    subject = f"🔴 Your video \"{video_title}\" is LIVE on ZTVLIVE!"
    
    try:
        return await send_email(to_email, subject, html)
    except EmailError as e:
        logger.error(f"Failed to send video live email: {e}")
        return {"status": "failed", "error": str(e)}


async def send_like_email(to_email: str, creator_name: str, liker_name: str, video_title: str, video_id: str, total_likes: int):
    """Send email when someone likes creator's video"""
    base_url = os.environ.get('BASE_URL', 'https://www.ztvlivestream.com')
    video_url = f"{base_url}/watch?v={video_id}"
    html = get_new_like_email_html(creator_name, liker_name, video_title, video_url, total_likes)
    subject = f"❤️ {liker_name} liked your video on ZTVLIVE"
    
    try:
        return await send_email(to_email, subject, html)
    except EmailError as e:
        logger.error(f"Failed to send like email: {e}")
        return {"status": "failed", "error": str(e)}


async def send_comment_email(to_email: str, creator_name: str, commenter_name: str, video_title: str, comment: str, video_id: str):
    """Send email when someone comments on creator's video"""
    base_url = os.environ.get('BASE_URL', 'https://www.ztvlivestream.com')
    video_url = f"{base_url}/watch?v={video_id}"
    html = get_new_comment_email_html(creator_name, commenter_name, video_title, comment, video_url)
    subject = f"💬 {commenter_name} commented on your video"
    
    try:
        return await send_email(to_email, subject, html)
    except EmailError as e:
        logger.error(f"Failed to send comment email: {e}")
        return {"status": "failed", "error": str(e)}
