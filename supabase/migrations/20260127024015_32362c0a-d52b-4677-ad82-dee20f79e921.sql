-- Add columns for alternative (version 2) audio storage
ALTER TABLE public.songs ADD COLUMN alternative_audio_url TEXT;
ALTER TABLE public.songs ADD COLUMN alternative_suno_audio_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.songs.alternative_audio_url IS 'URL to the second version of the generated audio (Version 2)';
COMMENT ON COLUMN public.songs.alternative_suno_audio_id IS 'Suno audio ID for the alternative version';