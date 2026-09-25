import { isBrowserExtensionOrigin } from '../utils/platform.js';

export const getCorsOptions = () => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost',
    'capacitor://localhost',
  ];

  if (process.env.CLIENT_URL) {
    process.env.CLIENT_URL.split(',').forEach((o) => allowedOrigins.push(o.trim()));
  }

  if (process.env.EXTENSION_ORIGINS) {
    process.env.EXTENSION_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .forEach((origin) => allowedOrigins.push(origin));
  }

  return {
    origin: (origin, callback) => {
      // Requests without an Origin are allowed for native clients and CLI health checks.
      // Website origins remain explicitly allowlisted, while browser extensions
      // are authorized by their restricted extension protocols.
      if (!origin || allowedOrigins.includes(origin) || isBrowserExtensionOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  };
};
