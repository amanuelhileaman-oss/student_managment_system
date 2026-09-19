import axios from 'axios';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'https://stu-ma-gx4v.onrender.com/api';
  }
  return '/api';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 Unauthorized & 403 Deactivated
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginEndpoint = error.config?.url?.includes('/auth/login');
    const isAlreadyOnLoginPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/login');
    const isBackgroundPolling = error.config?.url?.includes('/communications/notifications');

    if (error.response && !isLoginEndpoint && !isBackgroundPolling) {
      if (error.response.status === 401 && !isAlreadyOnLoginPage) {
        if (localStorage.getItem('token')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      } else if (error.response.status === 403 && error.response.data?.message?.toLowerCase().includes('deactivated')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!isAlreadyOnLoginPage) {
          window.location.href = `/login?error=${encodeURIComponent(error.response.data.message)}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
