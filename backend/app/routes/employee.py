from datetime import datetime
import secrets
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.booking import Booking
from app.models.user import User
from app.utils.security import decode_access_token

router=APIRouter(prefix='/api/employee',tags=['Procurement Employee'])

def current_user(authorization:str=Header(default=''),db:Session=Depends(get_db))->User:
    token=authorization.replace('Bearer ','',1).strip(); payload=decode_access_token(token) if token else None
    if not payload: raise HTTPException(401,'Login required')
    user=db.get(User,int(payload['sub']))
    if not user or not user.is_active: raise HTTPException(401,'Account is inactive')
    return user

def current_employee(authorization:str=Header(default=''),db:Session=Depends(get_db))->User:
    user=current_user(authorization,db)
    if user.role not in {'employee','procurement_employee','officer','admin'}: raise HTTPException(403,'Employee access required')
    return user

class BookingCreate(BaseModel):
    booking_id:str=Field(min_length=3,max_length=40); token:str=Field(min_length=3,max_length=60); farmer_id:int
    farmer_name:str; farmer_mobile:str; centre:str; state:str; district:str=''; crop:str
    quantity:float=Field(gt=0); price:float=Field(ge=0); estimated_amount:float=Field(ge=0); booking_date:str; slot:str
class BookingUpdate(BaseModel):
    status:str|None=None; quality_status:str|None=None; quality_note:str|None=None
    payment_status:str|None=None; payment_reference:str|None=None; received_quantity:float|None=None

ALLOWED_STATUS={'Confirmed','Checked In','Processing','Completed','Cancelled'}
ALLOWED_QUALITY={'Pending','Passed','Rejected'}
ALLOWED_PAYMENT={'Pending','Processing','Paid','Failed'}

def serialize(b:Booking,public=False):
    mobile=b.farmer_mobile if not public else ('******'+b.farmer_mobile[-4:] if len(b.farmer_mobile)>=4 else '****')
    return {'id':b.booking_id,'token':b.token,'farmer_id':b.farmer_id,'farmer':b.farmer_name,'mobile':mobile,
      'centre':b.centre,'state':b.state,'district':b.district,'crop':b.crop,'quantity':b.quantity,'price':b.price,
      'estimatedTotal':b.estimated_amount,'date':b.booking_date,'slot':b.slot,'status':b.status,
      'qualityStatus':b.quality_status,'qualityNote':b.quality_note,'paymentStatus':b.payment_status,
      'paymentReference':b.payment_reference if not public else '','receivedQuantity':b.received_quantity}

def make_transaction_id(): return f"FS-{datetime.utcnow():%Y%m%d}-{secrets.token_hex(4).upper()}"

@router.get('/ping')
def ping(): return {'ok':True}

@router.post('/bookings',status_code=201)
def create_booking(data:BookingCreate,user:User=Depends(current_user),db:Session=Depends(get_db)):
    if user.role!='farmer' or user.id!=data.farmer_id: raise HTTPException(403,'Only the logged-in farmer can create this booking')
    existing=db.scalar(select(Booking).where(Booking.booking_id==data.booking_id))
    if existing: return serialize(existing)
    b=Booking(**data.model_dump()); db.add(b); db.commit(); db.refresh(b); return serialize(b)

@router.get('/public/bookings/{booking_key}')
def public_booking(booking_key:str,db:Session=Depends(get_db)):
    b=db.scalar(select(Booking).where((Booking.token==booking_key)|(Booking.booking_id==booking_key)))
    if not b: raise HTTPException(404,'Booking not found')
    return serialize(b,public=True)

@router.get('/bookings')
def list_bookings(centre:str|None=None,date:str|None=None,search:str|None=None,_:User=Depends(current_employee),db:Session=Depends(get_db)):
    q=select(Booking).order_by(Booking.booking_date.asc(),Booking.slot.asc(),Booking.created_at.asc())
    if centre: q=q.where(Booking.centre==centre)
    if date: q=q.where(Booking.booking_date==date)
    if search:
        s=f'%{search.strip()}%'; q=q.where((Booking.booking_id.ilike(s))|(Booking.token.ilike(s))|(Booking.farmer_name.ilike(s))|(Booking.farmer_mobile.ilike(s)))
    return [serialize(x) for x in db.scalars(q).all()]

