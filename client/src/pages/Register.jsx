import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Field } from '../components/ui.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', gender: 'unspecified', dateOfBirth: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth" style={{ background: 'var(--paper)' }}>
      <aside className="auth-aside" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Ambient background glows */}
        <div style={{ position: 'absolute', top: '20%', left: '-10%', width: '400px', height: '400px', background: 'var(--teal)', filter: 'blur(120px)', opacity: 0.4, borderRadius: '50%' }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: '60px' }}>
            <span className="brand-mark" />
            <span style={{ color: '#fff', fontSize: '1.2rem', fontFamily: 'var(--display)', fontWeight: 700 }}>HealthCare Portal</span>
          </Link>

          <h1 style={{ fontSize: '3rem', lineHeight: 1.1, marginBottom: '24px' }}>
            Register once. <br/><span style={{ color: 'var(--teal)' }}>Book in a minute.</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#b9cbc7', maxWidth: '40ch', marginBottom: '40px', lineHeight: 1.6 }}>
            Join thousands of patients managing their health effectively and effortlessly.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', fontSize: '1rem', color: '#eaf2f0' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px', fontSize: '1.2rem' }}>🔍</div>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Find the right doctor</strong>
                <div style={{ color: '#8fa6a2', fontSize: '0.85rem', lineHeight: 1.4 }}>Search by specialisation and pick a real, open slot that works for you.</div>
              </div>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', fontSize: '1rem', color: '#eaf2f0' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px', fontSize: '1.2rem' }}>⚡</div>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Skip the waiting room</strong>
                <div style={{ color: '#8fa6a2', fontSize: '0.85rem', lineHeight: 1.4 }}>Your symptom form reaches the doctor before you even walk through the door.</div>
              </div>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', fontSize: '1rem', color: '#eaf2f0' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px', fontSize: '1.2rem' }}>💊</div>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Never miss a dose</strong>
                <div style={{ color: '#8fa6a2', fontSize: '0.85rem', lineHeight: 1.4 }}>Post-visit medication reminders land in your inbox exactly on schedule.</div>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <div className="auth-main">
        <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '40px 32px', borderRadius: '24px', boxShadow: 'var(--shadow-hover)' }}>
          <form onSubmit={submit}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Create an account</h2>
              <p className="muted" style={{ margin: 0 }}>Join the clinic to start booking appointments</p>
            </div>
            
            <Alert kind="error">{error}</Alert>

            <Field label="Full name">
              <input required value={form.name} onChange={set('name')} placeholder="Ravi Kumar" style={{ padding: '10px 14px' }} />
            </Field>
            
            <Field label="Email address">
              <input type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" style={{ padding: '10px 14px' }} />
            </Field>
            
            <Field label="Password" hint="At least 8 characters.">
  <div style={{ display: 'flex', gap: '8px' }}>
    <input type={showPassword ? "text" : "password"} required minLength={8} value={form.password} onChange={set('password')} placeholder="••••••••" style={{ padding: '10px 14px', flex: 1 }} />
    <button type="button" className="btn btn-ghost" onClick={() => setShowPassword(!showPassword)} style={{ padding: '0 12px' }} tabIndex="-1">
      {showPassword ? 'Hide' : 'Show'}
    </button>
  </div>
</Field>
            
            <div className="field-row">
              <Field label="Phone number">
                <input value={form.phone} onChange={set('phone')} placeholder="+91 " style={{ padding: '10px 14px' }} />
              </Field>
              <Field label="Date of birth">
                <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} style={{ padding: '10px 14px' }} />
              </Field>
            </div>
            
            <Field label="Gender">
              <select value={form.gender} onChange={set('gender')} style={{ padding: '10px 14px' }}>
                <option value="unspecified">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <button className="btn" style={{ width: '100%', padding: '12px', marginTop: '16px', fontSize: '1rem' }} disabled={busy}>
              {busy ? 'Creating Account...' : 'Create Account'}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--line)' }}>
              <p className="small muted" style={{ margin: 0 }}>
                Already registered? <Link to="/login" style={{ fontWeight: 600 }}>Sign in instead</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}