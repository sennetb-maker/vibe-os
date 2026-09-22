import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSupabaseAdmin, contentBucket } from "@/lib/supabaseServer";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

function presetPipeline(img: sharp.Sharp, preset: string) {
  switch (preset) {
    case "natural":
      return img.modulate({ brightness: 1.01, saturation: 0.98 }).sharpen(0.6);
    case "warm_film":
      return img.modulate({ brightness: 1.03, saturation: 0.88 }).tint("#f1dfc8").sharpen(0.45);
    case "direct_flash":
      return img.modulate({ brightness: 1.08, saturation: 0.92 }).linear(1.06, -5).sharpen(0.9);
    case "rich_club":
      return img.modulate({ brightness: 0.99, saturation: 0.88 }).linear(1.05, -4).sharpen(0.7);
    case "muted_90s":
    default:
      return img.modulate({ brightness: 1.02, saturation: 0.82 }).gamma(1.04).sharpen(0.55);
  }
}

function outputSize(platform: string, postType: string, cropMode: string) {
  if (cropMode === "original") return null;
  if (postType === "story" || postType === "reel" || postType === "video" || platform === "TikTok") {
    return { width: 1080, height: 1920 };
  }
  if (cropMode === "square") return { width: 1080, height: 1080 };
  return { width: 1080, height: 1350 };
}

export async function POST(_: Request, { params }: Ctx) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured." }, { status: 503 });

  const { id } = await params;
  const { data: post, error: postError } = await supabase
    .from("social_posts")
    .select("id,platform,post_type,visual_preset,crop_mode")
    .eq("id", id)
    .single();
  if (postError || !post) return NextResponse.json({ message: postError?.message || "Post not found." }, { status: 404 });

  const { data: links, error: linkError } = await supabase
    .from("social_post_assets")
    .select("asset_id,sort_order")
    .eq("post_id", id)
    .order("sort_order", { ascending: true });
  if (linkError) return NextResponse.json({ message: linkError.message }, { status: 500 });

  const assetIds = (links || []).map((x: any) => x.asset_id);
  if (!assetIds.length) return NextResponse.json({ message: "This post has no source media." }, { status: 400 });

  const { data: assets, error: assetError } = await supabase
    .from("content_assets")
    .select("id,storage_path,media_type,file_name")
    .in("id", assetIds);
  if (assetError) return NextResponse.json({ message: assetError.message }, { status: 500 });

  const byId = new Map((assets || []).map((a: any) => [String(a.id), a]));
  const ordered = (links || []).map((x: any) => ({ ...x, asset: byId.get(String(x.asset_id)) })).filter((x: any) => x.asset);

  await supabase.from("social_post_media").delete().eq("post_id", id);

  const rendered: any[] = [];
  const size = outputSize(post.platform, post.post_type, post.crop_mode || "portrait");

  for (let i = 0; i < ordered.length; i++) {
    const asset = ordered[i].asset;
    if (!String(asset.media_type || "").startsWith("image/")) continue;

    const { data: blob, error: downloadError } = await supabase.storage.from(contentBucket()).download(asset.storage_path);
    if (downloadError || !blob) continue;

    const input = Buffer.from(await blob.arrayBuffer());
    let img = sharp(input).rotate().flatten({ background: "#f5f4ef" });
    if (size) {
      img = img.resize({ width: size.width, height: size.height, fit: "cover", position: "attention" });
    }
    img = presetPipeline(img, post.visual_preset || "muted_90s");

    const buffer = await img.jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
    const storagePath = `rendered/${id}/${String(i + 1).padStart(2, "0")}.jpg`;

    const { error: uploadError } = await supabase.storage.from(contentBucket()).upload(storagePath, buffer, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });
    if (uploadError) continue;

    rendered.push({
      post_id: id,
      source_asset_id: asset.id,
      storage_path: storagePath,
      media_type: "image/jpeg",
      sort_order: i,
      treatment: {
        preset: post.visual_preset || "muted_90s",
        crop_mode: post.crop_mode || "portrait",
        width: size?.width || null,
        height: size?.height || null,
      },
    });
  }

  if (!rendered.length) {
    await supabase.from("social_posts").update({ render_status: "failed", updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ message: "No image source could be rendered for this post." }, { status: 400 });
  }

  const { error: mediaError } = await supabase.from("social_post_media").insert(rendered);
  if (mediaError) return NextResponse.json({ message: mediaError.message }, { status: 500 });

  const now = new Date().toISOString();
  await supabase.from("social_posts").update({
    rendered_asset_path: rendered[0].storage_path,
    render_status: "rendered",
    updated_at: now,
  }).eq("id", id);

  await supabase.from("activity_log").insert({
    source: "Social Media Manager",
    event_type: "social_media_rendered",
    summary: `${rendered.length} edited image${rendered.length === 1 ? "" : "s"} rendered for ${post.platform}`,
    payload: { post_id: id, preset: post.visual_preset, count: rendered.length },
  });

  return NextResponse.json({
    message: `Applied the ${String(post.visual_preset || "muted_90s").replaceAll("_", " ")} photo treatment.`,
    count: rendered.length,
  });
}
