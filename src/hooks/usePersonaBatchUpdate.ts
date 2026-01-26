import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Artist {
  id: string;
  name: string;
  genre: string;
  style: string;
  voice_prompt: string;
  personality: string;
  language?: string | null;
  vocal_gender?: string | null;
  vocal_texture?: string | null;
  vocal_range?: string | null;
  style_tags?: string[] | null;
  mood_tags?: string[] | null;
  negative_tags?: string[] | null;
  default_bpm_min?: number | null;
  default_bpm_max?: number | null;
  preferred_keys?: string[] | null;
  instrumental_only?: boolean | null;
  persona_active?: boolean | null;
}

interface Song {
  id: string;
  name: string;
  bpm: number | null;
  tonart: string | null;
  laenge: string | null;
  version: string | null;
  bemerkungen: string | null;
  album_id: string;
}

interface Album {
  id: string;
  name: string;
  artist_id: string;
}

interface BatchUpdateProgress {
  total: number;
  current: number;
  currentArtist: string;
  updated: number;
  skipped: number;
  errors: number;
}

interface ExtractedPersona {
  vocalGender: string | null;
  vocalTexture: string | null;
  vocalRange: string | null;
  styleTags: string[];
  moodTags: string[];
  defaultBpmMin: number | null;
  defaultBpmMax: number | null;
  preferredKeys: string[];
  instrumentalOnly: boolean;
}

// Vocal texture detection patterns
const TEXTURE_PATTERNS: Record<string, string[]> = {
  raspy: ["raspy", "rau", "heiser", "kratzig", "gritty", "raw"],
  smooth: ["smooth", "glatt", "weich", "sanft", "velvet", "samt", "silky"],
  powerful: ["powerful", "kraftvoll", "stark", "mächtig", "bold", "strong"],
  breathy: ["breathy", "hauchig", "luftig", "airy", "whispered"],
  soulful: ["soulful", "seelenvoll", "gefühlvoll", "emotional"],
  warm: ["warm", "warme", "cozy", "rich"],
  bright: ["bright", "hell", "brilliant", "clear", "klar"],
  dark: ["dark", "dunkel", "deep", "tief"],
  nasal: ["nasal", "näselnd", "twangy"],
  operatic: ["operatic", "opernhaft", "classical", "classisch"],
};

// Vocal range detection patterns
const RANGE_PATTERNS: Record<string, string[]> = {
  soprano: ["soprano", "sopran", "high female"],
  alto: ["alto", "alt", "contralto"],
  "mezzo-soprano": ["mezzo", "mezzosopran"],
  tenor: ["tenor", "high male"],
  baritone: ["baritone", "bariton", "baritonal"],
  bass: ["bass", "basso", "deep male"],
};

// Mood detection patterns
const MOOD_PATTERNS: Record<string, string[]> = {
  melancholic: ["melancholisch", "traurig", "sad", "melancholic", "schwermütig", "mournful", "wistful"],
  energetic: ["energisch", "dynamisch", "energetic", "kraftvoll", "lebendig", "vital", "upbeat", "driving"],
  romantic: ["romantisch", "romantic", "liebevoll", "zärtlich", "loving", "tender"],
  aggressive: ["aggressiv", "aggressive", "wütend", "rebellisch", "angry", "fierce", "intense"],
  dreamy: ["verträumt", "dreamy", "träumerisch", "ethereal", "schwebend", "floating", "ambient"],
  dark: ["dunkel", "dark", "düster", "finster", "mysteriös", "mysterious", "eerie", "haunting"],
  uplifting: ["aufbauend", "uplifting", "positiv", "hoffnungsvoll", "optimistisch", "hopeful", "inspiring"],
  rebellious: ["rebellisch", "rebellious", "aufrührerisch", "defiant", "punk"],
  introspective: ["introspektiv", "introspective", "nachdenklich", "tiefgründig", "thoughtful", "contemplative"],
  chill: ["chill", "entspannt", "relaxed", "gelassen", "ruhig", "calm", "mellow", "laid-back"],
  epic: ["episch", "epic", "grandios", "monumental", "cinematic", "sweeping"],
  intimate: ["intim", "intimate", "persönlich", "nah", "close", "personal"],
  playful: ["spielerisch", "playful", "verspielt", "fun", "witty", "cheeky"],
  nostalgic: ["nostalgisch", "nostalgic", "retro", "vintage", "classic"],
};

// Style hints patterns
const STYLE_HINT_PATTERNS = [
  "acoustic", "electronic", "orchestral", "minimalist", "experimental",
  "vintage", "modern", "retro", "progressive", "alternative", "indie",
  "mainstream", "underground", "avant-garde", "neo", "post", "synth",
  "lo-fi", "hi-fi", "analog", "digital", "organic", "atmospheric"
];

