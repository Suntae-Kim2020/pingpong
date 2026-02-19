import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import NavBar from './components/NavBar';
import HomePage from './pages/HomePage';
import MeetingPage from './pages/MeetingPage';
import ResultPage from './pages/ResultPage';
import TournamentPage from './pages/TournamentPage';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ClubSearchPage from './pages/ClubSearchPage';
import VideoManagePage from './pages/VideoManagePage';
import PlayerStatsPage from './pages/PlayerStatsPage';
import RankingPage from './pages/RankingPage';
import MyClubsPage from './pages/MyClubsPage';
import ClubManagePage from './pages/ClubManagePage';
import InvitePage from './pages/InvitePage';
import NotificationPage from './pages/NotificationPage';
import AttendanceCheckPage from './pages/AttendanceCheckPage';
import AttendanceNoticePage from './pages/AttendanceNoticePage';
import ProfilePage from './pages/ProfilePage';
import RoulettePage from './pages/RoulettePage';
import GameRoomPage from './pages/GameRoomPage';
import GameRecordPage from './pages/GameRecordPage';
import CumulativeMatchPage from './pages/CumulativeMatchPage';
import SignupPage from './pages/SignupPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/:provider/callback" element={<AuthCallbackPage />} />
          <Route path="/clubs" element={<ClubSearchPage />} />
          <Route path="/my-clubs" element={<MyClubsPage />} />
          <Route path="/clubs/:id/manage" element={<ClubManagePage />} />
          <Route path="/clubs/invite/:token" element={<InvitePage />} />
          <Route path="/notifications" element={<NotificationPage />} />
          <Route path="/admin/videos" element={<VideoManagePage />} />
          <Route path="/meeting/:id" element={<MeetingPage />} />
          <Route path="/meeting/:id/result" element={<ResultPage />} />
          <Route path="/meeting/:id/tournament" element={<TournamentPage />} />
          <Route path="/player/:memberId" element={<PlayerStatsPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/clubs/:clubId/attendance" element={<AttendanceCheckPage />} />
          <Route path="/clubs/:clubId/attendance/notices" element={<AttendanceNoticePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/roulette" element={<RoulettePage />} />
          <Route path="/game-record" element={<GameRecordPage />} />
          <Route path="/clubs/:clubId/cumulative-matches" element={<CumulativeMatchPage />} />
          <Route path="/clubs/:clubId/game-rooms" element={<GameRoomPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
