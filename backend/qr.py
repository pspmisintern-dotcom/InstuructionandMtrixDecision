"""
qr.py

QR code generation module.

Generates QR codes for:
- Each Machine
- Each Work Instruction
- Each Component

When scanned, the encoded payload directs the operator to the correct
Work Instruction in the application.
"""

import io
import base64
import qrcode
from qrcode.image.pil import PilImage


def _generate_qr_bytes(payload: str) -> bytes:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_qr_base64(payload: str) -> str:
    """Return a base64-encoded PNG of the QR code."""
    data = _generate_qr_bytes(payload)
    return "data:image/png;base64," + base64.b64encode(data).decode("utf-8")


def work_instruction_qr(wi_id: int, base_url: str = "http://localhost:3000") -> str:
    """QR payload that opens a specific Work Instruction."""
    payload = f"{base_url}/workinstructions/{wi_id}"
    return generate_qr_base64(payload)


def machine_qr(machine_code: str, base_url: str = "http://localhost:3000") -> str:
    """QR payload for a machine (opens WI filtered by machine)."""
    payload = f"{base_url}/workinstructions?machine={machine_code}"
    return generate_qr_base64(payload)


def component_qr(component_code: str, base_url: str = "http://localhost:3000") -> str:
    """QR payload for a component."""
    payload = f"{base_url}/workinstructions?component={component_code}"
    return generate_qr_base64(payload)
