import { api } from './client';
import type { YouTubeVideo } from '../types';

export const youtubeApi = {
  getActive: () => api.get<YouTubeVideo[]>('/youtube'),
  getAll: () => api.get<YouTubeVideo[]>('/youtube/all'),
  create: (data: {
    video_type: 'shorts' | 'video';
    youtube_url: string;
    youtube_id: string;
    title: string;
    display_order?: number;
  }) => api.post<YouTubeVideo>('/youtube', data),
  update: (id: number, data: {
    title?: string;
    display_order?: number;
    is_active?: boolean;
  }) => api.put<YouTubeVideo>(`/youtube/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/youtube/${id}`),
};
