'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage('Login details received. Secure server authentication will be connected with the backend.');
  };

  return (
    <main className="auth-page login-page">
      <section className="auth-panel auth-brand-panel">
        <Link href="/" className="auth-logo" aria-label="FarmerSetu home">
          <img src="/images/IMG_20260829_104252_707.jpg" alt="कृषि सेतु" />
        </Link>
        <div className="auth-brand-copy">
          <span className="auth-brand-tag">कृषि सेतु • FARMERSETU</span>
          <h1>फिर से स्वागत है, <strong>किसान।</strong></h1>
          <p>अपने procurement slots, token number, live queue और payment status को एक ही जगह से आसानी से manage करें।</p>
          <div className="auth-points">
            <div><b>✓</b><span>अपनी bookings एक जगह देखें</span></div>
            <div><b>✓</b><span>Live procurement updates पाएं</span></div>
            <div><b>✓</b><span>Token और queue status track करें</span></div>
          </div>
        </div>
        <div className="auth-brand-footer">Smart Bridge Between Farmers &amp; Markets.</div>
      </section>

      <section className="auth-panel auth-form-panel">
        <div className="auth-form-wrap login-form-wrap">
          <Link href="/" className="back-home">← Back to FarmerSetu</Link>
          <div className="auth-heading">
            <span className="auth-kicker">FARMER LOGIN</span>
            <h2>अपने खाते में Login करें</h2>
            <p>Registered mobile number या email और password दर्ज करें।</p>
          </div>
          {message && <div className="form-info" role="status">{message}</div>}
          <form className="auth-form" onSubmit={handleSubmit}>
            <label><span>Mobile Number or Email</span><input name="identifier" type="text" placeholder="Enter mobile number or email" autoComplete="username" required /></label>
            <label><span>Password</span><div className="password-wrap"><input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
            <div className="login-options"><label className="check-row"><input type="checkbox" name="remember" /><span>Remember me</span></label><button type="button" className="forgot-btn" onClick={() => setMessage('Password recovery will be enabled with the authentication backend.')}>Forgot password?</button></div>
            <button className="auth-primary auth-submit" type="submit">Login to FarmerSetu <span>→</span></button>
            <p className="auth-switch">नया account बनाना है? <Link href="/register">Register as a Farmer</Link></p>
          </form>
        </div>
      </section>

      <style jsx global>{`
        .login-page .auth-brand-panel{
          background-image:linear-gradient(105deg,rgba(3,42,24,.78) 0%,rgba(6,91,48,.57) 50%,rgba(8,122,62,.25) 100%),url('/images/guru-moorthy-gokul--tdqorDOxgc-unsplash.jpg');
          background-size:cover;background-position:center;
        }
        .login-page .auth-brand-copy{max-width:590px;margin:auto 0;}
        .login-page .auth-brand-copy h1{font-size:clamp(40px,4.4vw,66px);line-height:1.08;margin:17px 0 20px;letter-spacing:-2px;}
        .login-page .auth-brand-copy h1 strong{color:#b9e98d;}
        .login-page .auth-brand-copy p{font-size:15px;line-height:1.85;max-width:540px;}
        .login-page .auth-points{display:grid;gap:13px;margin-top:30px;}
        .login-page .auth-points div{display:flex;align-items:center;gap:13px;font-size:13px;}
        .login-page .auth-points b{width:31px;height:31px;border-radius:50%;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);display:grid;place-items:center;}
        .login-page .auth-brand-footer{font-size:11px;letter-spacing:1.2px;opacity:.72;position:relative;z-index:2;}
        .login-page .auth-form-panel{background:linear-gradient(135deg,#fff 0%,#fbfdfb 100%);}
        .login-page .auth-form-wrap{width:min(520px,100%);}
        .login-page .auth-heading{margin-bottom:30px;}
        .login-page .auth-heading h2{font-size:38px;margin:8px 0 8px;letter-spacing:-1.5px;}
        .login-page .auth-form{gap:17px;}
        .login-page .auth-primary{min-height:54px;font-size:14px;}
        .login-page .auth-submit{margin-top:6px;}
        @media(max-width:900px){
          .login-page .auth-brand-panel{min-height:370px;background-position:center 38%;}
          .login-page .auth-brand-copy h1{font-size:40px;}
          .login-page .auth-brand-footer{display:none;}
        }
        @media(max-width:680px){
          .login-page .auth-brand-panel{min-height:315px;padding:18px 22px;}
          .login-page .auth-logo{width:145px;height:82px;}
          .login-page .auth-brand-copy h1{font-size:31px;margin:8px 0 10px;}
          .login-page .auth-brand-copy p{font-size:12.5px;line-height:1.65;}
          .login-page .auth-points{display:none;}
          .login-page .auth-heading h2{font-size:30px;}
        }
      `}</style>
    </main>
  );
}
