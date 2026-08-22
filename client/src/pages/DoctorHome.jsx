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
          <div className="eyebrow">Doctor Portal</div>
          <h1>{date === todayKey() ? 'Today\'s Schedule' : fmtDate(`${date}T12:00:00`)}</h1>
          <p>Review your agenda, check AI triage summaries, and manage patient consultations.</p>
        </div>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      <div className="dashboard-grid">
        {/* Main Column: Appointments */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid var(--line)', paddingBottom: '12px' }}>
            <h2 style={{ margin: 0 }}>Consultations</h2>
          </div>

          {loading ? <Loading /> : appointments.length === 0 ? (
            <Empty title="Clear day">No consultations booked for this date.</Empty>
          ) : (
            <div className="list">
              {appointments.map((a) => (
                <article key={a._id} className="appt" data-urgency={a.preVisitSummary?.urgency} data-status={a.status}>
                  <div className="appt-row">
                    <div>
                      <div className="appt-time">{fmtTime(a.startTime)} – {fmtTime(a.endTime)}</div>
                      <div className="appt-meta" style={{ fontWeight: 500, color: 'var(--ink)' }}>
                        {a.patient?.name}
                        <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>
                          {a.patient?.dateOfBirth ? ` · ${Math.floor((Date.now() - new Date(a.patient.dateOfBirth)) / 3.15576e10)} yrs` : ''}
                          {a.patient?.phone ? ` · ${a.patient.phone}` : ''}
                        </span>
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
                  {a.preVisitSummary?.chiefComplaint && (
                    <p className="small" style={{ margin: '14px 0 0', padding: '10px', background: 'var(--paper)', borderRadius: '8px', color: 'var(--ink-soft)' }}>
                      <strong>AI Triage Note:</strong> {a.preVisitSummary.chiefComplaint}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Sidebar: Controls & Stats */}
        <aside className="list">
          <div className="card" style={{ background: 'var(--teal-wash)', borderColor: 'var(--teal)' }}>
            <h3 style={{ color: 'var(--teal-dark)', margin: '0 0 16px 0' }}>Schedule Controls</h3>
            
            <label style={{ display: 'block', fontSize: '.82rem', fontWeight: 600, color: 'var(--teal-dark)', marginBottom: '5px' }}>Selected Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              style={{ width: '100%', borderColor: 'rgba(14, 110, 99, 0.3)', boxShadow: '0 2px 4px rgba(14, 110, 99, 0.05)' }} 
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(14, 110, 99, 0.2)' }}>
              <div style={{ color: 'var(--teal-dark)' }}>
                <div style={{ fontSize: '2.2rem', fontFamily: 'var(--display)', fontWeight: 700, lineHeight: 1 }}>{appointments.length}</div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: '4px' }}>Total Visits</div>
              </div>
              <div style={{ color: 'var(--triage-high)', textAlign: 'right' }}>
                <div style={{ fontSize: '2.2rem', fontFamily: 'var(--display)', fontWeight: 700, lineHeight: 1 }}>{high}</div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: '4px' }}>Urgent</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}