import { Topbar } from "@/components/Topbar";
import { getSocialPerformance, getStorePerformance, getStoreProductMetrics } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

function money(value:number|null|undefined){
  if(value==null) return "—";
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);
}
function num(value:number|null|undefined){
  if(value==null) return "—";
  return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(value);
}
function pct(value:number|null|undefined){
  if(value==null) return "—";
  return `${(value*100).toFixed(value>0&&value<.01?2:1)}%`;
}
function shortDate(value:string){
  const d=new Date(value+"T12:00:00Z");
  return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",timeZone:"UTC"}).format(d);
}
function latestByPlatform(rows:any[]){
  const out:Record<string,any>={};
  for(const row of rows||[]){
    const key=String(row.platform||"").toLowerCase();
    if(key && !out[key]) out[key]=row;
  }
  return out;
}

export default async function Performance(){
  const [store, products, social] = await Promise.all([
    getStorePerformance(),
    getStoreProductMetrics(12),
    getSocialPerformance(),
  ]);
  const latest=latestByPlatform(social.accounts as any[]);
  const trendMax=Math.max(1,...store.trend.map(x=>x.sessions));
  const trafficMax=Math.max(1,...store.trafficSources.map(x=>x.sessions));
  const captured=store.analyticsCapturedAt ? new Date(store.analyticsCapturedAt) : null;
  const ageMinutes=captured ? Math.max(0,Math.round((Date.now()-captured.getTime())/60000)) : null;
  const analyticsFresh=ageMinutes!=null && ageMinutes<=90;

  const channels=[
    {key:"instagram",label:"Instagram",status:"Brand analytics connection pending"},
    {key:"tiktok",label:"TikTok",status:"Analytics connection pending"},
    {key:"facebook",label:"Facebook",status:"Publishing connected · insights pending"},
  ];

  return <><Topbar title="Performance"/><div className="page performancePage">
    <div className="performanceHero">
      <div className="sectionIntro">
        <small>STORE + SOCIAL ANALYTICS</small>
        <h2>What people are seeing, clicking, and buying.</h2>
        <p>Track the storefront funnel and social performance in one place. Store traffic is sourced from Shopify; social metrics populate as each brand account is connected.</p>
      </div>
      <div className={`analyticsStatus ${analyticsFresh?"ok":"warn"}`}>
        <span className="statusDot"/>
        <div><b>{store.analyticsSource==="shopifyql"?"Shopify analytics connected":"Analytics connection needed"}</b>
        <small>{captured ? `Last snapshot ${ageMinutes} min ago` : "No ShopifyQL snapshot yet"}</small></div>
      </div>
    </div>

    <section className="performanceKpis" aria-label="Store KPIs">
      <div className="performanceKpi featured"><span>Revenue</span><strong>{money(store.revenue)}</strong><small>Today · live orders</small></div>
      <div className="performanceKpi"><span>Orders</span><strong>{num(store.orders)}</strong><small>Real orders today</small></div>
      <div className="performanceKpi"><span>Sessions</span><strong>{num(store.sessions)}</strong><small>Human storefront visits</small></div>
      <div className="performanceKpi"><span>Visitors</span><strong>{num(store.visitors)}</strong><small>Unique visitors</small></div>
      <div className="performanceKpi"><span>Pageviews</span><strong>{num(store.pageviews)}</strong><small>Store pages viewed</small></div>
      <div className="performanceKpi"><span>Conversion</span><strong>{pct(store.conversion)}</strong><small>Sessions → purchase</small></div>
    </section>

    <div className="performanceGrid">
      <section className="panel performanceTrend">
        <div className="panelHead"><div><small>STORE TRAFFIC</small><h3>Last 7 days</h3></div><span className="metricPill">Sessions</span></div>
        {store.trend.length ? <div className="trendBars">{store.trend.map(point=><div className="trendDay" key={point.day}>
          <div className="trendTrack"><div className="trendFill" style={{height:`${Math.max(3,(point.sessions/trendMax)*100)}%`}}/></div>
          <b>{point.sessions}</b><small>{shortDate(point.day)}</small>
        </div>)}</div> : <div className="performanceEmpty">Traffic history will appear after the Shopify analytics sync is active.</div>}
      </section>

      <section className="panel funnelPanel">
        <div className="panelHead"><div><small>CONVERSION FUNNEL</small><h3>Today</h3></div></div>
        <div className="funnelRows">
          {[
            ["Sessions",store.sessions,1],
            ["Added to cart",store.cartAddSessions,store.sessions?((store.cartAddSessions||0)/store.sessions):0],
            ["Reached checkout",store.checkoutSessions,store.sessions?((store.checkoutSessions||0)/store.sessions):0],
            ["Purchased",store.completedCheckoutSessions,store.sessions?((store.completedCheckoutSessions||0)/store.sessions):0],
          ].map(([label,value,ratio]:any)=><div className="funnelRow" key={label}>
            <div><b>{label}</b><strong>{num(value)}</strong></div>
            <div className="funnelTrack"><span style={{width:`${Math.max(value?4:0,Math.min(100,ratio*100))}%`}}/></div>
          </div>)}
        </div>
        <div className="funnelRates"><span>Add to cart <b>{pct(store.addedToCartRate)}</b></span><span>Reached checkout <b>{pct(store.reachedCheckoutRate)}</b></span></div>
      </section>
    </div>

    <div className="performanceGrid lower">
      <section className="panel">
        <div className="panelHead"><div><small>ACQUISITION</small><h3>Traffic sources</h3></div><span className="metricPill">30D</span></div>
        {store.trafficSources.length ? <div className="sourceRows">{store.trafficSources.map(row=><div className="sourceRow" key={row.source}>
          <div><b>{row.source}</b><small>{num(row.visitors)} visitors</small></div>
          <div className="sourceBar"><span style={{width:`${(row.sessions/trafficMax)*100}%`}}/></div>
          <strong>{num(row.sessions)}</strong>
        </div>)}</div> : <div className="performanceEmpty">Traffic-source data will appear here.</div>}
      </section>

      <section className="panel">
        <div className="panelHead"><div><small>ENTRY PAGES</small><h3>Top landing pages</h3></div><span className="metricPill">30D</span></div>
        {store.landingPages.length ? <div className="landingRows">{store.landingPages.map(row=><div className="landingRow" key={row.path}>
          <div><b>{row.path}</b><small>{num(row.pageviews)} pageviews</small></div><strong>{num(row.sessions)} <em>sessions</em></strong>
        </div>)}</div> : <div className="performanceEmpty">Landing-page performance will appear here.</div>}
      </section>
    </div>

    <section className="panel productPerformancePanel">
      <div className="panelHead"><div><small>PRODUCT PERFORMANCE</small><h3>Views → cart → purchase</h3></div><span className="metricPill">Product detail</span></div>
      {products.length ? <div className="performanceTable">
        <div className="performanceTableHead"><span>Product</span><span>Views</span><span>Sessions</span><span>Cart adds</span><span>Purchases</span><span>Revenue</span></div>
        {products.map((p:any)=><div className="performanceTableRow" key={p.id}><b>{p.product_title}</b><span>{num(p.product_views)}</span><span>{num(p.product_sessions)}</span><span>{num(p.cart_additions)}</span><span>{num(p.purchases)}</span><span>{money(p.revenue==null?null:Number(p.revenue))}</span></div>)}
      </div> : <div className="performanceEmpty productEmpty"><b>Product-view tracking is ready for data.</b><p>The table is built. Exact product-detail views and clicks will populate once the storefront event/pixel pipeline is connected; purchases and revenue can then be tied to the same products.</p></div>}
    </section>

    <div className="socialPerformanceHead">
      <div className="sectionIntro"><small>SOCIAL PERFORMANCE</small><h2>Reach, views, engagement and clicks.</h2><p>Each channel will populate independently as its VIBE & A HALF analytics connection is authorized.</p></div>
    </div>

    <section className="socialMetricCards">
      {channels.map(channel=>{
        const row=latest[channel.key];
        return <div className="socialMetricCard" key={channel.key}>
          <div className="socialMetricTop"><span>{channel.label.slice(0,2).toUpperCase()}</span><div><b>{channel.label}</b><small>{row?"Latest account snapshot":channel.status}</small></div></div>
          <div className="socialMetricGrid"><div><strong>{num(row?.reach)}</strong><small>Reach</small></div><div><strong>{num(row?.views)}</strong><small>Views</small></div><div><strong>{num(row?.engagements)}</strong><small>Engagements</small></div><div><strong>{num(row?.website_clicks)}</strong><small>Site clicks</small></div></div>
        </div>
      })}
    </section>

    <section className="panel topPostsPanel">
      <div className="panelHead"><div><small>CONTENT PERFORMANCE</small><h3>Top posts</h3></div><span className="metricPill">Latest</span></div>
      {social.posts.length ? <div className="performanceTable socialPostsTable">
        <div className="performanceTableHead"><span>Post</span><span>Platform</span><span>Reach</span><span>Views</span><span>Engagement</span><span>Clicks</span></div>
        {social.posts.slice(0,12).map((m:any)=><div className="performanceTableRow" key={m.id}><b>{m.post?.caption?.slice(0,62)||"Published post"}</b><span>{m.platform}</span><span>{num(m.reach)}</span><span>{num(m.views)}</span><span>{num(m.engagements)}</span><span>{num(m.clicks)}</span></div>)}
      </div> : <div className="performanceEmpty productEmpty"><b>No social analytics imported yet.</b><p>Facebook publishing is connected, but post insights are not wired yet. Instagram and TikTok still need the VIBE & A HALF brand accounts authorized before their metrics can flow into this dashboard.</p></div>}
    </section>

    {!analyticsFresh && <div className="analyticsConnectionNote"><b>Next connection step</b><p>The dashboard is built and the first verified ShopifyQL snapshot is loaded. The Make Shopify connection still needs <code>read_reports</code> reauthorization before Vibe OS can refresh sessions, pageviews and conversion automatically.</p></div>}
  </div></>;
}
