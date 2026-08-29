'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const menuItems = [
  ['⌂', 'Home', '/farmer/dashboard'],
  ['◉', 'Farmer Profile', '/farmer/profile'],
  ['▣', 'Procurement Centres', '#centres'],
  ['▦', 'Book Slot', '/farmer/book-slot'],
  ['▤', 'My Bookings', '/farmer/bookings'],
  ['♧', 'Live Queue Status', '/farmer/queue'],
  ['🛒', 'Procurement Status', '/farmer/procurement'],
  ['▣', 'Payments', '/farmer/payments'],
  ['♧', 'Notifications', '/farmer/notifications'],
  ['◉', 'Help & Support', '#support'],
];

export default function FarmerDashboardPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState('Your Location');
  const [temperature, setTemperature] = useState('—°C');

  useEffect(() => {
    const savedUser = localStorage.getItem('farmersetu_user');
    if (!localStorage.getItem('farmersetu_access_token')) {
      window.location.replace('/login');
      return;
    }
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        try {
          const [placeRes, weatherRes] = await Promise.all([
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`),
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m&timezone=auto`),
          ]);
          const place = await placeRes.json(); const weather = await weatherRes.json();
          const city = place.city || place.locality || place.principalSubdivision || 'Your Location';
          setLocation(city);
          setTemperature(`${Math.round(weather.current?.temperature_2m ?? 0)}°C`);
        } catch {}
      }, () => {});
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('farmersetu_access_token');
    localStorage.removeItem('farmersetu_user');
    window.location.replace('/login');
  };

  const firstName = user?.full_name?.split(' ')[0] || 'Farmer';

  return (
    <main className="site-shell farmer-dashboard-shell">
      <div className={`mobile-backdrop ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? 'mobile-open' : ''}`}>
        <div className="brand"><img src="/images/IMG_20260829_104252_707.jpg" alt="कृषि सेतु logo" /></div>
        <nav className="side-nav" aria-label="Farmer navigation">
          {menuItems.map(([icon, label, href], index) => (
            <Link className={`nav-item ${index === 0 ? 'active' : ''}`} href={href} key={label} onClick={() => setMenuOpen(false)}>
              <span className="nav-icon">{icon}</span><span>{label}</span>
            </Link>
          ))}
        </nav>
        <button className="sidebar-login farmer-logout" onClick={logout}><span>↪</span> Logout</button>
        <p className="copyright">© 2024 Krishi Setu. All rights reserved.</p>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <button className="menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>☰</button>
          <div className="location"><span className="location-pin">⌖</span><strong>{location}</strong><span>⌄</span></div>
          <div className="top-actions">
            <span className="weather"><span aria-hidden="true">☀</span> <strong>{temperature}</strong></span>
            <span className="language">◎ <strong>English</strong>⌄</span>
            <Link className="top-login farmer-profile-top" href="/farmer/profile">◉ &nbsp; {firstName}</Link>
          </div>
        </header>

        <div className="dashboard">
          <section className="hero farmer-hero">
            <div className="hero-image" />
            <div className="hero-overlay" />
            <div className="hero-content">
              <p className="eyebrow">FARMERSETU • FARMER DASHBOARD</p>
              <h1>Welcome back,<br /><span>{firstName}</span> Farmer.</h1>
              <div className="leaf-divider"><span /><em>🌿</em><span /></div>
              <p className="hero-copy">Your procurement journey is ready. Book a slot, check your live queue, track procurement and manage your farmer profile from one place.</p>
              <div className="hero-buttons">
                <Link href="/farmer/book-slot" className="primary-btn">▦ &nbsp; Book a Slot</Link>
                <Link href="/farmer/queue" className="secondary-btn">♧ &nbsp; View Live Queue</Link>
              </div>
            </div>
          </section>

          <section className="stats-grid farmer-stats">
            {[
              ['▦', 'My Bookings', '0', 'No active bookings'],
              ['♧', 'Queue Position', '—', 'Check live queue'],
              ['🛒', 'Procurement Status', '—', 'View status'],
              ['₹', 'Total Payments', '₹0', 'Payment history'],
              ['◉', 'Account Status', 'Active', 'Profile verified'],
            ].map(([icon, label, value, change]) => (
              <article className="stat-card" key={label}>
                <div className="stat-icon">{icon}</div>
                <div className="stat-body"><p>{label}</p><strong>{value}</strong><span>{change}</span></div>
              </article>
            ))}
          </section>

          <section className="queue-card farmer-welcome-card">
            <div className="queue-header"><h2>◉ &nbsp; Your Farmer Profile</h2><Link href="/farmer/profile" className="queue-button">View Profile</Link></div>
            <div className="farmer-profile-summary">
              <div className="profile-avatar">{firstName.charAt(0).toUpperCase()}</div>
              <div><h3>{user?.full_name || 'Farmer'}</h3><p>{user?.mobile || 'Registered mobile number'}</p><small>{user?.district || 'District'}, {user?.state || 'State'} &nbsp; • &nbsp; Farmer Account</small></div>
              <Link href="/farmer/profile" className="secondary-btn">Edit Profile</Link>
            </div>
          </section>
        </div>
      </section>
      <style jsx global>{`
        .farmer-dashboard-shell .farmer-hero .hero-image{background-image:url('/images/rajesh-ram-HOOKgN_zIY8-unsplash.jpg')}
        .farmer-dashboard-shell .farmer-hero .hero-content{padding-top:62px}
        .farmer-dashboard-shell .farmer-hero h1 span{color:var(--blue)}
        .farmer-dashboard-shell .farmer-profile-top{display:flex;align-items:center;gap:4px}
        .farmer-dashboard-shell .farmer-logout{border:1px solid #f0d8d5;background:#fff7f6;color:#9b2c22;cursor:pointer;width:calc(100% - 4px)}
        .farmer-dashboard-shell .farmer-logout:hover{background:#fff0ee;color:#7f1d1d}
        .farmer-profile-summary{min-height:145px;display:flex;align-items:center;gap:18px;padding:24px 25px}
        .profile-avatar{width:68px;height:68px;flex:none;border-radius:50%;display:grid;place-items:center;background:#e7f3e6;color:var(--green);font-size:26px;font-weight:800;border:1px solid #d2e6d1}
        .farmer-profile-summary h3{margin:0 0 6px;font-size:18px}.farmer-profile-summary p{margin:0 0 6px;color:#657068;font-size:13px}.farmer-profile-summary small{color:#7a847d;font-size:11px}.farmer-profile-summary .secondary-btn{margin-left:auto;min-height:42px;padding:0 17px}
        @media(max-width:900px){.farmer-dashboard-shell .farmer-hero{height:510px}.farmer-dashboard-shell .farmer-hero .hero-content{padding-top:50px}.farmer-profile-summary{flex-wrap:wrap}.farmer-profile-summary .secondary-btn{margin-left:0}}
      `}</style>
    </main>
  );
}
