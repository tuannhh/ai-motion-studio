-- 003 — Serie manager (GĐ3, 2026-09-01): serie nhớ ngữ cảnh tập trước.
-- Idempotent như 002 (stored procedure cho ADD COLUMN).

CREATE TABLE IF NOT EXISTS series (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  -- tên serie hiện trên progress chip video (≤40 theo schema engine)
  name VARCHAR(40) NOT NULL,
  description VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_series_user (user_id, created_at),
  CONSTRAINT fk_series_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- projects.series_id: batch tập thuộc serie nào (NULL = không thuộc serie)
DROP PROCEDURE IF EXISTS add_projects_series_id;
DELIMITER //
CREATE PROCEDURE add_projects_series_id()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'series_id'
  ) THEN
    ALTER TABLE projects
      ADD COLUMN series_id INT UNSIGNED NULL AFTER template_id,
      ADD KEY idx_projects_series (series_id),
      ADD CONSTRAINT fk_projects_series FOREIGN KEY (series_id)
        REFERENCES series (id) ON DELETE SET NULL;
  END IF;
END //
DELIMITER ;
CALL add_projects_series_id();
DROP PROCEDURE IF EXISTS add_projects_series_id;
