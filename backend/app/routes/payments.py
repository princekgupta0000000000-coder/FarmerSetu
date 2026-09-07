from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.booking import Booking
from app.models.user import User
from app.dependencies.auth import require_farmer, require_employee

router = APIRouter(prefix='/api/payments', tags=['Payments'])

def item(b: Booking):
    qty=b.received_quantity if b.received_quantity is not None else None
    amount=float(qty)*float(b.price or 0) if qty is not None else None
    return {'bookingId':b.booking_id,'token':b.token,'centre':b.centre,'crop':b.crop,'date':b.booking_date,
            'bookedQuantity':b.quantity,'receivedQuantity':qty,'rate':b.price,'amount':amount,
            'status':b.payment_status,'paymentReference':b.payment_reference or None,
            'qualityStatus':b.quality_status,'updatedAt':b.updated_at.isoformat() if b.updated_at else None}

@router.get('/mine')
def mine(user: User = Depends(require_farmer), db: Session = Depends(get_db)):
    rows=db.scalars(select(Booking).where(Booking.farmer_id==user.id).order_by(Booking.created_at.desc())).all()
    return {'items':[item(b) for b in rows if b.status!='Cancelled'],
            'totalPaid':sum((item(b)['amount'] or 0) for b in rows if b.payment_status=='Paid'),
            'updatedAt':max((b.updated_at.isoformat() for b in rows),default=None)}

@router.get('/{booking_id}')
def one(booking_id: str,user: User=Depends(require_farmer),db: Session=Depends(get_db)):
    b=db.scalar(select(Booking).where(Booking.booking_id==booking_id,Booking.farmer_id==user.id))
    if not b: raise HTTPException(404,'Payment record not found')
    return item(b)

@router.post('/{booking_id}/process')
def process(booking_id: str,user: User=Depends(require_employee),db: Session=Depends(get_db)):
    b=db.scalar(select(Booking).where(Booking.booking_id==booking_id))
    if not b: raise HTTPException(404,'Booking not found')
    if b.quality_status!='Passed' or b.received_quantity is None: raise HTTPException(400,'Quality must be passed and final quantity recorded first')
    if not b.payment_reference: b.payment_reference=f'FS-TXN-{b.booking_id}-{b.id:06d}'
    b.payment_status='Processing'; b.estimated_amount=float(b.received_quantity)*float(b.price or 0)
    db.commit();db.refresh(b);return item(b)
