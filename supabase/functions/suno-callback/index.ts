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
    const secondSong = songsArray[1];

    const audioUrl = firstSong?.audio_url || firstSong?.audioUrl ||
                     callbackData.data?.audioUrl || callbackData.data?.audio_url ||
                     callbackData.audioUrl || callbackData.audio_url;

    const audioUrlV2 = secondSong?.audio_url || secondSong?.audioUrl;
    
    console.log("Extracted - taskId:", taskId, "status:", status, "audioUrl:", audioUrl, "audioUrlV2:", audioUrlV2);

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

    // If we have an audio URL, download and store it (and optionally V2)
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

      const sanitize = (v: string) => v.replace(/[^a-zA-Z0-9]/g, "_");

      const uploadFromUrl = async (url: string, suffix: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to download audio from Suno (${suffix})`);

        const buf = await res.arrayBuffer();
        const fileName = `${sanitize(artistName)}_${sanitize(songName)}_${suffix}_${Date.now()}.mp3`;

        const { error: uploadError } = await supabase.storage
          .from("generated-audio")
          .upload(fileName, buf, {
            contentType: "audio/mpeg",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("generated-audio")
          .getPublicUrl(fileName);

        return publicUrlData.publicUrl;
      };

      // V1
      const storedUrlV1 = await uploadFromUrl(audioUrl, "v1");

      // Prepare DB update (V1 always, V2 best-effort)
      const updatePayload: Record<string, unknown> = {
        audio_url: storedUrlV1,
        generation_status: "completed",
        suno_audio_id: firstSong?.id || null,
      };

      // V2 (best-effort; don't fail the whole callback if V2 fails)
      if (audioUrlV2) {
        try {
          const storedUrlV2 = await uploadFromUrl(audioUrlV2, "v2");
          updatePayload.alternative_audio_url = storedUrlV2;
          updatePayload.alternative_suno_audio_id = secondSong?.id || null;
        } catch (e) {
          console.warn("Failed to store V2 audio (continuing with V1 only):", e);
        }
      }

      await supabase
        .from("songs")
        .update(updatePayload)
        .eq("id", songData.id);

      console.log("Song updated successfully:", songData.id);

      return new Response(JSON.stringify({
        success: true,
        status: "completed",
        audioUrl: storedUrlV1,
        alternativeAudioUrl: (updatePayload as any).alternative_audio_url || null,
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
