-- Add suno_audio_id column to songs table to store the Suno-generated audio identifier
-- This enables stable persona creation using audioId instead of unreliable musicIndex
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS suno_audio_id text;