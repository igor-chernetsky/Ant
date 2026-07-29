-- Add ownership reference categories for project document uploads
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'ownership_certificate';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'owners_id';
