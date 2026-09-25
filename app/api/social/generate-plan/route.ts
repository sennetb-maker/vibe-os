import { NextResponse } from "next/server";
import { getSupabaseAdmin, contentBucket } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type PlannedPost = {
  platform?: string;
  scheduled_for?: string;
  post_type?: string;
  caption?: string;
  cta?: string | null;
  destination_url?: string | null;
  product_name?: string | null;
  creative_instructions?: string | null;
  hashtags?: string | null;
  visual_preset?: string | null;
  crop_mode?: string | null;
  asset_ids?: string[];
  content_lane?: string | null;
  concept_title?: string | null;
};

function extractJson(raw: string) {
  const trimmed = raw.trim();
  try { return JSON.parse(trimmed); } catch {}
  const fenced = trimmed.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/i);
  if (fenced?.[1]) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch {}
  }
  return null;
}

function normalizePlatform(value?: string) {
  const p = String(value || "").toLowerCase();
  if (p.includes("instagram")) return "Instagram";
  if (p.includes("facebook")) return "Facebook";
  if (p.includes("tiktok")) return "TikTok";
  return "";
}

function safeDestination(value?: string | null) {
  if (!value) return "https://vibeandahalf.com/collections/shop-all";
  try {
    const u = new URL(value);
    if (u.hostname === "vibeandahalf.com" || u.hostname === "www.vibeandahalf.com") return u.toString();
  } catch {}
  return "https://vibeandahalf.com/collections/shop-all";
}

