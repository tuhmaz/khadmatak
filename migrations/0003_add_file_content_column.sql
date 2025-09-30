-- Add file_content column to provider_documents table for storing uploaded files
-- Migration: Add file content storage support

-- Add file_content column to store base64 encoded file data
ALTER TABLE provider_documents 
ADD COLUMN file_content TEXT;

-- Update existing records to have proper verification_status if null
UPDATE provider_documents 
SET verification_status = 'pending' 
WHERE verification_status IS NULL;

-- Update existing records to have proper uploaded_at if null  
UPDATE provider_documents 
SET uploaded_at = CURRENT_TIMESTAMP 
WHERE uploaded_at IS NULL;

-- Add index for faster document retrieval
CREATE INDEX IF NOT EXISTS idx_provider_documents_provider_id ON provider_documents(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_documents_verification_status ON provider_documents(verification_status);