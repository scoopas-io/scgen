-- Update default value for bemerkungen column
ALTER TABLE public.songs ALTER COLUMN bemerkungen SET DEFAULT 'scoopas Produktion';

-- Update existing rows with the old default value
UPDATE public.songs SET bemerkungen = 'scoopas Produktion' WHERE bemerkungen = 'KI-generierter Inhalt';