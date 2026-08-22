import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, Loading } from '../components/ui.jsx';

const Stat = ({ value, label }) => (
  <div className="card" style={{ padding: '24px 20px', textAlign: 'left' }}>
    <div style={{ fontFamily: 'var(--display)', fontSize: '2.2rem', lineHeight: 1, color: 'var(--ink)' }}>
      {value ?? 0}
    </div>
    <div style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginTop: '8px', fontWeight: 600 }}>
      {label}
    </div>
  </div>
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
          <div className="eyebrow">Admin Portal</div>
          <h1>Clinic Overview</h1>
          <p>Live counts across bookings, notifications, and AI summaries.</p>
        </div>
      </div>

      {/* Restored 4-column side-by-side boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Stat value={data.patients} label="Registered Patients" />
        <Stat value={data.doctors} label="Active Doctors" />
        <Stat value={data.appointments.booked} label="Upcoming Bookings" />
        <Stat value={data.appointments.completed} label="Completed Visits" />
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h2 className="section-title">Appointments by Status</h2>
          <table className="data">
            <tbody>
              {Object.entries(data.appointments).map(([k, v]) => (
                <tr key={k}>
                  <th style={{ fontSize: '0.8rem' }}>{k.replace('_', ' ')}</th>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{v}</td>
                </tr>
              ))}
              {Object.keys(data.appointments).length === 0 && <tr><td className="muted">Nothing booked yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="section-title">System Reliability</h2>
          <table className="data">
            <tbody>
              <tr><th>Emails sent</th><td className="mono" style={{ textAlign: 'right' }}>{data.emails.sent || 0}</td></tr>
              <tr><th>Emails waiting</th><td className="mono" style={{ textAlign: 'right' }}>{data.emails.pending || 0}</td></tr>
              <tr>
                <th>Emails failed</th>
                <td className="mono" style={{ textAlign: 'right', color: data.emails.failed ? 'var(--triage-high)' : undefined, fontWeight: data.emails.failed ? 700 : 400 }}>
                  {data.emails.failed || 0}
                </td>
              </tr>
              <tr><th>Queued Reminders</th><td className="mono" style={{ textAlign: 'right' }}>{data.pendingReminders}</td></tr>
              <tr><th>Fallback Summaries</th><td className="mono" style={{ textAlign: 'right' }}>{data.llmFallbacks}</td></tr>
            </tbody>
          </table>
          <p className="hint" style={{ marginTop: '16px' }}>Fallback summaries mean the LLM was unreachable. Bookings still went through smoothly.</p>
        </div>
      </div>
    </>
  );
}