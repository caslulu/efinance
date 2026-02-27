import axios from 'axios';

const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
const apiBaseUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/+$/, '');
let authToken: string | null = null;

export const setApiAuthToken = (token: string | null) => {
  authToken = token;
};

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';

    if (status === 401) {
      // For /auth/profile, just reject silently (AuthContext handles this)
      if (requestUrl.includes('/auth/profile')) {
        return Promise.reject(error);
      }
      // For all other routes, clear session and redirect to login
      localStorage.removeItem('session_token');
      sessionStorage.removeItem('session_token');
      authToken = null;
      window.location.href = '/login';
      return Promise.reject(error);
    }

    const message = error.response?.data?.message;
    console.error('API Error:', Array.isArray(message) ? message.join(', ') : message || error.message);
    return Promise.reject(error);
  }
);
