-- Add suno_persona_id field to artists table for consistent voice/style
ALTER TABLE public.artists 
ADD COLUMN IF NOT EXISTS suno_persona_id text DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_artists_suno_persona_id ON public.artists(suno_persona_id) WHERE suno_persona_id IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.artists.suno_persona_id IS 'Suno API persona ID for consistent voice and style across all generated songs';