import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, Loading, fmtDateTime } from '../components/ui.jsx';

export default function AdminNotifications() {
  const [jobs, setJobs] = useState(null);
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setJobs(null);
    api(`/admin/emails${status ? `?status=${status}` : ''}`).then((d) => setJobs(d.jobs)).catch((e) => setError(e.message));
  };
  useEffect(load, [status]);

  async function retry(id) {
    try {
      const res = await api(`/admin/emails/${id}/retry`, { method: 'POST' });
      setMessage(`${res.message}: ${res.result.sent} sent of ${res.result.processed} processed.`);
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Notifications</h1>
          <p>Every email is queued before it is sent, so a failed delivery can be inspected and retried instead of vanishing.</p>
        </div>
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      {!jobs ? <Loading /> : (
        <div className="card scroll-x">
          <table className="data">
            <thead>
              <tr><th>Created</th><th>To</th><th>Type</th><th>Subject</th><th>Status</th><th>Tries</th><th>Last error</th><th /></tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j._id}>
                  <td className="mono small">{fmtDateTime(j.createdAt)}</td>
                  <td className="small">{j.to}</td>
                  <td className="small muted">{j.type}</td>
                  <td className="small">{j.subject}</td>
                  <td style={{ color: j.status === 'failed' ? 'var(--triage-high)' : undefined }}>{j.status}</td>
                  <td className="mono">{j.attempts}</td>
                  <td className="small muted" style={{ maxWidth: 240 }}>{j.lastError || '-'}</td>
                  <td>{j.status !== 'sent' && <button className="btn btn-ghost btn-sm" onClick={() => retry(j._id)}>Retry</button>}</td>
                </tr>
              ))}
              {jobs.length === 0 && <tr><td colSpan="8" className="muted">No emails yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
