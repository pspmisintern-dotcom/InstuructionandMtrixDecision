from datetime import datetime, timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, AuditLog
from backend.security import verify_password, hash_password
from backend.auth import create_access_token, get_current_user
from backend.ip_validator import is_ip_allowed, get_client_ip_from_request, format_ip_ranges_for_display
from backend.departments import DEPARTMENTS
from backend.emailer import send_email

router = APIRouter(prefix="/auth", tags=["auth"])

ADMIN_FIXED_USERNAME = "admin"
ADMIN_FIXED_PASSWORD = "plasma@1234"

# ---------------------------------------------------------------------------
# Admin 2FA (email one-time code) -- DISABLED for now, kept for easy re-enable.
# ---------------------------------------------------------------------------
OTP_LENGTH = 6
OTP_EXPIRE_MINUTES = 5
OTP_MAX_ATTEMPTS = 5
ADMIN_2FA_ENABLED = False


def generate_otp_code() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))


def generate_random_password(length: int = 12) -> str:
    """Generate a secure random password suitable for sharing with operator/supervisor."""
    alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        has_digit = any(c.isdigit() for c in candidate)
        has_upper = any(c.isupper() for c in candidate)
        has_lower = any(c.islower() for c in candidate)
        has_symbol = any(c in "!@#$%&" for c in candidate)
        if has_digit and has_upper and has_lower and has_symbol:
            return candidate


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[dict] = None
    must_change_password: bool = False
    message: str = ""
    # True when the password check passed but a second factor (emailed OTP)
    # is still required before a token is issued -- see /auth/verify-otp.
    otp_required: bool = False


class VerifyOtpRequest(BaseModel):
    username: str
    otp: str


class RegisterRequest(BaseModel):
    """Public self-registration for operators / supervisors.
    Account is created in 'pending' state; no access until admin approves.
    """
    username: str
    email: str
    full_name: str
    password: str
    role: str = "operator"          # operator | supervisor only
    department: Optional[str] = None
    request_reason: Optional[str] = None   # why they need access


class RequestAccessRequest(BaseModel):
    """Existing user submits a new access request."""
    reason: Optional[str] = None


class GrantAccessRequest(BaseModel):
    user_id: int
    duration_hours: int = 8          # how long the session lasts
    new_password: Optional[str] = None   # leave blank to auto-generate
    department: Optional[str] = None     # admin picks which department's WIs this user can see


class RevokeAccessRequest(BaseModel):
    user_id: int


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class RejectAccessRequest(BaseModel):
    user_id: int
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper: serialise a User row to a safe dict
# ---------------------------------------------------------------------------

def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "department": user.department,
        "is_active": user.is_active,
        "access_granted": user.access_granted,
        "access_expires_at": user.access_expires_at,
        "access_request_status": user.access_request_status,
        "must_change_password": user.must_change_password,
        "ai_assistant_enabled": user.ai_assistant_enabled,
    }


# ---------------------------------------------------------------------------
# POST /auth/register  — public, no auth required
# ---------------------------------------------------------------------------

