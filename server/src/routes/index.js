import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as auth from '../controllers/auth.controller.js';
import * as doctors from '../controllers/doctor.controller.js';
import * as admin from '../controllers/admin.controller.js';
import * as appts from '../controllers/appointment.controller.js';
import * as calendar from '../controllers/calendar.controller.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

/* auth */
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', requireAuth, auth.me);
router.patch('/auth/me', requireAuth, auth.updateProfile);
router.post('/auth/change-password', requireAuth, auth.changePassword);

/* doctor directory (public browsing needs a session, any role) */
router.get('/doctors', requireAuth, doctors.listDoctors);
router.get('/doctors/specialisations', requireAuth, doctors.listSpecialisations);
router.get('/doctors/:id', requireAuth, doctors.getDoctor);
router.get('/doctors/:id/availability', requireAuth, doctors.availability);

/* the signed-in doctor's own tools */
router.get('/doctor/schedule', requireAuth, requireRole('doctor'), doctors.mySchedule);
router.patch('/doctor/profile', requireAuth, requireRole('doctor'), doctors.updateMyProfile);
router.post('/doctor/leave', requireAuth, requireRole('doctor'), doctors.addLeave);
router.delete('/doctor/leave', requireAuth, requireRole('doctor'), doctors.removeLeave);

/* appointments */
router.post('/appointments/hold', requireAuth, requireRole('patient'), appts.holdAppointment);
router.post('/appointments/:id/confirm', requireAuth, requireRole('patient'), appts.confirmAppointment);
router.get('/appointments', requireAuth, appts.listMyAppointments);
router.get('/appointments/stats', requireAuth, appts.stats);
router.get('/appointments/reminders', requireAuth, requireRole('patient'), appts.myReminders);
router.get('/appointments/:id', requireAuth, appts.getAppointment);
router.post('/appointments/:id/cancel', requireAuth, appts.cancel);
router.post('/appointments/:id/reschedule', requireAuth, appts.reschedule);
router.post('/appointments/:id/post-visit', requireAuth, requireRole('doctor'), appts.submitPostVisit);
router.post('/appointments/:id/no-show', requireAuth, requireRole('doctor', 'admin'), appts.markNoShow);

/* google calendar */
router.get('/calendar/status', requireAuth, calendar.status);
router.post('/calendar/connect', requireAuth, calendar.connect);
router.get('/calendar/oauth/callback', calendar.callback); // hit by Google, not the SPA
router.post('/calendar/disconnect', requireAuth, calendar.disconnect);

/* admin */
const adminOnly = [requireAuth, requireRole('admin')];
router.get('/admin/dashboard', adminOnly, admin.dashboard);
router.get('/admin/users', adminOnly, admin.listUsers);
router.get('/admin/appointments', adminOnly, admin.listAllAppointments);
router.post('/admin/doctors', adminOnly, admin.createDoctor);
router.patch('/admin/doctors/:id', adminOnly, admin.updateDoctor);
router.delete('/admin/doctors/:id', adminOnly, admin.deactivateDoctor);
router.post('/admin/doctors/:id/leave', adminOnly, doctors.addLeave);
router.delete('/admin/doctors/:id/leave', adminOnly, doctors.removeLeave);
router.get('/admin/emails', adminOnly, admin.listEmailJobs);
router.post('/admin/emails/:id/retry', adminOnly, admin.retryEmailJob);

export default router;
