import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  artistCount: number;
  albumCount: number;
  songCount: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artistCount, albumCount, songCount }: GenerateRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch existing names from database to avoid duplicates
    const [artistsResult, albumsResult, songsResult] = await Promise.all([
      supabase.from("artists").select("name"),
      supabase.from("albums").select("name"),
      supabase.from("songs").select("name"),
    ]);

    const existingArtists = (artistsResult.data || []).map((a) => a.name);
    const existingAlbums = (albumsResult.data || []).map((a) => a.name);
    const existingSongs = (songsResult.data || []).map((s) => s.name);

    const systemPrompt = `Du bist ein kreativer Musik-Industrie-Experte, der einzigartige fiktive Künstlerprofile erstellt.

WICHTIGE REGELN:
1. ALLE Namen (Künstler, Alben, Songs) müssen KOMPLETT NEU und EINZIGARTIG sein
2. KEINE Ähnlichkeit zu bekannten Künstlern (Namen, Stil-Beschreibungen)
3. Vermeide Standard-KI-Klischees wie: Neon, Lichter, Straßen, Stadt, Urban, Cyber, Echo, Shadow, Dream, Pulse
4. Verwende diverse Genres: Rock, Jazz, Folk, Electronic, World Music, Klassik-Fusion, Indie, Experimental, Blues, Reggae, Country, Soul, Funk, Ambient, Post-Punk, etc.
5. Jeder Künstler soll einen VÖLLIG anderen Stil haben
6. Persönlichkeitsprompts sollen tiefgründig und charakteristisch sein
7. SUNO Stimmfrequenz-Prompts müssen technisch präzise und einzigartig sein

BEREITS EXISTIERENDE NAMEN (NICHT VERWENDEN!):
- Künstler: ${existingArtists.slice(0, 100).join(", ") || "keine"}
- Alben: ${existingAlbums.slice(0, 100).join(", ") || "keine"}
- Songs: ${existingSongs.slice(0, 200).join(", ") || "keine"}

Für den SUNO Stimmfrequenz-Prompt verwende diese Parameter-Kategorien:
- Stimmhöhe (Bass, Bariton, Tenor, Alt, Sopran, etc.)
- Klangfarbe (rauchig, kristallklar, warm, metallisch, samtig, etc.)
- Artikulation (fließend, staccato, legato, gebrochen, etc.)
- Besondere Merkmale (Vibrato, Hauch, Knurren, Falsett, etc.)
- Emotionale Färbung (melancholisch, ekstatisch, distanziert, intim, etc.)

Antworte NUR mit einem validen JSON-Array ohne zusätzlichen Text.`;

    const userPrompt = `Generiere ${artistCount} komplett einzigartige Künstlerprofile.

Für JEDEN Künstler erstelle:
- name: Ein kreativer, ungewöhnlicher Künstlername (keine englischen Standardnamen)
- personality: Ein detaillierter Persönlichkeitsprompt (3-4 Sätze) der Hintergrund, Motivation und künstlerische Vision beschreibt
- voicePrompt: Ein ausführlicher technischer SUNO Stimmfrequenz-Prompt auf Englisch (mind. 50 Wörter) mit spezifischen Parametern
- genre: Das Hauptgenre
- style: Der spezifische Stil innerhalb des Genres
- albums: Array mit ${albumCount} Alben, jedes mit:
  - name: Ein einzigartiger Albumname (kann mehrsprachig sein)
  - songs: Array mit ${songCount} einzigartigen Songtiteln

WICHTIG: 
- Keiner der Namen darf in der Liste der existierenden Namen vorkommen!
- Antworte NUR mit dem JSON-Array, kein anderer Text!`;

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
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit erreicht. Bitte versuche es in einer Minute erneut." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Kontingent erschöpft. Bitte Credits aufladen." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Fehler bei der KI-Generierung" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("Keine Antwort von der KI erhalten");
    }

    // Parse the JSON from the AI response
    let artists;
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        artists = JSON.parse(jsonMatch[0]);
      } else {
        artists = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Content:", content);
      throw new Error("Fehler beim Parsen der KI-Antwort");
    }

    // Save to database
    for (const artist of artists) {
      // Check if artist name already exists
      const { data: existingArtist } = await supabase
        .from("artists")
        .select("id")
        .eq("name", artist.name)
        .maybeSingle();

      if (existingArtist) {
        console.log(`Artist ${artist.name} already exists, skipping`);
        continue;
      }

      // Insert artist
      const { data: insertedArtist, error: artistError } = await supabase
        .from("artists")
        .insert({
          name: artist.name,
          personality: artist.personality,
          voice_prompt: artist.voicePrompt,
          genre: artist.genre,
          style: artist.style,
        })
        .select("id")
        .single();

      if (artistError) {
        console.error("Error inserting artist:", artistError);
        continue;
      }

      // Insert albums
      for (const album of artist.albums || []) {
        const { data: existingAlbum } = await supabase
          .from("albums")
          .select("id")
          .eq("name", album.name)
          .maybeSingle();

        if (existingAlbum) {
          console.log(`Album ${album.name} already exists, skipping`);
          continue;
        }

        const { data: insertedAlbum, error: albumError } = await supabase
          .from("albums")
          .insert({
            artist_id: insertedArtist.id,
            name: album.name,
          })
          .select("id")
          .single();

        if (albumError) {
          console.error("Error inserting album:", albumError);
          continue;
        }

        // Insert songs
        for (let i = 0; i < (album.songs || []).length; i++) {
          const songName = album.songs[i];
          const { data: existingSong } = await supabase
            .from("songs")
            .select("id")
            .eq("name", songName)
            .maybeSingle();

          if (existingSong) {
            console.log(`Song ${songName} already exists, skipping`);
            continue;
          }

          const { error: songError } = await supabase
            .from("songs")
            .insert({
              album_id: insertedAlbum.id,
              name: songName,
              track_number: i + 1,
            });

          if (songError) {
            console.error("Error inserting song:", songError);
          }
        }
      }
    }

    return new Response(JSON.stringify({ artists }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-artists:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
