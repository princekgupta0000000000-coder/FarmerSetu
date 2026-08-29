'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function VerifyBookingPage() {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let b = null;

    try {
      const raw = new URLSearchParams(window.location.search).get('data');
      b = raw ? JSON.parse(raw) : null;
    } catch {
      b = null;
    }

    if (!b?.id) {
      setLoading(false);
      return;
    }

    setBooking(b);

    fetch(`/api/backend/employee/public/bookings/${encodeURIComponent(b.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((fresh) => {
        if (fresh) setBooking(fresh);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!booking?.id) {
    return (
      <main className="verify-page">
        <section className="verify-card invalid">
          <div className="brand">FARMERSETU</div>
          <h1>Invalid Booking QR</h1>
          <p>This QR code does not contain valid FarmerSetu booking details.</p>
          <Link href="/" className="verify-btn">Go to FarmerSetu</Link>
        </section>
        <style jsx global>{styles}</style>
      </main>
    );
  }

  const amount = Number(
    booking.estimatedTotal ?? Number(booking.price || 0) * Number(booking.quantity || 0)
  );

  return (
    <main className="verify-page">
      <section className="verify-card">
        <div className="brand">FARMERSETU</div>
        <div className="verified">✓ VERIFIED BOOKING</div>
        <h1>Procurement Slot Details</h1>
        <p className="sub">
          {loading ? 'Checking latest booking status…' : 'Live booking status from FarmerSetu.'}
        </p>

        <div className="booking-id">Booking ID: {booking.id}</div>

        {booking.token && (
          <div className="token-box">
            <span>PROCUREMENT TOKEN</span>
            <strong>{booking.token}</strong>
            <small>Show this token at the procurement centre.</small>
          </div>
        )}

        <div className="details">
          <div><span>Farmer</span><strong>{booking.farmer || 'Farmer'}</strong></div>
          <div><span>Procurement Centre</span><strong>{booking.centre || '—'}</strong></div>
          <div><span>State</span><strong>{booking.state || '—'}</strong></div>
          <div><span>Crop / Grain</span><strong>{booking.crop || '—'}</strong></div>
          <div><span>Quantity</span><strong>{booking.quantity ?? '—'} quintal</strong></div>
          <div><span>Price</span><strong>₹{Number(booking.price || 0).toLocaleString('en-IN')} / quintal</strong></div>
          <div><span>Estimated Amount</span><strong className="amount">₹{amount.toLocaleString('en-IN')}</strong></div>
          <div><span>Date</span><strong>{booking.date || '—'}</strong></div>
          <div><span>Time Slot</span><strong>{booking.slot || '—'}</strong></div>
          <div><span>Booking Status</span><strong className="status">{booking.status || 'Confirmed'}</strong></div>
          <div><span>Quality Check</span><strong>{booking.qualityStatus || 'Pending'}</strong></div>
          <div><span>Payment Status</span><strong className={booking.paymentStatus === 'Paid' ? 'paid' : 'payment-pending'}>{booking.paymentStatus || 'Pending'}</strong></div>
        </div>

        <p className="notice">
          Payment and procurement status are updated by authorised procurement-centre employees. This QR page is read-only.
        </p>
        <Link href="/" className="verify-btn">Open FarmerSetu</Link>
      </section>
      <style jsx global>{styles}</style>
    </main>
  );
}

const styles = `
body{margin:0;background:#f4f8f4;color:#17201b;font-family:Arial,Helvetica,sans-serif}
.verify-page{min-height:100vh;padding:28px 16px;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.verify-card{width:min(680px,100%);background:#fff;border:1px solid #dfe8e1;border-radius:18px;box-shadow:0 10px 35px rgba(24,62,35,.08);padding:30px;box-sizing:border-box}
.verify-card.invalid{text-align:center}
.brand{font-size:11px;letter-spacing:2px;color:#087a3e;font-weight:900}
.verified{display:inline-block;margin-top:14px;background:#eaf7ed;color:#17683b;padding:8px 11px;border-radius:999px;font-size:10px;font-weight:900}
h1{font-size:30px;margin:12px 0 6px}
.sub{color:#69736e;font-size:13px;line-height:1.5;margin:0}
.booking-id{margin:20px 0 10px;background:#f1f8f2;border:1px dashed #bcd9c1;border-radius:10px;padding:13px;text-align:center;color:#087a3e;font-size:14px;font-weight:900;letter-spacing:1px}
.token-box{background:#eef8f0;border:1px solid #cce3cf;border-radius:12px;padding:15px;text-align:center;margin-bottom:14px}
.token-box span,.token-box strong,.token-box small{display:block}
.token-box span{font-size:9px;color:#6b766e;font-weight:800}
.token-box strong{font-size:22px;color:#087a3e;letter-spacing:1px;margin:5px 0}
.token-box small{font-size:9px;color:#69736e}
.details{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #edf1ed;margin-top:14px}
.details>div{padding:13px 10px;border-bottom:1px solid #edf1ed}
.details span,.details strong{display:block}
.details span{font-size:9px;color:#788279;margin-bottom:5px}
.details strong{font-size:12px}
.details .amount{color:#087a3e;font-size:17px}
.status{color:#14713d}.paid{color:#14713d}.payment-pending{color:#9a6b16}
.notice{margin:18px 0;background:#fff8e9;border:1px solid #f0dfb8;border-radius:10px;padding:12px;color:#715c29;font-size:11px;line-height:1.5}
.verify-btn{display:inline-flex;justify-content:center;align-items:center;min-height:44px;padding:0 18px;border-radius:9px;background:#087a3e;color:#fff;text-decoration:none;font-size:11px;font-weight:900}
@media(max-width:560px){.verify-page{padding:12px}.verify-card{padding:20px}.details{grid-template-columns:1fr}h1{font-size:24px}}
`;
