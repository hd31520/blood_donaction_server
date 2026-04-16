#!/usr/bin/env node
/**
 * Build script to bundle ESM server code into CommonJS for Vercel
 * Converts src/app.js (+ all dependencies) → api/handler.js (CommonJS via wrapper)
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const outFile = path.join(__dirname, 'api', 'handler.js');
const esmBundleFile = path.join(__dirname, 'api', '_handler.esm.mjs');
const entryPoint = path.join(__dirname, 'src', 'app.js');

// Ensure api directory exists
const apiDir = path.join(__dirname, 'api');
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

console.log(`🔨 Building ${entryPoint} → ${outFile}...`);

esbuild
  .build({
    entryPoints: [entryPoint],
    outfile: esmBundleFile,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    bundle: true,
    external: ['mongodb', 'mongoose'], // Keep native/npm modules external
    sourcemap: false,
    minify: false,
    logLevel: 'info',
  })
  .then(() => {
    console.log(`✅ ESM bundle created: ${esmBundleFile}`);
    
    // Create a CommonJS wrapper that uses import()
    const wrapper = `// Vercel Serverless Handler (CommonJS wrapper around ESM)
let appInstance = null;

async function initializeApp() {
  if (appInstance) return appInstance;
  
  try {
    const imported = await import('./_handler.esm.mjs');
    appInstance = imported.app;
    return appInstance;
  } catch (error) {
    console.error('Failed to load app from ESM bundle:', error);
    throw error;
  }
}

let initialized = false;

async function handler(req, res) {
  try {
    // Initialize app on first request
    if (!initialized) {
      await initializeApp();
      initialized = true;
    }
    
    return appInstance(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = handler;
`;

    fs.writeFileSync(outFile, wrapper, 'utf-8');
    console.log(`✅ CommonJS wrapper created: ${outFile}`);
    console.log(`   Ready for Vercel deployment`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
  });
