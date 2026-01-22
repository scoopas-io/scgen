-- Enable UPDATE on songs table for editing
CREATE POLICY "Anyone can update songs" 
ON public.songs 
FOR UPDATE 
USING (true)
WITH CHECK (true);