import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Song {
  id: string;
  name: string;
  album_id: string;
  track_number: number;
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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Single batch load - no N+1 queries
      const [artistsRes, albumsRes, songsRes] = await Promise.all([
        supabase.from("artists").select("*").order("created_at", { ascending: false }),
        supabase.from("albums").select("*").order("created_at", { ascending: true }),
        supabase.from("songs").select("*").order("track_number", { ascending: true }),
      ]);

      const artistsData = artistsRes.data || [];
      const albumsData = albumsRes.data || [];
      const songsData = songsRes.data || [];

      setStats({
        artists: artistsData.length,
        albums: albumsData.length,
        songs: songsData.length,
      });

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
        albums: (albumsByArtist.get(artist.id) || []).map(album => ({
          id: album.id,
          name: album.name,
          release_date: album.release_date,
          songs: songsByAlbum.get(album.id) || [],
        })),
      }));

      setArtists(artistsWithAlbums);
    } catch (error) {
      console.error("Error loading catalog data:", error);
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
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
    if (!searchQuery.trim()) return artists;
    
    const query = searchQuery.toLowerCase();
    return artists.filter(artist => {
      if (artist.name.toLowerCase().includes(query)) return true;
      if (artist.genre.toLowerCase().includes(query)) return true;
      if (artist.style.toLowerCase().includes(query)) return true;
      if (artist.albums.some(album => album.name.toLowerCase().includes(query))) return true;
      if (artist.albums.some(album => 
        album.songs.some(song => song.name.toLowerCase().includes(query))
      )) return true;
      return false;
    });
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
