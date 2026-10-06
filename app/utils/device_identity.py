import secrets
import uuid


def generate_device_key() -> str:
    """
    Generate a cryptographically secure API key
    for authenticating IoT devices.
    """
    return f"edg_{secrets.token_hex(32)}"


def generate_serial_number() -> str:
    """
    Generate a unique serial number for every device.
    """
    return f"EDGE-{uuid.uuid4().hex[:12].upper()}"