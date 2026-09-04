from datetime import datetime
import secrets
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.booking import Booking
from app.models.notification import Notification
from app.models.user import User
from app.utils.security import decode_access_token

router = APIRouter(prefix='/api/employee', tags=['Procurement Employee'])


def current_user(authorization: str = Header(default=''), db: Session = Depends(get_db)) -> User:
    token = authorization.replace('Bearer ', '', 1).strip()
    payload = decode_access_token(token) if token else None
    if not payload:
        raise HTTPException(401, 'Login required')
    try:
        user = db.get(User, int(payload['sub']))
    except Exception:
        user = None
    if not user or not user.is_active:
        raise HTTPException(401, 'Account is inactive')
    return user


def current_employee(user: User = Depends(current_user)) -> User:
    if user.role not in {'employee', 'procurement_employee', 'officer', 'admin'}:
        raise HTTPException(403, 'Employee access required')
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


ALLOWED_STATUS = {'Confirmed', 'Checked In', 'Processing', 'Completed', 'Cancelled'}
ALLOWED_QUALITY = {'Pending', 'Passed', 'Rejected'}
ALLOWED_PAYMENT = {'Pending', 'Processing', 'Paid', 'Failed'}


def serialize(b: Booking, public=False):
    mobile = b.farmer_mobile if not public else ('******' + b.farmer_mobile[-4:] if len(b.farmer_mobile) >= 4 else '****')
    actual_qty = b.received_quantity if b.received_quantity is not None else b.quantity
    actual_amount = float(actual_qty or 0) * float(b.price or 0)
    return {
        'id': b.booking_id, 'token': b.token, 'farmer_id': b.farmer_id,
        'farmer': b.farmer_name, 'mobile': mobile, 'centre': b.centre,
        'state': b.state, 'district': b.district, 'crop': b.crop,
        'quantity': b.quantity, 'price': b.price, 'estimatedTotal': actual_amount,
        'bookedAmount': b.estimated_amount, 'receivedAmount': actual_amount,
        'date': b.booking_date, 'slot': b.slot, 'status': b.status,
        'qualityStatus': b.quality_status, 'qualityNote': b.quality_note,
        'paymentStatus': b.payment_status,
        'paymentReference': b.payment_reference if not public else '',
        'receivedQuantity': b.received_quantity,
    }


# Temporary fixed transaction ID for the employee workflow.
# It is intentionally server-side so the browser cannot choose an arbitrary ID.
FIXED_TRANSACTION_ID = 'FS-TXN-FARMERSETU-0001'


def make_transaction_id():
    return FIXED_TRANSACTION_ID


def add_notification(db: Session, b: Booking, title: str, message: str, kind: str):
    db.add(Notification(user_id=b.farmer_id, title=title, message=message, kind=kind, booking_id=b.booking_id))


def _generate_transaction_for_booking(b: Booking, db: Session):
    """Idempotent transaction generation used by all legacy/current endpoints."""
    if b.status == 'Cancelled':
        raise HTTPException(400, 'Cancelled booking cannot generate a transaction')
    if b.received_quantity is None:
        raise HTTPException(400, 'Enter actual received quantity before generating transaction ID')
    if b.quality_status != 'Passed':
        b.quality_status = 'Passed'
        if b.status == 'Confirmed':
            b.status = 'Processing'
    if not b.payment_reference:
        b.payment_reference = make_transaction_id()
        b.estimated_amount = float(b.received_quantity) * float(b.price or 0)
        add_notification(
            db, b, 'Quality check passed ✓',
            f'{b.received_quantity:g} quintal received. Final amount: ₹{b.estimated_amount:,.0f}. Transaction ID: {b.payment_reference}.',
            'quality'
        )
    db.commit()
    db.refresh(b)
    return serialize(b)


