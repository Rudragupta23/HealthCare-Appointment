import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Field, Empty, HoldTimer, Loading, todayKey, fmtDate, DAYS } from '../components/ui.jsx';

const emptySymptoms = {
  description: '', durationOfSymptoms: '', painLevel: 3,
  existingConditions: '', currentMedication: '', allergies: '',
};

export default function BookAppointment() {
  const navigate = useNavigate();

  const [specialisations, setSpecialisations] = useState([]);
  const [filters, setFilters] = useState({ specialisation: 'all', q: '' });
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const [date, setDate] = useState(todayKey());
  const [availability, setAvailability] = useState(null);
  const [slot, setSlot] = useState(null);

  const [hold, setHold] = useState(null);
  const [symptoms, setSymptoms] = useState(emptySymptoms);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api('/doctors/specialisations').then((d) => setSpecialisations(d.specialisations)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.specialisation !== 'all') params.set('specialisation', filters.specialisation);
    if (filters.q) params.set('q', filters.q);
    api(`/doctors?${params}`).then((d) => setDoctors(d.doctors)).catch((e) => setError(e.message));
  }, [filters]);

  useEffect(() => {
    if (!selectedDoctor) return;
    setAvailability(null); setSlot(null);
    api(`/doctors/${selectedDoctor.user._id}/availability?date=${date}`)
      .then(setAvailability)
      .catch((e) => setError(e.message));
  }, [selectedDoctor, date]);

  async function reserve() {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await api('/appointments/hold', { method: 'POST', body: { doctorId: selectedDoctor.user._id, startTime: slot } });
      setHold(res.appointment);
      setNotice(res.message);
    } catch (err) {
      setError(err.message);
      if (err.code === 'SLOT_TAKEN') {
        const fresh = await api(`/doctors/${selectedDoctor.user._id}/availability?date=${date}`);
        setAvailability(fresh); setSlot(null);
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await api(`/appointments/${hold.id}/confirm`, { method: 'POST', body: symptoms });
      navigate(`/appointments/${res.appointment._id}?booked=1`);
    } catch (err) {
      setError(err.message);
      if (err.code === 'HOLD_EXPIRED') { setHold(null); setSlot(null); }
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------- step 3: symptoms ------------------------- */
  if (hold) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="eyebrow">Step 3 of 3 · symptom form</div>
            <h1>Tell the doctor what is going on</h1>
            <p>This is summarised and triaged for {selectedDoctor.user.name} before your visit. The slot stays yours until the timer runs out.</p>
          </div>
          <HoldTimer expiresAt={hold.holdExpiresAt} onExpire={() => { setHold(null); setError('Your hold expired and the slot was released. Please choose a slot again.'); }} />
        </div>

        <Alert kind="error">{error}</Alert>

        <form className="card" onSubmit={confirm} style={{ maxWidth: 720 }}>
          <Field label="What is the problem?" hint="Plain language is fine. Ten characters minimum.">
            <textarea required minLength={10} value={symptoms.description} onChange={(e) => setSymptoms({ ...symptoms, description: e.target.value })}
              placeholder="Dry cough for five days, worse at night, mild fever since Tuesday." />
          </Field>
          <div className="field-row">
            <Field label="How long has this been going on?">
              <input value={symptoms.durationOfSymptoms} onChange={(e) => setSymptoms({ ...symptoms, durationOfSymptoms: e.target.value })} placeholder="5 days" />
            </Field>
            <Field label={`Pain level: ${symptoms.painLevel}/10`}>
              <input type="range" min="0" max="10" value={symptoms.painLevel} onChange={(e) => setSymptoms({ ...symptoms, painLevel: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Existing conditions">
            <input value={symptoms.existingConditions} onChange={(e) => setSymptoms({ ...symptoms, existingConditions: e.target.value })} placeholder="Asthma, type 2 diabetes" />
          </Field>
          <div className="field-row">
            <Field label="Medication you take now">
              <input value={symptoms.currentMedication} onChange={(e) => setSymptoms({ ...symptoms, currentMedication: e.target.value })} placeholder="Metformin 500mg" />
            </Field>
            <Field label="Allergies">
              <input value={symptoms.allergies} onChange={(e) => setSymptoms({ ...symptoms, allergies: e.target.value })} placeholder="Penicillin" />
            </Field>
          </div>
          <div className="btn-row">
            <button className="btn" disabled={busy}>{busy ? 'Confirming' : 'Confirm appointment'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setHold(null)} disabled={busy}>Back to slots</button>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            Confirming books the slot, emails both of you, and adds the visit to any connected Google Calendar.
          </p>
        </form>
      </>
    );
  }

  /* --------------------- steps 1 and 2: doctor + slot --------------------- */
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Step {selectedDoctor ? '2' : '1'} of 3 · {selectedDoctor ? 'choose a time' : 'choose a doctor'}</div>
          <h1>Book an appointment</h1>
        </div>
      </div>

      <Alert kind="error">{error}</Alert>
      <Alert kind="ok">{notice}</Alert>

      <div className="split">
        <section>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="field-row">
              <Field label="Specialisation">
                <select value={filters.specialisation} onChange={(e) => setFilters({ ...filters, specialisation: e.target.value })}>
                  <option value="all">All specialisations</option>
                  {specialisations.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Search by name">
                <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Dr Rao" />
              </Field>
            </div>
          </div>

          {doctors.length === 0 ? (
            <Empty title="No doctors match">Try a different specialisation.</Empty>
          ) : (
            <div className="list">
              {doctors.map((d) => {
                const active = selectedDoctor?._id === d._id;
                return (
                  <article key={d._id} className="card card-tight" style={active ? { borderColor: 'var(--teal)', background: 'var(--teal-wash)' } : undefined}>
                    <div className="appt-row">
                      <div>
                        <h3 style={{ margin: 0 }}>{d.user.name}</h3>
                        <div className="appt-meta">{d.specialisation}{d.qualification ? ` · ${d.qualification}` : ''}</div>
                        <div className="small muted" style={{ marginTop: 4 }}>
                          {d.experienceYears} yrs · {d.slotDurationMinutes} min slots · fee {d.consultationFee}
                        </div>
                      </div>
                      <button className={`btn btn-sm ${active ? '' : 'btn-ghost'}`} onClick={() => setSelectedDoctor(d)}>
                        {active ? 'Selected' : 'See times'}
                      </button>
                    </div>
                    {d.bio && <p className="small muted" style={{ margin: '8px 0 0' }}>{d.bio}</p>}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="card" style={{ position: 'sticky', top: 78 }}>
          {!selectedDoctor ? (
            <Empty title="Pick a doctor">Their open slots appear here.</Empty>
          ) : (
            <>
              <div className="eyebrow">{selectedDoctor.user.name}</div>
              <h3>{fmtDate(`${date}T12:00:00`)}</h3>

              <Field label="Date">
                <input type="date" min={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>

              <p className="small muted mono">
                works: {[...new Set(selectedDoctor.workingHours.map((w) => DAYS[w.dayOfWeek].slice(0, 3)))].join(' ') || 'not set'}
              </p>

              {!availability ? <Loading label="Checking availability" /> : availability.onLeave ? (
                <Alert kind="info">On leave this day: {availability.reason}</Alert>
              ) : availability.slots.length === 0 ? (
                <Alert kind="info">{availability.reason || 'No slots on this date.'}</Alert>
              ) : (
                <>
                  <div className="slots">
                    {availability.slots.map((s) => (
                      <button key={s.startTime} className="slot" disabled={!s.available}
                        aria-pressed={slot === s.startTime}
                        title={s.available ? 'Available' : s.reason === 'booked' ? 'Already booked' : 'Time has passed'}
                        onClick={() => setSlot(s.startTime)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <button className="btn" style={{ width: '100%', marginTop: 14 }} disabled={!slot || busy} onClick={reserve}>
                    {busy ? 'Holding slot' : slot ? 'Hold this slot' : 'Select a time'}
                  </button>
                  <p className="hint">Holding reserves the slot while you fill the symptom form. Nobody else can take it in the meantime.</p>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
