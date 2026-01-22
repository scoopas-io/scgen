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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      artistId,
      artistName,
      artistPersonality,
      artistGenre,
      artistStyle,
      artistImageUrl,
      platform,
      contentType,
      customPrompt,
      scheduledAt,
    } = await req.json();

    // Generate text content (caption, hashtags, title)
    const textPrompt = `Du bist ein Social Media Manager für den Künstler "${artistName}".
    
Künstler-Info:
- Genre: ${artistGenre}
- Style: ${artistStyle}
- Persönlichkeit: ${artistPersonality}

Erstelle einen ${contentType} für ${platform}.
${customPrompt ? `Zusätzliche Anweisung: ${customPrompt}` : ""}

Antworte IMMER als JSON mit diesem Format:
{
  "title": "Kurzer Titel für den Post",
  "caption": "Die vollständige Caption mit Emojis und Call-to-Action",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "videoScript": "Falls Video/Reel: Kurzes Skript für das Video (max 30 Sekunden)"
}

Die Caption sollte:
- Zur Persönlichkeit des Künstlers passen
- Authentisch und engaging sein
- Plattform-spezifisch sein (${platform})
- Relevant für ${contentType} sein`;

    console.log("Generating text content...");
    const textResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Du bist ein erfahrener Social Media Manager für Musiker. Antworte immer in validem JSON." },
          { role: "user", content: textPrompt },
        ],
      }),
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      console.error("Text generation error:", errorText);
      if (textResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate Limit erreicht. Bitte versuche es später erneut." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (textResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Kontingent erschöpft." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("Text generation failed");
    }

    const textData = await textResponse.json();
    const textContent = textData.choices?.[0]?.message?.content;
    
    let parsedContent;
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (e) {
      console.error("JSON parse error:", e, textContent);
      parsedContent = {
        title: `Neuer ${contentType} von ${artistName}`,
        caption: textContent,
        hashtags: [artistGenre.toLowerCase().replace(/\s/g, ""), "musik", "newmusic"],
        videoScript: null,
      };
    }

    let imageUrl = null;
    let videoUrl = null;

    // Generate image for post/story
    if (artistImageUrl && (contentType === "post" || contentType === "story")) {
      console.log("Generating social content image...");
      
      const imagePrompt = `Create a stylish ${platform} ${contentType} image for a ${artistGenre} musician. 
Style: Modern, professional, eye-catching. 
Theme: ${customPrompt || "Music promotion, artistic, engaging"}
The image should feel authentic and suitable for ${platform}.
Aspect ratio: ${contentType === "story" ? "9:16 portrait" : "1:1 square"}`;

      try {
        const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image-preview",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: imagePrompt },
                  { type: "image_url", image_url: { url: artistImageUrl } },
                ],
              },
            ],
            modalities: ["image", "text"],
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const generatedImageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (generatedImageUrl) {
            const base64Data = generatedImageUrl.replace(/^data:image\/\w+;base64,/, "");
            const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            const filename = `${artistId}/${Date.now()}-${contentType}.png`;
            
            const { error: uploadError } = await supabase.storage
              .from("social-content")
              .upload(filename, imageBuffer, {
                contentType: "image/png",
                upsert: true,
              });

            if (uploadError) {
              console.error("Image upload error:", uploadError);
            } else {
              const { data: { publicUrl } } = supabase.storage
                .from("social-content")
                .getPublicUrl(filename);
              imageUrl = publicUrl;
            }
          }
        } else {
          console.error("Image generation failed:", await imageResponse.text());
        }
      } catch (imageError) {
        console.error("Image generation error:", imageError);
      }
    }

    // Generate video for reel content
    if (contentType === "reel" && artistImageUrl) {
      console.log("Generating video content...");
      
      const videoPrompt = `${artistGenre} music artist promotional video. ${parsedContent.videoScript || customPrompt || "Dynamic, engaging music content"}. Modern, stylish, social media ready. Vertical 9:16 aspect ratio for Reels/TikTok.`;

      try {
        // Use image-to-video generation with artist image as starting frame
        const videoResponse = await fetch("https://ai.gateway.lovable.dev/v1/videos/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "wavespeed-ai/wan-2.1-i2v-480p",
            prompt: videoPrompt,
            image: artistImageUrl,
            duration: 5,
            aspect_ratio: "9:16",
          }),
        });

        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          const generatedVideoUrl = videoData.data?.[0]?.url;
          
          if (generatedVideoUrl) {
            console.log("Video generated, downloading and uploading...");
            
            // Download video
            const videoFetchResponse = await fetch(generatedVideoUrl);
            const videoBuffer = new Uint8Array(await videoFetchResponse.arrayBuffer());
            
            const videoFilename = `${artistId}/${Date.now()}-reel.mp4`;
            
            const { error: videoUploadError } = await supabase.storage
              .from("social-content")
              .upload(videoFilename, videoBuffer, {
                contentType: "video/mp4",
                upsert: true,
              });

            if (videoUploadError) {
              console.error("Video upload error:", videoUploadError);
            } else {
              const { data: { publicUrl } } = supabase.storage
                .from("social-content")
                .getPublicUrl(videoFilename);
              videoUrl = publicUrl;
              console.log("Video uploaded successfully:", videoUrl);
            }
          }
        } else {
          const errorText = await videoResponse.text();
          console.error("Video generation failed:", errorText);
          // Fallback: generate an image instead
          console.log("Falling back to image generation for reel cover...");
          
          const coverPrompt = `Create a dynamic ${platform} reel cover image for a ${artistGenre} musician. 
Style: Eye-catching, modern, vertical format for reels.
Theme: ${customPrompt || "Music promotion, energetic, engaging"}
Make it look like a video thumbnail with play button overlay feel.`;

          const coverResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image-preview",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: coverPrompt },
                    { type: "image_url", image_url: { url: artistImageUrl } },
                  ],
                },
              ],
              modalities: ["image", "text"],
            }),
          });

          if (coverResponse.ok) {
            const coverData = await coverResponse.json();
            const coverImageUrl = coverData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            
            if (coverImageUrl) {
              const base64Data = coverImageUrl.replace(/^data:image\/\w+;base64,/, "");
              const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              
              const filename = `${artistId}/${Date.now()}-reel-cover.png`;
              
              const { error: uploadError } = await supabase.storage
                .from("social-content")
                .upload(filename, imageBuffer, {
                  contentType: "image/png",
                  upsert: true,
                });

              if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                  .from("social-content")
                  .getPublicUrl(filename);
                imageUrl = publicUrl;
              }
            }
          }
        }
      } catch (videoError) {
        console.error("Video generation error:", videoError);
      }
    }

    // Determine status based on scheduling
    const status = scheduledAt ? "scheduled" : "generated";

    // Save to database
    const { data: insertedContent, error: insertError } = await supabase
      .from("social_content")
      .insert({
        artist_id: artistId,
        content_type: contentType,
        platform: platform,
        title: parsedContent.title,
        caption: parsedContent.caption,
        hashtags: parsedContent.hashtags,
        image_url: imageUrl,
        video_url: videoUrl,
        prompt: customPrompt || null,
        status: status,
        scheduled_at: scheduledAt || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      throw new Error("Failed to save content");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content: insertedContent,
        hasVideo: !!videoUrl,
        hasImage: !!imageUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
