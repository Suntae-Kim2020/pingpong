import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallbackPage() {
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        setError('로그인이 취소되었습니다.');
        return;
      }

      if (!code || !provider) {
        setError('잘못된 요청입니다.');
        return;
      }

      try {
        await handleCallback(provider, code, state || undefined);
        navigate('/');
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('로그인 처리 중 오류가 발생했습니다.');
      }
    };

    processCallback();
  }, [provider, searchParams, handleCallback, navigate]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
      }}>
        <p style={{ color: '#e53e3e', marginBottom: '20px' }}>{error}</p>
        <button
          onClick={() => navigate('/login')}
          style={{
            padding: '12px 24px',
            background: '#3182ce',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          다시 로그인
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTopColor: '#3182ce',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p>로그인 처리 중...</p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
