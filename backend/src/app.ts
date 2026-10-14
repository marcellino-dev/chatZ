import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';
import ticketRoutes from './modules/tickets/ticket.routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

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

// Error handler (sempre por último!)
app.use(errorHandler);

export default app;