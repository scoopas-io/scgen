import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  artistCount: number;
  albumCount: number;
  songCount: number;
  selectedGenres: string[];
  selectedLanguages: string[];
}

const LANGUAGE_NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "Englisch", 
  es: "Spanisch",
  fr: "Französisch",
  it: "Italienisch",
  pt: "Portugiesisch",
  nl: "Niederländisch",
  pl: "Polnisch",
  ru: "Russisch",
  uk: "Ukrainisch",
  tr: "Türkisch",
  ar: "Arabisch",
  he: "Hebräisch",
  hi: "Hindi",
  zh: "Chinesisch",
  ja: "Japanisch",
  ko: "Koreanisch",
  th: "Thai",
  vi: "Vietnamesisch",
  id: "Indonesisch",
  ms: "Malaiisch",
  tl: "Filipino",
  sv: "Schwedisch",
  da: "Dänisch",
  fi: "Finnisch",
  no: "Norwegisch",
  el: "Griechisch",
  cs: "Tschechisch",
  hu: "Ungarisch",
  ro: "Rumänisch",
  bg: "Bulgarisch",
  hr: "Kroatisch",
  sk: "Slowakisch",
  sr: "Serbisch",
  sw: "Suaheli",
};

const TONARTEN = ["C-Dur", "D-Dur", "E-Dur", "F-Dur", "G-Dur", "A-Dur", "H-Dur", "a-Moll", "d-Moll", "e-Moll", "g-Moll"];
const generateISRC = () => `DE-KI${Date.now().toString(36).slice(-3).toUpperCase()}-${Math.floor(Math.random() * 99).toString().padStart(2, '0')}-${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`;
const generateISWC = () => `T-${Math.floor(Math.random() * 999999999).toString().padStart(9, '0')}-${Math.floor(Math.random() * 9)}`;
const generateGEMANr = () => `GW-${Math.floor(Math.random() * 9999999).toString().padStart(7, '0')}`;
const generateKatalogNr = (index: number) => `CAT-${String(index).padStart(4, '0')}`;
const generateSongId = (artistIndex: number, albumIndex: number, songIndex: number) => 
  `SNG-${artistIndex.toString().padStart(2, '0')}${albumIndex.toString().padStart(2, '0')}${songIndex.toString().padStart(3, '0')}`;
