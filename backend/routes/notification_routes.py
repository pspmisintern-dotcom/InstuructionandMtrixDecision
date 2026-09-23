from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, Notification, AuditLog
from backend.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


class SendNotificationRequest(BaseModel):
    recipient_ids: List[int]
    title: str
    message: str
    severity: str = "info"


# ---------------------------------------------------------------------------
# Lightweight unread-count endpoint — used by the app Layout's polling badge.
# The full list endpoint returns up to 50 full rows every 30s on every open
# tab; this returns a single integer so background polling stays cheap.
# ---------------------------------------------------------------------------
_UNREAD_COUNT_CACHE: dict = {}
_UNREAD_COUNT_TTL_SECONDS = 10.0


def _get_cached_unread_count(user_id: int):
    import time

    entry = _UNREAD_COUNT_CACHE.get(user_id)
    if entry and (time.monotonic() - entry[1]) < _UNREAD_COUNT_TTL_SECONDS:
        return entry[0]
    return None


def _set_cached_unread_count(user_id: int, count: int):
    import time

    # Bound the cache size so it can't grow without limit.
    if len(_UNREAD_COUNT_CACHE) > 2000:
        _UNREAD_COUNT_CACHE.clear()
    _UNREAD_COUNT_CACHE[user_id] = (count, time.monotonic())


@router.get("/unread-count")
def unread_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cached = _get_cached_unread_count(current_user.id)
    if cached is not None:
        return {"unread": cached}
    from sqlalchemy import func

    count = (
        db.query(func.count(Notification.id))
        .filter(
            ((Notification.user_id == current_user.id) | (Notification.user_id.is_(None))),
            Notification.is_read == False,  # noqa: E712
        )
        .scalar()
        or 0
    )
    _set_cached_unread_count(current_user.id, count)
    return {"unread": count}


@router.get("")
def list_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifs = (
        db.query(Notification)
        .filter((Notification.user_id == current_user.id) | (Notification.user_id.is_(None)))
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    # Any read of the list refreshes the unread-count cache so the badge
    # stays consistent without an extra query.
    try:
        _set_cached_unread_count(
            current_user.id, sum(1 for n in notifs if not n.is_read)
        )
    except Exception:
        pass
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "severity": n.severity,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in notifs
    ]


@router.post("/send")
def send_notification(
    req: SendNotificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin or Supervisor can send notifications to authorized Supervisors and Operators."""
    if current_user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="Only Admin or Supervisor can send notifications.")

    if not req.recipient_ids:
        raise HTTPException(status_code=400, detail="Please select at least one recipient.")

    if not req.title.strip() or not req.message.strip():
        raise HTTPException(status_code=400, detail="Title and message are required.")

    # Validate recipients exist and are authorized
    recipients = db.query(User).filter(User.id.in_(req.recipient_ids)).all()
    if len(recipients) != len(req.recipient_ids):
        raise HTTPException(status_code=400, detail="One or more recipients not found.")

    # Only allow sending to supervisors and operators (not admins)
    for recipient in recipients:
        if recipient.role == "admin":
            raise HTTPException(status_code=400, detail="Cannot send notifications to admin users.")

    # Create notifications for each recipient
    for recipient in recipients:
        notif = Notification(
            user_id=recipient.id,
            sender_id=current_user.id,
            title=req.title,
            message=req.message,
            severity=req.severity,
            is_read=False,
        )
        db.add(notif)

    db.add(AuditLog(
        user_id=current_user.id,
        action="SEND_NOTIFICATION",
        detail=f"'{current_user.username}' sent notification '{req.title}' to {len(recipients)} recipient(s).",
    ))
    db.commit()

    return {
        "message": f"Notification sent to {len(recipients)} recipient(s).",
        "recipient_count": len(recipients),
    }


@router.get("/sent")
def list_sent_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin sees every notification sent by anyone; Supervisor sees only their own sends.

    Lets the sender see, per recipient, whether the notification has been read.
    """
    if current_user.role not in ("admin", "supervisor"):
        raise HTTPException(status_code=403, detail="Only Admin or Supervisor can view sent notifications.")

    query = db.query(Notification).filter(Notification.sender_id.isnot(None))
    if current_user.role != "admin":
        query = query.filter(Notification.sender_id == current_user.id)

    notifs = query.order_by(Notification.created_at.desc()).limit(200).all()

    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "severity": n.severity,
            "is_read": n.is_read,
            "created_at": n.created_at,
            "recipient_id": n.user_id,
            "recipient_name": n.user.full_name if n.user else None,
            "recipient_username": n.user.username if n.user else None,
            "sender_id": n.sender_id,
            "sender_name": n.sender.full_name if n.sender else None,
        }
        for n in notifs
    ]


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    # Only allow marking own notifications as read
    if notif.user_id is not None and notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot mark another user's notification as read.")
    notif.is_read = True
    db.commit()
    return {"message": "Marked as read"}


@router.post("/read-all")
def mark_all_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifs = db.query(Notification).filter(
        (Notification.user_id == current_user.id) | (Notification.user_id.is_(None)),
        Notification.is_read == False,
    ).all()
    for n in notifs:
        n.is_read = True
    db.commit()
    return {"message": f"Marked {len(notifs)} notifications as read"}


@router.delete("/clear-all")
def clear_all_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin-only: permanently clears every notification in the system (personal, sent, and broadcast)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only Admin can clear all notifications.")

    count = db.query(Notification).count()
    db.query(Notification).delete()
    db.add(AuditLog(
        user_id=current_user.id,
        action="CLEAR_NOTIFICATIONS",
        detail=f"'{current_user.username}' cleared all {count} notification(s).",
    ))
    db.commit()
    return {"message": f"Cleared {count} notification(s)."}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin-only: permanently deletes a single notification."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only Admin can delete notifications.")

    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notif)
    db.add(AuditLog(
        user_id=current_user.id,
        action="CLEAR_NOTIFICATIONS",
        detail=f"'{current_user.username}' deleted notification '{notif.title}'.",
    ))
    db.commit()
    return {"message": "Notification deleted"}