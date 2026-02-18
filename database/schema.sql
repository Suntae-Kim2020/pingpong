-- 탁구동호회 월례회 시스템 데이터베이스 스키마
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS pingpong_club
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pingpong_club;

-- 기존 테이블 삭제 (순서 중요)
DROP TABLE IF EXISTS youtube_video;
DROP TABLE IF EXISTS meeting_team_match_game;
DROP TABLE IF EXISTS meeting_team_match;
DROP TABLE IF EXISTS meeting_tournament;
DROP TABLE IF EXISTS meeting_match;
DROP TABLE IF EXISTS meeting_group;
DROP TABLE IF EXISTS meeting_applicant;
DROP TABLE IF EXISTS monthly_meeting;
DROP TABLE IF EXISTS member;
DROP TABLE IF EXISTS club;

-- 동호회 테이블
CREATE TABLE club (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 회원 테이블
CREATE TABLE member (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  birth_year INT NOT NULL,
  gender ENUM('M', 'F') NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  local_busu INT DEFAULT NULL CHECK (local_busu >= 1 AND local_busu <= 8), -- 지역부수
  open_busu INT DEFAULT NULL CHECK (open_busu >= 1 AND open_busu <= 8),   -- 오픈부수
  play_style ENUM('양핸드전진속공', '드라이브', '커트', '펜홀더공격', '쉐이크공격', '수비', '올라운드') DEFAULT '올라운드',
  pimple_type ENUM('none', 'short', 'long') DEFAULT 'none', -- 핌플 타입
  spouse_id INT DEFAULT NULL, -- 배우자 회원 ID
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES club(id),
  FOREIGN KEY (spouse_id) REFERENCES member(id) ON DELETE SET NULL
);

-- 월례회 테이블
CREATE TABLE monthly_meeting (
  id INT AUTO_INCREMENT PRIMARY KEY,
  club_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  group_count INT NOT NULL CHECK (group_count >= 2), -- 조 수
  advance_rate DECIMAL(3, 2) NOT NULL DEFAULT 0.50, -- 진출률 (0.0 ~ 1.0)
  has_upper_tournament BOOLEAN DEFAULT TRUE,  -- 상위부 토너먼트 여부
  has_lower_tournament BOOLEAN DEFAULT FALSE, -- 하위부 토너먼트 여부
  match_type ENUM('individual', 'team') DEFAULT 'individual', -- 경기 유형 (개인전/단체전)
  team_size INT DEFAULT 0, -- 단체전 팀당 인원 수
  team_match_format VARCHAR(20) DEFAULT 'dd', -- 단체전 경기 형식 (dd/ddd/ddb/dddb)
  status ENUM('open', 'assigning', 'assigned', 'recording', 'tournament', 'closed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (club_id) REFERENCES club(id)
);

-- 월례회 신청자 테이블
CREATE TABLE meeting_applicant (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id INT NOT NULL,
  member_id INT NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_late BOOLEAN DEFAULT FALSE, -- 늦은 참가자 여부
  FOREIGN KEY (meeting_id) REFERENCES monthly_meeting(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES member(id),
  UNIQUE KEY unique_applicant (meeting_id, member_id)
);

-- 조편성 결과 테이블
CREATE TABLE meeting_group (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id INT NOT NULL,
  group_num INT NOT NULL, -- 조 번호 (1, 2, 3...)
  member_id INT NOT NULL,
  order_in_group INT NOT NULL, -- 조 내 순서 (1, 2, 3...)
  FOREIGN KEY (meeting_id) REFERENCES monthly_meeting(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES member(id),
  UNIQUE KEY unique_group_member (meeting_id, member_id),
  INDEX idx_meeting_group (meeting_id, group_num)
);

-- 경기 기록 테이블 (국제탁구규칙: 5세트 3선승 또는 7세트 4선승)
CREATE TABLE meeting_match (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id INT NOT NULL,
  group_num INT NOT NULL,
  player1_id INT NOT NULL,
  player2_id INT NOT NULL,
  player1_sets INT NOT NULL DEFAULT 0, -- 플레이어1이 이긴 세트 수
  player2_sets INT NOT NULL DEFAULT 0, -- 플레이어2가 이긴 세트 수
  -- 각 세트별 점수 기록 (국제규칙: 11점 선취, 듀스시 2점차)
  set1_p1 INT DEFAULT NULL, set1_p2 INT DEFAULT NULL,
  set2_p1 INT DEFAULT NULL, set2_p2 INT DEFAULT NULL,
  set3_p1 INT DEFAULT NULL, set3_p2 INT DEFAULT NULL,
  set4_p1 INT DEFAULT NULL, set4_p2 INT DEFAULT NULL,
  set5_p1 INT DEFAULT NULL, set5_p2 INT DEFAULT NULL,
  set6_p1 INT DEFAULT NULL, set6_p2 INT DEFAULT NULL,
  set7_p1 INT DEFAULT NULL, set7_p2 INT DEFAULT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES monthly_meeting(id) ON DELETE CASCADE,
  FOREIGN KEY (player1_id) REFERENCES member(id),
  FOREIGN KEY (player2_id) REFERENCES member(id),
  UNIQUE KEY unique_match (meeting_id, player1_id, player2_id),
  CHECK (player1_id < player2_id), -- 항상 player1_id가 더 작은 ID
  INDEX idx_meeting_match (meeting_id, group_num)
);

-- 토너먼트 대진표 테이블
CREATE TABLE meeting_tournament (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id INT NOT NULL,
  division ENUM('upper', 'lower') DEFAULT 'upper', -- 상위부/하위부 구분
  round INT NOT NULL, -- 라운드 (1=결승, 2=준결승, 4=8강, 8=16강...)
  match_order INT NOT NULL, -- 해당 라운드 내 경기 순서 (1, 2, 3...)
  player1_id INT DEFAULT NULL,
  player2_id INT DEFAULT NULL,
  winner_id INT DEFAULT NULL,
  player1_from_group INT DEFAULT NULL, -- 선수1 원래 조
  player2_from_group INT DEFAULT NULL, -- 선수2 원래 조
  -- 경기 점수 (국제규칙)
  player1_sets INT DEFAULT 0,
  player2_sets INT DEFAULT 0,
  is_bye BOOLEAN DEFAULT FALSE, -- 부전승 여부
  FOREIGN KEY (meeting_id) REFERENCES monthly_meeting(id) ON DELETE CASCADE,
  FOREIGN KEY (player1_id) REFERENCES member(id),
  FOREIGN KEY (player2_id) REFERENCES member(id),
  FOREIGN KEY (winner_id) REFERENCES member(id),
  INDEX idx_meeting_tournament (meeting_id, division, round, match_order)
);

-- 단체전 팀 대 팀 경기 기록 테이블
CREATE TABLE meeting_team_match (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id INT NOT NULL,
  team1_num INT NOT NULL,
  team2_num INT NOT NULL,
  team1_score INT DEFAULT 0,
  team2_score INT DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES monthly_meeting(id) ON DELETE CASCADE,
  UNIQUE KEY unique_team_match (meeting_id, team1_num, team2_num),
  CHECK (team1_num < team2_num),
  INDEX idx_meeting_team (meeting_id)
);

-- 단체전 개별 경기 기록 테이블 (팀 대항전 내 개인 경기)
CREATE TABLE meeting_team_match_game (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id INT NOT NULL,
  team1_num INT NOT NULL,
  team2_num INT NOT NULL,
  game_order INT NOT NULL,
  game_type ENUM('singles', 'doubles') DEFAULT 'singles',
  team1_player1_id INT DEFAULT NULL,
  team1_player2_id INT DEFAULT NULL,
  team2_player1_id INT DEFAULT NULL,
  team2_player2_id INT DEFAULT NULL,
  winner_team INT DEFAULT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES monthly_meeting(id) ON DELETE CASCADE,
  UNIQUE KEY unique_team_game (meeting_id, team1_num, team2_num, game_order),
  CHECK (team1_num < team2_num),
  INDEX idx_meeting_team_game (meeting_id, team1_num, team2_num)
);

-- YouTube 영상 테이블
CREATE TABLE youtube_video (
  id INT AUTO_INCREMENT PRIMARY KEY,
  video_type ENUM('shorts', 'video') NOT NULL,
  youtube_url VARCHAR(500) NOT NULL,
  youtube_id VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기본 동호회 데이터 삽입
INSERT INTO club (name) VALUES ('탁구동호회');

-- 50명의 샘플 회원 데이터
INSERT INTO member (club_id, name, birth_year, gender, phone, local_busu, open_busu, play_style, pimple_type, is_active) VALUES
-- 1부 선수들 (5명)
(1, '김철수', 1975, 'M', '010-1234-5678', 1, 1, '양핸드전진속공', 'none', TRUE),
(1, '박민수', 1970, 'M', '010-2345-6789', 1, 1, '드라이브', 'none', TRUE),
(1, '윤재호', 1968, 'M', '010-3456-7890', 1, 2, '펜홀더공격', 'long', TRUE),
(1, '오준혁', 1972, 'M', '010-4567-8901', 1, 1, '쉐이크공격', 'none', TRUE),
(1, '정태영', 1973, 'M', '010-5678-9012', 1, 2, '양핸드전진속공', 'none', TRUE),

-- 2부 선수들 (8명)
(1, '최동훈', 1978, 'M', '010-6789-0123', 2, 2, '드라이브', 'none', TRUE),
(1, '한지민', 1976, 'M', '010-7890-1234', 2, 2, '쉐이크공격', 'short', TRUE),
(1, '신동엽', 1974, 'M', '010-8901-2345', 2, 3, '펜홀더공격', 'none', TRUE),
(1, '이승우', 1979, 'M', '010-9012-3456', 2, 2, '올라운드', 'none', TRUE),
(1, '김대현', 1977, 'M', '010-0123-4567', 2, 3, '드라이브', 'long', TRUE),
(1, '박준혁', 1980, 'M', '010-1111-2222', 2, 2, '양핸드전진속공', 'none', TRUE),
(1, '이영희', 1980, 'F', '010-2222-3333', 2, 3, '커트', 'long', TRUE),
(1, '장미란', 1982, 'F', '010-3333-4444', 2, 3, '드라이브', 'none', TRUE),

-- 3부 선수들 (10명)
(1, '강미영', 1982, 'F', '010-4444-5555', 3, 3, '쉐이크공격', 'none', TRUE),
(1, '송은지', 1979, 'F', '010-5555-6666', 3, 4, '올라운드', 'short', TRUE),
(1, '노태우', 1977, 'M', '010-6666-7777', 3, 3, '펜홀더공격', 'none', TRUE),
(1, '황정민', 1981, 'M', '010-7777-8888', 3, 4, '드라이브', 'none', TRUE),
(1, '조현우', 1983, 'M', '010-8888-9999', 3, 3, '쉐이크공격', 'long', TRUE),
(1, '유재석', 1984, 'M', '010-9999-0000', 3, 4, '올라운드', 'none', TRUE),
(1, '김희선', 1983, 'F', '010-1212-3434', 3, 4, '커트', 'short', TRUE),
(1, '박소연', 1985, 'F', '010-2323-4545', 3, 4, '드라이브', 'none', TRUE),
(1, '이민호', 1982, 'M', '010-3434-5656', 3, 3, '양핸드전진속공', 'none', TRUE),
(1, '정우성', 1978, 'M', '010-4545-6767', 3, 4, '펜홀더공격', 'none', TRUE),

-- 4부 선수들 (10명)
(1, '정수진', 1985, 'F', '010-5656-7878', 4, 4, '올라운드', 'short', TRUE),
(1, '권지은', 1986, 'F', '010-6767-8989', 4, 5, '커트', 'long', TRUE),
(1, '배수현', 1988, 'F', '010-7878-9090', 4, 5, '드라이브', 'none', TRUE),
(1, '임서연', 1990, 'F', '010-8989-0101', 4, 5, '쉐이크공격', 'none', TRUE),
(1, '한예슬', 1987, 'F', '010-9090-1212', 4, 4, '올라운드', 'none', TRUE),
(1, '송중기', 1985, 'M', '010-0101-2323', 4, 4, '드라이브', 'none', TRUE),
(1, '공유', 1979, 'M', '010-1313-2424', 4, 5, '펜홀더공격', 'short', TRUE),
(1, '이종석', 1989, 'M', '010-2424-3535', 4, 4, '쉐이크공격', 'none', TRUE),
(1, '현빈', 1982, 'M', '010-3535-4646', 4, 5, '올라운드', 'none', TRUE),
(1, '손예진', 1982, 'F', '010-4646-5757', 4, 4, '드라이브', 'none', TRUE),

-- 5부 선수들 (8명)
(1, '김태희', 1980, 'F', '010-5757-6868', 5, 5, '올라운드', 'none', TRUE),
(1, '전지현', 1981, 'F', '010-6868-7979', 5, 6, '드라이브', 'none', TRUE),
(1, '송혜교', 1981, 'F', '010-7979-8080', 5, 5, '커트', 'short', TRUE),
(1, '이병헌', 1970, 'M', '010-8080-9191', 5, 5, '펜홀더공격', 'none', TRUE),
(1, '정해인', 1988, 'M', '010-9191-0202', 5, 6, '쉐이크공격', 'none', TRUE),
(1, '박보검', 1993, 'M', '010-0202-1313', 5, 5, '드라이브', 'none', TRUE),
(1, '수지', 1994, 'F', '010-1414-2525', 5, 6, '올라운드', 'long', TRUE),
(1, '아이유', 1993, 'F', '010-2525-3636', 5, 5, '드라이브', 'none', TRUE),

-- 6부 선수들 (5명)
(1, '이광수', 1985, 'M', '010-3636-4747', 6, 6, '올라운드', 'none', TRUE),
(1, '김종국', 1976, 'M', '010-4747-5858', 6, 7, '드라이브', 'short', TRUE),
(1, '하하', 1979, 'M', '010-5858-6969', 6, 6, '펜홀더공격', 'none', TRUE),
(1, '지석진', 1966, 'M', '010-6969-7070', 6, 7, '올라운드', 'none', TRUE),
(1, '양세찬', 1986, 'M', '010-7070-8181', 6, 6, '쉐이크공격', 'none', TRUE),

-- 7부 선수들 (4명)
(1, '전소민', 1986, 'F', '010-8181-9292', 7, 7, '올라운드', 'none', TRUE),
(1, '김수현', 1988, 'M', '010-9292-0303', 7, 7, '드라이브', 'none', TRUE),
(1, '박서준', 1988, 'M', '010-0303-1414', 7, 8, '쉐이크공격', 'none', TRUE),
(1, '차은우', 1997, 'M', '010-1515-2626', 7, 7, '드라이브', 'none', TRUE);

-- 배우자 관계 설정
UPDATE member SET spouse_id = (SELECT id FROM (SELECT id FROM member WHERE name = '이영희') as t) WHERE name = '김철수';
UPDATE member SET spouse_id = (SELECT id FROM (SELECT id FROM member WHERE name = '김철수') as t) WHERE name = '이영희';
UPDATE member SET spouse_id = (SELECT id FROM (SELECT id FROM member WHERE name = '손예진') as t) WHERE name = '현빈';
UPDATE member SET spouse_id = (SELECT id FROM (SELECT id FROM member WHERE name = '현빈') as t) WHERE name = '손예진';
