import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OAuth 1.0a signature for Twitter
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");

  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  const hmac = createHmac("sha1", signingKey);
  hmac.update(signatureBase);
  return hmac.digest("base64");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { contentId, platform, connectionId } = await req.json();

    // Get the content to publish
    const { data: content, error: contentError } = await supabase
      .from("social_content")
      .select("*")
      .eq("id", contentId)
      .single();

    if (contentError || !content) {
      throw new Error("Content not found");
    }

    // Get the platform connection
    const { data: connection, error: connectionError } = await supabase
      .from("platform_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("platform", platform)
      .single();

    if (connectionError || !connection) {
      throw new Error(`No ${platform} connection found`);
    }

    // Update status to publishing
    await supabase
      .from("social_content")
      .update({ status: "publishing" })
      .eq("id", contentId);

    let publishedUrl = null;
    let success = false;
    let errorMessage = null;

    try {
      switch (platform) {
        case "twitter": {
          // Twitter/X API v2 posting
          const TWITTER_CONSUMER_KEY = Deno.env.get("TWITTER_CONSUMER_KEY");
          const TWITTER_CONSUMER_SECRET = Deno.env.get("TWITTER_CONSUMER_SECRET");
          
          if (!TWITTER_CONSUMER_KEY || !TWITTER_CONSUMER_SECRET) {
            throw new Error("Twitter API keys not configured");
          }

          const tweetText = `${content.caption}\n\n${content.hashtags?.map((h: string) => `#${h}`).join(" ") || ""}`;
          
          const oauthParams: Record<string, string> = {
            oauth_consumer_key: TWITTER_CONSUMER_KEY,
            oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
            oauth_signature_method: "HMAC-SHA1",
            oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
            oauth_token: connection.access_token,
            oauth_version: "1.0",
          };

          const signature = generateOAuthSignature(
            "POST",
            "https://api.x.com/2/tweets",
            oauthParams,
            TWITTER_CONSUMER_SECRET,
            connection.refresh_token || ""
          );

          const authHeader = `OAuth ${Object.entries({ ...oauthParams, oauth_signature: signature })
            .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
            .join(", ")}`;

          const twitterResponse = await fetch("https://api.x.com/2/tweets", {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: tweetText.substring(0, 280) }),
          });

          if (twitterResponse.ok) {
            const tweetData = await twitterResponse.json();
            publishedUrl = `https://x.com/i/status/${tweetData.data?.id}`;
            success = true;
          } else {
            const errorData = await twitterResponse.text();
            console.error("Twitter error:", errorData);
            errorMessage = "Twitter posting failed";
          }
          break;
        }

        case "linkedin": {
          // LinkedIn API posting
          const postText = `${content.caption}\n\n${content.hashtags?.map((h: string) => `#${h}`).join(" ") || ""}`;
          
          const linkedinResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${connection.access_token}`,
              "Content-Type": "application/json",
              "X-Restli-Protocol-Version": "2.0.0",
            },
            body: JSON.stringify({
              author: `urn:li:person:${connection.platform_user_id}`,
              lifecycleState: "PUBLISHED",
              specificContent: {
                "com.linkedin.ugc.ShareContent": {
                  shareCommentary: { text: postText },
                  shareMediaCategory: content.image_url ? "IMAGE" : "NONE",
                },
              },
              visibility: {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
              },
            }),
          });

          if (linkedinResponse.ok) {
            success = true;
            publishedUrl = "https://linkedin.com/feed/";
          } else {
            const errorData = await linkedinResponse.text();
            console.error("LinkedIn error:", errorData);
            errorMessage = "LinkedIn posting failed";
          }
          break;
        }

        case "facebook":
        case "instagram": {
          // Meta Graph API - requires business account
          const pageId = connection.platform_user_id;
          
          if (platform === "instagram" && content.image_url) {
            // Instagram Container API
            const createMediaResponse = await fetch(
              `https://graph.facebook.com/v18.0/${pageId}/media`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  image_url: content.image_url,
                  caption: `${content.caption}\n\n${content.hashtags?.map((h: string) => `#${h}`).join(" ") || ""}`,
                  access_token: connection.access_token,
                }),
              }
            );

            if (createMediaResponse.ok) {
              const mediaData = await createMediaResponse.json();
              
              // Publish the container
              const publishResponse = await fetch(
                `https://graph.facebook.com/v18.0/${pageId}/media_publish`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    creation_id: mediaData.id,
                    access_token: connection.access_token,
                  }),
                }
              );

              if (publishResponse.ok) {
                success = true;
                publishedUrl = `https://instagram.com/${connection.platform_username}`;
              }
            }
          } else if (platform === "facebook") {
            // Facebook Page posting
            const postResponse = await fetch(
              `https://graph.facebook.com/v18.0/${pageId}/feed`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: `${content.caption}\n\n${content.hashtags?.map((h: string) => `#${h}`).join(" ") || ""}`,
                  access_token: connection.access_token,
                }),
              }
            );

            if (postResponse.ok) {
              const postData = await postResponse.json();
              success = true;
              publishedUrl = `https://facebook.com/${postData.id}`;
            }
          }

          if (!success) {
            errorMessage = `${platform} posting failed`;
          }
          break;
        }

        default:
          errorMessage = `Platform ${platform} not supported for publishing`;
      }
    } catch (publishError) {
      console.error("Publish error:", publishError);
      errorMessage = publishError instanceof Error ? publishError.message : "Publishing failed";
    }

    // Update content status
    await supabase
      .from("social_content")
      .update({
        status: success ? "published" : "failed",
        published_url: publishedUrl,
        published_at: success ? new Date().toISOString() : null,
      })
      .eq("id", contentId);

    return new Response(
      JSON.stringify({
        success,
        publishedUrl,
        error: errorMessage,
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