@router.get('/bookings/mine')
def my_bookings(user:User=Depends(current_user),db:Session=Depends(get_db)):
    if user.role!='farmer': raise HTTPException(403,'Farmer access required')
    q=select(Booking).where(Booking.farmer_id==user.id).order_by(Booking.booking_date.desc(),Booking.created_at.desc())
    return [serialize(x) for x in db.scalars(q).all()]

@router.get('/bookings/{booking_id}')
def get_booking(booking_id:str,_:User=Depends(current_employee),db:Session=Depends(get_db)):
    b=db.scalar(select(Booking).where((Booking.booking_id==booking_id)|(Booking.token==booking_id)))
    if not b: raise HTTPException(404,'Booking not found')
    return serialize(b)

@router.patch('/bookings/{booking_id}')
def update_booking(booking_id:str,data:BookingUpdate,_:User=Depends(current_employee),db:Session=Depends(get_db)):
    b=db.scalar(select(Booking).where(Booking.booking_id==booking_id))
    if not b: raise HTTPException(404,'Booking not found')
    v=data.model_dump(exclude_none=True)
    if v.get('status') and v['status'] not in ALLOWED_STATUS: raise HTTPException(400,'Invalid booking status')
    if v.get('quality_status') and v['quality_status'] not in ALLOWED_QUALITY: raise HTTPException(400,'Invalid quality status')
    if v.get('payment_status') and v['payment_status'] not in ALLOWED_PAYMENT: raise HTTPException(400,'Invalid payment status')
    if v.get('received_quantity') is not None and v['received_quantity']<=0: raise HTTPException(400,'Received quantity must be greater than zero')
    if v.get('quality_status')=='Passed' and not (b.received_quantity or v.get('received_quantity')): raise HTTPException(400,'Enter received quantity before passing quality')
    if v.get('quality_status')=='Passed' and not b.payment_reference and not v.get('payment_reference'):
        v['payment_reference']=make_transaction_id()
    if v.get('payment_status')=='Paid':
        reference=(v.get('payment_reference') or b.payment_reference or '').strip()
        if not reference: raise HTTPException(400,'Payment reference is required')
        if b.payment_reference and reference!=b.payment_reference: raise HTTPException(400,'Transaction ID does not match the generated ID')
        if b.quality_status!='Passed' and v.get('quality_status')!='Passed': raise HTTPException(400,'Quality must be passed before payment')
        v['payment_reference']=reference
    for k,val in v.items(): setattr(b,k,val)
    if b.payment_status=='Paid': b.status='Completed'
    db.commit(); db.refresh(b); return serialize(b)

@router.post('/bookings/{booking_id}/generate-transaction')
def generate_transaction(booking_id:str,_:User=Depends(current_employee),db:Session=Depends(get_db)):
    b=db.scalar(select(Booking).where((Booking.booking_id==booking_id)|(Booking.token==booking_id)))
    if not b: raise HTTPException(404,'Booking not found')
    if b.quality_status!='Passed': raise HTTPException(400,'Pass quality before generating transaction ID')
    if not b.payment_reference:
        b.payment_reference=make_transaction_id(); db.commit(); db.refresh(b)
    return serialize(b)

@router.patch('/bookings/{booking_id}/cancel')
def farmer_cancel_booking(booking_id:str,user:User=Depends(current_user),db:Session=Depends(get_db)):
    b=db.scalar(select(Booking).where(Booking.booking_id==booking_id))
    if not b: raise HTTPException(404,'Booking not found')
    if user.role!='farmer' or b.farmer_id!=user.id: raise HTTPException(403,'You can cancel only your own booking')
    if b.status not in {'Confirmed'}: raise HTTPException(400,'This booking can no longer be cancelled')
    b.status='Cancelled'; db.commit(); db.refresh(b); return serialize(b)

@router.get('/summary')
def summary(_:User=Depends(current_employee),db:Session=Depends(get_db)):
    from datetime import date
    rows=db.scalars(select(Booking)).all()
    return {'total':len(rows),'today':sum(b.booking_date==date.today().isoformat() for b in rows),'checkedIn':sum(b.status=='Checked In' for b in rows),'pendingQuality':sum(b.quality_status=='Pending' for b in rows),'pendingPayment':sum(b.payment_status=='Pending' for b in rows),'paid':sum(b.payment_status=='Paid' for b in rows),'completed':sum(b.status=='Completed' for b in rows)}
