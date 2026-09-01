-- Schema baseline AI Motion Studio (idempotent — chạy lại an toàn).
-- Áp thủ công:
--   docker compose exec -T mysql mysql -h127.0.0.1 -uams -pams_dev_password ams < apps/server/startup/database/schema.sql
-- Thay đổi sau baseline: thêm file vào startup/database/changelogs/ (không sửa file này).

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role ENUM('admin', 'creator') NOT NULL DEFAULT 'creator',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  csrf_token VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token_hash (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  idea TEXT NOT NULL,
  mode ENUM('angles', 'series') NOT NULL DEFAULT 'angles',
  variant_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
  preset_hint VARCHAR(20) NULL,
  duration_sec SMALLINT UNSIGNED NULL,
  voice_gender ENUM('male', 'female') NOT NULL DEFAULT 'female',
  voice_region ENUM('bac', 'nam') NOT NULL DEFAULT 'bac',
  voice_style ENUM('thoisu', 'tintuc') NOT NULL DEFAULT 'tintuc',
  voice_speed DECIMAL(2, 1) NOT NULL DEFAULT 1.0,
  status ENUM('draft', 'generating', 'ready', 'failed') NOT NULL DEFAULT 'draft',
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_projects_user (user_id, created_at),
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_sources (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id INT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  stored_path VARCHAR(500) NOT NULL,
  mime VARCHAR(100) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  extract_method VARCHAR(50) NULL,
  extracted_text MEDIUMTEXT NULL,
  status ENUM('uploaded', 'extracting', 'ready', 'failed') NOT NULL DEFAULT 'uploaded',
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sources_project (project_id),
  CONSTRAINT fk_sources_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scripts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  project_id INT UNSIGNED NOT NULL,
  variant_index TINYINT UNSIGNED NOT NULL DEFAULT 0,
  title VARCHAR(200) NOT NULL,
  angle VARCHAR(200) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  preset VARCHAR(20) NOT NULL,
  plan_json MEDIUMTEXT NOT NULL,
  narration_md MEDIUMTEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_scripts_project (project_id),
  CONSTRAINT fk_scripts_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS render_jobs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  script_id INT UNSIGNED NOT NULL,
  status ENUM('queued', 'tts', 'rendering', 'done', 'failed') NOT NULL DEFAULT 'queued',
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  output_path VARCHAR(500) NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_jobs_status (status, id),
  KEY idx_jobs_script (script_id),
  CONSTRAINT fk_jobs_script FOREIGN KEY (script_id) REFERENCES scripts (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Cấu hình watermark toàn hệ thống: đúng 1 dòng id=1 (admin quản lý).
CREATE TABLE IF NOT EXISTS watermark_config (
  id TINYINT UNSIGNED NOT NULL,
  kind ENUM('none', 'text', 'image') NOT NULL DEFAULT 'none',
  text VARCHAR(40) NULL,
  image_path VARCHAR(500) NULL,
  pos_x DECIMAL(4, 3) NOT NULL DEFAULT 0.500,
  pos_y DECIMAL(4, 3) NOT NULL DEFAULT 0.060,
  opacity DECIMAL(3, 2) NOT NULL DEFAULT 0.50,
  scale DECIMAL(3, 2) NOT NULL DEFAULT 0.16,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT IGNORE INTO watermark_config (id, kind) VALUES (1, 'none');
