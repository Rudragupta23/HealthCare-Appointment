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
    <div className="auth">
      <aside className="auth-aside">
        <div className="eyebrow" style={{ color: '#8fa6a2' }}>HealthCare Appointmen</div>
        <h1>Appointments that arrive prepared.</h1>
        <ul>
          <li>Patients describe symptoms once, before the visit.</li>
          <li>Doctors open each consultation with a triaged summary.</li>
          <li>Confirmations, reminders and calendar entries handle themselves.</li>
        </ul>
      </aside>

      <div className="auth-main">
        <form className="auth-form" onSubmit={submit}>
          <div className="eyebrow">Sign in</div>
          <h2>Welcome back</h2>
          <Alert kind="error">{error}</Alert>

          <Field label="Email">
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>

          <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in' : 'Sign in'}</button>
          <p className="small muted" style={{ marginTop: 16 }}>
            New patient? <Link to="/register">Create an account</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
