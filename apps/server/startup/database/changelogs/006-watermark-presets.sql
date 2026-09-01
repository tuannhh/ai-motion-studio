-- 006 — Thư viện watermark (GĐ4, 2026-09-01): mỗi user (admin & creator) tạo
-- được NHIỀU watermark có tên, lưu thành danh sách, chọn khi tạo video. Thay mô
-- hình cũ 1-watermark/user (bị ghi đè khi lưu cái mới → cảm giác "mất"). Idempotent.

CREATE TABLE IF NOT EXISTS watermark_presets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  -- 'text' = chữ; 'image' = ảnh PNG/JPEG/WebP đã upload
  kind ENUM('text', 'image') NOT NULL DEFAULT 'text',
  text VARCHAR(40) NULL,
  image_path VARCHAR(500) NULL,
  pos_x DECIMAL(4, 3) NOT NULL DEFAULT 0.500,
  pos_y DECIMAL(4, 3) NOT NULL DEFAULT 0.060,
  opacity DECIMAL(4, 3) NOT NULL DEFAULT 0.500,
  scale DECIMAL(4, 3) NOT NULL DEFAULT 0.160,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wm_presets_user (user_id),
  CONSTRAINT fk_wm_presets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- projects.watermark_preset_id: watermark chọn cho video (NULL = dùng watermark
-- mặc định hiệu lực cũ getEffectiveWatermark — tương thích ngược).
DROP PROCEDURE IF EXISTS add_projects_watermark_preset_id;
DELIMITER //
CREATE PROCEDURE add_projects_watermark_preset_id()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'watermark_preset_id'
  ) THEN
    ALTER TABLE projects
      ADD COLUMN watermark_preset_id INT UNSIGNED NULL AFTER music_track_id,
      ADD KEY idx_projects_wm_preset (watermark_preset_id),
      ADD CONSTRAINT fk_projects_wm_preset FOREIGN KEY (watermark_preset_id)
        REFERENCES watermark_presets (id) ON DELETE SET NULL;
  END IF;
END //
DELIMITER ;
CALL add_projects_watermark_preset_id();
DROP PROCEDURE IF EXISTS add_projects_watermark_preset_id;
