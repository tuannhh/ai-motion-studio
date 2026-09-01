-- 001 — Watermark theo từng creator + pha "images" cho render job (2026-09-01).
-- Idempotent: chạy lại an toàn.

-- Job có thêm pha sinh ảnh minh họa trước TTS
ALTER TABLE render_jobs
  MODIFY status ENUM('queued', 'images', 'tts', 'rendering', 'done', 'failed') NOT NULL DEFAULT 'queued';

-- Watermark riêng của từng user; kind='inherit' nghĩa là dùng mặc định hệ thống
CREATE TABLE IF NOT EXISTS user_watermarks (
  user_id INT UNSIGNED NOT NULL,
  kind ENUM('inherit', 'none', 'text', 'image') NOT NULL DEFAULT 'inherit',
  text VARCHAR(40) NULL,
  image_path VARCHAR(500) NULL,
  pos_x DECIMAL(4, 3) NOT NULL DEFAULT 0.500,
  pos_y DECIMAL(4, 3) NOT NULL DEFAULT 0.060,
  opacity DECIMAL(3, 2) NOT NULL DEFAULT 0.50,
  scale DECIMAL(3, 2) NOT NULL DEFAULT 0.16,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_watermarks_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