@router.post("/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """
    Operator or supervisor creates their own account.
    - Account is inactive (access_granted=False) until admin approves.
    - access_request_status is set to 'pending' immediately.
    - Admin will be able to see this in the pending-requests list.
    """
    if req.role not in ("operator", "supervisor"):
        raise HTTPException(
            status_code=400,
            detail="Self-registration is only allowed for operator or supervisor roles.",
        )

    if req.department and req.department not in DEPARTMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid department. Must be one of: {', '.join(DEPARTMENTS)}",
        )

    existing = db.query(User).filter(
        (User.username == req.username) | (User.email == req.email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already taken.")

    user = User(
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        hashed_password=hash_password(req.password),
        role=req.role,
        department=req.department,
        is_active=True,               # account exists but access not granted yet
        access_granted=False,
        access_request_status="pending",
        access_requested_at=datetime.utcnow(),
        access_request_reason=req.request_reason,
        must_change_password=False,
    )
    db.add(user)
    db.flush()   # get user.id before committing

    db.add(AuditLog(
        user_id=user.id,
        action="REGISTER",
        detail=f"New {req.role} '{req.username}' registered and is awaiting admin approval.",
    ))
    db.commit()
    db.refresh(user)

    return {
        "message": (
            "Registration successful. Your account is pending admin approval. "
            "You will be able to log in once the admin grants you access."
        ),
        "user_id": user.id,
        "username": user.username,
        "access_request_status": user.access_request_status,
    }


# ---------------------------------------------------------------------------
# POST /auth/request-access  — authenticated user asks for (re-)access
# ---------------------------------------------------------------------------

@router.post("/request-access")
def request_access(
    req: RequestAccessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    An existing operator/supervisor requests access (or re-access after expiry).
    Sets access_request_status = 'pending' so admin can see it.
    """
    if current_user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin does not need to request access.")

    if current_user.access_request_status == "pending":
        raise HTTPException(
            status_code=400,
            detail="You already have a pending access request. Please wait for admin approval.",
        )

    current_user.access_request_status = "pending"
    current_user.access_requested_at = datetime.utcnow()
    if req.reason:
        current_user.access_request_reason = req.reason

    db.add(AuditLog(
        user_id=current_user.id,
        action="REQUEST_ACCESS",
        detail=f"{current_user.username} submitted an access request. Reason: {req.reason or 'Not provided'}",
    ))
    db.commit()

    return {
        "message": "Access request submitted. Please wait for the admin to approve.",
        "access_request_status": "pending",
    }


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    # ---- Fixed admin credentials: always check against constants, never DB ----
    if req.username.lower() == ADMIN_FIXED_USERNAME.lower():
        if req.password != ADMIN_FIXED_PASSWORD:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password.",
            )
        # Ensure admin user row exists in DB (for audit logs and joins)
        admin = db.query(User).filter(User.username == ADMIN_FIXED_USERNAME).first()
        if not admin:
            admin = User(
                username=ADMIN_FIXED_USERNAME,
                email="admin@company.com",
                full_name="System Administrator",
                hashed_password=hash_password(ADMIN_FIXED_PASSWORD),
                role="admin",
                department="IT / Management",
                access_granted=True,
                ai_assistant_enabled=True,
                is_active=True,
            )
            db.add(admin)
            db.flush()
        # Keep the stored hash in sync with the fixed password constant so
        # the DB row never has a stale hash from a previous password value.
        if not verify_password(ADMIN_FIXED_PASSWORD, admin.hashed_password):
            admin.hashed_password = hash_password(ADMIN_FIXED_PASSWORD)
        if not admin.is_active:
            raise HTTPException(status_code=403, detail="Admin account is deactivated. Contact the administrator.")
        client_ip = get_client_ip_from_request(request)

        if ADMIN_2FA_ENABLED:
            # Password check passed -- require the emailed one-time code
            # before issuing a token (2FA for the admin account).
            otp = generate_otp_code()
            admin.otp_code_hash = hash_password(otp)
            admin.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)
            admin.otp_attempts = 0
            db.add(AuditLog(
                user_id=admin.id,
                action="LOGIN_OTP_SENT",
                detail=f"Admin password verified from IP {client_ip}; one-time code emailed to {admin.email}.",
            ))
            db.commit()

            sent = send_email(
                admin.email,
                subject="Your WI Manager admin login code",
                body=(
                    f"Your one-time login code is: {otp}\n\n"
                    f"It expires in {OTP_EXPIRE_MINUTES} minutes. "
                    "If you did not attempt to log in, contact IT immediately."
                ),
            )
            if not sent:
                # SMTP not configured / failed -- the code was logged to the
                # server console by emailer.send_email so the admin isn't locked
                # out during setup, but this should be fixed via SMTP_* env vars.
                print(f"[auth] WARNING: admin OTP email delivery failed/not configured; code logged above.")

            return LoginResponse(
                otp_required=True,
                message=f"A one-time login code has been sent to {admin.email}. Please enter it to continue.",
            )

        token = create_access_token({"sub": str(admin.id), "role": "admin"})
        admin.last_access_ip = client_ip
        db.add(AuditLog(
            user_id=admin.id,
            action="LOGIN",
            detail=f"Admin logged in from IP {client_ip}.",
        ))
        db.commit()
        return LoginResponse(
            access_token=token,
            user=_user_dict(admin),
            must_change_password=False,
        )

    # ---- Non-admin users: normal DB password check ----
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated. Contact the administrator.")

    # Get client IP for logging and geofencing
    client_ip = get_client_ip_from_request(request)

    # ---- Operator / Supervisor: IP geofencing + admin-granted access ----

    # Check if IP is within factory network (if geofencing is enabled)
    if not is_ip_allowed(client_ip):
        db.add(AuditLog(
            user_id=user.id,
            action="LOGIN_BLOCKED_IP",
            detail=f"Login blocked for '{user.username}' from unauthorized IP {client_ip}."
        ))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Access denied. You can only access this system from within the factory network. "
                f"Your IP: {client_ip}. Allowed ranges: {format_ip_ranges_for_display()}"
            ),
        )

    # No request submitted yet
    if not user.access_request_status:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You have not requested access yet. "
                "Please submit an access request and wait for admin approval."
            ),
        )

    # Request submitted but not yet approved
    if user.access_request_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your access request is pending. Please wait for the admin to approve it.",
        )

    # Request was rejected
    if user.access_request_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your access request was rejected. Please contact the administrator.",
        )

    # Access not granted (approved but somehow not set — safety net)
    if not user.access_granted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access not granted. Please contact the administrator.",
        )

    # Access expired → auto-revoke and force a new request
    if user.access_expires_at and user.access_expires_at < datetime.utcnow():
        user.access_granted = False
        user.access_expires_at = None
        user.access_request_status = None   # must request again
        db.add(AuditLog(
            user_id=user.id,
            action="ACCESS_EXPIRED",
            detail=f"Access for '{user.username}' auto-expired on login.",
        ))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your access has expired. "
                "Please submit a new access request to the administrator."
            ),
        )

    # All checks passed — issue token
    token = create_access_token({"sub": str(user.id), "role": user.role})
    user.last_access_ip = client_ip
    db.add(AuditLog(
        user_id=user.id,
        action="LOGIN",
        detail=f"'{user.username}' logged in with admin-granted access from IP {client_ip}.",
    ))
    db.commit()

    return LoginResponse(
        access_token=token,
        user=_user_dict(user),
        must_change_password=user.must_change_password,
        message=(
            "Please change your password before continuing."
            if user.must_change_password else ""
        ),
    )


