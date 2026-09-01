-- 005 — Tích hợp Google Drive (GĐ4, 2026-09-01): creator kết nối Drive qua OAuth
-- → export video render lên Drive của họ. Refresh/access token mã hoá AES-256-GCM
-- (không lưu plaintext). oauth_states chống CSRF luồng OAuth. Idempotent.

-- Tài khoản Drive đã kết nối của từng user (1-1). Token đã MÃ HOÁ (iv:tag:ct hex).
CREATE TABLE IF NOT EXISTS gdrive_accounts (
  user_id INT UNSIGNED NOT NULL,
  email VARCHAR(255) NULL,
  refresh_token_enc TEXT NOT NULL,
  access_token_enc TEXT NULL,
  access_expires_at DATETIME NULL,
  -- thư mục đích trên Drive (NULL = gốc My Drive)
  folder_id VARCHAR(128) NULL,
  connected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_gdrive_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- State token 1 lần cho luồng OAuth (chống CSRF login) — hết hạn xoá theo created_at.
CREATE TABLE IF NOT EXISTS oauth_states (
  state CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  provider VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (state),
  KEY idx_oauth_state_created (created_at),
  CONSTRAINT fk_oauth_state_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Kết quả export 1 job → 1 file Drive (idempotent theo job: PK = job_id).
CREATE TABLE IF NOT EXISTS drive_exports (
  job_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  file_id VARCHAR(128) NOT NULL,
  web_link VARCHAR(512) NULL,
  size_bytes BIGINT UNSIGNED NULL,
  exported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (job_id),
  KEY idx_drive_exports_user (user_id),
  CONSTRAINT fk_drive_exports_job FOREIGN KEY (job_id) REFERENCES render_jobs (id) ON DELETE CASCADE,
  CONSTRAINT fk_drive_exports_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
