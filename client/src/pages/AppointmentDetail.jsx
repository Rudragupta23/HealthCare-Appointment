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
        <Link className="btn btn-ghost" to="/">Back</Link>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      <div className="split">
        <section className="list">
          {/* pre-visit triage */}
          <article className="card">
            <div className="card-head">
              <div>
                <div className="eyebrow">Before the visit</div>
                <h2>Pre-visit summary</h2>
              </div>
              <Triage level={pre.urgency || 'Unknown'} />
            </div>

            {pre.source === 'pending' || !pre.chiefComplaint ? (
              <p className="muted">No symptom form was submitted for this appointment.</p>
            ) : (
              <>
                <p><strong>Chief complaint.</strong> {pre.chiefComplaint}</p>
                {pre.suggestedQuestions?.length > 0 && (
                  <>
                    <div className="eyebrow" style={{ marginTop: 16 }}>Questions to ask</div>
                    <ol style={{ paddingLeft: 20, margin: '6px 0 0' }}>
                      {pre.suggestedQuestions.map((q, i) => <li key={i} style={{ marginBottom: 6 }}>{q}</li>)}
                    </ol>
                  </>
                )}
                {pre.source === 'fallback' && (
                  <p className="hint" style={{ marginTop: 14 }}>
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
              <div className="eyebrow">In the patient's words</div>
              <p className="prose">{appt.symptomForm.description}</p>
              <table className="data">
                <tbody>
                  <tr><th>Duration</th><td>{appt.symptomForm.durationOfSymptoms || '-'}</td></tr>
                  <tr><th>Pain</th><td>{appt.symptomForm.painLevel}/10</td></tr>
                  <tr><th>Conditions</th><td>{appt.symptomForm.existingConditions || '-'}</td></tr>
                  <tr><th>Medication</th><td>{appt.symptomForm.currentMedication || '-'}</td></tr>
                  <tr><th>Allergies</th><td>{appt.symptomForm.allergies || '-'}</td></tr>
                </tbody>
              </table>
            </article>
          )}

          {/* post-visit */}
          {appt.status === 'completed' ? (
            <article className="card">
              <div className="eyebrow">After the visit</div>
              <h2>Your summary</h2>
              {post.diagnosis && <p><strong>Diagnosis.</strong> {post.diagnosis}</p>}
              <p className="prose">{post.patientSummary}</p>

              <div className="eyebrow" style={{ marginTop: 18 }}>Medication schedule</div>
              <p className="prose">{post.medicationSchedule}</p>

              {post.followUpSteps?.length > 0 && (
                <>
                  <div className="eyebrow" style={{ marginTop: 18 }}>Next steps</div>
                  <ul style={{ paddingLeft: 20, margin: '6px 0 0' }}>
                    {post.followUpSteps.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}
                  </ul>
                </>
              )}
              {post.source === 'fallback' && <p className="hint" style={{ marginTop: 14 }}>Generated without the AI service; this is the doctor's note reformatted.</p>}
            </article>
          ) : isDoctor && appt.status === 'booked' ? (
            <article className="card">
              <div className="eyebrow">After the visit</div>
              <h2>Close the consultation</h2>
              <form onSubmit={submitNotes}>
                <Field label="Diagnosis">
                  <input value={notes.diagnosis} onChange={(e) => setNotes({ ...notes, diagnosis: e.target.value })} placeholder="Acute bronchitis" />
                </Field>
                <Field label="Clinical notes" hint="Written for the record. The patient receives a plain-language version, not this text.">
                  <textarea required minLength={10} value={notes.clinicalNotes} onChange={(e) => setNotes({ ...notes, clinicalNotes: e.target.value })} />
                </Field>
                <Field label="Follow-up date">
                  <input type="date" value={notes.followUpDate} onChange={(e) => setNotes({ ...notes, followUpDate: e.target.value })} />
                </Field>

                <div className="eyebrow" style={{ marginTop: 18 }}>Prescription</div>
                <p className="hint" style={{ marginTop: 0 }}>Each line becomes scheduled reminder emails for the patient.</p>
                {meds.map((m, i) => (
                  <div key={i} className="card card-tight" style={{ marginBottom: 10, background: '#fbfcfc' }}>
                    <div className="field-row">
                      <Field label="Medicine"><input value={m.medicine} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, medicine: e.target.value } : x)))} placeholder="Amoxicillin" /></Field>
                      <Field label="Dosage"><input value={m.dosage} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, dosage: e.target.value } : x)))} placeholder="500 mg" /></Field>
                    </div>
                    <div className="field-row">
                      <Field label="Times a day"><input type="number" min="1" max="6" value={m.timesPerDay} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, timesPerDay: Number(e.target.value) } : x)))} /></Field>
                      <Field label="For how many days"><input type="number" min="1" max="180" value={m.durationDays} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, durationDays: Number(e.target.value) } : x)))} /></Field>
                      <Field label="Instructions"><input value={m.instructions} onChange={(e) => setMeds(meds.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)))} placeholder="after food" /></Field>
                    </div>
                    {meds.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMeds(meds.filter((_, j) => j !== i))}>Remove</button>}
                  </div>
                ))}
                <div className="btn-row">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMeds([...meds, { ...blankMed }])}>Add another medicine</button>
                </div>

                <div className="divider" />
                <button className="btn" disabled={busy}>{busy ? 'Saving' : 'Complete visit and send summary'}</button>
              </form>
            </article>
          ) : null}
        </section>

        <aside className="card">
          <div className="eyebrow">Record</div>
          <table className="data">
            <tbody>
              <tr><th>Status</th><td>{appt.status.replace('_', ' ')}</td></tr>
              <tr><th>Starts</th><td>{fmtDateTime(appt.startTime)}</td></tr>
              <tr><th>Ends</th><td>{fmtDateTime(appt.endTime)}</td></tr>
              <tr><th>Calendar</th><td>{appt.calendar?.status || 'none'}</td></tr>
              <tr><th>AI summary</th><td>{pre.source === 'llm' ? `model (${pre.model})` : pre.source}</td></tr>
              {appt.cancellationReason && <tr><th>Cancelled</th><td>{appt.cancellationReason}</td></tr>}
            </tbody>
          </table>

          {appt.prescriptions?.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 18 }}>Prescribed</div>
              <ul style={{ paddingLeft: 18, margin: '6px 0 0' }} className="small">
                {appt.prescriptions.map((p, i) => (
                  <li key={i}>{p.medicine} {p.dosage} — {p.timesPerDay}×/day, {p.durationDays} days</li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
