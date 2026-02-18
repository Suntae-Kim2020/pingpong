# 탁구동호회 월례회 시스템

탁구동호회 월례회를 위한 조편성, 경기 기록, 토너먼트 관리 시스템입니다.

## 기술 스택

- **백엔드**: Node.js + Express + TypeScript
- **프론트엔드**: React + TypeScript + Vite
- **데이터베이스**: MySQL

## 프로젝트 구조

```
givemechanNew/
├── backend/          # Express API 서버
├── frontend/         # React 웹 클라이언트
├── database/         # SQL 스키마
└── shared/           # 공유 타입 정의
```

## 설치 및 실행

### 1. 데이터베이스 설정

```bash
# MySQL에서 스키마 실행
mysql -u root -p < database/schema.sql
```

### 2. 백엔드 설정

```bash
cd backend

# 환경변수 설정
cp .env.example .env
# .env 파일에서 DB 설정 수정

# 의존성 설치 및 실행
npm install
npm run dev
```

백엔드는 http://localhost:3001 에서 실행됩니다.

### 3. 프론트엔드 설정

```bash
cd frontend

# 의존성 설치 및 실행
npm install
npm run dev
```

프론트엔드는 http://localhost:3000 에서 실행됩니다.

## 사용 방법

### 월례회 진행 흐름

1. **월례회 생성**: 연도/월, 조 수, 진출률 설정
2. **참가 신청**: 회원 선택하여 신청 (늦은 참가 체크 가능)
3. **조편성**: 스네이크 드래프트로 자동 배정, 드래그앤드롭으로 수동 조정
4. **경기 기록**: 조별 리그전 결과 입력
5. **토너먼트**: 진출자 대진표 생성, 승자 기록
6. **종료**: 월례회 마감

### 조편성 알고리즘

- **스네이크 드래프트**: 부수 순으로 정렬 후 지그재그 배치
- **배우자 회피**: 같은 조에 배우자가 배정되지 않도록 처리
- **핌플 밸런싱**: 각 조의 핌플 선수 수 차이를 1 이하로 유지

### 순위 계산 (타이브레이커)

1. 승수 (많은 순)
2. 동률자 간 상대전적
3. 동률자 간 이긴 세트 수
4. 나이 (고령자 우선)

### 토너먼트 대진표

- 2의 거듭제곱 브라켓 자동 생성
- 시드 배치 (1위 vs 꼴찌, 2위 vs 꼴찌-1...)
- 같은 조 1라운드 충돌 회피
- 부전승 자동 처리

## API 엔드포인트

### 월례회
- `GET /api/meetings/current` - 현재 월례회 조회
- `POST /api/meetings` - 월례회 생성
- `PATCH /api/meetings/:id/status` - 상태 변경

### 신청
- `GET /api/meetings/:id/applicants` - 신청자 목록
- `POST /api/meetings/:id/apply` - 참가 신청
- `DELETE /api/meetings/:id/apply/:memberId` - 신청 취소

### 조편성
- `GET /api/meetings/:id/groups` - 조편성 결과
- `POST /api/meetings/:id/assign` - 자동 조편성
- `PATCH /api/meetings/:id/assign/complete` - 조편성 확정
- `PUT /api/meetings/:id/groups/:memberId` - 멤버 재배정

### 경기 기록
- `GET /api/meetings/:id/groups/:groupNum/matches` - 조별 경기 목록
- `POST /api/meetings/:id/matches` - 경기 결과 저장
- `DELETE /api/meetings/:id/matches` - 경기 결과 삭제
- `GET /api/meetings/:id/groups/:groupNum/ranking` - 조별 순위

### 토너먼트
- `GET /api/meetings/:id/tournament` - 대진표 조회
- `POST /api/meetings/:id/tournament` - 대진표 생성
- `PATCH /api/meetings/:id/tournament/:matchId/winner` - 승자 설정
