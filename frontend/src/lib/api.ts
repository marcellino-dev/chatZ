import axios from 'axios';

// Em produção: usa variável de ambiente
// Em dev: usa o proxy /api do Vite
const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ... resto igual (interceptors, getErrorMessage)