import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const api = axios.create({
  baseURL: 'http://localhost:3000/api', 
  // baseURL: 'https://dc0a-2400-9800-920-223f-151-cfc3-d323-5475.ngrok-free.app/'
});

// Interceptor tidak perlu diubah, tetap berguna
api.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  const token = authStore.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;