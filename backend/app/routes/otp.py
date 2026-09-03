import os, secrets, smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.user import User
from app.services.auth_service import ensure_demo_employee
from app.services.exotel_service import send_sms
from app.utils.security import create_access_token

router=APIRouter(prefix='/api/otp',tags=['OTP Authentication'])
_pending={}
class OTPRequest(BaseModel): identifier:str; channel:str
class OTPVerify(BaseModel): identifier:str; channel:str; otp:str

def find_user(db,identifier):
    ident=identifier.strip()
    if ident in {'9999999999','employee@farmersetu.demo'}: return ensure_demo_employee(db)
    return db.scalar(select(User).where(or_(User.mobile==ident,User.email==ident.lower())))

def send_email(to,otp):
    host=os.getenv('SMTP_HOST'); port=int(os.getenv('SMTP_PORT','587')); user=os.getenv('SMTP_USERNAME'); password=os.getenv('SMTP_PASSWORD'); sender=os.getenv('SMTP_FROM') or user
    if not all((host,user,password,sender)): return {'sent':False,'configured':False,'message':'Email OTP is not configured on Railway. Add SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD and SMTP_FROM.'}
    msg=EmailMessage(); msg['Subject']='FarmerSetu verification code'; msg['From']=sender; msg['To']=to; msg.set_content(f'Your FarmerSetu OTP is {otp}. It expires in 5 minutes. Do not share this code with anyone.')
    try:
        with smtplib.SMTP(host,port,timeout=15) as smtp: smtp.starttls(); smtp.login(user,password); smtp.send_message(msg)
        return {'sent':True,'configured':True}
    except Exception as exc: return {'sent':False,'configured':True,'message':f'Email delivery failed: {str(exc)[:250]}'}

@router.post('/request')
def request_otp(payload:OTPRequest,db:Session=Depends(get_db)):
    channel=payload.channel.lower().strip(); identifier=payload.identifier.strip()
    if channel not in {'sms','email'}: raise HTTPException(400,'Choose SMS or email.')
    user=find_user(db,identifier)
    if not user: raise HTTPException(404,'No FarmerSetu account found for this mobile/email.')
    target=user.mobile if channel=='sms' else user.email
    if not target: raise HTTPException(400,f'No {channel} is registered on this account.')
    key=f'{user.id}:{channel}:{target}'; now=datetime.now(timezone.utc); old=_pending.get(key)
    if old and old['sent_at']>now-timedelta(seconds=30): raise HTTPException(429,'Please wait 30 seconds before requesting another OTP.')
    otp=f'{secrets.randbelow(1000000):06d}'; _pending[key]={'otp':otp,'expires':now+timedelta(minutes=5),'sent_at':now,'attempts':0,'user_id':user.id}
    result=send_sms(target,f'FarmerSetu: Your login OTP is {otp}. It expires in 5 minutes. Do not share it.') if channel=='sms' else send_email(target,otp)
    if not result.get('sent'):
        _pending.pop(key,None)
        detail=result.get('message','Unable to send OTP.')
        if channel=='sms' and not result.get('configured'): detail+=' Configure EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN and EXOTEL_FROM in Railway Variables.'
        raise HTTPException(502,detail)
    return {'sent':True,'channel':channel,'masked':(target[:2]+'******'+target[-2:] if channel=='sms' else target[:2]+'***'+target[target.find('@'):])}

@router.post('/verify')
def verify_otp(payload:OTPVerify,db:Session=Depends(get_db)):
    channel=payload.channel.lower().strip(); user=find_user(db,payload.identifier)
    if channel not in {'sms','email'}: raise HTTPException(400,'Choose SMS or email.')
    if not user: raise HTTPException(404,'Account not found.')
    target=user.mobile if channel=='sms' else user.email; key=f'{user.id}:{channel}:{target}'; item=_pending.get(key)
    if not item or item['expires']<datetime.now(timezone.utc): _pending.pop(key,None); raise HTTPException(400,'OTP expired. Please request a new OTP.')
    item['attempts']+=1
    if item['attempts']>5: _pending.pop(key,None); raise HTTPException(429,'Too many incorrect attempts. Request a new OTP.')
    if payload.otp.strip()!=item['otp']: raise HTTPException(400,'Invalid OTP.')
    _pending.pop(key,None)
    return {'access_token':create_access_token(str(user.id),user.role),'user':{'id':user.id,'full_name':user.full_name,'mobile':user.mobile,'email':user.email,'state':user.state,'district':user.district,'role':user.role}}
