-- ============================================================
-- INTERNOVA RECOMMENDATION ENGINE - DATABASE MIGRATION
-- ============================================================
-- Creates get_recommendations RPC function with multi-factor scoring
-- Migration: 20260915000001_add_recommendation_rpc.sql
-- ============================================================

-- Add missing columns to internships table if they don't exist
DO $$
BEGIN
  -- Add cgpa_requirement column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'internships' AND column_name = 'cgpa_requirement') THEN
    ALTER TABLE internships ADD COLUMN cgpa_requirement DECIMAL(3,2) DEFAULT NULL;
  END IF;

  -- Add experience_level column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'internships' AND column_name = 'experience_level') THEN
    ALTER TABLE internships ADD COLUMN experience_level TEXT DEFAULT 'Entry Level';
  END IF;

  -- Add requirements_jsonb column for structured requirements
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'internships' AND column_name = 'requirements_jsonb') THEN
    ALTER TABLE internships ADD COLUMN requirements_jsonb JSONB DEFAULT NULL;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_internships_status ON internships(status);
CREATE INDEX IF NOT EXISTS idx_internships_type ON internships(type);
CREATE INDEX IF NOT EXISTS idx_internships_skills ON internships USING gin(skills);
CREATE INDEX IF NOT EXISTS idx_internships_location ON internships(location);

-- ============================================================
-- HELPER FUNCTION: Calculate Skill Match Score
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_skill_match_score(
  user_skills TEXT[],
  internship_skills TEXT[]
)
RETURNS TABLE(
  score INTEGER,
  matched_skills TEXT[],
  missing_skills TEXT[]
) AS $$
DECLARE
  matched TEXT[];
  missing TEXT[];
  match_count INTEGER;
  total_required INTEGER;
BEGIN
  -- Normalize skills to lowercase for comparison
  user_skills := ARRAY(SELECT LOWER(TRIM(unnest(user_skills))));
  internship_skills := ARRAY(SELECT LOWER(TRIM(unnest(internship_skills))));

  -- Find matched skills
  matched := ARRAY(
    SELECT unnest(internship_skills)
    INTERSECT
    SELECT unnest(user_skills)
  );

  -- Find missing skills
  missing := ARRAY(
    SELECT unnest(internship_skills)
    EXCEPT
    SELECT unnest(user_skills)
  );

  match_count := COALESCE(array_length(matched, 1), 0);
  total_required := COALESCE(array_length(internship_skills, 1), 1);

  -- Return results
  RETURN QUERY SELECT
    CASE
      WHEN total_required = 0 THEN 100
      ELSE ROUND((match_count::DECIMAL / total_required::DECIMAL) * 100)::INTEGER
    END AS score,
    matched AS matched_skills,
    missing AS missing_skills;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- MAIN RPC FUNCTION: Get Recommendations
