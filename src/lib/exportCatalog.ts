import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CatalogSong {
  katalognummer: string;
  song_id: string;
  songtitel: string;
  kuenstler: string;
  komponist: string;
  textdichter: string;
  verlag: string;
  label: string;
  isrc: string;
  iswc: string;
  gema_status: string;
  gema_werknummer: string;
  rechteinhaber_master: string;
  rechteinhaber_publishing: string;
  anteil_komponist: number;
  anteil_text: number;
  anteil_verlag: number;
  anteile_gesamt: number;
  exklusivitaet: string;
  genre: string;
  bpm: number;
  tonart: string;
  laenge: string;
  release_datum: string;
  version: string;
  ki_generiert: string;
  verwertungsstatus: string;
  einnahmequelle: string;
  jahresumsatz: number;
  katalogwert: number;
  vertragsart: string;
  vertragsbeginn: string;
  vertragsende: string;
  bemerkungen: string;
}

// Helper function to fetch all rows in batches (bypasses 1000 row limit)
async function fetchAllBatched<T>(
  table: "artists" | "albums" | "songs",
  select: string,
  orderBy: Array<{ column: string; ascending?: boolean }> = [],
  filters?: { column: string; value: string }[],
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    let query: any = supabase.from(table).select(select);
    
    // Apply filters
    if (filters) {
      for (const filter of filters) {
        query = query.eq(filter.column, filter.value);
      }
    }
    
    // Apply ordering
    for (const ord of orderBy) {
      query = query.order(ord.column, { ascending: ord.ascending ?? true });
    }
    
    query = query.range(from, from + pageSize - 1);

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data || []) as T[];
    all.push(...batch);
    
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export async function exportCatalogAsCSV() {
  try {
    toast.info("Lade Katalogdaten...");

    // Fetch all data in batches - no more 1000 row limit
    const [artists, albums, songs] = await Promise.all([
      fetchAllBatched<any>("artists", "*", [{ column: "created_at", ascending: true }]),
      fetchAllBatched<any>("albums", "*", [{ column: "artist_id", ascending: true }, { column: "created_at", ascending: true }]),
      fetchAllBatched<any>("songs", "*", [{ column: "album_id", ascending: true }, { column: "track_number", ascending: true }]),
    ]);

    // Create lookup maps for efficient access
    const artistsById = new Map(artists.map(a => [a.id, a]));
    const albumsById = new Map(albums.map(a => [a.id, a]));
    const songsByAlbum = new Map<string, any[]>();
    
    for (const song of songs) {
      const existing = songsByAlbum.get(song.album_id) || [];
      existing.push(song);
      songsByAlbum.set(song.album_id, existing);
    }

    const catalogEntries: CatalogSong[] = [];

    for (const album of albums) {
      const artist = artistsById.get(album.artist_id);
      if (!artist) continue;

      const albumSongs = songsByAlbum.get(album.id) || [];

      for (const song of albumSongs) {
        // Clean up AI/KI references - replace with neutral terms
        const cleanVerlag = (artist.verlag || "Eigenverlag").replace(/KI-|AI-|AI |KI /gi, "");
        const cleanLabel = (artist.label || "Independent").replace(/KI-|AI-|AI |KI |AI Records/gi, "Eigenproduktion");
        const cleanRechteMaster = (artist.rechteinhaber_master || "Independent").replace(/KI-|AI-|AI |KI |AI Records/gi, "Eigenproduktion");
        const cleanRechtePublishing = (artist.rechteinhaber_publishing || "Eigenverlag").replace(/KI-|AI-|AI |KI /gi, "");
        const cleanBemerkungen = (song.bemerkungen || "").replace(/KI-generierter Inhalt|AI-generiert|KI-generiert/gi, "Maschinell erstellt");

        catalogEntries.push({
          katalognummer: artist.katalognummer || "",
          song_id: song.song_id || "",
          songtitel: song.name || "",
          kuenstler: artist.name || "",
          komponist: song.komponist || artist.name || "",
          textdichter: song.textdichter || artist.name || "",
          verlag: cleanVerlag,
          label: cleanLabel,
          isrc: "auf Anfrage",
          iswc: "auf Anfrage",
          gema_status: song.gema_status || "Nicht angemeldet",
          gema_werknummer: "auf Anfrage",
          rechteinhaber_master: cleanRechteMaster,
          rechteinhaber_publishing: cleanRechtePublishing,
          anteil_komponist: song.anteil_komponist || 100,
          anteil_text: song.anteil_text || 0,
          anteil_verlag: song.anteil_verlag || 0,
          anteile_gesamt: (song.anteil_komponist || 100) + (song.anteil_text || 0) + (song.anteil_verlag || 0),
          exklusivitaet: song.exklusivitaet || "Exklusiv",
          genre: artist.genre || "",
          bpm: song.bpm || 120,
          tonart: song.tonart || "C-Dur",
          laenge: song.laenge || "03:30",
          release_datum: album.release_date || new Date().toISOString().split("T")[0],
          version: song.version || "Original",
          ki_generiert: "Ja",
          verwertungsstatus: song.verwertungsstatus || "Aktiv",
          einnahmequelle: song.einnahmequelle || "Streaming",
          jahresumsatz: song.jahresumsatz || 0,
          katalogwert: song.katalogwert || 0,
          vertragsart: song.vertragsart || "Eigenproduktion",
          vertragsbeginn: song.vertragsbeginn || new Date().toISOString().split("T")[0],
          vertragsende: song.vertragsende || "",
          bemerkungen: cleanBemerkungen || "",
        });
      }
    }

    // Create CSV
    const headers = [
      "Katalognummer", "Song-ID", "Songtitel", "Künstler", "Komponist", "Textdichter",
      "Verlag", "Label", "ISRC", "ISWC", "GEMA-Status", "GEMA-Werknummer",
      "Rechteinhaber Master", "Rechteinhaber Publishing", "Anteil Komponist (%)",
      "Anteil Text (%)", "Anteil Verlag (%)", "Anteile gesamt (%)", "Exklusivität",
      "Genre", "BPM", "Tonart", "Länge", "Release-Datum", "Version",
      "Verwertungsstatus", "Einnahmequelle", "Jahresumsatz (€)", "Rechnerischer Katalogwert (€)",
      "Vertragsart", "Vertragsbeginn", "Vertragsende", "Bemerkungen"
    ];

    const csvRows = [headers.join(";")];

    for (const entry of catalogEntries) {
      const row = [
        entry.katalognummer,
        entry.song_id,
        entry.songtitel,
        entry.kuenstler,
        entry.komponist,
        entry.textdichter,
        entry.verlag,
        entry.label,
        entry.isrc,
        entry.iswc,
        entry.gema_status,
        entry.gema_werknummer,
        entry.rechteinhaber_master,
        entry.rechteinhaber_publishing,
        entry.anteil_komponist,
        entry.anteil_text,
        entry.anteil_verlag,
        entry.anteile_gesamt,
        entry.exklusivitaet,
        entry.genre,
        entry.bpm,
        entry.tonart,
        entry.laenge,
        entry.release_datum,
        entry.version,
        entry.verwertungsstatus,
        entry.einnahmequelle,
        entry.jahresumsatz,
        entry.katalogwert,
        entry.vertragsart,
        entry.vertragsbeginn,
        entry.vertragsende,
        entry.bemerkungen,
      ].map(val => `"${String(val).replace(/"/g, '""')}"`);
      csvRows.push(row.join(";"));
    }

    const csvContent = "\uFEFF" + csvRows.join("\n"); // BOM for Excel UTF-8
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Musikkatalog_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`${catalogEntries.length} Songs exportiert`);
    return catalogEntries.length;
  } catch (error) {
    console.error("Export error:", error);
    toast.error("Export fehlgeschlagen");
    throw error;
  }
}

