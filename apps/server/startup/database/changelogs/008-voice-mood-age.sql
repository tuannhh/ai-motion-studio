-- 008 — Mở rộng cấu hình giọng đọc: mood (tâm trạng) + độ tuổi, thêm phong cách
-- "tvc" (quảng cáo) vào voice_style. Phản hồi 2026-09-03: cần giọng vui vẻ/năng
-- động kiểu TVC quảng cáo, chọn được độ tuổi (thanh niên/trung niên/người đi
-- làm) để Gemini TTS đọc đúng chất giọng mong muốn. Idempotent.

DROP PROCEDURE IF EXISTS add_projects_voice_mood_age;
DELIMITER //
CREATE PROCEDURE add_projects_voice_mood_age()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'voice_mood'
  ) THEN
    ALTER TABLE projects
      ADD COLUMN voice_mood ENUM('neutral', 'cheerful', 'energetic') NOT NULL DEFAULT 'neutral' AFTER voice_style;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'voice_age'
  ) THEN
    ALTER TABLE projects
      ADD COLUMN voice_age ENUM('thanhnien', 'trungnien', 'nguoidilam') NOT NULL DEFAULT 'nguoidilam' AFTER voice_mood;
  END IF;
END //
DELIMITER ;
CALL add_projects_voice_mood_age();
DROP PROCEDURE IF EXISTS add_projects_voice_mood_age;

-- voice_style ENUM cần thêm 'tvc' — MySQL không ALTER ENUM có điều kiện gọn như
-- ADD COLUMN nên soi trực tiếp kiểu cột, chỉ đổi khi 'tvc' chưa có (idempotent).
DROP PROCEDURE IF EXISTS add_voice_style_tvc;
DELIMITER //
CREATE PROCEDURE add_voice_style_tvc()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'projects' AND column_name = 'voice_style'
       AND column_type = "enum('thoisu','tintuc','tvc')"
  ) THEN
    ALTER TABLE projects
      MODIFY COLUMN voice_style ENUM('thoisu', 'tintuc', 'tvc') NOT NULL DEFAULT 'tintuc';
  END IF;
END //
DELIMITER ;
CALL add_voice_style_tvc();
DROP PROCEDURE IF EXISTS add_voice_style_tvc;
