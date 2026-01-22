import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckStatusRequest {
  songId: string;
  taskId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUNO_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { songId, taskId }: CheckStatusRequest = await req.json();

    console.log(`Checking status for task: ${taskId}`);

    // Check task status from Suno API
    const statusResponse = await fetch(`https://api.sunoapi.com/api/v1/task/${taskId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${SUNO_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error("Suno status check error:", statusResponse.status, errorText);
      throw new Error(`Status check failed: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    console.log("Status response:", JSON.stringify(statusData));

    const status = statusData.data?.status || statusData.status;
    const audioUrl = statusData.data?.audio_url || statusData.audio_url;

    if (status === "completed" && audioUrl) {
      // Download and store the audio
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error("Failed to download audio");
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      
      // Get song info for filename
      const { data: songData } = await supabase
        .from("songs")
        .select("name, albums(artist_id, artists(name))")
        .eq("id", songId)
        .single();

      const artistName = (songData as any)?.albums?.artists?.name || "Unknown";
      const songName = songData?.name || "Untitled";
      const fileName = `${artistName.replace(/[^a-zA-Z0-9]/g, '_')}_${songName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp3`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("generated-audio")
        .upload(fileName, audioBuffer, {
          contentType: "audio/mpeg",
          upsert: true
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("generated-audio")
        .getPublicUrl(fileName);

      // Update song with audio URL
      await supabase
        .from("songs")
        .update({
          audio_url: publicUrlData.publicUrl,
          generation_status: "completed"
        })
        .eq("id", songId);

      return new Response(JSON.stringify({
        success: true,
        status: "completed",
        audioUrl: publicUrlData.publicUrl
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status === "failed" || status === "error") {
      await supabase
        .from("songs")
        .update({ generation_status: "error" })
        .eq("id", songId);

      return new Response(JSON.stringify({
        success: false,
        status: "error",
        error: "Generation failed"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Still processing
    return new Response(JSON.stringify({
      success: true,
      status: status || "processing"
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
