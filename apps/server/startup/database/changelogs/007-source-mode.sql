-- 007 — Nguồn tư liệu sinh kịch bản (GĐ4): người dùng chọn cách lấy tư liệu.
-- 'user' = chỉ tư liệu người dùng cung cấp (file + link); 'ai' = để AI tự tìm
-- trên web (Gemini google-search grounding); 'combine' = kết hợp cả hai. Link tái
-- dùng bảng project_sources (stored_path chứa URL). Idempotent.

DROP PROCEDURE IF EXISTS add_projects_source_mode;
DELIMITER //
CREATE PROCEDURE add_projects_source_mode()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'source_mode'
  ) THEN
    ALTER TABLE projects
      ADD COLUMN source_mode ENUM('user', 'ai', 'combine') NOT NULL DEFAULT 'user' AFTER idea;
  END IF;
END //
DELIMITER ;
CALL add_projects_source_mode();
DROP PROCEDURE IF EXISTS add_projects_source_mode;
