import app from './app.js';
import { config, reportConfig } from './config/env.js';
import { connectDB } from './config/db.js';
import { startJobs } from './jobs/scheduler.js';

async function main() {
  reportConfig();
  await connectDB();
  startJobs();
  app.listen(config.port, () => {
    console.log(`  API listening on ${config.serverUrl} (port ${config.port})`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
