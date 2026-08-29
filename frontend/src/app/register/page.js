'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const mobile = String(form.get('mobile') || '').replace(/\D/g, '');
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    if (mobile.length !== 10) return setError('Please enter a valid 10-digit mobile number.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: String(form.get('fullName')).trim(), mobile, email: String(form.get('email') || '').trim() || null, password, state: String(form.get('state')).trim(), district: String(form.get('district')).trim() }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Registration failed. Please try again.');
      setSubmitted(true);
    } catch (err) { setError(err.message || 'Unable to connect to the server.'); } finally { setLoading(false); }
  };

  return (
    <main className="auth-page register-page">
      <section className="auth-panel auth-brand-panel">
        <Link href="/" className="auth-logo" aria-label="FarmerSetu home"><img src="/images/IMG_20260829_104252_707.jpg" alt="FarmerSetu logo" /></Link>
        <div className="auth-brand-copy"><span className="auth-brand-tag">FARMERSETU • SMART PROCUREMENT</span><h1>Sell your harvest <strong>smarter.</strong></h1><p>Register once, find your nearest procurement centre, book a slot and avoid long waiting lines with FarmerSetu.</p><div className="auth-points"><div><b>01</b><span>Easy farmer registration</span></div><div><b>02</b><span>Smart slot and token booking</span></div><div><b>03</b><span>Live queue and payment tracking</span></div></div></div>
        <div className="auth-brand-footer">Smart Bridge Between Farmers &amp; Markets.</div>
      </section>
      <section className="auth-panel auth-form-panel"><div className="auth-form-wrap register-form-wrap">
        <Link href="/" className="back-home">← Back to FarmerSetu</Link>
        <div className="auth-heading"><span className="auth-kicker">FARMER REGISTRATION</span><h2>Create your account</h2><p>Enter your details to start using FarmerSetu smart procurement services.</p></div>
        {submitted ? <div className="auth-success"><div className="success-icon">✓</div><h3>Registration successful</h3><p>Your FarmerSetu account has been created successfully. You can now sign in and continue.</p><Link href="/login" className="auth-primary success-link">Go to Login</Link></div> : <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="field-grid"><label><span>Full Name</span><input name="fullName" type="text" placeholder="e.g. Ramesh Kumar" autoComplete="name" required /></label><label><span>Mobile Number</span><input name="mobile" type="tel" inputMode="numeric" placeholder="10-digit mobile number" maxLength={10} autoComplete="tel" required /></label></div>
          <label><span>Email Address <em>Optional</em></span><input name="email" type="email" placeholder="you@example.com" autoComplete="email" /></label>
          <div className="field-grid"><label><span>State</span><select name="state" defaultValue="Bihar" required><option value="Bihar">Bihar</option><option value="Uttar Pradesh">Uttar Pradesh</option><option value="Jharkhand">Jharkhand</option><option value="West Bengal">West Bengal</option><option value="Other">Other</option></select></label><label><span>District</span><input name="district" type="text" placeholder="Enter your district" required /></label></div>
          <div className="field-grid"><label><span>Create Password</span><input name="password" type="password" placeholder="Minimum 8 characters" autoComplete="new-password" minLength={8} required /></label><label><span>Confirm Password</span><input name="confirmPassword" type="password" placeholder="Re-enter password" autoComplete="new-password" minLength={8} required /></label></div>
          <label className="check-row"><input type="checkbox" required /><span>I agree to the FarmerSetu terms and privacy policy.</span></label>
          <button className="auth-primary auth-submit" type="submit" disabled={loading}>{loading ? 'Creating Account...' : 'Create Farmer Account'} {!loading && <span>→</span>}</button>
          <p className="auth-switch">Already registered? <Link href="/login">Login to your account</Link></p>
        </form>}
      </div></section>
      <style jsx global>{`
        .register-page .auth-brand-panel{background-image:linear-gradient(110deg,rgba(3,52,29,.78),rgba(5,104,52,.45)),url('/images/mus-lihat-ZOKLwSOyeUQ-unsplash.jpg');background-size:cover;background-position:center;color:#fff;}
        .register-page .auth-logo{width:220px;height:125px;background:transparent;box-shadow:none;overflow:visible;display:block;position:relative;z-index:3;}
        .register-page .auth-logo img{width:100%;height:100%;object-fit:contain;object-position:left center;filter:none!important;mix-blend-mode:normal;display:block;}
        @media(max-width:900px){.register-page.auth-page{display:block;background:#f4f8f4}.register-page .auth-brand-panel{display:flex;min-height:430px;height:auto;padding:26px 28px 30px;background-position:center}.register-page .auth-logo{width:205px;height:112px}.register-page .auth-brand-copy{margin:18px 0 0}.register-page .auth-brand-copy h1{font-size:38px;margin:12px 0}.register-page .auth-points{display:grid}.register-page .auth-form-panel{min-height:auto;padding:35px 22px 45px}}
        @media(max-width:600px){.register-page .auth-brand-panel{min-height:360px;padding:20px;background-position:center}.register-page .auth-logo{width:175px;height:95px}.register-page .auth-brand-copy h1{font-size:30px;letter-spacing:-1px}.register-page .auth-brand-copy p{font-size:12px;line-height:1.6}.register-page .auth-points{gap:7px;margin-top:16px;font-size:11px}.register-page .auth-brand-footer{display:none}.register-page .field-grid{grid-template-columns:1fr;gap:17px}.register-page .auth-heading h2{font-size:29px}}
      `}</style>
    </main>
  );
}
