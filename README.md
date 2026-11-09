# chatZ

Sistema web de atendimento ao cliente com tickets, conversas em tempo real e integração com WhatsApp. Reúne uma interface para atendentes e administradores, uma API de backend e serviços auxiliares de mensageria.

## Funcionalidades

- **Atendimento por tickets:** status, prioridade, canal, atribuição a atendentes e setores.
- **Chat em tempo real:** troca de mensagens, indicação de digitação e salas associadas a cada ticket.
- **WhatsApp:** envio e recebimento de texto e mídia pela Evolution API, com bot de triagem que encaminha o contato ao setor e, depois, a um atendente.
- **Gestão de equipe:** usuários, papéis, setores, participantes e transferências de atendimento.
- **Operação:** contatos, etiquetas, respostas rápidas, figurinhas, notas internas e lembretes de acompanhamento.
- **Resultados:** painel de desempenho e avaliações associadas aos tickets.
- **Anexos:** upload de documentos, imagens, vídeos e áudio nas conversas.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router, Axios, Socket.IO Client |
| Backend | Node.js, Express 5, TypeScript, Socket.IO, Prisma ORM, Zod, JWT, bcryptjs, Multer |
| Banco de dados | SQLite (chatZ) |
| Mensageria | Evolution API (WhatsApp) com PostgreSQL via Docker Compose |
| Qualidade | Oxlint (frontend), Node Test Runner (backend) |

> O PostgreSQL do `docker-compose` da pasta `evolution` é usado apenas pela Evolution API. O banco do chatZ é o SQLite configurado no Prisma.

## Estrutura do projeto

```
chatZ/
├── backend/      API Express, Socket.IO, Prisma e módulos (auth, bot, whatsapp, uploads, performance)
│   ├── prisma/   schema.prisma e migrations
│   └── src/
├── frontend/     Interface React (chat, tickets, contatos, histórico, setores, usuários, configurações)
└── evolution/    docker-compose da Evolution API (WhatsApp)
```

## Como rodar localmente

### Pré-requisitos

- Node.js e npm
- Docker e Docker Compose (para a Evolution API)

### 1. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Configure o arquivo `.env` do backend com a URL do banco SQLite, o segredo do JWT e os dados da Evolution API.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

A interface fica disponível em `http://localhost:5173`.

### 3. Evolution API (WhatsApp)

```bash
cd evolution
docker compose up -d
```

Depois, conecte o número de WhatsApp pela Evolution API e aponte o webhook para o backend.

## Autenticação

O login usa JWT. As senhas são armazenadas com hash (bcryptjs) e o mesmo token autentica as chamadas HTTP e as conexões em tempo real.

## Autor

Marcelino Souza — [GitHub](https://github.com/marcellino-dev) · [LinkedIn](https://linkedin.com/in/marcelino-dev)
