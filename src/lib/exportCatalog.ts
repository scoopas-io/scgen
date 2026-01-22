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

export async function exportCatalogAsCSV() {
  try {
    // Fetch all data with relationships
    const { data: artists, error: artistsError } = await supabase
      .from("artists")
      .select("*")
      .order("created_at", { ascending: true });

    if (artistsError) throw artistsError;

    const catalogEntries: CatalogSong[] = [];

    for (const artist of artists || []) {
      const { data: albums } = await supabase
        .from("albums")
        .select("*")
        .eq("artist_id", artist.id)
        .order("created_at", { ascending: true });

      for (const album of albums || []) {
        const { data: songs } = await supabase
          .from("songs")
          .select("*")
          .eq("album_id", album.id)
          .order("track_number", { ascending: true });

        for (const song of songs || []) {
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
            isrc: song.isrc || "",
            iswc: song.iswc || "",
            gema_status: song.gema_status || "Nicht angemeldet",
            gema_werknummer: song.gema_werknummer || "",
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
    }

    // Create CSV
    const headers = [
      "Katalognummer", "Song-ID", "Songtitel", "Künstler", "Komponist", "Textdichter",
      "Verlag", "Label", "ISRC", "ISWC", "GEMA-Status", "GEMA-Werknummer",
      "Rechteinhaber Master", "Rechteinhaber Publishing", "Anteil Komponist (%)",
      "Anteil Text (%)", "Anteil Verlag (%)", "Anteile gesamt (%)", "Exklusivität",
      "Genre", "BPM", "Tonart", "Länge", "Release-Datum", "Version", "KI-generiert",
      "Verwertungsstatus", "Einnahmequelle", "Jahresumsatz (€)", "Katalogwert (€)",
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
        entry.ki_generiert,
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
    const { data: artists, error } = await supabase
      .from("artists")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const fullData = [];

    for (const artist of artists || []) {
      const { data: albums } = await supabase
        .from("albums")
        .select("*")
        .eq("artist_id", artist.id);

      const albumsWithSongs = [];
      for (const album of albums || []) {
        const { data: songs } = await supabase
          .from("songs")
          .select("*")
          .eq("album_id", album.id)
          .order("track_number");

        albumsWithSongs.push({ ...album, songs });
      }

      fullData.push({ ...artist, albums: albumsWithSongs });
    }

    const jsonContent = JSON.stringify(fullData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Musikkatalog_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`${fullData.length} Künstler exportiert`);
    return fullData.length;
  } catch (error) {
    console.error("Export error:", error);
    toast.error("Export fehlgeschlagen");
    throw error;
  }
}
