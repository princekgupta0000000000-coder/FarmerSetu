'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const stats = [
  { label: 'Total Farmers Registered', value: '12,543', change: '+256 today', icon: '♧' },
  { label: 'Active Procurement Centres', value: '78', change: '+3 this week', icon: '⌂' },
  { label: "Today's Bookings", value: '1,245', change: '+98 today', icon: '▦' },
  { label: 'Farmers in Queue', value: '432', change: '● Live now', icon: '♧' },
  { label: 'Total Procurement (This Month)', value: '2,845', suffix: ' Tonnes', change: '+12% from last month', icon: '🛒' },
];

const menuItems = [
  ['⌂', 'Home', '/'], ['♙', 'Registration', '/register'], ['▣', 'Procurement Centres', '#centres'],
  ['▦', 'Book Slot', '/farmer/book-slot'], ['▤', 'My Bookings', '/farmer/bookings'], ['♧', 'Live Queue Status', '/farmer/queue'],
  ['🛒', 'Procurement Status', '/farmer/procurement'], ['▣', 'Payments', '/farmer/payments'], ['♧', 'Notifications', '/farmer/notifications'], ['◉', 'Help & Support', '#support'],
];

function weatherLabel(code) {
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Storm';
  return 'Weather';
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location, setLocation] = useState('Detecting location…');
  const [temperature, setTemperature] = useState('—°C');
  const [weatherText, setWeatherText] = useState('');
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadWeather = async (latitude, longitude) => {
      try {
        const [placeRes, weatherRes] = await Promise.all([
          fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`),
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`),
        ]);
        const place = await placeRes.json();
        const weather = await weatherRes.json();
        if (cancelled) return;

        const city = place.city || place.locality || place.principalSubdivision || 'Your Location';
        const state = place.principalSubdivision && city !== place.principalSubdivision ? place.principalSubdivision : '';
        setLocation(state ? `${city}, ${state}` : city);
        setTemperature(`${Math.round(weather.current?.temperature_2m ?? 0)}°C`);
        setWeatherText(weatherLabel(weather.current?.weather_code));
      } catch {
        if (!cancelled) {
          setLocation('Location unavailable');
          setTemperature('—°C');
          setWeatherText('Weather unavailable');
        }
      }
    };

    if (!navigator.geolocation) {
      setLocationError(true);
      setLocation('Location not supported');
      return () => { cancelled = true; };
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => loadWeather(coords.latitude, coords.longitude),
      () => {
        if (!cancelled) {
          setLocationError(true);
          setLocation('Allow location access');
          setTemperature('—°C');
          setWeatherText('Enable location');
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );

    return () => { cancelled = true; };
  }, []);

  return (
    <main className="site-shell">
      <div className={`mobile-backdrop ${menuOpen ? 'show' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? 'mobile-open' : ''}`}>
        <div className="brand"><img src="/images/IMG_20260829_104252_707.jpg" alt="कृषि सेतु logo" /></div>
        <nav className="side-nav" aria-label="Main navigation">
          {menuItems.map(([icon, label, href], index) => (
            <Link className={`nav-item ${index === 0 ? 'active' : ''}`} href={href} key={label} onClick={() => setMenuOpen(false)}>
              <span className="nav-icon">{icon}</span><span>{label}</span>
            </Link>
          ))}
        </nav>
        <Link className="sidebar-login" href="/login" onClick={() => setMenuOpen(false)}><span>→</span> Login</Link>
        <p className="copyright">© 2024 Krishi Setu. All rights reserved.</p>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <button className="menu-button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>☰</button>
          <div className="location" title={location}><span className="location-pin">⌖</span><strong>{location}</strong><span>⌄</span></div>
          <div className="top-actions">
            <span className="weather" title={weatherText}><span aria-hidden="true">☀</span> <strong>{temperature}</strong></span>
            <span className="language">◎ <strong>English</strong>⌄</span>
            <Link className="top-login" href="/login">♙ &nbsp; Login</Link>
          </div>
        </header>

        <div className="dashboard">
          <section className="hero">
            <div className="hero-image" />
            <div className="hero-overlay" />
            <div className="hero-content">
              <p className="eyebrow">SMART PROCUREMENT PLATFORM</p>
              <h1>Smart Bridge<br />Between <span>Farmers</span><br />&amp; <b>Markets.</b></h1>
              <div className="leaf-divider"><span /><em>🌿</em><span /></div>
              <p className="hero-copy">FarmerSetu is a digital platform that connects farmers with procurement centres, ensures transparency and fairness, and empowers farmers with smart technology.</p>
              <div className="hero-buttons">
                <Link href="/register" className="primary-btn">♙ &nbsp; Register Now</Link>
                <a href="#centres" className="secondary-btn">▣ &nbsp; Explore Centres</a>
              </div>
            </div>
          </section>

          <section className="stats-grid">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <div className="stat-icon">{stat.icon}</div>
                <div className="stat-body"><p>{stat.label}</p><strong>{stat.value}<small>{stat.suffix}</small></strong><span>{stat.change}</span></div>
                <div className="trend" aria-hidden="true">⌁</div>
              </article>
            ))}
          </section>

          <section className="queue-card" id="queue">
            <div className="queue-header"><h2>♧ &nbsp; Live Queue Status</h2><Link href="/farmer/queue" className="queue-button">▥ &nbsp; View Queue</Link></div>
            <div className="queue-content">
              <div className="centre-info">
                <div className="centre-photo"><img src="/images/rajesh-ram-HOOKgN_zIY8-unsplash.jpg" alt="Agricultural procurement area" /></div>
                <div><h3>{locationError ? 'Procurement Centre' : `${location.split(',')[0]} Procurement Centre`}</h3><p>◷ &nbsp; Estimated Waiting Time</p><strong className="wait-time">42 mins</strong><div className="progress"><span /></div><small>⟳ &nbsp; Updated just now</small></div>
              </div>
              <div className="queue-stat"><span>Farmers in Queue</span><strong>18</strong></div>
              <div className="queue-stat"><span>Currently Processing</span><strong>5</strong></div>
              <div className="queue-token"><span>Current Token</span><strong>FS-1025</strong><small>Ramesh Kumar</small></div>
              <div className="qr-placeholder" aria-label="QR code preview"><div className="fake-qr" /><small>QR</small></div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
