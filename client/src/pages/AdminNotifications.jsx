import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Alert, Field, Loading, fmtDateTime } from '../components/ui.jsx';

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
          <div className="eyebrow">Admin Portal</div>
          <h1>System Notifications</h1>
          <p>Every email is queued before it is sent, allowing you to inspect and retry failed deliveries.</p>
        </div>
      </div>

      <Alert kind="ok">{message}</Alert>
      <Alert kind="error">{error}</Alert>

      <div className="dashboard-grid">
        <section>
          {!jobs ? <Loading /> : (
            <div className="card scroll-x" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data" style={{ margin: 0 }}>
                <thead style={{ background: 'var(--paper)' }}>
                  <tr>
                    <th style={{ paddingLeft: '24px' }}>Created</th>
                    <th>To</th>
                    <th>Type</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Tries</th>
                    <th>Last Error</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j._id}>
                      <td className="mono small" style={{ paddingLeft: '24px' }}>{fmtDateTime(j.createdAt)}</td>
                      <td className="small" style={{ fontWeight: 500 }}>{j.to}</td>
                      <td className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{j.type}</td>
                      <td className="small">{j.subject}</td>
                      <td>
                        <span className={`tag ${j.status === 'failed' ? 'tag-warn' : j.status === 'pending' ? 'tag-grey' : ''}`} style={{ color: j.status === 'failed' ? 'var(--triage-high)' : undefined }}>
                          {j.status}
                        </span>
                      </td>
                      <td className="mono">{j.attempts}</td>
                      <td className="small muted" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.lastError}>
                        {j.lastError || '-'}
                      </td>
                      <td style={{ paddingRight: '24px', textAlign: 'right' }}>
                        {j.status !== 'sent' && <button className="btn btn-ghost btn-sm" onClick={() => retry(j._id)}>Retry</button>}
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && <tr><td colSpan="8" className="muted" style={{ padding: '24px', textAlign: 'center' }}>No emails yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside>
          <div className="card">
            <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Filters</h2>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </Field>
          </div>
        </aside>
      </div>
    </>
  );
}