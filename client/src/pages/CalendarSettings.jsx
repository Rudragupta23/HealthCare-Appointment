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
          <h1>Google Calendar</h1>
          <p>Connect your calendar and every appointment is added automatically, moved when it is rescheduled, and removed when it is cancelled.</p>
        </div>
      </div>

      {result && <Alert kind={result[0]}>{result[1]}</Alert>}
      <Alert kind="error">{error}</Alert>

      <div className="card" style={{ maxWidth: 560 }}>
        {!state.configured ? (
          <Alert kind="info">
            This server has no Google credentials configured, so calendar sync is switched off. Everything else works normally.
          </Alert>
        ) : state.connected ? (
          <>
            <div className="eyebrow">Connected</div>
            <h2>{state.googleEmail || 'Your Google account'}</h2>
            <p className="small muted">Linked {new Date(state.connectedAt).toLocaleString('en-GB')}.</p>
            <button className="btn btn-ghost" onClick={disconnect} disabled={busy}>Disconnect</button>
          </>
        ) : (
          <>
            <div className="eyebrow">Not connected</div>
            <h2>Add appointments to your calendar</h2>
            <p className="small muted">You will be asked to allow the clinic to create and manage events. You can disconnect at any time.</p>
            <button className="btn" onClick={connect} disabled={busy}>{busy ? 'Opening Google' : 'Connect Google Calendar'}</button>
          </>
        )}
      </div>
    </>
  );
}
