import os
import secrets
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.user import User
from app.services.auth_service import ensure_demo_employee
from app.services.firebase_service import verify_firebase_id_token
from app.utils.security import create_access_token

router = APIRouter(prefix='/api/otp', tags=['OTP Authentication'])
_pending = {}

class OTPRequest(BaseModel): identifier: str; channel: str
class OTPVerify(BaseModel): identifier: str; channel: str; otp: str
class FirebaseLoginRequest(BaseModel): id_token: str

def normalize_mobile(value: str) -> str:
    digits = ''.join(ch for ch in value if ch.isdigit())
    return digits[2:] if digits.startswith('91') and len(digits) == 12 else digits

def find_user(db, identifier):
    ident = identifier.strip(); mobile = normalize_mobile(ident)
    if mobile == '9999999999' or ident.lower() == 'employee@farmersetu.demo': return ensure_demo_employee(db)
    return db.scalar(select(User).where(or_(User.mobile == mobile, User.email == ident.lower())))

def public_user(user):
    return {'id':user.id,'full_name':user.full_name,'mobile':user.mobile,'email':user.email,'state':user.state,'district':user.district,'role':user.role}

def send_email(to, otp):
    host=os.getenv('SMTP_HOST'); port=int(os.getenv('SMTP_PORT','587')); user=os.getenv('SMTP_USERNAME'); password=os.getenv('SMTP_PASSWORD'); sender=os.getenv('SMTP_FROM') or user
    if not all((host,user,password,sender)): return {'sent':False,'configured':False,'message':'Email OTP is not configured. Add SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD and SMTP_FROM to Railway.'}
    msg=EmailMessage(); msg['Subject']='FarmerSetu verification code'; msg['From']=sender; msg['To']=to; msg.set_content(f'Your FarmerSetu OTP is {otp}. It expires in 5 minutes. Do not share this code with anyone.')
    try:
        with smtplib.SMTP(host,port,timeout=15) as smtp: smtp.starttls(); smtp.login(user,password); smtp.send_message(msg)
        return {'sent':True,'configured':True}
    except Exception as exc: return {'sent':False,'configured':True,'message':f'Email delivery failed: {str(exc)[:250]}'}

@router.post('/request')
def request_otp(payload: OTPRequest, db: Session = Depends(get_db)):
    channel=payload.channel.lower().strip(); identifier=payload.identifier.strip()
    if channel != 'email': raise HTTPException(400,'SMS OTP is handled by Firebase. Use the SMS option on the website.')
    user=find_user(db,identifier)
    if not user: raise HTTPException(404,'No FarmerSetu account found for this email.')
    target=user.email
    if not target: raise HTTPException(400,'No email is registered on this account.')
    key=f'{user.id}:email:{target}'; now=datetime.now(timezone.utc); old=_pending.get(key)
    if old and old['sent_at'] > now-timedelta(seconds=30): raise HTTPException(429,'Please wait 30 seconds before requesting another OTP.')
    otp=f'{secrets.randbelow(1000000):06d}'; _pending[key]={'otp':otp,'expires':now+timedelta(minutes=5),'sent_at':now,'attempts':0}
    result=send_email(target,otp)
    if not result.get('sent'): _pending.pop(key,None); raise HTTPException(502,result.get('message','Unable to send email OTP.'))
    return {'sent':True,'channel':'email','masked':target[:2]+'***'+target[target.find('@'):]} 

@router.post('/verify')
def verify_email_otp(payload: OTPVerify, db: Session = Depends(get_db)):
    if payload.channel.lower().strip() != 'email': raise HTTPException(400,'SMS OTP must be verified through Firebase.')
    user=find_user(db,payload.identifier)
    if not user or not user.email: raise HTTPException(404,'Account not found.')
    key=f'{user.id}:email:{user.email}'; item=_pending.get(key)
    if not item or item['expires'] < datetime.now(timezone.utc): _pending.pop(key,None); raise HTTPException(400,'OTP expired. Please request a new OTP.')
    item['attempts'] += 1
    if item['attempts'] > 5: _pending.pop(key,None); raise HTTPException(429,'Too many incorrect attempts. Request a new OTP.')
    if payload.otp.strip() != item['otp']: raise HTTPException(400,'Invalid OTP.')
    _pending.pop(key,None)
    return {'access_token':create_access_token(str(user.id),user.role),'user':public_user(user)}

@router.post('/firebase-login')
def firebase_login(payload: FirebaseLoginRequest, db: Session = Depends(get_db)):
    try: decoded=verify_firebase_id_token(payload.id_token)
    except Exception as exc: raise HTTPException(401,f'Firebase verification failed: {str(exc)[:200]}') from exc
    phone=decoded.get('phone_number')
    if not phone: raise HTTPException(400,'Firebase token does not contain a verified phone number.')
    user=find_user(db,phone)
    if not user: raise HTTPException(404,'No FarmerSetu account is registered with this verified mobile number.')
    if not user.is_active: raise HTTPException(403,'This account is inactive.')
    return {'access_token':create_access_token(str(user.id),user.role),'user':public_user(user)}
