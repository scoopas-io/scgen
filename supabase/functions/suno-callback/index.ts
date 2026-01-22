import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Parse callback data from Suno
    const callbackData = await req.json();
    console.log("Suno callback received:", JSON.stringify(callbackData));

    // Extract task ID from nested structure: data.task_id (sunoapi.org format)
    const taskId = callbackData.data?.task_id || callbackData.data?.taskId ||
                   callbackData.taskId || callbackData.task_id;
    
    // Extract callback type and status
    const callbackType = callbackData.data?.callbackType;
    const status = callbackType === "complete" ? "completed" : 
                   (callbackData.status || callbackData.data?.status);
    
    // Extract audio data from nested array: data.data[0].audio_url (sunoapi.org format)
    const songsArray = callbackData.data?.data || callbackData.data?.songs || callbackData.songs || [];
    const firstSong = songsArray[0];
    const audioUrl = firstSong?.audio_url || firstSong?.audioUrl ||
                     callbackData.data?.audioUrl || callbackData.data?.audio_url ||
                     callbackData.audioUrl || callbackData.audio_url;
    
    console.log("Extracted - taskId:", taskId, "status:", status, "audioUrl:", audioUrl);

    if (!taskId) {
      console.error("No taskId in callback:", callbackData);
      return new Response(JSON.stringify({ success: false, error: "No taskId provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the song by suno_task_id
    const { data: songData, error: findError } = await supabase
      .from("songs")
      .select("id, name, album_id")
      .eq("suno_task_id", taskId)
      .single();

    if (findError || !songData) {
      console.error("Song not found for taskId:", taskId, findError);
      return new Response(JSON.stringify({ success: false, error: "Song not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if generation failed
    if (status === "failed" || status === "error") {
      await supabase
        .from("songs")
        .update({ generation_status: "error" })
        .eq("id", songData.id);

      return new Response(JSON.stringify({ success: true, status: "error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we have an audio URL, download and store it
    if (audioUrl) {
      console.log("Downloading audio from:", audioUrl);
      
      // Get artist name for filename
      const { data: albumData } = await supabase
        .from("albums")
        .select("artist_id")
        .eq("id", songData.album_id)
        .single();

      const { data: artistData } = await supabase
        .from("artists")
        .select("name")
        .eq("id", albumData?.artist_id)
        .single();

      const artistName = artistData?.name || "Unknown";
      const songName = songData.name || "Untitled";

      // Download audio
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error("Failed to download audio from Suno");
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      const fileName = `${artistName.replace(/[^a-zA-Z0-9]/g, '_')}_${songName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp3`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("generated-audio")
        .upload(fileName, audioBuffer, {
          contentType: "audio/mpeg",
          upsert: true
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      // Get public URL
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
        .eq("id", songData.id);

      console.log("Song updated successfully:", songData.id);

      return new Response(JSON.stringify({
        success: true,
        status: "completed",
        audioUrl: publicUrlData.publicUrl
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Status update without audio (still processing)
    if (status === "processing" || status === "pending") {
      await supabase
        .from("songs")
        .update({ generation_status: "processing" })
        .eq("id", songData.id);
    }

    return new Response(JSON.stringify({
      success: true,
      status: status || "received"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Callback error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
