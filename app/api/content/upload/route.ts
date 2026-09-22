import { NextResponse } from "next/server";
import { contentBucket, getSupabaseAdmin } from "@/lib/supabaseServer";
import crypto from "node:crypto";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"]);
const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ message: "Supabase is not configured in this deployment." }, { status: 503 });

  const mirrorUrl = process.env.MAKE_CONTENT_MIRROR_URL;
  const fd = await req.formData();
  const files = fd.getAll("files").filter((x): x is File => x instanceof File);
  if (!files.length) return NextResponse.json({ message: "Choose at least one photo or video." }, { status: 400 });
  if (files.length > 12) return NextResponse.json({ message: "Upload up to 12 files at a time." }, { status: 400 });

  const uploaded: any[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    if (!ALLOWED.has(file.type)) return NextResponse.json({ message: `${file.name}: unsupported file type.` }, { status: 415 });
    if (file.size > MAX_BYTES) return NextResponse.json({ message: `${file.name}: file is larger than 50 MB.` }, { status: 413 });

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `inbox/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safe}`;
    const { error: uploadError } = await supabase.storage
      .from(contentBucket())
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) return NextResponse.json({ message: uploadError.message }, { status: 500 });

    const { data: row, error: rowError } = await supabase.from("content_assets").insert({
      file_name: file.name,
      storage_path: path,
      media_type: file.type,
      status: "inbox",
      source: "supabase",
    }).select("id,file_name,storage_path,status,created_at").single();
    if (rowError) return NextResponse.json({ message: rowError.message }, { status: 500 });

    let finalRow = row;
    if (mirrorUrl) {
      const { data: signed, error: signedError } = await supabase.storage.from(contentBucket()).createSignedUrl(path, 600);
      if (!signedError && signed?.signedUrl) {
        try {
          const mirror = await fetch(mirrorUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              signed_url: signed.signedUrl,
              file_name: file.name,
              mime_type: file.type,
              asset_id: row.id,
            }),
            cache: "no-store",
          });
          const result = await mirror.json();
          if (!mirror.ok || !result?.drive_file_id) throw new Error(result?.error || `Drive mirror returned ${mirror.status}`);
          const { data: updated, error: updateError } = await supabase.from("content_assets").update({
            drive_file_id: result.drive_file_id,
            updated_at: new Date().toISOString(),
          }).eq("id", row.id).select("id,file_name,storage_path,status,drive_file_id,created_at").single();
          if (updateError) throw updateError;
          finalRow = updated;
        } catch (e: any) {
          warnings.push(`${file.name}: saved in Vibe OS but Drive mirror failed (${e?.message || "unknown error"}).`);
        }
      } else {
        warnings.push(`${file.name}: saved in Vibe OS but a signed mirror URL could not be created.`);
      }
    } else {
      warnings.push(`${file.name}: saved in Vibe OS; MAKE_CONTENT_MIRROR_URL is not configured.`);
    }

    uploaded.push(finalRow);
  }

  const mirroredCount = uploaded.filter((x) => x.drive_file_id).length;
  await supabase.from("activity_log").insert({
    source: "Vibe OS",
    event_type: "content_uploaded",
    summary: `${uploaded.length} raw social asset${uploaded.length === 1 ? "" : "s"} added to Content Inbox; ${mirroredCount} mirrored to Drive`,
    payload: { asset_ids: uploaded.map((x) => x.id), warnings },
  });

  const message = warnings.length
    ? `Added ${uploaded.length} source asset${uploaded.length === 1 ? "" : "s"} to Content Inbox. ${mirroredCount} mirrored to Drive; ${warnings.length} mirror warning${warnings.length === 1 ? "" : "s"}.`
    : `Added ${uploaded.length} source asset${uploaded.length === 1 ? "" : "s"} to Content Inbox.`;
  return NextResponse.json({ message, uploaded, warnings });
}