import { api } from '../services/api';

const AUTH_CACHE_KEY = 'vaultguard_cached_user';

let cachedMarker = null;
let cachedResult = null;
let inFlightCheck = null;

function getCacheMarker() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(AUTH_CACHE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Checks whether the current browser session is authenticated by querying /api/auth/me.
 * Deduplicates requests across public page navigations so the auth rate limiter is not hit.
 */
export async function checkPublicAuthStatus() {
  const marker = getCacheMarker();

  if (cachedMarker === marker && cachedResult !== null) {
    return cachedResult;
  }

  if (inFlightCheck && cachedMarker === marker) {
    return inFlightCheck;
  }

  cachedMarker = marker;
  inFlightCheck = api
    .get('/auth/me')
    .then((response) => {
      const authenticated = Boolean(response?.success && response?.user);
      cachedResult = authenticated;
      return authenticated;
    })
    .catch((err) => {
      if (err?.status === 401 && typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(AUTH_CACHE_KEY);
          cachedMarker = '';
        } catch {
          // Ignore storage access errors
        }
      }
      cachedResult = false;
      return false;
    })
    .finally(() => {
      inFlightCheck = null;
    });

  return inFlightCheck;
}
