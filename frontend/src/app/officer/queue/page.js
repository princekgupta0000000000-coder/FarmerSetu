'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = '/api/backend';
const auth = () => localStorage.getItem('farmersetu_access_token');

function money(v) { return Number(v || 0).toLocaleString('en-IN'); }

function Bill({ booking, onClose }) {
  if (!booking) return null;
  const qty = Number(booking.receivedQuantity ?? booking.quantity ?? 0);
  const total = qty * Number(booking.price || 0);
  return (
    <div className="billOverlay no-print" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="billModal">
        <div className="printable-bill">
          <div className="billBrand">FARMERSETU</div>
          <div className="billTitle">PAYMENT RECEIPT</div>
          <div className="paidSeal">✓<span>PAID</span></div>
          <div className="billRows">
            <div><span>Transaction ID</span><b>{booking.paymentReference}</b></div>
            <div><span>Booking ID</span><b>{booking.id}</b></div>
            <div><span>Farmer</span><b>{booking.farmer}</b></div>
            <div><span>Centre</span><b>{booking.centre}</b></div>
            <div><span>Crop</span><b>{booking.crop}</b></div>
            <div><span>Quantity</span><b>{qty} quintal</b></div>
            <div><span>Rate</span><b>₹{money(booking.price)} / quintal</b></div>
            <div><span>Date</span><b>{booking.date}</b></div>
          </div>
          <div className="billTotal"><span>Total Paid</span><strong>₹{money(total)}</strong></div>
          <p className="billFoot">Computer generated receipt • FarmerSetu Procurement</p>
        </div>
        <div className="billActions no-print">
          <button onClick={onClose}>Close</button>
          <button className="printBtn" onClick={() => window.print()}>🧾 Print / Save PDF</button>
        </div>
      </div>
    </div>
  );
}

