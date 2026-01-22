import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateSongRequest {
  songId: string;
  title: string;
  genre: string;
  style: string;
  voicePrompt: string;
  personality: string;
  bpm: number | null;
  tonart: string | null;
  artistName: string;
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
    const { songId, title, genre, style, voicePrompt, personality, bpm, tonart, artistName }: GenerateSongRequest = await req.json();

    console.log(`Starting Suno generation for: ${title} by ${artistName}`);

    // Update song status to generating
    await supabase
      .from("songs")
      .update({ generation_status: "generating" })
      .eq("id", songId);

    // Build the prompt for Suno - combining voice prompt and personality for lyrics/style
    const musicPrompt = buildMusicPrompt({
      title,
      genre,
      style,
      voicePrompt,
      personality,
      bpm,
      tonart,
      artistName,
    });

    // Build style tags for Suno
    const styleTags = buildStyleTags(genre, style, bpm, tonart);

    console.log("Music prompt:", musicPrompt);
    console.log("Style tags:", styleTags);

    // Build callback URL for Suno to notify when complete
    const callbackUrl = `${SUPABASE_URL}/functions/v1/suno-callback`;
    console.log("Callback URL:", callbackUrl);

    // Call Suno API (api.sunoapi.org) to generate music
    const sunoResponse = await fetch("https://api.sunoapi.org/api/v1/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUNO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: musicPrompt,
        customMode: true,
        instrumental: false,
        model: "V4",
        title: title,
        style: styleTags,
        callbackUrl: callbackUrl,
      }),
    });

    if (!sunoResponse.ok) {
      const errorText = await sunoResponse.text();
      console.error("Suno API error:", sunoResponse.status, errorText);
      
      await supabase
        .from("songs")
        .update({ generation_status: "error" })
        .eq("id", songId);
        
      throw new Error(`Suno API error: ${sunoResponse.status} - ${errorText}`);
    }

    const sunoData = await sunoResponse.json();
    console.log("Suno response:", JSON.stringify(sunoData));

    // Extract task ID for polling - sunoapi.org returns taskId or data.taskId
    const taskId = sunoData.data?.taskId || sunoData.taskId || sunoData.data?.task_id || sunoData.task_id || sunoData.id;

    if (taskId) {
      await supabase
        .from("songs")
        .update({ 
          suno_task_id: taskId,
          generation_status: "processing"
        })
        .eq("id", songId);

      return new Response(JSON.stringify({
        success: true,
        taskId,
        message: "Generierung gestartet",
        status: "processing"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we got an immediate audio URL (some APIs return this directly)
    const audioUrl = sunoData.data?.audioUrl || sunoData.audioUrl || sunoData.data?.audio_url || sunoData.audio_url;
    if (audioUrl) {
      // Download and store the audio
      const storedUrl = await downloadAndStoreAudio(supabase, audioUrl, songId, title, artistName);
      
      await supabase
        .from("songs")
        .update({
          audio_url: storedUrl,
          generation_status: "completed"
        })
        .eq("id", songId);

      return new Response(JSON.stringify({
        success: true,
        audioUrl: storedUrl,
        status: "completed"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return full response for debugging
    return new Response(JSON.stringify({
      success: true,
      status: "submitted",
      message: "Request submitted, check status later",
      rawResponse: sunoData
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unbekannter Fehler"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildMusicPrompt(params: {
  title: string;
  genre: string;
  style: string;
  voicePrompt: string;
  personality: string;
  bpm: number | null;
  tonart: string | null;
  artistName: string;
}): string {
  // For custom mode, the prompt is used for lyrics/vocal direction
  const parts: string[] = [];

  // Add vocal/voice characteristics from voicePrompt
  if (params.voicePrompt) {
    parts.push(params.voicePrompt);
  }

  // Add mood/personality context
  if (params.personality) {
    parts.push(`\n\nMood and character: ${params.personality.substring(0, 300)}`);
  }

  return parts.join("\n") || `A ${params.genre} song in ${params.style} style`;
}

function buildStyleTags(genre: string, style: string, bpm: number | null, tonart: string | null): string {
  const tags: string[] = [];
  
  if (genre) tags.push(genre);
  if (style) tags.push(style);
  if (bpm) tags.push(`${bpm} BPM`);
  if (tonart) tags.push(tonart);
  
  return tags.join(", ");
}

async function downloadAndStoreAudio(
  supabase: any,
  audioUrl: string,
  songId: string,
  title: string,
  artistName: string
): Promise<string> {
  try {
    // Download audio from Suno
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error("Failed to download audio from Suno");
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const fileName = `${artistName.replace(/[^a-zA-Z0-9]/g, '_')}_${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp3`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from("generated-audio")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true
      });

    if (error) {
      console.error("Storage upload error:", error);
      throw error;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("generated-audio")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("Error storing audio:", error);
    throw error;
  }
}
