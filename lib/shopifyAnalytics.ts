import { getSupabaseAdmin } from "@/lib/supabaseServer";

const SHOP = "r9rvyr-fk";
const CLIENT_ID = "b015f943dfb35cfd10d40e3fb7535f90";
const API_VERSION = "2026-07";
const SECRET_NAME = "shopify_analytics_client_secret";

type TokenCache = { token: string; expiresAt: number; scopes: string[] };
let tokenCache: TokenCache | null = null;

function parseScopes(scope: string | undefined) {
  return String(scope || "")
    .split(/[ ,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function exchangeClientCredentials(clientSecret: string) {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: clientSecret,
  });

  const response = await fetch(`https://${SHOP}.myshopify.com/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || `Shopify token request failed (${response.status}). Make sure the Vibe OS Analytics app is installed on the store.`);
  }

  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 86400) - 120) * 1000,
    scopes: parseScopes(payload.scope),
  };
  return tokenCache;
}

async function adminGraphql(clientSecret: string, query: string, variables?: Record<string, unknown>) {
  const auth = await exchangeClientCredentials(clientSecret);
  const response = await fetch(`https://${SHOP}.myshopify.com/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": auth.token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Shopify Admin API returned ${response.status}.`);
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    throw new Error(payload.errors.map((e: any) => e?.message || "Shopify GraphQL error").join(" · "));
  }
  return { payload, scopes: auth.scopes };
}

export async function getStoredShopifyAnalyticsSecret() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("vibe_get_integration_secret", { p_name: SECRET_NAME });
  if (error || !data) return null;
  return String(data);
}

export async function storeShopifyAnalyticsSecret(clientSecret: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.rpc("vibe_set_integration_secret", {
    p_name: SECRET_NAME,
    p_secret: clientSecret,
  });
  if (error) throw new Error(error.message);
}

export async function verifyShopifyAnalyticsSecret(clientSecret: string) {
  tokenCache = null;
  const query = `query VerifyAnalytics {
    currentAppInstallation {
      app { title }
      accessScopes { handle description }
    }
    analytics: shopifyqlQuery(query: """
      FROM sessions
      SHOW sessions, online_store_visitors, pageviews, sessions_with_cart_additions,
        sessions_that_reached_checkout, sessions_that_completed_checkout,
        conversion_rate, added_to_cart_rate, reached_checkout_rate
      WHERE human_or_bot_session = 'human'
      DURING today
    """) {
      parseErrors
      tableData { columns { name dataType displayName } rows }
    }
  }`;

  const { payload, scopes } = await adminGraphql(clientSecret, query);
  const appScopes = (payload?.data?.currentAppInstallation?.accessScopes || []).map((x: any) => String(x.handle));
  const effectiveScopes = Array.from(new Set([...scopes, ...appScopes]));

  const requiredScopes = ["read_reports", "read_orders", "read_products"];
  const missingScopes = requiredScopes.filter((scope) => !effectiveScopes.includes(scope));
  if (missingScopes.length) {
    throw new Error(`The app connected, but Shopify is missing: ${missingScopes.join(", ")}. Granted scopes: ${effectiveScopes.join(", ") || "none"}.`);
  }

  const parseErrors = payload?.data?.analytics?.parseErrors || [];
  if (parseErrors.length) throw new Error(`ShopifyQL parse error: ${JSON.stringify(parseErrors)}`);

  const row = payload?.data?.analytics?.tableData?.rows?.[0] || {};
  return {
    appTitle: payload?.data?.currentAppInstallation?.app?.title || "Vibe OS Analytics",
    scopes: effectiveScopes,
    today: row,
  };
}

export async function getLiveShopifyAnalyticsSnapshot() {
  const secret = await getStoredShopifyAnalyticsSecret();
  if (!secret) return null;

  const query = `query VibeOsPerformance {
    orders(first: 100, reverse: true, sortKey: CREATED_AT, query: "test:false") {
      nodes {
        id
        name
        createdAt
        cancelledAt
        currentTotalPriceSet { shopMoney { amount currencyCode } }
      }
    }
    today: shopifyqlQuery(query: """
      FROM sessions
      SHOW sessions, online_store_visitors, pageviews, sessions_with_cart_additions,
        sessions_that_reached_checkout, sessions_that_completed_checkout,
        conversion_rate, added_to_cart_rate, reached_checkout_rate
      WHERE human_or_bot_session = 'human'
      DURING today
    """) {
      parseErrors
      tableData { rows }
    }
    trend: shopifyqlQuery(query: """
      FROM sessions
      SHOW sessions, online_store_visitors, pageviews, sessions_with_cart_additions,
        sessions_that_reached_checkout, sessions_that_completed_checkout, conversion_rate
      WHERE human_or_bot_session = 'human'
      TIMESERIES day
      SINCE -7d UNTIL today
      ORDER BY day ASC
    """) {
      parseErrors
      tableData { rows }
    }
    sources: shopifyqlQuery(query: """
      FROM sessions
      SHOW sessions, online_store_visitors, conversion_rate
      WHERE human_or_bot_session = 'human'
      GROUP BY referrer_source
      SINCE -30d UNTIL today
      ORDER BY sessions DESC
      LIMIT 10
    """) {
      parseErrors
      tableData { rows }
    }
    landing: shopifyqlQuery(query: """
      FROM sessions
      SHOW sessions, pageviews, conversion_rate
      WHERE human_or_bot_session = 'human'
      GROUP BY landing_page_path
      SINCE -30d UNTIL today
      ORDER BY sessions DESC
      LIMIT 10
    """) {
      parseErrors
      tableData { rows }
    }
  }`;

  const { payload, scopes } = await adminGraphql(secret, query);
  return {
    scopes,
    orders: payload?.data?.orders?.nodes || [],
    today: payload?.data?.today?.tableData?.rows?.[0] || null,
    trend: payload?.data?.trend?.tableData?.rows || [],
    trafficSources: payload?.data?.sources?.tableData?.rows || [],
    landingPages: payload?.data?.landing?.tableData?.rows || [],
  };
}

export const shopifyAnalyticsConfig = {
  shop: SHOP,
  clientId: CLIENT_ID,
};