-- ============================================================
CREATE OR REPLACE FUNCTION get_recommendations(
  user_skills TEXT[] DEFAULT '{}',
  user_location TEXT DEFAULT NULL,
  user_preferred_location TEXT DEFAULT NULL,
  user_expected_stipend TEXT DEFAULT NULL,
  user_work_mode TEXT[] DEFAULT '{}',
  user_experience INTEGER DEFAULT 0,
  user_cgpa DECIMAL DEFAULT 0,
  match_threshold DECIMAL DEFAULT 0,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE(
  id TEXT,
  title TEXT,
  company TEXT,
  location TEXT,
  stipend TEXT,
  duration TEXT,
  description TEXT,
  skills TEXT[],
  type TEXT,
  status TEXT,
  company_id TEXT,
  source TEXT,
  calculated_match_score DECIMAL,
  skill_match_score INTEGER,
  location_match_score INTEGER,
  stipend_match_score INTEGER,
  work_mode_match_score INTEGER,
  matched_skills TEXT[],
  missing_skills TEXT[]
) AS $$
DECLARE
  skill_weight DECIMAL := 0.35;
  location_weight DECIMAL := 0.15;
  stipend_weight DECIMAL := 0.10;
  work_mode_weight DECIMAL := 0.15;
  experience_weight DECIMAL := 0.10;
  cgpa_weight DECIMAL := 0.05;
  profile_bonus_weight DECIMAL := 0.10;
BEGIN
  RETURN QUERY
  WITH skill_scores AS (
    SELECT
      i.id,
      (calculate_skill_match_score(user_skills, i.skills)).*
    FROM internships i
    WHERE i.status = 'Active'
  ),
  location_scores AS (
    SELECT
      i.id,
      CASE
        WHEN i.type = 'Remote' THEN 100
        WHEN user_preferred_location IS NOT NULL
          AND LOWER(i.location) LIKE '%' || LOWER(user_preferred_location) || '%' THEN 100
        WHEN user_location IS NOT NULL
          AND LOWER(i.location) LIKE '%' || LOWER(user_location) || '%' THEN 85
        WHEN user_location IS NOT NULL
          AND SPLIT_PART(LOWER(i.location), ',', 1) = SPLIT_PART(LOWER(user_location), ',', 1) THEN 60
        ELSE 20
      END AS location_score
    FROM internships i
  ),
  work_mode_scores AS (
    SELECT
      i.id,
      CASE
        WHEN array_length(user_work_mode, 1) IS NULL THEN 50
        WHEN i.type = ANY(user_work_mode) THEN 100
        ELSE 30
      END AS work_mode_score
    FROM internships i
  ),
  cgpa_scores AS (
    SELECT
      i.id,
      CASE
        WHEN i.cgpa_requirement IS NULL OR i.cgpa_requirement = 0 THEN 100
        WHEN user_cgpa = 0 THEN 50
        WHEN user_cgpa >= i.cgpa_requirement THEN 100
        ELSE GREATEST(0, 100 - ((i.cgpa_requirement - user_cgpa) * 50))
      END AS cgpa_score
    FROM internships i
  ),
  final_scores AS (
    SELECT
      i.*,
      ss.score AS skill_match_score,
      ss.matched_skills,
      ss.missing_skills,
      ls.location_score AS location_match_score,
      50 AS stipend_match_score, -- Simplified for now, can enhance later
      ws.work_mode_score AS work_mode_match_score,
      cs.cgpa_score AS cgpa_match_score,
      (
        (ss.score * skill_weight) +
        (ls.location_score * location_weight) +
        (50 * stipend_weight) +
        (ws.work_mode_score * work_mode_weight) +
        (50 * experience_weight) +
        (cs.cgpa_score * cgpa_weight) +
        (75 * profile_bonus_weight) -- Default profile bonus
      ) AS total_score
    FROM internships i
    INNER JOIN skill_scores ss ON i.id = ss.id
    INNER JOIN location_scores ls ON i.id = ls.id
    INNER JOIN work_mode_scores ws ON i.id = ws.id
    INNER JOIN cgpa_scores cs ON i.id = cs.id
    WHERE i.status = 'Active'
  )
  SELECT
    fs.id,
    fs.title,
    fs.company,
    fs.location,
    fs.stipend,
    fs.duration,
    fs.description,
    fs.skills,
    fs.type,
    fs.status,
    fs.company_id,
    fs.source,
    ROUND(fs.total_score, 2) AS calculated_match_score,
    fs.skill_match_score,
    fs.location_match_score,
    fs.stipend_match_score,
    fs.work_mode_match_score,
    fs.matched_skills,
    fs.missing_skills
  FROM final_scores fs
  WHERE fs.total_score >= match_threshold
  ORDER BY fs.total_score DESC, fs.skill_match_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION get_recommendations TO anon;
GRANT EXECUTE ON FUNCTION calculate_skill_match_score TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_skill_match_score TO anon;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Run this migration with: supabase db push
-- Or apply manually in Supabase SQL Editor
-- ============================================================