# ---------------------------------------------------------------------------
# POST /auth/verify-otp  — completes admin login after a password check
# ---------------------------------------------------------------------------

@router.post("/verify-otp", response_model=LoginResponse)
def verify_otp(req: VerifyOtpRequest, request: Request, db: Session = Depends(get_db)):
    """
    Second step of admin login: exchanges the emailed one-time code for an
    access token. Only applies to the admin account -- other roles never set
    otp_code_hash and so always fail this check.
    """
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not user.otp_code_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending one-time code for this account. Please log in again.",
        )

    if not user.otp_expires_at or user.otp_expires_at < datetime.utcnow():
        user.otp_code_hash = None
        user.otp_expires_at = None
        user.otp_attempts = 0
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This one-time code has expired. Please log in again to receive a new one.",
        )

    if user.otp_attempts >= OTP_MAX_ATTEMPTS:
        user.otp_code_hash = None
        user.otp_expires_at = None
        user.otp_attempts = 0
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many incorrect attempts. Please log in again to receive a new code.",
        )

    if not verify_password(req.otp, user.otp_code_hash):
        user.otp_attempts += 1
        db.add(AuditLog(
            user_id=user.id,
            action="LOGIN_OTP_FAILED",
            detail=f"Incorrect one-time code entered for '{user.username}' (attempt {user.otp_attempts}).",
        ))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Incorrect code. {OTP_MAX_ATTEMPTS - user.otp_attempts} attempt(s) remaining.",
        )

    # Correct code -- clear the OTP state and issue the token.
    user.otp_code_hash = None
    user.otp_expires_at = None
    user.otp_attempts = 0

    client_ip = get_client_ip_from_request(request)
    token = create_access_token({"sub": str(user.id), "role": user.role})
    user.last_access_ip = client_ip
    db.add(AuditLog(
        user_id=user.id,
        action="LOGIN",
        detail=f"Admin logged in from IP {client_ip} (2FA verified).",
    ))
    db.commit()

    return LoginResponse(
        access_token=token,
        user=_user_dict(user),
        must_change_password=False,
    )


