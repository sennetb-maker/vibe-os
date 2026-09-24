import { Topbar } from "@/components/Topbar";
import { ShopifyAnalyticsSetup } from "@/components/ShopifyAnalyticsSetup";

export const dynamic = "force-dynamic";

export default function ShopifyAnalyticsSettingsPage() {
  return <><Topbar title="Shopify Analytics"/><div className="page integrationPage">
    <div className="sectionIntro">
      <small>INTEGRATIONS</small>
      <h2>Connect Shopify reporting to Vibe OS.</h2>
      <p>This private connection powers live sessions, visitors, pageviews and conversion on the Performance dashboard.</p>
    </div>
    <ShopifyAnalyticsSetup/>
  </div></>;
}
