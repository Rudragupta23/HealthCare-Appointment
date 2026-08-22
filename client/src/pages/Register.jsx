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
    <div className="auth">
      <aside className="auth-aside">
        <div className="eyebrow" style={{ color: '#8fa6a2' }}>HealthCare Appointment</div>
        <h1>Register once. Book in a minute.</h1>
        <ul>
          <li>Search by specialisation and pick a real, open slot.</li>
          <li>Your symptom form reaches the doctor before you do.</li>
          <li>Medication reminders land in your inbox on schedule.</li>
        </ul>
      </aside>

      <div className="auth-main">
        <form className="auth-form" onSubmit={submit}>
          <div className="eyebrow">Patient registration</div>
          <h2>Create your account</h2>
          <Alert kind="error">{error}</Alert>

          <Field label="Full name"><input required value={form.name} onChange={set('name')} /></Field>
          <Field label="Email"><input type="email" required value={form.email} onChange={set('email')} /></Field>
          <Field label="Password" hint="At least 8 characters."><input type="password" required minLength={8} value={form.password} onChange={set('password')} /></Field>
          <div className="field-row">
            <Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field>
            <Field label="Date of birth"><input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} /></Field>
          </div>
          <Field label="Gender">
            <select value={form.gender} onChange={set('gender')}>
              <option value="unspecified">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating' : 'Create account'}</button>
          <p className="small muted" style={{ marginTop: 16 }}>Already registered? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
