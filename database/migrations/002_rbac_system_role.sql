-- RBAC: user 테이블에 시스템 역할 컬럼 추가
-- 실행: mysql -u root -p givemechan < database/migrations/002_rbac_system_role.sql

ALTER TABLE user ADD COLUMN role ENUM('super_admin','admin','user') NOT NULL DEFAULT 'user' AFTER is_active;
CREATE INDEX idx_user_role ON user(role);

-- 관리자 지정 (필요시 수동 실행):
-- UPDATE user SET role='super_admin' WHERE id=?;
