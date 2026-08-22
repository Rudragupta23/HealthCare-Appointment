import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Loading, fmtDateTime } from '../components/ui.jsx';

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
          <div className="eyebrow">Admin</div>
          <h1>All appointments</h1>
        </div>
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Everything</option>
            <option value="booked">Booked</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="held">Held</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
      </div>

      <Alert kind="error">{error}</Alert>

      {!rows ? <Loading /> : (
        <div className="card scroll-x">
          <table className="data">
            <thead>
              <tr><th>When</th><th>Patient</th><th>Doctor</th><th>Status</th><th>Urgency</th><th>Calendar</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a._id}>
                  <td className="mono">{fmtDateTime(a.startTime)}</td>
                  <td>{a.patient?.name}</td>
                  <td>{a.doctor?.name}<div className="small muted">{a.doctorProfile?.specialisation}</div></td>
                  <td>{a.status.replace('_', ' ')}</td>
                  <td>{a.preVisitSummary?.urgency || '-'}</td>
                  <td className="small muted">{a.calendar?.status}</td>
                  <td><Link className="btn btn-ghost btn-sm" to={`/appointments/${a._id}`}>Open</Link></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan="7" className="muted">Nothing matches this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
