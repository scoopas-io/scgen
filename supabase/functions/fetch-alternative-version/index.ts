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
    const SUNO_API_KEY = Deno.env.get("SUNO_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    if (!SUNO_API_KEY) {
      throw new Error("Suno API key not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { songId } = await req.json();

    if (!songId) {
      // NOTE: We intentionally return HTTP 200 for user-triggered calls so the frontend can
      // show a toast without Lovable treating it as a fatal error/blank screen.
      return new Response(
        JSON.stringify({ success: false, error: "Song ID is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the song with its task ID
    const { data: song, error: songError } = await supabase
      .from("songs")
      .select("id, name, suno_task_id, alternative_audio_url, album_id")
      .eq("id", songId)
      .single();

    if (songError || !song) {
      return new Response(
        JSON.stringify({ success: false, error: "Song not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!song.suno_task_id) {
      return new Response(
        JSON.stringify({ success: false, error: "No task ID available for this song" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (song.alternative_audio_url) {
      return new Response(
        JSON.stringify({ success: false, error: "Alternative version already exists" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching alternative version for song ${songId} with task ${song.suno_task_id}`);

    // Fetch task status from Suno API
    const statusResponse = await fetch(
      `https://api.sunoapi.org/api/v1/task/${song.suno_task_id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SUNO_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error("Suno API error:", errorText);
      
      // 404 means task data has expired (typically 24-48h after generation)
      if (statusResponse.status === 404) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Task-Daten abgelaufen (>48h). V2 nur bei neuen Generierungen verfügbar.",
            expired: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: "Suno API Fehler",
          sunoStatus: statusResponse.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusData = await statusResponse.json();
    console.log("Suno status data:", JSON.stringify(statusData));

    // Extract songs array from response
    const songsArray = statusData.data?.data || statusData.data?.songs || [];
    
    if (songsArray.length < 2) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No alternative version available (only 1 version in task data)" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the second version
    const secondVersion = songsArray[1];
    const audioUrl = secondVersion?.audio_url || secondVersion?.audioUrl;

    if (!audioUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Alternative version has no audio URL" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Downloading alternative audio from:", audioUrl);

    // Get artist name for filename
    const { data: albumData } = await supabase
      .from("albums")
      .select("artist_id")
      .eq("id", song.album_id)
      .single();

    const { data: artistData } = await supabase
      .from("artists")
      .select("name")
      .eq("id", albumData?.artist_id)
      .single();

    const artistName = artistData?.name || "Unknown";
    const songName = song.name || "Untitled";

    // Download the audio
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error("Failed to download alternative audio from Suno");
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const fileName = `${artistName.replace(/[^a-zA-Z0-9]/g, '_')}_${songName.replace(/[^a-zA-Z0-9]/g, '_')}_ver2_${Date.now()}.mp3`;

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

    // Update song with alternative audio URL
    const { error: updateError } = await supabase
      .from("songs")
      .update({
        alternative_audio_url: publicUrlData.publicUrl,
        alternative_suno_audio_id: secondVersion?.id || null
      })
      .eq("id", song.id);

    if (updateError) {
      console.error("Database update error:", updateError);
      throw updateError;
    }

    console.log("Alternative version saved successfully for song:", song.id);

    return new Response(
      JSON.stringify({
        success: true,
        alternativeAudioUrl: publicUrlData.publicUrl
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error fetching alternative version:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      // Keep HTTP 200 to prevent blank-screen error overlays for handled failures.
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
