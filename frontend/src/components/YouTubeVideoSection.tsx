import { useEffect, useState } from 'react';
import { youtubeApi } from '../api/youtube';
import type { YouTubeVideo } from '../types';

export default function YouTubeVideoSection() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    youtubeApi.getActive().then((data) => {
      setVideos(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading || videos.length === 0) return null;

  const shorts = videos.filter((v) => v.video_type === 'shorts');
  const regularVideos = videos.filter((v) => v.video_type === 'video');

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* 쇼츠 섹션 */}
      {shorts.length > 0 && (
        <div className="card">
          <h2 className="card-title">탁구 쇼츠</h2>
          <div className="youtube-shorts-scroll">
            {shorts.map((v) => (
              <a
                key={v.id}
                href={v.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="youtube-shorts-item"
              >
                <img
                  src={`https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                  alt={v.title}
                  className="youtube-shorts-thumb"
                />
                <div className="youtube-shorts-title">{v.title}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 일반 영상 섹션 */}
      {regularVideos.length > 0 && (
        <div className="card">
          <h2 className="card-title">탁구 영상</h2>
          <div className="youtube-video-grid">
            {regularVideos.map((v) => (
              <a
                key={v.id}
                href={v.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="youtube-video-item"
              >
                <img
                  src={`https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`}
                  alt={v.title}
                  className="youtube-video-thumb"
                />
                <div className="youtube-video-title">{v.title}</div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
