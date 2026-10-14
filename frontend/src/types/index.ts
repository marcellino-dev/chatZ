// Roles disponíveis no sistema
export type Role = 'ADMIN' | 'AGENT' | 'CLIENT';

// Usuário autenticado (sem senha)
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

// Resposta do login / register
export interface AuthResponse {
  token: string;
  user: User;
}

// Payload do login
export interface LoginPayload {
  email: string;
  password: string;
}

// Payload do register
export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}