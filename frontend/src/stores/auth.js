import { defineStore } from 'pinia';
import api, { setAccessToken } from '../services/api';

function storedUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (_error) {
    return null;
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: storedUser(),
    accessToken: localStorage.getItem('accessToken') || '',
    initialized: false,
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.accessToken && state.user),
    isSeller: (state) => state.user?.role === 'seller',
    hasActiveSubscription: (state) => state.user?.subscriptionStatus === 'active',
  },
  actions: {
    persist(session) {
      this.accessToken = session.accessToken;
      this.user = session.user;
      setAccessToken(session.accessToken);
      localStorage.setItem('user', JSON.stringify(session.user));
    },
    hasRole(roles) {
      const allowed = Array.isArray(roles) ? roles : [roles];
      return allowed.includes(this.user?.role);
    },
    async register(payload) {
      const { data } = await api.post('/auth/register', payload);
      this.persist(data);
    },
    async login(payload) {
      const { data } = await api.post('/auth/login', payload);
      this.persist(data);
    },
    async refresh() {
      try {
        const { data } = await api.post('/auth/refresh');
        this.persist(data);
      } catch (_error) {
        this.clear();
      } finally {
        this.initialized = true;
      }
    },
    async logout() {
      await api.post('/auth/logout').catch(() => undefined);
      this.clear();
    },
    clear() {
      this.user = null;
      this.accessToken = '';
      setAccessToken('');
      localStorage.removeItem('user');
    },
    applyOAuthToken(token) {
      this.accessToken = token;
      setAccessToken(token);
    },
  },
});
