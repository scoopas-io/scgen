-- Add audio_url column to songs table
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS audio_url text;

-- Add suno_task_id column to track generation status
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS suno_task_id text;

-- Add generation_status column
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS generation_status text DEFAULT 'pending';

-- Create storage bucket for generated audio
INSERT INTO storage.buckets (id, name, public) 
VALUES ('generated-audio', 'generated-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for audio bucket
CREATE POLICY "Anyone can read audio files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'generated-audio');

CREATE POLICY "Anyone can upload audio files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'generated-audio');

CREATE POLICY "Anyone can update audio files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'generated-audio');

CREATE POLICY "Anyone can delete audio files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'generated-audio');