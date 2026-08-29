from fastapi import APIRouter
from pydantic import BaseModel

from app.services.exotel_service import send_sms

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class SMSNotification(BaseModel):
    phone: str
    message: str


@router.post("/sms")
def sms_notification(payload: SMSNotification):
    return send_sms(payload.phone, payload.message)
