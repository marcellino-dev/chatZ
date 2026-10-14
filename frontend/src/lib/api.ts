import axios from 'axios';

// Base URL aponta pro proxy do Vite (/api -> http://localhost:3000)
export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de REQUEST: injeta o token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('chatz_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de RESPONSE: trata 401 (token expirado/inválido)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido -> limpa e volta pro login
      localStorage.removeItem('chatz_token');
      localStorage.removeItem('chatz_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Helper pra extrair mensagem de erro do backend
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || error.message;
  }
  return 'Erro desconhecido';
}