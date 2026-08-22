import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Loading } from '../components/ui.jsx';

const RESULTS = {
  connected: ['ok', 'Google Calendar connected. New bookings will appear in your calendar.'],
  denied: ['error', 'You declined the permission, so no calendar events will be created.'],
  failed: ['error', 'Google rejected the connection. Check the client credentials and try again.'],
  invalid: ['error', 'That callback was incomplete. Start the connection again.'],
};

export default function CalendarSettings() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const result = RESULTS[params.get('status')];
  const load = () => api('/calendar/status').then(setState).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function connect() {
    setBusy(true); setError('');
    try {
      const { url } = await api('/calendar/connect', { method: 'POST' });
      window.location.href = url;
    } catch (err) { setError(err.message); setBusy(false); }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await api('/calendar/disconnect', { method: 'POST' });
      setParams({});
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (!state) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Google Calendar Integration</h1>
          <p>Keep your schedule perfectly synced across platforms without any manual data entry.</p>
        </div>
      </div>

      {result && <Alert kind={result[0]}>{result[1]}</Alert>}
      <Alert kind="error">{error}</Alert>

      <div className="dashboard-grid">
        {/* Main Column: Feature Breakdown */}
        <section>
          <div className="card">
            <h2 className="section-title">Why connect your calendar?</h2>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <li style={{ padding: '20px', border: '1px solid var(--line)', borderRadius: '12px', background: 'var(--paper)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔄</span> Automatic Sync
                </h3>
                <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: '0.95rem' }}>
                  Every appointment you book or accept is instantly and automatically added to your personal or professional Google Calendar.
                </p>
              </li>
              
              <li style={{ padding: '20px', border: '1px solid var(--line)', borderRadius: '12px', background: 'var(--paper)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⏱️</span> Real-time Updates
                </h3>
                <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: '0.95rem' }}>
                  If a consultation is rescheduled or cancelled by either party, your calendar is automatically updated to reflect the change immediately.
                </p>
              </li>

              <li style={{ padding: '20px', border: '1px solid var(--line)', borderRadius: '12px', background: 'var(--paper)' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🔒</span> Privacy First
                </h3>
                <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: '0.95rem' }}>
                  We only request permission to manage events created directly by this clinic application. Your other private events remain completely untouched and unseen.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* Side Column: Connection Action */}
        <aside>
          <div className="card" style={!state.connected ? { background: 'var(--teal-wash)', borderColor: 'var(--teal)' } : {}}>
            {!state.configured ? (
              <Alert kind="info">
                This server has no Google credentials configured, so calendar sync is switched off. Everything else works normally.
              </Alert>
            ) : state.connected ? (
              <>
                <div className="eyebrow" style={{ color: 'var(--triage-low)', fontWeight: 600 }}>● Active Connection</div>
                <h2 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>{state.googleEmail || 'Your Google Account'}</h2>
                <p className="small muted" style={{ marginBottom: '24px' }}>
                  Linked securely on {new Date(state.connectedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
                </p>
                <button className="btn btn-ghost btn-full" onClick={disconnect} disabled={busy}>
                  {busy ? 'Disconnecting...' : 'Disconnect Calendar'}
                </button>
              </>
            ) : (
              <>
                <div className="eyebrow" style={{ color: 'var(--teal-dark)' }}>Not connected</div>
                <h2 style={{ color: 'var(--teal-dark)', fontSize: '1.3rem', marginBottom: '12px' }}>Link Your Account</h2>
                <p className="small" style={{ color: 'var(--teal-dark)', marginBottom: '24px' }}>
                  You will be securely redirected to Google to authorize the connection. You can revoke this access at any time.
                </p>
                <button className="btn btn-full" onClick={connect} disabled={busy}>
                  {busy ? 'Opening Google...' : 'Connect Google Calendar'}
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}