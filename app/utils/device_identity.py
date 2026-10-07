import hashlib
import secrets
import uuid

DEVICE_KEY_PREFIX = "edg_"

# Characters of the key (after "edg_") kept for display, e.g. "edg_1a2b3c4d".
# 8 hex chars = 32 bits: enough to tell keys apart, far too little to guess one.
_DISPLAY_CHARS = 8


def generate_device_key() -> str:
    """
    Generate a cryptographically secure API key
    for authenticating IoT devices.
    """
    return f"{DEVICE_KEY_PREFIX}{secrets.token_hex(32)}"


def hash_device_key(raw_key: str) -> str:
    """
    SHA-256 of the raw key (hex).

    Device keys carry 256 bits of randomness, so a fast hash is appropriate:
    unlike passwords they cannot be brute-forced, and a slow KDF would only
    add latency to every telemetry request. The hash is unique-indexed and
    used directly for lookup, so the raw key never needs to be stored.
    """
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def device_key_prefix(raw_key: str) -> str:
    """Non-secret identifier shown to owners, e.g. 'edg_1a2b3c4d'."""
    body = raw_key[len(DEVICE_KEY_PREFIX):] if raw_key.startswith(DEVICE_KEY_PREFIX) else raw_key
    return f"{DEVICE_KEY_PREFIX}{body[:_DISPLAY_CHARS]}"


def generate_serial_number() -> str:
    """
    Generate a unique serial number for every device.
    """
    return f"EDGE-{uuid.uuid4().hex[:12].upper()}"
