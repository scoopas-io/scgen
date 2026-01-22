-- Artists table
CREATE TABLE public.artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  personality TEXT NOT NULL,
  voice_prompt TEXT NOT NULL,
  genre TEXT NOT NULL,
  style TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Albums table
CREATE TABLE public.albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID REFERENCES public.artists(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Songs table
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID REFERENCES public.albums(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  track_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(name)
);

-- Enable RLS
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (no auth required for this tool)
CREATE POLICY "Anyone can read artists" ON public.artists FOR SELECT USING (true);
CREATE POLICY "Anyone can insert artists" ON public.artists FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete artists" ON public.artists FOR DELETE USING (true);

CREATE POLICY "Anyone can read albums" ON public.albums FOR SELECT USING (true);
CREATE POLICY "Anyone can insert albums" ON public.albums FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete albums" ON public.albums FOR DELETE USING (true);

CREATE POLICY "Anyone can read songs" ON public.songs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert songs" ON public.songs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete songs" ON public.songs FOR DELETE USING (true);

-- Indexes for faster duplicate checks
CREATE INDEX idx_artists_name ON public.artists(name);
CREATE INDEX idx_albums_name ON public.albums(name);
CREATE INDEX idx_songs_name ON public.songs(name);