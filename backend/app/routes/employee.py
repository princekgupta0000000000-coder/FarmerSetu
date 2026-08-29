from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.booking import Booking
from app.models.user import User
from app.utils.security import decode_access_token

router = APIRouter(prefix='/api/employee', tags=['Procurement Employee'])

def current_employee(authorization: str = Header(default=''), db: Session = Depends(get_db)) -> User:
    token = authorization.replace('Bearer ', '', 1).strip()
    payload = decode_access_token(token) if token else None
    if not payload or payload.get('role') not in {'employee','procurement_employee','officer','admin'}:
        raise HTTPException(401, 'Employee login required')
    user = db.get(User, int(payload['sub']))
    if not user or not user.is_active:
        raise HTTPException(401, 'Employee account is inactive')
    return user

class BookingCreate(BaseModel):
    booking_id: str = Field(min_length=3, max_length=40)
    token: str = Field(min_length=3, max_length=60)
    farmer_id: int
    farmer_name: str
    farmer_mobile: str
    centre: str
    state: str
    district: str = ''
    crop: str
    quantity: float = Field(gt=0)
    price: float = Field(ge=0)
    estimated_amount: float = Field(ge=0)
    booking_date: str
    slot: str

class BookingUpdate(BaseModel):
    status: str | None = None
    quality_status: str | None = None
    quality_note: str | None = None
    payment_status: str | None = None
    payment_reference: str | None = None
    received_quantity: float | None = None

ALLOWED_STATUS={'Confirmed','Checked In','Processing','Completed','Cancelled'}
ALLOWED_QUALITY={'Pending','Passed','Rejected'}
ALLOWED_PAYMENT={'Pending','Processing','Paid','Failed'}

def serialize(b: Booking):
    return {'id':b.booking_id,'token':b.token,'farmer_id':b.farmer_id,'farmer':b.farmer_name,'mobile':b.farmer_mobile,'centre':b.centre,'state':b.state,'district':b.district,'crop':b.crop,'quantity':b.quantity,'price':b.price,'estimatedTotal':b.estimated_amount,'date':b.booking_date,'slot':b.slot,'status':b.status,'qualityStatus':b.quality_status,'qualityNote':b.quality_note,'paymentStatus':b.payment_status,'paymentReference':b.payment_reference,'receivedQuantity':b.received_quantity}

@router.get('/ping')
def ping(): return {'ok': True}

@router.post('/bookings', status_code=201)
def create_booking(data: BookingCreate, db: Session = Depends(get_db)):
    existing=db.scalar(select(Booking).where(Booking.booking_id==data.booking_id))
    if existing: return serialize(existing)
    b=Booking(**data.model_dump()); db.add(b); db.commit(); db.refresh(b); return serialize(b)

@router.get('/bookings')
def list_bookings(centre: str|None=None, date: str|None=None, search: str|None=None, _: User=Depends(current_employee), db: Session=Depends(get_db)):
    q=select(Booking).order_by(Booking.booking_date.asc(),Booking.slot.asc(),Booking.created_at.asc())
    if centre: q=q.where(Booking.centre==centre)
    if date: q=q.where(Booking.booking_date==date)
    if search:
        s=f'%{search.strip()}%'; q=q.where((Booking.booking_id.ilike(s))|(Booking.token.ilike(s))|(Booking.farmer_name.ilike(s))|(Booking.farmer_mobile.ilike(s)))
    return [serialize(x) for x in db.scalars(q).all()]

@router.get('/bookings/{booking_id}')
def get_booking(booking_id: str, _: User=Depends(current_employee), db: Session=Depends(get_db)):
    b=db.scalar(select(Booking).where((Booking.booking_id==booking_id)|(Booking.token==booking_id)))
    if not b: raise HTTPException(404,'Booking not found')
    return serialize(b)

@router.patch('/bookings/{booking_id}')
def update_booking(booking_id: str, data: BookingUpdate, _: User=Depends(current_employee), db: Session=Depends(get_db)):
    b=db.scalar(select(Booking).where(Booking.booking_id==booking_id))
    if not b: raise HTTPException(404,'Booking not found')
    values=data.model_dump(exclude_none=True)
    if values.get('status') and values['status'] not in ALLOWED_STATUS: raise HTTPException(400,'Invalid booking status')
    if values.get('quality_status') and values['quality_status'] not in ALLOWED_QUALITY: raise HTTPException(400,'Invalid quality status')
    if values.get('payment_status') and values['payment_status'] not in ALLOWED_PAYMENT: raise HTTPException(400,'Invalid payment status')
    if values.get('quality_status')=='Passed' and not (b.received_quantity or values.get('received_quantity')): raise HTTPException(400,'Enter received quantity before passing quality')
    if values.get('payment_status')=='Paid' and not (b.payment_reference or values.get('payment_reference')): raise HTTPException(400,'Payment reference is required')
    for k,v in values.items(): setattr(b,k,v)
    if b.payment_status=='Paid': b.status='Completed'
    db.commit(); db.refresh(b); return serialize(b)

@router.get('/summary')
def summary(_: User=Depends(current_employee), db: Session=Depends(get_db)):
    from datetime import date
    rows=db.scalars(select(Booking)).all()
    return {'total':len(rows),'today':sum(b.booking_date==date.today().isoformat() for b in rows),'checkedIn':sum(b.status=='Checked In' for b in rows),'pendingQuality':sum(b.quality_status=='Pending' for b in rows),'pendingPayment':sum(b.payment_status=='Pending' for b in rows),'paid':sum(b.payment_status=='Paid' for b in rows),'completed':sum(b.status=='Completed' for b in rows)}
