import axios from 'axios';

const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

export const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message;
    console.error('API Error:', Array.isArray(message) ? message.join(', ') : message || error.message);
    return Promise.reject(error);
  }
);
