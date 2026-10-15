import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import ticketRoutes from './modules/tickets/ticket.routes';
import sectorRoutes from './modules/sectors/sector.routes';
import botRoutes from './modules/bot/bot.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    app: 'chatZ',
    status: 'ok',
    message: 'chatZ rodando 🚀',
    version: '0.1.0',
  });
});

app.use('/auth', authRoutes);
app.use('/tickets', ticketRoutes);
app.use('/sectors', sectorRoutes);
app.use('/bot', botRoutes);
app.use('/whatsapp', whatsappRoutes);

app.use(errorHandler);

export default app;