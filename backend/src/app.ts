import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './modules/auth/auth.routes';
import ticketRoutes from './modules/tickets/ticket.routes';
import sectorRoutes from './modules/sectors/sector.routes';
import botRoutes from './modules/bot/bot.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import uploadRoutes from './modules/uploads/upload.routes';
import contactRoutes from './modules/contacts/contact.routes';
import quickReplyRoutes from './modules/quickReplies/quickReply.routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

// Servir arquivos enviados em /uploads/*
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Health check
app.get('/', (req, res) => {
  res.json({
    app: 'chatZ',
    status: 'ok',
    message: 'chatZ rodando 🚀',
    version: '0.1.0',
  });
});

// Rotas
app.use('/auth', authRoutes);
app.use('/tickets', ticketRoutes);
app.use('/sectors', sectorRoutes);
app.use('/contacts', contactRoutes);
app.use('/quick-replies', quickReplyRoutes);
app.use('/bot', botRoutes);
app.use('/whatsapp', whatsappRoutes);
app.use('/uploads', uploadRoutes);

// Error handler
app.use(errorHandler);

export default app;