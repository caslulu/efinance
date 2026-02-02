import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://127.0.0.1:3000',
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
