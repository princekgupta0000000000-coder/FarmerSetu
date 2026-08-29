import os
import json
import urllib.request
import urllib.error
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from app.routes.auth import router as auth_router
from app.routes.notifications import router as notifications_router

app = FastAPI(title="FarmerSetu API", version="1.0.0")

# Handle CORS ourselves so browser preflight requests can never be rejected
# by FastAPI's CORS middleware. This also keeps direct API calls working.
@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method == "OPTIONS":
        from starlette.responses import Response
        response = Response(status_code=204)
    else:
        response = await call_next(request)

    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = request.headers.get(
        "access-control-request-headers", "Content-Type, Authorization"
    )
    response.headers["Access-Control-Max-Age"] = "86400"
    return response

app.include_router(auth_router)
app.include_router(notifications_router)


class WhatsAppNotification(BaseModel):
    phone: str
    message: str


@app.get("/")
def root():
    return {"message": "FarmerSetu API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/notifications/whatsapp")
def whatsapp_notification(payload: WhatsAppNotification):
    token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_id:
        return {"sent": False, "configured": False, "message": "WhatsApp notifications are not configured yet."}
    phone = "".join(ch for ch in payload.phone if ch.isdigit())
    if len(phone) == 10:
        phone = "91" + phone
    if phone.startswith("+"):
        phone = phone[1:]
    data = json.dumps({
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"preview_url": False, "body": payload.message},
    }).encode()
    req = urllib.request.Request(
        f"https://graph.facebook.com/v23.0/{phone_id}/messages",
        data=data,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            result = json.loads(response.read().decode())
        return {"sent": True, "configured": True, "result": result}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        raise HTTPException(status_code=502, detail=f"WhatsApp delivery failed: {detail[:500]}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"WhatsApp delivery failed: {str(exc)[:300]}")
