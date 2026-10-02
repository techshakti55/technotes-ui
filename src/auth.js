import { createRemoteJWKSet, jwtVerify } from 'jose';
import { demoMode } from './demo';

const issuer = (
  import.meta.env.VITE_OAUTH_ISSUER || 'http://localhost:9000'
).replace(/\/$/, '');

const clientId =
  import.meta.env.VITE_OAUTH_CLIENT_ID || 'technotes-web';

const scope =
  import.meta.env.VITE_OAUTH_SCOPE ||
  'openid profile notes.read notes.write notes.review taxonomy.write profile.read';

const SESSION_KEY = 'technotes.auth';
const PENDING_KEY = 'technotes.pkce';
const DEMO_KEY = 'technotes.demo.login';

// Browser login attempt expires after 10 minutes.
// This does not change the server's token lifetime.
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

const jwks = createRemoteJWKSet(
  new URL(`${issuer}/oauth2/jwks`)
);

let callbackPromise = null;
let sessionGeneration = 0;

const callback = () =>
  `${window.location.origin}/auth/callback`;

const b64url = bytes =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const random = () =>
  b64url(crypto.getRandomValues(new Uint8Array(32)));

async function challenge(verifier) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );

  return b64url(new Uint8Array(digest));
}

function readStored(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return '/admin';
  }

  try {
    const url = new URL(value, window.location.origin);

    if (
      url.origin !== window.location.origin ||
      url.pathname === '/auth/callback'
    ) {
      return '/admin';
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/admin';
  }
}

export function session() {
  if (demoMode) {
    return sessionStorage.getItem(DEMO_KEY)
      ? {
          access_token: 'demo-only',
          expiresAt: Date.now() + 3600000
        }
      : null;
  }

  const value = readStored(SESSION_KEY);

  if (
    typeof value?.access_token === 'string' &&
    value.access_token.length > 0 &&
    Number.isFinite(value.expiresAt) &&
    Date.now() < value.expiresAt - 30000
  ) {
    return value;
  }

  sessionStorage.removeItem(SESSION_KEY);
  return null;
}

export function clearSession() {
  sessionGeneration += 1;
  sessionStorage.removeItem(DEMO_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(PENDING_KEY);
}

export async function login() {
  clearSession();
  callbackPromise = null;

  if (demoMode) {
    sessionStorage.setItem(DEMO_KEY, 'yes');
    window.location.assign('/admin');
    return;
  }

  const verifier = random();
  const state = random();
  const nonce = random();
  const redirectUri = callback();
  const codeChallenge = await challenge(verifier);

  sessionStorage.setItem(
    PENDING_KEY,
    JSON.stringify({
      verifier,
      state,
      nonce,
      redirectUri,
      createdAt: Date.now(),
      returnTo: safeReturnTo(
        `${window.location.pathname}${window.location.search}`
      )
    })
  );

  const url = new URL(`${issuer}/oauth2/authorize`);

  const parameters = {
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  };

  Object.entries(parameters).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  window.location.assign(url.href);
}

async function validateIdToken(idToken, accessToken, nonce) {
  const { payload } = await jwtVerify(idToken, jwks, {
    algorithms: ['RS256'],
    issuer,
    audience: clientId,
    requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce']
  });

  if (
    typeof payload.sub !== 'string' ||
    !payload.sub.trim() ||
    payload.nonce !== nonce
  ) {
    throw new Error('Invalid login identity or nonce.');
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    !Number.isFinite(payload.iat) ||
    payload.iat > now ||
    payload.exp <= payload.iat
  ) {
    throw new Error('Invalid ID token timestamps.');
  }

  const multipleAudiences =
    Array.isArray(payload.aud) && payload.aud.length > 1;

  if (
    (multipleAudiences && payload.azp !== clientId) ||
    (payload.azp !== undefined && payload.azp !== clientId)
  ) {
    throw new Error('Invalid authorized client.');
  }

  // For RS256, at_hash uses the left half of SHA-256.
  // Validate it whenever the authorization server supplies it.
  if (payload.at_hash !== undefined) {
    const digest = new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(accessToken)
      )
    );

    const expected = b64url(
      digest.slice(0, digest.length / 2)
    );

    if (payload.at_hash !== expected) {
      throw new Error('Access token binding did not match.');
    }
  }
}

