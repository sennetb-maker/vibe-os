import { contentBucket, getSupabaseAdmin } from "@/lib/supabaseServer";
import { getLiveShopifyAnalyticsSnapshot } from "@/lib/shopifyAnalytics";

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

export type StoreTrendPoint = {
  day: string;
  sessions: number;
  visitors: number;
  pageviews: number;
  cartAddSessions: number;
  checkoutSessions: number;
  completedCheckoutSessions: number;
  conversionRate: number | null;
};

export type TrafficSourceMetric = {
  source: string;
  sessions: number;
  visitors: number;
  conversionRate: number | null;
};

export type LandingPageMetric = {
  path: string;
  sessions: number;
  pageviews: number;
  conversionRate: number | null;
};

export type StorePerformance = StoreMetrics & {
  visitors: number | null;
  pageviews: number | null;
  cartAddSessions: number | null;
  checkoutSessions: number | null;
  completedCheckoutSessions: number | null;
  addedToCartRate: number | null;
  reachedCheckoutRate: number | null;
  analyticsCapturedAt: string | null;
  analyticsSource: "shopifyql" | "unavailable";
  trend: StoreTrendPoint[];
  trafficSources: TrafficSourceMetric[];
  landingPages: LandingPageMetric[];
};

function numeric(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getStorePerformance(): Promise<StorePerformance> {
  try {
    const live = await getLiveShopifyAnalyticsSnapshot();
    if (live) {
      const orders = Array.isArray(live.orders) ? live.orders : [];
      const todayOrders = orders.filter((o: any) => o?.createdAt && sameCentralDay(o.createdAt) && !o.cancelledAt);
      const revenue = todayOrders.reduce((sum: number, o: any) => {
        const n = Number(o?.currentTotalPriceSet?.shopMoney?.amount ?? 0);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

      const row: any = live.today || {};
      const trend: StoreTrendPoint[] = (live.trend || []).map((x: any) => ({
        day: String(x.day || ""),
        sessions: numeric(x.sessions) || 0,
        visitors: numeric(x.online_store_visitors) || 0,
        pageviews: numeric(x.pageviews) || 0,
        cartAddSessions: numeric(x.sessions_with_cart_additions) || 0,
        checkoutSessions: numeric(x.sessions_that_reached_checkout) || 0,
        completedCheckoutSessions: numeric(x.sessions_that_completed_checkout) || 0,
        conversionRate: numeric(x.conversion_rate),
      }));
      const trafficSources: TrafficSourceMetric[] = (live.trafficSources || []).map((x: any) => ({
        source: String(x.referrer_source || "unknown"),
        sessions: numeric(x.sessions) || 0,
        visitors: numeric(x.online_store_visitors) || 0,
        conversionRate: numeric(x.conversion_rate),
      }));
      const landingPages: LandingPageMetric[] = (live.landingPages || []).map((x: any) => ({
        path: String(x.landing_page_path || "/"),
        sessions: numeric(x.sessions) || 0,
        pageviews: numeric(x.pageviews) || 0,
        conversionRate: numeric(x.conversion_rate),
      }));

      const result: StorePerformance = {
        revenue,
        orders: todayOrders.length,
        aov: todayOrders.length ? revenue / todayOrders.length : null,
        conversion: numeric(row.conversion_rate),
        sessions: numeric(row.sessions),
        source: "live",
        visitors: numeric(row.online_store_visitors),
        pageviews: numeric(row.pageviews),
        cartAddSessions: numeric(row.sessions_with_cart_additions),
        checkoutSessions: numeric(row.sessions_that_reached_checkout),
        completedCheckoutSessions: numeric(row.sessions_that_completed_checkout),
        addedToCartRate: numeric(row.added_to_cart_rate),
        reachedCheckoutRate: numeric(row.reached_checkout_rate),
        analyticsCapturedAt: new Date().toISOString(),
        analyticsSource: "shopifyql",
        trend,
        trafficSources,
        landingPages,
      };

      const supabase = getSupabaseAdmin();
      if (supabase) {
        const raw = {
          trend: trend.map((x) => ({
            day: x.day,
            sessions: x.sessions,
            visitors: x.visitors,
            pageviews: x.pageviews,
            cart_add_sessions: x.cartAddSessions,
            checkout_sessions: x.checkoutSessions,
            completed_checkout_sessions: x.completedCheckoutSessions,
            conversion_rate: x.conversionRate,
          })),
          traffic_sources: trafficSources.map((x) => ({
            source: x.source,
            sessions: x.sessions,
            visitors: x.visitors,
            conversion_rate: x.conversionRate,
          })),
          landing_pages: landingPages.map((x) => ({
            path: x.path,
            sessions: x.sessions,
            pageviews: x.pageviews,
            conversion_rate: x.conversionRate,
          })),
        };
        await supabase.from("store_performance_snapshots").insert({
          period: "today",
          period_start: new Date().toISOString().slice(0, 10),
          period_end: new Date().toISOString().slice(0, 10),
          sessions: result.sessions,
          visitors: result.visitors,
          pageviews: result.pageviews,
          cart_add_sessions: result.cartAddSessions,
          checkout_sessions: result.checkoutSessions,
          completed_checkout_sessions: result.completedCheckoutSessions,
          conversion_rate: result.conversion,
          added_to_cart_rate: result.addedToCartRate,
          reached_checkout_rate: result.reachedCheckoutRate,
          revenue: result.revenue,
          orders: result.orders,
          aov: result.aov,
          source: "shopifyql",
          raw,
        });
      }

      return result;
    }
  } catch {
    // Fall through to the existing Make + stored snapshot path until direct analytics is configured.
  }

  const base = await getStoreMetrics();
  const empty: StorePerformance = {
    ...base,
    visitors: null,
    pageviews: null,
    cartAddSessions: null,
    checkoutSessions: null,
    completedCheckoutSessions: null,
    addedToCartRate: null,
    reachedCheckoutRate: null,
    analyticsCapturedAt: null,
    analyticsSource: "unavailable",
    trend: [],
    trafficSources: [],
    landingPages: [],
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from("store_performance_snapshots")
    .select("sessions,visitors,pageviews,cart_add_sessions,checkout_sessions,completed_checkout_sessions,conversion_rate,added_to_cart_rate,reached_checkout_rate,source,raw,captured_at")
    .eq("period", "today")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return empty;

  const raw: any = data.raw || {};
  const trend: StoreTrendPoint[] = Array.isArray(raw.trend) ? raw.trend.map((x: any) => ({
    day: String(x.day || ""),
    sessions: numeric(x.sessions) || 0,
    visitors: numeric(x.visitors) || 0,
    pageviews: numeric(x.pageviews) || 0,
    cartAddSessions: numeric(x.cart_add_sessions) || 0,
    checkoutSessions: numeric(x.checkout_sessions) || 0,
    completedCheckoutSessions: numeric(x.completed_checkout_sessions) || 0,
    conversionRate: numeric(x.conversion_rate),
  })) : [];

  const trafficSources: TrafficSourceMetric[] = Array.isArray(raw.traffic_sources) ? raw.traffic_sources.map((x: any) => ({
    source: String(x.source || "unknown"),
    sessions: numeric(x.sessions) || 0,
    visitors: numeric(x.visitors) || 0,
    conversionRate: numeric(x.conversion_rate),
  })) : [];

  const landingPages: LandingPageMetric[] = Array.isArray(raw.landing_pages) ? raw.landing_pages.map((x: any) => ({
    path: String(x.path || "/"),
    sessions: numeric(x.sessions) || 0,
    pageviews: numeric(x.pageviews) || 0,
    conversionRate: numeric(x.conversion_rate),
  })) : [];

  return {
    ...base,
    sessions: numeric(data.sessions),
    visitors: numeric(data.visitors),
    pageviews: numeric(data.pageviews),
    cartAddSessions: numeric(data.cart_add_sessions),
    checkoutSessions: numeric(data.checkout_sessions),
    completedCheckoutSessions: numeric(data.completed_checkout_sessions),
    conversion: numeric(data.conversion_rate),
    addedToCartRate: numeric(data.added_to_cart_rate),
    reachedCheckoutRate: numeric(data.reached_checkout_rate),
    analyticsCapturedAt: data.captured_at || null,
    analyticsSource: "unavailable",
    trend,
    trafficSources,
    landingPages,
  };
}
export async function getStoreProductMetrics(limit = 12) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("store_product_metrics")
    .select("id,metric_date,shopify_product_id,product_title,product_handle,product_views,product_sessions,cart_additions,purchases,revenue,captured_at")
    .order("metric_date", { ascending: false })
    .order("product_views", { ascending: false, nullsFirst: false })
    .limit(limit);
  return error ? [] : (data || []);
}

export async function getSocialPerformance() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { accounts: [], posts: [] };

  const [{ data: accounts }, { data: postMetrics }] = await Promise.all([
    supabase
      .from("social_account_metrics")
      .select("platform,metric_date,followers,reach,impressions,views,profile_views,website_clicks,engagements,likes,comments,shares,saves,posts,fetched_at")
      .order("metric_date", { ascending: false })
      .limit(120),
    supabase
      .from("social_post_metrics")
      .select("id,social_post_id,platform,external_post_id,metric_date,reach,impressions,views,likes,comments,shares,saves,clicks,engagements,fetched_at")
      .order("metric_date", { ascending: false })
      .limit(100),
  ]);

  const metricRows = postMetrics || [];
  const postIds = Array.from(new Set(metricRows.map((x: any) => x.social_post_id).filter(Boolean)));
  const { data: posts } = postIds.length ? await supabase
    .from("social_posts")
    .select("id,platform,caption,product_name,published_at,status")
    .in("id", postIds) : { data: [] as any[] };

  const postMap = new Map((posts || []).map((p: any) => [String(p.id), p]));
  return {
    accounts: accounts || [],
    posts: metricRows.map((m: any) => ({ ...m, post: postMap.get(String(m.social_post_id)) || null })),
  };
}
