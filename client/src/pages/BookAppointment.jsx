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

  /* step 3: symptoms */
  if (hold) {
    return (
      <>
        <div className="page-head" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow">Step 3 of 3 · Pre-visit Form</div>
            <h1>Describe your symptoms</h1>
            <p>This is securely summarized and triaged for {selectedDoctor.user.name} before your visit.</p>
          </div>
          <div className="card card-tight" style={{ background: 'var(--teal-wash)', borderColor: 'var(--teal)', display: 'inline-block' }}>
            <HoldTimer expiresAt={hold.holdExpiresAt} onExpire={() => { setHold(null); setError('Your hold expired and the slot was released. Please choose a slot again.'); }} />
          </div>
        </div>

        <Alert kind="error">{error}</Alert>

        <form className="card" onSubmit={confirm} style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 className="section-title">Medical Context</h2>
          <Field label="What is the primary reason for your visit?" hint="Plain language is fine. Ten characters minimum.">
            <textarea required minLength={10} value={symptoms.description} onChange={(e) => setSymptoms({ ...symptoms, description: e.target.value })}
              placeholder="Dry cough for five days, worse at night, mild fever since Tuesday." style={{ minHeight: '120px' }} />
          </Field>
          <div className="field-row">
            <Field label="How long has this been going on?">
              <input value={symptoms.durationOfSymptoms} onChange={(e) => setSymptoms({ ...symptoms, durationOfSymptoms: e.target.value })} placeholder="e.g., 5 days" />
            </Field>
            <Field label={`Pain level: ${symptoms.painLevel}/10`}>
              <input type="range" min="0" max="10" value={symptoms.painLevel} onChange={(e) => setSymptoms({ ...symptoms, painLevel: Number(e.target.value) })} style={{ accentColor: 'var(--teal)' }} />
            </Field>
          </div>
          
          <div className="divider" style={{ margin: '24px 0' }} />
          <h2 className="section-title">History & Allergies</h2>
          
          <Field label="Existing conditions">
            <input value={symptoms.existingConditions} onChange={(e) => setSymptoms({ ...symptoms, existingConditions: e.target.value })} placeholder="e.g., Asthma, type 2 diabetes" />
          </Field>
          <div className="field-row">
            <Field label="Medication you currently take">
              <input value={symptoms.currentMedication} onChange={(e) => setSymptoms({ ...symptoms, currentMedication: e.target.value })} placeholder="e.g., Metformin 500mg" />
            </Field>
            <Field label="Allergies">
              <input value={symptoms.allergies} onChange={(e) => setSymptoms({ ...symptoms, allergies: e.target.value })} placeholder="e.g., Penicillin" />
            </Field>
          </div>
          
          <div className="divider" style={{ margin: '24px 0' }} />
          
          <div className="btn-row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setHold(null)} disabled={busy}>Cancel & Release Slot</button>
            <button className="btn" disabled={busy} style={{ minWidth: '200px' }}>{busy ? 'Confirming...' : 'Confirm Appointment'}</button>
          </div>
          <p className="hint" style={{ marginTop: 16, textAlign: 'right' }}>
            Confirming automatically emails both parties and updates your calendar.
          </p>
        </form>
      </>
    );
  }

  /* steps 1 and 2: doctor + slot */
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Step {selectedDoctor ? '2' : '1'} of 3 · {selectedDoctor ? 'Select a time' : 'Find a specialist'}</div>
          <h1>Book an Appointment</h1>
        </div>
      </div>

      <Alert kind="error">{error}</Alert>
      <Alert kind="ok">{notice}</Alert>

      <div className="dashboard-grid">
        <section>
          <div className="card" style={{ marginBottom: '24px', background: 'var(--paper)', border: 'none' }}>
            <div className="field-row" style={{ alignItems: 'end' }}>
              <Field label="Filter by Specialisation" style={{ marginBottom: 0 }}>
                <select value={filters.specialisation} onChange={(e) => setFilters({ ...filters, specialisation: e.target.value })} style={{ border: '1px solid var(--line)' }}>
                  <option value="all">All specialisations</option>
                  {specialisations.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Search by Name" style={{ marginBottom: 0 }}>
                <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="e.g., Dr Rao" style={{ border: '1px solid var(--line)' }} />
              </Field>
            </div>
          </div>

          <h2 className="section-title">Available Doctors</h2>
          {doctors.length === 0 ? (
            <Empty title="No doctors match your criteria">Try adjusting your search or specialisation filter.</Empty>
          ) : (
            <div className="list">
              {doctors.map((d) => {
                const active = selectedDoctor?._id === d._id;
                return (
                  <article key={d._id} className="card card-tight" style={active ? { borderColor: 'var(--teal)', background: 'var(--teal-wash)', borderLeft: '4px solid var(--teal)' } : { borderLeft: '4px solid transparent' }}>
                    <div className="appt-row">
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: active ? 'var(--teal-dark)' : 'var(--ink)' }}>{d.user.name}</h3>
                        <div className="appt-meta" style={{ marginTop: '4px' }}>{d.specialisation}{d.qualification ? ` · ${d.qualification}` : ''}</div>
                        <div className="small muted" style={{ marginTop: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{d.experienceYears} yrs experience</span> · {d.slotDurationMinutes} min slots · fee ${d.consultationFee}
                        </div>
                      </div>
                      <button className={`btn btn-sm ${active ? '' : 'btn-ghost'}`} onClick={() => setSelectedDoctor(d)}>
                        {active ? 'Selected' : 'View Schedule'}
                      </button>
                    </div>
                    {d.bio && <p className="small muted" style={{ margin: '12px 0 0', padding: '8px 12px', background: active ? 'rgba(255,255,255,0.5)' : 'var(--paper)', borderRadius: '8px' }}>"{d.bio}"</p>}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside>
          <div className="card" style={{ position: 'sticky', top: 90 }}>
            {!selectedDoctor ? (
              <Empty title="Select a specialist">Their available calendar slots will appear here.</Empty>
            ) : (
              <>
                <h2 className="section-title" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{selectedDoctor.user.name}'s Calendar</h2>
                <h3 style={{ color: 'var(--teal)', fontSize: '1.1rem', marginBottom: '20px' }}>{fmtDate(`${date}T12:00:00`)}</h3>

                <Field label="Select Date">
                  <input type="date" min={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>

                <div style={{ padding: '12px', background: 'var(--paper)', borderRadius: '8px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Standard Hours: </span>
                  <span className="small mono" style={{ color: 'var(--ink)' }}>
                    {[...new Set(selectedDoctor.workingHours.map((w) => DAYS[w.dayOfWeek].slice(0, 3)))].join(' ') || 'Not set'}
                  </span>
                </div>

                <div className="divider" style={{ margin: '20px 0' }} />

                {!availability ? <Loading label="Checking availability" /> : availability.onLeave ? (
                  <Alert kind="info">Doctor is on leave this day: {availability.reason}</Alert>
                ) : availability.slots.length === 0 ? (
                  <Alert kind="info">{availability.reason || 'No available slots on this date.'}</Alert>
                ) : (
                  <>
                    <div className="slots" style={{ marginBottom: '24px' }}>
                      {availability.slots.map((s) => (
                        <button key={s.startTime} className="slot" disabled={!s.available}
                          aria-pressed={slot === s.startTime}
                          title={s.available ? 'Available' : s.reason === 'booked' ? 'Already booked' : 'Time has passed'}
                          onClick={() => setSlot(s.startTime)}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-full" disabled={!slot || busy} onClick={reserve}>
                      {busy ? 'Holding slot...' : slot ? 'Hold Selected Slot' : 'Select a time above'}
                    </button>
                    <p className="hint" style={{ textAlign: 'center', marginTop: '12px' }}>Holding temporarily reserves the slot so nobody else can take it while you fill out your symptoms.</p>
                  </>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}