const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Origin verification function matching server.js production logic
const checkCorsOrigin = (origin, frontendUrlConfig) => {
  if (!origin) return true; // server-to-server or non-browser tools allowed

  const configuredOrigins = (frontendUrlConfig || '')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const allowedOrigins = [
    ...configuredOrigins,
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  const cleanOrigin = origin.replace(/\/+$/, '');
  return (
    allowedOrigins.some((allowed) => cleanOrigin === allowed || cleanOrigin.startsWith(allowed)) ||
    cleanOrigin.endsWith('.vercel.app')
  );
};

describe('Unit Test: Production CORS & Vercel Deployment Origin Verification', () => {
  it('allows curl / Postman / server-to-server requests where origin is undefined', () => {
    assert.strictEqual(checkCorsOrigin(undefined, 'https://stude.vercel.app'), true);
    assert.strictEqual(checkCorsOrigin(null, 'https://stude.vercel.app'), true);
  });

  it('allows local development origins (Vite port 5173 and port 3000)', () => {
    assert.strictEqual(checkCorsOrigin('http://localhost:5173', ''), true);
    assert.strictEqual(checkCorsOrigin('http://localhost:3000', ''), true);
  });

  it('allows exact production FRONTEND_URL', () => {
    const frontendUrl = 'https://my-school-management.vercel.app';
    assert.strictEqual(checkCorsOrigin('https://my-school-management.vercel.app', frontendUrl), true);
  });

  it('handles FRONTEND_URL with trailing slashes gracefully', () => {
    const frontendUrl = 'https://my-school-management.vercel.app/';
    assert.strictEqual(checkCorsOrigin('https://my-school-management.vercel.app', frontendUrl), true);
    assert.strictEqual(checkCorsOrigin('https://my-school-management.vercel.app/', frontendUrl), true);
  });

  it('allows comma-separated multiple production frontend domains', () => {
    const frontendUrls = 'https://school.edu, https://admin.school.edu, https://portal.school.edu';
    assert.strictEqual(checkCorsOrigin('https://school.edu', frontendUrls), true);
    assert.strictEqual(checkCorsOrigin('https://admin.school.edu', frontendUrls), true);
    assert.strictEqual(checkCorsOrigin('https://portal.school.edu', frontendUrls), true);
  });

  it('automatically permits Vercel preview branch deployments (*.vercel.app)', () => {
    assert.strictEqual(checkCorsOrigin('https://stude-feat-attendance-amanuel.vercel.app', ''), true);
    assert.strictEqual(checkCorsOrigin('https://stude-git-main-amanuel.vercel.app', ''), true);
  });

  it('strictly blocks unauthorized malicious origins', () => {
    assert.strictEqual(checkCorsOrigin('https://malicious-site.com', 'https://school.edu'), false);
    assert.strictEqual(checkCorsOrigin('https://phishing-school.net', 'https://school.edu'), false);
    assert.strictEqual(checkCorsOrigin('http://unauthorized-local:8080', 'https://school.edu'), false);
  });
});
