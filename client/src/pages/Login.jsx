import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Field } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError('Invalid email or password. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth" style={{ background: 'var(--paper)' }}>
      <aside className="auth-aside" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Ambient background glows */}
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '300px', height: '300px', background: 'var(--teal)', filter: 'blur(100px)', opacity: 0.5, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '400px', height: '400px', background: '#16a085', filter: 'blur(120px)', opacity: 0.3, borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: '60px' }}>
            <span className="brand-mark" />
            <span style={{ color: '#fff', fontSize: '1.2rem', fontFamily: 'var(--display)', fontWeight: 700 }}>HealthCare Portal</span>
          </Link>
          
          <h1 style={{ fontSize: '3rem', lineHeight: 1.1, marginBottom: '24px' }}>
            Appointments that arrive <span style={{ color: 'var(--teal)' }}>prepared.</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#b9cbc7', maxWidth: '40ch', marginBottom: '40px', lineHeight: 1.6 }}>
            Experience the next generation of clinical scheduling. Connect patients and doctors seamlessly.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', fontSize: '1rem', color: '#eaf2f0' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px', fontSize: '1.2rem' }}>📝</div>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Smart Symptom Forms</strong>
                <div style={{ color: '#8fa6a2', fontSize: '0.85rem', lineHeight: 1.4 }}>Patients describe their symptoms just once, before the visit even begins.</div>
              </div>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', fontSize: '1rem', color: '#eaf2f0' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px', fontSize: '1.2rem' }}>🧠</div>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>AI-Powered Triage</strong>
                <div style={{ color: '#8fa6a2', fontSize: '0.85rem', lineHeight: 1.4 }}>Doctors open each consultation with a clean, instantly readable triaged summary.</div>
              </div>
            </li>
            <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', fontSize: '1rem', color: '#eaf2f0' }}>
              <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px', fontSize: '1.2rem' }}>📅</div>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Automated Syncing</strong>
                <div style={{ color: '#8fa6a2', fontSize: '0.85rem', lineHeight: 1.4 }}>Confirmations, reminders and calendar entries handle themselves securely in the background.</div>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <div className="auth-main">
        <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '40px 32px', borderRadius: '24px', boxShadow: 'var(--shadow-hover)' }}>
          <form onSubmit={submit}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Welcome back</h2>
              <p className="muted" style={{ margin: 0 }}>Sign in to your account to continue</p>
            </div>
            
            <Alert kind="error">{error}</Alert>

            <Field label="Email address">
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" style={{ padding: '12px 16px' }} />
            </Field>
            <Field label="Password">
  <div style={{ display: 'flex', gap: '8px' }}>
    <input type={showPassword ? "text" : "password"} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" style={{ padding: '12px 16px', flex: 1 }} />
    <button type="button" className="btn btn-ghost" onClick={() => setShowPassword(!showPassword)} style={{ padding: '0 12px' }} tabIndex="-1">
      {showPassword ? 'Hide' : 'Show'}
    </button>
  </div>
</Field>

            <button className="btn" style={{ width: '100%', padding: '12px', marginTop: '12px', fontSize: '1rem' }} disabled={busy}>
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--line)' }}>
              <p className="small muted" style={{ margin: 0 }}>
                New to the clinic? <Link to="/register" style={{ fontWeight: 600 }}>Create an account</Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}