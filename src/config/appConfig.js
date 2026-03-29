const BACKEND_PORT = Number(process.env.PORT || 3000);
const BACKEND_HOST = process.env.BACKEND_HOST || '0.0.0.0';
const BACKEND_PUBLIC_HOST = process.env.BACKEND_PUBLIC_HOST || 'localhost';
const BACKEND_PUBLIC_URL =
  process.env.BACKEND_PUBLIC_URL ||
  `http://${BACKEND_PUBLIC_HOST}:${BACKEND_PORT}`;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [FRONTEND_URL];

module.exports = {
  BACKEND_PORT,
  BACKEND_HOST,
  BACKEND_PUBLIC_URL,
  FRONTEND_URL,
  ALLOWED_ORIGINS,
};
