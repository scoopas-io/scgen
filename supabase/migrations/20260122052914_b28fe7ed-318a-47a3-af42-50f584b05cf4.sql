-- Create table for social media content
CREATE TABLE public.social_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL, -- 'post', 'reel', 'video', 'story', 'text'
  platform TEXT NOT NULL, -- 'instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'
  title TEXT,
  caption TEXT,
  hashtags TEXT[],
  image_url TEXT,
  video_url TEXT,
  prompt TEXT,
  status TEXT DEFAULT 'generated', -- 'generated', 'scheduled', 'published'
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.social_content ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read social_content" 
ON public.social_content 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert social_content" 
ON public.social_content 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update social_content" 
ON public.social_content 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete social_content" 
ON public.social_content 
FOR DELETE 
USING (true);

-- Create storage bucket for social content
INSERT INTO storage.buckets (id, name, public) 
VALUES ('social-content', 'social-content', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for social-content bucket
CREATE POLICY "Anyone can view social content files"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-content');

CREATE POLICY "Anyone can upload social content files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'social-content');

CREATE POLICY "Anyone can update social content files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'social-content');

CREATE POLICY "Anyone can delete social content files"
ON storage.objects FOR DELETE
USING (bucket_id = 'social-content');

-- Enable realtime for social_content
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_content;