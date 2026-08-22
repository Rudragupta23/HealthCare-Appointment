import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, Field, Empty, Loading, DAYS } from '../components/ui.jsx';

const blank = {
  name: '', email: '', password: '', phone: '', specialisation: '', qualification: '',
  experienceYears: 0, consultationFee: 500, room: '', bio: '', slotDurationMinutes: 30,
  workingHours: [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '13:00' })),
};

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState(null);
  const [form, setForm] = useState(blank);
  const [showForm, setShowForm] = useState(false); 
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
      setShowForm(false); // Close form on success
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
          <h1>Manage Doctors</h1>
          <p>Create profiles and configure weekly working hours to automatically generate bookable slots.</p>
        </div>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      <div className="dashboard-grid">
        <section>
          <h2 className="section-title">Active Doctors</h2>
          {!doctors ? <Loading /> : doctors.length === 0 ? (
            <Empty title="No doctors yet">Fill out the form to onboard your first doctor.</Empty>
          ) : (
            <div className="list">
              {doctors.map((d) => (
                <article key={d._id} className="card card-tight" style={{ borderLeft: d.isAcceptingPatients ? '4px solid var(--teal)' : '4px solid var(--triage-medium)' }}>
                  <div className="appt-row">
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{d.user.name}</h3>
                      <div className="appt-meta" style={{ marginTop: '4px' }}>
                        {d.specialisation} · {d.slotDurationMinutes} min slots · {d.leaveDays.length} leave day(s)
                      </div>
                      <div className="small muted mono" style={{ marginTop: '4px' }}>{d.user.email}</div>
                    </div>
                    <div className="btn-row" style={{ alignItems: 'center' }}>
                      <span className={`tag ${d.isAcceptingPatients ? '' : 'tag-warn'}`}>{d.isAcceptingPatients ? 'Accepting' : 'Closed'}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => deactivate(d.user._id, d.user.name)}>Deactivate</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside>
          {!showForm ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px', background: 'var(--teal-wash)', borderColor: 'var(--teal)' }}>
              <h3 style={{ color: 'var(--teal-dark)', marginBottom: '12px' }}>Expand Your Team</h3>
              <p className="small" style={{ color: 'var(--teal-dark)', marginBottom: '24px' }}>
                Add a new doctor to the roster to start accepting more patient appointments.
              </p>
              <button className="btn btn-full" onClick={() => setShowForm(true)}>+ Onboard New Doctor</button>
            </div>
          ) : (
            <form className="card" onSubmit={create}>
              <div className="card-head" style={{ borderBottom: '2px solid var(--line)', paddingBottom: '12px', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Onboard New Doctor</h2>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
              </div>

              <Field label="Full name"><input required value={form.name} onChange={set('name')} placeholder="Dr. Vikas Gupta" /></Field>
              <Field label="Email"><input type="email" required value={form.email} onChange={set('email')} placeholder="gupta@clinic.com" /></Field>
              <Field label="Temporary password" hint="Leave blank to generate one automatically.">
                <input value={form.password} onChange={set('password')} />
              </Field>
              
              <div className="field-row" style={{ marginTop: '16px' }}>
                <Field label="Specialisation"><input required value={form.specialisation} onChange={set('specialisation')} placeholder="Cardiology" /></Field>
                <Field label="Qualification"><input value={form.qualification} onChange={set('qualification')} placeholder="MBBS, MD" /></Field>
              </div>
              <div className="field-row">
                <Field label="Slot (min)"><input type="number" min="5" max="180" step="5" value={form.slotDurationMinutes} onChange={set('slotDurationMinutes')} /></Field>
                <Field label="Fee"><input type="number" min="0" value={form.consultationFee} onChange={set('consultationFee')} /></Field>
                <Field label="Room"><input value={form.room} onChange={set('room')} placeholder="101" /></Field>
              </div>

              <div className="eyebrow" style={{ marginTop: 24, marginBottom: 12 }}>Working windows</div>
              {form.workingHours.map((w, i) => (
                <div key={i} className="field-row" style={{ alignItems: 'end', marginBottom: 8 }}>
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
              <button type="button" className="btn btn-ghost btn-sm btn-full" style={{ marginTop: '8px' }} onClick={() => setForm({ ...form, workingHours: [...form.workingHours, { dayOfWeek: 1, startTime: '14:00', endTime: '17:00' }] })}>
                + Add another window
              </button>

              <div className="divider" style={{ margin: '24px 0' }} />
              <button className="btn btn-full" disabled={busy}>{busy ? 'Creating Account...' : 'Create Doctor Profile'}</button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}