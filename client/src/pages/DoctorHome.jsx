import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Empty, Loading, Triage, fmtTime, todayKey, fmtDate } from '../components/ui.jsx';

export default function DoctorHome() {
  const [date, setDate] = useState(todayKey());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api(`/doctor/schedule?date=${date}`);
      setAppointments(data.appointments);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [date]);

  async function noShow(id) {
    try {
      const res = await api(`/appointments/${id}/no-show`, { method: 'POST' });
      setMessage(res.message); load();
    } catch (err) { setError(err.message); }
  }

  const high = appointments.filter((a) => a.preVisitSummary?.urgency === 'High').length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Doctor portal</div>
          <h1>{date === todayKey() ? 'Today' : fmtDate(`${date}T12:00:00`)}</h1>
          <p>
            {appointments.length} consultation{appointments.length === 1 ? '' : 's'}
            {high > 0 ? ` · ${high} flagged high urgency` : ''}. The spine colour on each card is the AI triage verdict.
          </p>
        </div>
        <div>
          <label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      {loading ? <Loading /> : appointments.length === 0 ? (
        <Empty title="Clear day">No consultations booked for this date.</Empty>
      ) : (
        <div className="list">
          {appointments.map((a) => (
            <article key={a._id} className="appt" data-urgency={a.preVisitSummary?.urgency} data-status={a.status}>
              <div className="appt-row">
                <div>
                  <div className="appt-time">{fmtTime(a.startTime)} – {fmtTime(a.endTime)}</div>
                  <div className="appt-meta">
                    {a.patient?.name}
                    {a.patient?.dateOfBirth ? ` · ${Math.floor((Date.now() - new Date(a.patient.dateOfBirth)) / 3.15576e10)} yrs` : ''}
                    {a.patient?.phone ? ` · ${a.patient.phone}` : ''}
                  </div>
                </div>
                <div className="btn-row">
                  <Triage level={a.preVisitSummary?.urgency || 'Unknown'} />
                  <span className={`tag ${a.status === 'completed' ? '' : 'tag-grey'}`}>{a.status.replace('_', ' ')}</span>
                  <Link className="btn btn-ghost btn-sm" to={`/appointments/${a._id}`}>
                    {a.status === 'completed' ? 'View notes' : 'Open'}
                  </Link>
                  {a.status === 'booked' && <button className="btn btn-ghost btn-sm" onClick={() => noShow(a._id)}>No-show</button>}
                </div>
              </div>
              {a.preVisitSummary?.chiefComplaint && <p className="small" style={{ margin: '10px 0 0' }}>{a.preVisitSummary.chiefComplaint}</p>}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
