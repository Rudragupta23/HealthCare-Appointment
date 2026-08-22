import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, Loading } from '../components/ui.jsx';

const Stat = ({ value, label }) => (
  <div className="stat"><div className="stat-value">{value ?? 0}</div><div className="stat-label">{label}</div></div>
);

export default function AdminHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/admin/dashboard').then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Clinic overview</h1>
          <p>Live counts across bookings, notifications and AI summaries.</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat value={data.patients} label="patients" />
        <Stat value={data.doctors} label="active doctors" />
        <Stat value={data.appointments.booked} label="booked" />
        <Stat value={data.appointments.completed} label="completed" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="eyebrow">Appointments by status</div>
          <table className="data">
            <tbody>
              {Object.entries(data.appointments).map(([k, v]) => (
                <tr key={k}><th>{k.replace('_', ' ')}</th><td className="mono">{v}</td></tr>
              ))}
              {Object.keys(data.appointments).length === 0 && <tr><td className="muted">Nothing booked yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="eyebrow">Reliability</div>
          <table className="data">
            <tbody>
              <tr><th>Emails sent</th><td className="mono">{data.emails.sent || 0}</td></tr>
              <tr><th>Emails waiting</th><td className="mono">{data.emails.pending || 0}</td></tr>
              <tr><th>Emails failed</th><td className="mono" style={{ color: data.emails.failed ? 'var(--triage-high)' : undefined }}>{data.emails.failed || 0}</td></tr>
              <tr><th>Medication reminders queued</th><td className="mono">{data.pendingReminders}</td></tr>
              <tr><th>Summaries written without AI</th><td className="mono">{data.llmFallbacks}</td></tr>
            </tbody>
          </table>
          <p className="hint">Fallback summaries mean the LLM was unreachable. Bookings still went through.</p>
        </div>
      </div>
    </>
  );
}
