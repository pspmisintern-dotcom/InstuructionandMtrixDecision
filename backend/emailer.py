"""
emailer.py

Minimal SMTP email sender used for the admin 2FA one-time code. Configure via
SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/SMTP_FROM in backend/.env.

If SMTP isn't configured (e.g. local development), the code is logged to the
server console instead of emailed, so the flow still works but is clearly
not sending real email -- see the printed warning.
"""

import os
import smtplib
from email.mime.text import MIMEText
from pathlib import Path
from dotenv import load_dotenv

dotenv_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path)


def is_smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASSWORD"))


def send_email(to_address: str, subject: str, body: str) -> bool:
    """Send a plain-text email. Returns True if it was actually sent via SMTP,
    False if it fell back to console logging (SMTP not configured) or failed."""
    if not is_smtp_configured():
        print(
            "[emailer] SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD). "
            f"Falling back to console log instead of emailing '{to_address}':"
        )
        print(f"[emailer] Subject: {subject}\n[emailer] Body:\n{body}")
        return False

    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    from_address = os.getenv("SMTP_FROM", user)
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = from_address
    msg["To"] = to_address

    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            if use_tls:
                server.starttls()
            server.login(user, password)
            server.sendmail(from_address, [to_address], msg.as_string())
        return True
    except Exception as e:
        print(f"[emailer] Failed to send email to '{to_address}': {e}")
        return False
