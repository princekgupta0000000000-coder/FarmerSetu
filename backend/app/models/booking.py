from datetime import datetime
from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.config.database import Base

class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    booking_id: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    token: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    farmer_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    farmer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    farmer_mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    centre: Mapped[str] = mapped_column(String(180), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    district: Mapped[str] = mapped_column(String(100), nullable=True, default="")
    crop: Mapped[str] = mapped_column(String(80), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    estimated_amount: Mapped[float] = mapped_column(Float, nullable=False)
    booking_date: Mapped[str] = mapped_column(String(20), nullable=False)
    slot: Mapped[str] = mapped_column(String(60), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Confirmed", nullable=False)
    quality_status: Mapped[str] = mapped_column(String(30), default="Pending", nullable=False)
    quality_note: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    payment_status: Mapped[str] = mapped_column(String(30), default="Pending", nullable=False)
    payment_reference: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    received_quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
