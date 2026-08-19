"""
ip_validator.py

IP address validation and geofencing for factory network access control.
Checks if a given IP address is within allowed IP ranges (CIDR notation).
"""
import os
import ipaddress
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)


_parsed_ranges_cache = None
_parsed_ranges_cache_key = None


def parse_allowed_ranges() -> List:
    """
    Parse ALLOWED_IP_RANGES from .env into a list of network objects.
    Returns empty list if not configured or invalid.

    Cached by the raw env value so this doesn't re-parse/rebuild
    ipaddress.ip_network objects on every single request (this is called
    from the network-gate middleware on every request, including login).
    """
    global _parsed_ranges_cache, _parsed_ranges_cache_key
    ranges_str = os.getenv("ALLOWED_IP_RANGES", "")

    if _parsed_ranges_cache is not None and _parsed_ranges_cache_key == ranges_str:
        return _parsed_ranges_cache

    if not ranges_str.strip():
        _parsed_ranges_cache = []
        _parsed_ranges_cache_key = ranges_str
        return _parsed_ranges_cache

    networks = []
    for cidr in ranges_str.split(","):
        cidr = cidr.strip()
        if not cidr:
            continue
        try:
            # ipaddress.ip_network handles both IPv4 and IPv6
            networks.append(ipaddress.ip_network(cidr, strict=False))
        except ValueError as e:
            print(f"[ip_validator] Invalid CIDR range '{cidr}': {e}")

    _parsed_ranges_cache = networks
    _parsed_ranges_cache_key = ranges_str
    return _parsed_ranges_cache


def is_factory_network_enabled() -> bool:
    """Check if factory network geofencing is enabled."""
    return os.getenv("FACTORY_NETWORK_ONLY", "false").lower() in ("true", "1", "yes")


def is_ip_allowed(ip_str: Optional[str]) -> bool:
    """
    Check if the given IP address is within any of the allowed ranges.
    
    Args:
        ip_str: IP address as a string (e.g., "192.168.1.10", "::1")
    
    Returns:
        True if IP is allowed or geofencing is disabled, False otherwise
    """
    # If geofencing is disabled, allow all IPs
    if not is_factory_network_enabled():
        return True
    
    # If no IP provided (shouldn't happen), deny access
    if not ip_str:
        print("[ip_validator] No IP address provided, denying access")
        return False
    
    # Parse the client IP
    try:
        client_ip = ipaddress.ip_address(ip_str)
    except ValueError as e:
        print(f"[ip_validator] Invalid IP address '{ip_str}': {e}")
        return False
    
    # Get allowed ranges
    allowed_ranges = parse_allowed_ranges()
    if not allowed_ranges:
        print("[ip_validator] No allowed IP ranges configured, denying access")
        return False
    
    # Check if IP is in any allowed range
    for network in allowed_ranges:
        if client_ip in network:
            return True
    
    return False


def get_client_ip_from_request(request) -> Optional[str]:
    """
    Extract the real client IP from a FastAPI request.
    Handles X-Forwarded-For, X-Real-IP headers for proxies/load balancers.
    
    Args:
        request: FastAPI Request object
    
    Returns:
        IP address as string, or None if not found
    """
    # Check X-Forwarded-For header (comma-separated list, first is the client)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain (the original client)
        return forwarded_for.split(",")[0].strip()
    
    # Check X-Real-IP header (common with nginx)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    
    # Fallback to direct client host
    if request.client:
        return request.client.host
    
    return None


def format_ip_ranges_for_display() -> str:
    """Return a formatted string of allowed IP ranges for error messages."""
    ranges_str = os.getenv("ALLOWED_IP_RANGES", "Not configured")
    return ranges_str


# For testing/debugging
if __name__ == "__main__":
    print("=== IP Validator Configuration ===")
    print(f"Factory Network Only: {is_factory_network_enabled()}")
    print(f"Allowed IP Ranges: {format_ip_ranges_for_display()}")
    print()
    
    test_ips = [
        "192.168.1.10",
        "10.0.0.5",
        "127.0.0.1",
        "8.8.8.8",
        "172.16.0.1",
    ]
    
    print("=== Test IP Addresses ===")
    for ip in test_ips:
        allowed = is_ip_allowed(ip)
        print(f"{ip:20} -> {'ALLOWED' if allowed else 'BLOCKED'}")