def _delete_booking_by_key(booking_id: str, db: Session):
    b = db.scalar(select(Booking).where((Booking.booking_id == booking_id) | (Booking.token == booking_id)))
    if not b:
        raise HTTPException(404, 'Booking not found')
    if b.payment_status == 'Paid':
        raise HTTPException(400, 'Paid booking cannot be deleted')
    db.execute(delete(Notification).where(Notification.booking_id == b.booking_id))
    db.delete(b)
    db.commit()
    return {'ok': True, 'booking_id': booking_id, 'message': 'Booking deleted successfully'}


@router.get('/ping')
def ping():
    return {'ok': True}


@router.post('/bookings', status_code=201)
def create_booking(data: BookingCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != 'farmer' or user.id != data.farmer_id:
        raise HTTPException(403, 'Only the logged-in farmer can create this booking')
    existing = db.scalar(select(Booking).where(Booking.booking_id == data.booking_id))
    if existing:
        return serialize(existing)
    b = Booking(**data.model_dump())
    db.add(b)
    db.commit()
    db.refresh(b)
    return serialize(b)


@router.get('/public/bookings/{booking_key}')
def public_booking(booking_key: str, db: Session = Depends(get_db)):
    b = db.scalar(select(Booking).where((Booking.token == booking_key) | (Booking.booking_id == booking_key)))
    if not b:
        raise HTTPException(404, 'Booking not found')
    return serialize(b, public=True)


@router.get('/bookings')
def list_bookings(centre: str | None = None, date: str | None = None, search: str | None = None,
                 _: User = Depends(current_employee), db: Session = Depends(get_db)):
    q = select(Booking).order_by(Booking.booking_date.asc(), Booking.slot.asc(), Booking.created_at.asc())
    if centre:
        q = q.where(Booking.centre == centre)
    if date:
        q = q.where(Booking.booking_date == date)
    if search:
        s = f'%{search.strip()}%'
        q = q.where((Booking.booking_id.ilike(s)) | (Booking.token.ilike(s)) |
                    (Booking.farmer_name.ilike(s)) | (Booking.farmer_mobile.ilike(s)))
    return [serialize(x) for x in db.scalars(q).all()]


@router.get('/bookings/mine')
def my_bookings(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != 'farmer':
        raise HTTPException(403, 'Farmer access required')
    q = select(Booking).where(Booking.farmer_id == user.id).order_by(Booking.booking_date.desc(), Booking.created_at.desc())
    return [serialize(x) for x in db.scalars(q).all()]


@router.get('/bookings/{booking_id}')
def get_booking(booking_id: str, _: User = Depends(current_employee), db: Session = Depends(get_db)):
    b = db.scalar(select(Booking).where((Booking.booking_id == booking_id) | (Booking.token == booking_id)))
    if not b:
        raise HTTPException(404, 'Booking not found')
    return serialize(b)


@router.patch('/bookings/{booking_id}')
def update_booking(booking_id: str, data: BookingUpdate, _: User = Depends(current_employee), db: Session = Depends(get_db)):
    b = db.scalar(select(Booking).where(Booking.booking_id == booking_id))
    if not b:
        raise HTTPException(404, 'Booking not found')
    v = data.model_dump(exclude_none=True)
    old_status, old_quality, old_payment = b.status, b.quality_status, b.payment_status

    if v.get('status') and v['status'] not in ALLOWED_STATUS:
        raise HTTPException(400, 'Invalid booking status')
    if v.get('quality_status') and v['quality_status'] not in ALLOWED_QUALITY:
        raise HTTPException(400, 'Invalid quality status')
    if v.get('payment_status') and v['payment_status'] not in ALLOWED_PAYMENT:
        raise HTTPException(400, 'Invalid payment status')

    received = v.get('received_quantity', b.received_quantity)
    if received is not None:
        if received <= 0:
            raise HTTPException(400, 'Received quantity must be greater than zero')
        if received > b.quantity:
            raise HTTPException(400, f'Received quantity cannot exceed booked quantity ({b.quantity:g} quintal)')

    target_quality = v.get('quality_status', b.quality_status)
    if target_quality == 'Passed' and received is None:
        raise HTTPException(400, 'Enter actual received quantity before passing quality')
    if target_quality == 'Passed' and b.status == 'Cancelled':
        raise HTTPException(400, 'Cancelled booking cannot pass quality')

    if target_quality == 'Passed' and not b.payment_reference:
        v['payment_reference'] = make_transaction_id()

    target_payment = v.get('payment_status', b.payment_status)
    if target_payment == 'Paid':
        if target_quality != 'Passed':
            raise HTTPException(400, 'Quality must be passed before payment')
        reference = (v.get('payment_reference') or b.payment_reference or '').strip()
        if not reference:
            reference = make_transaction_id()
        if b.payment_reference and reference != b.payment_reference:
            raise HTTPException(400, 'Transaction ID does not match the generated ID')
        v['payment_reference'] = reference

    for key, value in v.items():
        setattr(b, key, value)

    if b.quality_status == 'Passed' and b.status == 'Confirmed':
        b.status = 'Processing'
    if b.payment_status == 'Paid':
        b.status = 'Completed'

    actual_qty = b.received_quantity if b.received_quantity is not None else b.quantity
    b.estimated_amount = float(actual_qty or 0) * float(b.price or 0)

    if old_status != b.status:
        messages = {
            'Checked In': ('Farmer checked in ✓', f'Booking {b.token} has been checked in.'),
            'Processing': ('Procurement processing started', f'Booking {b.token} is now being processed.'),
            'Completed': ('Procurement completed ✓', f'Booking {b.token} is complete. Final amount: ₹{b.estimated_amount:,.0f}.'),
        }
        if b.status in messages:
            title, message = messages[b.status]
            add_notification(db, b, title, message, 'status')

    if old_quality != b.quality_status:
        if b.quality_status == 'Passed':
            add_notification(db, b, 'Quality check passed ✓',
                             f'{b.received_quantity:g} quintal received. Final amount: ₹{b.estimated_amount:,.0f}. Transaction ID: {b.payment_reference}.', 'quality')
        elif b.quality_status == 'Rejected':
            add_notification(db, b, 'Quality check rejected',
                             b.quality_note or f'Booking {b.token} did not pass quality check.', 'quality')

    if old_payment != b.payment_status:
        if b.payment_status == 'Processing':
            add_notification(db, b, 'Payment is processing', f'Payment for booking {b.token} is being processed.', 'payment')
        elif b.payment_status == 'Paid':
            add_notification(db, b, 'Payment received ✓',
                             f'₹{b.estimated_amount:,.0f} has been paid. Transaction ID: {b.payment_reference}.', 'payment')
        elif b.payment_status == 'Failed':
            add_notification(db, b, 'Payment failed', f'Payment for booking {b.token} could not be completed.', 'payment')

    db.commit()
    db.refresh(b)
    return serialize(b)


@router.post('/bookings/{booking_id}/generate-transaction')
def generate_transaction(booking_id: str, _: User = Depends(current_employee), db: Session = Depends(get_db)):
    return _generate_transaction_for_booking(
        db.scalar(select(Booking).where((Booking.booking_id == booking_id) | (Booking.token == booking_id))), db
    ) if db.scalar(select(Booking).where((Booking.booking_id == booking_id) | (Booking.token == booking_id))) else (_ for _ in ()).throw(HTTPException(404, 'Booking not found'))


# Legacy alias used by older employee builds.
@router.post('/bookings/{booking_id}/generate-transact')
def generate_transact_legacy(booking_id: str, _: User = Depends(current_employee), db: Session = Depends(get_db)):
    b = db.scalar(select(Booking).where((Booking.booking_id == booking_id) | (Booking.token == booking_id)))
    if not b:
        raise HTTPException(404, 'Booking not found')
    return _generate_transaction_for_booking(b, db)


@router.post('/bookings/{booking_id}/mark-paid')
def mark_paid(booking_id: str, _: User = Depends(current_employee), db: Session = Depends(get_db)):
    b = db.scalar(select(Booking).where((Booking.booking_id == booking_id) | (Booking.token == booking_id)))
    if not b:
        raise HTTPException(404, 'Booking not found')
    if b.status == 'Cancelled':
        raise HTTPException(400, 'Cancelled booking cannot be paid')
    if b.received_quantity is None:
        raise HTTPException(400, 'Enter actual received quantity before payment')
    if b.quality_status != 'Passed':
        b.quality_status = 'Passed'
    if not b.payment_reference:
        b.payment_reference = make_transaction_id()
    old_payment = b.payment_status
    b.payment_status = 'Paid'
    b.status = 'Completed'
    b.estimated_amount = float(b.received_quantity) * float(b.price or 0)
    if old_payment != 'Paid':
        add_notification(db, b, 'Payment received ✓',
                          f'₹{b.estimated_amount:,.0f} has been paid. Transaction ID: {b.payment_reference}.', 'payment')
    db.commit()
    db.refresh(b)
    return serialize(b)


# Legacy aliases used by older employee UI builds.
@router.post('/bookings/{booking_id}/mark-payment')
def mark_payment_legacy(booking_id: str, _: User = Depends(current_employee), db: Session = Depends(get_db)):
    return mark_paid(booking_id, _, db)


@router.post('/bookings/{booking_id}/paid')
def paid_legacy(booking_id: str, _: User = Depends(current_employee), db: Session = Depends(get_db)):
    return mark_paid(booking_id, _, db)


@router.delete('/bookings/{booking_id}')
def delete_booking(booking_id: str, _: User = Depends(current_employee), db: Session = Depends(get_db)):
    return _delete_booking_by_key(booking_id, db)


# POST alias for UIs/proxies that cannot issue DELETE requests.
@router.post('/bookings/{booking_id}/delete')
def delete_booking_post(booking_id: str, _: User = Depends(current_employee), db: Session = Depends(get_db)):
    return _delete_booking_by_key(booking_id, db)


@router.patch('/bookings/{booking_id}/cancel')
def farmer_cancel_booking(booking_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    b = db.scalar(select(Booking).where(Booking.booking_id == booking_id))
    if not b:
        raise HTTPException(404, 'Booking not found')
    if user.role != 'farmer' or b.farmer_id != user.id:
        raise HTTPException(403, 'You can cancel only your own booking')
    if b.status != 'Confirmed':
        raise HTTPException(400, 'This booking can no longer be cancelled')
    b.status = 'Cancelled'
    db.commit()
    db.refresh(b)
    return serialize(b)


@router.post('/reset-demo-data')
def reset_demo_data(user: User = Depends(current_employee), db: Session = Depends(get_db)):
    if user.role != 'admin' and user.mobile != '9999999999':
        raise HTTPException(403, 'Demo reset is not available for this employee')
    db.execute(delete(Notification))
    db.execute(delete(Booking))
    db.commit()
    return {'ok': True, 'message': 'Demo procurement data cleared. Farmer accounts were kept.'}


@router.get('/summary')
def summary(_: User = Depends(current_employee), db: Session = Depends(get_db)):
    from datetime import date
    rows = db.scalars(select(Booking)).all()
    return {
        'total': len(rows), 'today': sum(b.booking_date == date.today().isoformat() for b in rows),
        'checkedIn': sum(b.status == 'Checked In' for b in rows),
        'pendingQuality': sum(b.quality_status == 'Pending' for b in rows),
        'pendingPayment': sum(b.payment_status in {'Pending', 'Processing'} for b in rows),
        'paid': sum(b.payment_status == 'Paid' for b in rows),
        'completed': sum(b.status == 'Completed' for b in rows),
    }
