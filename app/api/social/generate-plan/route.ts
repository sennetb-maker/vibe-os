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
    .select("id,file_name,storage_path,media_type,status,product_name,garment_color,setting,orientation,agent_notes,created_at")
    .in("status", ["inbox", "working", "used"])
    .order("created_at", { ascending: false })
    .limit(80);
  if (assetError) return NextResponse.json({ message: assetError.message }, { status: 500 });
  if (!assets?.length) return NextResponse.json({ message: "Upload some source content before asking the Social Media Manager to build the plan." }, { status: 400 });

  const signedAssets = await Promise.all(assets.map(async (asset: any) => {
    const { data: signed } = await supabase.storage.from(contentBucket()).createSignedUrl(asset.storage_path, 60 * 60 * 4);
    return {
      id: asset.id,
      file_name: asset.file_name,
      media_type: asset.media_type,
      product_name: asset.product_name,
      garment_color: asset.garment_color,
      setting: asset.setting,
      orientation: asset.orientation,
      notes: asset.agent_notes,
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
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const prompt = [
    "You are the VIBE & A HALF Social Media Manager. Build the first rolling 14-day organic social calendar for the brand.",
    "",
    "GOAL",
    "The owner wants to upload raw content and inspiration, then have you decide what to post, how to package it, what copy to write, what product/collection it links to, and when each platform should receive it. The calendar should feel human and editorial, not robotic or repetitive.",
    "",
    "BRAND",
    "VIBE & A HALF is premium modern-vintage lifestyle apparel: early-1990s private clubs, racquet clubs, neighborhood restaurants/bars, old hotel merch, Sunday football culture, wine/supper clubs and understated social-club humor. Chic, nostalgic, premium, slightly irreverent. Never novelty-merch energy.",
    "",
    "CONTENT MIX",
    "Balance brand/lifestyle, humor/culture, product discovery, social proof and direct conversion. Avoid consecutive hard-sell posts. Reuse strong source assets thoughtfully, but do not make every platform receive the same post at the same time.",
    "",
    "PLATFORM BEHAVIOR",
    "Instagram: premium lifestyle, carousels, polished-but-candid product discovery, occasional reels.",
    "TikTok: casual short-form concepts, humor, football/culture POVs, slideshows/reels using available source content.",
    "Facebook: strongest Instagram concepts adapted for Facebook plus product/drop/community posts.",
    "",
    "CADENCE",
    "Create roughly 18-24 total posts across the next 14 days, typically 1-2 total posts per day across the brand, not 1-2 per platform. Include all three platforms over the period. Do not force a post onto every platform every day.",
    "",
    "SOURCE CONTENT",
    JSON.stringify(signedAssets),
    "",
    "INSPIRATION / REFERENCE ONLY — NEVER POST THESE FILES",
    JSON.stringify(signedInspiration),
    "",
    "SHOPIFY",
    "Use your connected Shopify/catalog knowledge or helper to verify product names and URLs where possible. Never invent a product URL. If you cannot verify an exact product URL, use https://vibeandahalf.com/collections/shop-all.",
    "",
    "CREATIVE TREATMENT",
    "The owner does NOT want text or graphic overlays added to the photos. Improve the photography itself: crop/reframe, exposure, contrast, warmth, saturation, subtle grain/film character, direct-flash feel when appropriate, and sequencing of multiple source assets for carousels/slideshows. Never alter the apparel artwork or product design.",
    "Choose visual_preset from: natural, warm_film, muted_90s, direct_flash, rich_club. Choose crop_mode from: portrait, square, original. Put additional photo-editing direction in creative_instructions.",
    "",
    "SCHEDULING",
    `Schedule between ${now.toISOString()} and ${end.toISOString()}. Use America/Chicago audience timing and return scheduled_for as a full ISO-8601 timestamp WITH UTC OFFSET.`,
    "",
    "OUTPUT",
    "Return ONLY valid JSON. No markdown and no commentary.",
    '{"posts":[{"platform":"Instagram|Facebook|TikTok","scheduled_for":"ISO-8601 with offset","post_type":"image|carousel|reel|video|story","asset_ids":["UUID from SOURCE CONTENT only"],"caption":"finished platform-specific caption","hashtags":"0-5 useful hashtags as one string, or empty string","cta":"short CTA or null","destination_url":"verified vibeandahalf.com URL","product_name":"verified product name or null","visual_preset":"natural|warm_film|muted_90s|direct_flash|rich_club","crop_mode":"portrait|square|original","creative_instructions":"specific photo edit / crop / sequence direction, with NO text overlays"}]}',
    "",
    "CAPTION VOICE",
    "Write like a stylish person running a small brand, not a luxury-brand copy generator. Dry, casual, specific, occasionally funny. Avoid generic phrases like quiet confidence, timeless, premium, elevated, effortless, modern ease, crafted, good taste, and club-approved. Do not overuse POV. Do not describe the brand as premium in the caption. Let the photo and product do that work.",
    "Keep most captions to 1-3 short sentences. Football posts can be funnier and more conversational. Product posts should name the actual product when verified. Hashtags should be useful and restrained, usually 0-4.",
    "",
    "Rules: asset_ids may ONLY contain IDs supplied in SOURCE CONTENT. Do not include inspiration IDs. Do not add copy/text/graphics on top of the photos. Do not claim reviews, customer quotes, scarcity or social proof that was not supplied.",
  ].join("\n");

  await supabase.from("activity_log").insert({
    source: "Social Media Manager",
    event_type: "social_plan_requested",
    summary: `Building a 14-day plan from ${assets.length} source assets and ${signedInspiration.length} inspiration references`,
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
      rows.push({
        platform,
        asset_id: assetIds[0],
        caption: String(post.caption).trim(),
        status: "review",
        scheduled_for: dt.toISOString(),
        post_type: String(post.post_type || "image").toLowerCase(),
        cta: post.cta ? String(post.cta).trim() : null,
        destination_url: safeDestination(post.destination_url),
        product_name: post.product_name ? String(post.product_name).trim() : null,
        agent_notes: post.creative_instructions ? String(post.creative_instructions).trim() : null,
        hashtags: post.hashtags ? String(post.hashtags).trim() : "",
        visual_preset: ["natural","warm_film","muted_90s","direct_flash","rich_club"].includes(String(post.visual_preset || "")) ? String(post.visual_preset) : "muted_90s",
        crop_mode: ["portrait","square","original"].includes(String(post.crop_mode || "")) ? String(post.crop_mode) : "portrait",
        render_status: "needs_render",
        updated_at: new Date().toISOString(),
      });
      links.push({ index: rows.length - 1, assetIds });
    }

    if (rows.length < 7) throw new Error("The generated plan did not contain enough usable scheduled posts.");

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
      summary: `${rows.length} posts prepared for owner approval across the next 14 days`,
      payload: { post_count: rows.length, source_asset_count: usedIds.size },
    });

    return NextResponse.json({ message: `Social Media Manager prepared ${rows.length} posts for the next 14 days. Review the calendar, then approve it.`, count: rows.length });
  } catch (e: any) {
    await supabase.from("activity_log").insert({
      source: "Social Media Manager",
      event_type: "social_plan_error",
      summary: e?.message || "Social plan generation failed",
    });
    return NextResponse.json({ message: e?.message || "The Social Media Manager could not build the plan." }, { status: 502 });
  }
}
