-- Erweitere artists-Tabelle um Suno-Persona-Felder

-- Voice-Charakteristik
ALTER TABLE public.artists 
ADD COLUMN IF NOT EXISTS vocal_gender text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vocal_texture text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vocal_range text DEFAULT NULL;

-- Stil-Tags
ALTER TABLE public.artists 
ADD COLUMN IF NOT EXISTS style_tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS mood_tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS negative_tags text[] DEFAULT '{}';

-- Technische Parameter
ALTER TABLE public.artists 
ADD COLUMN IF NOT EXISTS default_bpm_min integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS default_bpm_max integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preferred_keys text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS instrumental_only boolean DEFAULT false;

-- Persona-Meta
ALTER TABLE public.artists 
ADD COLUMN IF NOT EXISTS persona_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS persona_description text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS persona_active boolean DEFAULT true;

COMMENT ON COLUMN public.artists.vocal_gender IS 'Suno vocal gender: m, f, or null for auto-detect';
COMMENT ON COLUMN public.artists.vocal_texture IS 'Voice texture keywords: raspy, smooth, powerful, breathy, etc.';
COMMENT ON COLUMN public.artists.vocal_range IS 'Vocal range: soprano, alto, tenor, baritone, bass';
COMMENT ON COLUMN public.artists.style_tags IS 'Array of style tags for Suno generation';
COMMENT ON COLUMN public.artists.mood_tags IS 'Array of mood/atmosphere tags';
COMMENT ON COLUMN public.artists.negative_tags IS 'Tags to exclude from generation';
COMMENT ON COLUMN public.artists.default_bpm_min IS 'Minimum BPM for this artist';
COMMENT ON COLUMN public.artists.default_bpm_max IS 'Maximum BPM for this artist';
COMMENT ON COLUMN public.artists.preferred_keys IS 'Preferred musical keys';
COMMENT ON COLUMN public.artists.instrumental_only IS 'Force instrumental generation';
COMMENT ON COLUMN public.artists.persona_name IS 'Optional persona alias';
COMMENT ON COLUMN public.artists.persona_description IS 'Description of the persona style';