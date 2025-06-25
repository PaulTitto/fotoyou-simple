import { defineStore } from 'pinia';
import router from '@/router';
import api from '@/services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user')) || null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
  },
  actions: {
    async login(email, password) {
      try {
        const response = await api.post('/login', { email, password });
        if (!response.data.error) {
          const { loginResult } = response.data;
          this.token = loginResult.token;
          this.user = { userId: loginResult.userId, name: loginResult.name };

          localStorage.setItem('token', this.token);
          localStorage.setItem('user', JSON.stringify(this.user));

          router.push('/');
        }
        return response.data;
      } catch (error) {
        console.error('Login failed:', error.response.data);
        return error.response.data;
      }
    },
    async register(name, email, password) {
      try {
        const response = await api.post('/register', { name, email, password });
        if (!response.data.error) {
          router.push('/login');
        }
        return response.data;
      } catch (error) {
        console.error('Registration failed:', error.response.data);
        return error.response.data;
      }
    },
    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/login');
    },
  },
}); 