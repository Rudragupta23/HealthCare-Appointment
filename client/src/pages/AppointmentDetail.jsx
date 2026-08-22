import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { Alert, Field, Loading, Triage, fmtDateTime } from '../components/ui.jsx';

const blankMed = { medicine: '', dosage: '', timesPerDay: 2, durationDays: 5, instructions: '' };

export default function AppointmentDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [appt, setAppt] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(params.get('booked') ? 'Appointment confirmed. Check your inbox for the confirmation.' : '');
  const [notes, setNotes] = useState({ diagnosis: '', clinicalNotes: '', followUpDate: '' });
  const [meds, setMeds] = useState([{ ...blankMed }]);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api(`/appointments/${id}`);
      setAppt(data.appointment);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [id]);

  if (error && !appt) return <Alert kind="error">{error}</Alert>;
  if (!appt) return <Loading />;

  const isDoctor = user.role === 'doctor';
  const pre = appt.preVisitSummary || {};
  const post = appt.postVisit || {};

  async function submitNotes(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await api(`/appointments/${id}/post-visit`, {
        method: 'POST',
        body: { ...notes, prescriptions: meds.filter((m) => m.medicine.trim()) },
      });
      setMessage(res.message);
      setAppt(res.appointment);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{appt.status.replace('_', ' ')} · {appt.doctorProfile?.specialisation}</div>
          <h1>{fmtDateTime(appt.startTime)}</h1>
          <p>
            {isDoctor ? `Patient: ${appt.patient?.name}` : `Doctor: ${appt.doctor?.name}`}
            {appt.doctorProfile?.room ? ` · Room ${appt.doctorProfile.room}` : ''}
          </p>
        </div>
        <Link className="btn btn-ghost" to="/">Back to Dashboard</Link>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      <div className="dashboard-grid">
        <section className="list">
          {/* pre-visit triage */}
          <article className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid var(--line)', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0 }}>Pre-visit Summary</h2>
              <Triage level={pre.urgency || 'Unknown'} />
            </div>

            {pre.source === 'pending' || !pre.chiefComplaint ? (
              <p className="muted">No symptom form was submitted for this appointment.</p>
            ) : (
              <>
                <div style={{ background: 'var(--paper)', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                  <p style={{ margin: 0 }}><strong>Chief complaint:</strong> {pre.chiefComplaint}</p>
                </div>
                
                {pre.suggestedQuestions?.length > 0 && (
                  <>
                    <h3 style={{ fontSize: '1rem', marginTop: '20px', color: 'var(--ink-soft)' }}>Questions to ask</h3>
                    <ul style={{ paddingLeft: 20, margin: '8px 0 0', color: 'var(--ink)' }}>
                      {pre.suggestedQuestions.map((q, i) => <li key={i} style={{ marginBottom: 8 }}>{q}</li>)}
                    </ul>
                  </>
                )}
                {pre.source === 'fallback' && (
                  <p className="hint" style={{ marginTop: 16 }}>
                    Written by the built-in rule-based summariser because the AI service was unavailable
                    {pre.error ? ` (${pre.error})` : ''}. Read the patient's own words below.
                  </p>
                )}
              </>
            )}
          </article>

          {/* raw symptom form - doctors only */}
          {isDoctor && appt.symptomForm?.description && (
            <article className="card">
              <h2 className="section-title">Patient's Own Words</h2>
              <p className="prose" style={{ background: 'var(--paper)', padding: '16px', borderRadius: '12px' }}>"{appt.symptomForm.description}"</p>
              
              <table className="data" style={{ marginTop: '16px' }}>
                <tbody>
                  <tr><th>Duration</th><td>{appt.symptomForm.durationOfSymptoms || '-'}</td></tr>
                  <tr><th>Pain Level</th><td><span style={{ background: 'var(--line)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{appt.symptomForm.painLevel}/10</span></td></tr>
                  <tr><th>Conditions</th><td>{appt.symptomForm.existingConditions || '-'}</td></tr>
                  <tr><th>Medication</th><td>{appt.symptomForm.currentMedication || '-'}</td></tr>
                  <tr><th>Allergies</th><td style={{ color: appt.symptomForm.allergies ? 'var(--triage-high)' : 'inherit', fontWeight: appt.symptomForm.allergies ? 600 : 400 }}>{appt.symptomForm.allergies || '-'}</td></tr>
                </tbody>
              </table>
            </article>
          )}

          {/* post-visit */}
          {appt.status === 'completed' ? (
            <article className="card">
              <h2 className="section-title">Post-Visit Summary</h2>
              
              {post.diagnosis && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Diagnosis</h3>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: '1.1rem' }}>{post.diagnosis}</p>
                </div>
              )}
              
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Summary</h3>
                <p className="prose" style={{ margin: 0 }}>{post.patientSummary}</p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Medication Schedule</h3>
                <p className="prose" style={{ margin: 0, background: 'var(--paper)', padding: '16px', borderRadius: '12px' }}>{post.medicationSchedule}</p>
              </div>

              {post.followUpSteps?.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Next Steps</h3>
                  <ul style={{ paddingLeft: 20, margin: '6px 0 0' }}>
                    {post.followUpSteps.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
                  </ul>
                </div>
              )}
              {post.source === 'fallback' && <p className="hint" style={{ marginTop: 24 }}>Generated without the AI service; this is the doctor's note reformatted.</p>}
            </article>
          ) : isDoctor && appt.status === 'booked' ? (
            <article className="card">
              <h2 className="section-title">Close Consultation</h2>
              <form onSubmit={submitNotes}>
                <Field label="Diagnosis">
                  <input value={notes.diagnosis} onChange={(e) => setNotes({ ...notes, diagnosis: e.target.value })} placeholder="Acute bronchitis" />
                </Field>
                <Field label="Clinical notes" hint="Written for the record. The patient receives a plain-language version, not this exact text.">
                  <textarea required minLength={10} value={notes.clinicalNotes} onChange={(e) => setNotes({ ...notes, clinicalNotes: e.target.value })} />
                </Field>
                <Field label="Follow-up date">
                  <input type="date" value={notes.followUpDate} onChange={(e) => setNotes({ ...notes, followUpDate: e.target.value })} />
                </Field>

                <h3 style={{ fontSize: '1rem', margin: '24px 0 8px 0' }}>Prescription</h3>
                <p className="hint" style={{ marginTop: 0, marginBottom: '16px' }}>Each line becomes scheduled reminder emails for the patient.</p>
                {meds.map((m, i) => (
                  <div key={i} style={{ marginBottom: 16, padding: '16px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                    <div className="field-row">
                      <Field label="Medicine"><input value={m.medicine} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, medicine: e.target.value } : x)))} placeholder="Amoxicillin" /></Field>
                      <Field label="Dosage"><input value={m.dosage} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, dosage: e.target.value } : x)))} placeholder="500 mg" /></Field>
                    </div>
                    <div className="field-row">
                      <Field label="Times a day"><input type="number" min="1" max="6" value={m.timesPerDay} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, timesPerDay: Number(e.target.value) } : x)))} /></Field>
                      <Field label="For how many days"><input type="number" min="1" max="180" value={m.durationDays} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, durationDays: Number(e.target.value) } : x)))} /></Field>
                      <Field label="Instructions"><input value={m.instructions} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)))} placeholder="after food" /></Field>
                    </div>
                    {meds.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMeds(meds.filter((_, j) => j !== i))}>Remove Medicine</button>}
                  </div>
                ))}
                <div className="btn-row">
                  <button type="button" className="btn btn-ghost btn-sm btn-full" onClick={() => setMeds([...meds, { ...blankMed }])}>+ Add another medicine</button>
                </div>

                <div className="divider" style={{ margin: '24px 0' }} />
                <button className="btn btn-full" disabled={busy}>{busy ? 'Saving...' : 'Complete Visit & Send Summary'}</button>
              </form>
            </article>
          ) : null}
        </section>

        <aside className="list">
          <div className="card card-tight">
            <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Event Record</h2>
            <table className="data">
              <tbody>
                <tr><th>Status</th><td><span className="tag">{appt.status.replace('_', ' ')}</span></td></tr>
                <tr><th>Starts</th><td className="mono">{fmtDateTime(appt.startTime)}</td></tr>
                <tr><th>Ends</th><td className="mono">{fmtDateTime(appt.endTime)}</td></tr>
                <tr><th>Calendar</th><td>{appt.calendar?.status || 'none'}</td></tr>
                <tr><th>AI summary</th><td>{pre.source === 'llm' ? `model (${pre.model})` : pre.source}</td></tr>
                {appt.cancellationReason && <tr><th>Cancelled</th><td style={{ color: 'var(--triage-high)', fontWeight: 600 }}>{appt.cancellationReason}</td></tr>}
              </tbody>
            </table>
          </div>

          {appt.prescriptions?.length > 0 && (
            <div className="card card-tight">
              <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Active Prescriptions</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="small">
                {appt.prescriptions.map((p, i) => (
                  <li key={i} style={{ padding: '8px 0', borderBottom: i === appt.prescriptions.length - 1 ? 'none' : '1px solid var(--line)' }}>
                    <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--ink)' }}>{p.medicine} {p.dosage}</strong>
                    <span className="muted">{p.timesPerDay}×/day for {p.durationDays} days</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}