const randomBPM = () => Math.floor(Math.random() * 100) + 70;
const randomTonart = () => TONARTEN[Math.floor(Math.random() * TONARTEN.length)];
const randomLength = () => {
  const min = Math.floor(Math.random() * 3) + 2;
  const sec = Math.floor(Math.random() * 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artistCount, albumCount, songCount, selectedGenres, selectedLanguages }: GenerateRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch existing names
    const [artistsResult, albumsResult, songsResult] = await Promise.all([
      supabase.from("artists").select("name, katalognummer"),
      supabase.from("albums").select("name"),
      supabase.from("songs").select("name"),
    ]);

    const existingArtists = (artistsResult.data || []).map((a) => a.name);
    const existingAlbums = (albumsResult.data || []).map((a) => a.name);
    const existingSongs = (songsResult.data || []).map((s) => s.name);
    const lastKatalogNr = Math.max(0, ...(artistsResult.data || [])
      .map(a => parseInt(a.katalognummer?.replace('CAT-', '') || '0'))
      .filter(n => !isNaN(n)));

    const genreFilter = selectedGenres.length > 0 
      ? `Generiere NUR Künstler aus diesen Genres: ${selectedGenres.join(", ")}.`
      : "Verwende diverse Genres.";

    const languageNames = (selectedLanguages || [])
      .map(code => LANGUAGE_NAMES[code])
      .filter(Boolean);
    
    const languageFilter = languageNames.length > 0
      ? `WICHTIG: Generiere Künstler, deren Namen, Albumtitel und Songtitel in diesen Sprachen sind: ${languageNames.join(", ")}. Die Namen und Titel sollen authentisch in der jeweiligen Sprache klingen, mit korrekter Grammatik und typischen Namenskonventionen der jeweiligen Kultur.`
      : "Generiere deutsche Künstlernamen, Album- und Songtitel.";

    const systemPrompt = `Du bist ein kreativer Musik-Industrie-Experte für einzigartige fiktive Künstlerprofile.

REGELN:
1. ALLE Namen müssen KOMPLETT NEU und EINZIGARTIG sein
2. KEINE Ähnlichkeit zu bekannten Künstlern
3. Vermeide KI-Klischees: Neon, Lichter, Straßen, Stadt, Urban, Cyber, Echo, Shadow, Dream, Pulse
4. ${genreFilter}
5. ${languageFilter}
6. Persönlichkeitsprompts sollen tiefgründig sein
7. SUNO Stimmfrequenz-Prompts müssen technisch präzise sein (auf Englisch)

EXISTIERENDE NAMEN (NICHT VERWENDEN!):
- Künstler: ${existingArtists.slice(0, 100).join(", ") || "keine"}
- Alben: ${existingAlbums.slice(0, 100).join(", ") || "keine"}  
- Songs: ${existingSongs.slice(0, 200).join(", ") || "keine"}

Antworte NUR mit einem validen JSON-Array.`;

    const userPrompt = `Generiere ${artistCount} einzigartige Künstlerprofile.

Für JEDEN Künstler:
- name: Kreativer Künstlername
- personality: Detaillierter Persönlichkeitsprompt (3-4 Sätze)
- voicePrompt: Ausführlicher SUNO Stimmfrequenz-Prompt auf Englisch (mind. 50 Wörter)
- genre: Hauptgenre
- style: Spezifischer Stil
- imagePrompt: Kurze Beschreibung für ein Profilbild (auf Englisch, beschreibe Aussehen, Kleidung, Atmosphäre passend zum Genre, KEINE bekannten Personen)
- albums: Array mit ${albumCount} Alben, jedes mit:
  - name: Einzigartiger Albumname
  - songs: Array mit ${songCount} Objekten, jedes mit:
    - name: Songtitel
    - komponist: Name des Komponisten (kann Künstler sein)
    - textdichter: Name des Textdichters

WICHTIG: Antworte NUR mit dem JSON-Array!`;

    console.log("Generating artists...");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.95,
        max_tokens: 32000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte warte kurz." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Kontingent erschöpft." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Fehler bei der KI-Generierung");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Keine Antwort von der KI");

    let artists;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      artists = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      console.error("JSON parse error, content:", content);
      throw new Error("Fehler beim Parsen der KI-Antwort");
    }

    console.log(`Generated ${artists.length} artists, now generating images...`);

    // Generate images and save to database
    const savedArtists = [];
    let katalogIndex = lastKatalogNr + 1;

    for (let artistIdx = 0; artistIdx < artists.length; artistIdx++) {
      const artist = artists[artistIdx];
      
      // Check duplicate
      const { data: existing } = await supabase.from("artists").select("id").eq("name", artist.name).maybeSingle();
      if (existing) {
        console.log(`Artist ${artist.name} exists, skipping`);
        continue;
      }

      let profileImageUrl = null;

      // Generate profile image
      try {
        const imagePrompt = artist.imagePrompt || `Portrait of a ${artist.genre} musician, ${artist.style} aesthetic, professional photo, artistic lighting`;
        console.log(`Generating image for ${artist.name}...`);
        
        const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [{ role: "user", content: `Generate a professional artist portrait photo: ${imagePrompt}. The image should be suitable for a music artist profile, high quality, artistic.` }],
            modalities: ["image", "text"],
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (base64Image && base64Image.startsWith('data:image')) {
            // Extract base64 data
            const base64Data = base64Image.split(',')[1];
            const imageBytes = decode(base64Data);
            const fileName = `${artist.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
            
            // Upload to storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('artist-images')
              .upload(fileName, imageBytes, { contentType: 'image/png', upsert: true });

            if (!uploadError && uploadData) {
              const { data: publicUrl } = supabase.storage.from('artist-images').getPublicUrl(fileName);
              profileImageUrl = publicUrl.publicUrl;
              console.log(`Image uploaded for ${artist.name}`);
            } else {
              console.error("Upload error:", uploadError);
            }
          }
        }
      } catch (imgError) {
        console.error(`Image generation failed for ${artist.name}:`, imgError);
      }

      const katalognummer = generateKatalogNr(katalogIndex++);

      // Insert artist
      const { data: insertedArtist, error: artistError } = await supabase
        .from("artists")
        .insert({
          name: artist.name,
          personality: artist.personality,
          voice_prompt: artist.voicePrompt,
          genre: artist.genre,
          style: artist.style,
          profile_image_url: profileImageUrl,
          katalognummer,
          verlag: 'KI-Musikverlag',
          label: 'AI Records',
          rechteinhaber_master: 'AI Records',
          rechteinhaber_publishing: 'KI-Musikverlag',
        })
        .select("id")
        .single();

      if (artistError) {
        console.error("Error inserting artist:", artistError);
        continue;
      }

      const savedAlbums = [];

      for (let albumIdx = 0; albumIdx < (artist.albums || []).length; albumIdx++) {
        const album = artist.albums[albumIdx];
        
        const { data: existingAlbum } = await supabase.from("albums").select("id").eq("name", album.name).maybeSingle();
        if (existingAlbum) continue;

        const releaseDate = new Date();
        releaseDate.setMonth(releaseDate.getMonth() - Math.floor(Math.random() * 24));

        const { data: insertedAlbum, error: albumError } = await supabase
          .from("albums")
          .insert({
            artist_id: insertedArtist.id,
            name: album.name,
            release_date: releaseDate.toISOString().split('T')[0],
          })
          .select("id")
          .single();

        if (albumError) continue;

        const savedSongs = [];

        for (let songIdx = 0; songIdx < (album.songs || []).length; songIdx++) {
          const song = album.songs[songIdx];
          const songName = typeof song === 'string' ? song : song.name;
          const komponist = typeof song === 'object' ? song.komponist : artist.name;
          const textdichter = typeof song === 'object' ? song.textdichter : artist.name;

          const { data: existingSong } = await supabase.from("songs").select("id").eq("name", songName).maybeSingle();
          if (existingSong) continue;

          const songId = generateSongId(artistIdx + 1, albumIdx + 1, songIdx + 1);

          const { error: songError } = await supabase
            .from("songs")
            .insert({
              album_id: insertedAlbum.id,
              name: songName,
              track_number: songIdx + 1,
              song_id: songId,
              komponist,
              textdichter,
              isrc: generateISRC(),
              iswc: generateISWC(),
              gema_werknummer: generateGEMANr(),
              bpm: randomBPM(),
              tonart: randomTonart(),
              laenge: randomLength(),
            });

          if (!songError) {
            savedSongs.push(songName);
          }
        }

        savedAlbums.push({ name: album.name, songs: savedSongs });
      }

      savedArtists.push({
        ...artist,
        id: insertedArtist.id,
        profileImageUrl,
        katalognummer,
        albums: savedAlbums,
      });
    }

    console.log(`Saved ${savedArtists.length} artists to database`);

    return new Response(JSON.stringify({ artists: savedArtists }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
