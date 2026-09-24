import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import {
  getStoredShopifyAnalyticsSecret,
  shopifyAnalyticsConfig,
  storeShopifyAnalyticsSecret,
  verifyShopifyAnalyticsSecret,
} from "@/lib/shopifyAnalytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const hasSecret = Boolean(await getStoredShopifyAnalyticsSecret());
  let status: any = null;
  if (supabase) {
    const { data } = await supabase
      .from("integration_status")
      .select("id,provider,label,status,scopes,details,verified_at,updated_at")
      .eq("id", "shopify_analytics")
      .maybeSingle();
    status = data || null;
  }
  return NextResponse.json({
    configured: hasSecret,
    shop: shopifyAnalyticsConfig.shop,
    clientId: shopifyAnalyticsConfig.clientId,
    status,
  });
}

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const clientSecret = String(body?.clientSecret || "").trim();
  if (!clientSecret) return NextResponse.json({ error: "Paste the Shopify client secret." }, { status: 400 });

  try {
    const verified = await verifyShopifyAnalyticsSecret(clientSecret);
    await storeShopifyAnalyticsSecret(clientSecret);

    const now = new Date().toISOString();
    await supabase.from("integration_status").upsert({
      id: "shopify_analytics",
      provider: "shopify",
      label: "Vibe OS Analytics",
      status: "connected",
      scopes: verified.scopes,
      details: { app_title: verified.appTitle, shop: shopifyAnalyticsConfig.shop },
      verified_at: now,
      updated_at: now,
    });

    await supabase.from("activity_log").insert({
      source: "Vibe OS",
      event_type: "shopify_analytics_connected",
      summary: "Shopify Analytics connected with live reporting access",
      payload: { scopes: verified.scopes, shop: shopifyAnalyticsConfig.shop },
    });

    return NextResponse.json({
      ok: true,
      status: "connected",
      scopes: verified.scopes,
      today: verified.today,
    });
  } catch (error: any) {
    const message = error?.message || "Shopify analytics connection failed.";
    await supabase.from("integration_status").upsert({
      id: "shopify_analytics",
      provider: "shopify",
      label: "Vibe OS Analytics",
      status: "error",
      scopes: [],
      details: { error: message, shop: shopifyAnalyticsConfig.shop },
      verified_at: null,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
