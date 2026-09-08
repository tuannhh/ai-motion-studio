CREATE TABLE IF NOT EXISTS motion_runs (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 user_id INT UNSIGNED NOT NULL,
 template_id INT UNSIGNED NOT NULL,
 status ENUM('queued','running','done','failed') NOT NULL DEFAULT 'queued',
 options_json JSON NOT NULL,
 state_json JSON NOT NULL,
 error_message VARCHAR(1000) NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_motion_queue(status,id),
 KEY idx_motion_owner(user_id,template_id,id),
 CONSTRAINT fk_motion_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_motion_template FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
