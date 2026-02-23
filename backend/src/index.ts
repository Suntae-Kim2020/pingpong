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
import feeRoutes from './routes/feeRoutes';
import orgRoutes from './routes/orgRoutes';
import { errorHandler } from './middleware/errorHandler';
import { feeModel } from './models/feeModel';
import { orgModel } from './models/orgModel';
import { orgFeeModel } from './models/orgFeeModel';
import { youtubeModel } from './models/youtubeModel';
import { notificationModel } from './models/notificationModel';
import { startCarryoverScheduler } from './services/carryoverScheduler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));

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
app.use('/api/clubs/:clubId', feeRoutes);
app.use('/api/game-rooms', gameRoomRoutes);
app.use('/api/cumulative-matches', cumulativeMatchRoutes);
app.use('/api/orgs', orgRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// 테이블 초기화 → 이월금 스케줄러 시작
feeModel.initTables().then(() => {
  startCarryoverScheduler();
}).catch((err) => {
  console.error('Fee tables init failed:', err);
});

// youtube_video 테이블 컬럼 초기화
youtubeModel.initColumns().catch((err) => {
  console.error('YouTube columns init failed:', err);
});

// notification 테이블 컬럼 초기화
notificationModel.initColumns().catch((err) => {
  console.error('Notification columns init failed:', err);
});

// 조직 테이블 초기화
orgModel.initTables().then(() => {
  return orgFeeModel.initTables();
}).catch((err) => {
  console.error('Org tables init failed:', err);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
