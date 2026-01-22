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

    // Build style tags for Suno - includes genre, style, voice characteristics
    const styleTags = buildStyleTags(genre, style, voicePrompt, personality, bpm, tonart);

    console.log("Style tags:", styleTags);

    // Build callback URL for Suno to notify when complete
    const callbackUrl = `${SUPABASE_URL}/functions/v1/suno-callback`;
    console.log("Callback URL:", callbackUrl);

    // Call Suno API (api.sunoapi.org) to generate music
    // For customMode: false, Suno auto-generates lyrics based on the style
    // This avoids the issue where voice prompts are sung as lyrics
    const sunoResponse = await fetch("https://api.sunoapi.org/api/v1/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUNO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `A ${genre} song called "${title}" in ${style} style`, // Description for non-custom mode
        customMode: false, // Let Suno generate lyrics automatically
        instrumental: false,
        model: "V5",
        title: title,
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

function buildStyleTags(
  genre: string,
  style: string,
  voicePrompt: string,
  personality: string,
  bpm: number | null,
  tonart: string | null
): string {
  const tags: string[] = [];
  
  // Add genre and style first
  if (genre) tags.push(genre);
  if (style) tags.push(style);
  
  // Extract key voice characteristics (e.g., "male voice", "female vocals", "raspy")
  if (voicePrompt) {
    // Extract short voice descriptors for style tags
    const voiceKeywords = extractVoiceKeywords(voicePrompt);
    if (voiceKeywords) tags.push(voiceKeywords);
  }
  
  // Add mood from personality
  if (personality) {
    const moodKeywords = extractMoodKeywords(personality);
    if (moodKeywords) tags.push(moodKeywords);
  }
  
  // Add technical details
  if (bpm) tags.push(`${bpm} BPM`);
  if (tonart) tags.push(tonart);
  
  return tags.join(", ");
}

function extractVoiceKeywords(voicePrompt: string): string {
  // Extract relevant voice descriptors for Suno style tags
  const keywords: string[] = [];
  const lowerPrompt = voicePrompt.toLowerCase();
  
  // Gender detection
  if (lowerPrompt.includes("female") || lowerPrompt.includes("woman") || lowerPrompt.includes("weiblich")) {
    keywords.push("female vocals");
  } else if (lowerPrompt.includes("male") || lowerPrompt.includes("man") || lowerPrompt.includes("männlich")) {
    keywords.push("male vocals");
  }
  
  // Voice characteristics
  if (lowerPrompt.includes("raspy") || lowerPrompt.includes("rauchig")) keywords.push("raspy");
  if (lowerPrompt.includes("smooth") || lowerPrompt.includes("weich")) keywords.push("smooth");
  if (lowerPrompt.includes("powerful") || lowerPrompt.includes("kraftvoll")) keywords.push("powerful");
  if (lowerPrompt.includes("soft") || lowerPrompt.includes("sanft")) keywords.push("soft");
  if (lowerPrompt.includes("high") || lowerPrompt.includes("hoch")) keywords.push("high-pitched");
  if (lowerPrompt.includes("deep") || lowerPrompt.includes("tief")) keywords.push("deep voice");
  if (lowerPrompt.includes("breathy") || lowerPrompt.includes("hauchig")) keywords.push("breathy");
  
  return keywords.slice(0, 3).join(", ");
}

function extractMoodKeywords(personality: string): string {
  const keywords: string[] = [];
  const lowerPersonality = personality.toLowerCase();
  
  // Mood detection
  if (lowerPersonality.includes("melanchol") || lowerPersonality.includes("traurig")) keywords.push("melancholic");
  if (lowerPersonality.includes("energetic") || lowerPersonality.includes("energisch")) keywords.push("energetic");
  if (lowerPersonality.includes("romantic") || lowerPersonality.includes("romantisch")) keywords.push("romantic");
  if (lowerPersonality.includes("aggressive") || lowerPersonality.includes("aggressiv")) keywords.push("aggressive");
  if (lowerPersonality.includes("dreamy") || lowerPersonality.includes("verträumt")) keywords.push("dreamy");
  if (lowerPersonality.includes("dark") || lowerPersonality.includes("dunkel")) keywords.push("dark");
  if (lowerPersonality.includes("happy") || lowerPersonality.includes("fröhlich")) keywords.push("uplifting");
  if (lowerPersonality.includes("rebel") || lowerPersonality.includes("aufrührer")) keywords.push("rebellious");
  
  return keywords.slice(0, 2).join(", ");
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
