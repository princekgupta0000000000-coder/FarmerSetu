'use client';

import { useState } from 'react';
import Link from 'next/link';

// Production API. Keep this explicit so the deployed app never falls back to localhost.
const API_BASE = 'https://farmer-setu-backend-qkm8cq802-nexus-7738.vercel.app';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault(); setMessage(''); setError('');
    const form = new FormData(event.currentTarget); setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: String(form.get('identifier')).trim(), password: String(form.get('password')) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || `Invalid login details (${response.status}).`);
      localStorage.setItem('farmersetu_access_token', data.access_token); localStorage.setItem('farmersetu_user', JSON.stringify(data.user)); window.location.href = '/farmer/dashboard';
    } catch (err) { setError(err instanceof TypeError ? 'Unable to reach FarmerSetu server. Please try again.' : (err.message || 'Unable to connect to the server.')); } finally { setLoading(false); }
  };

  return (
    <main className="auth-page login-page">
      <section className="auth-panel auth-brand-panel">
        <Link href="/" className="auth-logo" aria-label="FarmerSetu home"><img src="/images/IMG_20260829_104252_707.jpg" alt="FarmerSetu logo" /></Link>
        <div className="auth-brand-copy"><span className="auth-brand-tag">FARMERSETU • SMART PROCUREMENT</span><h1>Welcome back, <strong>Farmer.</strong></h1><p>Manage your procurement slots, token number, live queue and payment status from one simple dashboard.</p><div className="auth-points"><div><b>✓</b><span>View all your bookings in one place</span></div><div><b>✓</b><span>Get live procurement updates</span></div><div><b>✓</b><span>Track your token and queue status</span></div></div></div>
        <div className="auth-brand-footer">Smart Bridge Between Farmers &amp; Markets.</div>
      </section>
      <section className="auth-panel auth-form-panel"><div className="auth-form-wrap login-form-wrap">
        <Link href="/" className="back-home">← Back to FarmerSetu</Link>
        <div className="auth-heading"><span className="auth-kicker">FARMER LOGIN</span><h2>Sign in to your account</h2><p>Enter your registered mobile number or email address and password.</p></div>
        {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="form-info" role="status">{message}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label><span>Mobile Number or Email</span><input name="identifier" type="text" placeholder="Enter mobile number or email" autoComplete="username" required /></label>
          <label><span>Password</span><div className="password-wrap"><input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
          <div className="login-options"><label className="check-row"><input type="checkbox" name="remember" /><span>Remember me</span></label><button type="button" className="forgot-btn" onClick={() => setMessage('Password recovery will be enabled in a future update.')}>Forgot password?</button></div>
          <button className="auth-primary auth-submit" type="submit" disabled={loading}>{loading ? 'Signing In...' : 'Sign In to FarmerSetu'} {!loading && <span>→</span>}</button>
          <p className="auth-switch">New to FarmerSetu? <Link href="/register">Register as a Farmer</Link></p>
        </form>
      </div></section>
      <style jsx global>{`
        .login-page .auth-brand-panel{background-image:linear-gradient(110deg,rgba(3,42,24,.80),rgba(6,91,48,.50)),url('/images/mus-lihat-ZOKLwSOyeUQ-unsplash.jpg');background-size:cover;background-position:center;color:#fff;}
        .login-page .auth-logo{width:220px;height:125px;background:transparent;box-shadow:none;overflow:visible;display:block;position:relative;z-index:3;}
        .login-page .auth-logo img{width:100%;height:100%;object-fit:contain;object-position:left center;filter:none!important;mix-blend-mode:normal;display:block;}
        @media(max-width:900px){.login-page.auth-page{display:block;background:#f4f8f4}.login-page .auth-brand-panel{display:flex;min-height:430px;height:auto;padding:26px 28px 30px;background-position:center}.login-page .auth-logo{width:205px;height:112px}.login-page .auth-brand-copy{margin:18px 0 0}.login-page .auth-brand-copy h1{font-size:38px;margin:12px 0}.login-page .auth-points{display:grid}.login-page .auth-form-panel{min-height:auto;padding:35px 22px 45px}}
        @media(max-width:600px){.login-page .auth-brand-panel{min-height:360px;padding:20px;background-position:center}.login-page .auth-logo{width:175px;height:95px}.login-page .auth-brand-copy h1{font-size:30px;letter-spacing:-1px}.login-page .auth-brand-copy p{font-size:12px;line-height:1.6}.login-page .auth-points{gap:7px;margin-top:16px;font-size:11px}.login-page .auth-brand-footer{display:none}.login-page .auth-heading h2{font-size:29px}}
      `}</style>
    </main>
  );
}
