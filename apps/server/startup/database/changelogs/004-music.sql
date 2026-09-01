-- 004 — Thư viện nhạc nền (GĐ4, 2026-09-01): admin tải nhạc license-free
-- (tải thủ công từ pixabay.com/music — Pixabay KHÔNG có API audio), creator
-- chọn khi tạo video → engine phủ dưới voiceover + tự ducking. Idempotent.

CREATE TABLE IF NOT EXISTS music_tracks (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  stored_path VARCHAR(500) NOT NULL,
  mime VARCHAR(60) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  -- nguồn/giấy phép để đối soát (ví dụ "Pixabay · CC0")
  credit VARCHAR(120) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_music_created (created_at),
  CONSTRAINT fk_music_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- projects.music_track_id: nhạc nền của video (NULL = không nhạc)
DROP PROCEDURE IF EXISTS add_projects_music_track_id;
DELIMITER //
CREATE PROCEDURE add_projects_music_track_id()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'music_track_id'
  ) THEN
    ALTER TABLE projects
      ADD COLUMN music_track_id INT UNSIGNED NULL AFTER series_id,
      ADD KEY idx_projects_music (music_track_id),
      ADD CONSTRAINT fk_projects_music FOREIGN KEY (music_track_id)
        REFERENCES music_tracks (id) ON DELETE SET NULL;
  END IF;
END //
DELIMITER ;
CALL add_projects_music_track_id();
DROP PROCEDURE IF EXISTS add_projects_music_track_id;
