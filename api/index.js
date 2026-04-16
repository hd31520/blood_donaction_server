import { app } from '../src/app.js';
import { connectDatabase } from '../src/config/db.js';

let isDatabaseConnected = false;

const ensureDatabaseConnection = async () => {
  if (isDatabaseConnected) {
    return;
  }

  await connectDatabase();
  isDatabaseConnected = true;
};

export default async function handler(req, res) {
  try {
    await ensureDatabaseConnection();
    return app(req, res);
  } catch (error) {
    console.error('Vercel handler startup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server initialization failed',
    });
  }
}
