# Vibe OS — Vibe & A Half Command Center

Private mobile-first Next.js command center for the Vibe & A Half automation stack.

## Verified Make state at this handoff
- `Vibe OS Agent Gateway` is active and verified end-to-end with the CEO Agent.
- Gateway routes to CEO, Social, Meta Growth, Artwork, Product, Merchandising/QA, Customer Service and Retention scenarios.
- `Vibe & A Half Organic Social Autopilot` remains intentionally OFF.
- Facebook publishing connection is healthy and scoped to the Vibe & a half Supply Co. workflow.
- Make Shopify connection is healthy for Admin GraphQL/catalog/order reads.
- `Vibe OS Shopify Snapshot API` is active and returns live order JSON, including the correct zero-order pre-launch response.
- Make's current Shopify credential does **not** have `read_reports`; ShopifyQL sessions/conversion remain unavailable until that connection is reauthorized with the required reporting/protected-data access.

## Vibe OS v0.3 wiring
- Master CEO chat calls the private Make Agent Gateway.
- Chat history persists in Supabase.
- Store revenue/orders/AOV are derived server-side from the verified Shopify snapshot webhook.
- Conversion is deliberately shown as unavailable until Shopify reporting scope is verified.
- Content uploads go to a private Supabase Storage bucket as raw **Content Inbox** assets, write metadata to `content_assets`, then mirror through Make into the existing Google Drive source folder. Raw assets are not treated as finished posts.
- Content, social schedule, creative assets, approvals and agent activity read from Supabase. The content workflow now separates raw source assets from finished social posts and supports multi-asset post assembly.
- Approval decisions persist and write to the activity log.
- Vibe OS registers a service worker and includes a web app manifest/icons for PWA installation.
- A private access-code middleware gate protects the deployed command center before Vercel launch.


## Social workflow v0.6
- Raw uploads now enter **Content Inbox** instead of being mislabeled Ready to Post.
- Content Library stages: Content Inbox → Agent Working → Used in Posts → Archived.
- Finished post stages are separate: Agent Working → Ready for Approval → Scheduled → Published.
- Raw assets can be removed from the active agent pool, restored, or permanently deleted when they have no post history.
- `social_post_assets` lets one post use multiple source assets for carousels, stitched video, slideshows and other agent-created treatments.
- Social includes a rolling **14-day calendar** plus list view, with platform, time, post type, caption preview and approval state.
- Individual posts or the full 14-day proposal can be approved from Vibe OS.
- `social_posts` now stores CTA, destination URL, product name, agent notes and an optional rendered final asset path.

## Required environment variables
Copy `.env.example` to `.env.local` locally, and configure the same variables in Vercel:

- `VIBE_OS_ACCESS_CODE` — a strong private code required to open the deployed app.

- `MAKE_AGENT_GATEWAY_URL` — server-only URL for the existing Vibe OS Agent Gateway.
- `MAKE_SHOPIFY_SNAPSHOT_URL` — server-only URL for the verified Vibe OS Shopify Snapshot API.
- `MAKE_CONTENT_MIRROR_URL` — server-only URL for the verified Vibe OS Supabase → Google Drive Ready to Post mirror.
- `SHOP_TIME_ZONE=America/Chicago`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only.
- `SUPABASE_CONTENT_BUCKET=social-content`

Never prefix Make webhooks or the Supabase service role key with `NEXT_PUBLIC_`.

## Supabase setup
Run `supabase/schema.sql` once in the Supabase SQL editor. It is idempotent: it creates/updates the private `social-content` bucket, the Vibe OS tables/indexes and the current Make agent registry. V1 table access is server-only through the service role; no anonymous table policies are created.

## Run locally
```bash
npm install
npm run dev
```

## Still intentionally not live
- Instagram publishing to the Vibe & A Half brand account.
- TikTok organic publishing.
- Organic Social Autopilot.
- Shopify conversion/session metrics via Make (`read_reports` is not currently authorized).
- Instagram/TikTok channel completion and Make agent activity callbacks into Supabase remain future wiring.