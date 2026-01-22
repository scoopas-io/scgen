-- Add UPDATE policy for artists table
CREATE POLICY "Anyone can update artists" 
ON public.artists 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Add UPDATE policy for albums table
CREATE POLICY "Anyone can update albums" 
ON public.albums 
FOR UPDATE 
USING (true)
WITH CHECK (true);