'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage('Login form is ready. Server authentication will be connected when the auth backend is enabled.');
  };

  return (
    <main className="auth-page login-page">
      <div className="auth-panel auth-brand-panel">
        <Link href="/" className="auth-logo"><img src="/images/IMG_20260829_104252_707.jpg" alt="कृषि सेतु logo" /></Link>
        <div className="auth-brand-copy">
          <span>कृषि सेतु • FarmerSetu</span>
          <h1>Welcome back, farmer.</h1>
          <p>Sign in to manage your bookings, see your live queue position and follow your procurement status.</p>
          <div className="auth-points"><div>✓ Your bookings in one place</div><div>✓ Live procurement updates</div><div>✓ Secure account access</div></div>
        </div>
      </div>

      <div className="auth-panel auth-form-panel">
        <div className="auth-form-wrap login-form-wrap">
          <Link href="/" className="back-home">← Back to Home</Link>
          <div className="auth-heading"><span className="auth-kicker">FARMER ACCOUNT</span><h2>Login to FarmerSetu</h2><p>Enter your registered mobile number or email.</p></div>
          {message && <div className="form-info" role="status">{message}</div>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label><span>Mobile Number or Email</span><input name="identifier" type="text" placeholder="Mobile number or email" autoComplete="username" required /></label>
            <label><span>Password</span><div className="password-wrap"><input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
            <div className="login-options"><label className="check-row"><input type="checkbox" name="remember" /><span>Remember me</span></label><button type="button" className="forgot-btn" onClick={() => setMessage('Password recovery will be enabled with the authentication backend.')}>Forgot password?</button></div>
            <button className="auth-primary auth-submit" type="submit">Login to Account <span>→</span></button>
            <p className="auth-switch">New to FarmerSetu? <Link href="/register">Create an account</Link></p>
          </form>
        </div>
      </div>
    </main>
  );
}
