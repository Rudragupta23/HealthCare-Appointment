import { config } from '../config/env.js';

/**
 * Provider-agnostic LLM client.
 *
 * Design rules (see SYSTEM_DESIGN.md):
 *  - every call is time-boxed with AbortController
 *  - transient failures retry with backoff
 *  - a permanent failure NEVER throws to the caller; a deterministic
 *    rule-based fallback summary is returned instead and the reason is
 *    stored on the appointment so staff know the text was not AI-generated.
 */

const PROMPTS = {
  preVisitSystem:
    'You are a clinical triage assistant supporting a doctor before a consultation. ' +
    'You never diagnose and never prescribe. Reply with raw JSON only - no markdown, no commentary.',
  preVisitUser: (symptoms) =>
    `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}\n\n` +
    'Return exactly this JSON shape:\n' +
    '{"urgency":"Low|Medium|High","chiefComplaint":"one short sentence","suggestedQuestions":["q1","q2","q3"]}',

  postVisitSystem:
    'You rewrite clinical notes for patients with no medical training. Use plain language, ' +
    'short sentences, and a warm, calm tone. Never invent medication or dosages that are not in the notes. ' +
    'Reply with raw JSON only - no markdown, no commentary.',
  postVisitUser: (notes, meds) =>
    `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notes}\n\n` +
    `Prescribed medication: ${meds || 'none'}\n\n` +
    'Return exactly this JSON shape:\n' +
    '{"patientSummary":"2-4 short paragraphs","medicationSchedule":"plain-text schedule","followUpSteps":["step1","step2"]}',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function providerRequest(prompt, systemPrompt) {
  const { provider, apiKey, model } = config.llm;

  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      options: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      },
      extract: (d) => (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
    };
  }

  if (provider === 'openai') {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      options: {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
        }),
      },
      extract: (d) => d.choices?.[0]?.message?.content || '',
    };
  }

  if (provider === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      options: {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      },
      extract: (d) => d.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || '',
    };
  }

  return null;
}

async function callLLM(prompt, systemPrompt) {
  const { provider, apiKey, timeoutMs, maxRetries } = config.llm;
  if (provider === 'none' || !apiKey) {
    throw new Error('LLM disabled (no provider or API key configured)');
  }
  const req = providerRequest(prompt, systemPrompt);
  if (!req) throw new Error(`Unknown LLM_PROVIDER "${provider}"`);

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(req.url, { ...req.options, signal: controller.signal });
      if (!res.ok) {
        const body = await res.text();
        // 4xx other than rate limiting will not fix itself - stop retrying
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw Object.assign(new Error(`LLM ${res.status}: ${body.slice(0, 200)}`), { permanent: true });
        }
        throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      return req.extract(data);
    } catch (err) {
      lastError = err;
      if (err.permanent || attempt === maxRetries) break;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** Models sometimes wrap JSON in prose or code fences. Recover it. */
function parseJSON(text) {
  const cleaned = String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
    throw new Error('LLM response was not valid JSON');
  }
}

/* ------------------------------------------------------------------ */
/* Fallbacks - used whenever the LLM is unavailable                    */
/* ------------------------------------------------------------------ */

const RED_FLAGS = [
  'chest pain', 'breathless', 'shortness of breath', 'cannot breathe', 'unconscious',
  'fainting', 'seizure', 'stroke', 'severe bleeding', 'blood in stool', 'coughing blood',
  'suicidal', 'numbness on one side', 'slurred speech', 'severe abdominal pain',
];
const AMBER_FLAGS = ['fever', 'vomiting', 'dizziness', 'infection', 'swelling', 'rash', 'persistent', 'migraine', 'injury'];

