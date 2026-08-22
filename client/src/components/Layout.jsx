import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

const LINKS = {
  patient: [
    { to: '/', label: 'My appointments', end: true },
    { to: '/book', label: 'Book' },
    { to: '/reminders', label: 'Medication' },
    { to: '/calendar', label: 'Calendar' },
  ],
  doctor: [
    { to: '/', label: 'Today', end: true },
    { to: '/doctor/hours', label: 'Hours & leave' },
    { to: '/calendar', label: 'Calendar' },
  ],
  admin: [
    { to: '/', label: 'Overview', end: true },
    { to: '/admin/doctors', label: 'Doctors' },
    { to: '/admin/appointments', label: 'Appointments' },
    { to: '/admin/notifications', label: 'Notifications' },
  ],
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = LINKS[user?.role] || [];

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" to="/">
            <span className="brand-mark" aria-hidden="true" />
            City Clinic
          </Link>
          <nav className="nav">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
            <span className="nav-user">{user?.name} · {user?.role}</span>
            <button className="btn btn-ghost btn-sm" style={{ color: '#dfeae7', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => { logout(); navigate('/login'); }}>
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
