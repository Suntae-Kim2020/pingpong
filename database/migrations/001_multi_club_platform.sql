-- 탁구 플랫폼 확장: 멀티 클럽 지원
-- Migration: 001_multi_club_platform.sql

USE pingpong_club;

-- =============================================
-- 1. 사용자 테이블 (소셜 로그인)
-- =============================================
CREATE TABLE IF NOT EXISTS user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider ENUM('naver', 'kakao', 'google') NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  name VARCHAR(100) NOT NULL,
  nickname VARCHAR(100),
  profile_image VARCHAR(500),
  phone VARCHAR(20),
  birth_year INT,
  gender ENUM('M', 'F'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE KEY unique_provider (provider, provider_id),
  INDEX idx_email (email)
);

-- =============================================
-- 2. 지역 테이블 (행정구역)
-- =============================================
CREATE TABLE IF NOT EXISTS region (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  full_name VARCHAR(255),  -- 전체 경로 (예: 경기도 성남시 분당구)
  level ENUM('nation', 'province', 'city', 'district', 'town') NOT NULL,
  parent_id INT,
  code VARCHAR(20),  -- 행정구역 코드
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES region(id) ON DELETE SET NULL,
  INDEX idx_level (level),
  INDEX idx_parent (parent_id)
);

-- =============================================
-- 3. 클럽 테이블 확장
-- =============================================
ALTER TABLE club
  ADD COLUMN IF NOT EXISTS region_id INT AFTER name,
  ADD COLUMN IF NOT EXISTS description TEXT AFTER region_id,
  ADD COLUMN IF NOT EXISTS address VARCHAR(255) AFTER description,
  ADD COLUMN IF NOT EXISTS leader_user_id INT AFTER address,
  ADD COLUMN IF NOT EXISTS join_type ENUM('open', 'approval', 'invite') DEFAULT 'approval' AFTER leader_user_id,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE AFTER join_type,
  ADD COLUMN IF NOT EXISTS logo_image VARCHAR(500) AFTER is_public,
  ADD COLUMN IF NOT EXISTS member_count INT DEFAULT 0 AFTER logo_image,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- 외래키 추가 (기존 데이터가 있으면 에러 방지)
-- ALTER TABLE club ADD FOREIGN KEY (region_id) REFERENCES region(id) ON DELETE SET NULL;
-- ALTER TABLE club ADD FOREIGN KEY (leader_user_id) REFERENCES user(id) ON DELETE SET NULL;

