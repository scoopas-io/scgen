import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

interface CatalogStats {
  totalSongs: number;
  songsWithAudio: number;
  totalArtists: number;
  totalAlbums: number;
  genreCount: number;
  catalogValue: number;
  baseValue: number;
  multiplier: number;
  genreDiversityBonus: number;
  artistDiversityBonus: number;
  rightsBonus: number;
  gemaStats: {
    registered: number;
    pending: number;
  };
  isrcStats: {
    registered: number;
    pending: number;
  };
  iswcStats: {
    registered: number;
    pending: number;
  };
  genreDistribution: Array<{ genre: string; count: number; percentage: number }>;
  topArtists: Array<{ name: string; songCount: number; albumCount: number }>;
}

// Helper function to fetch all rows in batches (bypasses 1000 row limit)
async function fetchAllBatched<T>(
  table: "artists" | "albums" | "songs",
  select: string,
  orderBy: Array<{ column: string; ascending?: boolean }> = [],
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    let query: any = supabase.from(table).select(select);
    
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

export async function exportCatalogAsPDF(): Promise<void> {
  try {
    toast.info("PDF wird erstellt...");

    // Fetch all data
    const [artists, albums, songs] = await Promise.all([
      fetchAllBatched<any>("artists", "*", [{ column: "created_at", ascending: true }]),
      fetchAllBatched<any>("albums", "*", [{ column: "artist_id", ascending: true }]),
      fetchAllBatched<any>("songs", "*", [{ column: "album_id", ascending: true }]),
    ]);

    // Calculate stats
    const songsWithAudio = songs.filter(s => s.audio_url);
    
    // Genre distribution
    const genreMap = new Map<string, { songs: number; artists: Set<string> }>();
    const artistsById = new Map(artists.map(a => [a.id, a]));
    const albumsById = new Map(albums.map(a => [a.id, a]));
    
    for (const song of songsWithAudio) {
      const album = albumsById.get(song.album_id);
      if (!album) continue;
      const artist = artistsById.get(album.artist_id);
      if (!artist) continue;
      
      const existing = genreMap.get(artist.genre) || { songs: 0, artists: new Set() };
      existing.songs++;
      existing.artists.add(artist.id);
      genreMap.set(artist.genre, existing);
    }

    const genreDistribution = Array.from(genreMap.entries())
      .map(([genre, data]) => ({
        genre,
        count: data.songs,
        percentage: songsWithAudio.length > 0 ? Math.round((data.songs / songsWithAudio.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top artists
    const artistSongCounts = new Map<string, { name: string; songs: number; albums: Set<string> }>();
    for (const song of songsWithAudio) {
      const album = albumsById.get(song.album_id);
      if (!album) continue;
      const artist = artistsById.get(album.artist_id);
      if (!artist) continue;
      
      const existing = artistSongCounts.get(artist.id) || { name: artist.name, songs: 0, albums: new Set() };
      existing.songs++;
      existing.albums.add(album.id);
      artistSongCounts.set(artist.id, existing);
    }

    const topArtists = Array.from(artistSongCounts.values())
      .map(a => ({ name: a.name, songCount: a.songs, albumCount: a.albums.size }))
      .sort((a, b) => b.songCount - a.songCount)
      .slice(0, 10);

    // GEMA/ISRC/ISWC stats
    const gemaRegistered = songs.filter(s => s.gema_werknummer && s.gema_werknummer.trim() !== "").length;
    const isrcRegistered = songs.filter(s => s.isrc && s.isrc.trim() !== "").length;
    const iswcRegistered = songs.filter(s => s.iswc && s.iswc.trim() !== "").length;

    // Catalog valuation
    const genreCount = genreMap.size;
    const artistCount = artists.length;
    const baseValuePerSong = 850;
    const genreDiversityBonus = Math.min(genreCount / 10, 1) * 0.25;
    const artistDiversityBonus = Math.min(artistCount / 20, 1) * 0.15;
    const rightsBonus = 0.20;
    const totalMultiplier = 1 + genreDiversityBonus + artistDiversityBonus + rightsBonus;
    const baseValue = songsWithAudio.length * baseValuePerSong;
    const catalogValue = Math.round(baseValue * totalMultiplier);

    const stats: CatalogStats = {
      totalSongs: songs.length,
      songsWithAudio: songsWithAudio.length,
      totalArtists: artists.length,
      totalAlbums: albums.length,
      genreCount,
      catalogValue,
      baseValue,
      multiplier: Math.round(totalMultiplier * 100),
      genreDiversityBonus: Math.round(genreDiversityBonus * 100),
      artistDiversityBonus: Math.round(artistDiversityBonus * 100),
      rightsBonus: Math.round(rightsBonus * 100),
      gemaStats: { registered: gemaRegistered, pending: songs.length - gemaRegistered },
      isrcStats: { registered: isrcRegistered, pending: songs.length - isrcRegistered },
      iswcStats: { registered: iswcRegistered, pending: songs.length - iswcRegistered },
      genreDistribution,
      topArtists,
    };

    // Create PDF
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = margin;

    // Helper functions
    const addText = (text: string, x: number, yPos: number, options?: { fontSize?: number; fontStyle?: "normal" | "bold"; color?: [number, number, number] }) => {
      const { fontSize = 10, fontStyle = "normal", color = [0, 0, 0] } = options || {};
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", fontStyle);
      doc.setTextColor(...color);
      doc.text(text, x, yPos);
      return yPos + (fontSize * 0.5);
    };

    const addLine = (yPos: number) => {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      return yPos + 3;
    };

    const checkPage = (neededSpace: number) => {
      if (y + neededSpace > 280) {
        doc.addPage();
        y = margin;
      }
    };

    // Header
    y = addText("MUSIKKATALOG ANALYSE", margin, y, { fontSize: 18, fontStyle: "bold", color: [139, 92, 246] });
    y += 2;
    y = addText("Bewertungsreport für Wirtschaftsprüfung", margin, y, { fontSize: 11, color: [100, 100, 100] });
    y += 4;
    y = addText(`Stand: ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, y, { fontSize: 9, color: [120, 120, 120] });
    y += 6;
    y = addLine(y);
    y += 6;

    // Catalog Valuation Section
    y = addText("RECHNERISCHER KATALOGWERT", margin, y, { fontSize: 14, fontStyle: "bold" });
    y += 6;
    
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, y - 2, pageWidth - 2 * margin, 35, 3, 3, "F");
    
    y = addText(`${stats.catalogValue.toLocaleString('de-DE')} €`, margin + 5, y + 6, { fontSize: 24, fontStyle: "bold", color: [139, 92, 246] });
    y += 4;
    y = addText(`Basiswert: ${stats.baseValue.toLocaleString('de-DE')} € (${stats.songsWithAudio} Songs × 850 €)`, margin + 5, y, { fontSize: 9, color: [80, 80, 80] });
    y += 5;
    y = addText(`Multiplikator: ${stats.multiplier}% (Genre +${stats.genreDiversityBonus}% | Künstler +${stats.artistDiversityBonus}% | Rechte +${stats.rightsBonus}%)`, margin + 5, y, { fontSize: 9, color: [80, 80, 80] });
    y += 12;

    // Methodology Box
    y = addText("BEWERTUNGSMETHODIK", margin, y, { fontSize: 12, fontStyle: "bold" });
    y += 4;
    
    doc.setFillColor(254, 249, 195);
    doc.roundedRect(margin, y - 2, pageWidth - 2 * margin, 42, 3, 3, "F");
    
    const methodologyText = [
      "• Basiswert: 850 € pro verfügbarem Song (Branchendurchschnitt für Eigenproduktionen)",
      "• Genre-Vielfalt-Bonus: +2,5% pro Genre (max. 25%) - diversifiziertes Portfolio",
      "• Künstler-Diversität: +0,75% pro Künstler (max. 15%) - breitere Marktabdeckung",
      "• Vollrechte-Premium: +20% für 100% Eigenproduktion ohne Lizenzpflichten",
      "• Hinweis: Diese Bewertung stellt eine Eigeneinschätzung dar und ersetzt keine",
      "  professionelle Wirtschaftsprüfung oder unabhängige Katalogbewertung.",
    ];
    
    y += 2;
    for (const line of methodologyText) {
      y = addText(line, margin + 3, y, { fontSize: 8, color: [80, 80, 80] });
      y += 1;
    }
    y += 8;

    // Key Metrics
    checkPage(50);
    y = addText("KENNZAHLEN", margin, y, { fontSize: 12, fontStyle: "bold" });
    y += 6;

    const metrics = [
      { label: "Verfügbare Titel", value: stats.songsWithAudio.toLocaleString('de-DE'), sub: `${Math.round((stats.songsWithAudio / stats.totalSongs) * 100)}% Abdeckung` },
      { label: "Künstler im Katalog", value: stats.totalArtists.toLocaleString('de-DE'), sub: `${stats.genreCount} Genres` },
      { label: "Alben", value: stats.totalAlbums.toLocaleString('de-DE'), sub: "im Katalog" },
      { label: "Rechtestatus", value: "100%", sub: "Eigenproduktion" },
    ];

    const colWidth = (pageWidth - 2 * margin) / 4;
    for (let i = 0; i < metrics.length; i++) {
      const x = margin + i * colWidth;
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(x, y, colWidth - 4, 22, 2, 2, "F");
      addText(metrics[i].label, x + 3, y + 6, { fontSize: 7, color: [120, 120, 120] });
      addText(metrics[i].value, x + 3, y + 13, { fontSize: 14, fontStyle: "bold" });
      addText(metrics[i].sub, x + 3, y + 19, { fontSize: 7, color: [120, 120, 120] });
    }
    y += 30;

    // Registration Stats
    checkPage(50);
    y = addText("REGISTRIERUNGSSTATUS", margin, y, { fontSize: 12, fontStyle: "bold" });
    y += 6;

    const regStats = [
      { label: "GEMA", registered: stats.gemaStats.registered, pending: stats.gemaStats.pending, total: stats.totalSongs },
      { label: "ISRC", registered: stats.isrcStats.registered, pending: stats.isrcStats.pending, total: stats.totalSongs },
      { label: "ISWC", registered: stats.iswcStats.registered, pending: stats.iswcStats.pending, total: stats.totalSongs },
    ];

    for (const stat of regStats) {
      const percentage = stat.total > 0 ? Math.round((stat.registered / stat.total) * 100) : 0;
      y = addText(`${stat.label}:`, margin, y, { fontSize: 10, fontStyle: "bold" });
      
      // Progress bar background
      doc.setFillColor(229, 231, 235);
      doc.roundedRect(margin + 20, y - 3, 80, 5, 2, 2, "F");
      
      // Progress bar fill
      if (percentage > 0) {
        const fillColor: [number, number, number] = percentage >= 50 ? [34, 197, 94] : [251, 191, 36];
        doc.setFillColor(...fillColor);
        doc.roundedRect(margin + 20, y - 3, Math.max(80 * (percentage / 100), 2), 5, 2, 2, "F");
      }
      
      addText(`${stat.registered} registriert / ${stat.pending} ausstehend (${percentage}%)`, margin + 105, y, { fontSize: 9, color: [80, 80, 80] });
      y += 8;
    }
    y += 4;

    // Genre Distribution
    checkPage(60);
    y = addLine(y);
    y += 4;
    y = addText("GENRE-VERTEILUNG", margin, y, { fontSize: 12, fontStyle: "bold" });
    y += 6;

    for (const genre of stats.genreDistribution.slice(0, 8)) {
      y = addText(genre.genre, margin, y, { fontSize: 9 });
      
      // Progress bar
      doc.setFillColor(229, 231, 235);
      doc.roundedRect(margin + 40, y - 3, 60, 4, 1, 1, "F");
      doc.setFillColor(139, 92, 246);
      doc.roundedRect(margin + 40, y - 3, Math.max(60 * (genre.percentage / 100), 2), 4, 1, 1, "F");
      
      addText(`${genre.count} (${genre.percentage}%)`, margin + 105, y, { fontSize: 8, color: [100, 100, 100] });
      y += 6;
    }
    y += 4;

    // Top Artists
    checkPage(60);
    y = addText("TOP KÜNSTLER NACH SONG-ANZAHL", margin, y, { fontSize: 12, fontStyle: "bold" });
    y += 6;

    // Table header
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y - 3, pageWidth - 2 * margin, 7, "F");
    addText("#", margin + 2, y + 1, { fontSize: 8, fontStyle: "bold", color: [80, 80, 80] });
    addText("Künstler", margin + 12, y + 1, { fontSize: 8, fontStyle: "bold", color: [80, 80, 80] });
    addText("Songs", margin + 90, y + 1, { fontSize: 8, fontStyle: "bold", color: [80, 80, 80] });
    addText("Alben", margin + 115, y + 1, { fontSize: 8, fontStyle: "bold", color: [80, 80, 80] });
    y += 7;

    for (let i = 0; i < Math.min(stats.topArtists.length, 10); i++) {
      const artist = stats.topArtists[i];
      addText(`${i + 1}`, margin + 2, y, { fontSize: 8, color: [120, 120, 120] });
      addText(artist.name.substring(0, 35), margin + 12, y, { fontSize: 8 });
      addText(artist.songCount.toString(), margin + 90, y, { fontSize: 8 });
      addText(artist.albumCount.toString(), margin + 115, y, { fontSize: 8 });
      y += 5;
    }

    // Footer
    y = 285;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y - 5, pageWidth - margin, y - 5);
    addText("Dieses Dokument wurde automatisch generiert und dient ausschließlich Informationszwecken.", margin, y, { fontSize: 7, color: [150, 150, 150] });
    addText(`Generiert am ${new Date().toLocaleString('de-DE')} | sc-oo-pas Musikkatalog`, margin, y + 4, { fontSize: 7, color: [150, 150, 150] });

    // Save
    doc.save(`Katalogbewertung_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF-Report erstellt");
  } catch (error) {
    console.error("PDF export error:", error);
    toast.error("PDF-Export fehlgeschlagen");
    throw error;
  }
}
