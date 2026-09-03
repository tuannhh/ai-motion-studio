-- 007 — public_id cho projects & templates (2026-09-03): mã 8 ký tự hex dùng
-- trong URL sub-path /video-da-tao/:slug/:id và /video-template/:slug/:id thay
-- vì lộ id số tự tăng. Idempotent như các changelog trước.

DROP PROCEDURE IF EXISTS add_projects_public_id;
DELIMITER //
CREATE PROCEDURE add_projects_public_id()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'public_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN public_id CHAR(8) NULL AFTER id;
  END IF;
END //
DELIMITER ;
CALL add_projects_public_id();
DROP PROCEDURE IF EXISTS add_projects_public_id;

-- Backfill project cũ chưa có public_id (mỗi dòng random riêng qua UPDATE thường,
-- không phải 1 giá trị chung).
UPDATE projects SET public_id = LOWER(SUBSTRING(MD5(RAND()), 1, 8)) WHERE public_id IS NULL;

DROP PROCEDURE IF EXISTS add_projects_public_id_unique;
DELIMITER //
CREATE PROCEDURE add_projects_public_id_unique()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND index_name = 'uq_projects_public_id'
  ) THEN
    ALTER TABLE projects ADD UNIQUE KEY uq_projects_public_id (public_id);
  END IF;
END //
DELIMITER ;
CALL add_projects_public_id_unique();
DROP PROCEDURE IF EXISTS add_projects_public_id_unique;

DROP PROCEDURE IF EXISTS add_templates_public_id;
DELIMITER //
CREATE PROCEDURE add_templates_public_id()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'templates' AND column_name = 'public_id'
  ) THEN
    ALTER TABLE templates ADD COLUMN public_id CHAR(8) NULL AFTER id;
  END IF;
END //
DELIMITER ;
CALL add_templates_public_id();
DROP PROCEDURE IF EXISTS add_templates_public_id;

UPDATE templates SET public_id = LOWER(SUBSTRING(MD5(RAND()), 1, 8)) WHERE public_id IS NULL;

DROP PROCEDURE IF EXISTS add_templates_public_id_unique;
DELIMITER //
CREATE PROCEDURE add_templates_public_id_unique()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'templates' AND index_name = 'uq_templates_public_id'
  ) THEN
    ALTER TABLE templates ADD UNIQUE KEY uq_templates_public_id (public_id);
  END IF;
END //
DELIMITER ;
CALL add_templates_public_id_unique();
DROP PROCEDURE IF EXISTS add_templates_public_id_unique;
