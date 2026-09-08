SET @music_shared_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='music_tracks' AND COLUMN_NAME='is_shared');
SET @music_shared_sql = IF(@music_shared_exists = 0, 'ALTER TABLE music_tracks ADD COLUMN is_shared TINYINT(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE music_shared_stmt FROM @music_shared_sql;
EXECUTE music_shared_stmt;
DEALLOCATE PREPARE music_shared_stmt;