export default function OfficerQueue() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [token, setToken] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [received, setReceived] = useState('');
  const [note, setNote] = useState('');
  const [tx, setTx] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [showBill, setShowBill] = useState(false);

  const load = async () => {
    try {
      const r = await fetch(`${API}/employee/bookings?date=${date}`, {
        headers: { Authorization: `Bearer ${auth()}` }, cache: 'no-store'
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.detail || `Queue error ${r.status}`);
      setItems(d);
      if (selected) {
        const n = d.find(x => x.id === selected.id);
        if (n) {
          setSelected(n);
          setReceived(n.receivedQuantity ?? '');
          setNote(n.qualityNote || '');
          setTx(n.paymentReference || '');
        }
      }
      setError('');
    } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    let u;
    try { u = JSON.parse(localStorage.getItem('farmersetu_user') || 'null'); } catch {}
    if (!auth() || !['employee','procurement_employee','officer','admin'].includes(u?.role)) {
      location.href = '/login'; return;
    }
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [date]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const pick = b => {
    setSelected(b);
    setReceived(b.receivedQuantity ?? '');
    setNote(b.qualityNote || '');
    setTx(b.paymentReference || '');
    setShowBill(false);
    setError('');
  };

  const verify = async () => {
    if (!token.trim()) return;
    setBusy('verify'); setError('');
    try {
      const r = await fetch(`${API}/employee/bookings/${encodeURIComponent(token.trim())}`, {
        headers: { Authorization: `Bearer ${auth()}` }
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.detail || 'Booking not found');
      pick(d); setToken(''); setToast('✓ Booking verified');
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const saveResult = d => {
    setSelected(d);
    setItems(v => v.map(x => x.id === d.id ? d : x));
    setReceived(d.receivedQuantity ?? '');
    setNote(d.qualityNote || '');
    setTx(d.paymentReference || '');
    return d;
  };

  const update = async (payload, label) => {
    if (!selected) return;
    setBusy(label); setError('');
    try {
      const r = await fetch(`${API}/employee/bookings/${selected.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${auth()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let d = await r.json();
      if (!r.ok) throw Error(d.detail || 'Action failed');

      // Quality pass must always have a server-generated transaction ID.
      if (payload.quality_status === 'Passed' && !d.paymentReference) {
        const gr = await fetch(`${API}/employee/bookings/${selected.id}/generate-transaction`, {
          method: 'POST', headers: { Authorization: `Bearer ${auth()}` }
        });
        const gd = await gr.json();
        if (!gr.ok) throw Error(gd.detail || 'Transaction ID could not be generated');
        d = gd;
      }

      saveResult(d);
      if (payload.quality_status === 'Passed') {
        setToast(`✓ QUALITY PASSED • Transaction ID: ${d.paymentReference}`);
      } else if (payload.payment_status === 'Paid') {
        setToast('✓ PAYMENT SUCCESSFUL • Bill generated');
        setShowBill(true);
      } else {
        setToast(`✓ ${label} completed`);
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const filtered = items.filter(b => !search ||
    [b.id, b.token, b.farmer, b.mobile, b.crop].some(x => String(x || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <main className="emp">
      <header>
        <Link href="/officer/dashboard">← Dashboard</Link>
        <div><small>FARMERSETU</small><h1>Procurement Employee</h1><span>● Live queue • refreshes automatically</span></div>
        <Link href="/login">Logout</Link>
      </header>

      {toast && <div className="toast">{toast}</div>}
      {error && <div className="error">⚠ {error}<button onClick={load}>Retry</button></div>}

      <section className="wrap">
        <div className="verify">
          <div><b>Verify Farmer Booking</b><small>Scan QR or enter booking token / ID</small></div>
          <input value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => e.key === 'Enter' && verify()} placeholder="TK-... / FS-..." />
          <button onClick={verify} disabled={busy === 'verify'}>{busy === 'verify' ? 'Checking…' : 'Verify'}</button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="layout">
          <aside>
            <div className="sidehead"><b>{filtered.length} Bookings</b><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search farmer/token" /></div>
            {filtered.map(b => (
              <button key={b.id} onClick={() => pick(b)} className={selected?.id === b.id ? 'booking selected' : 'booking'}>
                <strong>{b.token}</strong><b>{b.farmer}</b>
                <small>{b.crop} • {b.quantity} qtl • {b.status}</small>
                <em>Quality: {b.qualityStatus} • Pay: {b.paymentStatus}</em>
              </button>
            ))}
          </aside>

          <article>
            {!selected ? <div className="empty"><div>🎫</div><h2>Select or verify a booking</h2><p>The farmer's booking will appear here and every action will update the server.</p></div> : <>
              <div className="identity">
                <div><small>{selected.id}</small><h2>{selected.farmer}</h2><p>{selected.mobile} • {selected.centre}</p></div>
                <strong>{selected.token}</strong>
              </div>

              <div className="steps">
                <span className="done">✓ Booked</span><i className={['Checked In','Processing','Completed'].includes(selected.status) ? 'on' : ''}/>
                <span className={['Checked In','Processing','Completed'].includes(selected.status) ? 'done' : ''}>2 Check In</span><i className={['Processing','Completed'].includes(selected.status) ? 'on' : ''}/>
                <span className={['Processing','Completed'].includes(selected.status) ? 'done' : ''}>3 Quality</span><i className={selected.qualityStatus === 'Passed' ? 'on' : ''}/>
                <span className={selected.qualityStatus === 'Passed' ? 'done' : ''}>4 Payment</span><i className={selected.paymentStatus === 'Paid' ? 'on' : ''}/>
                <span className={selected.paymentStatus === 'Paid' ? 'done' : ''}>✓ Paid</span>
              </div>

              <div className="facts">
                <div><small>Crop</small><b>{selected.crop}</b></div><div><small>Booked quantity</small><b>{selected.quantity} qtl</b></div>
                <div><small>Rate</small><b>₹{money(selected.price)}</b></div><div><small>Amount</small><b>₹{money(selected.estimatedTotal)}</b></div>
              </div>

              <section className="panel">
                <h3>1. Check-in & Processing</h3>
                <div className="actions">
                  <button disabled={!!busy || selected.status !== 'Confirmed'} onClick={() => update({status:'Checked In'}, 'Check In')}>✓ {busy === 'Check In' ? 'Checking…' : 'Check In'}</button>
                  <button disabled={!!busy || !['Checked In','Processing'].includes(selected.status)} onClick={() => update({status:'Processing'}, 'Start Processing')}>⚙ {busy === 'Start Processing' ? 'Starting…' : 'Start Processing'}</button>
                </div>
              </section>

              <section className="panel">
                <h3>2. Quality Check</h3>
                <label>Actual received quantity<input type="number" min="0.01" value={received} onChange={e => setReceived(e.target.value)} /></label>
                <label>Quality remarks<textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Moisture, grade, damage…" /></label>
                <div className="actions">
                  <button disabled={!!busy || !received || selected.qualityStatus === 'Passed'} onClick={() => update({received_quantity:Number(received),quality_note:note,quality_status:'Passed',status:'Processing'}, 'Pass Quality')}>✓ {busy === 'Pass Quality' ? 'Saving…' : selected.qualityStatus === 'Passed' ? 'Quality Passed' : 'Pass Quality'}</button>
                  <button className="reject" disabled={!!busy || selected.qualityStatus === 'Passed'} onClick={() => update({quality_note:note,quality_status:'Rejected'}, 'Reject Quality')}>Reject</button>
                </div>
              </section>

              <section className="panel paymentPanel">
                <h3>3. Payment</h3>
                {tx ? <div className="generated"><div><small>✓ System-generated transaction ID</small><strong>{tx}</strong></div><button onClick={() => navigator.clipboard?.writeText(tx)}>Copy</button></div> : <div className="waiting">Pass Quality first — transaction ID will be generated automatically.</div>}
                <label>Transaction ID<input value={selected.paymentStatus === 'Paid' ? selected.paymentReference : tx} readOnly placeholder="FS-YYYYMMDD-XXXXXXXX" /></label>
                <div className="actions">
                  <button className="dark" disabled={!!busy || !tx || selected.qualityStatus !== 'Passed' || selected.paymentStatus === 'Paid'} onClick={() => update({payment_status:'Paid',payment_reference:tx}, 'Mark Paid')}>✓ {busy === 'Mark Paid' ? 'Confirming…' : selected.paymentStatus === 'Paid' ? 'Already Paid' : 'Mark Paid'}</button>
                </div>

                {selected.paymentStatus === 'Paid' && <div className="paid">
                  <div className="checkCircle">✓</div><strong>PAYMENT SUCCESSFUL</strong><span>Transaction verified • Bill generated successfully</span>
                  <button onClick={() => setShowBill(true)}>🧾 View / Print Bill</button>
                </div>}
              </section>

              <button className="complete" disabled={!!busy || selected.paymentStatus !== 'Paid'} onClick={() => update({status:'Completed'}, 'Complete Procurement')}>✓ {busy === 'Complete Procurement' ? 'Completing…' : 'Complete Procurement'}</button>
            </>}
          </article>
        </div>
      </section>

      {showBill && <Bill booking={selected} onClose={() => setShowBill(false)} />}

      <style jsx global>{`
        *{box-sizing:border-box}.emp{min-height:100vh;background:#f3f7f3;color:#17201b;font-family:Arial,sans-serif}.emp header{min-height:76px;background:#fff;border-bottom:1px solid #e1e9e2;padding:10px 5vw;display:flex;align-items:center;gap:15px}.emp header div{flex:1}.emp header small{font-size:9px;color:#087a3e;font-weight:900;letter-spacing:1.5px}.emp header h1{font-size:18px;margin:4px 0}.emp header span{font-size:8px;color:#16813e}.emp header a{padding:9px 12px;border:1px solid #d5e1d7;border-radius:8px;text-decoration:none;color:#087a3e;font-size:10px;font-weight:800}.wrap{max-width:1200px;margin:auto;padding:22px 16px}.verify{background:#fff;border:1px solid #e1e9e2;border-radius:13px;padding:14px;display:flex;gap:8px;align-items:center}.verify div{flex:1}.verify b,.verify small{display:block}.verify small{font-size:8px;color:#6d786f;margin-top:4px}.verify input{height:38px;border:1px solid #dce5de;border-radius:8px;padding:0 9px}.verify button,.actions button,.complete{height:38px;border:0;border-radius:8px;background:#087a3e;color:#fff;padding:0 13px;font-size:10px;font-weight:800}.verify button:disabled,.actions button:disabled,.complete:disabled{opacity:.5}.layout{display:grid;grid-template-columns:380px 1fr;gap:14px;margin-top:14px}.layout aside,.layout article{background:#fff;border:1px solid #e1e9e2;border-radius:13px;overflow:hidden}.sidehead{padding:12px;border-bottom:1px solid #edf1ed}.sidehead b{display:block;margin-bottom:8px}.sidehead input{width:100%;height:35px;border:1px solid #dce5de;border-radius:7px;padding:0 9px}.booking{width:100%;border:0;border-bottom:1px solid #edf1ed;background:#fff;text-align:left;padding:13px}.booking:hover,.booking.selected{background:#eef8f0}.booking strong,.booking b,.booking small,.booking em{display:block}.booking strong{font-size:10px;color:#087a3e}.booking b{font-size:11px;margin:3px 0}.booking small,.booking em{font-size:8px;color:#6d786f;font-style:normal}.booking em{margin-top:4px}.layout article{padding:20px;min-height:600px}.empty{text-align:center;padding:100px 20px;color:#6d786f}.empty div{font-size:45px}.identity{display:flex;justify-content:space-between;border-bottom:1px solid #edf1ed;padding-bottom:14px}.identity small{font-size:9px;color:#087a3e}.identity h2{margin:5px 0;font-size:21px}.identity p{font-size:10px;color:#6d786f;margin:0}.identity>strong{background:#eef8f0;color:#087a3e;padding:9px;height:max-content;border-radius:8px;font-size:11px}.steps{display:flex;align-items:center;margin:18px 0;gap:5px}.steps span{padding:7px 8px;border-radius:20px;background:#e8eee9;color:#6d786f;font-size:8px;font-weight:800;white-space:nowrap}.steps span.done{background:#087a3e;color:#fff;animation:pop .35s}.steps i{height:2px;flex:1;background:#e4ebe5}.steps i.on{background:#087a3e}.facts{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #edf1ed;border-radius:9px;margin-bottom:14px}.facts div{padding:11px;border-right:1px solid #edf1ed}.facts small,.facts b{display:block}.facts small{font-size:8px;color:#778078;margin-bottom:5px}.facts b{font-size:11px}.panel{border-top:1px solid #edf1ed;padding-top:14px;margin-top:16px}.panel h3{font-size:13px}.actions{display:flex;gap:8px}.actions .reject{background:#fff0ef;color:#a12d25;border:1px solid #efcfcb}.actions .dark{background:#17201b}.panel label{display:grid;gap:6px;font-size:9px;font-weight:800;margin:10px 0}.panel input,.panel textarea{border:1px solid #dce5de;border-radius:8px;padding:9px;font:inherit}.panel input{height:40px}.panel textarea{min-height:70px;resize:vertical}.generated{display:flex;align-items:center;gap:10px;background:#eef9f0;border:1px dashed #82bd90;padding:12px;border-radius:9px;margin-bottom:10px}.generated div{flex:1}.generated small,.generated strong{display:block}.generated small{font-size:8px;color:#53705a}.generated strong{color:#087a3e;letter-spacing:1px;font-size:14px;margin-top:3px}.generated button,.paid button{border:1px solid #b7d4bd;background:#fff;color:#087a3e;border-radius:7px;padding:8px;font-size:9px;font-weight:800}.waiting{background:#f8faf8;border:1px solid #e4ebe5;border-radius:8px;padding:11px;color:#748078;font-size:9px}.paid{margin-top:13px;padding:17px;background:#effaf1;border:1px solid #9fcbaa;border-radius:12px;text-align:center;animation:success .45s}.checkCircle{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#087a3e;color:#fff;font-size:28px;font-weight:900;margin:0 auto 8px;animation:check .55s}.paid strong,.paid span{display:block}.paid strong{color:#087a3e;font-size:15px}.paid span{font-size:8px;color:#657168;margin:4px 0 10px}.complete{width:100%;margin-top:16px;height:46px}.toast{position:fixed;z-index:100;top:90px;left:50%;transform:translateX(-50%);background:#17201b;color:#fff;padding:12px 20px;border-radius:999px;font-size:10px;font-weight:800;box-shadow:0 8px 25px #0002;animation:pop .3s}.error{max-width:1100px;margin:12px auto 0;background:#fff0ef;color:#a12d25;border-radius:8px;padding:10px;font-size:10px}.error button{float:right;border:0;background:#a12d25;color:#fff;border-radius:6px;padding:5px 9px;font-size:8px}.billOverlay{position:fixed;inset:0;z-index:200;background:#0008;display:grid;place-items:center;padding:15px}.billModal{width:min(680px,100%);max-height:95vh;overflow:auto;background:#f3f7f3;border-radius:18px;padding:18px;box-shadow:0 25px 70px #0005}.printable-bill{background:#fff;padding:30px;border-radius:12px}.billBrand{color:#087a3e;font-weight:900;letter-spacing:3px;font-size:12px}.billTitle{font-size:26px;font-weight:900;margin:8px 0 5px}.paidSeal{margin:8px 0 18px;width:72px;height:72px;border:3px solid #087a3e;border-radius:50%;display:grid;place-items:center;color:#087a3e;font-size:32px;font-weight:900}.paidSeal span{font-size:8px;margin-top:-25px}.billRows>div{display:flex;justify-content:space-between;gap:15px;padding:11px 0;border-bottom:1px solid #edf1ed;font-size:10px}.billRows span{color:#6d786f}.billRows b{text-align:right}.billTotal{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding:15px;background:#eef9f0;border-radius:10px}.billTotal strong{font-size:23px;color:#087a3e}.billFoot{text-align:center;color:#7b857e;font-size:8px;margin:18px 0 0}.billActions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.billActions button{border:1px solid #ccd9ce;background:#fff;border-radius:8px;padding:10px 13px;font-weight:800}.billActions .printBtn{background:#087a3e;color:#fff;border-color:#087a3e}@keyframes pop{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}@keyframes success{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}@keyframes check{from{transform:scale(.3) rotate(-20deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}@media print{body>*{display:none!important}.printable-bill{display:block!important;position:absolute;inset:0;padding:30px;background:#fff}.billOverlay{position:static;background:#fff;padding:0}.billModal{width:100%;max-height:none;padding:0;box-shadow:none}.no-print,.billActions{display:none!important}}@media(max-width:800px){.verify{flex-wrap:wrap}.verify div{width:100%;flex-basis:100%}.layout{grid-template-columns:1fr}.facts{grid-template-columns:1fr 1fr}.steps{overflow-x:auto}.steps i{min-width:20px}.layout article{padding:14px}}
      `}</style>
    </main>
  );
}
