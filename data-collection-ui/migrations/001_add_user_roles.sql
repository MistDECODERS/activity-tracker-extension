-- Migration: Add role field to user_profiles and set default roles
-- This migration ensures all existing users have a role assigned

-- First, check if the role column exists (it should from our previous work)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
        ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'user' NOT NULL;
    END IF;
END $$;

-- Update any existing users without a role to have 'user' role
UPDATE user_profiles 
SET role = 'user' 
WHERE role IS NULL OR role = '';

-- Ensure the role column has a NOT NULL constraint
ALTER TABLE user_profiles ALTER COLUMN role SET NOT NULL;

-- Add a check constraint to ensure only valid roles are used
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'user_profiles' AND constraint_name = 'user_profiles_role_check') THEN
        ALTER TABLE user_profiles 
        ADD CONSTRAINT user_profiles_role_check 
        CHECK (role IN ('user', 'admin'));
    END IF;
END $$;

-- Create an index on the role column for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Insert a comment to document the migration
COMMENT ON COLUMN user_profiles.role IS 'User role: user or admin. Defaults to user for new accounts.';
