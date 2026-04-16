let appInstance = null;
let databaseConnectionPromise = null;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://blood-donaction-clint.vercel.app',
  'https://blood-donaction-client.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const getAllowedOrigins = () => {
  const configured = String(process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.includes('*')) {
    return '*';
  }

  return new Set([...configured, ...DEFAULT_ALLOWED_ORIGINS]);
};

const setCorsHeaders = (req, res) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

const loadApp = async () => {
  if (appInstance) {
    return appInstance;
  }

  const { app } = await import('../src/app.js');
  appInstance = app;
  return appInstance;
};

const ensureDatabaseConnection = async () => {
  if (!databaseConnectionPromise) {
    databaseConnectionPromise = import('../src/config/db.js')
      .then(({ connectDatabase }) => connectDatabase())
      .catch((error) => {
        databaseConnectionPromise = null;
        throw error;
      });
  }

  return databaseConnectionPromise;
};

async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const app = await loadApp();
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

module.exports = handler;