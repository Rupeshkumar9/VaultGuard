import crypto from 'crypto';
import opaque from '@serenity-kit/opaque';

const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const challenges = new Map();

function getServerSetup() {
  const setup = process.env.OPAQUE_SERVER_SETUP;
  if (!setup) {
    const error = new Error('OPAQUE authentication is not configured on this server.');
    error.statusCode = 503;
    throw error;
  }
  return setup;
}

async function ensureReady() {
  await opaque.ready;
  return getServerSetup();
}

function createChallenge(data) {
  const id = crypto.randomBytes(32).toString('base64url');
  challenges.set(id, { ...data, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  return id;
}

export function consumeChallenge(id, expectedKind) {
  const challenge = challenges.get(id);
  challenges.delete(id);
  if (!challenge || challenge.expiresAt < Date.now() || challenge.kind !== expectedKind) {
    const error = new Error('The authentication challenge is invalid or expired.');
    error.statusCode = 401;
    throw error;
  }
  return challenge;
}

function cleanupChallenges() {
  const now = Date.now();
  for (const [id, challenge] of challenges) {
    if (challenge.expiresAt < now) challenges.delete(id);
  }
}

setInterval(cleanupChallenges, CHALLENGE_TTL_MS).unref();

export async function createRegistrationResponse({ userIdentifier, registrationRequest, kind, userId, email }) {
  const serverSetup = await ensureReady();
  const { registrationResponse } = opaque.server.createRegistrationResponse({
    serverSetup,
    userIdentifier,
    registrationRequest,
  });
  const challengeId = createChallenge({ kind, userId, email, userIdentifier });
  return { challengeId, registrationResponse };
}

export async function startLogin({ userIdentifier, registrationRecord, startLoginRequest, email }) {
  const serverSetup = await ensureReady();
  const { serverLoginState, loginResponse } = opaque.server.startLogin({
    userIdentifier,
    registrationRecord,
    serverSetup,
    startLoginRequest,
  });
  const challengeId = createChallenge({
    kind: 'login',
    email,
    userIdentifier,
    serverLoginState,
  });
  return { challengeId, loginResponse };
}

export async function finishLogin({ challengeId, finishLoginRequest, email }) {
  const challenge = consumeChallenge(challengeId, 'login');
  if (challenge.email !== email) {
    const error = new Error('Invalid credentials.');
    error.statusCode = 401;
    throw error;
  }
  return opaque.server.finishLogin({
    finishLoginRequest,
    serverLoginState: challenge.serverLoginState,
  });
}
