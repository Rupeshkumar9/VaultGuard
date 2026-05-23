/**
 * API service for VaultGuard.
 * Uses native fetch API to communicate with the Express backend.
 * Automatically handles CORS credentials (cookies) and JSON content types.
 */

let authToken = '';

/**
 * Configure the active in-memory JWT token.
 * Used for authorization headers in requests.
 * @param {string} token - JWT token
 */
export const setToken = (token) => {
  authToken = token;
};

/**
 * Clear the active in-memory JWT token (e.g. on logout).
 */
export const clearToken = () => {
  authToken = '';
};

/**
 * Base request function.
 * @param {string} endpoint - API path (e.g. '/auth/login')
 * @param {object} options - Fetch options
 */
const request = async (endpoint, options = {}) => {
  // Use VITE_API_URL in production, fallback to relative path in dev (relying on proxy)
  let apiBase = import.meta.env.VITE_API_URL || '';
  if (apiBase.endsWith('/')) {
    apiBase = apiBase.slice(0, -1);
  }
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  const url = `${apiBase}${cleanEndpoint}`;

  // Configure headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // If token is in memory, inject it into the Authorization header
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const config = {
    ...options,
    headers,
    credentials: 'include', // Crucial to allow HTTP-only cookies to be sent/saved
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      // Create a detailed error
      const error = new Error(data.message || 'API request failed');
      error.status = response.status;
      error.errors = data.errors || [];
      throw error;
    }

    return data;
  } catch (error) {
    // Forward custom API errors or network failure messages
    if (error.status) throw error;
    throw new Error('Network error. Check if your backend server is running.');
  }
};

export const api = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, data, options) => request(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data, options) => request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) }),
  patch: (endpoint, data, options) => request(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(data) }),
  delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' }),
};
