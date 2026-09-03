from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from firebase_admin import messaging
from app.services.firebase_service import _init_firebase

router = APIRouter(prefix='/api/notifications', tags=['Notifications'])

class PushNotification(BaseModel):
    token: str
    title: str
    body: str
    data: dict[str, str] = {}

@router.post('/push')
def push_notification(payload: PushNotification):
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
