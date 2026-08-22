import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, Field, Loading, DAYS, todayKey } from '../components/ui.jsx';

export default function DoctorHours() {
  const [profile, setProfile] = useState(null);
  const [leave, setLeave] = useState({ date: todayKey(), reason: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api('/auth/me');
      setProfile(data.doctorProfile);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  if (!profile) return <Loading />;

  const setField = (k, v) => setProfile({ ...profile, [k]: v });

  function updateWindow(i, key, value) {
    const next = profile.workingHours.map((w, j) => (j === i ? { ...w, [key]: key === 'dayOfWeek' ? Number(value) : value } : w));
    setField('workingHours', next);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await api('/doctor/profile', {
        method: 'PATCH',
        body: {
          qualification: profile.qualification, experienceYears: profile.experienceYears,
          consultationFee: profile.consultationFee, room: profile.room, bio: profile.bio,
          slotDurationMinutes: profile.slotDurationMinutes, workingHours: profile.workingHours,
          isAcceptingPatients: profile.isAcceptingPatients,
        },
      });
      setProfile(res.doctorProfile);
      setMessage('Schedule saved. New slots follow these hours immediately.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function markLeave(e) {
    e.preventDefault();
    if (!window.confirm(`Mark ${leave.date} as leave? Every booking that day is cancelled and those patients are emailed.`)) return;
    setBusy(true); setError('');
    try {
      const res = await api('/doctor/leave', { method: 'POST', body: leave });
      setMessage(res.message);
      setProfile(res.doctorProfile);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function removeLeave(date) {
    try {
      const res = await api('/doctor/leave', { method: 'DELETE', body: { date } });
      setMessage(res.message);
      setProfile(res.doctorProfile);
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Doctor portal</div>
          <h1>Hours & Leave</h1>
          <p>Configure your weekly schedule and block out dates for planned leave.</p>
        </div>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      <div className="dashboard-grid">
        <section>
          <form className="card" onSubmit={save}>
            <h2 className="section-title">Consulting Profile</h2>
            <div className="field-row">
              <Field label="Slot length (minutes)">
                <input type="number" min="5" max="180" step="5" value={profile.slotDurationMinutes} onChange={(e) => setField('slotDurationMinutes', Number(e.target.value))} />
              </Field>
              <Field label="Room"><input value={profile.room || ''} onChange={(e) => setField('room', e.target.value)} placeholder="e.g., 101" /></Field>
              <Field label="Fee"><input type="number" min="0" value={profile.consultationFee} onChange={(e) => setField('consultationFee', Number(e.target.value))} /></Field>
            </div>

            <Field label="Professional Bio" hint="Visible to patients when they book an appointment.">
              <textarea value={profile.bio || ''} onChange={(e) => setField('bio', e.target.value)} placeholder="A brief professional summary..." />
            </Field>

            <h2 className="section-title" style={{ marginTop: '32px' }}>Weekly Working Windows</h2>
            {profile.workingHours.length === 0 && <p className="muted small">No windows yet — add one to start taking bookings.</p>}
            
            {profile.workingHours.map((w, i) => (
              <div key={i} className="field-row" style={{ alignItems: 'end', marginBottom: '12px' }}>
                <Field label="Day">
                  <select value={w.dayOfWeek} onChange={(e) => updateWindow(i, 'dayOfWeek', e.target.value)}>
                    {DAYS.map((d, idx) => <option key={d} value={idx}>{d}</option>)}
                  </select>
                </Field>
                <Field label="From"><input type="time" value={w.startTime} onChange={(e) => updateWindow(i, 'startTime', e.target.value)} /></Field>
                <Field label="To"><input type="time" value={w.endTime} onChange={(e) => updateWindow(i, 'endTime', e.target.value)} /></Field>
                <Field label="&nbsp;">
                  <button type="button" className="btn btn-ghost btn-sm btn-full" onClick={() => setField('workingHours', profile.workingHours.filter((_, j) => j !== i))}>Remove</button>
                </Field>
              </div>
            ))}

            <button type="button" className="btn btn-ghost btn-sm btn-full" style={{ marginTop: '8px' }} onClick={() => setField('workingHours', [...profile.workingHours, { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' }])}>
              + Add another window
            </button>

            <div className="divider" style={{ margin: '32px 0' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: 0, fontSize: '1rem', color: 'var(--ink)' }}>
                <input type="checkbox" style={{ width: '20px', height: '20px', cursor: 'pointer' }} checked={profile.isAcceptingPatients} onChange={(e) => setField('isAcceptingPatients', e.target.checked)} />
                Accepting new bookings
              </label>
              <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save Schedule'}</button>
            </div>
          </form>
        </section>

        <aside className="list">
          <div className="card">
            <h2 className="section-title">Mark Leave</h2>
            <p className="small muted">Marking leave immediately cancels any booked appointments for that date and notifies patients via email.</p>
            <form onSubmit={markLeave}>
              <Field label="Date"><input type="date" required value={leave.date} onChange={(e) => setLeave({ ...leave, date: e.target.value })} /></Field>
              <Field label="Reason (Optional)"><input value={leave.reason} onChange={(e) => setLeave({ ...leave, reason: e.target.value })} placeholder="e.g., Medical Conference" /></Field>
              <button className="btn btn-danger btn-full" disabled={busy} style={{ marginTop: '8px' }}>Block Date</button>
            </form>
          </div>

          <div className="card card-tight">
            <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Upcoming Leave</h2>
            {profile.leaveDays.length === 0 ? <p className="muted small" style={{ margin: 0 }}>No leave scheduled.</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {profile.leaveDays.map((l) => (
                  <li key={l.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
                    <div>
                      <div className="mono small" style={{ fontWeight: 600, color: 'var(--ink)' }}>{l.date}</div>
                      <div className="small muted" style={{ marginTop: '2px' }}>{l.reason || 'No reason provided'}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeLeave(l.date)}>Reopen</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}