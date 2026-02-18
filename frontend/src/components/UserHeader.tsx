import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function UserHeader() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      padding: '10px 20px',
      background: 'rgba(255,255,255,0.1)',
    }}>
      {isAuthenticated && user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user.profile_image && (
            <img
              src={user.profile_image}
              alt={user.name}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          )}
          <span style={{ color: 'white', fontSize: '14px' }}>
            {user.nickname || user.name}
          </span>
          <button
            onClick={logout}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            로그아웃
          </button>
        </div>
      ) : (
        <button
          onClick={() => navigate('/login')}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            background: 'white',
            border: 'none',
            borderRadius: '4px',
            color: '#333',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          로그인
        </button>
      )}
    </div>
  );
}
