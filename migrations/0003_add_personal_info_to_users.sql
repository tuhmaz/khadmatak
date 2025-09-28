-- Add personal information fields to users table
ALTER TABLE users 
ADD COLUMN birth_date DATE DEFAULT NULL;

ALTER TABLE users 
ADD COLUMN marital_status TEXT DEFAULT NULL;