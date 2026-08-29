import os, json, urllib.request, urllib.error
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from app.routes.auth import router as auth_router
from app.routes.notifications import router as notifications_router
from app.routes.employee import router as employee_router
from app.config.database import engine, SessionLocal, Base
from app.models.user import User
from app.models.booking import Booking  # noqa: F401
from app.utils.security import hash_password
from sqlalchemy import select

app=FastAPI(title='FarmerSetu API',version='1.0.0')

@app.on_event('startup')
def seed_demo_employee():
    # Creates one safe demo procurement employee only if it does not exist.
    Base.metadata.create_all(bind=engine)
    db=SessionLocal()
    try:
        mobile='9999999999'
        user=db.scalar(select(User).where(User.mobile==mobile))
        if user is None:
            db.add(User(full_name='FarmerSetu Procurement Employee',mobile=mobile,email='employee@farmersetu.demo',password_hash=hash_password('Employee@123'),state='Uttar Pradesh',district='Lucknow',role='employee',is_active=True))
            db.commit()
        elif user.role not in {'employee','procurement_employee','officer','admin'}:
            # Never silently convert an existing farmer account into an employee.
            pass
    finally:
        db.close()

@app.middleware('http')
async def cors_middleware(request: Request, call_next):
    origin=request.headers.get('origin')
    if request.method=='OPTIONS':
        from starlette.responses import Response
        response=Response(status_code=204)
    else: response=await call_next(request)
    if origin: response.headers['Access-Control-Allow-Origin']=origin
    response.headers['Access-Control-Allow-Credentials']='true'
    response.headers['Access-Control-Allow-Methods']='GET,POST,PUT,PATCH,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Headers']=request.headers.get('access-control-request-headers','Content-Type, Authorization')
    response.headers['Access-Control-Max-Age']='86400'
    return response

app.include_router(auth_router)
app.include_router(notifications_router)
app.include_router(employee_router)

class WhatsAppNotification(BaseModel): phone:str; message:str

@app.get('/')
def root(): return {'message':'FarmerSetu API is running'}
@app.get('/health')
def health(): return {'status':'ok'}

@app.post('/api/notifications/whatsapp')
def whatsapp_notification(payload: WhatsAppNotification):
    token=os.getenv('WHATSAPP_ACCESS_TOKEN'); phone_id=os.getenv('WHATSAPP_PHONE_NUMBER_ID')
    if not token or not phone_id: return {'sent':False,'configured':False,'message':'WhatsApp notifications are not configured yet.'}
    phone=''.join(ch for ch in payload.phone if ch.isdigit())
    if len(phone)==10: phone='91'+phone
    data=json.dumps({'messaging_product':'whatsapp','to':phone,'type':'text','text':{'preview_url':False,'body':payload.message}}).encode()
    req=urllib.request.Request(f'https://graph.facebook.com/v23.0/{phone_id}/messages',data=data,headers={'Authorization':f'Bearer {token}','Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req,timeout=12) as response: result=json.loads(response.read().decode())
        return {'sent':True,'configured':True,'result':result}
    except urllib.error.HTTPError as exc: raise HTTPException(502, f'WhatsApp delivery failed: {exc.read().decode(errors="replace")[:500]}')
    except Exception as exc: raise HTTPException(502, f'WhatsApp delivery failed: {str(exc)[:300]}')
