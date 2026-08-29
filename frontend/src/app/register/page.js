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

    if (mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (String(password).length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitted(true);
  };

  return (
    <main className="auth-page">
      <div className="auth-panel auth-brand-panel">
        <Link href="/" className="auth-logo"><img src="/images/IMG_20260829_104252_707.jpg" alt="कृषि सेतु logo" /></Link>
        <div className="auth-brand-copy">
          <span>कृषि सेतु • FarmerSetu</span>
          <h1>Join the smart farming network.</h1>
          <p>Register once and use FarmerSetu to find procurement centres, book slots and track your procurement journey.</p>
          <div className="auth-points"><div>✓ Easy farmer registration</div><div>✓ Transparent procurement</div><div>✓ Live slot &amp; queue updates</div></div>
        </div>
      </div>

      <div className="auth-panel auth-form-panel">
        <div className="auth-form-wrap">
          <Link href="/" className="back-home">← Back to Home</Link>
          <div className="auth-heading"><span className="auth-kicker">FARMER ACCOUNT</span><h2>Create your account</h2><p>Fill in your details to get started with FarmerSetu.</p></div>

          {submitted ? (
            <div className="auth-success"><div className="success-icon">✓</div><h3>Registration details submitted</h3><p>Your form passed the checks. Server-side account creation will be connected when the authentication backend is enabled.</p><Link href="/login" className="auth-primary">Go to Login</Link></div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="field-grid">
                <label><span>Full Name</span><input name="fullName" type="text" placeholder="Enter your full name" autoComplete="name" required /></label>
                <label><span>Mobile Number</span><input name="mobile" type="tel" inputMode="numeric" placeholder="10-digit mobile number" maxLength={10} autoComplete="tel" required /></label>
              </div>
              <label><span>Email Address <em>(optional)</em></span><input name="email" type="email" placeholder="you@example.com" autoComplete="email" /></label>
              <div className="field-grid">
                <label><span>State</span><select name="state" defaultValue="Bihar" required><option value="Bihar">Bihar</option><option value="Uttar Pradesh">Uttar Pradesh</option><option value="Jharkhand">Jharkhand</option><option value="West Bengal">West Bengal</option><option value="Other">Other</option></select></label>
                <label><span>District</span><input name="district" type="text" placeholder="Enter district" required /></label>
              </div>
              <div className="field-grid">
                <label><span>Password</span><input name="password" type="password" placeholder="Minimum 6 characters" autoComplete="new-password" minLength={6} required /></label>
                <label><span>Confirm Password</span><input name="confirmPassword" type="password" placeholder="Re-enter password" autoComplete="new-password" minLength={6} required /></label>
              </div>
              <label className="check-row"><input type="checkbox" required /><span>I agree to the FarmerSetu terms and privacy policy.</span></label>
              <button className="auth-primary auth-submit" type="submit">Create Farmer Account <span>→</span></button>
              <p className="auth-switch">Already have an account? <Link href="/login">Login here</Link></p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
