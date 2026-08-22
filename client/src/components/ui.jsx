import { useEffect, useState } from 'react';

export function Alert({ kind = 'info', children }) {
  if (!children) return null;
  
  const icons = {
    info: 'ℹ️',
    error: '⚠️',
    ok: '✅'
  };

  return (
    <div className={`alert alert-${kind}`} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{icons[kind]}</span>
      <div style={{ flex: 1, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export function Field({ label, hint, children, style }) {
  return (
    <div className="field" style={style}>
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      <div style={{ 
        background: 'var(--surface)', 
        width: '64px', height: '64px', 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '50%', fontSize: '1.8rem', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)' 
      }}>
        📭
      </div>
      <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{title}</h3>
      <p style={{ margin: 0, maxWidth: '40ch' }}>{children}</p>
    </div>
  );
}

export function Triage({ level = 'Unknown' }) {
  return <span className="triage" data-level={level}>{level === 'Unknown' ? 'Not triaged' : `${level} Urgency`}</span>;
}

export function Loading({ label = 'Loading' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px 0', color: 'var(--teal)' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      <span className="mono small" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}...</span>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
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
  return (
    <span className="countdown" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      ⏳ <span>Slot reserved: <strong>{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</strong></span>
    </span>
  );
}

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

export const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

export const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

export const todayKey = () => new Date().toLocaleDateString('en-CA');

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];