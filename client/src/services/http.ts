import axios, { AxiosError } from 'axios';

/**
 * Normalized API error thrown by every service call. Carries the HTTP status
 * plus the server's machine `code` so UI can branch (e.g. 404 vs 409) without
 * parsing messages.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Shared axios instance.
 * - dev: baseURL "/api" is proxied to the Express server (same origin → cookies
 *   just work, no CORS).
 * - prod: set VITE_API_URL to the deployed API origin (e.g.
 *   https://api.example.com/api); `withCredentials` sends the admin auth cookie
 *   cross-origin (server CORS is configured to allow it).
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Translate raw axios/network errors into a clean ApiError.
http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: { message?: string; code?: string; details?: unknown } }>) => {
    const res = error.response;
    if (res) {
      const body = res.data?.error;
      return Promise.reject(
        new ApiError(res.status, body?.message ?? 'Request failed', body?.code ?? 'ERROR', body?.details),
      );
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new ApiError(0, 'The request timed out. Please try again.', 'TIMEOUT'));
    }
    return Promise.reject(new ApiError(0, 'Cannot reach the server. Check your connection.', 'NETWORK'));
  },
);
