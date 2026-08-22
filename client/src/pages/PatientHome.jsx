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
          <h1>My Dashboard</h1>
          <p>Track your upcoming visits and review AI-generated summaries from your past consultations.</p>
        </div>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      {loading ? <Loading /> : (
        <div className="dashboard-grid">
          {/* Main Column: High Priority / Upcoming */}
          <section>
            <h2 className="section-title">Coming Up</h2>
            
            {upcoming.length === 0 ? (
              <Empty title="Nothing booked yet">
                You have no upcoming appointments. Use the booking portal to reserve a slot.
              </Empty>
            ) : (
              <div className="list">
                {upcoming.map((a) => (
                  <article key={a._id} className="appt" data-urgency={a.preVisitSummary?.urgency} data-status={a.status}>
                    <div className="appt-row">
                      <div>
                        <div className="appt-time">{fmtDateTime(a.startTime)}</div>
                        <div className="appt-meta">
                          <strong>{a.doctor?.name}</strong> · {a.doctorProfile?.specialisation}
                          {a.doctorProfile?.room ? ` · Room ${a.doctorProfile.room}` : ''}
                        </div>
                      </div>
                      <div className="btn-row">
                        <Triage level={a.preVisitSummary?.urgency || 'Unknown'} />
                        <Link className="btn btn-ghost btn-sm" to={`/appointments/${a._id}`}>Details</Link>
                        <button className="btn btn-ghost btn-sm" onClick={() => cancel(a._id)}>Cancel</button>
                      </div>
                    </div>
                    {a.preVisitSummary?.chiefComplaint && (
                      <p className="small muted" style={{ margin: '14px 0 0', padding: '10px', background: 'var(--paper)', borderRadius: '8px' }}>
                        <strong>Reason for visit:</strong> {a.preVisitSummary.chiefComplaint}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Side Column: Actions & History */}
          <aside className="list">
            
            {/* Quick Action Card */}
            <div className="card" style={{ background: 'var(--teal-wash)', borderColor: 'var(--teal)' }}>
              <h3 style={{ color: 'var(--teal-dark)' }}>Need a consultation?</h3>
              <p className="small" style={{ color: 'var(--teal-dark)', marginBottom: '16px' }}>
                Search by specialisation and book a slot that suits your schedule.
              </p>
              <Link className="btn btn-full" to="/book">Book new appointment</Link>
            </div>

            <h2 className="section-title" style={{ marginTop: '16px' }}>Past Visits</h2>
            
            {past.length === 0 ? (
              <Empty title="No past visits">Your completed visit summaries will collect here.</Empty>
            ) : (
              <div className="list">
                {past.map((a) => (
                  <article key={a._id} className="card card-tight" data-status={a.status}>
                    <div className="appt-row">
                      <div>
                        <div className="appt-time" style={{ fontSize: '1rem' }}>{fmtDateTime(a.startTime)}</div>
                        <div className="appt-meta" style={{ fontSize: '0.85rem' }}>{a.doctor?.name} · {a.doctorProfile?.specialisation}</div>
                      </div>
                    </div>
                    <div className="appt-row" style={{ marginTop: '12px' }}>
                      <span className={`tag ${a.status === 'cancelled' ? 'tag-grey' : ''}`}>{a.status.replace('_', ' ')}</span>
                      <Link className="btn btn-ghost btn-sm" to={`/appointments/${a._id}`}>Review notes</Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}