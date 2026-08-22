import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { config } from './config/env.js';

const app = express();

// app.use(cors({ origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
app.use(cors({ origin: [config.clientUrl, 'http://localhost:5173', 'https://healthcare-appointment-amsy.onrender.com'], credentials: true }));

app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => res.json({ name: 'Healthcare Appointment & Follow-up Manager API', docs: '/api/health' }));
app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
