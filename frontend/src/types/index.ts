// ==========================
// AUTH
// ==========================
export type Role = 'ADMIN' | 'AGENT' | 'CLIENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

// ==========================
// TICKETS
// ==========================
export type TicketStatus =
  | 'WAITING'
  | 'IN_PROGRESS'
  | 'TRANSFERRED'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Ticket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  queue: string;
  clientId: string;
  agentId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;

  client: Pick<User, 'id' | 'name' | 'email' | 'role'>;
  agent: Pick<User, 'id' | 'name' | 'email' | 'role'> | null;

  _count?: { messages: number };
}

export interface CreateTicketPayload {
  subject: string;
  priority?: TicketPriority;
  queue?: string;
}