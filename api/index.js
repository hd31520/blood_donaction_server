let appInstance = null;
let databaseConnectionPromise = null;

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

export default async function handler(req, res) {
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
