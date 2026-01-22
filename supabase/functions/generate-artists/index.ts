import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Du bist ein kreativer Musik-Industrie-Experte, der einzigartige fiktive Künstlerprofile erstellt.

WICHTIGE REGELN:
1. ALLE Namen (Künstler, Alben, Songs) müssen KOMPLETT NEU und EINZIGARTIG sein
2. KEINE Ähnlichkeit zu bekannten Künstlern (Namen, Stil-Beschreibungen)
3. Vermeide Standard-KI-Klischees wie: Neon, Lichter, Straßen, Stadt, Urban, Cyber, Echo, Shadow, Dream, Pulse
4. Verwende diverse Genres: Rock, Jazz, Folk, Electronic, World Music, Klassik-Fusion, Indie, Experimental, Blues, Reggae, Country, Soul, Funk, Ambient, Post-Punk, etc.
5. Jeder Künstler soll einen VÖLLIG anderen Stil haben
6. Persönlichkeitsprompts sollen tiefgründig und charakteristisch sein
7. SUNO Stimmfrequenz-Prompts müssen technisch präzise und einzigartig sein

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

Beispiel-Format:
[
  {
    "name": "Velira Thornweiss",
    "personality": "Eine mysteriöse Komponistin aus den Karpaten...",
    "voicePrompt": "Deep contralto voice with a distinctive grainy texture, subtle Eastern European accent inflections, controlled vibrato that intensifies on sustained notes, breathy whisper-to-full-voice transitions, melancholic undertones with occasional fierce crescendos, resonant chest voice with ethereal head voice harmonics",
    "genre": "Dark Folk",
    "style": "Carpathian Chamber Folk",
    "albums": [
      {
        "name": "Wurzelgesang",
        "songs": ["Der Steinkreis erwacht", "Mondmilch", ...]
      }
    ]
  }
]

WICHTIG: Antworte NUR mit dem JSON-Array, kein anderer Text!`;

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
        temperature: 0.9,
        max_tokens: 8000,
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
      // Try to extract JSON from the response (in case there's surrounding text)
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
