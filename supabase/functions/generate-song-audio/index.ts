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
  instrumental?: boolean;
  language?: string;
}

// Genres that should be generated as instrumental-only
const INSTRUMENTAL_GENRES = [
  "electronic", "house", "deep house", "techno", "trance", "drum & bass",
  "dubstep", "lo-fi", "ambient", "synthwave", "dj mix", "classical",
  "orchestral", "post-rock", "experimental", "chillwave", "vaporwave", "industrial"
];

// Language code to Suno-compatible language hint mapping
const LANGUAGE_HINTS: Record<string, string> = {
  "de": "German",
  "en": "English", 
  "es": "Spanish",
  "fr": "French",
  "it": "Italian",
  "pt": "Portuguese",
  "nl": "Dutch",
  "pl": "Polish",
  "ru": "Russian",
  "ja": "Japanese",
  "ko": "Korean",
  "zh": "Chinese",
  "ar": "Arabic",
  "hi": "Hindi",
  "tr": "Turkish",
  "sv": "Swedish",
  "da": "Danish",
  "no": "Norwegian",
  "fi": "Finnish",
};

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
    const requestData: GenerateSongRequest = await req.json();
    const { songId, title, genre, style, voicePrompt, personality, bpm, tonart, artistName, instrumental, language } = requestData;

    console.log(`Starting Suno generation for: ${title} by ${artistName}`);
    console.log(`Request data:`, JSON.stringify({ genre, style, language, instrumental }));

    // Determine if instrumental based on genre or explicit flag
    const isInstrumental = instrumental ?? INSTRUMENTAL_GENRES.some(
      g => genre.toLowerCase().includes(g) || g.includes(genre.toLowerCase())
    );
    
    // Extract vocal gender from voice prompt
    const vocalGender = extractVocalGender(voicePrompt);
    
    console.log(`Genre: ${genre}, Style: ${style}, Language: ${language}, Instrumental: ${isInstrumental}, VocalGender: ${vocalGender}`);

    // Update song status to generating
    await supabase
      .from("songs")
      .update({ generation_status: "generating" })
      .eq("id", songId);

    // Build style tags for Suno - includes genre, style, voice characteristics, mood
    const styleTags = buildStyleTags(genre, style, voicePrompt, personality, bpm, tonart, isInstrumental, language);
    console.log("Style tags:", styleTags);

    // Build the prompt with language hint if not instrumental
    const prompt = buildPrompt(title, genre, style, personality, isInstrumental, language);
    console.log("Prompt:", prompt);

    // Build callback URL for Suno to notify when complete
    const callbackUrl = `${SUPABASE_URL}/functions/v1/suno-callback`;

    // Build the API request body with all available parameters
    const apiRequestBody: Record<string, any> = {
      // Use customMode: true to enable style parameter
      customMode: true,
      model: "V4_5ALL", // Use V4.5 for best quality
      title: title,
      prompt: prompt,
      style: styleTags, // Now properly passed!
      instrumental: isInstrumental,
      callBackUrl: callbackUrl,
    };

    // Add vocal gender for non-instrumental tracks
    if (!isInstrumental && vocalGender) {
      apiRequestBody.vocalGender = vocalGender;
    }

    // Add negative tags to avoid unwanted styles
    const negativeTags = buildNegativeTags(genre, isInstrumental);
    if (negativeTags) {
      apiRequestBody.negativeTags = negativeTags;
    }

    console.log("API Request Body:", JSON.stringify(apiRequestBody));

    // Call Suno API with retry logic for timeout errors
    const maxRetries = 3;
    let lastError: Error | null = null;
    let sunoData: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Suno API call attempt ${attempt}/${maxRetries}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 55000);
        
        const sunoResponse = await fetch("https://api.sunoapi.org/api/v1/generate", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUNO_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(apiRequestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!sunoResponse.ok) {
          const errorText = await sunoResponse.text();
          console.error(`Suno API error (attempt ${attempt}):`, sunoResponse.status, errorText.substring(0, 500));
          
          // Retry on 5xx errors (server issues, timeouts)
          if (sunoResponse.status >= 500 && attempt < maxRetries) {
            const waitTime = attempt * 5000;
            console.log(`Retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          throw new Error(`API Fehler ${sunoResponse.status}: ${errorText.substring(0, 100)}`);
        }

        sunoData = await sunoResponse.json();
        console.log("Suno response:", JSON.stringify(sunoData));
        break;
        
      } catch (fetchError) {
        console.error(`Fetch error (attempt ${attempt}):`, fetchError);
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        
        if (attempt < maxRetries) {
          const waitTime = attempt * 5000;
          console.log(`Network error, retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    if (!sunoData) {
      await supabase
        .from("songs")
        .update({ generation_status: "error" })
        .eq("id", songId);
        
      throw lastError || new Error("Suno API nicht erreichbar nach mehreren Versuchen");
    }

    // Extract task ID for polling
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

    // If we got an immediate audio URL
    const audioUrl = sunoData.data?.audioUrl || sunoData.audioUrl || sunoData.data?.audio_url || sunoData.audio_url;
    if (audioUrl) {
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

/**
 * Builds a rich prompt with all artist/song context
 */
function buildPrompt(
  title: string,
  genre: string,
  style: string,
  personality: string,
  isInstrumental: boolean,
  language?: string
): string {
  const parts: string[] = [];
  
  // Add language hint for vocals
  const langHint = language ? LANGUAGE_HINTS[language] || language : null;
  
  if (isInstrumental) {
    parts.push(`An instrumental ${genre} track`);
    if (style) parts.push(`in ${style} style`);
  } else {
    if (langHint) {
      parts.push(`A ${genre} song with ${langHint} vocals`);
    } else {
      parts.push(`A ${genre} song`);
    }
    if (style) parts.push(`in ${style} style`);
  }
  
  // Add mood/vibe from personality
  const mood = extractMoodFromPersonality(personality);
  if (mood) {
    parts.push(`with a ${mood} atmosphere`);
  }
  
  return parts.join(" ");
}

/**
 * Builds comprehensive style tags for Suno's customMode
 */
function buildStyleTags(
  genre: string,
  style: string,
  voicePrompt: string,
  personality: string,
  bpm: number | null,
  tonart: string | null,
  isInstrumental: boolean,
  language?: string
): string {
  const tags: string[] = [];
  
  // Primary genre and style
  if (genre) tags.push(genre);
  if (style && style !== genre) tags.push(style);
  
  // Instrumental or vocal characteristics
  if (isInstrumental) {
    tags.push("instrumental", "no vocals");
  } else {
    // Add voice characteristics
    const voiceKeywords = extractVoiceKeywords(voicePrompt);
    if (voiceKeywords) {
      voiceKeywords.split(", ").forEach(kw => tags.push(kw));
    }
    
    // Add language hint
    const langHint = language ? LANGUAGE_HINTS[language] : null;
    if (langHint) {
      tags.push(`${langHint} vocals`);
    }
  }
  
  // Mood from personality
  const moodKeywords = extractMoodKeywords(personality);
  if (moodKeywords) {
    moodKeywords.split(", ").forEach(kw => tags.push(kw));
  }
  
  // Technical details
  if (bpm) tags.push(`${bpm} BPM`);
  if (tonart) tags.push(tonart);
  
  // Limit to ~120 chars for optimal results
  return tags.slice(0, 8).join(", ");
}

/**
 * Builds negative tags to exclude unwanted styles
 */
function buildNegativeTags(genre: string, isInstrumental: boolean): string | null {
  const negativeTags: string[] = [];
  
  // Exclude vocals for instrumental tracks
  if (isInstrumental) {
    negativeTags.push("vocals", "singing", "rap", "spoken word");
  }
  
  // Genre-specific exclusions
  const lowerGenre = genre.toLowerCase();
  if (lowerGenre.includes("classical") || lowerGenre.includes("orchestral")) {
    negativeTags.push("electronic", "synthesizer", "drum machine");
  }
  if (lowerGenre.includes("acoustic") || lowerGenre.includes("folk")) {
    negativeTags.push("heavy distortion", "electronic beats");
  }
  if (lowerGenre.includes("jazz")) {
    negativeTags.push("heavy metal", "screaming");
  }
  
  return negativeTags.length > 0 ? negativeTags.join(", ") : null;
}

/**
 * Extracts vocal gender from voice prompt
 */
function extractVocalGender(voicePrompt: string): "m" | "f" | null {
  if (!voicePrompt) return null;
  
  const lowerPrompt = voicePrompt.toLowerCase();
  
  // Female indicators
  if (
    lowerPrompt.includes("female") || 
    lowerPrompt.includes("woman") || 
    lowerPrompt.includes("weiblich") ||
    lowerPrompt.includes("soprano") ||
    lowerPrompt.includes("alto") ||
    lowerPrompt.includes("she ") ||
    lowerPrompt.includes("her ")
  ) {
    return "f";
  }
  
  // Male indicators
  if (
    lowerPrompt.includes("male") || 
    lowerPrompt.includes(" man") || 
    lowerPrompt.includes("männlich") ||
    lowerPrompt.includes("baritone") ||
    lowerPrompt.includes("tenor") ||
    lowerPrompt.includes("bass voice") ||
    lowerPrompt.includes("he ") ||
    lowerPrompt.includes("his ")
  ) {
    return "m";
  }
  
  return null;
}

/**
 * Extracts voice characteristics keywords
 */
function extractVoiceKeywords(voicePrompt: string): string {
  if (!voicePrompt) return "";
  
  const keywords: string[] = [];
  const lowerPrompt = voicePrompt.toLowerCase();
  
  // Gender (now also handled separately via vocalGender)
  if (lowerPrompt.includes("female") || lowerPrompt.includes("woman") || lowerPrompt.includes("weiblich")) {
    keywords.push("female vocals");
  } else if (lowerPrompt.includes("male") || lowerPrompt.includes("man") || lowerPrompt.includes("männlich")) {
    keywords.push("male vocals");
  }
  
  // Voice texture
  if (lowerPrompt.includes("raspy") || lowerPrompt.includes("rauchig")) keywords.push("raspy");
  if (lowerPrompt.includes("smooth") || lowerPrompt.includes("weich") || lowerPrompt.includes("velvet")) keywords.push("smooth");
  if (lowerPrompt.includes("powerful") || lowerPrompt.includes("kraftvoll") || lowerPrompt.includes("strong")) keywords.push("powerful");
  if (lowerPrompt.includes("soft") || lowerPrompt.includes("sanft") || lowerPrompt.includes("gentle")) keywords.push("soft");
  if (lowerPrompt.includes("high") || lowerPrompt.includes("hoch")) keywords.push("high-pitched");
  if (lowerPrompt.includes("deep") || lowerPrompt.includes("tief") || lowerPrompt.includes("low")) keywords.push("deep voice");
  if (lowerPrompt.includes("breathy") || lowerPrompt.includes("hauchig")) keywords.push("breathy");
  if (lowerPrompt.includes("soulful") || lowerPrompt.includes("soul")) keywords.push("soulful");
  if (lowerPrompt.includes("operatic") || lowerPrompt.includes("opera")) keywords.push("operatic");
  if (lowerPrompt.includes("gritty") || lowerPrompt.includes("raw")) keywords.push("gritty");
  
  return keywords.slice(0, 3).join(", ");
}

/**
 * Extracts mood keywords from personality
 */
function extractMoodKeywords(personality: string): string {
  if (!personality) return "";
  
  const keywords: string[] = [];
  const lowerPersonality = personality.toLowerCase();
  
  // Mood detection
  if (lowerPersonality.includes("melanchol") || lowerPersonality.includes("traurig") || lowerPersonality.includes("sad")) keywords.push("melancholic");
  if (lowerPersonality.includes("energetic") || lowerPersonality.includes("energisch") || lowerPersonality.includes("dynamic")) keywords.push("energetic");
  if (lowerPersonality.includes("romantic") || lowerPersonality.includes("romantisch") || lowerPersonality.includes("love")) keywords.push("romantic");
  if (lowerPersonality.includes("aggressive") || lowerPersonality.includes("aggressiv") || lowerPersonality.includes("fierce")) keywords.push("aggressive");
  if (lowerPersonality.includes("dreamy") || lowerPersonality.includes("verträumt") || lowerPersonality.includes("ethereal")) keywords.push("dreamy");
  if (lowerPersonality.includes("dark") || lowerPersonality.includes("dunkel") || lowerPersonality.includes("mysterious")) keywords.push("dark");
  if (lowerPersonality.includes("happy") || lowerPersonality.includes("fröhlich") || lowerPersonality.includes("joyful")) keywords.push("uplifting");
  if (lowerPersonality.includes("rebel") || lowerPersonality.includes("aufrührer")) keywords.push("rebellious");
  if (lowerPersonality.includes("introspect") || lowerPersonality.includes("reflect")) keywords.push("introspective");
  if (lowerPersonality.includes("party") || lowerPersonality.includes("celebration")) keywords.push("party");
  
  return keywords.slice(0, 2).join(", ");
}

/**
 * Extracts a simple mood word from personality for prompt
 */
function extractMoodFromPersonality(personality: string): string | null {
  if (!personality) return null;
  
  const lowerPersonality = personality.toLowerCase();
  
  if (lowerPersonality.includes("melanchol") || lowerPersonality.includes("traurig")) return "melancholic";
  if (lowerPersonality.includes("energetic") || lowerPersonality.includes("energisch")) return "energetic";
  if (lowerPersonality.includes("romantic") || lowerPersonality.includes("romantisch")) return "romantic";
  if (lowerPersonality.includes("dark") || lowerPersonality.includes("dunkel")) return "dark and moody";
  if (lowerPersonality.includes("dreamy") || lowerPersonality.includes("verträumt")) return "dreamy";
  if (lowerPersonality.includes("happy") || lowerPersonality.includes("fröhlich")) return "uplifting";
  if (lowerPersonality.includes("rebel")) return "rebellious";
  
  return null;
}

/**
 * Downloads audio from Suno and stores in Supabase storage
 */
async function downloadAndStoreAudio(
  supabase: any,
  audioUrl: string,
  songId: string,
  title: string,
  artistName: string
): Promise<string> {
  try {
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error("Failed to download audio from Suno");
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const fileName = `${artistName.replace(/[^a-zA-Z0-9]/g, '_')}_${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.mp3`;

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

    const { data: publicUrlData } = supabase.storage
      .from("generated-audio")
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error("Error storing audio:", error);
    throw error;
  }
}
