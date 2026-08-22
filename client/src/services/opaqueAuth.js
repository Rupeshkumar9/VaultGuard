import * as opaque from '@serenity-kit/opaque';
import { api } from './api';

// The OPAQUE library applies Argon2id internally. The vault PBKDF2/AES-GCM
// key derivation remains unchanged, so existing ciphertext stays compatible.
const waitForOpaque = () => opaque.ready;

export async function loginWithOpaque(email, password) {
  await waitForOpaque();
  const start = opaque.client.startLogin({ password });
  const challenge = await api.post('/auth/opaque/login/start', {
    email,
    startLoginRequest: start.startLoginRequest,
  });
  const result = opaque.client.finishLogin({
    clientLoginState: start.clientLoginState,
    loginResponse: challenge.loginResponse,
    password,
  });
  if (!result) throw Object.assign(new Error('Invalid credentials.'), { status: 401 });

  return api.post('/auth/opaque/login/finish', {
    email,
    challengeId: challenge.challengeId,
    finishLoginRequest: result.finishLoginRequest,
  });
}

export async function createOpaqueRegistrationRecord(password) {
  await waitForOpaque();
  const start = opaque.client.startRegistration({ password });
  const challenge = await api.post('/auth/opaque/password/start', {
    registrationRequest: start.registrationRequest,
  });
  const result = opaque.client.finishRegistration({
    clientRegistrationState: start.clientRegistrationState,
    registrationResponse: challenge.registrationResponse,
    password,
  });
  return {
    challengeId: challenge.challengeId,
    registrationRecord: result.registrationRecord,
  };
}

export async function registerWithOpaque({ email, password, name, masterPasswordHint, registrationKey }) {
  await waitForOpaque();
  const start = opaque.client.startRegistration({ password });
  const challenge = await api.post('/auth/opaque/register/start', {
    email,
    registrationKey,
    registrationRequest: start.registrationRequest,
  });
  const result = opaque.client.finishRegistration({
    clientRegistrationState: start.clientRegistrationState,
    registrationResponse: challenge.registrationResponse,
    password,
  });
  return api.post('/auth/opaque/register/finish', {
    challengeId: challenge.challengeId,
    email,
    name,
    masterPasswordHint,
    registrationKey,
    registrationRecord: result.registrationRecord,
  });
}
