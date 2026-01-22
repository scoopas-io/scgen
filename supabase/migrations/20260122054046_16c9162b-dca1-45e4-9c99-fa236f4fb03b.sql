-- Add scheduled_at column to social_content for scheduling
ALTER TABLE public.social_content 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS published_url TEXT;

-- Update status enum possibilities
COMMENT ON COLUMN public.social_content.status IS 'Status: generated, scheduled, publishing, published, failed';

-- Create table for platform connections (OAuth tokens)
CREATE TABLE public.platform_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL, -- 'instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  platform_user_id TEXT,
  platform_username TEXT,
  platform_avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read platform_connections" 
ON public.platform_connections 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert platform_connections" 
ON public.platform_connections 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update platform_connections" 
ON public.platform_connections 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete platform_connections" 
ON public.platform_connections 
FOR DELETE 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_social_content_scheduled ON public.social_content(scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'scheduled';