-- Store observed Google grounding metadata for user review.
SET @exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='projects' AND column_name='research_json');
SET @sql = IF(@exists=0, 'ALTER TABLE projects ADD COLUMN research_json JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='scripts' AND column_name='research_json');
SET @sql = IF(@exists=0, 'ALTER TABLE scripts ADD COLUMN research_json JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
UPDATE scripts s JOIN projects p ON p.id=s.project_id SET s.research_json=p.research_json WHERE s.research_json IS NULL AND p.research_json IS NOT NULL;
