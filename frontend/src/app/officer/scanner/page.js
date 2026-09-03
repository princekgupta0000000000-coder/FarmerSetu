'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const API = '/api/backend';

function bookingKeyFromScan(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const parts = url.pathname.split('/').filter(Boolean);
    return decodeURIComponent(url.searchParams.get('token') || url.searchParams.get('booking') || url.searchParams.get('id') || parts[parts.length - 1] || raw);
  } catch {
    return raw;
  }
}

export default function OfficerScannerPage() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [supported, setSupported] = useState(true);
  const [token, setToken] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let allowed = true;
    try {
      if (!('BarcodeDetector' in window)) setSupported(false);
    } catch {
      setSupported(false);
    }
    const user = (() => { try { return JSON.parse(localStorage.getItem('farmersetu_user') || 'null'); } catch { return null; } })();
    if (!localStorage.getItem('farmersetu_access_token') || !['employee', 'procurement_employee', 'officer', 'admin'].includes(user?.role)) {
      window.location.href = '/login';
    }
    return () => {
      allowed = false;
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setRunning(false);
  };

  const lookup = async (value) => {
    const key = bookingKeyFromScan(value);
    if (!key) return;
    setLoading(true);
    setError('');
    try {
      const auth = localStorage.getItem('farmersetu_access_token');
      const response = await fetch(`${API}/employee/bookings/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Booking/token not found.');
      setResult(data);
      setToken('');
      stopCamera();
    } catch (e) {
      setResult(null);
      setError(e.message || 'Unable to verify QR.');
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setError('');
    setResult(null);
    if (!('BarcodeDetector' in window)) {
      setSupported(false);
      setError('QR camera scanning is not supported in this browser. Use Chrome or enter the token manually below.');
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setRunning(true);
      timerRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.length && codes[0]?.rawValue) await lookup(codes[0].rawValue);
        } catch {}
      }, 500);
    } catch (e) {
      setError(e?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access and try again.' : (e.message || 'Unable to open camera.'));
      stopCamera();
    }
  };

  return <main className="scanner-page">
    <header>
      <Link href="/officer/dashboard">← Dashboard</Link>
      <div><span>FARMERSETU</span><h1>Employee QR Scanner</h1></div>
      <Link href="/officer/queue">Live Queue →</Link>
    </header>
    <section className="scanner-wrap">
      <div className="hero">
        <div><small>PROCUREMENT CENTRE</small><h2>Scan Farmer Booking QR</h2><p>Scan the QR printed on the farmer receipt. The booking will open automatically for check-in, quality and payment.</p></div>
        {!running ? <button onClick={startCamera}>📷 Start Camera</button> : <button className="stop" onClick={stopCamera}>Stop Camera</button>}
      </div>
      <div className="grid">
        <section className="camera-card">
          <div className="camera-box">
            <video ref={videoRef} muted playsInline />
            {!running && <div className="camera-empty"><div>▣</div><b>Camera ready</b><span>Tap “Start Camera” to scan a receipt QR.</span></div>}
            {running && <div className="scan-frame" />}
          </div>
          {!supported && <div className="hint">Your browser does not expose QR camera scanning. Manual token entry below still works.</div>}
        </section>
        <section className="manual-card">
          <h3>Enter Token / Booking ID</h3>
          <p>If the receipt QR cannot be scanned, enter the token printed on the receipt.</p>
          <div className="manual"><input value={token} onChange={e => setToken(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookup(token)} placeholder="Example: FS-2026-000123"/><button onClick={() => lookup(token)} disabled={loading || !token.trim()}>{loading ? 'Checking…' : 'Verify'}</button></div>
          {error && <div className="error">{error}</div>}
          {result && <div className="result"><div className="ok">✓ Booking verified</div><h3>{result.farmer}</h3><p><b>{result.token}</b> • {result.centre}</p><div className="facts"><span>Crop<strong>{result.crop}</strong></span><span>Booked<strong>{result.quantity} qtl</strong></span><span>Status<strong>{result.status}</strong></span><span>Payment<strong>{result.paymentStatus}</strong></span></div><Link href={`/officer/queue?booking=${encodeURIComponent(result.id)}`}>Open in Queue →</Link></div>}
        </section>
      </div>
    </section>
    <style jsx global>{`body{margin:0;background:#f4f8f4;color:#17201b;font-family:Arial,Helvetica,sans-serif}.scanner-page{min-height:100vh}.scanner-page header{min-height:76px;background:#fff;border-bottom:1px solid #e1e9e2;display:flex;align-items:center;gap:16px;padding:10px 5vw}.scanner-page header div{flex:1}.scanner-page header span{font-size:9px;color:#087a3e;font-weight:900;letter-spacing:1.5px}.scanner-page header h1{font-size:18px;margin:4px 0}.scanner-page header a{border:1px solid #d6e1d8;border-radius:8px;padding:9px 12px;color:#087a3e;text-decoration:none;font-size:11px;font-weight:800}.scanner-wrap{max-width:1100px;margin:auto;padding:24px 18px}.hero{background:#fff;border:1px solid #e1e9e2;border-radius:16px;padding:24px;display:flex;align-items:center;justify-content:space-between;gap:18px}.hero small{font-size:9px;color:#087a3e;font-weight:900;letter-spacing:1.4px}.hero h2{font-size:26px;margin:8px 0}.hero p{font-size:11px;color:#6b766e;line-height:1.6;max-width:650px;margin:0}.hero button,.manual button{border:0;background:#087a3e;color:#fff;border-radius:9px;padding:12px 17px;font-size:11px;font-weight:900;white-space:nowrap}.hero button.stop{background:#a12d25}.grid{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;margin-top:14px}.camera-card,.manual-card{background:#fff;border:1px solid #e1e9e2;border-radius:14px;padding:15px}.camera-box{height:440px;background:#101613;border-radius:11px;position:relative;overflow:hidden;display:grid;place-items:center}.camera-box video{width:100%;height:100%;object-fit:cover}.camera-empty{color:#dce9df;text-align:center;display:grid;gap:7px;position:absolute;inset:0;place-content:center}.camera-empty div{font-size:42px}.camera-empty b{font-size:14px}.camera-empty span{font-size:10px;color:#9eaca2}.scan-frame{position:absolute;width:62%;aspect-ratio:1;border:3px solid #fff;border-radius:16px;box-shadow:0 0 0 9999px rgba(0,0,0,.18);pointer-events:none}.hint{font-size:9px;color:#69756d;margin-top:10px;background:#f4f8f4;padding:9px;border-radius:8px}.manual-card h3{font-size:15px;margin:5px 0}.manual-card>p{font-size:10px;color:#717b74;line-height:1.5}.manual{display:flex;gap:7px;margin-top:16px}.manual input{min-width:0;flex:1;height:42px;border:1px solid #d7e2d9;border-radius:8px;padding:0 10px;font-size:11px}.manual button{height:42px}.manual button:disabled{opacity:.45}.error{margin-top:12px;padding:10px;border-radius:8px;background:#fff0ef;color:#a12d25;font-size:10px}.result{margin-top:16px;border:1px solid #dce9de;background:#eef8f0;border-radius:11px;padding:14px}.ok{font-size:9px;color:#087a3e;font-weight:900}.result h3{font-size:20px;margin:7px 0}.result p{font-size:10px;color:#667269}.result p b{color:#087a3e}.facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.facts span{background:#fff;border-radius:7px;padding:8px;font-size:8px;color:#7a837d}.facts strong{display:block;font-size:10px;color:#17201b;margin-top:4px}.result a{display:block;color:#087a3e;text-decoration:none;font-size:10px;font-weight:900;margin-top:10px}@media(max-width:800px){.hero{display:block}.hero button{margin-top:13px}.grid{grid-template-columns:1fr}.camera-box{height:380px}}@media(max-width:600px){.scanner-page header{padding:10px 12px}.scanner-page header h1{font-size:14px}.scanner-page header a:last-child{display:none}.scanner-wrap{padding:13px}.hero{padding:18px}.hero h2{font-size:22px}.camera-box{height:330px}.manual{display:block}.manual button{width:100%;margin-top:7px}}`}</style>
  </main>;
}
