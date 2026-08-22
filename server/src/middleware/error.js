export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);

  if (err.code === 11000) {
    return res.status(409).json({ error: 'That record already exists', code: 'DUPLICATE' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join(', ') });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Malformed id in the request' });
  }

  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.message || 'Something went wrong', code: err.code });
}
