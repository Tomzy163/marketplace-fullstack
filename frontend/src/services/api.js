import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

let accessToken = localStorage.getItem('accessToken') || '';

export function setAccessToken(token) {
  accessToken = token || '';
  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    localStorage.removeItem('accessToken');
  }
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isRefreshRequest = original?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !original?._retry && !isRefreshRequest) {
      original._retry = true;
      const { data } = await api.post('/auth/refresh');
      setAccessToken(data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    }

    return Promise.reject(error);
  },
);

export default api;
