// ==========================
// AUTH
// ==========================
export type Role = 'ADMIN' | 'AGENT' | 'CLIENT';
export type AgentStatus = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';

export interface Sector {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { users: number; tickets: number };
}

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  active: boolean;
  sectorId: string | null;
  company?: string | null;
  profilePictureUrl?: string | null;
  status?: AgentStatus;
  statusChangedAt?: string | null;
  soundEnabled?: boolean;
  desktopNotifications?: boolean;
  notificationSound?: string;
  sector?: Pick<Sector, 'id' | 'name' | 'slug'> | null;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginPayload {
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

export interface TicketParticipant {
  id: string;
  ticketId: string;
  userId: string;
  addedById: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    profilePictureUrl?: string | null;
  };
  addedBy: {
    id: string;
    name: string;
  } | null;
}

export interface Ticket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: 'WHATSAPP' | 'WEB';
  sectorId: string;
  clientId: string;
  requestedAgentId: string | null;
  agentId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;

  sector: Pick<Sector, 'id' | 'name' | 'slug'>;
  client: Pick<
    User,
    'id' | 'name' | 'phone' | 'role' | 'company' | 'profilePictureUrl'
  >;
  agent: Pick<User, 'id' | 'name' | 'email' | 'role'> | null;
  requestedAgent: Pick<User, 'id' | 'name' | 'email' | 'role'> | null;

  transfers?: Transfer[];
  participants?: TicketParticipant[];

  _count?: { messages: number };
}

// ==========================
// MENSAGENS
// ==========================
export interface Message {
  id: string;
  content: string;
  channel: 'WHATSAPP' | 'WEB';
  read: boolean;
  ticketId: string;
  senderId: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    role: Role;
    company?: string | null;
    profilePictureUrl?: string | null;
  };
  attachment?: {
    url: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    type: 'image' | 'video' | 'audio' | 'document';
    sticker?: boolean;
  } | null;
}

export interface QuickReply {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================
// TRANSFERÊNCIAS
// ==========================
export interface Transfer {
  id: string;
  reason: string | null;
  ticketId: string;
  fromUserId: string;
  toUserId: string | null;
  toSectorId: string | null;
  createdAt: string;

  fromUser: {
    id: string;
    name: string;
    role: Role;
  };
  toUser: {
    id: string;
    name: string;
    role: Role;
  } | null;
  toSector: {
    id: string;
    name: string;
    slug: string;
  } | null;
}