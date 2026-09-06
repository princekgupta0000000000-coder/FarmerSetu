from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.booking import Booking
from app.models.user import User
from app.utils.security import decode_access_token

router = APIRouter(prefix='/api/procurement', tags=['Procurement'])


def current_user(authorization: str = Header(default=''), db: Session = Depends(get_db)) -> User:
    token = authorization.replace('Bearer ', '', 1).strip(); payload = decode_access_token(token) if token else None
    if not payload: raise HTTPException(401, 'Login required')
    try: user = db.get(User, int(payload['sub']))
    except Exception: user = None
    if not user or not user.is_active: raise HTTPException(401, 'Account is inactive')
    return user


def item(b: Booking):
    actual = b.received_quantity if b.received_quantity is not None else None
    return {'bookingId':b.booking_id,'token':b.token,'farmer':b.farmer_name,'centre':b.centre,'state':b.state,'district':b.district,
            'crop':b.crop,'bookedQuantity':b.quantity,'receivedQuantity':actual,'rate':b.price,
            'estimatedAmount':b.estimated_amount,'finalAmount':(actual*b.price if actual is not None else None),
            'status':b.status,'qualityStatus':b.quality_status,'qualityNote':b.quality_note,
            'paymentStatus':b.payment_status,'paymentReference':b.payment_reference,
            'date':b.booking_date,'slot':b.slot,'updatedAt':b.updated_at.isoformat() if b.updated_at else None}


@router.get('/mine')
def mine(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != 'farmer': raise HTTPException(403, 'Farmer access required')
    rows=db.scalars(select(Booking).where(Booking.farmer_id==user.id).order_by(Booking.created_at.desc())).all()
    return {'items':[item(b) for b in rows if b.status!='Cancelled'], 'updatedAt':max((b.updated_at.isoformat() for b in rows), default=None)}


@router.get('/{booking_id}')
def one(booking_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    b=db.scalar(select(Booking).where(Booking.booking_id==booking_id, Booking.farmer_id==user.id))
    if not b: raise HTTPException(404,'Procurement record not found')
    return item(b)


class ProcurementUpdate(BaseModel):
    status: str | None = None
    quality_status: str | None = None
    quality_note: str | None = None
    received_quantity: float | None = Field(default=None, gt=0)

@router.patch('/{booking_id}')
def update(booking_id: str, data: ProcurementUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role not in {'employee','procurement_employee','officer','admin'}: raise HTTPException(403,'Employee access required')
    b=db.scalar(select(Booking).where(Booking.booking_id==booking_id))
    if not b: raise HTTPException(404,'Booking not found')
    values=data.model_dump(exclude_none=True)
    if 'received_quantity' in values and values['received_quantity'] > b.quantity: raise HTTPException(400,'Received quantity cannot exceed booked quantity')
    if values.get('quality_status') == 'Passed' and 'received_quantity' not in values and b.received_quantity is None: values['received_quantity']=b.quantity
    for k,v in values.items(): setattr(b,k,v)
    if b.quality_status=='Passed' and b.status=='Confirmed': b.status='Processing'
    if b.received_quantity is not None: b.estimated_amount=float(b.received_quantity)*float(b.price or 0)
    db.commit(); db.refresh(b); return item(b)
