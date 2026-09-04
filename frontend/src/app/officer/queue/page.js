'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const API = '/api/backend';
const TOKEN_KEY = 'farmersetu_access_token';
const USER_KEY = 'farmersetu_user';

const auth = () => localStorage.getItem(TOKEN_KEY) || '';
const today = () => new Date().toISOString().slice(0, 10);
const money = (v) => Number(v || 0).toLocaleString('en-IN');
const dateText = (v) => v ? new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

async function api(path, options = {}) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${auth()}`, ...(options.headers || {}) },
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.detail || d?.message || `Request failed (${r.status})`);
  return d;
}

function Badge({ value }) {
  const v = String(value || 'Pending');
  return <span className={`badge ${v.toLowerCase().replace(/\s+/g, '-')}`}><i />{v}</span>;
}

function Flow({ booking }) {
  const steps = [
    ['Check-in', booking.status !== 'Confirmed'],
    ['Processing', ['Processing', 'Completed'].includes(booking.status)],
    ['Quality Check', booking.qualityStatus === 'Passed'],
    ['Payment', booking.paymentStatus === 'Paid'],
    ['Complete', booking.status === 'Completed'],
  ];
  return <div className="flow">{steps.map(([name, ok], i) => <div className="flowItem" key={name}>
    <div className={`flowCircle ${ok ? 'done' : ''}`}>{ok ? '✓' : i + 1}</div>
    <strong>{name}</strong>
    {i < steps.length - 1 && <div className={`flowLine ${steps[i + 1][1] ? 'done' : ''}`} />}
  </div>)}</div>;
}

function Receipt({ booking, close }) {
  const qty = Number(booking.receivedQuantity ?? booking.quantity ?? 0);
  const total = qty * Number(booking.price || 0);
  return <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && close()}>
    <div className="receipt">
      <div className="receiptHeader"><div><b>🌿 FARMERSETU</b><small>Digital Procurement Receipt</small></div><span>PAID</span></div>
      <div className="seal">✓<small>PAYMENT<br />SUCCESS</small></div>
      <h2>Payment Receipt</h2>
      <div className="tx"><small>TRANSACTION ID</small><b>{booking.paymentReference || '—'}</b></div>
      {[['Booking ID', booking.id], ['Farmer', booking.farmer], ['Centre', booking.centre], ['Crop', booking.crop], ['Received Quantity', `${qty} quintal`], ['Rate', `₹${money(booking.price)} / quintal`]].map(([a, b]) => <div className="receiptRow" key={a}><span>{a}</span><b>{b}</b></div>)}
      <div className="receiptTotal"><span>Total Paid</span><strong>₹{money(total)}</strong></div>
      <small className="receiptFoot">Computer generated receipt • FarmerSetu</small>
      <div className="receiptButtons"><button onClick={close}>Close</button><button className="primary" onClick={() => window.print()}>🧾 Print / Save PDF</button></div>
    </div>
  </div>;
}

export default function EmployeeQueuePage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(today());
  const [search, setSearch] = useState('');
  const [cropFilter, setCropFilter] = useState('All Crops');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [token, setToken] = useState('');
  const [received, setReceived] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [user, setUser] = useState(null);
  const [clock, setClock] = useState(new Date());

  const notify = (msg) => {
    setToast(msg);
    clearTimeout(window.__fsToast);
    window.__fsToast = setTimeout(() => setToast(''), 3200);
  };

  const load = async () => {
    try {
      const d = await api(`/employee/bookings?date=${encodeURIComponent(date)}`);
      const arr = Array.isArray(d) ? d : [];
      setItems(arr);
      if (selected) {
        const next = arr.find((x) => x.id === selected.id);
        if (next) {
          setSelected(next);
          setReceived(next.receivedQuantity ?? '');
          setNote(next.qualityNote || '');
        } else setSelected(null);
      }
      setError('');
    } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    let u = null;
    try { u = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch {}
    if (!auth() || !['employee', 'procurement_employee', 'officer', 'admin'].includes(u?.role)) {
      location.replace('/login');
      return;
    }
    setUser(u);
    load();
    const refresh = setInterval(load, 5000);
    const tick = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(refresh); clearInterval(tick); };
  }, [date]);

  const choose = (b) => {
    setSelected(b);
    setReceived(b.receivedQuantity ?? '');
    setNote(b.qualityNote || '');
    setError('');
    setShowReceipt(false);
  };

  const verify = async () => {
    if (!token.trim()) return setError('Enter a token number or booking ID.');
    setBusy('verify'); setError('');
    try { choose(await api(`/employee/bookings/${encodeURIComponent(token.trim())}`)); setToken(''); notify('Booking verified successfully'); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const patch = async (payload, label) => {
    if (!selected) return null;
    setBusy(label); setError('');
    try {
      const d = await api(`/employee/bookings/${encodeURIComponent(selected.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      setSelected(d); setItems((v) => v.map((x) => x.id === d.id ? d : x));
      setReceived(d.receivedQuantity ?? ''); setNote(d.qualityNote || '');
      notify(`${label} completed`);
      if (d.paymentStatus === 'Paid') setTimeout(() => setShowReceipt(true), 450);
      return d;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(''); }
  };

  const quality = async () => {
    const q = Number(received);
    if (!q || q <= 0) return setError('Enter actual received quantity first.');
    if (q > Number(selected.quantity || 0)) return setError(`Received quantity cannot exceed ${selected.quantity} quintal.`);
    const d = await patch({ received_quantity: q, quality_note: note, quality_status: 'Passed' }, 'Quality Check');
    if (d && !d.paymentReference) {
      try {
        const generated = await api(`/employee/bookings/${encodeURIComponent(d.id)}/generate-transaction`, { method: 'POST' });
        setSelected(generated); setItems((v) => v.map((x) => x.id === generated.id ? generated : x));
        notify('Transaction ID generated successfully');
      } catch (e) { setError(e.message); }
    }
  };

  const paid = async () => {
    if (!selected) return;
    if (selected.qualityStatus !== 'Passed') return setError('Quality must be passed before payment.');
    let current = selected;
    if (!current.paymentReference) {
      try {
        current = await api(`/employee/bookings/${encodeURIComponent(current.id)}/generate-transaction`, { method: 'POST' });
        setSelected(current); setItems((v) => v.map((x) => x.id === current.id ? current : x));
      } catch (e) { return setError(e.message); }
    }
    await patch({ payment_status: 'Paid', payment_reference: current.paymentReference }, 'Payment');
  };

  const removeBooking = async () => {
    if (!selected) return;
    if (selected.paymentStatus === 'Paid') return setError('Paid booking cannot be deleted.');
    if (!window.confirm(`Delete booking ${selected.id}? This cannot be undone.`)) return;
    setBusy('delete'); setError('');
    try {
      await api(`/employee/bookings/${encodeURIComponent(selected.id)}`, { method: 'DELETE' });
      setItems((v) => v.filter((x) => x.id !== selected.id));
      setSelected(null); notify('Booking deleted successfully');
    } catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const resetDemo = async () => {
    if (user?.role !== 'admin' && user?.mobile !== '9999999999') return setError('Demo reset is available only to the authorised admin account.');
    if (!window.confirm('Clear ALL procurement bookings and notifications? Farmer accounts will remain.')) return;
    setBusy('reset'); setError('');
    try { await api('/employee/reset-demo-data', { method: 'POST' }); setItems([]); setSelected(null); notify('Employee demo database cleared'); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  };

  const crops = useMemo(() => ['All Crops', ...new Set(items.map((x) => x.crop).filter(Boolean))], [items]);
  const filtered = useMemo(() => items.filter((b) => {
    const hay = [b.id, b.token, b.farmer, b.mobile, b.crop, b.centre].join(' ').toLowerCase();
    const statusOk = statusFilter === 'All Status' || b.status === statusFilter || b.qualityStatus === statusFilter || b.paymentStatus === statusFilter;
    return (!search || hay.includes(search.toLowerCase())) && (cropFilter === 'All Crops' || b.crop === cropFilter) && statusOk;
  }), [items, search, cropFilter, statusFilter]);

  const stats = {
    total: items.length,
    complete: items.filter((x) => x.status === 'Completed').length,
    process: items.filter((x) => ['Checked In', 'Processing'].includes(x.status)).length,
    pending: items.filter((x) => x.status === 'Confirmed' || x.qualityStatus === 'Pending' || ['Pending', 'Processing'].includes(x.paymentStatus)).length,
  };
  const payable = selected ? Number(selected.receivedQuantity ?? selected.quantity ?? 0) * Number(selected.price || 0) : 0;
  const logout = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); location.replace('/login'); };

  return <main className="employee">
    <aside className="side">
      <div className="brand"><div className="brandLeaf">🌿</div><div><strong>FarmerSetu</strong><small>For a Brighter Tomorrow</small></div></div>
      <nav>
        <Link href="/officer/dashboard" className="nav active">⌂ <span>Dashboard</span></Link>
        <a className="nav activeSub" href="#queue">▣ <span>Today's Queue</span></a>
        <a className="nav" href="#checkin">✓ <span>Check-in</span></a>
        <a className="nav" href="#processing">⚖ <span>Processing</span></a>
        <a className="nav" href="#quality">✦ <span>Quality Check</span></a>
        <a className="nav" href="#payment">▣ <span>Payments</span></a>
        <a className="nav" href="#completed">✓ <span>Completed</span></a>
        <a className="nav dangerNav" href="#delete">▣ <span>Delete Booking</span></a>
      </nav>
      <div className="support"><b>◷ Help & Support</b><span>Need help? Contact admin</span><button onClick={() => alert('Please contact your centre administrator.')}>Contact Support</button></div>
      <div className="version">FarmerSetu v1.0<br /><span>Together for Farmers</span></div>
    </aside>

    <section className="main">
      <header className="top">
        <div className="topTitle"><button className="menu">☰</button><div><small>FARMERSETU</small><h1>Employee Portal</h1><p>Procurement Centre Operations</p></div></div>
        <div className="topRight"><span>🔔 <b className="dot">3</b></span><span>📍 {user?.centre || 'Procurement Centre'}</span><span>📅 {dateText(date)}</span><span>🕒 {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span><div className="person"><b>{(user?.full_name || 'E')[0]}</b><div><strong>{user?.full_name || 'Employee'}</strong><small>Procurement Centre Staff</small></div></div><button onClick={logout}>Logout</button></div>
      </header>

      {toast && <div className="toast">✓ {toast}</div>}
      {error && <div className="error"><span>⚠</span><b>{error}</b><button onClick={load}>Retry</button></div>}

      <div className="content">
        <section className="hero">
          <div><small>PROCUREMENT OPERATIONS</small><h2>Good day, {user?.full_name?.split(' ')[0] || 'Employee'} 👋</h2><p>Manage farmer arrivals, quality checks and payments from one professional workspace.</p></div>
          <div className="heroActions"><button onClick={() => document.getElementById('verify')?.scrollIntoView({ behavior: 'smooth' })}>🔎 Verify Booking</button><Link href="/officer/dashboard">Dashboard →</Link></div>
        </section>

        <section className="stats">
          <div className="stat"><i>👥</i><div><b>{stats.total}</b><strong>Today's Bookings</strong><small>Live queue</small></div></div>
          <div className="stat"><i>✓</i><div><b>{stats.complete}</b><strong>Completed</strong><small>Successfully processed</small></div></div>
          <div className="stat"><i>◷</i><div><b>{stats.process}</b><strong>In Process</strong><small>At centre now</small></div></div>
          <div className="stat"><i>!</i><div><b>{stats.pending}</b><strong>Pending</strong><small>Needs attention</small></div></div>
        </section>

        <section className="verify" id="verify">
          <div><strong>Verify farmer booking</strong><span>Enter token number or booking ID to open a record.</span></div>
          <input value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && verify()} placeholder="TK-XXXXXX or FS-XXXXXXX" />
          <button className="primary" disabled={!!busy} onClick={verify}>{busy === 'verify' ? 'Verifying…' : 'Verify Booking'}</button>
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          {user?.role === 'admin' && <button className="reset" disabled={!!busy} onClick={resetDemo}>Clear Demo DB</button>}
        </section>

        <section className="queueCard" id="queue">
          <div className="sectionHead"><div><h2>Today's Queue</h2><p>Appointments for {dateText(date)} • auto-refresh every 5 seconds</p></div><b className="live"><i /> LIVE</b></div>
          <div className="filters"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="⌕  Search by Token No, Booking ID, Farmer Name or Mobile…" /><select value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}>{crops.map((x) => <option key={x}>{x}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All Status</option><option>Confirmed</option><option>Checked In</option><option>Processing</option><option>Passed</option><option>Paid</option><option>Completed</option></select><button onClick={load}>↻ Refresh</button></div>
          <div className="tableWrap"><div className="tableHead"><span>#</span><span>Token No.</span><span>Booking ID</span><span>Farmer Name</span><span>Crop</span><span>Time Slot</span><span>Status</span><span>Action</span></div>
            {filtered.map((b, i) => <button className={`tableRow ${selected?.id === b.id ? 'selected' : ''}`} key={b.id} onClick={() => choose(b)}><span>{i + 1}</span><strong>{b.token}</strong><span>{b.id}</span><span className="farmerCell">{b.farmer}<small>{b.mobile}</small></span><span>{b.crop}<small>{b.quantity} qtl</small></span><span>{b.slot}</span><Badge value={b.status} /><em>View →</em></button>)}
            {!filtered.length && <div className="empty">No bookings match the selected filters.</div>}
          </div>
        </section>

        {selected ? <section className="workspace">
          <div className="bookingHead"><div><small>VERIFIED BOOKING</small><h2>{selected.farmer}</h2><p>📱 {selected.mobile} &nbsp; • &nbsp; 📍 {selected.centre}</p></div><Badge value={selected.status} /></div>
          <div className="facts">{[['Booking ID', selected.id], ['Farmer Token', selected.token], ['Crop', selected.crop], ['Booked Quantity', `${selected.quantity} qtl`], ['Date', dateText(selected.date)], ['Time Slot', selected.slot]].map(([a, b]) => <div key={a}><small>{a}</small><strong>{b}</strong></div>)}</div>
          <Flow booking={selected} />

          <section className="op" id="checkin"><div className="opTitle"><b>01</b><div><h3>Arrival & Check-in</h3><p>Confirm the farmer has arrived at the procurement centre.</p></div><Badge value={selected.status} /></div><div className="buttons"><button className="primary" disabled={!!busy || selected.status !== 'Confirmed'} onClick={() => patch({ status: 'Checked In' }, 'Check-in')}>{busy === 'Check-in' ? 'Processing…' : selected.status === 'Confirmed' ? '✓ Check-in Farmer' : '✓ Farmer Checked In'}</button><button disabled={!!busy || !['Checked In', 'Processing'].includes(selected.status)} onClick={() => patch({ status: 'Processing' }, 'Processing')}>{busy === 'Processing' ? 'Starting…' : '⚖ Start Weighing & Processing'}</button></div></section>

          <section className="op" id="processing"><div className="opTitle"><b>02</b><div><h3>Processing & Actual Quantity</h3><p>Enter the actual quantity received. This controls the final payment.</p></div><Badge value={selected.qualityStatus} /></div><div className="form"><label>Actual received quantity (quintal)<input type="number" min="0.01" max={selected.quantity} step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={`Maximum ${selected.quantity}`} /></label><label>Quality remarks<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Moisture, grade, damage, cleanliness…" /></label></div></section>

          <section className="op" id="quality"><div className="opTitle"><b>03</b><div><h3>Quality Check</h3><p>Pass or reject the lot after inspection.</p></div><Badge value={selected.qualityStatus} /></div><div className="buttons"><button className="primary" disabled={!!busy || !received || selected.qualityStatus === 'Passed'} onClick={quality}>{busy === 'Quality Check' ? 'Saving quality…' : '✓ Pass Quality & Generate Transaction ID'}</button><button className="danger" disabled={!!busy || selected.qualityStatus === 'Passed'} onClick={() => patch({ quality_note: note, quality_status: 'Rejected' }, 'Quality Rejected')}>Reject Lot</button></div></section>

          <section className="op paymentOp" id="payment"><div className="opTitle"><b>04</b><div><h3>Payment & Transaction</h3><p>Final amount = actual received quantity × agreed rate.</p></div><Badge value={selected.paymentStatus} /></div>
            {selected.paymentReference ? <div className="transaction"><div><small>SYSTEM-GENERATED TRANSACTION ID</small><strong>{selected.paymentReference}</strong></div><button onClick={() => navigator.clipboard?.writeText(selected.paymentReference)}>Copy ID</button></div> : <div className="waiting">🔒 Pass quality first. The server will generate the transaction ID automatically.</div>}
            <div className="payLine"><div><small>Final payable amount</small><strong>₹{money(payable)}</strong><span>{Number(selected.receivedQuantity ?? selected.quantity ?? 0)} qtl × ₹{money(selected.price)} / qtl</span></div><button className="pay" disabled={!!busy || selected.qualityStatus !== 'Passed' || selected.paymentStatus === 'Paid'} onClick={paid}>{busy === 'Payment' ? 'Confirming…' : selected.paymentStatus === 'Paid' ? '✓ Payment Completed' : '₹ Mark as Paid'}</button></div>
            {selected.paymentStatus === 'Paid' && <div className="paidBanner">✓ PAYMENT SUCCESSFUL <button onClick={() => setShowReceipt(true)}>🧾 Generate Receipt</button></div>}
          </section>

          <section className="deleteArea" id="delete"><div><b>Booking management</b><span>Delete only when the booking is not paid.</span></div><button className="deleteBtn" disabled={!!busy || selected.paymentStatus === 'Paid'} onClick={removeBooking}>{busy === 'delete' ? 'Deleting…' : '🗑 Delete Booking'}</button></section>
        </section> : <div className="hint"><div>▣</div><h2>Select a booking to begin</h2><p>Choose a farmer from Today's Queue or verify a token above. Every action is saved on the server and reflected on the farmer side.</p></div>}
      </div>
    </section>
    {showReceipt && selected && <Receipt booking={selected} close={() => setShowReceipt(false)} />}

    <style jsx global>{`
      *{box-sizing:border-box}.employee{min-height:100vh;background:#eef5f2;color:#17221b;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;font-size:15px}.side{width:250px;min-height:100vh;position:sticky;top:0;background:linear-gradient(180deg,rgba(0,104,62,.96),rgba(0,82,52,.96)),url('/images/nature.jpeg') center/cover;border-right:1px solid #073e2a;color:#fff;padding:22px 14px;display:flex;flex-direction:column;box-shadow:6px 0 22px rgba(18,60,43,.12)}.brand{display:flex;align-items:center;gap:12px;padding:4px 9px 28px;border-bottom:1px solid rgba(255,255,255,.22)}.brandLeaf{width:44px;height:44px;border-radius:13px;background:rgba(255,255,255,.16);display:grid;place-items:center;font-size:24px}.brand strong{display:block;font-size:21px;letter-spacing:-.4px}.brand small{display:block;font-size:11px;opacity:.82;margin-top:3px}.side nav{display:grid;gap:5px;margin-top:22px}.nav{display:flex;align-items:center;gap:14px;color:#fff;text-decoration:none;padding:13px 14px;border-radius:10px;font-size:15px;font-weight:750;opacity:.92}.nav:hover,.nav.activeSub{background:rgba(255,255,255,.16);opacity:1}.nav.active{background:#078b50;box-shadow:inset 4px 0 0 #baf2d1}.dangerNav{margin-top:8px}.support{margin-top:auto;border:1px solid rgba(255,255,255,.18);background:rgba(0,46,31,.42);padding:15px;border-radius:13px;display:grid;gap:6px}.support b{font-size:14px}.support span{font-size:11px;opacity:.78}.support button{margin-top:6px;border:0;border-radius:8px;padding:9px;background:rgba(255,255,255,.14);color:#fff;font-weight:800;cursor:pointer}.version{text-align:center;font-size:11px;opacity:.75;padding-top:15px;line-height:1.5}.version span{opacity:.7}.main{flex:1;min-width:0}.top{height:82px;background:#fff;border-bottom:1px solid #d8e4dd;display:flex;justify-content:space-between;align-items:center;padding:0 28px;gap:20px}.topTitle{display:flex;align-items:center;gap:14px}.topTitle small{font-size:11px;letter-spacing:2px;font-weight:900;color:#087d49}.top h1{font-size:27px;line-height:1.1;margin:3px 0 1px;letter-spacing:-.8px}.top p{margin:0;color:#65736b;font-size:13px}.menu{width:40px;height:40px;border:1px solid #cddbd3;border-radius:11px;background:#f7fbf8;font-size:20px;color:#075e3c}.topRight{display:flex;align-items:center;gap:14px;color:#526159;font-size:12px;white-space:nowrap}.topRight>span:first-child{position:relative;font-size:19px}.dot{position:absolute;top:-8px;right:-7px;background:#e63838;color:#fff;border-radius:99px;font-size:9px;padding:2px 5px}.person{display:flex;align-items:center;gap:9px;padding-left:5px}.person>b{width:38px;height:38px;border-radius:50%;background:#0a7d47;color:#fff;display:grid;place-items:center;font-size:17px}.person strong,.person small{display:block}.person strong{font-size:13px;color:#1d2922}.person small{font-size:10px;color:#758078;margin-top:2px}.topRight>button{border:1px solid #cbd9d1;background:#fff;border-radius:8px;padding:8px 10px;font-weight:750;color:#46544c}.content{padding:25px 28px 40px;max-width:1600px;margin:auto}.hero{background:linear-gradient(120deg,#e5f5ea,#f5fbf7);border:1px solid #cbded1;border-radius:17px;padding:22px 24px;display:flex;justify-content:space-between;align-items:center;gap:20px}.hero small{font-size:10px;letter-spacing:1.6px;font-weight:900;color:#16804d}.hero h2{margin:7px 0 4px;font-size:25px;letter-spacing:-.6px}.hero p{margin:0;color:#617067;font-size:14px}.heroActions{display:flex;gap:9px;align-items:center}.heroActions button,.heroActions a{border-radius:9px;padding:11px 15px;text-decoration:none;font-weight:800;font-size:13px}.heroActions button{border:0;background:#087e47;color:#fff}.heroActions a{border:1px solid #c4d5cb;background:#fff;color:#087445}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:17px 0}.stat{background:#fff;border:1px solid #cddbd3;border-radius:13px;padding:16px;display:flex;gap:13px;align-items:center;box-shadow:0 2px 7px rgba(26,67,48,.04)}.stat i{width:45px;height:45px;border-radius:12px;background:#e7f7ec;display:grid;place-items:center;font-style:normal;font-size:23px;color:#087e47}.stat:nth-child(2) i{background:#e9f1ff;color:#1d6de3}.stat:nth-child(3) i{background:#fff5df;color:#ef9c00}.stat:nth-child(4) i{background:#ffe9e9;color:#e63c43}.stat b{display:block;font-size:25px;line-height:1;color:#132019}.stat strong{display:block;font-size:13px;margin-top:4px}.stat small{display:block;color:#7b877f;font-size:10px;margin-top:2px}.verify{background:#fff;border:1px solid #cbdad1;border-radius:13px;padding:14px;display:grid;grid-template-columns:1.2fr 1.5fr auto auto auto;gap:10px;align-items:center;margin-bottom:17px}.verify>div strong,.verify>div span{display:block}.verify>div strong{font-size:14px}.verify>div span{font-size:11px;color:#78847d;margin-top:2px}.verify input,.filters input,.filters select,.verify label input{height:42px;border:1px solid #b9c9c0;border-radius:8px;background:#fff;padding:0 12px;font-size:13px;outline:none;color:#26332c}.verify input:focus,.filters input:focus{border-color:#0b8a50;box-shadow:0 0 0 3px rgba(11,138,80,.09)}.verify label{font-size:10px;color:#657169;font-weight:800}.verify label input{display:block;margin-top:3px}.primary{border:0;background:#078b4e;color:#fff;border-radius:8px;height:42px;padding:0 15px;font-weight:850;cursor:pointer}.primary:disabled,.pay:disabled,.buttons button:disabled,.deleteBtn:disabled,.reset:disabled{opacity:.52;cursor:not-allowed}.reset{height:42px;border:1px solid #e1b0b0;background:#fff4f4;color:#a52c2c;border-radius:8px;font-weight:800}.queueCard,.workspace .op,.deleteArea,.hint{background:#fff;border:1px solid #c7d7ce;border-radius:14px;box-shadow:0 2px 10px rgba(26,67,48,.04)}.queueCard{overflow:hidden}.sectionHead{padding:17px 19px 13px;display:flex;justify-content:space-between;align-items:center}.sectionHead h2{font-size:20px;margin:0}.sectionHead p{margin:4px 0 0;font-size:11px;color:#78857d}.live{font-size:11px;color:#087e47}.live i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#32b66b;margin-right:6px;box-shadow:0 0 0 4px #e6f7ed}.filters{padding:0 14px 14px;display:grid;grid-template-columns:1fr 155px 155px 92px;gap:8px}.filters input{width:100%}.filters select,.filters button{height:42px;border:1px solid #b9c9c0;border-radius:8px;background:#fff;padding:0 10px;font-weight:700;color:#4b5a51}.filters button{cursor:pointer}.tableWrap{overflow:auto;border-top:1px solid #dce6e1}.tableHead,.tableRow{min-width:900px;display:grid;grid-template-columns:42px 145px 125px 1.4fr 110px 130px 125px 80px;align-items:center;gap:0}.tableHead{background:#f5f8f6;color:#58655e;font-size:11px;font-weight:900;padding:11px 13px;text-transform:uppercase;letter-spacing:.4px}.tableRow{width:100%;border:0;border-bottom:1px solid #e0e8e3;background:#fff;padding:12px 13px;text-align:left;font-size:12px;color:#25332b;cursor:pointer}.tableRow:hover,.tableRow.selected{background:#f1faf4}.tableRow strong{color:#087b48}.tableRow .farmerCell{font-weight:750}.tableRow small{display:block;color:#87918b;font-size:10px;margin-top:3px}.tableRow em{font-style:normal;color:#087b48;font-weight:850}.badge{display:inline-flex;align-items:center;gap:6px;width:max-content;padding:6px 9px;border-radius:999px;background:#eef4ef;color:#4c5d53;font-size:10px;font-weight:850}.badge i{width:7px;height:7px;border-radius:50%;background:#9aa79f}.badge.confirmed{background:#e9f6ee;color:#187443}.badge.confirmed i{background:#49ad73}.badge.checked-in,.badge.processing{background:#eaf1ff;color:#2167c7}.badge.checked-in i,.badge.processing i{background:#3e86ef}.badge.passed,.badge.paid,.badge.completed{background:#e6f8ed;color:#087844}.badge.passed i,.badge.paid i,.badge.completed i{background:#19a75d}.badge.pending{background:#fff2df;color:#a36d12}.badge.pending i{background:#eca52e}.badge.rejected,.badge.failed{background:#ffe9e9;color:#b42c35}.badge.rejected i,.badge.failed i{background:#e64b53}.empty{text-align:center;padding:35px;color:#7c8881;font-size:13px}.workspace{margin-top:17px;display:grid;gap:14px}.bookingHead{background:#fff;border:1px solid #c7d7ce;border-radius:14px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center}.bookingHead small{font-size:10px;letter-spacing:1.5px;color:#087e47;font-weight:900}.bookingHead h2{font-size:22px;margin:4px 0}.bookingHead p{margin:0;color:#69766e;font-size:12px}.facts{background:#fff;border:1px solid #c7d7ce;border-radius:14px;display:grid;grid-template-columns:repeat(6,1fr);overflow:hidden}.facts div{padding:14px 16px;border-right:1px solid #dce5e0}.facts div:last-child{border-right:0}.facts small{display:block;color:#7b8780;font-size:10px}.facts strong{display:block;font-size:13px;margin-top:6px}.flow{background:#fff;border:1px solid #c7d7ce;border-radius:14px;padding:20px 28px;display:flex;justify-content:space-between;align-items:flex-start}.flowItem{position:relative;flex:1;text-align:center}.flowCircle{margin:auto;width:36px;height:36px;border-radius:50%;background:#dfe7e2;color:#66736c;display:grid;place-items:center;font-weight:900;font-size:13px;position:relative;z-index:2}.flowCircle.done{background:#0a8a4d;color:#fff;box-shadow:0 0 0 4px #e5f5eb}.flowItem strong{display:block;margin-top:9px;font-size:11px}.flowLine{height:3px;background:#dbe4df;position:absolute;top:17px;left:50%;width:100%;z-index:1}.flowLine.done{background:#0a8a4d}.op{padding:18px 20px}.opTitle{display:flex;align-items:center;gap:12px;border-bottom:1px solid #e0e8e3;padding-bottom:14px}.opTitle>b{width:34px;height:34px;border-radius:9px;background:#e7f6ec;color:#087d47;display:grid;place-items:center}.opTitle h3{font-size:17px;margin:0}.opTitle p{font-size:11px;color:#78857e;margin:3px 0 0}.opTitle .badge{margin-left:auto}.buttons{display:flex;gap:10px;margin-top:14px}.buttons button{height:43px;padding:0 17px;border:1px solid #b9c9c0;border-radius:8px;background:#fff;color:#2b392f;font-weight:850;cursor:pointer}.buttons .danger,.danger{color:#b72d35;border-color:#e7b9bc;background:#fff7f7}.form{display:grid;grid-template-columns:1fr 1.4fr;gap:13px;margin-top:14px}.form label{font-size:11px;font-weight:850;color:#55635b}.form input,.form textarea{display:block;width:100%;margin-top:6px;border:1px solid #b9c9c0;border-radius:8px;padding:11px 12px;font:inherit;font-size:13px;outline:none}.form textarea{height:80px;resize:vertical}.paymentOp{background:linear-gradient(180deg,#fff,#fbfefd)}.transaction{margin-top:14px;border:1px solid #b9dbc7;background:#f1faf4;border-radius:10px;padding:12px;display:flex;justify-content:space-between;align-items:center}.transaction small{display:block;color:#668074;font-size:9px;letter-spacing:1px;font-weight:900}.transaction strong{display:block;color:#087a47;font-size:16px;letter-spacing:.5px;margin-top:4px}.transaction button{border:1px solid #bad0c3;background:#fff;border-radius:7px;padding:8px 11px;font-weight:800;color:#087645}.waiting{margin-top:14px;background:#f6f8f7;border:1px dashed #c8d4ce;border-radius:9px;padding:13px;color:#68766d;font-size:12px}.payLine{margin-top:14px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e0e8e3;padding-top:15px}.payLine small,.payLine span{display:block;color:#7b8780;font-size:10px}.payLine strong{display:block;font-size:26px;color:#087d47;margin:3px 0}.pay{height:45px;padding:0 20px;border:0;border-radius:9px;background:#6045d8;color:#fff;font-weight:900;font-size:13px;cursor:pointer}.paidBanner{margin-top:13px;background:#e8f8ee;border:1px solid #bfe3ca;border-radius:9px;color:#087a47;padding:11px 13px;font-weight:900;display:flex;justify-content:space-between;align-items:center}.paidBanner button{border:1px solid #9fc9ad;background:#fff;border-radius:7px;padding:7px 10px;color:#087a47;font-weight:850}.deleteArea{display:flex;justify-content:space-between;align-items:center;padding:15px 18px}.deleteArea b,.deleteArea span{display:block}.deleteArea b{font-size:13px}.deleteArea span{font-size:10px;color:#7c8781;margin-top:3px}.deleteBtn{height:40px;border:1px solid #e1b0b0;background:#fff4f4;color:#b12d34;border-radius:8px;padding:0 14px;font-weight:850}.hint{text-align:center;padding:45px 25px;margin-top:17px}.hint>div{width:50px;height:50px;margin:auto;border-radius:14px;background:#e9f7ee;color:#087e47;display:grid;place-items:center;font-size:23px}.hint h2{font-size:18px;margin:12px 0 5px}.hint p{max-width:600px;margin:auto;color:#7b8780;font-size:12px}.toast{position:fixed;right:25px;top:96px;z-index:20;background:#087d47;color:#fff;padding:11px 16px;border-radius:9px;box-shadow:0 10px 25px rgba(0,0,0,.15);font-size:12px;font-weight:800}.error{margin:12px 28px 0;border:1px solid #e7c2c2;background:#fff5f5;color:#a72f35;border-radius:9px;padding:10px 12px;display:flex;gap:9px;align-items:center;font-size:12px}.error b{flex:1}.error button{border:1px solid #ddb4b4;background:#fff;border-radius:7px;padding:6px 9px;color:#9b3035;font-weight:800}.modal{position:fixed;inset:0;background:rgba(15,28,21,.58);z-index:50;display:grid;place-items:center;padding:20px}.receipt{width:min(510px,100%);background:#fff;border-radius:15px;padding:22px;box-shadow:0 25px 70px rgba(0,0,0,.25)}.receiptHeader{display:flex;justify-content:space-between}.receiptHeader b{display:block;color:#087a47}.receiptHeader small{display:block;color:#78857d;margin-top:3px}.receiptHeader span{background:#e7f8ed;color:#087a47;border-radius:8px;padding:7px 11px;font-weight:900}.seal{width:70px;height:70px;border-radius:50%;background:#e9f8ef;border:4px solid #69bf8b;color:#087d47;display:grid;place-items:center;margin:20px auto 10px;font-size:25px;font-weight:900;text-align:center}.seal small{font-size:7px;line-height:1.1}.receipt h2{text-align:center;font-size:21px}.tx{background:#f4f8f5;border:1px dashed #bfd0c5;border-radius:8px;padding:11px;margin:14px 0}.tx small{display:block;color:#7b8780;font-size:9px}.tx b{display:block;color:#087a47;margin-top:4px;font-size:14px}.receiptRow{display:flex;justify-content:space-between;border-bottom:1px solid #e7ece9;padding:9px 0;font-size:12px}.receiptRow span{color:#748078}.receiptTotal{display:flex;justify-content:space-between;padding:15px 0;font-size:13px}.receiptTotal strong{font-size:22px;color:#087d47}.receiptFoot{display:block;text-align:center;color:#8a958f;font-size:9px}.receiptButtons{display:flex;gap:8px;margin-top:16px}.receiptButtons button{flex:1;height:42px;border:1px solid #c6d4cc;border-radius:8px;background:#fff;font-weight:800}.receiptButtons .primary{border:0;background:#087d47;color:#fff}@media(max-width:1100px){.side{width:205px}.topRight>span:not(:first-child){display:none}.stats{grid-template-columns:repeat(2,1fr)}.verify{grid-template-columns:1fr 1fr auto}.verify>div{grid-column:1/-1}.facts{grid-template-columns:repeat(3,1fr)}.facts div:nth-child(3){border-right:0}.form{grid-template-columns:1fr}.content{padding:18px}.error{margin-left:18px;margin-right:18px}}@media(max-width:760px){.employee{font-size:14px}.side{width:68px;padding:15px 8px}.brand{justify-content:center;padding:0 0 18px}.brand>div:last-child,.nav span,.support,.version{display:none}.nav{justify-content:center;padding:13px 8px;font-size:19px}.top{height:auto;min-height:72px;padding:10px 13px}.topTitle{gap:8px}.top h1{font-size:20px}.top p{font-size:10px}.topTitle small{font-size:8px}.person div,.topRight>button{display:none}.topRight{gap:7px}.content{padding:12px}.hero{padding:16px;display:block}.hero h2{font-size:21px}.hero p{font-size:12px}.heroActions{margin-top:13px}.stats{gap:8px}.stat{padding:11px;gap:8px}.stat i{width:37px;height:37px;font-size:18px}.stat b{font-size:21px}.stat strong{font-size:11px}.stat small{font-size:9px}.verify{grid-template-columns:1fr;padding:12px}.verify>div{grid-column:auto}.verify label input{width:100%}.filters{grid-template-columns:1fr 1fr}.filters input{grid-column:1/-1}.queueCard,.workspace .op,.deleteArea,.hint{border-radius:10px}.sectionHead h2{font-size:17px}.bookingHead{padding:14px}.bookingHead h2{font-size:19px}.facts{grid-template-columns:1fr 1fr}.facts div:nth-child(2n){border-right:0}.flow{padding:16px 8px;overflow-x:auto;min-width:0}.flowItem{min-width:110px}.flowCircle{width:32px;height:32px}.flowLine{top:15px}.flowItem strong{font-size:9px}.buttons{flex-direction:column}.buttons button{width:100%}.payLine{display:block}.pay{width:100%;margin-top:10px}.paidBanner{display:block}.paidBanner button{margin-top:8px}.deleteArea{display:block}.deleteBtn{margin-top:10px;width:100%}.receipt{padding:17px}.topRight>span:first-child{display:none}}
      @media print{.side,.top,.hero,.stats,.verify,.queueCard,.error,.toast,.receiptButtons{display:none!important}.main{width:100%}.content{padding:0}.modal{position:static;background:#fff}.receipt{box-shadow:none;width:100%}}
    `}</style>
  </main>;
}
