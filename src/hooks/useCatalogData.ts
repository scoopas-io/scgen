import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Song {
  id: string;
  name: string;
  album_id: string;
  track_number: number;
  created_at: string;
  song_id?: string;
  komponist?: string;
  textdichter?: string;
  isrc?: string;
  iswc?: string;
  gema_werknummer?: string;
  gema_status?: string;
  bpm?: number;
  tonart?: string;
  laenge?: string;
  version?: string;
  ki_generiert?: string;
  verwertungsstatus?: string;
  einnahmequelle?: string;
  vertragsart?: string;
  exklusivitaet?: string;
  vertragsbeginn?: string;
  vertragsende?: string;
  anteil_komponist?: number;
  anteil_text?: number;
  anteil_verlag?: number;
  jahresumsatz?: number;
  katalogwert?: number;
  bemerkungen?: string;
  audio_url?: string;
  generation_status?: string | null;
  suno_task_id?: string | null;
}

interface Album {
  id: string;
  name: string;
  release_date?: string;
  songs: Song[];
}

interface ArtistWithAlbums {
  id: string;
  name: string;
  genre: string;
  style: string;
  language?: string;
  profile_image_url?: string;
  personality?: string;
  voice_prompt?: string;
  katalognummer?: string;
  created_at?: string;
  albums: Album[];
  // Persona fields for generation
  vocal_gender?: string | null;
  vocal_texture?: string | null;
  vocal_range?: string | null;
  style_tags?: string[];
  mood_tags?: string[];
  negative_tags?: string[];
  default_bpm_min?: number | null;
  default_bpm_max?: number | null;
  preferred_keys?: string[];
  instrumental_only?: boolean | null;
  persona_active?: boolean | null;
}

export interface CatalogStats {
  artists: number;
  albums: number;
  songs: number;
}

