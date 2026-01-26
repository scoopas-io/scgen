-- Enable realtime for songs table to get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;