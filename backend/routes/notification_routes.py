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


@router.get("")
def list_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifs = (
        db.query(Notification)
        .filter((Notification.user_id == current_user.id) | (Notification.user_id.is_(None)))
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
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