export function useCatalogData() {
  const [artists, setArtists] = useState<ArtistWithAlbums[]>([]);
  const [stats, setStats] = useState<CatalogStats>({ artists: 0, albums: 0, songs: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async <T,>(
    table: "artists" | "albums" | "songs",
    select: string,
    orderBy: Array<{ column: string; ascending?: boolean }> = [],
    pageSize = 1000
  ): Promise<T[]> => {
    const all: T[] = [];
    let from = 0;

    while (true) {
      let q: any = supabase.from(table).select(select);
      for (const ord of orderBy) {
        q = q.order(ord.column, { ascending: ord.ascending ?? true });
      }
      q = q.range(from, from + pageSize - 1);

      const { data, error } = await q;
      if (error) throw error;

      const batch = (data || []) as T[];
      all.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return all;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // IMPORTANT: The backend caps result sets to 1000 rows by default.
      // We therefore:
      // 1) read exact counts via count queries
      // 2) load full catalog data in 1000-row pages
      const [counts, artistsData, albumsData, songsData] = await Promise.all([
        (async (): Promise<CatalogStats> => {
          const [a, al, s] = await Promise.all([
            supabase.from("artists").select("id", { count: "exact", head: true }),
            supabase.from("albums").select("id", { count: "exact", head: true }),
            supabase.from("songs").select("id", { count: "exact", head: true }),
          ]);

          // If count fails for any reason, fall back to 0 (we'll still render data lists).
          return {
            artists: a.count ?? 0,
            albums: al.count ?? 0,
            songs: s.count ?? 0,
          };
        })(),
        fetchAll<any>("artists", "*", [{ column: "created_at", ascending: false }]),
        fetchAll<any>(
          "albums",
          "*",
          [
            { column: "artist_id", ascending: true },
            { column: "created_at", ascending: true },
          ]
        ),
        fetchAll<any>(
          "songs",
          "*",
          [
            { column: "album_id", ascending: true },
            { column: "track_number", ascending: true },
            { column: "created_at", ascending: true },
          ]
        ),
      ]);

      setStats(counts);

      // Create lookup maps for O(1) access
      const songsByAlbum = new Map<string, Song[]>();
      for (const song of songsData) {
        const existing = songsByAlbum.get(song.album_id) || [];
        existing.push(song);
        songsByAlbum.set(song.album_id, existing);
      }

      const albumsByArtist = new Map<string, typeof albumsData>();
      for (const album of albumsData) {
        const existing = albumsByArtist.get(album.artist_id) || [];
        existing.push(album);
        albumsByArtist.set(album.artist_id, existing);
      }

      // Build artist hierarchy efficiently
      const artistsWithAlbums: ArtistWithAlbums[] = artistsData.map(artist => ({
        id: artist.id,
        name: artist.name,
        genre: artist.genre,
        style: artist.style,
        language: artist.language,
        profile_image_url: artist.profile_image_url,
        personality: artist.personality,
        voice_prompt: artist.voice_prompt,
        katalognummer: artist.katalognummer,
        created_at: artist.created_at,
        // Persona fields for generation
        vocal_gender: artist.vocal_gender,
        vocal_texture: artist.vocal_texture,
        vocal_range: artist.vocal_range,
        style_tags: artist.style_tags,
        mood_tags: artist.mood_tags,
        negative_tags: artist.negative_tags,
        default_bpm_min: artist.default_bpm_min,
        default_bpm_max: artist.default_bpm_max,
        preferred_keys: artist.preferred_keys,
        instrumental_only: artist.instrumental_only,
        persona_active: artist.persona_active,
        albums: (albumsByArtist.get(artist.id) || []).map(album => ({
          id: album.id,
          name: album.name,
          release_date: album.release_date,
          // Ensure deterministic ordering within the album
          songs: (songsByAlbum.get(album.id) || []).slice().sort((a, b) => (a.track_number ?? 0) - (b.track_number ?? 0)),
        })),
      }));

      setArtists(artistsWithAlbums);
    } catch (error) {
      console.error("Error loading catalog data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setIsLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    loadData();

    // Subscribe to realtime changes for songs table
    const channel = supabase
      .channel('catalog-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'songs' },
        () => {
          // Reload data when songs change (new audio_url, new songs, etc.)
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'artists' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'albums' },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const deleteArtist = useCallback(async (artistId: string) => {
    const { error } = await supabase.from("artists").delete().eq("id", artistId);
    if (error) {
      toast.error("Fehler beim Löschen");
      return false;
    }
    toast.success("Künstler gelöscht");
    await loadData();
    return true;
  }, [loadData]);

  return {
    artists,
    stats,
    isLoading,
    loadData,
    deleteArtist,
  };
}

export function useFilteredCatalog(
  artists: ArtistWithAlbums[],
  searchQuery: string
) {
  return useMemo(() => {
    // Helper to count total songs with audio for an artist
    const countAvailableSongs = (artist: ArtistWithAlbums) => 
      artist.albums.reduce((sum, album) => 
        sum + album.songs.filter(s => s.audio_url).length, 0);
    
    let filtered = artists;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = artists.filter(artist => {
        if (artist.name.toLowerCase().includes(query)) return true;
        if (artist.genre.toLowerCase().includes(query)) return true;
        if (artist.style.toLowerCase().includes(query)) return true;
        if (artist.albums.some(album => album.name.toLowerCase().includes(query))) return true;
        if (artist.albums.some(album => 
          album.songs.some(song => song.name.toLowerCase().includes(query))
        )) return true;
        return false;
      });
    }
    
    // Sort by number of available songs (descending)
    return [...filtered].sort((a, b) => countAvailableSongs(b) - countAvailableSongs(a));
  }, [artists, searchQuery]);
}

export function usePagination<T>(items: T[], page: number, perPage: number) {
  return useMemo(() => {
    const totalPages = Math.ceil(items.length / perPage);
    const start = (page - 1) * perPage;
    const paginatedItems = items.slice(start, start + perPage);
    
    return {
      items: paginatedItems,
      totalPages,
      totalItems: items.length,
    };
  }, [items, page, perPage]);
}

export type { Song, Album, ArtistWithAlbums };
