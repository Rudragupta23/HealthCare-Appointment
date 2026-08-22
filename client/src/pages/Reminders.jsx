import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, Empty, Loading, fmtDateTime } from '../components/ui.jsx';

export default function Reminders() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api('/appointments/reminders').then((d) => setRows(d.reminders)).catch((e) => setError(e.message)); }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!rows) return <Loading />;

  const upcoming = rows.filter((r) => r.status === 'pending');
  const done = rows.filter((r) => r.status !== 'pending');

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Patient portal</div>
          <h1>Medication schedule</h1>
          <p>Built from your prescriptions. Each dose sends you an email at the scheduled time.</p>
        </div>
      </div>

      <h2>Coming up</h2>
      {upcoming.length === 0 ? (
        <Empty title="No doses scheduled">Reminders appear here after a doctor completes a visit and prescribes medication.</Empty>
      ) : (
        <div className="card scroll-x">
          <table className="data">
            <thead><tr><th>When</th><th>Medicine</th><th>Dosage</th><th>Instructions</th></tr></thead>
            <tbody>
              {upcoming.map((r) => (
                <tr key={r._id}>
                  <td className="mono small">{fmtDateTime(r.scheduledAt)}</td>
                  <td>{r.medicine}</td>
                  <td className="small">{r.dosage || '-'}</td>
                  <td className="small muted">{r.instructions || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="divider" />
          <h2>Already sent</h2>
          <div className="card scroll-x">
            <table className="data">
              <thead><tr><th>When</th><th>Medicine</th><th>Status</th></tr></thead>
              <tbody>
                {done.slice(0, 50).map((r) => (
                  <tr key={r._id}><td className="mono small">{fmtDateTime(r.scheduledAt)}</td><td>{r.medicine}</td><td className="small muted">{r.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
