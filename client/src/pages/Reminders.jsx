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
          <h1>Medication Schedule</h1>
          <p>Built directly from your prescriptions. We will email you a reminder right when it is time for each dose.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <section>
          <h2 className="section-title">Coming Up Next</h2>
          {upcoming.length === 0 ? (
            <Empty title="No doses scheduled">
              Reminders will appear here after a doctor completes your visit and prescribes medication.
            </Empty>
          ) : (
            <div className="card scroll-x" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data" style={{ margin: 0 }}>
                <thead style={{ background: 'var(--paper)' }}>
                  <tr>
                    <th style={{ paddingLeft: '24px' }}>When</th>
                    <th>Medicine</th>
                    <th>Dosage</th>
                    <th>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((r) => (
                    <tr key={r._id}>
                      <td className="mono small" style={{ paddingLeft: '24px', fontWeight: 600 }}>{fmtDateTime(r.scheduledAt)}</td>
                      <td style={{ fontWeight: 500 }}>{r.medicine}</td>
                      <td className="small">{r.dosage || '-'}</td>
                      <td className="small muted">{r.instructions || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside>
          <h2 className="section-title">History</h2>
          {done.length === 0 ? (
            <div className="card card-tight">
              <p className="muted small" style={{ margin: 0 }}>No past reminders yet.</p>
            </div>
          ) : (
            <div className="card card-tight scroll-x" style={{ padding: 0 }}>
              <table className="data" style={{ margin: 0 }}>
                <thead style={{ background: 'var(--paper)' }}>
                  <tr>
                    <th style={{ paddingLeft: '20px' }}>When</th>
                    <th>Medicine</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {done.slice(0, 50).map((r) => (
                    <tr key={r._id}>
                      <td className="mono small" style={{ paddingLeft: '20px' }}>{fmtDateTime(r.scheduledAt)}</td>
                      <td style={{ fontWeight: 500 }}>{r.medicine}</td>
                      <td><span className="tag tag-grey">{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}