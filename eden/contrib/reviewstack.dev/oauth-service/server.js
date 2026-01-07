const http = require('http');
const {URL} = require('url');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8081);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
const OAUTH_SERVICE_ORIGIN = process.env.OAUTH_SERVICE_ORIGIN;
const FRONTEND_CALLBACK_PATH = process.env.FRONTEND_CALLBACK_PATH || '/oauth-callback.html';

const GITHUB_BASE_URL = process.env.GITHUB_BASE_URL || 'https://github.com';
const GITHUB_AUTHORIZE_PATH = process.env.GITHUB_AUTHORIZE_PATH || '/login/oauth/authorize';
const GITHUB_TOKEN_PATH = process.env.GITHUB_TOKEN_PATH || '/login/oauth/access_token';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_SCOPE = process.env.GITHUB_SCOPE || 'user repo';

function envMissing() {
  if (!FRONTEND_ORIGIN) {
    return 'FRONTEND_ORIGIN is required';
  }
  if (!OAUTH_SERVICE_ORIGIN) {
    return 'OAUTH_SERVICE_ORIGIN is required';
  }
  if (!GITHUB_CLIENT_ID) {
    return 'GITHUB_CLIENT_ID is required';
  }
  if (!GITHUB_CLIENT_SECRET) {
    return 'GITHUB_CLIENT_SECRET is required';
  }
  return null;
}

function writeJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    'Cache-Control': 'no-store',
  });
  res.end();
}

function redirectToFrontend(res, params) {
  const callbackUrl = new URL(FRONTEND_CALLBACK_PATH, FRONTEND_ORIGIN);
  const hash = new URLSearchParams(params);
  callbackUrl.hash = hash.toString();
  redirect(res, callbackUrl.toString());
}

function randomState() {
  return crypto.randomBytes(16).toString('hex');
}

async function exchangeCodeForToken(code, redirectUri) {
  const tokenUrl = new URL(GITHUB_TOKEN_PATH, GITHUB_BASE_URL);
  const body = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload.error_description || payload.error || 'oauth token exchange failed';
    throw new Error(message);
  }

  const token = payload.access_token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('access_token missing in OAuth response');
  }

  return token;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    writeJson(res, 400, {error: 'missing url'});
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (path === '/healthz') {
    writeJson(res, 200, {status: 'ok'});
    return;
  }

  const missing = envMissing();
  if (missing) {
    writeJson(res, 500, {error: missing});
    return;
  }

  if (path === '/authorize') {
    const state = url.searchParams.get('state') || randomState();
    const redirectUri = new URL('/callback', OAUTH_SERVICE_ORIGIN).toString();
    const authorizeUrl = new URL(GITHUB_AUTHORIZE_PATH, GITHUB_BASE_URL);

    authorizeUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', GITHUB_SCOPE);
    authorizeUrl.searchParams.set('state', state);

    redirect(res, authorizeUrl.toString());
    return;
  }

  if (path === '/callback') {
    const error = url.searchParams.get('error');
    const state = url.searchParams.get('state') || '';
    if (error) {
      redirectToFrontend(res, {error, state});
      return;
    }

    const code = url.searchParams.get('code');
    if (!code) {
      redirectToFrontend(res, {error: 'missing_code', state});
      return;
    }

    try {
      const redirectUri = new URL('/callback', OAUTH_SERVICE_ORIGIN).toString();
      const token = await exchangeCodeForToken(code, redirectUri);
      redirectToFrontend(res, {token, state});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'oauth callback failed';
      redirectToFrontend(res, {error: message, state});
    }
    return;
  }

  writeJson(res, 404, {error: 'not_found'});
});

server.listen(PORT, () => {
  const message = `reviewstack oauth service listening on ${PORT}`;
  process.stdout.write(`${message}\n`);
});
