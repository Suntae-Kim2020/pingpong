import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import meetingRoutes from './routes/meetingRoutes';
import memberRoutes from './routes/memberRoutes';
import authRoutes from './routes/authRoutes';
import clubRoutes, { regionRouter } from './routes/clubRoutes';
import youtubeRoutes from './routes/youtubeRoutes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/regions', regionRouter);
app.use('/api/meetings', meetingRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/youtube', youtubeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