export async function exportCatalogAsJSON() {
  try {
    toast.info("Lade Katalogdaten...");

    // Fetch all data in batches - no more 1000 row limit
    const [artists, albums, songs] = await Promise.all([
      fetchAllBatched<any>("artists", "*", [{ column: "created_at", ascending: true }]),
      fetchAllBatched<any>("albums", "*", [{ column: "artist_id", ascending: true }, { column: "created_at", ascending: true }]),
      fetchAllBatched<any>("songs", "*", [{ column: "album_id", ascending: true }, { column: "track_number", ascending: true }]),
    ]);

    // Create lookup maps
    const songsByAlbum = new Map<string, any[]>();
    for (const song of songs) {
      const existing = songsByAlbum.get(song.album_id) || [];
      // Mask sensitive registration data
      existing.push({
        ...song,
        isrc: "auf Anfrage",
        iswc: "auf Anfrage",
        gema_werknummer: "auf Anfrage",
      });
      songsByAlbum.set(song.album_id, existing);
    }

    const albumsByArtist = new Map<string, any[]>();
    for (const album of albums) {
      const existing = albumsByArtist.get(album.artist_id) || [];
      existing.push({
        ...album,
        songs: songsByAlbum.get(album.id) || [],
      });
      albumsByArtist.set(album.artist_id, existing);
    }

    // Build full hierarchy
    const fullData = artists.map(artist => ({
      ...artist,
      albums: albumsByArtist.get(artist.id) || [],
    }));

    const totalSongs = songs.length;

    const jsonContent = JSON.stringify(fullData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Musikkatalog_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`${fullData.length} Künstler mit ${totalSongs} Songs exportiert`);
    return fullData.length;
  } catch (error) {
    console.error("Export error:", error);
    toast.error("Export fehlgeschlagen");
    throw error;
  }
}
