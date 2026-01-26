import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegenerateRequest {
  artistId: string;
  artistName: string;
  genre: string;
  style: string;
  gender?: 'male' | 'female' | 'duo';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artistId, artistName, genre, style, gender = 'male' }: RegenerateRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase credentials not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Regenerating image for ${artistName} (${gender})...`);
    
    // Build gender-specific prompt
    const genderDescription = gender === 'duo' 
      ? 'a duo of two musicians (one male, one female)' 
      : gender === 'female' 
        ? 'a female musician' 
        : 'a male musician';
    
    const imagePrompt = `Portrait of ${genderDescription}, ${genre} artist, ${style} aesthetic, professional photo, artistic lighting, high quality`;
    
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

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("Image generation error:", errorText);
      throw new Error("Fehler bei der Bildgenerierung");
    }

    const imageData = await imageResponse.json();
    const base64Image = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!base64Image || !base64Image.startsWith('data:image')) {
      throw new Error("Kein Bild generiert");
    }

    const base64Data = base64Image.split(',')[1];
    const imageBytes = decode(base64Data);
    const fileName = `${artistName.replace(/[^a-zA-Z0-9\u4e00-\u9fff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff]/g, '_')}_${Date.now()}.png`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('artist-images')
      .upload(fileName, imageBytes, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Fehler beim Hochladen des Bildes");
    }

    const { data: publicUrl } = supabase.storage.from('artist-images').getPublicUrl(fileName);
    
    // Update artist with new image URL
    const { error: updateError } = await supabase
      .from("artists")
      .update({ profile_image_url: publicUrl.publicUrl })
      .eq("id", artistId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error("Fehler beim Aktualisieren des Künstlers");
    }

    console.log(`Image successfully regenerated for ${artistName}`);

    return new Response(JSON.stringify({ 
      success: true, 
      imageUrl: publicUrl.publicUrl 
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
