import { asyncHandler, ApiError } from '../utils/apiError.js';
import { buildAuthUrl, exchangeCodeAndStore, isCalendarConfigured } from '../services/calendar.service.js';
import { config } from '../config/env.js';

export const status = asyncHandler(async (req, res) => {
  res.json({
    configured: isCalendarConfigured(),
    connected: Boolean(req.user.google?.refreshToken),
    googleEmail: req.user.google?.email || null,
    connectedAt: req.user.google?.connectedAt || null,
  });
});

/** Returns the consent URL; the browser opens it in a new tab. */
export const connect = asyncHandler(async (req, res) => {
  if (!isCalendarConfigured()) throw ApiError.badRequest('Google Calendar is not configured on this server');
  res.json({ url: buildAuthUrl(req.user._id) });
});

/** Google redirects the browser here after consent. */
export const callback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${config.clientUrl}/calendar?status=denied`);
  if (!code || !state) return res.redirect(`${config.clientUrl}/calendar?status=invalid`);
  try {
    await exchangeCodeAndStore(code, state);
    res.redirect(`${config.clientUrl}/calendar?status=connected`);
  } catch (err) {
    console.error('[calendar] oauth callback failed:', err.message);
    res.redirect(`${config.clientUrl}/calendar?status=failed`);
  }
});

export const disconnect = asyncHandler(async (req, res) => {
  req.user.google = { refreshToken: null, accessToken: null, expiryDate: null, email: null, connectedAt: null };
  await req.user.save();
  res.json({ message: 'Google Calendar disconnected. New bookings will not create events.' });
});
