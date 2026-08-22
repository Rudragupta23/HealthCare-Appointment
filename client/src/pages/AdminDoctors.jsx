import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, Field, Loading, DAYS } from '../components/ui.jsx';

const blank = {
  name: '', email: '', password: '', phone: '', specialisation: '', qualification: '',
  experienceYears: 0, consultationFee: 500, room: '', bio: '', slotDurationMinutes: 30,
  workingHours: [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '13:00' })),
};

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState(null);
  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api('/doctors').then((d) => setDoctors(d.doctors)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  async function create(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await api('/admin/doctors', { method: 'POST', body: form });
      setMessage(`${res.message} Temporary password: ${res.temporaryPassword}`);
      setForm(blank);
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function deactivate(id, name) {
    if (!window.confirm(`Deactivate ${name}? They cannot sign in or take new bookings.`)) return;
    try {
      const res = await api(`/admin/doctors/${id}`, { method: 'DELETE' });
      setMessage(res.message); load();
    } catch (err) { setError(err.message); }
  }

  function updateWindow(i, key, value) {
    setForm({
      ...form,
      workingHours: form.workingHours.map((w, j) => (j === i ? { ...w, [key]: key === 'dayOfWeek' ? Number(value) : value } : w)),
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Doctors</h1>
          <p>Create a profile and the doctor receives sign-in details by email. Their hours drive every bookable slot.</p>
        </div>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      <div className="split">
        <section>
          {!doctors ? <Loading /> : doctors.length === 0 ? <p className="muted">No doctors yet.</p> : (
            <div className="list">
              {doctors.map((d) => (
                <article key={d._id} className="card card-tight">
                  <div className="appt-row">
                    <div>
                      <h3 style={{ margin: 0 }}>{d.user.name}</h3>
                      <div className="appt-meta">{d.specialisation} · {d.slotDurationMinutes} min slots · {d.leaveDays.length} leave day(s)</div>
                      <div className="small muted mono">{d.user.email}</div>
                    </div>
                    <div className="btn-row">
                      <span className={`tag ${d.isAcceptingPatients ? '' : 'tag-warn'}`}>{d.isAcceptingPatients ? 'open' : 'closed'}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => deactivate(d.user._id, d.user.name)}>Deactivate</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <form className="card" onSubmit={create}>
          <h2>Add a doctor</h2>
          <Field label="Full name"><input required value={form.name} onChange={set('name')} /></Field>
          <Field label="Email"><input type="email" required value={form.email} onChange={set('email')} /></Field>
          <Field label="Temporary password" hint="Leave blank to generate one automatically."><input value={form.password} onChange={set('password')} /></Field>
          <div className="field-row">
            <Field label="Specialisation"><input required value={form.specialisation} onChange={set('specialisation')} placeholder="Cardiology" /></Field>
            <Field label="Qualification"><input value={form.qualification} onChange={set('qualification')} placeholder="MBBS, MD" /></Field>
          </div>
          <div className="field-row">
            <Field label="Slot length (min)"><input type="number" min="5" max="180" step="5" value={form.slotDurationMinutes} onChange={set('slotDurationMinutes')} /></Field>
            <Field label="Fee"><input type="number" min="0" value={form.consultationFee} onChange={set('consultationFee')} /></Field>
            <Field label="Room"><input value={form.room} onChange={set('room')} /></Field>
          </div>

          <div className="eyebrow" style={{ marginTop: 10 }}>Working windows</div>
          {form.workingHours.map((w, i) => (
            <div key={i} className="field-row" style={{ alignItems: 'end', marginBottom: 6 }}>
              <Field label="Day">
                <select value={w.dayOfWeek} onChange={(e) => updateWindow(i, 'dayOfWeek', e.target.value)}>
                  {DAYS.map((d, idx) => <option key={d} value={idx}>{d.slice(0, 3)}</option>)}
                </select>
              </Field>
              <Field label="From"><input type="time" value={w.startTime} onChange={(e) => updateWindow(i, 'startTime', e.target.value)} /></Field>
              <Field label="To"><input type="time" value={w.endTime} onChange={(e) => updateWindow(i, 'endTime', e.target.value)} /></Field>
              <Field label="&nbsp;"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, workingHours: form.workingHours.filter((_, j) => j !== i) })}>Remove</button></Field>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, workingHours: [...form.workingHours, { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' }] })}>Add window</button>

          <div className="divider" />
          <button className="btn" disabled={busy}>{busy ? 'Creating' : 'Create doctor'}</button>
        </form>
      </div>
    </>
  );
}
