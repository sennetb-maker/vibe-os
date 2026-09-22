import { contentBucket, getSupabaseAdmin } from "@/lib/supabaseServer";

export type StoreMetrics = {
  revenue: number;
  orders: number;
  aov: number | null;
  conversion: number | null;
  sessions: number | null;
  source: "live" | "unavailable";
};

export type ContentAsset = {
  id: string;
  file_name: string;
  storage_path: string;
  media_type: string | null;
  status: string;
  product_name: string | null;
  agent_notes?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  signedUrl?: string | null;
};

export type Approval = {
  id: string;
  action_type: string;
  payload: Record<string, any>;
  status: string;
  created_at: string;
};

export type ActivityItem = {
  id: string;
  source: string;
  event_type: string;
  summary: string;
  created_at: string;
};

function sameCentralDay(iso: string, now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.SHOP_TIME_ZONE || "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(iso)) === fmt.format(now);
}

export async function getStoreMetrics(): Promise<StoreMetrics> {
  const endpoint = process.env.MAKE_SHOPIFY_SNAPSHOT_URL;
  if (!endpoint) return { revenue: 0, orders: 0, aov: null, conversion: null, sessions: null, source: "unavailable" };
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`Make snapshot returned ${r.status}`);
    const body = await r.json();
    const orders = Array.isArray(body?.data?.orders) ? body.data.orders : [];
    const today = orders.filter((o: any) => o?.createdAt && sameCentralDay(o.createdAt) && !o.cancelledAt);
    const revenue = today.reduce((sum: number, o: any) => {
      const raw = o?.currentTotalPriceSet?.shopMoney?.amount;
      const n = Number(raw ?? 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    return {
      revenue,
      orders: today.length,
      aov: today.length ? revenue / today.length : null,
      conversion: null,
      sessions: null,
      source: "live",
    };
  } catch {
    return { revenue: 0, orders: 0, aov: null, conversion: null, sessions: null, source: "unavailable" };
  }
}

export async function getContentAssets(limit = 12): Promise<ContentAsset[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("content_assets")
    .select("id,file_name,storage_path,media_type,status,product_name,agent_notes,archived_at,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return Promise.all(data.map(async (asset: any) => {
    const { data: signed } = await supabase.storage.from(contentBucket()).createSignedUrl(asset.storage_path, 3600);
    return { ...asset, signedUrl: signed?.signedUrl ?? null };
  }));
}


export async function getContentInboxCount(): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("content_assets")
    .select("id", { count: "exact", head: true })
    .eq("status", "inbox");
  return error ? 0 : (count || 0);
}

// Backward-compatible helper for older imports.
export const getContentReadyCount = getContentInboxCount;

export async function getPendingApprovals(limit = 5): Promise<Approval[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("approvals")
    .select("id,action_type,payload,status,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  return error ? [] : ((data || []) as Approval[]);
}

export async function getRecentActivity(limit = 8): Promise<ActivityItem[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("activity_log")
    .select("id,source,event_type,summary,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return error ? [] : ((data || []) as ActivityItem[]);
}

export async function getSocialPosts(limit = 60) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("social_posts")
    .select("id,platform,asset_id,caption,hashtags,post_type,cta,destination_url,product_name,agent_notes,visual_preset,crop_mode,render_status,rendered_asset_path,status,scheduled_for,approved_at,published_at,created_at,updated_at")
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error || !data) return [];

  const postIds = data.map((p: any) => p.id);
  const { data: links } = postIds.length ? await supabase
    .from("social_post_assets")
    .select("post_id,asset_id,sort_order,role")
    .in("post_id", postIds) : { data: [] as any[] };

  const assetIds = Array.from(new Set([
    ...(links || []).map((x: any) => x.asset_id),
    ...data.map((p: any) => p.asset_id).filter(Boolean),
  ]));
  const { data: sourceAssets } = assetIds.length ? await supabase
    .from("content_assets")
    .select("id,file_name,storage_path,media_type,status")
    .in("id", assetIds) : { data: [] as any[] };

  const signedAssets = await Promise.all((sourceAssets || []).map(async (asset: any) => {
    const { data: signed } = await supabase.storage.from(contentBucket()).createSignedUrl(asset.storage_path, 3600);
    return { ...asset, signedUrl: signed?.signedUrl ?? null };
  }));
  const assetMap = new Map<string, any>(signedAssets.map((a: any) => [String(a.id), a]));

  const { data: generatedMedia } = postIds.length ? await supabase
    .from("social_post_media")
    .select("id,post_id,source_asset_id,storage_path,media_type,sort_order,treatment")
    .in("post_id", postIds)
    .order("sort_order", { ascending: true }) : { data: [] as any[] };

  return Promise.all(data.map(async (post: any) => {
    const orderedLinks = (links || []).filter((x: any) => x.post_id === post.id).sort((a: any, b: any) => a.sort_order - b.sort_order);
    const sourceList = orderedLinks.map((x: any) => { const asset = assetMap.get(String(x.asset_id)); return asset ? { ...asset, role: x.role, sort_order: x.sort_order } : null; }).filter(Boolean) as any[];
    if (!sourceList.length && post.asset_id && assetMap.has(String(post.asset_id))) sourceList.push(assetMap.get(String(post.asset_id)));
    let renderedUrl = null;
    if (post.rendered_asset_path) {
      const { data: signed } = await supabase.storage.from(contentBucket()).createSignedUrl(post.rendered_asset_path, 3600);
      renderedUrl = signed?.signedUrl ?? null;
    }
    const mediaRows = (generatedMedia || []).filter((m: any) => m.post_id === post.id).sort((a: any, b: any) => a.sort_order - b.sort_order);
    const renderedMedia = await Promise.all(mediaRows.map(async (m: any) => {
      const { data: signed } = await supabase.storage.from(contentBucket()).createSignedUrl(m.storage_path, 3600);
      return { ...m, signedUrl: signed?.signedUrl ?? null };
    }));
    return { ...post, sourceAssets: sourceList, renderedUrl, renderedMedia };
  }));
}

export async function getCreativeAssets(limit = 20) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("creative_assets")
    .select("id,title,storage_path,source_agent,status,notes,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return Promise.all(data.map(async (asset: any) => {
    if (!asset.storage_path) return { ...asset, signedUrl: null };
    const { data: signed } = await supabase.storage.from(contentBucket()).createSignedUrl(asset.storage_path, 3600);
    return { ...asset, signedUrl: signed?.signedUrl ?? null };
  }));
}