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
  // Persona fields
  vocalGender?: string | null;
  vocalTexture?: string | null;
  vocalRange?: string | null;
  styleTags?: string[];
  moodTags?: string[];
  negativeTags?: string[];
  defaultBpmMin?: number | null;
  defaultBpmMax?: number | null;
  preferredKeys?: string[];
  instrumentalOnly?: boolean;
  // Suno persona ID for consistent voice/style
  sunoPersonaId?: string | null;
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
    const { 
      songId, title, genre, style, voicePrompt, personality, bpm, tonart, artistName, 
      instrumental, language,
      // Persona fields
      vocalGender: personaVocalGender,
      vocalTexture,
      vocalRange,
      styleTags: personaStyleTags,
      moodTags: personaMoodTags,
      negativeTags: personaNegativeTags,
      defaultBpmMin,
      defaultBpmMax,
      preferredKeys,
      instrumentalOnly,
      sunoPersonaId,
    } = requestData;

    console.log(`Starting Suno generation for: ${title} by ${artistName}`);
    console.log(`Request data:`, JSON.stringify({ genre, style, language, instrumental, personaVocalGender, vocalTexture, sunoPersonaId }));

    // Determine if instrumental based on: persona setting > explicit flag > genre detection
    const isInstrumental = instrumentalOnly ?? instrumental ?? INSTRUMENTAL_GENRES.some(
      g => genre.toLowerCase().includes(g) || g.includes(genre.toLowerCase())
    );
    
    // Use persona vocal gender if set, otherwise extract from voice prompt
    const vocalGender = personaVocalGender || extractVocalGender(voicePrompt);
    
    console.log(`Genre: ${genre}, Style: ${style}, Language: ${language}, Instrumental: ${isInstrumental}, VocalGender: ${vocalGender}`);

    // Update song status to generating
    await supabase
      .from("songs")
      .update({ generation_status: "generating" })
      .eq("id", songId);

    // Determine BPM - use song BPM, or random within persona range, or null
    let effectiveBpm = bpm;
    if (!effectiveBpm && defaultBpmMin && defaultBpmMax) {
      effectiveBpm = Math.floor(Math.random() * (defaultBpmMax - defaultBpmMin + 1)) + defaultBpmMin;
    }

    // Build style tags for Suno - includes genre, style, voice characteristics, mood
    // Merge persona tags with dynamically generated ones
    // CRITICAL: Pass vocalGender to ensure consistency between gender param and style tags
    const styleTags = buildStyleTagsWithPersona(
      genre, style, voicePrompt, personality, effectiveBpm, tonart, isInstrumental, language,
      personaStyleTags, personaMoodTags, vocalTexture, vocalRange, vocalGender
    );
    console.log("Style tags:", styleTags);

    // Build the prompt with language hint if not instrumental
    const prompt = buildPrompt(title, genre, style, personality, isInstrumental, language);
    console.log("Prompt:", prompt);

    // Build callback URL for Suno to notify when complete
    const callbackUrl = `${SUPABASE_URL}/functions/v1/suno-callback`;

    // Build the API request body with all available parameters
    // In customMode: false, the API generates lyrics based on title + style
    // This prevents instrumental-only output when vocals are requested
    const apiRequestBody: Record<string, any> = {
      // Use customMode: false to let API generate lyrics
      customMode: false,
      model: "V4_5ALL", // Use V4.5 for best quality
      title: title,
      prompt: prompt, // Description for AI to generate appropriate lyrics
      style: styleTags, // Style tags contain genre, style, mood, language hints
      instrumental: isInstrumental,
      callBackUrl: callbackUrl,
    };

    // CRITICAL: If artist has a Suno persona ID, use it for consistent voice/style
    if (sunoPersonaId) {
      apiRequestBody.personaId = sunoPersonaId;
      console.log(`Using Suno personaId: ${sunoPersonaId}`);
    }

    // CRITICAL: Add vocal gender for non-instrumental tracks
    // This parameter is essential for Suno to use the correct voice
    if (!isInstrumental) {
      if (vocalGender) {
        apiRequestBody.vocalGender = vocalGender;
        console.log(`Setting vocalGender parameter to: ${vocalGender}`);
      } else {
        // Fallback: try to extract from persona or voice prompt
        console.warn("No vocalGender set - Suno may use random voice");
      }
    }

    // Add advanced control parameters for better generation quality
    apiRequestBody.styleWeight = 0.7; // Balance between style adherence and creativity
    apiRequestBody.weirdnessConstraint = 0.3; // Moderate creative deviation

    // Add negative tags - merge persona negative tags with genre-based ones
    // CRITICAL: Add opposite gender to negative tags to reinforce consistency
    const builtNegativeTags = buildNegativeTags(genre, isInstrumental, vocalGender);
    const allNegativeTags = [
      ...(personaNegativeTags || []),
      ...(builtNegativeTags ? builtNegativeTags.split(", ") : []),
    ].filter((v, i, a) => a.indexOf(v) === i); // dedupe
    
    if (allNegativeTags.length > 0) {
      apiRequestBody.negativeTags = allNegativeTags.join(", ");
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
 * IMPORTANT: Language hints are reinforced multiple times to ensure Suno respects them
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
  
  // Add language hint for vocals - reinforced for better compliance
  const langHint = language ? LANGUAGE_HINTS[language] || language : null;
  
  if (isInstrumental) {
    parts.push(`An instrumental ${genre} track`);
    if (style) parts.push(`in ${style} style`);
  } else {
    if (langHint) {
      // Reinforce language multiple ways for better Suno compliance
      parts.push(`A ${genre} song sung entirely in ${langHint}`);
      parts.push(`with ${langHint} lyrics`);
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
  
  // Final language reinforcement for non-English languages
  if (langHint && langHint !== "English" && !isInstrumental) {
    parts.push(`(all vocals must be in ${langHint}, no English)`);
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
  return buildStyleTagsWithPersona(
    genre, style, voicePrompt, personality, bpm, tonart, isInstrumental, language,
    undefined, undefined, undefined, undefined
  );
}

/**
 * Builds comprehensive style tags with persona data for Suno's customMode
 */
function buildStyleTagsWithPersona(
  genre: string,
  style: string,
  voicePrompt: string,
  personality: string,
  bpm: number | null,
  tonart: string | null,
  isInstrumental: boolean,
  language?: string,
  personaStyleTags?: string[],
  personaMoodTags?: string[],
  vocalTexture?: string | null,
  vocalRange?: string | null,
  personaVocalGender?: string | null
): string {
  const tags: string[] = [];
  
  // Primary genre and style
  if (genre) tags.push(genre);
  if (style && style !== genre) tags.push(style);
  
  // Add persona style tags first (highest priority)
  if (personaStyleTags && personaStyleTags.length > 0) {
    personaStyleTags.forEach(tag => {
      if (!tags.includes(tag)) tags.push(tag);
    });
  }
  
  // Instrumental or vocal characteristics
  if (isInstrumental) {
    tags.push("instrumental", "no vocals");
  } else {
    // Determine effective vocal gender - persona takes priority
    const effectiveVocalGender = personaVocalGender || extractVocalGender(voicePrompt);
    
    // Add correct gender vocals based on effective gender (CRITICAL: must be consistent!)
    if (effectiveVocalGender === "m") {
      tags.push("male vocals");
    } else if (effectiveVocalGender === "f") {
      tags.push("female vocals");
    }
    
    // Add persona vocal characteristics
    if (vocalTexture) tags.push(vocalTexture);
    if (vocalRange) tags.push(vocalRange);
    
    // Add voice characteristics from prompt, but SKIP gender keywords to avoid conflicts
    const voiceKeywords = extractVoiceKeywords(voicePrompt);
    if (voiceKeywords) {
      voiceKeywords.split(", ").forEach(kw => {
        // Skip gender-related keywords - we already added the correct one above
        if (kw === "male vocals" || kw === "female vocals") {
          return;
        }
        if (!tags.includes(kw)) tags.push(kw);
      });
    }
    
    // Add language hint - reinforced for better compliance
    const langHint = language ? LANGUAGE_HINTS[language] : null;
    if (langHint) {
      tags.push(`${langHint} vocals`);
      // Add language as style tag for non-English to reinforce
      if (langHint !== "English") {
        tags.push(`${langHint} language`);
      }
    }
  }
  
  // Add persona mood tags
  if (personaMoodTags && personaMoodTags.length > 0) {
    personaMoodTags.forEach(tag => {
      if (!tags.includes(tag)) tags.push(tag);
    });
  } else {
    // Fallback to extracting mood from personality
    const moodKeywords = extractMoodKeywords(personality);
    if (moodKeywords) {
      moodKeywords.split(", ").forEach(kw => {
        if (!tags.includes(kw)) tags.push(kw);
      });
    }
  }
  
  // Technical details
  if (bpm) tags.push(`${bpm} BPM`);
  if (tonart) tags.push(tonart);
  
  // Limit to ~120 chars for optimal results
  return tags.slice(0, 10).join(", ");
}

/**
 * Builds negative tags to exclude unwanted styles
 * CRITICAL: Adds opposite gender to negative tags to reinforce voice consistency
 */
function buildNegativeTags(genre: string, isInstrumental: boolean, vocalGender?: string | null): string | null {
  const negativeTags: string[] = [];
  
  // Exclude vocals for instrumental tracks
  if (isInstrumental) {
    negativeTags.push("vocals", "singing", "rap", "spoken word");
  } else {
    // CRITICAL: Exclude opposite gender vocals to reinforce consistency
    if (vocalGender === "m") {
      negativeTags.push("female vocals", "female singer", "woman singing", "soprano", "alto");
    } else if (vocalGender === "f") {
      negativeTags.push("male vocals", "male singer", "man singing", "baritone", "tenor", "bass voice");
    }
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
 * CRITICAL: Completely SKIP gender keywords - these are handled separately via vocalGender parameter
 * Only extract texture/quality keywords to avoid conflicts
 */
function extractVoiceKeywords(voicePrompt: string): string {
  if (!voicePrompt) return "";
  
  const keywords: string[] = [];
  const lowerPrompt = voicePrompt.toLowerCase();
  
  // REMOVED: Gender extraction - now handled exclusively via persona vocalGender
  // This prevents "male vocals" being extracted when persona says "f"
  
  // Voice texture only
  if (lowerPrompt.includes("raspy") || lowerPrompt.includes("rauchig")) keywords.push("raspy");
  if (lowerPrompt.includes("smooth") || lowerPrompt.includes("weich") || lowerPrompt.includes("velvet")) keywords.push("smooth");
  if (lowerPrompt.includes("powerful") || lowerPrompt.includes("kraftvoll") || lowerPrompt.includes("strong")) keywords.push("powerful");
  if (lowerPrompt.includes("soft") || lowerPrompt.includes("sanft") || lowerPrompt.includes("gentle")) keywords.push("soft");
  if (lowerPrompt.includes("breathy") || lowerPrompt.includes("hauchig")) keywords.push("breathy");
  if (lowerPrompt.includes("soulful") || lowerPrompt.includes("soul")) keywords.push("soulful");
  if (lowerPrompt.includes("operatic") || lowerPrompt.includes("opera")) keywords.push("operatic");
  if (lowerPrompt.includes("gritty") || lowerPrompt.includes("raw")) keywords.push("gritty");
  if (lowerPrompt.includes("warm") || lowerPrompt.includes("rich")) keywords.push("warm");
  if (lowerPrompt.includes("bright") || lowerPrompt.includes("clear")) keywords.push("bright");
  
  // REMOVED: high/deep keywords as they can conflict with gender expectations
  // e.g., "deep voice" might confuse Suno for a female artist
  
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
