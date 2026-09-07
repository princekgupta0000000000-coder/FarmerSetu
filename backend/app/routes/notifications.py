from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from firebase_admin import messaging
from app.services.firebase_service import _init_firebase
from app.config.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.dependencies.auth import get_current_user, require_employee

router = APIRouter(prefix='/api/notifications', tags=['Notifications'])

class PushNotification(BaseModel):
    token: str
    title: str
    body: str
    data: dict[str, str] = Field(default_factory=dict)

@router.get('/mine')
def my_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    ).all()
    return [
        {
            'id': n.id, 'title': n.title, 'message': n.message, 'kind': n.kind,
            'bookingId': n.booking_id, 'isRead': n.is_read,
            'createdAt': n.created_at.isoformat() + 'Z',
        }
        for n in rows
    ]

@router.patch('/{notification_id}/read')
def mark_read(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id))
    if not n:
        raise HTTPException(404, 'Notification not found')
    n.is_read = True
    db.commit()
    return {'ok': True}

@router.post('/push')
def push_notification(payload: PushNotification, _user: User = Depends(require_employee)):
    try:
        _init_firebase()
        message = messaging.Message(
            notification=messaging.Notification(title=payload.title, body=payload.body),
            data=payload.data,
            token=payload.token,
        )
        message_id = messaging.send(message)
        return {'sent': True, 'message_id': message_id}
    except Exception as exc:
        raise HTTPException(502, f'Firebase notification failed: {str(exc)[:300]}') from exc
