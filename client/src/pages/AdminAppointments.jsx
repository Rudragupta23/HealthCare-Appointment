import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Field, Loading, fmtDateTime } from '../components/ui.jsx';

export default function AdminAppointments() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(null);
    api(`/admin/appointments${status ? `?status=${status}` : ''}`)
      .then((d) => setRows(d.appointments))
      .catch((e) => setError(e.message));
  }, [status]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin Portal</div>
          <h1>All Appointments</h1>
          <p>Monitor and manage every booking across the entire clinic.</p>
        </div>
      </div>

      <Alert kind="error">{error}</Alert>

      <div className="dashboard-grid">
        <section>
          {!rows ? <Loading /> : (
            <div className="card scroll-x" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data" style={{ margin: 0 }}>
                <thead style={{ background: 'var(--paper)' }}>
                  <tr>
                    <th style={{ paddingLeft: '24px' }}>When</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Status</th>
                    <th>Urgency</th>
                    <th>Calendar</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a._id}>
                      <td className="mono small" style={{ paddingLeft: '24px', fontWeight: 600 }}>{fmtDateTime(a.startTime)}</td>
                      <td style={{ fontWeight: 500 }}>{a.patient?.name}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{a.doctor?.name}</div>
                        <div className="small muted">{a.doctorProfile?.specialisation}</div>
                      </td>
                      <td><span className={`tag ${a.status === 'cancelled' ? 'tag-grey' : ''}`}>{a.status.replace('_', ' ')}</span></td>
                      <td><span style={{ fontSize: '0.8rem', fontWeight: 600, color: a.preVisitSummary?.urgency === 'High' ? 'var(--triage-high)' : 'inherit' }}>{a.preVisitSummary?.urgency || '-'}</span></td>
                      <td className="small muted">{a.calendar?.status}</td>
                      <td style={{ paddingRight: '24px', textAlign: 'right' }}><Link className="btn btn-ghost btn-sm" to={`/appointments/${a._id}`}>Open</Link></td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan="7" className="muted" style={{ padding: '24px', textAlign: 'center' }}>Nothing matches this filter.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside>
          <div className="card">
            <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Filters</h2>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Everything</option>
                <option value="booked">Booked</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="held">Held</option>
                <option value="no_show">No-show</option>
              </select>
            </Field>
          </div>
        </aside>
      </div>
    </>
  );
}