import { api } from './client';

export interface Region {
  id: number;
  name: string;
  full_name: string | null;
  level: 'nation' | 'province' | 'city' | 'district' | 'town';
  parent_id: number | null;
  code: string | null;
}

export interface Club {
  id: number;
  name: string;
  region_id: number | null;
  description: string | null;
  address: string | null;
  leader_user_id: number | null;
  join_type: 'open' | 'approval' | 'invite';
  is_public: boolean;
  logo_image: string | null;
  member_count: number;
  created_at: string;
  region_name: string | null;
  leader_name: string | null;
}

export interface ClubMembership {
  id: number;
  club_id: number;
  user_id: number;
  member_id: number | null;
  role: 'leader' | 'admin' | 'member';
  status: 'pending' | 'approved' | 'rejected' | 'banned';
  display_name: string | null;
  joined_at: string;
  club_name: string;
}

export interface CheckNameResult {
  exactMatch: boolean;
  exactMatches: Club[];
  similarClubs: Club[];
}

export const clubsApi = {
  // 클럽 검색
  search: (params?: { keyword?: string; regionId?: number; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.keyword) searchParams.set('keyword', params.keyword);
    if (params?.regionId) searchParams.set('regionId', params.regionId.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const query = searchParams.toString();
    return api.get<Club[]>(`/clubs/search${query ? `?${query}` : ''}`);
  },

  // 클럽 이름 중복 확인
  checkName: (name: string, regionId: number) =>
    api.get<CheckNameResult>(`/clubs/check-name?name=${encodeURIComponent(name)}&regionId=${regionId}`),

  // 내 클럽 목록
  getMyClubs: () => api.get<ClubMembership[]>('/clubs/my'),

  // 클럽 상세
  getById: (id: number) => api.get<Club>(`/clubs/${id}`),

  // 클럽 생성
  create: (data: {
    name: string;
    regionId: number;
    description?: string;
    address?: string;
    joinType?: 'open' | 'approval' | 'invite';
    isPublic?: boolean;
  }) => api.post<Club>('/clubs', data),

  // 클럽 수정
  update: (id: number, data: Partial<Club>) => api.patch<Club>(`/clubs/${id}`, data),

  // 클럽 가입 신청
  join: (id: number, displayName?: string) =>
    api.post<{ success: boolean; status: string; message: string }>(`/clubs/${id}/join`, { displayName }),
};

export const regionsApi = {
  // 모든 지역
  getAll: () => api.get<Region[]>('/regions'),

  // 레벨별 지역
  getByLevel: (level: string) => api.get<Region[]>(`/regions/level/${level}`),

  // 하위 지역
  getChildren: (parentId: number) => api.get<Region[]>(`/regions/${parentId}/children`),
};