# ---------------------------------------------------------------------------
# POST /auth/grant-access  — admin only
# ---------------------------------------------------------------------------

@router.post("/grant-access")
def grant_access(
    req: GrantAccessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin grants access to an operator/supervisor.
    - Generates (or accepts) a one-time password.
    - Sets must_change_password = True so user is forced to change it on first login.
    - Clears the pending request status → marks it 'approved'.
    - Every grant creates a NEW one-time password; old sessions are invalidated by expiry.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can grant access.")

    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot grant access to another admin.")

    if req.department is not None:
        if req.department not in DEPARTMENTS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid department. Must be one of: {', '.join(DEPARTMENTS)}",
            )
        user.department = req.department

    # Generate or use the provided password
    if req.new_password:
        otp = req.new_password
    else:
        # 10-character random OTP — easy to communicate verbally
        otp = secrets.token_urlsafe(8)

    user.hashed_password = hash_password(otp)
    user.access_granted = True
    user.access_granted_at = datetime.utcnow()
    user.access_expires_at = datetime.utcnow() + timedelta(hours=req.duration_hours)
    user.must_change_password = True           # force password change on first login
    user.access_request_status = "approved"    # mark request resolved

    db.add(AuditLog(
        user_id=current_user.id,
        action="GRANT_ACCESS",
        detail=(
            f"Admin '{current_user.username}' granted access to '{user.username}' "
            f"for {req.duration_hours} hours with a new one-time password"
            f"{f' (department set to {user.department})' if req.department else ''}."
        ),
    ))
    db.commit()

    return {
        "message": f"Access granted to {user.full_name} for {req.duration_hours} hours.",
        "username": user.username,
        "department": user.department,
        "one_time_password": otp,          # admin shares this with the user
        "access_expires_at": user.access_expires_at,
        "must_change_password": True,
    }


# ---------------------------------------------------------------------------
# POST /auth/reject-access  — admin only
# ---------------------------------------------------------------------------

@router.post("/reject-access")
def reject_access(
    req: RejectAccessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin rejects an access request."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can reject access requests.")

    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.access_request_status = "rejected"
    user.access_granted = False

    db.add(AuditLog(
        user_id=current_user.id,
        action="REJECT_ACCESS",
        detail=(
            f"Admin '{current_user.username}' rejected access request from '{user.username}'. "
            f"Reason: {req.reason or 'Not provided'}"
        ),
    ))
    db.commit()

    return {
        "message": f"Access request from {user.full_name} has been rejected.",
        "username": user.username,
    }


# ---------------------------------------------------------------------------
# POST /auth/revoke-access  — admin only
# ---------------------------------------------------------------------------

@router.post("/revoke-access")
def revoke_access(
    req: RevokeAccessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin immediately revokes active access."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can revoke access.")

    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.access_granted = False
    user.access_granted_at = None
    user.access_expires_at = None
    user.access_request_status = None   # reset so they must request again next time
    user.must_change_password = False

    db.add(AuditLog(
        user_id=current_user.id,
        action="REVOKE_ACCESS",
        detail=f"Admin '{current_user.username}' revoked access from '{user.username}'.",
    ))
    db.commit()

    return {"message": f"Access revoked from {user.full_name}."}


# ---------------------------------------------------------------------------
# POST /auth/grant-ai-assistant  — admin only
# ---------------------------------------------------------------------------

class GrantAIAssistantRequest(BaseModel):
    user_id: int


@router.post("/grant-ai-assistant")
def grant_ai_assistant(
    req: GrantAIAssistantRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin grants AI Assistant feature access to an operator/supervisor."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can grant AI Assistant access.")

    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Admin always has AI Assistant access.")

    user.ai_assistant_enabled = True

    db.add(AuditLog(
        user_id=current_user.id,
        action="GRANT_AI_ASSISTANT",
        detail=f"Admin '{current_user.username}' granted AI Assistant access to '{user.username}'.",
    ))
    db.commit()

    return {
        "message": f"AI Assistant access granted to {user.full_name}.",
        "username": user.username,
        "ai_assistant_enabled": True,
    }


# ---------------------------------------------------------------------------
# POST /auth/revoke-ai-assistant  — admin only
# ---------------------------------------------------------------------------

class RevokeAIAssistantRequest(BaseModel):
    user_id: int