export async function POST() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured." }, { status: 503 });

  const gateway = process.env.MAKE_AGENT_GATEWAY_URL;
  if (!gateway) return NextResponse.json({ message: "The Social Media Manager gateway is not configured." }, { status: 503 });

  const { data: assets, error: assetError } = await supabase
    .from("content_assets")
    .select("id,file_name,storage_path,media_type,status,product_name,garment_color,setting,orientation,agent_notes,ai_description,drive_file_id,created_at")
    .in("status", ["inbox", "working", "used"])
    .order("created_at", { ascending: false })
    .limit(80);
  if (assetError) return NextResponse.json({ message: assetError.message }, { status: 500 });
  if (!assets?.length) return NextResponse.json({ message: "Upload some source content before asking the Social Media Manager to build the plan." }, { status: 400 });

  const signedAssets = await Promise.all(assets.map(async (asset: any) => {
    const { data: signed } = await supabase.storage.from(contentBucket()).createSignedUrl(asset.storage_path, 60 * 60 * 4);
    return {
      id: asset.id,
      drive_file_id: asset.drive_file_id,
      file_name: asset.file_name,
      media_type: asset.media_type,
      product_name: asset.product_name,
      garment_color: asset.garment_color,
      setting: asset.setting,
      orientation: asset.orientation,
      notes: asset.agent_notes || asset.ai_description,
      image_url: signed?.signedUrl || null,
    };
  }));

  const { data: inspiration } = await supabase
    .from("creative_assets")
    .select("id,title,storage_path,notes,status,created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const signedInspiration = await Promise.all((inspiration || []).map(async (item: any) => {
    let url = null;
    if (item.storage_path) {
      const { data: signed } = await supabase.storage.from(contentBucket()).createSignedUrl(item.storage_path, 60 * 60 * 4);
      url = signed?.signedUrl || null;
    }
    return { id: item.id, title: item.title, notes: item.notes, image_url: url };
  }));

  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const realVideoAssetIds = new Set(
    signedAssets.filter((a: any) => String(a.media_type || "").startsWith("video/")).map((a: any) => String(a.id))
  );

  const recentStart = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentVibeOsPosts } = await supabase
    .from("social_posts")
    .select("platform,caption,post_type,product_name,status,published_at,scheduled_for")
    .or(`published_at.gte.${recentStart},scheduled_for.gte.${recentStart}`)
    .order("created_at", { ascending: false })
    .limit(40);

  const prompt = [
    "Build VIBE & A HALF's rolling 7-day organic social plan from the raw content library.",
    "",
    "MANDATORY: before finalizing the plan, call Read Social Content Queue to use the Creative Librarian indexing, call Read Recent Instagram Posts so manual posts count as real history, and call Read Complete Shopify Catalog before naming a product or making a product claim.",
    "",
    "RAW UPLOADS ARE INGREDIENTS, NOT POSTS. Group complementary files by shoot/model/look/product/setting. Decide whether each concept should be a carousel, still, story, or actual-video Reel/TikTok. Do not exhaust a whole shoot in one week; hold strong unused material for later.",
    "",
    "BRAND: premium nostalgic sport-and-leisure built around a fictional early-1990s racquet/health/country club, resort pro shop, football Sunday, understated Americana and old-money athleisure. Sporty but fashionable, preppy but not stuffy, premium without flash, aspirational but approachable.",
    "",
    "CREATIVE FEEL: mix premium editorial fashion, believable everyday moments, polished hero imagery, intentionally imperfect candid frames, product storytelling and sport/culture energy. Favor natural expressions, subtle grain, muted rich color, occasional direct flash, movement, real texture and believable human imperfection. Avoid plastic AI perfection, generic influencer imagery, hypebeast styling, hardcore gym energy, fake luxury and country-club cosplay.",
    "",
    "ROLLING MIX: about 40% lifestyle/editorial, 20% product/detail, 15% candid/social, 15% sport/culture/fan-energy, 10% direct conversion. This is a guide, not a quota.",
    "",
    "CADENCE FOR THE NEXT 7 DAYS:",
    "- Instagram: aim for about 5 feed pieces. Prefer a mix of carousels, strong stills and actual-video Reels. Do not force Reels if there is no real video.",
    "- TikTok: 3-4 posts only when the selected source includes actual video. If there is no suitable video, omit TikTok rather than pretending stills are videos.",
    "- Facebook: 2-3 selective adaptations of the strongest broadly appealing concepts. Do not mirror every Instagram post.",
    "- Stories can be proposed as supporting content.",
    "- Total output will usually be 7-12 platform posts depending on the library.",
    "",
    "FORMAT RULES:",
    "- Carousel: 3-6 complementary stills. Strong rhythm is hero → alternate → detail → candid → strong closer.",
    "- Single image: use when one frame is strong/iconic/editorial enough to stand alone.",
    "- Reel/video: use only when at least one selected source asset is an actual video. The current renderer does not yet convert still photos into video. You may note a future slideshow/Reel opportunity in creative_instructions, but the actual post_type must stay image/carousel/story until a real video exists.",
    "- Rotate close/medium/wide, male/female, product/lifestyle, studio/environment, polished/imperfect, front/back, stillness/movement, sport/social and product categories.",
    "",
    "PRODUCT PRIORITIES: rotate hats, premium crewnecks/sweatshirts, graphic tees, racquet/health-club pieces, Socially Sporty, RUN THE BALL., OFFSIDES, Sunday Parlay, Sunday Scaries and recognizable VIBE & A HALF logo pieces when exact products are verified. Hats deserve frequent close-up treatment. Do not let one slogan dominate.",
    "",
    "CAPTION VOICE: concise, confident, natural, slightly witty and specific. Write like a stylish person running a small brand. Avoid generic e-commerce language, motivational fitness clichés, fake urgency/scarcity, excessive emojis and AI-luxury copy. Most captions should be 1-3 short sentences; some can be only a few words. Hashtags restrained.",
    "",
    "PRODUCT ACCURACY: never invent or alter product wording, embroidery, design placement, color, material, fit, price, availability, popularity, sale status or scarcity. Reject obviously malformed AI faces/hands/products or inaccurate merchandise.",
    "",
    "SOURCE CONTENT — publishable raw inventory. Final asset_ids MUST use these Supabase UUIDs. drive_file_id lets you match the Creative Librarian's Drive index:",
    JSON.stringify(signedAssets),
    "",
    "RECENT VIBE OS HISTORY — supplement the live Instagram history you read with the tool:",
    JSON.stringify(recentVibeOsPosts || []),
    "",
    "INSPIRATION / REFERENCE ONLY — NEVER POST THESE FILES:",
    JSON.stringify(signedInspiration),
    "",
    "PHOTO TREATMENT: no added text/graphic overlays. Recommend crop/reframe, exposure, contrast, warmth, saturation and subtle film character only. Never alter apparel artwork.",
    "Choose visual_preset from natural, warm_film, muted_90s, direct_flash, rich_club. Choose crop_mode from portrait, square, original.",
    "",
    "SCHEDULING:",
    `Schedule between ${now.toISOString()} and ${end.toISOString()}. Use America/Chicago audience timing and return scheduled_for as a full ISO-8601 timestamp WITH UTC OFFSET.`,
    "",
    "OUTPUT: return ONLY valid JSON. No markdown or commentary.",
    '{"posts":[{"platform":"Instagram|Facebook|TikTok","scheduled_for":"ISO-8601 with offset","post_type":"image|carousel|reel|video|story","asset_ids":["Supabase UUID from SOURCE CONTENT only"],"caption":"finished platform-specific caption","hashtags":"0-5 useful hashtags as one string, or empty string","cta":"short CTA or null","destination_url":"verified vibeandahalf.com URL","product_name":"verified product name or null","content_lane":"lifestyle_editorial|product_detail|candid_social|sport_culture|conversion","concept_title":"short internal concept name","visual_preset":"natural|warm_film|muted_90s|direct_flash|rich_club","crop_mode":"portrait|square|original","creative_instructions":"specific crop/sequence/edit direction; NO text overlays"}]}',
    "",
    "Rules: asset_ids may ONLY contain IDs supplied in SOURCE CONTENT. Do not include inspiration IDs. Do not claim reviews, customer quotes, scarcity or social proof that was not supplied.",
  ].join("\n");

  await supabase.from("activity_log").insert({
    source: "Social Media Manager",
    event_type: "social_plan_requested",
    summary: `Building a 7-day plan from ${assets.length} raw source assets and ${signedInspiration.length} inspiration references`,
  });

  try {
    const r = await fetch(gateway, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "social", scenarioId: 6333452, message: prompt }),
      cache: "no-store",
    });
    const raw = await r.text();
    let envelope: any;
    try { envelope = JSON.parse(raw); } catch { envelope = { response: raw }; }
    const agentText = String(envelope?.response ?? envelope?.result ?? raw ?? "");
    if (!r.ok) throw new Error(agentText || `Social agent returned ${r.status}`);

    const parsed = extractJson(agentText);
    const proposed: PlannedPost[] = Array.isArray(parsed?.posts) ? parsed.posts : [];
    if (!proposed.length) throw new Error("The Social Media Manager did not return a structured calendar.");

    const validAssetIds = new Set(assets.map((a: any) => String(a.id)));
    const rows: any[] = [];
    const links: { index: number; assetIds: string[] }[] = [];

    for (const post of proposed.slice(0, 40)) {
      const platform = normalizePlatform(post.platform);
      if (!platform || !post.scheduled_for || !post.caption?.trim()) continue;
      const dt = new Date(post.scheduled_for);
      if (!Number.isFinite(dt.getTime()) || dt < now || dt > end) continue;
      const assetIds = (post.asset_ids || []).map(String).filter((id) => validAssetIds.has(id)).slice(0, 8);
      if (!assetIds.length) continue;
      let postType = String(post.post_type || "image").toLowerCase();
      if ((postType === "reel" || postType === "video" || platform === "TikTok") && !assetIds.some((id) => realVideoAssetIds.has(id))) continue;
      if (postType === "carousel" && assetIds.length < 2) postType = "image";
      const metadata = [
        post.content_lane ? `Lane: ${String(post.content_lane)}` : "",
        post.concept_title ? `Concept: ${String(post.concept_title)}` : "",
        post.creative_instructions ? String(post.creative_instructions).trim() : "",
      ].filter(Boolean).join(" · ");
      rows.push({
        platform,
        asset_id: assetIds[0],
        caption: String(post.caption).trim(),
        status: "review",
        scheduled_for: dt.toISOString(),
        post_type: postType,
        cta: post.cta ? String(post.cta).trim() : null,
        destination_url: safeDestination(post.destination_url),
        product_name: post.product_name ? String(post.product_name).trim() : null,
        agent_notes: metadata || null,
        hashtags: post.hashtags ? String(post.hashtags).trim() : "",
        visual_preset: ["natural","warm_film","muted_90s","direct_flash","rich_club"].includes(String(post.visual_preset || "")) ? String(post.visual_preset) : "muted_90s",
        crop_mode: ["portrait","square","original"].includes(String(post.crop_mode || "")) ? String(post.crop_mode) : "portrait",
        render_status: "needs_render",
        updated_at: new Date().toISOString(),
      });
      links.push({ index: rows.length - 1, assetIds });
    }

    if (rows.length < 5) throw new Error("The generated weekly plan did not contain enough usable posts from the available assets.");

    const { data: oldDrafts } = await supabase.from("social_posts")
      .select("id")
      .in("status", ["working", "draft", "review", "ready_for_approval"])
      .gte("scheduled_for", now.toISOString())
      .lt("scheduled_for", end.toISOString());
    const oldIds = (oldDrafts || []).map((x: any) => x.id);
    if (oldIds.length) await supabase.from("social_posts").delete().in("id", oldIds);

    const { data: inserted, error: insertError } = await supabase.from("social_posts")
      .insert(rows)
      .select("id");
    if (insertError || !inserted) throw new Error(insertError?.message || "Could not save the social calendar.");

    const postAssetRows: any[] = [];
    const usedIds = new Set<string>();
    links.forEach((entry, i) => {
      entry.assetIds.forEach((assetId, order) => {
        usedIds.add(assetId);
        postAssetRows.push({ post_id: inserted[i].id, asset_id: assetId, sort_order: order, role: order === 0 ? "primary" : "source" });
      });
    });
    if (postAssetRows.length) {
      const { error: linkError } = await supabase.from("social_post_assets").insert(postAssetRows);
      if (linkError) throw new Error(linkError.message);
    }
    if (usedIds.size) {
      await supabase.from("content_assets").update({ status: "used", updated_at: new Date().toISOString() }).in("id", Array.from(usedIds));
    }

    await supabase.from("activity_log").insert({
      source: "Social Media Manager",
      event_type: "social_plan_ready",
      summary: `${rows.length} posts prepared for owner approval across the next 7 days`,
      payload: { post_count: rows.length, source_asset_count: usedIds.size },
    });

    return NextResponse.json({ message: `Social Media Manager built a ${rows.length}-post 7-day plan from your raw content. Review the calendar and approve what you like.`, count: rows.length });
  } catch (e: any) {
    await supabase.from("activity_log").insert({
      source: "Social Media Manager",
      event_type: "social_plan_error",
      summary: e?.message || "Social plan generation failed",
    });
    return NextResponse.json({ message: e?.message || "The Social Media Manager could not build the plan." }, { status: 502 });
  }
}