// Extract persona data from voice_prompt and personality
function extractPersonaFromText(voicePrompt: string, personality: string, genre: string, style: string): ExtractedPersona {
  const combined = `${voicePrompt} ${personality}`.toLowerCase();
  
  // Gender detection
  let vocalGender: string | null = null;
  if (/\b(male|männlich|man(?!\w)|mann|er singt|his voice|männer|baritone?|tenor|bass)\b/i.test(combined)) {
    vocalGender = "m";
  } else if (/\b(female|weiblich|woman|frau|sie singt|her voice|frauen|soprano|alto|mezzo)\b/i.test(combined)) {
    vocalGender = "f";
  } else if (/\b(duo|duet|mixed|gemischt|both|beide)\b/i.test(combined)) {
    vocalGender = "duo";
  }
  
  // Texture detection
  let vocalTexture: string | null = null;
  for (const [texture, keywords] of Object.entries(TEXTURE_PATTERNS)) {
    if (keywords.some(kw => combined.includes(kw))) {
      vocalTexture = texture;
      break;
    }
  }
  
  // Range detection
  let vocalRange: string | null = null;
  for (const [range, keywords] of Object.entries(RANGE_PATTERNS)) {
    if (keywords.some(kw => combined.includes(kw))) {
      vocalRange = range;
      break;
    }
  }
  
  // Mood tags
  const moodTags: string[] = [];
  for (const [mood, keywords] of Object.entries(MOOD_PATTERNS)) {
    if (keywords.some(kw => combined.includes(kw))) {
      moodTags.push(mood);
    }
  }
  
  // Style tags from genre, style, and hints
  const styleTags: string[] = [];
  if (style && style.length > 2) {
    styleTags.push(style);
  }
  
  // Extract style hints
  const styleHints = STYLE_HINT_PATTERNS.filter(hint => combined.includes(hint));
  styleTags.push(...styleHints);
  
  // Check for instrumental genre
  const instrumentalGenres = ["classical", "klassik", "ambient", "instrumental", "electronic", "techno", "house"];
  const instrumentalOnly = instrumentalGenres.some(ig => genre.toLowerCase().includes(ig)) ||
    /\b(instrumental|no vocals?|ohne gesang|ohne stimme)\b/i.test(combined);
  
  return {
    vocalGender,
    vocalTexture,
    vocalRange,
    styleTags: [...new Set(styleTags)].slice(0, 5),
    moodTags: [...new Set(moodTags)].slice(0, 4),
    defaultBpmMin: null,
    defaultBpmMax: null,
    preferredKeys: [],
    instrumentalOnly,
  };
}

