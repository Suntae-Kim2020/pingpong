import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import meetingRoutes from './routes/meetingRoutes';
import memberRoutes from './routes/memberRoutes';
import authRoutes from './routes/authRoutes';
import clubRoutes, { regionRouter } from './routes/clubRoutes';
import youtubeRoutes from './routes/youtubeRoutes';
import statsRoutes from './routes/statsRoutes';
import notificationRoutes from './routes/notificationRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import gameRoomRoutes from './routes/gameRoomRoutes';
import cumulativeMatchRoutes from './routes/cumulativeMatchRoutes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// 업로드 파일 정적 서빙
app.use('/api/uploads', express.static(path.join(__dirname, '../../frontend/public/uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/regions', regionRouter);
app.use('/api/meetings', meetingRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/clubs/:clubId', attendanceRoutes);
app.use('/api/game-rooms', gameRoomRoutes);
app.use('/api/cumulative-matches', cumulativeMatchRoutes);

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
