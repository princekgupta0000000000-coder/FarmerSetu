'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    const mobile = String(form.get('mobile') || '').replace(/\D/g, '');

    if (mobile.length !== 10) return setError('Please enter a valid 10-digit mobile number.');
    if (String(password).length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setSubmitted(true);
  };

  return (
    <main className="auth-page register-page">
      <section className="auth-panel auth-brand-panel">
        <Link href="/" className="auth-logo" aria-label="FarmerSetu home">
          <img src="/images/IMG_20260829_104252_707.jpg" alt="कृषि सेतु" />
        </Link>
        <div className="auth-brand-copy">
          <span className="auth-brand-tag">कृषि सेतु • FARMERSETU</span>
          <h1>अपनी फसल की बिक्री को <strong>आसान</strong> बनाइए।</h1>
          <p>एक बार किसान पंजीकरण करें, नजदीकी खरीद केंद्र चुनें और बिना लंबी कतार में खड़े हुए अपना procurement slot बुक करें।</p>
          <div className="auth-points">
            <div><b>01</b><span>Easy farmer registration</span></div>
            <div><b>02</b><span>Smart slot &amp; token booking</span></div>
            <div><b>03</b><span>Live queue &amp; payment tracking</span></div>
          </div>
        </div>
        <div className="auth-brand-footer">Smart Bridge Between Farmers &amp; Markets.</div>
      </section>

      <section className="auth-panel auth-form-panel">
        <div className="auth-form-wrap register-form-wrap">
          <Link href="/" className="back-home">← Back to FarmerSetu</Link>
          <div className="auth-heading">
            <span className="auth-kicker">FARMER REGISTRATION</span>
            <h2>किसान खाता बनाएं</h2>
            <p>अपनी basic details भरें और FarmerSetu की smart procurement services शुरू करें।</p>
          </div>

          {submitted ? (
            <div className="auth-success">
              <div className="success-icon">✓</div>
              <h3>Registration successful</h3>
              <p>Your details have passed the initial checks. You can continue to login once server-side account creation is connected.</p>
              <Link href="/login" className="auth-primary success-link">Go to Login</Link>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="field-grid">
                <label><span>Full Name</span><input name="fullName" type="text" placeholder="e.g. Ramesh Kumar" autoComplete="name" required /></label>
                <label><span>Mobile Number</span><input name="mobile" type="tel" inputMode="numeric" placeholder="10-digit mobile number" maxLength={10} autoComplete="tel" required /></label>
              </div>
              <label><span>Email Address <em>Optional</em></span><input name="email" type="email" placeholder="you@example.com" autoComplete="email" /></label>
              <div className="field-grid">
                <label><span>State</span><select name="state" defaultValue="Bihar" required><option value="Bihar">Bihar</option><option value="Uttar Pradesh">Uttar Pradesh</option><option value="Jharkhand">Jharkhand</option><option value="West Bengal">West Bengal</option><option value="Other">Other</option></select></label>
                <label><span>District</span><input name="district" type="text" placeholder="Enter your district" required /></label>
              </div>
              <div className="field-grid">
                <label><span>Create Password</span><input name="password" type="password" placeholder="Minimum 6 characters" autoComplete="new-password" minLength={6} required /></label>
                <label><span>Confirm Password</span><input name="confirmPassword" type="password" placeholder="Re-enter password" autoComplete="new-password" minLength={6} required /></label>
              </div>
              <label className="check-row"><input type="checkbox" required /><span>I agree to the FarmerSetu terms and privacy policy.</span></label>
              <button className="auth-primary auth-submit" type="submit">Create Farmer Account <span>→</span></button>
              <p className="auth-switch">Already registered? <Link href="/login">Login to your account</Link></p>
            </form>
          )}
        </div>
      </section>

      <style jsx global>{`
        .register-page .auth-brand-panel{
          background-image:linear-gradient(105deg,rgba(2,48,25,.82) 0%,rgba(5,91,48,.66) 48%,rgba(8,122,62,.28) 100%),url('/images/mus-lihat-ZOKLwSOyeUQ-unsplash.jpg');
          background-size:cover;background-position:center;
        }
        .register-page .auth-brand-panel:before,.login-page .auth-brand-panel:before{
          content:'';position:absolute;inset:0;background:radial-gradient(circle at 15% 75%,rgba(255,255,255,.12),transparent 30%);pointer-events:none;
        }
        .register-page .auth-logo,.login-page .auth-logo{
          width:190px;height:115px;padding:0;border-radius:0;background:transparent;box-shadow:none;overflow:hidden;position:relative;z-index:2;
        }
        .register-page .auth-logo img,.login-page .auth-logo img{
          width:145%;height:145%;max-width:none;object-fit:contain;filter:none!important;mix-blend-mode:multiply;transform:translate(-15%,-15%) scale(1.02);
        }
        .register-page .auth-brand-copy{max-width:590px;margin:auto 0;}
        .register-page .auth-brand-copy h1{font-size:clamp(38px,4.2vw,64px);line-height:1.08;margin:17px 0 20px;letter-spacing:-2px;}
        .register-page .auth-brand-copy h1 strong{color:#b9e98d;}
        .auth-brand-tag{font-size:12px!important;letter-spacing:1.8px;font-weight:800!important;}
        .register-page .auth-brand-copy p{font-size:15px;line-height:1.85;max-width:540px;}
        .register-page .auth-points{display:grid;gap:13px;margin-top:30px;}
        .register-page .auth-points div{display:flex;align-items:center;gap:13px;font-size:13px;}
        .register-page .auth-points b{width:31px;height:31px;border:1px solid rgba(255,255,255,.35);border-radius:50%;display:grid;place-items:center;font-size:9px;letter-spacing:.5px;}
        .register-page .auth-brand-footer{font-size:11px;letter-spacing:1.2px;opacity:.72;position:relative;z-index:2;}
        .register-page .auth-form-panel{background:linear-gradient(135deg,#fff 0%,#fbfdfb 100%);}
        .register-page .auth-form-wrap{width:min(650px,100%);}
        .register-page .auth-heading{margin-bottom:25px;}
        .register-page .auth-heading h2{font-size:38px;margin:8px 0 8px;letter-spacing:-1.5px;}
        .register-page .auth-form{gap:14px;}
        .register-page .auth-primary{min-height:54px;font-size:14px;}
        .register-page .auth-submit{margin-top:5px;}
        .register-page .auth-switch{margin-top:4px;}
        .success-link{width:190px;margin:auto;text-align:center;}
        @media(max-width:900px){
          .register-page .auth-brand-panel{min-height:370px;background-position:center 42%;}
          .register-page .auth-brand-copy h1{font-size:40px;}
          .register-page .auth-brand-footer{display:none;}
        }
        @media(max-width:680px){
          .register-page .auth-brand-panel{min-height:315px;padding:18px 22px;}
          .register-page .auth-logo{width:145px;height:82px;}
          .register-page .auth-brand-copy h1{font-size:31px;margin:8px 0 10px;}
          .register-page .auth-brand-copy p{font-size:12.5px;line-height:1.65;}
          .register-page .auth-points{display:none;}
          .register-page .auth-heading h2{font-size:30px;}
        }
      `}</style>
    </main>
  );
}
