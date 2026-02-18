import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import '../styles/LoginPage.css';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleLogin = async (provider: 'naver' | 'kakao' | 'google') => {
    try {
      await login(provider);
    } catch (error) {
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  if (isLoading) {
    return (
      <div className="login-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>탁구인 플랫폼</h1>
          <p>전국 탁구 동호인을 위한 클럽 관리 서비스</p>
        </div>

        <div className="login-buttons">
          <button
            className="login-btn kakao"
            onClick={() => handleLogin('kakao')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="currentColor"
                d="M12 3C6.48 3 2 6.48 2 10.5c0 2.58 1.56 4.84 3.95 6.16l-1.01 3.78c-.08.29.22.54.49.4l4.12-2.72c.77.12 1.58.18 2.45.18 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"
              />
            </svg>
            카카오로 시작하기
          </button>

          <button
            className="login-btn naver"
            onClick={() => handleLogin('naver')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="currentColor"
                d="M16.273 12.845L7.376 3H3v18h4.727V12.155L16.624 21H21V3h-4.727z"
              />
            </svg>
            네이버로 시작하기
          </button>

          <button
            className="login-btn google"
            onClick={() => handleLogin('google')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google로 시작하기
          </button>
        </div>

        <div className="login-footer">
          <p>로그인하면 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</p>
        </div>
      </div>
    </div>
  );
}
