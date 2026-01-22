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

// Reverse lookup: language name to code
const LANGUAGE_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(LANGUAGE_NAMES).map(([code, name]) => [name.toLowerCase(), code])
);

const getLanguageCode = (languageName: string): string => {
  if (!languageName) return "de";
  const lower = languageName.toLowerCase();
  // Direct match
  if (LANGUAGE_CODES[lower]) return LANGUAGE_CODES[lower];
  // Partial match
  for (const [name, code] of Object.entries(LANGUAGE_CODES)) {
    if (lower.includes(name) || name.includes(lower)) return code;
  }
  return "de";
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

  // Check if client wants SSE streaming
  const url = new URL(req.url);
  const useStreaming = url.searchParams.get("stream") === "true";

  try {
    const { artistCount, albumCount, songCount, selectedGenres, selectedLanguages }: GenerateRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // SSE streaming setup
    if (useStreaming) {
      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      const sendEvent = async (event: string, data: unknown) => {
        await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Run generation in background
      (async () => {
        try {
          await sendEvent("phase", { phase: "preparing", progress: 2, message: "Lade existierende Daten..." });

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

          await sendEvent("phase", { phase: "generating_text", progress: 5, message: "KI generiert Künstlerprofile..." });

          const genreFilter = selectedGenres.length > 0 
            ? `Generiere NUR Künstler aus diesen Genres: ${selectedGenres.join(", ")}.`
            : "Verwende diverse Genres.";

          const languageNames = (selectedLanguages || [])
            .map(code => LANGUAGE_NAMES[code])
            .filter(Boolean);
          
          const languageFilter = languageNames.length > 0
            ? `KRITISCH - SPRACHVORGABE: 
- Künstlernamen MÜSSEN typische Namen aus diesen Kulturen/Sprachen sein: ${languageNames.join(", ")}
- Albumtitel MÜSSEN in diesen Sprachen geschrieben sein: ${languageNames.join(", ")}
- Songtitel MÜSSEN in diesen Sprachen geschrieben sein: ${languageNames.join(", ")}
- Der Persönlichkeitsprompt MUSS in der jeweiligen Sprache des Künstlers geschrieben sein (NICHT auf Deutsch!)
- Bei mehreren Sprachen: Verteile die Künstler gleichmäßig auf die verschiedenen Sprachen`
            : "Generiere deutsche Künstlernamen, Album- und Songtitel. Der Persönlichkeitsprompt auf Deutsch.";

          const systemPrompt = `Du bist ein kreativer Musik-Industrie-Experte für einzigartige fiktive Künstlerprofile aus verschiedenen Kulturen und Ländern.

REGELN:
1. ALLE Namen müssen KOMPLETT NEU und EINZIGARTIG sein
2. KEINE Ähnlichkeit zu bekannten Künstlern
3. ${genreFilter}
4. ${languageFilter}

EXISTIERENDE NAMEN (NICHT VERWENDEN!):
- Künstler: ${existingArtists.slice(0, 50).join(", ") || "keine"}

Antworte NUR mit einem validen JSON-Array.`;

          const personalityLanguageHint = languageNames.length > 0 
            ? `Der Persönlichkeitsprompt MUSS in der Sprache des Künstlers geschrieben sein (${languageNames.join(" oder ")}) - NICHT auf Deutsch!`
            : "Der Persönlichkeitsprompt auf Deutsch.";

          const userPrompt = `Generiere ${artistCount} einzigartige Künstlerprofile.

Für JEDEN Künstler:
- name: Kreativer Künstlername
- personality: ${personalityLanguageHint} (3-4 Sätze)
- voicePrompt: SUNO Stimmfrequenz-Prompt auf Englisch (mind. 50 Wörter)
- genre: Hauptgenre
- style: Spezifischer Stil
- language: Sprache des Künstlers
- imagePrompt: Kurze Beschreibung für Profilbild (auf Englisch)
- albums: Array mit ${albumCount} Alben, jedes mit:
  - name: Albumname
  - songs: Array mit ${songCount} Objekten mit name, komponist, textdichter

WICHTIG: Antworte NUR mit dem JSON-Array!`;

          await sendEvent("phase", { phase: "generating_text", progress: 10, message: "Warte auf KI-Antwort..." });

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
            const errorText = await response.text();
            await sendEvent("error", { error: `KI-Fehler: ${response.status}` });
            await writer.close();
            return;
          }

          await sendEvent("phase", { phase: "generating_text", progress: 25, message: "KI-Antwort erhalten, verarbeite..." });

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (!content) {
            await sendEvent("error", { error: "Keine KI-Antwort" });
            await writer.close();
            return;
          }

          let artists;
          try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            artists = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
          } catch {
            await sendEvent("error", { error: "JSON Parse Error" });
            await writer.close();
            return;
          }

          await sendEvent("phase", { phase: "saving_db", progress: 30, message: `${artists.length} Künstler werden gespeichert...` });

          // Save artists to DB
          const artistsToProcess = [];
          let katalogIndex = lastKatalogNr + 1;
          
          for (let artistIdx = 0; artistIdx < artists.length; artistIdx++) {
            const artist = artists[artistIdx];
            const saveProgress = 30 + (artistIdx / artists.length) * 10;
            
            await sendEvent("progress", { 
              phase: "saving_db", 
              progress: Math.round(saveProgress),
              current: artistIdx + 1,
              total: artists.length,
              currentArtist: artist.name
            });
            
            const { data: existing } = await supabase.from("artists").select("id").eq("name", artist.name).maybeSingle();
            if (existing) continue;

            const katalognummer = generateKatalogNr(katalogIndex++);
            const languageCode = getLanguageCode(artist.language || "");
            
            const { data: insertedArtist, error: artistError } = await supabase
              .from("artists")
              .insert({
                name: artist.name,
                personality: artist.personality,
                voice_prompt: artist.voicePrompt,
                genre: artist.genre,
                style: artist.style,
                profile_image_url: null,
                katalognummer,
                verlag: 'Musikverlag',
                label: 'Eigenproduktion',
                rechteinhaber_master: 'Eigenproduktion',
                rechteinhaber_publishing: 'Musikverlag',
                language: languageCode,
              })
              .select("id")
              .single();

            if (artistError) continue;

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

                if (!songError) savedSongs.push(songName);
              }
              savedAlbums.push({ id: insertedAlbum.id, name: album.name, songs: savedSongs });
            }

            artistsToProcess.push({
              ...artist,
              id: insertedArtist.id,
              katalognummer,
              albums: savedAlbums,
            });
          }

          await sendEvent("phase", { phase: "generating_images", progress: 40, message: `Generiere ${artistsToProcess.length} Profilbilder...`, imagesTotal: artistsToProcess.length });

          // Generate images in parallel (batches of 3)
          const PARALLEL_IMAGES = 3;
          let imagesCompleted = 0;
          
          for (let i = 0; i < artistsToProcess.length; i += PARALLEL_IMAGES) {
            const batch = artistsToProcess.slice(i, i + PARALLEL_IMAGES);
            
            const imagePromises = batch.map(async (artist) => {
              try {
                const imagePrompt = artist.imagePrompt || `Portrait of a ${artist.genre} musician, ${artist.style} aesthetic, professional photo`;
                
                const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash-image-preview",
                    messages: [{ role: "user", content: `Generate a professional artist portrait photo: ${imagePrompt}. High quality, artistic.` }],
                    modalities: ["image", "text"],
                  }),
                });

                if (imageResponse.ok) {
                  const imageData = await imageResponse.json();
                  const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
                  
                  if (base64Image && base64Image.startsWith('data:image')) {
                    const base64Data = base64Image.split(',')[1];
                    const imageBytes = decode(base64Data);
                    const fileName = `${artist.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff\uac00-\ud7af]/g, '_')}_${Date.now()}.png`;
                    
                    const { data: uploadData, error: uploadError } = await supabase.storage
                      .from('artist-images')
                      .upload(fileName, imageBytes, { contentType: 'image/png', upsert: true });

                    if (!uploadError && uploadData) {
                      const { data: publicUrl } = supabase.storage.from('artist-images').getPublicUrl(fileName);
                      await supabase.from("artists").update({ profile_image_url: publicUrl.publicUrl }).eq("id", artist.id);
                      artist.profileImageUrl = publicUrl.publicUrl;
                    }
                  }
                }
              } catch (imgError) {
                console.error(`Image generation failed for ${artist.name}:`, imgError);
              }
              
              imagesCompleted++;
              const imageProgress = 40 + (imagesCompleted / artistsToProcess.length) * 55;
              await sendEvent("progress", {
                phase: "generating_images",
                progress: Math.round(imageProgress),
                imagesGenerated: imagesCompleted,
                imagesTotal: artistsToProcess.length,
                currentArtist: artist.name
              });
              
              return artist;
            });

            await Promise.all(imagePromises);
          }

          await sendEvent("phase", { phase: "complete", progress: 100, message: "Fertig!" });
          await sendEvent("complete", { artists: artistsToProcess });
          await writer.close();
          
        } catch (error) {
          console.error("Stream error:", error);
          await sendEvent("error", { error: error instanceof Error ? error.message : "Unbekannter Fehler" });
          await writer.close();
        }
      })();

      return new Response(stream.readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Non-streaming fallback (original behavior)
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
      ? `KRITISCH - SPRACHVORGABE: 
- Künstlernamen MÜSSEN typische Namen aus diesen Kulturen/Sprachen sein: ${languageNames.join(", ")}
- Albumtitel MÜSSEN in diesen Sprachen geschrieben sein: ${languageNames.join(", ")}
- Songtitel MÜSSEN in diesen Sprachen geschrieben sein: ${languageNames.join(", ")}
- Der Persönlichkeitsprompt MUSS in der jeweiligen Sprache des Künstlers geschrieben sein (NICHT auf Deutsch!)
- Bei mehreren Sprachen: Verteile die Künstler gleichmäßig auf die verschiedenen Sprachen`
      : "Generiere deutsche Künstlernamen, Album- und Songtitel. Der Persönlichkeitsprompt auf Deutsch.";

    const systemPrompt = `Du bist ein kreativer Musik-Industrie-Experte für einzigartige fiktive Künstlerprofile.

REGELN:
1. ALLE Namen müssen KOMPLETT NEU und EINZIGARTIG sein
2. ${genreFilter}
3. ${languageFilter}

EXISTIERENDE NAMEN (NICHT VERWENDEN!):
- Künstler: ${existingArtists.slice(0, 50).join(", ") || "keine"}

Antworte NUR mit einem validen JSON-Array.`;

    const personalityLanguageHint = languageNames.length > 0 
      ? `Der Persönlichkeitsprompt MUSS in der Sprache des Künstlers sein.`
      : "Der Persönlichkeitsprompt auf Deutsch.";

    const userPrompt = `Generiere ${artistCount} einzigartige Künstlerprofile.

Für JEDEN Künstler:
- name, personality, voicePrompt, genre, style, language, imagePrompt
- albums: Array mit ${albumCount} Alben (name, songs: Array mit ${songCount} {name, komponist, textdichter})

Antworte NUR mit JSON-Array!`;

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
        return new Response(JSON.stringify({ error: "Rate limit erreicht." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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
      throw new Error("Fehler beim Parsen der KI-Antwort");
    }

    const savedArtists = [];
    let katalogIndex = lastKatalogNr + 1;
    
    for (let artistIdx = 0; artistIdx < artists.length; artistIdx++) {
      const artist = artists[artistIdx];
      
      const { data: existing } = await supabase.from("artists").select("id").eq("name", artist.name).maybeSingle();
      if (existing) continue;

      const katalognummer = generateKatalogNr(katalogIndex++);
      const languageCode = getLanguageCode(artist.language || "");
      
      const { data: insertedArtist, error: artistError } = await supabase
        .from("artists")
        .insert({
          name: artist.name,
          personality: artist.personality,
          voice_prompt: artist.voicePrompt,
          genre: artist.genre,
          style: artist.style,
          katalognummer,
          language: languageCode,
        })
        .select("id")
        .single();

      if (artistError) continue;

      const savedAlbums = [];
      for (const album of artist.albums || []) {
        const { data: insertedAlbum } = await supabase
          .from("albums")
          .insert({ artist_id: insertedArtist.id, name: album.name })
          .select("id")
          .single();

        if (!insertedAlbum) continue;

        const savedSongs = [];
        for (let songIdx = 0; songIdx < (album.songs || []).length; songIdx++) {
          const song = album.songs[songIdx];
          const songName = typeof song === 'string' ? song : song.name;

          await supabase.from("songs").insert({
            album_id: insertedAlbum.id,
            name: songName,
            track_number: songIdx + 1,
            isrc: generateISRC(),
          });
          savedSongs.push(songName);
        }
        savedAlbums.push({ id: insertedAlbum.id, name: album.name, songs: savedSongs });
      }

      savedArtists.push({ ...artist, id: insertedArtist.id, katalognummer, albums: savedAlbums });
    }

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
