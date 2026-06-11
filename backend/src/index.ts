import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes';
import { startCronJobs } from './cron';

dotenv.config();

const app = express();
const server = http.createServer(app);

const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(cors({
  origin: clientUrl,
  methods: ['GET', 'POST']
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

app.get('/', (req, res) => {
  res.send('Backend API is running. Access /api/events for data.');
});
app.use('/api', apiRoutes);

if (process.env.NODE_ENV !== 'test') {
  startCronJobs(io);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export { app, server, io };
