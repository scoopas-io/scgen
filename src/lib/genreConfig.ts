// Genre configuration with instrumental-only flags

export interface GenreConfig {
  name: string;
  instrumental: boolean;
  category: string;
}

export const GENRE_CONFIG: GenreConfig[] = [
  // Mainstream (vocals)
  { name: "Pop", instrumental: false, category: "Mainstream" },
  { name: "Rock", instrumental: false, category: "Mainstream" },
  { name: "Hip-Hop", instrumental: false, category: "Mainstream" },
  { name: "Rap", instrumental: false, category: "Mainstream" },
  { name: "R&B", instrumental: false, category: "Mainstream" },
  { name: "Jazz", instrumental: false, category: "Mainstream" },
  { name: "Blues", instrumental: false, category: "Mainstream" },
  { name: "Country", instrumental: false, category: "Mainstream" },
  { name: "Folk", instrumental: false, category: "Mainstream" },
  
  // Electronic & Dance (mostly instrumental)
  { name: "Electronic", instrumental: true, category: "Electronic & Dance" },
  { name: "House", instrumental: true, category: "Electronic & Dance" },
  { name: "Deep House", instrumental: true, category: "Electronic & Dance" },
  { name: "Techno", instrumental: true, category: "Electronic & Dance" },
  { name: "Trance", instrumental: true, category: "Electronic & Dance" },
  { name: "Drum & Bass", instrumental: true, category: "Electronic & Dance" },
  { name: "Dubstep", instrumental: true, category: "Electronic & Dance" },
  { name: "Trap", instrumental: false, category: "Electronic & Dance" }, // Often has vocals
  { name: "Lo-Fi", instrumental: true, category: "Electronic & Dance" },
  { name: "Ambient", instrumental: true, category: "Electronic & Dance" },
  { name: "Synthwave", instrumental: true, category: "Electronic & Dance" },
  { name: "DJ Mix", instrumental: true, category: "Electronic & Dance" },
  
  // Classical & Traditional (instrumental)
  { name: "Classical", instrumental: true, category: "Classical & Traditional" },
  { name: "Opera", instrumental: false, category: "Classical & Traditional" },
  { name: "Orchestral", instrumental: true, category: "Classical & Traditional" },
  
  // Alternative & Rock (vocals)
  { name: "Reggae", instrumental: false, category: "Alternative & Rock" },
  { name: "Ska", instrumental: false, category: "Alternative & Rock" },
  { name: "Punk", instrumental: false, category: "Alternative & Rock" },
  { name: "Metal", instrumental: false, category: "Alternative & Rock" },
  { name: "Indie", instrumental: false, category: "Alternative & Rock" },
  { name: "Alternative", instrumental: false, category: "Alternative & Rock" },
  { name: "Grunge", instrumental: false, category: "Alternative & Rock" },
  { name: "Post-Rock", instrumental: true, category: "Alternative & Rock" },
  
  // Soul & Funk (vocals)
  { name: "Soul", instrumental: false, category: "Soul & Funk" },
  { name: "Funk", instrumental: false, category: "Soul & Funk" },
  { name: "Disco", instrumental: false, category: "Soul & Funk" },
  { name: "Neo-Soul", instrumental: false, category: "Soul & Funk" },
  { name: "Motown", instrumental: false, category: "Soul & Funk" },
  
  // World & Cultural (vocals)
  { name: "Latin", instrumental: false, category: "World & Cultural" },
  { name: "Bossa Nova", instrumental: false, category: "World & Cultural" },
  { name: "Salsa", instrumental: false, category: "World & Cultural" },
  { name: "World Music", instrumental: false, category: "World & Cultural" },
  { name: "Afrobeat", instrumental: false, category: "World & Cultural" },
  { name: "Dancehall", instrumental: false, category: "World & Cultural" },
  
  // Asian Pop (vocals)
  { name: "K-Pop", instrumental: false, category: "Asian Pop" },
  { name: "J-Pop", instrumental: false, category: "Asian Pop" },
  
  // German (vocals)
  { name: "Schlager", instrumental: false, category: "German" },
  { name: "Volksmusik", instrumental: false, category: "German" },
  
  // Niche & Experimental (mixed)
  { name: "Experimental", instrumental: true, category: "Niche & Experimental" },
  { name: "Chillwave", instrumental: true, category: "Niche & Experimental" },
  { name: "Vaporwave", instrumental: true, category: "Niche & Experimental" },
  { name: "Industrial", instrumental: true, category: "Niche & Experimental" },
  { name: "Drill", instrumental: false, category: "Niche & Experimental" },
];

// Quick lookup helpers
export const GENRES = GENRE_CONFIG.map(g => g.name);

export const isInstrumentalGenre = (genre: string): boolean => {
  const config = GENRE_CONFIG.find(g => g.name.toLowerCase() === genre.toLowerCase());
  return config?.instrumental ?? false;
};

export const getGenreConfig = (genre: string): GenreConfig | undefined => {
  return GENRE_CONFIG.find(g => g.name.toLowerCase() === genre.toLowerCase());
};

export const getInstrumentalGenres = (): string[] => {
  return GENRE_CONFIG.filter(g => g.instrumental).map(g => g.name);
};

export const getVocalGenres = (): string[] => {
  return GENRE_CONFIG.filter(g => !g.instrumental).map(g => g.name);
};
