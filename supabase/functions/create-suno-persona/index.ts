import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePersonaRequest {
  artistId: string;
  songId: string; // Song with existing audio to base persona on
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUNO_API_KEY) {
      throw new Error("SUNO_API_KEY is not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { artistId, songId }: CreatePersonaRequest = await req.json();

    console.log(`Creating Suno persona for artist ${artistId} based on song ${songId}`);

    // Get artist data
    const { data: artist, error: artistError } = await supabase
      .from("artists")
      .select("*")
      .eq("id", artistId)
      .single();

    if (artistError || !artist) {
      throw new Error(`Artist not found: ${artistError?.message}`);
    }

    // Check if artist already has a persona
    if (artist.suno_persona_id) {
      return new Response(JSON.stringify({
        success: true,
        personaId: artist.suno_persona_id,
        message: "Artist already has a persona",
        alreadyExists: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get song with suno_task_id (needed to create persona)
    const { data: song, error: songError } = await supabase
      .from("songs")
      .select("*, albums!inner(artist_id)")
      .eq("id", songId)
      .single();

    if (songError || !song) {
      throw new Error(`Song not found: ${songError?.message}`);
    }

    if (!song.suno_task_id) {
      throw new Error("Song has no suno_task_id - cannot create persona from ungenerated song");
    }

    if (!song.audio_url) {
      throw new Error("Song has no audio - cannot create persona from ungenerated song");
    }

    // Build persona description from artist data
    const personaDescription = buildPersonaDescription(artist);
    console.log("Persona description:", personaDescription);

    // Suno requires a non-empty name field. Use a robust fallback.
    const personaName = String(artist.persona_name || artist.name || "").trim() ||
      `Artist ${String(artistId).slice(0, 8)}`;
    console.log("Persona name:", personaName);

    // Call Suno API to create persona
    // According to docs: POST /api/v1/generate/generate-persona
    const sunoResponse = await fetch("https://api.sunoapi.org/api/v1/generate/generate-persona", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUNO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: song.suno_task_id,
        // Some Suno API variants expect `name`, others `personaName`.
        // Sending both is harmless and avoids version mismatches.
        name: personaName,
        personaName,
        description: personaDescription,
      }),
    });

    if (!sunoResponse.ok) {
      const errorText = await sunoResponse.text();
      console.error("Suno persona API error:", sunoResponse.status, errorText);
      throw new Error(`Suno API error ${sunoResponse.status}: ${errorText.substring(0, 200)}`);
    }

    const sunoData = await sunoResponse.json();
    console.log("Suno persona response:", JSON.stringify(sunoData));

    // Suno sometimes returns HTTP 200 with an error code in JSON.
    if (typeof sunoData?.code === "number" && sunoData.code !== 200) {
      throw new Error(`Suno API error ${sunoData.code}: ${sunoData.msg || "Unknown error"}`);
    }

    // Extract persona ID from response
    const personaId = sunoData.data?.personaId || sunoData.personaId || sunoData.data?.id || sunoData.id;

    if (!personaId) {
      console.error("No personaId in response:", sunoData);
      throw new Error("Suno API did not return a persona ID");
    }

    // Save persona ID to artist
    const { error: updateError } = await supabase
      .from("artists")
      .update({ suno_persona_id: personaId })
      .eq("id", artistId);

    if (updateError) {
      console.error("Failed to save persona ID:", updateError);
      throw new Error(`Failed to save persona ID: ${updateError.message}`);
    }

    console.log(`Successfully created persona ${personaId} for artist ${artist.name}`);

    return new Response(JSON.stringify({
      success: true,
      personaId,
      artistName: artist.name,
      message: "Persona created successfully",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Build a detailed persona description from artist data
 */
function buildPersonaDescription(artist: any): string {
  const parts: string[] = [];
  
  // Artist name and core identity
  parts.push(`${artist.name} is a ${artist.genre} artist`);
  
  if (artist.style && artist.style !== artist.genre) {
    parts.push(`with a ${artist.style} style`);
  }
  
  // Vocal characteristics
  if (artist.vocal_gender === "f") {
    parts.push("with female vocals");
  } else if (artist.vocal_gender === "m") {
    parts.push("with male vocals");
  }
  
  if (artist.vocal_texture) {
    parts.push(`featuring a ${artist.vocal_texture} voice`);
  }
  
  if (artist.vocal_range) {
    parts.push(`in the ${artist.vocal_range} range`);
  }
  
  // Style and mood characteristics
  if (artist.style_tags && artist.style_tags.length > 0) {
    parts.push(`characterized by ${artist.style_tags.slice(0, 3).join(", ")}`);
  }
  
  if (artist.mood_tags && artist.mood_tags.length > 0) {
    parts.push(`with a ${artist.mood_tags.slice(0, 2).join(" and ")} mood`);
  }
  
  // Personality/vibe
  if (artist.personality) {
    // Extract key adjectives from personality
    const personalityWords = artist.personality
      .split(/[,.\s]+/)
      .filter((w: string) => w.length > 4)
      .slice(0, 3);
    if (personalityWords.length > 0) {
      parts.push(`known for being ${personalityWords.join(", ")}`);
    }
  }
  
  // Language
  if (artist.language && artist.language !== "en") {
    const langMap: Record<string, string> = {
      de: "German", fr: "French", es: "Spanish", it: "Italian",
      pt: "Portuguese", nl: "Dutch", ja: "Japanese", ko: "Korean"
    };
    const langName = langMap[artist.language] || artist.language;
    parts.push(`singing in ${langName}`);
  }
  
  return parts.join(" ");
}
