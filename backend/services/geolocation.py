"""
ipinfo.io Geolocation Service for ZTVLIVE
Provides accurate IP-based location data for analytics
"""

import os
import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from functools import lru_cache

logger = logging.getLogger(__name__)

class IPInfoService:
    """Service for IP geolocation using ipinfo.io"""
    
    def __init__(self):
        self._token = None
        self.base_url = "https://ipinfo.io"
        # In-memory cache to reduce API calls
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = timedelta(hours=24)  # Cache for 24 hours
        self._cache_timestamps: Dict[str, datetime] = {}
    
    @property
    def token(self):
        if self._token is None:
            self._token = os.environ.get('IPINFO_TOKEN', '')
        return self._token
    
    @property
    def has_token(self):
        return bool(self.token)
    
    def _is_cache_valid(self, ip: str) -> bool:
        """Check if cached data is still valid"""
        if ip not in self._cache or ip not in self._cache_timestamps:
            return False
        return datetime.now(timezone.utc) - self._cache_timestamps[ip] < self._cache_ttl
    
    def _is_private_ip(self, ip: str) -> bool:
        """Check if IP is private/local"""
        if not ip:
            return True
        
        # Common private/local IP patterns
        private_patterns = [
            '127.', '10.', '172.16.', '172.17.', '172.18.', '172.19.',
            '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
            '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
            '172.30.', '172.31.', '192.168.', 'localhost', '::1', '0.0.0.0'
        ]
        
        return any(ip.startswith(p) for p in private_patterns)
    
    async def get_location(self, ip_address: str) -> Dict[str, Any]:
        """
        Get geolocation data for an IP address
        
        Returns:
            Dict with: ip, country, country_code, region, city, 
                      latitude, longitude, timezone, org, postal
        """
        # Handle private/local IPs
        if self._is_private_ip(ip_address):
            logger.debug(f"Private IP detected: {ip_address}")
            return {
                "ip": ip_address,
                "country": "Local",
                "country_code": "XX",
                "region": None,
                "city": None,
                "latitude": None,
                "longitude": None,
                "timezone": None,
                "org": "Local Network",
                "postal": None,
                "is_private": True
            }
        
        # Check cache first
        if self._is_cache_valid(ip_address):
            logger.debug(f"Cache hit for IP: {ip_address}")
            return self._cache[ip_address]
        
        try:
            # Build URL
            url = f"{self.base_url}/{ip_address}"
            if self.has_token:
                url += f"?token={self.token}"
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Parse coordinates
                    lat, lon = None, None
                    if data.get("loc"):
                        try:
                            lat, lon = map(float, data["loc"].split(","))
                        except (ValueError, AttributeError):
                            pass
                    
                    result = {
                        "ip": data.get("ip", ip_address),
                        "country": data.get("country", "Unknown"),
                        "country_code": data.get("country", "XX"),
                        "region": data.get("region"),
                        "city": data.get("city"),
                        "latitude": lat,
                        "longitude": lon,
                        "timezone": data.get("timezone"),
                        "org": data.get("org"),
                        "postal": data.get("postal"),
                        "is_private": False
                    }
                    
                    # Cache the result
                    self._cache[ip_address] = result
                    self._cache_timestamps[ip_address] = datetime.now(timezone.utc)
                    
                    logger.info(f"Geolocation for {ip_address}: {result['country']}, {result.get('city', 'N/A')}")
                    return result
                    
                elif response.status_code == 429:
                    logger.warning("ipinfo.io rate limit exceeded")
                    return self._get_fallback_response(ip_address, "Rate limit exceeded")
                else:
                    logger.error(f"ipinfo.io error: {response.status_code}")
                    return self._get_fallback_response(ip_address, f"API error: {response.status_code}")
                    
        except httpx.TimeoutException:
            logger.warning(f"Timeout getting location for {ip_address}")
            return self._get_fallback_response(ip_address, "Timeout")
        except Exception as e:
            logger.error(f"Error getting location for {ip_address}: {str(e)}")
            return self._get_fallback_response(ip_address, str(e))
    
    def _get_fallback_response(self, ip_address: str, error: str) -> Dict[str, Any]:
        """Return fallback response when API fails"""
        return {
            "ip": ip_address,
            "country": "Unknown",
            "country_code": "XX",
            "region": None,
            "city": None,
            "latitude": None,
            "longitude": None,
            "timezone": None,
            "org": None,
            "postal": None,
            "is_private": False,
            "error": error
        }
    
    async def get_batch_locations(self, ip_addresses: list) -> Dict[str, Dict[str, Any]]:
        """
        Get locations for multiple IP addresses
        Note: Free tier doesn't support batch, so we call individually with caching
        """
        results = {}
        for ip in ip_addresses:
            results[ip] = await self.get_location(ip)
        return results
    
    def get_country_name(self, country_code: str) -> str:
        """Convert country code to full name"""
        country_names = {
            "US": "United States",
            "GB": "United Kingdom",
            "CA": "Canada",
            "AU": "Australia",
            "DE": "Germany",
            "FR": "France",
            "JP": "Japan",
            "CN": "China",
            "IN": "India",
            "BR": "Brazil",
            "MX": "Mexico",
            "NG": "Nigeria",
            "KE": "Kenya",
            "ZA": "South Africa",
            "GH": "Ghana",
            "EG": "Egypt",
            "ES": "Spain",
            "IT": "Italy",
            "NL": "Netherlands",
            "SE": "Sweden",
            "NO": "Norway",
            "DK": "Denmark",
            "FI": "Finland",
            "PL": "Poland",
            "RU": "Russia",
            "KR": "South Korea",
            "SG": "Singapore",
            "MY": "Malaysia",
            "ID": "Indonesia",
            "PH": "Philippines",
            "TH": "Thailand",
            "VN": "Vietnam",
            "AE": "United Arab Emirates",
            "SA": "Saudi Arabia",
            "TR": "Turkey",
            "AR": "Argentina",
            "CL": "Chile",
            "CO": "Colombia",
            "PE": "Peru",
            "NZ": "New Zealand",
            "IE": "Ireland",
            "CH": "Switzerland",
            "AT": "Austria",
            "BE": "Belgium",
            "PT": "Portugal",
            "CZ": "Czech Republic",
            "RO": "Romania",
            "HU": "Hungary",
            "GR": "Greece",
            "IL": "Israel",
            "PK": "Pakistan",
            "BD": "Bangladesh",
            "XX": "Unknown",
            "Local": "Local Network"
        }
        return country_names.get(country_code, country_code)
    
    def clear_cache(self):
        """Clear the location cache"""
        self._cache.clear()
        self._cache_timestamps.clear()
        logger.info("Geolocation cache cleared")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            "cached_ips": len(self._cache),
            "cache_ttl_hours": self._cache_ttl.total_seconds() / 3600,
            "has_token": self.has_token
        }


# Singleton instance
ipinfo_service = IPInfoService()
