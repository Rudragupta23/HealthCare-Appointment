import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import PatientHome from './pages/PatientHome.jsx';
import BookAppointment from './pages/BookAppointment.jsx';
import AppointmentDetail from './pages/AppointmentDetail.jsx';
import Reminders from './pages/Reminders.jsx';
import DoctorHome from './pages/DoctorHome.jsx';
import DoctorHours from './pages/DoctorHours.jsx';
import AdminHome from './pages/AdminHome.jsx';
import AdminDoctors from './pages/AdminDoctors.jsx';
import AdminAppointments from './pages/AdminAppointments.jsx';
import AdminNotifications from './pages/AdminNotifications.jsx';
import CalendarSettings from './pages/CalendarSettings.jsx';

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page muted mono">Loading session...</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

/** The home route is a different dashboard for each role. */
function Home() {
  const { user } = useAuth();
  if (user?.role === 'doctor') return <DoctorHome />;
  if (user?.role === 'admin') return <AdminHome />;
  return <PatientHome />;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!loading && user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={!loading && user ? <Navigate to="/" replace /> : <Register />} />

      <Route path="/" element={<Protected><Home /></Protected>} />
      <Route path="/book" element={<Protected roles={['patient']}><BookAppointment /></Protected>} />
      <Route path="/reminders" element={<Protected roles={['patient']}><Reminders /></Protected>} />
      <Route path="/appointments/:id" element={<Protected><AppointmentDetail /></Protected>} />
      <Route path="/calendar" element={<Protected><CalendarSettings /></Protected>} />

      <Route path="/doctor/hours" element={<Protected roles={['doctor']}><DoctorHours /></Protected>} />

      <Route path="/admin/doctors" element={<Protected roles={['admin']}><AdminDoctors /></Protected>} />
      <Route path="/admin/appointments" element={<Protected roles={['admin']}><AdminAppointments /></Protected>} />
      <Route path="/admin/notifications" element={<Protected roles={['admin']}><AdminNotifications /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
