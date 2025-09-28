-- Add work schedule fields to provider_profiles table
ALTER TABLE provider_profiles 
ADD COLUMN work_hours_start TEXT DEFAULT NULL;

ALTER TABLE provider_profiles 
ADD COLUMN work_hours_end TEXT DEFAULT NULL;

ALTER TABLE provider_profiles 
ADD COLUMN work_days TEXT DEFAULT NULL;

-- Update existing records with empty JSON array for work_days if they don't have coverage_areas
UPDATE provider_profiles 
SET work_days = '[]' 
WHERE work_days IS NULL;

-- Ensure coverage_areas has proper default value for existing records  
UPDATE provider_profiles 
SET coverage_areas = '[]' 
WHERE coverage_areas IS NULL OR coverage_areas = '';