import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Empty, Loading, Triage, fmtDateTime } from '../components/ui.jsx';

export default function PatientHome() {
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([
        api('/appointments?scope=upcoming&status=booked'),
        api('/appointments?scope=past&status=completed,cancelled,booked,no_show'),
      ]);
      setUpcoming(u.appointments);
      setPast(p.appointments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function cancel(id) {
    const reason = window.prompt('Tell the clinic why you are cancelling (optional):') ?? null;
    if (reason === null) return;
    try {
      const res = await api(`/appointments/${id}/cancel`, { method: 'POST', body: { reason } });
      setMessage(res.message);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Patient portal</div>
          <h1>My appointments</h1>
          <p>Everything you have booked, with the summary the doctor received and the one written back to you afterwards.</p>
        </div>
        <Link className="btn" to="/book">Book an appointment</Link>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      {loading ? <Loading /> : (
        <>
          <h2>Coming up</h2>
          {upcoming.length === 0 ? (
            <Empty title="Nothing booked yet">Search by specialisation and pick a slot that suits you.</Empty>
          ) : (
            <div className="list">
              {upcoming.map((a) => (
                <article key={a._id} className="appt" data-urgency={a.preVisitSummary?.urgency} data-status={a.status}>
                  <div className="appt-row">
                    <div>
                      <div className="appt-time">{fmtDateTime(a.startTime)}</div>
                      <div className="appt-meta">{a.doctor?.name} · {a.doctorProfile?.specialisation}{a.doctorProfile?.room ? ` · Room ${a.doctorProfile.room}` : ''}</div>
                    </div>
                    <div className="btn-row">
                      <Triage level={a.preVisitSummary?.urgency || 'Unknown'} />
                      <Link className="btn btn-ghost btn-sm" to={`/appointments/${a._id}`}>Open</Link>
                      <button className="btn btn-ghost btn-sm" onClick={() => cancel(a._id)}>Cancel</button>
                    </div>
                  </div>
                  {a.preVisitSummary?.chiefComplaint && (
                    <p className="small muted" style={{ margin: '10px 0 0' }}>Sent to the doctor: {a.preVisitSummary.chiefComplaint}</p>
                  )}
                </article>
              ))}
            </div>
          )}

          <div className="divider" />
          <h2>History</h2>
          {past.length === 0 ? (
            <Empty title="No past visits">Your completed visits and their summaries will collect here.</Empty>
          ) : (
            <div className="list">
              {past.map((a) => (
                <article key={a._id} className="appt" data-urgency={a.preVisitSummary?.urgency} data-status={a.status}>
                  <div className="appt-row">
                    <div>
                      <div className="appt-time">{fmtDateTime(a.startTime)}</div>
                      <div className="appt-meta">{a.doctor?.name} · {a.doctorProfile?.specialisation}</div>
                    </div>
                    <div className="btn-row">
                      <span className={`tag ${a.status === 'cancelled' ? 'tag-grey' : ''}`}>{a.status.replace('_', ' ')}</span>
                      <Link className="btn btn-ghost btn-sm" to={`/appointments/${a._id}`}>Open</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
