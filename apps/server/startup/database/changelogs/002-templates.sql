-- 002 — Template-from-video (GĐ3, 2026-09-01).
-- Idempotent ở mức CREATE TABLE; cột projects.template_id thêm bằng thủ tục
-- có kiểm tra tồn tại (MySQL không hỗ trợ ADD COLUMN IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS templates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  source_video_name VARCHAR(255) NULL,
  source_video_path VARCHAR(500) NULL,
  -- StyleProfile JSON (packages/pipeline/src/template.ts) — NULL khi đang phân tích
  profile_json MEDIUMTEXT NULL,
  -- Workflow chỉnh được của template: mode, variantCount, durationSec, voice*, autoRender
  workflow_json TEXT NOT NULL,
  status ENUM('analyzing', 'ready', 'failed') NOT NULL DEFAULT 'analyzing',
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_templates_user (user_id, created_at),
  CONSTRAINT fk_templates_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- projects.template_id: project sinh từ template nào (NULL = tạo tay).
-- ON DELETE SET NULL: xoá template không mất lịch sử project.
DROP PROCEDURE IF EXISTS add_projects_template_id;
DELIMITER //
CREATE PROCEDURE add_projects_template_id()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE projects
      ADD COLUMN template_id INT UNSIGNED NULL AFTER user_id,
      ADD KEY idx_projects_template (template_id),
      ADD CONSTRAINT fk_projects_template FOREIGN KEY (template_id)
        REFERENCES templates (id) ON DELETE SET NULL;
  END IF;
END //
DELIMITER ;
CALL add_projects_template_id();
DROP PROCEDURE IF EXISTS add_projects_template_id;
