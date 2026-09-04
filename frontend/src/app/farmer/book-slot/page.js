'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const API = '/api/backend';
const states = ['Andhra Pradesh','Assam','Bihar','Chhattisgarh','Gujarat','Haryana','Jharkhand','Karnataka','Madhya Pradesh','Maharashtra','Odisha','Punjab','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','Uttarakhand','West Bengal'];
const stateCenters = {
  'Andhra Pradesh':[15.91,79.74],'Assam':[26.20,92.94],'Bihar':[25.59,85.14],'Chhattisgarh':[21.28,81.87],
  'Gujarat':[22.26,71.19],'Haryana':[29.06,76.08],'Jharkhand':[23.61,85.28],'Karnataka':[15.32,75.71],
  'Madhya Pradesh':[23.47,77.95],'Maharashtra':[19.75,75.71],'Odisha':[20.95,85.10],'Punjab':[31.15,75.34],
  'Rajasthan':[27.02,74.22],'Tamil Nadu':[11.13,78.66],'Telangana':[17.12,79.21],'Uttar Pradesh':[26.85,80.91],
  'Uttarakhand':[30.07,79.02],'West Bengal':[23.68,87.68]
};
const centreNames = ['Central Mandi','Main Market','Agri Yard','Kisan Mandi','Grain Market','Krishi Hub','Farmer Centre','APMC Yard'];
const grains = [['Rice',2000],['Wheat',2425],['Maize',1960],['Bajra',2310],['Jowar',3180],['Ragi',4290],['Barley',2050],['Gram',5850],['Arhar Dal',7150],['Moong',7920],['Urad',7480],['Mustard',6120],['Soybean',4680],['Groundnut',6350],['Sesame',7420]];
const today = () => new Date().toISOString().slice(0,10);
const makeToken = () => `TK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
const distance = (a,b,c,d) => Math.hypot(a-c,b-d);

export default function BookSlotPage(){
  const [user,setUser]=useState(null),[state,setState]=useState(''),[crop,setCrop]=useState('Rice'),[centre,setCentre]=useState(''),[date,setDate]=useState(today()),[slot,setSlot]=useState('08:00 AM - 10:00 AM'),[qty,setQty]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[locating,setLocating]=useState(false),[location,setLocation]=useState(null),[locationName,setLocationName]=useState('');

  useEffect(()=>{
    if(!localStorage.getItem('farmersetu_access_token')){window.location.replace('/login');return;}
    try{setUser(JSON.parse(localStorage.getItem('farmersetu_user')||'null'));}catch{}
    detectLocation(true);
  },[]);

  const centres=useMemo(()=>states.flatMap(s=>centreNames.map((n,i)=>({id:`${s}-${i}`,name:`${n} ${s}`,state:s,index:i}))),[]);
  const detectedState=useMemo(()=>{
    if(!location)return '';
    return Object.entries(stateCenters).sort((a,b)=>distance(location.lat,location.lng,...a[1])-distance(location.lat,location.lng,...b[1]))[0]?.[0]||'';
  },[location]);
  const visible=useMemo(()=>{
    const selectedState=state||detectedState;
    const base=selectedState?centres.filter(c=>c.state===selectedState):centres;
    if(!location)return base;
    return [...base].sort((a,b)=>distance(location.lat,location.lng,...stateCenters[a.state])-distance(location.lat,location.lng,...stateCenters[b.state]));
  },[state,detectedState,centres,location]);
  const selected=centres.find(c=>c.id===centre);
  const price=grains.find(g=>g[0]===crop)?.[1]||0;
  const total=price*(Number(qty)||0);

  function detectLocation(silent=false){
    if(!navigator.geolocation){if(!silent)setMessage('⚠ This browser does not support location detection.');return;}
    setLocating(true); if(!silent)setMessage('');
    navigator.geolocation.getCurrentPosition(async({coords})=>{
      const next={lat:coords.latitude,lng:coords.longitude};
      setLocation(next);
      let placeName='Your location';
      try{
        const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`);
        const p=await r.json();
        placeName=p.city||p.locality||p.principalSubdivision||'Your location';
        const matched=states.find(s=>s.toLowerCase()===String(p.principalSubdivision||'').toLowerCase())||null;
        if(matched)setState(matched);
      }catch{}
      setLocationName(placeName);
      setCentre('');
      setLocating(false);
      if(!silent)setMessage('✓ Location detected. Nearby procurement centres are ready.');
    },err=>{
      setLocating(false);
      if(!silent)setMessage(err.code===1?'⚠ Location permission was denied. Allow location access and try again.':'⚠ Could not detect your location. You can select a centre manually.');
    },{enableHighAccuracy:true,timeout:10000,maximumAge:300000});
  }

  const book=async e=>{
    e.preventDefault(); if(busy)return;
    if(!selected||!qty||Number(qty)<=0)return setMessage('Please select a procurement centre and enter quantity.');
    if(!user?.id)return setMessage('Please login again.');
    setBusy(true);setMessage('Saving booking securely…');
    const b={id:`FS-${Date.now().toString().slice(-7)}`,token:makeToken(),farmer:user.full_name||'Farmer',mobile:user.mobile||'',farmer_id:Number(user.id),centre:selected.name,state:selected.state,district:user.district||'',crop,price,quantity:Number(qty),estimatedTotal:total,date,slot,status:'Confirmed',qualityStatus:'Pending',paymentStatus:'Pending',createdAt:new Date().toISOString()};
    try{
      const r=await fetch(`${API}/employee/bookings`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${localStorage.getItem('farmersetu_access_token')}`},body:JSON.stringify({booking_id:b.id,token:b.token,farmer_id:b.farmer_id,farmer_name:b.farmer,farmer_mobile:b.mobile,centre:b.centre,state:b.state,district:b.district,crop:b.crop,quantity:b.quantity,price:b.price,estimated_amount:b.estimatedTotal,booking_date:b.date,slot:b.slot})});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.detail||`Server rejected booking (${r.status})`);
      const saved={...b,...d};let old=[];try{old=JSON.parse(localStorage.getItem('farmersetu_bookings')||'[]')}catch{}
      localStorage.setItem('farmersetu_bookings',JSON.stringify([saved,...old.filter(x=>x.id!==saved.id)]));localStorage.setItem('farmersetu_last_booking',JSON.stringify(saved));sessionStorage.setItem('farmersetu_last_booking',JSON.stringify(saved));window.location.href='/farmer/booking-confirmation';
    }catch(err){setMessage(`⚠ ${err.message}`);setBusy(false);}
  };

  return <main className="booking-page">
    <header className="booking-header"><Link href="/farmer/dashboard" className="back">← Dashboard</Link><div className="brand"><span>FARMERSETU</span><b>Procurement Slot Booking</b></div><Link href="/farmer/bookings" className="my-bookings">My Bookings →</Link></header>
    <section className="booking-wrap">
      <section className="farmer-banner"><div className="banner-image"/><div className="banner-overlay"/><div className="banner-content"><p>FARMERSETU • FARMER SERVICES</p><h1>Book your procurement slot</h1><span>Bring your crop at the right time, to the right procurement centre.</span><div className="banner-actions"><Link href="/farmer/dashboard" className="banner-light">Farmer Dashboard</Link><span className="banner-badge">✓ Secure Farmer Booking</span></div></div></section>
      {message&&<div className={`booking-message ${message.startsWith('⚠')?'error':''}`}>{message}</div>}
      <form onSubmit={book} className="booking-grid">
        <section className="booking-card"><div className="card-title"><span>01</span><div><h2>Booking details</h2><p>Tell us what you are bringing.</p></div></div>
          <label>State<select value={state} onChange={e=>{setState(e.target.value);setCentre('')}}><option value="">{detectedState?'Detected: '+detectedState:'All states'}</option>{states.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
          <div className="location-row"><label>Procurement Centre<select value={centre} onChange={e=>setCentre(e.target.value)} required><option value="">{location?'Nearby centres — select one':'Select centre'}</option>{visible.map(c=><option key={c.id} value={c.id}>{c.name}{location&&c.state===detectedState?' • Near you':''}</option>)}</select></label><button type="button" className="locate-btn" onClick={()=>detectLocation(false)} disabled={locating}>{locating?'…':'⌖'} <span>{locating?'Detecting':'Detect location'}</span></button></div>
          {location&&<div className="location-chip"><span className="pulse-dot">●</span><b>{locationName||'Location detected'}</b><span>• {detectedState||'Nearby centres'}</span></div>}
          <label>Grain / Crop<select value={crop} onChange={e=>setCrop(e.target.value)}>{grains.map(g=><option key={g[0]} value={g[0]}>{g[0]} — ₹{g[1].toLocaleString('en-IN')}/quintal</option>)}</select></label>
          <label>Quantity (quintal)<input type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)} placeholder="e.g. 80" required/></label>
          <div className="estimate"><div><span>Estimated value</span><small>₹{price.toLocaleString('en-IN')} × {Number(qty)||0} quintal</small></div><b>₹{total.toLocaleString('en-IN')}</b></div>
        </section>
        <section className="booking-card"><div className="card-title"><span>02</span><div><h2>Date & time</h2><p>Reserve a slot before visiting.</p></div></div>
          <label>Date<input type="date" min={today()} value={date} onChange={e=>setDate(e.target.value)}/></label>
          <div className="slot-heading">Available time slots</div><div className="slots">{['08:00 AM - 10:00 AM','10:00 AM - 12:00 PM','12:00 PM - 02:00 PM','02:00 PM - 04:00 PM','04:00 PM - 06:00 PM'].map(s=><button type="button" key={s} className={slot===s?'slot active':'slot'} onClick={()=>setSlot(s)}><span>{s}</span><small>Available</small></button>)}</div>
          <button className="confirm" disabled={busy}><span>{busy?'Saving securely…':'Confirm & Book Slot'}</span><b>→</b></button><div className="secure-note">✓ Confirmation will appear in My Bookings</div>
        </section>
      </form>
    </section>
    <style jsx global>{`*{box-sizing:border-box}.booking-page{min-height:100vh;background:linear-gradient(180deg,#f4f8f4,#edf4ee);color:#152019;font-family:Inter,Arial,sans-serif}.booking-header{min-height:78px;background:rgba(255,255,255,.96);border-bottom:1px solid #e2eae3;display:flex;align-items:center;gap:18px;padding:12px clamp(16px,5vw,70px);position:sticky;top:0;z-index:10;backdrop-filter:blur(10px)}.booking-header a{text-decoration:none}.back{padding:10px 14px;border:1px solid #dce6de;border-radius:10px;color:#176b3d;font-size:12px;font-weight:800;background:#fbfdfb}.brand{flex:1;display:flex;flex-direction:column}.brand span{font-size:9px;letter-spacing:2px;font-weight:900;color:#087a3e}.brand b{font-size:16px;margin-top:2px}.my-bookings{background:#087a3e;color:#fff;padding:11px 15px;border-radius:10px;font-size:11px;font-weight:800}.booking-wrap{max-width:1120px;margin:auto;padding:30px 18px 60px}.farmer-banner{height:285px;border-radius:22px;overflow:hidden;position:relative;box-shadow:0 18px 45px rgba(32,66,43,.14);margin-bottom:20px}.banner-image{position:absolute;inset:0;background-image:url('/images/rajesh-ram-HOOKgN_zIY8-unsplash.jpg');background-size:cover;background-position:center 48%;transform:scale(1.01)}.banner-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,48,27,.86),rgba(5,48,27,.58) 48%,rgba(5,48,27,.18))}.banner-content{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;justify-content:center;padding:30px 38px;color:#fff;max-width:720px}.banner-content p{font-size:9px;font-weight:900;letter-spacing:2px;margin:0 0 8px;color:#d7f2df}.banner-content h1{font-size:clamp(30px,5vw,46px);line-height:1.04;margin:0 0 9px;letter-spacing:-1.2px}.banner-content>span{font-size:12px;color:#edf8f0;max-width:520px}.banner-actions{display:flex;align-items:center;gap:12px;margin-top:22px;flex-wrap:wrap}.banner-light{color:#125c36;background:#fff;border-radius:10px;padding:11px 15px;text-decoration:none;font-size:11px;font-weight:900}.banner-badge{font-size:10px;font-weight:800;color:#e1f5e6;background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.25);border-radius:20px;padding:9px 12px}.booking-message{padding:12px 14px;border-radius:11px;background:#eaf7ee;border:1px solid #cce8d4;color:#176b3d;font-size:11px;font-weight:700;margin-bottom:14px}.booking-message.error{background:#fff1ef;border-color:#f1d4cf;color:#a12d25}.booking-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.booking-card{background:rgba(255,255,255,.97);border:1px solid #dfe8e1;border-radius:18px;padding:22px;box-shadow:0 12px 34px rgba(35,60,43,.06)}.card-title{display:flex;gap:12px;align-items:center;padding-bottom:16px;border-bottom:1px solid #edf1ed;margin-bottom:17px}.card-title>span{width:34px;height:34px;border-radius:10px;background:#eaf6ec;color:#087a3e;display:grid;place-items:center;font-size:11px;font-weight:900}.card-title h2{margin:0;font-size:17px}.card-title p{margin:3px 0 0;color:#7a847d;font-size:10px}.booking-card label{display:grid;gap:7px;font-size:10px;font-weight:900;color:#344139;margin:13px 0}.booking-card input,.booking-card select{width:100%;height:45px;border:1px solid #d8e3da;border-radius:10px;padding:0 12px;background:#fff;color:#172019;font-size:12px;outline:none}.booking-card input:focus,.booking-card select:focus{border-color:#36a361;box-shadow:0 0 0 3px #eaf7ee}.location-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.location-row label{margin-bottom:0}.locate-btn{height:45px;border:1px solid #cfe2d3;background:#f1faf3;color:#087a3e;border-radius:10px;padding:0 12px;font-size:11px;font-weight:900;white-space:nowrap;cursor:pointer}.locate-btn:disabled{opacity:.6}.location-chip{margin-top:9px;padding:9px 11px;border-radius:9px;background:#f0f8f1;color:#087a3e;font-size:10px;display:flex;align-items:center;gap:5px}.location-chip>b{color:#176b3d}.location-chip>span:last-child{color:#69766e}.pulse-dot{animation:pulse 1.5s infinite}.estimate{display:flex;justify-content:space-between;align-items:center;padding:15px;background:linear-gradient(135deg,#eff9f0,#e7f5e9);border:1px solid #d8ebda;border-radius:12px;margin-top:17px}.estimate div{display:grid;gap:4px}.estimate span{font-size:10px;font-weight:900;color:#31523c}.estimate small{font-size:10px;color:#6b786f}.estimate b{color:#087a3e;font-size:21px}.slot-heading{font-size:10px;font-weight:900;color:#344139;margin:16px 0 8px}.slots{display:grid;gap:8px}.slot{width:100%;border:1px solid #dce5de;background:#fff;border-radius:10px;padding:11px 12px;display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:800;color:#27332b;cursor:pointer;transition:.18s}.slot:hover{transform:translateY(-1px);border-color:#9bc9a8}.slot small{color:#198245;font-size:9px}.slot.active{border-color:#087a3e;background:#eff9f1;box-shadow:0 0 0 2px #d8efdc}.confirm{width:100%;height:50px;border:0;border-radius:11px;background:#087a3e;color:#fff;margin-top:18px;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:space-between;padding:0 17px;cursor:pointer;box-shadow:0 8px 20px rgba(8,122,62,.2);transition:.18s}.confirm:hover:not(:disabled){transform:translateY(-1px);background:#076b37}.confirm:disabled{opacity:.65;cursor:not-allowed}.confirm b{font-size:20px}.secure-note{text-align:center;color:#748078;font-size:9px;margin-top:10px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}@media(max-width:800px){.booking-grid{grid-template-columns:1fr}.farmer-banner{height:300px}.banner-content{padding:25px}.banner-overlay{background:linear-gradient(90deg,rgba(5,48,27,.9),rgba(5,48,27,.5))}}@media(max-width:560px){.booking-header{gap:8px;padding:10px 12px}.back{font-size:10px;padding:9px 10px}.brand b{font-size:13px}.my-bookings{padding:10px;font-size:10px}.booking-wrap{padding:18px 12px 40px}.farmer-banner{height:330px;border-radius:17px}.banner-content h1{font-size:32px}.banner-content>span{font-size:11px}.location-row{grid-template-columns:1fr}.locate-btn{width:100%}.booking-card{padding:17px}}`}</style>
  </main>;
}
