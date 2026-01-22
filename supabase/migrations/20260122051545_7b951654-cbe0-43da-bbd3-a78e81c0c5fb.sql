-- Add language column to artists table
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS language text DEFAULT 'de';