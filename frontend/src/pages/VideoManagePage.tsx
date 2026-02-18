import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { youtubeApi } from '../api/youtube';
import type { YouTubeVideo, VideoType } from '../types';

function parseYouTubeId(url: string): string | null {
  // shorts: https://youtube.com/shorts/VIDEO_ID
  const shortsMatch = url.match(/(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  // standard: https://www.youtube.com/watch?v=VIDEO_ID
  const standardMatch = url.match(/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
  if (standardMatch) return standardMatch[1];
  // short url: https://youtu.be/VIDEO_ID
  const shortMatch = url.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  // embed: https://www.youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  return null;
}

function detectVideoType(url: string): VideoType {
  if (url.includes('/shorts/')) return 'shorts';
  return 'video';
}

function VideoManagePage() {
  const { isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [videoType, setVideoType] = useState<VideoType>('video');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [parsedId, setParsedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOrder, setEditOrder] = useState(0);

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    if (url) {
      const id = parseYouTubeId(url);
      setParsedId(id);
      setVideoType(detectVideoType(url));
    } else {
      setParsedId(null);
    }
  }, [url]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const data = await youtubeApi.getAll();
      setVideos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '영상 목록 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedId) {
      setError('유효한 YouTube URL을 입력해주세요.');
      return;
    }
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await youtubeApi.create({
        video_type: videoType,
        youtube_url: url,
        youtube_id: parsedId,
        title: title.trim(),
        display_order: displayOrder,
      });
      setUrl('');
      setTitle('');
      setDisplayOrder(0);
      setParsedId(null);
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (video: YouTubeVideo) => {
    try {
      setError(null);
      await youtubeApi.update(video.id, { is_active: !video.is_active });
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : '변경 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('이 영상을 삭제하시겠습니까?')) return;
    try {
      setError(null);
      await youtubeApi.delete(id);
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    }
  };

  const handleEditSave = async (id: number) => {
    try {
      setError(null);
      await youtubeApi.update(id, { title: editTitle, display_order: editOrder });
      setEditingId(null);
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정 실패');
    }
  };

  const startEdit = (video: YouTubeVideo) => {
    setEditingId(video.id);
    setEditTitle(video.title);
    setEditOrder(video.display_order);
  };

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, isAdmin, navigate]);

  if (authLoading || loading) return <div className="loading">Loading...</div>;
  if (!isAdmin) return null;

  return (
    <div className="container">
      <h1 style={{ marginBottom: '20px', fontSize: '1.5rem' }}>YouTube 영상 관리</h1>

      {error && <div className="error">{error}</div>}

      {/* 등록 폼 */}
      <div className="card">
        <h2 className="card-title">영상 등록</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>YouTube URL</label>
            <input
              type="text"
              className="form-control"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/shorts/... 또는 https://youtube.com/watch?v=..."
            />
            {url && (
              <div style={{ marginTop: '5px', fontSize: '12px', color: parsedId ? '#388e3c' : '#d32f2f' }}>
                {parsedId
                  ? `영상 ID: ${parsedId} | 유형: ${videoType === 'shorts' ? '쇼츠' : '일반 영상'}`
                  : '유효하지 않은 YouTube URL입니다.'}
              </div>
            )}
          </div>

          {parsedId && (
            <div style={{ marginBottom: '15px' }}>
              <img
                src={`https://img.youtube.com/vi/${parsedId}/hqdefault.jpg`}
                alt="썸네일 미리보기"
                style={{ width: '200px', borderRadius: '4px' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '15px' }}>
            <div className="form-group" style={{ flex: 2 }}>
              <label>제목</label>
              <input
                type="text"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="영상 제목"
              />
            </div>
            <div className="form-group" style={{ flex: 0, minWidth: '80px' }}>
              <label>유형</label>
              <select
                className="form-control"
                value={videoType}
                onChange={(e) => setVideoType(e.target.value as VideoType)}
              >
                <option value="shorts">쇼츠</option>
                <option value="video">일반</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 0, minWidth: '80px' }}>
              <label>순서</label>
              <input
                type="number"
                className="form-control"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting || !parsedId}>
            {submitting ? '등록 중...' : '등록'}
          </button>
        </form>
      </div>

      {/* 영상 목록 */}
      <div className="card">
        <h2 className="card-title">등록된 영상 ({videos.length}개)</h2>
        {videos.length === 0 ? (
          <p style={{ color: '#666' }}>등록된 영상이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {videos.map((v) => (
              <div
                key={v.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px',
                  background: v.is_active ? '#f9f9f9' : '#fafafa',
                  borderRadius: '4px',
                  opacity: v.is_active ? 1 : 0.6,
                  border: v.is_active ? '1px solid #e0e0e0' : '1px solid #eee',
                }}
              >
                <img
                  src={`https://img.youtube.com/vi/${v.youtube_id}/default.jpg`}
                  alt={v.title}
                  style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                />

                {editingId === v.id ? (
                  <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      style={{ flex: 2, minWidth: '120px' }}
                    />
                    <input
                      type="number"
                      className="form-control"
                      value={editOrder}
                      onChange={(e) => setEditOrder(parseInt(e.target.value) || 0)}
                      style={{ width: '70px' }}
                    />
                    <button className="btn btn-primary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => handleEditSave(v.id)}>저장</button>
                    <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={() => setEditingId(null)}>취소</button>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {v.video_type === 'shorts' ? '쇼츠' : '일반'} | 순서: {v.display_order} | {v.is_active ? '활성' : '비활성'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                        onClick={() => startEdit(v)}
                      >
                        수정
                      </button>
                      <button
                        className={`btn ${v.is_active ? 'btn-secondary' : 'btn-success'}`}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                        onClick={() => handleToggleActive(v)}
                      >
                        {v.is_active ? '숨김' : '표시'}
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                        onClick={() => handleDelete(v.id)}
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoManagePage;
