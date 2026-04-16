// Vercel Serverless Function Entrypoint
// This file wraps the bundled Express app with CORS and connection handling.

const baseAppHandler = require('./handler.js');
let databaseConnectionPromise = null;

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

async function handler(req, res) {
  try {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    await ensureDatabaseConnection();

    // Use the bundled handler
    return await baseAppHandler(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server initialization failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = handler;