async function processCallback() {
  const generation = sessionGeneration;
  const query = new URLSearchParams(window.location.search);
  const pending = readStored(PENDING_KEY);

  // Consume the login attempt before any network request.
  sessionStorage.removeItem(PENDING_KEY);
  sessionStorage.removeItem(SESSION_KEY);

  // Remove the authorization code from browser history.
  window.history.replaceState(
    window.history.state,
    '',
    '/auth/callback'
  );

  const age = Date.now() - pending?.createdAt;

  if (
    !pending ||
    typeof pending.state !== 'string' ||
    !pending.state ||
    typeof pending.nonce !== 'string' ||
    !pending.nonce ||
    typeof pending.verifier !== 'string' ||
    !pending.verifier ||
    !Number.isFinite(pending.createdAt) ||
    age < 0 ||
    age > LOGIN_TIMEOUT_MS ||
    pending.redirectUri !== callback() ||
    query.getAll('state').length !== 1 ||
    query.get('state') !== pending.state
  ) {
    throw new Error(
      'Login request is invalid or expired. Please sign in again.'
    );
  }

  if (query.has('error')) {
    throw new Error(
      'Authorization was not completed. Please sign in again.'
    );
  }

  if (
    query.getAll('code').length !== 1 ||
    !query.get('code')
  ) {
    throw new Error(
      'Authorization code is missing or invalid. Please sign in again.'
    );
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code: query.get('code'),
    redirect_uri: pending.redirectUri,
    code_verifier: pending.verifier
  });

  const response = await fetch(`${issuer}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body,
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json();
  const expiresIn = data.expires_in;

  if (
    !response.ok ||
    typeof data.access_token !== 'string' ||
    !data.access_token ||
    typeof data.id_token !== 'string' ||
    !data.id_token ||
    typeof data.token_type !== 'string' ||
    data.token_type.toLowerCase() !== 'bearer' ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    throw new Error(
      'Token exchange failed or returned an invalid response.'
    );
  }

  // Count lifetime from token receipt, before verification.
  const expiresAt = Date.now() + expiresIn * 1000;

  await validateIdToken(
    data.id_token,
    data.access_token,
    pending.nonce
  );

  if (
    generation !== sessionGeneration ||
    Date.now() >= expiresAt
  ) {
    throw new Error('Login was cancelled or expired.');
  }

  // Store an API session only after successful verification.
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      access_token: data.access_token,
      expiresAt
    })
  );

  return safeReturnTo(pending.returnTo);
}

export function finishLogin() {
  // Repeated React effects share one token-exchange promise.
  if (!callbackPromise) {
    callbackPromise = processCallback().catch(error => {
      const knownMessages = {
        'Login request is invalid or expired. Please sign in again.':
          'LOGIN_REQUEST_INVALID',
        'Authorization was not completed. Please sign in again.':
          'AUTHORIZATION_FAILED',
        'Authorization code is missing or invalid. Please sign in again.':
          'AUTHORIZATION_CODE_INVALID',
        'Token exchange failed or returned an invalid response.':
          'TOKEN_RESPONSE_INVALID',
        'Invalid login identity or nonce.':
          'IDENTITY_OR_NONCE_INVALID',
        'Invalid ID token timestamps.':
          'ID_TOKEN_TIMESTAMPS_INVALID',
        'Invalid authorized client.':
          'AUTHORIZED_CLIENT_INVALID',
        'Access token binding did not match.':
          'ACCESS_TOKEN_BINDING_INVALID',
        'Login was cancelled or expired.':
          'LOGIN_CANCELLED_OR_EXPIRED'
      };

      const allowedCodes = new Set([
        'ERR_JWT_EXPIRED',
        'ERR_JWT_CLAIM_VALIDATION_FAILED',
        'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
        'ERR_JWKS_TIMEOUT',
        'ERR_JWKS_NO_MATCHING_KEY',
        'ERR_JWKS_INVALID',
        'ERR_JOSE_GENERIC'
      ]);

      let code = knownMessages[error?.message];

      if (!code && allowedCodes.has(error?.code)) {
        code = error.code;
      }

      if (!code) {
        code =
          error?.name === 'TimeoutError' ? 'REQUEST_TIMEOUT' :
          error?.name === 'AbortError' ? 'REQUEST_ABORTED' :
          error?.name === 'TypeError' ? 'BROWSER_OR_NETWORK_ERROR' :
          'LOGIN_VERIFICATION_UNKNOWN';
      }

      throw new Error(
        `Sign-in failed (${code}). Please start a fresh sign-in.`
      );
    });
  }

  return callbackPromise;
}