import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Runway API video polling helper
async function pollRunwayTask(taskId: string, apiKey: string, maxAttempts = 120): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    console.log(`Polling Runway task ${taskId}, attempt ${i + 1}/${maxAttempts}`);
    
    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Runway poll error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log("Runway task status:", data.status);

    if (data.status === "SUCCEEDED") {
      // Return the video URL from the output
      const videoUrl = data.output?.[0];
      if (videoUrl) {
        console.log("Runway video ready:", videoUrl);
        return videoUrl;
      }
      return null;
    }

    if (data.status === "FAILED") {
      console.error("Runway task failed:", data.failure, data.failureCode);
      return null;
    }

    // Still processing (PENDING, RUNNING, THROTTLED), wait and retry
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.error("Runway video polling timeout");
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY");
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

    console.log(`Starting content generation for ${artistName}, type: ${contentType}, platform: ${platform}`);

    // Generate text content
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
    console.log("Text content generated successfully");
    
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
    let videoFailureNote: string | null = null;

    // Generate video for reels using Runway API (Gen-3 Alpha Turbo)
    if (contentType === "reel" && artistImageUrl && RUNWAY_API_KEY) {
      console.log("Generating video with Runway API...");

      try {
        // Start Runway video generation with image-to-video
        const runwayResponse = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RUNWAY_API_KEY}`,
            "Content-Type": "application/json",
            "X-Runway-Version": "2024-11-06",
          },
          body: JSON.stringify({
            model: "gen3a_turbo",
            promptImage: artistImageUrl,
            promptText: `Cinematic ${artistGenre} music video scene. Subtle camera movement, dramatic lighting, atmospheric effects. Professional music video quality.`,
            duration: 5,
            ratio: "768:1280", // Vertical reels ratio supported by image_to_video
          }),
        });

        if (runwayResponse.ok) {
          const runwayData = await runwayResponse.json();
          const taskId = runwayData.id;
          console.log("Runway task created:", taskId);

          // Poll for completion
          const runwayVideoUrl = await pollRunwayTask(taskId, RUNWAY_API_KEY);

          if (runwayVideoUrl) {
            console.log("Downloading video from Runway...");
            
            // Download the video from Runway's CDN
            const videoResponse = await fetch(runwayVideoUrl);
            if (videoResponse.ok) {
              const videoBuffer = new Uint8Array(await videoResponse.arrayBuffer());
              
              const filename = `${artistId}/${Date.now()}-reel.mp4`;
              
              const { error: uploadError } = await supabase.storage
                .from("social-content")
                .upload(filename, videoBuffer, {
                  contentType: "video/mp4",
                  upsert: true,
                });

              if (uploadError) {
                console.error("Video upload error:", uploadError);
                videoFailureNote = "Video konnte nicht hochgeladen werden; Fallback-Bild wurde erstellt.";
              } else {
                const { data: { publicUrl } } = supabase.storage
                  .from("social-content")
                  .getPublicUrl(filename);
                videoUrl = publicUrl;
                console.log("Video uploaded:", videoUrl);
              }
            } else {
              console.error("Failed to download video from Runway:", videoResponse.status);
              videoFailureNote = "Video-Download von Runway fehlgeschlagen – es wurde stattdessen ein Reel-Cover (PNG) erstellt.";
            }
          } else {
            videoFailureNote = "Runway Video-Generierung fehlgeschlagen – es wurde stattdessen ein Reel-Cover (PNG) erstellt.";
          }
        } else {
          const errorText = await runwayResponse.text();
          console.error("Runway API error:", runwayResponse.status, errorText);

          if (errorText.includes("insufficient") || errorText.includes("credit") || errorText.includes("balance")) {
            videoFailureNote = "Runway: nicht genug Credits – es wurde stattdessen ein Reel-Cover (PNG) erstellt.";
          } else if (runwayResponse.status === 401) {
            videoFailureNote = "Runway API-Key ungültig – es wurde stattdessen ein Reel-Cover (PNG) erstellt.";
          } else if (runwayResponse.status === 422) {
            videoFailureNote = "Runway: Bildformat nicht unterstützt – es wurde stattdessen ein Reel-Cover (PNG) erstellt.";
          } else {
            videoFailureNote = `Runway Video-Fehler (${runwayResponse.status}) – es wurde stattdessen ein Reel-Cover (PNG) erstellt.`;
          }
        }
      } catch (runwayError) {
        console.error("Runway video generation error:", runwayError);
        videoFailureNote = "Runway Video-Generierung fehlgeschlagen – es wurde stattdessen ein Reel-Cover (PNG) erstellt.";
      }
    }

    // Fallback: Generate cover image for reel if video failed or no Runway key
    if (contentType === "reel" && !videoUrl && artistImageUrl) {
      console.log("Generating reel cover image as fallback...");
      
      const reelCoverPrompt = `Transform this artist photo into a dynamic, eye-catching ${platform} reel cover image.
Style: Vertical 9:16 format, cinematic, modern, high-energy.
Theme: ${artistGenre} music promotion, ${customPrompt || "engaging social media content"}
Add dynamic elements: light trails, motion blur effects, neon accents, or atmospheric particles.
Make it look like a freeze-frame from an exciting music video.`;

      try {
        const reelImageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                  { type: "text", text: reelCoverPrompt },
                  { type: "image_url", image_url: { url: artistImageUrl } },
                ],
              },
            ],
            modalities: ["image", "text"],
          }),
        });

        if (reelImageResponse.ok) {
          const reelImageData = await reelImageResponse.json();
          const generatedImageUrl = reelImageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (generatedImageUrl) {
            console.log("Reel cover image generated successfully");
            const base64Data = generatedImageUrl.replace(/^data:image\/\w+;base64,/, "");
            const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            const filename = `${artistId}/${Date.now()}-reel.png`;
            
            const { error: uploadError } = await supabase.storage
              .from("social-content")
              .upload(filename, imageBuffer, {
                contentType: "image/png",
                upsert: true,
              });

            if (uploadError) {
              console.error("Reel image upload error:", uploadError);
            } else {
              const { data: { publicUrl } } = supabase.storage
                .from("social-content")
                .getPublicUrl(filename);
              imageUrl = publicUrl;
              console.log("Reel cover uploaded:", imageUrl);
            }
          }
        } else {
          console.error("Reel image generation failed:", await reelImageResponse.text());
        }
      } catch (reelError) {
        console.error("Reel image generation error:", reelError);
      }
    }

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
              console.log("Image uploaded successfully:", imageUrl);
            }
          }
        } else {
          console.error("Image generation failed:", await imageResponse.text());
        }
      } catch (imageError) {
        console.error("Image generation error:", imageError);
      }
    }

    // Determine status based on scheduling
    const status = scheduledAt ? "scheduled" : "generated";

    // Save to database
    console.log("Saving content to database...");
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

    console.log("Content saved successfully:", insertedContent.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        content: insertedContent,
        hasVideo: !!videoUrl,
        hasImage: !!imageUrl,
        note: contentType === "reel" && !videoUrl
          ? (videoFailureNote || "Video-Generierung nicht verfügbar, Reel-Cover wurde erstellt.")
          : undefined,
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