// Derive BPM range, preferred keys, and style hints from song metadata
function deriveFromSongMetadata(songs: Song[], albumNames: string[]): { 
  bpmMin: number | null; 
  bpmMax: number | null; 
  preferredKeys: string[];
  derivedStyleTags: string[];
  derivedMoodTags: string[];
} {
  const bpms = songs.filter(s => s.bpm && s.bpm > 0).map(s => s.bpm!);
  const keys = songs.filter(s => s.tonart).map(s => s.tonart!);
  
  // Calculate BPM range from existing songs
  let bpmMin: number | null = null;
  let bpmMax: number | null = null;
  
  if (bpms.length >= 3) {
    // Use 10th and 90th percentile for more robust range
    const sorted = [...bpms].sort((a, b) => a - b);
    const p10Index = Math.floor(sorted.length * 0.1);
    const p90Index = Math.floor(sorted.length * 0.9);
    bpmMin = sorted[p10Index];
    bpmMax = sorted[p90Index];
  } else if (bpms.length > 0) {
    bpmMin = Math.min(...bpms) - 10;
    bpmMax = Math.max(...bpms) + 10;
  }
  
  // Find most common keys
  const keyCounts = keys.reduce((acc, key) => {
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const preferredKeys = Object.entries(keyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);

  // Extract style and mood hints from song names, album names, and notes
  const derivedStyleTags: string[] = [];
  const derivedMoodTags: string[] = [];
  
  const allText = [
    ...songs.map(s => s.name),
    ...songs.filter(s => s.bemerkungen).map(s => s.bemerkungen!),
    ...songs.filter(s => s.version && s.version !== "Original").map(s => s.version!),
    ...albumNames,
  ].join(" ").toLowerCase();
  
  // Style hints from metadata
  const metadataStylePatterns: Record<string, string[]> = {
    acoustic: ["acoustic", "akustik", "unplugged"],
    electronic: ["electronic", "elektronisch", "synth", "digital"],
    orchestral: ["orchestral", "orchestra", "symphonic", "klassisch"],
    minimalist: ["minimal", "minimalist", "sparse"],
    experimental: ["experimental", "avant", "abstract"],
    vintage: ["vintage", "retro", "classic", "oldschool"],
    live: ["live", "concert", "session"],
    remix: ["remix", "rework", "edit"],
    instrumental: ["instrumental", "inst.", "no vocals"],
  };
  
  for (const [style, keywords] of Object.entries(metadataStylePatterns)) {
    if (keywords.some(kw => allText.includes(kw))) {
      derivedStyleTags.push(style);
    }
  }
  
  // Mood hints from song/album names
  for (const [mood, keywords] of Object.entries(MOOD_PATTERNS)) {
    if (keywords.some(kw => allText.includes(kw))) {
      derivedMoodTags.push(mood);
    }
  }
  
  return { bpmMin, bpmMax, preferredKeys, derivedStyleTags, derivedMoodTags };
}

// Check if artist needs persona update
function needsPersonaUpdate(artist: Artist): boolean {
  // Check if key persona fields are empty
  const hasVocalInfo = artist.vocal_gender || artist.vocal_texture || artist.vocal_range;
  const hasStyleInfo = artist.style_tags && artist.style_tags.length > 0;
  const hasMoodInfo = artist.mood_tags && artist.mood_tags.length > 0;
  const hasBpmInfo = artist.default_bpm_min && artist.default_bpm_max;
  const hasKeyInfo = artist.preferred_keys && artist.preferred_keys.length > 0;
  
  // Needs update if missing vocal, style/mood OR technical metadata (BPM/keys)
  const missingVocalOrStyle = !hasVocalInfo && !hasStyleInfo && !hasMoodInfo;
  const missingTechnical = !hasBpmInfo || !hasKeyInfo;
  
  return missingVocalOrStyle || missingTechnical;
}

export function usePersonaBatchUpdate() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState<BatchUpdateProgress | null>(null);

  const runBatchUpdate = useCallback(async (onComplete?: () => void) => {
    setIsUpdating(true);
    setProgress({
      total: 0,
      current: 0,
      currentArtist: "Lade Künstler...",
      updated: 0,
      skipped: 0,
      errors: 0,
    });

    try {
      // Load all artists
      const { data: artists, error: artistsError } = await supabase
        .from("artists")
        .select("*")
        .order("name");

      if (artistsError) throw artistsError;
      if (!artists || artists.length === 0) {
        toast.info("Keine Künstler gefunden");
        return;
      }

      // Filter artists needing update
      const artistsNeedingUpdate = artists.filter(needsPersonaUpdate);
      
      if (artistsNeedingUpdate.length === 0) {
        toast.success("Alle Künstler haben bereits Persona-Daten");
        setProgress(null);
        setIsUpdating(false);
        return;
      }

      setProgress(prev => ({
        ...prev!,
        total: artistsNeedingUpdate.length,
        currentArtist: "Lade Album- und Song-Daten...",
      }));

      // Load all albums and songs for analysis (recursive for >1000 rows)
      const allAlbums: Album[] = [];
      let albumOffset = 0;
      while (true) {
        const { data: albumBatch } = await supabase
          .from("albums")
          .select("id, name, artist_id")
          .order("name")
          .range(albumOffset, albumOffset + 999);
        
        if (!albumBatch || albumBatch.length === 0) break;
        allAlbums.push(...(albumBatch as Album[]));
        if (albumBatch.length < 1000) break;
        albumOffset += 1000;
      }

      const allSongs: Song[] = [];
      let songOffset = 0;
      while (true) {
        const { data: songBatch } = await supabase
          .from("songs")
          .select("id, name, bpm, tonart, laenge, version, bemerkungen, album_id")
          .order("track_number")
          .range(songOffset, songOffset + 999);
        
        if (!songBatch || songBatch.length === 0) break;
        allSongs.push(...(songBatch as Song[]));
        if (songBatch.length < 1000) break;
        songOffset += 1000;
      }

      const albumsByArtist = new Map<string, Album[]>();
      for (const album of allAlbums) {
        const existing = albumsByArtist.get(album.artist_id) || [];
        existing.push(album);
        albumsByArtist.set(album.artist_id, existing);
      }

      const songsByAlbum = new Map<string, Song[]>();
      for (const song of allSongs) {
        const existing = songsByAlbum.get(song.album_id) || [];
        existing.push(song);
        songsByAlbum.set(song.album_id, existing);
      }

      let updated = 0;
      let skipped = 0;
      let errors = 0;

      // Process each artist
      for (let i = 0; i < artistsNeedingUpdate.length; i++) {
        const artist = artistsNeedingUpdate[i];
        
        setProgress({
          total: artistsNeedingUpdate.length,
          current: i + 1,
          currentArtist: artist.name,
          updated,
          skipped,
          errors,
        });

        try {
          // Extract persona from voice_prompt and personality
          const extracted = extractPersonaFromText(
            artist.voice_prompt || "",
            artist.personality || "",
            artist.genre || "",
            artist.style || ""
          );

          // Get albums and songs for this artist
          const artistAlbums = albumsByArtist.get(artist.id) || [];
          const artistAlbumNames = artistAlbums.map(a => a.name);
          const artistSongs: Song[] = [];
          for (const album of artistAlbums) {
            const albumSongs = songsByAlbum.get(album.id) || [];
            artistSongs.push(...albumSongs);
          }

          // Derive BPM, keys, and style/mood from song metadata
          const derived = deriveFromSongMetadata(artistSongs, artistAlbumNames);

          // Merge extracted and derived data - ONLY update fields that are empty
          const updateData: Record<string, any> = {};

          // Only set vocal info if not already present
          if (!artist.vocal_gender && extracted.vocalGender) updateData.vocal_gender = extracted.vocalGender;
          if (!artist.vocal_texture && extracted.vocalTexture) updateData.vocal_texture = extracted.vocalTexture;
          if (!artist.vocal_range && extracted.vocalRange) updateData.vocal_range = extracted.vocalRange;
          if (!artist.instrumental_only && extracted.instrumentalOnly) updateData.instrumental_only = true;
          
          // Combine style tags from text extraction AND song metadata - only if empty
          if (!artist.style_tags || artist.style_tags.length === 0) {
            const combinedStyleTags = [...new Set([...extracted.styleTags, ...derived.derivedStyleTags])].slice(0, 6);
            if (combinedStyleTags.length > 0) updateData.style_tags = combinedStyleTags;
          }
          
          // Combine mood tags from text extraction AND song metadata - only if empty
          if (!artist.mood_tags || artist.mood_tags.length === 0) {
            const combinedMoodTags = [...new Set([...extracted.moodTags, ...derived.derivedMoodTags])].slice(0, 5);
            if (combinedMoodTags.length > 0) updateData.mood_tags = combinedMoodTags;
          }
          
          // ALWAYS update BPM and Keys from song metadata if available and not already set
          if ((!artist.default_bpm_min || !artist.default_bpm_max) && derived.bpmMin && derived.bpmMax) {
            updateData.default_bpm_min = derived.bpmMin;
            updateData.default_bpm_max = derived.bpmMax;
          }
          
          // ALWAYS update preferred keys from song metadata if available and not already set
          if ((!artist.preferred_keys || artist.preferred_keys.length === 0) && derived.preferredKeys.length > 0) {
            updateData.preferred_keys = derived.preferredKeys;
          }
          
          // Ensure persona_active is set
          if (!artist.persona_active) {
            updateData.persona_active = true;
          }

          // Only update if we have any data to update
          if (Object.keys(updateData).length >= 1) {
            const { error: updateError } = await supabase
              .from("artists")
              .update(updateData)
              .eq("id", artist.id);

            if (updateError) {
              console.error(`Error updating ${artist.name}:`, updateError);
              errors++;
            } else {
              updated++;
            }
          } else {
            skipped++;
          }
        } catch (e) {
          console.error(`Error processing ${artist.name}:`, e);
          errors++;
        }

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setProgress({
        total: artistsNeedingUpdate.length,
        current: artistsNeedingUpdate.length,
        currentArtist: "Fertig",
        updated,
        skipped,
        errors,
      });

      toast.success(`Persona-Update abgeschlossen: ${updated} aktualisiert, ${skipped} übersprungen, ${errors} Fehler`);
      onComplete?.();
    } catch (error) {
      console.error("Batch update error:", error);
      toast.error("Fehler beim Batch-Update");
    } finally {
      setTimeout(() => {
        setIsUpdating(false);
        setProgress(null);
      }, 2000);
    }
  }, []);

  // Get count of artists needing update
  const getArtistsNeedingUpdate = useCallback(async (): Promise<number> => {
    try {
      const { data: artists } = await supabase
        .from("artists")
        .select("id, name, genre, style, voice_prompt, personality, vocal_gender, vocal_texture, vocal_range, style_tags, mood_tags");
      
      if (!artists) return 0;
      return artists.filter(a => needsPersonaUpdate(a as Artist)).length;
    } catch {
      return 0;
    }
  }, []);

  return {
    isUpdating,
    progress,
    runBatchUpdate,
    getArtistsNeedingUpdate,
  };
}