-- =============================================
-- 4. 클럽 멤버십 테이블 (사용자-클럽 연결)
-- =============================================
CREATE TABLE IF NOT EXISTS club_membership (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  user_id INT NOT NULL,
  member_id INT,  -- 기존 member 테이블과 연결 (경기 기록용)
  role ENUM('leader', 'admin', 'member') DEFAULT 'member',
  status ENUM('pending', 'approved', 'rejected', 'banned') DEFAULT 'pending',
  display_name VARCHAR(100),  -- 클럽 내 표시 이름
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by INT,  -- 승인한 user_id
  FOREIGN KEY (club_id) REFERENCES club(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES member(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by) REFERENCES user(id) ON DELETE SET NULL,
  UNIQUE KEY unique_club_user (club_id, user_id),
  INDEX idx_user_clubs (user_id),
  INDEX idx_club_members (club_id, status)
);

-- =============================================
-- 5. 기본 지역 데이터 삽입
-- =============================================
INSERT INTO region (name, full_name, level, parent_id, code) VALUES
-- 전국
('전국', '전국', 'nation', NULL, '00'),

-- 특별시/광역시/도
('서울특별시', '서울특별시', 'province', 1, '11'),
('부산광역시', '부산광역시', 'province', 1, '26'),
('대구광역시', '대구광역시', 'province', 1, '27'),
('인천광역시', '인천광역시', 'province', 1, '28'),
('광주광역시', '광주광역시', 'province', 1, '29'),
('대전광역시', '대전광역시', 'province', 1, '30'),
('울산광역시', '울산광역시', 'province', 1, '31'),
('세종특별자치시', '세종특별자치시', 'province', 1, '36'),
('경기도', '경기도', 'province', 1, '41'),
('강원도', '강원도', 'province', 1, '42'),
('충청북도', '충청북도', 'province', 1, '43'),
('충청남도', '충청남도', 'province', 1, '44'),
('전라북도', '전라북도', 'province', 1, '45'),
('전라남도', '전라남도', 'province', 1, '46'),
('경상북도', '경상북도', 'province', 1, '47'),
('경상남도', '경상남도', 'province', 1, '48'),
('제주특별자치도', '제주특별자치도', 'province', 1, '50')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 서울 구 (예시)
INSERT INTO region (name, full_name, level, parent_id, code) VALUES
('강남구', '서울특별시 강남구', 'district', 2, '11680'),
('강동구', '서울특별시 강동구', 'district', 2, '11740'),
('강북구', '서울특별시 강북구', 'district', 2, '11305'),
('강서구', '서울특별시 강서구', 'district', 2, '11500'),
('관악구', '서울특별시 관악구', 'district', 2, '11620'),
('광진구', '서울특별시 광진구', 'district', 2, '11215'),
('구로구', '서울특별시 구로구', 'district', 2, '11530'),
('금천구', '서울특별시 금천구', 'district', 2, '11545'),
('노원구', '서울특별시 노원구', 'district', 2, '11350'),
('도봉구', '서울특별시 도봉구', 'district', 2, '11320'),
('동대문구', '서울특별시 동대문구', 'district', 2, '11230'),
('동작구', '서울특별시 동작구', 'district', 2, '11590'),
('마포구', '서울특별시 마포구', 'district', 2, '11440'),
('서대문구', '서울특별시 서대문구', 'district', 2, '11410'),
('서초구', '서울특별시 서초구', 'district', 2, '11650'),
('성동구', '서울특별시 성동구', 'district', 2, '11200'),
('성북구', '서울특별시 성북구', 'district', 2, '11290'),
('송파구', '서울특별시 송파구', 'district', 2, '11710'),
('양천구', '서울특별시 양천구', 'district', 2, '11470'),
('영등포구', '서울특별시 영등포구', 'district', 2, '11560'),
('용산구', '서울특별시 용산구', 'district', 2, '11170'),
('은평구', '서울특별시 은평구', 'district', 2, '11380'),
('종로구', '서울특별시 종로구', 'district', 2, '11110'),
('중구', '서울특별시 중구', 'district', 2, '11140'),
('중랑구', '서울특별시 중랑구', 'district', 2, '11260')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 경기도 시/군 (예시)
INSERT INTO region (name, full_name, level, parent_id, code) VALUES
('수원시', '경기도 수원시', 'city', 10, '41110'),
('성남시', '경기도 성남시', 'city', 10, '41130'),
('용인시', '경기도 용인시', 'city', 10, '41460'),
('부천시', '경기도 부천시', 'city', 10, '41190'),
('안산시', '경기도 안산시', 'city', 10, '41270'),
('안양시', '경기도 안양시', 'city', 10, '41170'),
('남양주시', '경기도 남양주시', 'city', 10, '41360'),
('화성시', '경기도 화성시', 'city', 10, '41590'),
('평택시', '경기도 평택시', 'city', 10, '41220'),
('의정부시', '경기도 의정부시', 'city', 10, '41150'),
('시흥시', '경기도 시흥시', 'city', 10, '41390'),
('파주시', '경기도 파주시', 'city', 10, '41480'),
('광명시', '경기도 광명시', 'city', 10, '41210'),
('김포시', '경기도 김포시', 'city', 10, '41570'),
('군포시', '경기도 군포시', 'city', 10, '41410'),
('광주시', '경기도 광주시', 'city', 10, '41610'),
('이천시', '경기도 이천시', 'city', 10, '41500'),
('양주시', '경기도 양주시', 'city', 10, '41630'),
('오산시', '경기도 오산시', 'city', 10, '41370'),
('구리시', '경기도 구리시', 'city', 10, '41310'),
('안성시', '경기도 안성시', 'city', 10, '41550'),
('포천시', '경기도 포천시', 'city', 10, '41650'),
('의왕시', '경기도 의왕시', 'city', 10, '41430'),
('하남시', '경기도 하남시', 'city', 10, '41450'),
('여주시', '경기도 여주시', 'city', 10, '41670'),
('동두천시', '경기도 동두천시', 'city', 10, '41250'),
('과천시', '경기도 과천시', 'city', 10, '41290')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 성남시 구 (예시)
INSERT INTO region (name, full_name, level, parent_id, code) VALUES
('분당구', '경기도 성남시 분당구', 'district', (SELECT id FROM (SELECT id FROM region WHERE name = '성남시' AND level = 'city') as t), '41135'),
('수정구', '경기도 성남시 수정구', 'district', (SELECT id FROM (SELECT id FROM region WHERE name = '성남시' AND level = 'city') as t), '41131'),
('중원구', '경기도 성남시 중원구', 'district', (SELECT id FROM (SELECT id FROM region WHERE name = '성남시' AND level = 'city') as t), '41133')
ON DUPLICATE KEY UPDATE name = VALUES(name);
