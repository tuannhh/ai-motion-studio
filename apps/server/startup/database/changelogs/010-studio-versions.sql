CREATE TABLE IF NOT EXISTS script_versions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  script_id INT UNSIGNED NOT NULL,
  plan_json JSON NOT NULL,
  label VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_script_versions_script (script_id, id),
  CONSTRAINT fk_script_versions_script FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
