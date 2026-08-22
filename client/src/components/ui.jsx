import { useEffect, useState } from 'react';

export function Alert({ kind = 'info', children }) {
  if (!children) return null;
  return <div className={`alert alert-${kind}`}>{children}</div>;
}

export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p style={{ margin: 0 }}>{children}</p>
    </div>
  );
}

export function Triage({ level = 'Unknown' }) {
  return <span className="triage" data-level={level}>{level === 'Unknown' ? 'not triaged' : `${level} urgency`}</span>;
}

export function Loading({ label = 'Loading' }) {
  return <p className="muted mono small">{label}...</p>;
}

/** Counts down a slot hold so the patient can see the time they have left. */
export function HoldTimer({ expiresAt, onExpire }) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(expiresAt) - Date.now()));
  useEffect(() => {
    const id = setInterval(() => {
      const ms = Math.max(0, new Date(expiresAt) - Date.now());
      setLeft(ms);
      if (ms === 0) { clearInterval(id); onExpire?.(); }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return <span className="countdown">slot held {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>;
}

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

export const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

export const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

export const todayKey = () => new Date().toLocaleDateString('en-CA');

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
