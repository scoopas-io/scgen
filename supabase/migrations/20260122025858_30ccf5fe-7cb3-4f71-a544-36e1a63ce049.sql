-- Add profile image and catalog fields to artists
ALTER TABLE public.artists 
ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
ADD COLUMN IF NOT EXISTS katalognummer TEXT,
ADD COLUMN IF NOT EXISTS verlag TEXT DEFAULT 'Eigenverlag',
ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'Independent',
ADD COLUMN IF NOT EXISTS rechteinhaber_master TEXT DEFAULT 'Independent',
ADD COLUMN IF NOT EXISTS rechteinhaber_publishing TEXT DEFAULT 'Eigenverlag';

-- Add catalog fields to albums
ALTER TABLE public.albums
ADD COLUMN IF NOT EXISTS release_date DATE DEFAULT CURRENT_DATE;

-- Add catalog fields to songs
ALTER TABLE public.songs
ADD COLUMN IF NOT EXISTS song_id TEXT,
ADD COLUMN IF NOT EXISTS komponist TEXT,
ADD COLUMN IF NOT EXISTS textdichter TEXT,
ADD COLUMN IF NOT EXISTS isrc TEXT,
ADD COLUMN IF NOT EXISTS iswc TEXT,
ADD COLUMN IF NOT EXISTS gema_status TEXT DEFAULT 'Nicht angemeldet',
ADD COLUMN IF NOT EXISTS gema_werknummer TEXT,
ADD COLUMN IF NOT EXISTS anteil_komponist INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS anteil_text INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS anteil_verlag INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS exklusivitaet TEXT DEFAULT 'Exklusiv',
ADD COLUMN IF NOT EXISTS bpm INTEGER,
ADD COLUMN IF NOT EXISTS tonart TEXT,
ADD COLUMN IF NOT EXISTS laenge TEXT DEFAULT '03:30',
ADD COLUMN IF NOT EXISTS version TEXT DEFAULT 'Original',
ADD COLUMN IF NOT EXISTS ki_generiert TEXT DEFAULT 'Ja',
ADD COLUMN IF NOT EXISTS verwertungsstatus TEXT DEFAULT 'Aktiv',
ADD COLUMN IF NOT EXISTS einnahmequelle TEXT DEFAULT 'Streaming',
ADD COLUMN IF NOT EXISTS jahresumsatz DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS katalogwert DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vertragsart TEXT DEFAULT 'Eigenproduktion',
ADD COLUMN IF NOT EXISTS vertragsbeginn DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS vertragsende DATE,
ADD COLUMN IF NOT EXISTS bemerkungen TEXT DEFAULT 'KI-generierter Inhalt';

-- Create storage bucket for artist profile images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('artist-images', 'artist-images', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for artist images
CREATE POLICY "Anyone can view artist images"
ON storage.objects FOR SELECT
USING (bucket_id = 'artist-images');

CREATE POLICY "Anyone can upload artist images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'artist-images');

CREATE POLICY "Anyone can delete artist images"
ON storage.objects FOR DELETE
USING (bucket_id = 'artist-images');