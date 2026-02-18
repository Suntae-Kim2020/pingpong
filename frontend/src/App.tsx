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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavBar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/:provider/callback" element={<AuthCallbackPage />} />
          <Route path="/clubs" element={<ClubSearchPage />} />
          <Route path="/admin/videos" element={<VideoManagePage />} />
          <Route path="/meeting/:id" element={<MeetingPage />} />
          <Route path="/meeting/:id/result" element={<ResultPage />} />
          <Route path="/meeting/:id/tournament" element={<TournamentPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