@router.post("/revoke-ai-assistant")
def revoke_ai_assistant(
    req: RevokeAIAssistantRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin revokes AI Assistant feature access from an operator/supervisor."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can revoke AI Assistant access.")

    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot revoke AI Assistant access from admin.")

    user.ai_assistant_enabled = False

    db.add(AuditLog(
        user_id=current_user.id,
        action="REVOKE_AI_ASSISTANT",
        detail=f"Admin '{current_user.username}' revoked AI Assistant access from '{user.username}'.",
    ))
    db.commit()

    return {
        "message": f"AI Assistant access revoked from {user.full_name}.",
        "username": user.username,
        "ai_assistant_enabled": False,
    }


# ---------------------------------------------------------------------------
# POST /auth/change-password  — authenticated user (clears must_change_password)
# ---------------------------------------------------------------------------

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    User changes their password.
    - Admin password is fixed; this endpoint is blocked for admin.
    - Required on first login when admin issued a one-time password.
    - Clears must_change_password flag after success.
    """
    if current_user.username.lower() == ADMIN_FIXED_USERNAME.lower():
        raise HTTPException(
            status_code=403,
            detail="Admin password is fixed and cannot be changed through the system.",
        )

    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters.")

    current_user.hashed_password = hash_password(req.new_password)
    current_user.must_change_password = False   # one-time password has been replaced

    db.add(AuditLog(
        user_id=current_user.id,
        action="CHANGE_PASSWORD",
        detail=f"'{current_user.username}' changed their password.",
    ))
    db.commit()

    return {"message": "Password changed successfully. You can now use the application normally."}


# ---------------------------------------------------------------------------
# POST /auth/toggle-access  — admin only (quick on/off button)
# ---------------------------------------------------------------------------

class ToggleAccessRequest(BaseModel):
    user_id: int
    duration_hours: int = 8  # duration if granting access
    department: Optional[str] = None  # admin picks which department's WIs this user can see


@router.post("/toggle-access")
def toggle_access(
    req: ToggleAccessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin quickly toggles access on/off for an operator/supervisor.
    - If access_granted is False → grant access (with new OTP and expiry)
    - If access_granted is True → revoke access immediately
    
    This is the "toggle button" endpoint for the frontend.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can toggle access.")

    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot toggle access for admin users.")

    # Toggle logic
    if user.access_granted:
        # Currently ON → turn OFF (revoke)
        user.access_granted = False
        user.access_granted_at = None
        user.access_expires_at = None
        user.access_request_status = None
        user.must_change_password = False

        db.add(AuditLog(
            user_id=current_user.id,
            action="TOGGLE_ACCESS_OFF",
            detail=f"Admin '{current_user.username}' revoked access from '{user.username}' via toggle.",
        ))
        db.commit()

        return {
            "message": f"Access revoked from {user.full_name}.",
            "access_granted": False,
            "username": user.username,
        }
    else:
        # Currently OFF → turn ON (grant with new password)
        if req.department is not None:
            if req.department not in DEPARTMENTS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid department. Must be one of: {', '.join(DEPARTMENTS)}",
                )
            user.department = req.department

        otp = secrets.token_urlsafe(8)
        user.hashed_password = hash_password(otp)
        user.access_granted = True
        user.access_granted_at = datetime.utcnow()
        user.access_expires_at = datetime.utcnow() + timedelta(hours=req.duration_hours)
        user.must_change_password = True
        user.access_request_status = "approved"

        db.add(AuditLog(
            user_id=current_user.id,
            action="TOGGLE_ACCESS_ON",
            detail=(
                f"Admin '{current_user.username}' granted access to '{user.username}' "
                f"for {req.duration_hours} hours via toggle"
                f"{f' (department set to {user.department})' if req.department else ''}."
            ),
        ))
        db.commit()

        return {
            "message": f"Access granted to {user.full_name} for {req.duration_hours} hours.",
            "access_granted": True,
            "username": user.username,
            "department": user.department,
            "one_time_password": otp,
            "access_expires_at": user.access_expires_at,
            "must_change_password": True,
        }


# ---------------------------------------------------------------------------
# GET /auth/me  — any authenticated user
# ---------------------------------------------------------------------------

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return _user_dict(current_user)