function fallbackPreVisit(form) {
  const text = `${form.description || ''} ${form.existingConditions || ''}`.toLowerCase();
  let urgency = 'Low';
  if (AMBER_FLAGS.some((w) => text.includes(w)) || (form.painLevel || 0) >= 5) urgency = 'Medium';
  if (RED_FLAGS.some((w) => text.includes(w)) || (form.painLevel || 0) >= 8) urgency = 'High';

  const complaint = (form.description || 'No description provided').split(/[.!?\n]/)[0].slice(0, 140);
  return {
    urgency,
    chiefComplaint: complaint,
    suggestedQuestions: [
      `When did the symptoms start, and have they changed since? (patient reported: ${form.durationOfSymptoms || 'not stated'})`,
      `Any current medication or allergies to check? (patient reported: ${form.currentMedication || 'none'} / ${form.allergies || 'none'})`,
      `Pain rated ${form.painLevel ?? 'n/a'}/10 - what makes it better or worse?`,
    ],
  };
}

function fallbackPostVisit(notes, prescriptions) {
  const schedule = prescriptions.length
    ? prescriptions
        .map((p) => `${p.medicine}${p.dosage ? ` (${p.dosage})` : ''} - ${p.timesPerDay} time(s) a day for ${p.durationDays} day(s)${p.instructions ? `, ${p.instructions}` : ''}`)
        .join('\n')
    : 'No medication was prescribed at this visit.';

  return {
    patientSummary:
      `Here is a plain-language record of your visit.\n\n${notes}\n\n` +
      'If your symptoms get worse, or anything in this summary is unclear, contact the clinic.',
    medicationSchedule: schedule,
    followUpSteps: [
      'Take all medication exactly as listed above.',
      'Book a follow-up appointment if symptoms do not improve.',
      'Seek urgent care if symptoms become severe.',
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function generatePreVisitSummary(symptomForm) {
  const symptoms = [
    symptomForm.description,
    symptomForm.durationOfSymptoms && `Duration: ${symptomForm.durationOfSymptoms}`,
    `Pain level: ${symptomForm.painLevel ?? 0}/10`,
    symptomForm.existingConditions && `Existing conditions: ${symptomForm.existingConditions}`,
    symptomForm.currentMedication && `Current medication: ${symptomForm.currentMedication}`,
    symptomForm.allergies && `Allergies: ${symptomForm.allergies}`,
  ].filter(Boolean).join('. ');

  try {
    const raw = await callLLM(PROMPTS.preVisitUser(symptoms), PROMPTS.preVisitSystem);
    const parsed = parseJSON(raw);
    const urgency = ['Low', 'Medium', 'High'].includes(parsed.urgency) ? parsed.urgency : 'Medium';
    return {
      urgency,
      chiefComplaint: String(parsed.chiefComplaint || '').slice(0, 300),
      suggestedQuestions: (parsed.suggestedQuestions || []).slice(0, 3).map(String),
      raw,
      source: 'llm',
      model: config.llm.model,
      error: '',
      generatedAt: new Date(),
    };
  } catch (err) {
    console.warn('[llm] pre-visit summary fell back:', err.message);
    return { ...fallbackPreVisit(symptomForm), raw: '', source: 'fallback', model: '', error: err.message, generatedAt: new Date() };
  }
}

export async function generatePostVisitSummary({ clinicalNotes, diagnosis, prescriptions = [] }) {
  const notes = [diagnosis && `Diagnosis: ${diagnosis}`, clinicalNotes].filter(Boolean).join('. ');
  const meds = prescriptions
    .map((p) => `${p.medicine} ${p.dosage} - ${p.timesPerDay}x/day for ${p.durationDays} days ${p.instructions}`.trim())
    .join('; ');

  try {
    const raw = await callLLM(PROMPTS.postVisitUser(notes, meds), PROMPTS.postVisitSystem);
    const parsed = parseJSON(raw);
    return {
      patientSummary: String(parsed.patientSummary || '').slice(0, 4000),
      medicationSchedule: String(parsed.medicationSchedule || ''),
      followUpSteps: (parsed.followUpSteps || []).map(String).slice(0, 6),
      source: 'llm',
      model: config.llm.model,
      error: '',
      generatedAt: new Date(),
    };
  } catch (err) {
    console.warn('[llm] post-visit summary fell back:', err.message);
    return { ...fallbackPostVisit(notes, prescriptions), source: 'fallback', model: '', error: err.message, generatedAt: new Date() };
  }
}

export const llmPrompts = PROMPTS;
