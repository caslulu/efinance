import axios from 'axios';

if (!import.meta.env.VITE_API_URL) {
  console.warn("VITE_API_URL is not defined in the environment variables.");
}

const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'),
  );
  return match ? decodeURIComponent(match[1]) : null;
};

let csrfPromise: Promise<string | null> | null = null;
const ensureCsrfToken = async (): Promise<string | null> => {
  const existing = readCookie('csrf_token');
  if (existing) return existing;
  if (!csrfPromise) {
    csrfPromise = axios
      .get(`${apiBaseUrl}/csrf`, { withCredentials: true })
      .then((res) => res.data?.csrfToken || readCookie('csrf_token'))
      .catch(() => null)
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
};

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  if (MUTATING_METHODS.has(method)) {
    const token = await ensureCsrfToken();
    if (token) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['X-CSRF-Token'] = token;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';

    if (status === 401) {
      if (requestUrl.includes('/auth/profile')) {
        return Promise.reject(error);
      }
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    const message = error.response?.data?.message;
    if (import.meta.env.DEV) {
      console.error('API Error:', Array.isArray(message) ? message.join(', ') : message || error.message);
    }
    return Promise.reject(error);
  }
);
