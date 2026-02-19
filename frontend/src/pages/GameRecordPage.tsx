import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function GameRecordPage() {
  const { isAuthenticated, activeClubId } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated || !activeClubId) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '16px' }}>게임기록</h2>
        <p style={{ color: '#666' }}>
          {!isAuthenticated
            ? '로그인 후 이용할 수 있습니다.'
            : '클럽에 가입한 후 이용할 수 있습니다.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
      <h2 style={{ marginBottom: '24px', textAlign: 'center' }}>게임기록</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          onClick={() => navigate(`/clubs/${activeClubId}/cumulative-matches`)}
          style={cardStyle}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1976d2')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0e0e0')}
        >
          <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: '#1976d2' }}>
            누적경기기록
          </div>
          <div style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
            상대를 선택해 경기결과를 누적 기록합니다.<br />
            내 전적과 상대별 승패를 확인할 수 있습니다.
          </div>
        </div>

        <div
          onClick={() => navigate(`/clubs/${activeClubId}/game-rooms`)}
          style={cardStyle}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1976d2')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0e0e0')}
        >
          <div style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: '#1976d2' }}>
            기록경기상황판
          </div>
          <div style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
            게임방을 만들어 조편성 후 경기를 진행합니다.<br />
            실시간 기록과 순위를 확인할 수 있습니다.
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: '24px',
  border: '2px solid #e0e0e0',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  background: 'white',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};
