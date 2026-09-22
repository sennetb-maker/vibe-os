create extension if not exists "pgcrypto";

create table if not exists agents (
  id text primary key,
  name text not null,
  purpose text,
  make_scenario_id bigint,
  status text not null default 'active',
  created_at timestamptz default now()
);

create table if not exists content_assets (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  media_type text,
  status text not null default 'inbox',
  product_name text,
  garment_color text,
  setting text,
  orientation text,
  ai_description text,
  agent_notes text,
  drive_file_id text,
  source text not null default 'supabase',
  posted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table content_assets add column if not exists drive_file_id text;
alter table content_assets add column if not exists source text not null default 'supabase';
alter table content_assets add column if not exists agent_notes text;
alter table content_assets add column if not exists archived_at timestamptz;
alter table content_assets add column if not exists updated_at timestamptz default now();
alter table content_assets alter column status set default 'inbox';

-- Existing Vibe OS uploads were raw source assets even though the old UI called them "Ready to Post".
update content_assets set status='inbox', updated_at=now() where status in ('ready','review');

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  asset_id uuid references content_assets(id) on delete set null,
  caption text,
  post_type text not null default 'image',
  cta text,
  destination_url text,
  product_name text,
  agent_notes text,
  rendered_asset_path text,
  status text not null default 'working',
  external_post_id text,
  scheduled_for timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table social_posts add column if not exists post_type text not null default 'image';
alter table social_posts add column if not exists cta text;
alter table social_posts add column if not exists destination_url text;
alter table social_posts add column if not exists product_name text;
alter table social_posts add column if not exists agent_notes text;
alter table social_posts add column if not exists rendered_asset_path text;
alter table social_posts add column if not exists approved_at timestamptz;
alter table social_posts add column if not exists updated_at timestamptz default now();
alter table social_posts alter column status set default 'working';

-- A social post can use multiple raw assets (carousel, stitched reel, slideshow, etc.).
create table if not exists social_post_assets (
  post_id uuid not null references social_posts(id) on delete cascade,
  asset_id uuid not null references content_assets(id) on delete restrict,
  sort_order integer not null default 0,
  role text not null default 'source',
  created_at timestamptz default now(),
  primary key (post_id, asset_id)
);

create table if not exists creative_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text,
  source_agent text,
  status text not null default 'review',
  notes text,
  created_at timestamptz default now()
);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists content_assets_status_created_idx on content_assets(status, created_at desc);
create index if not exists social_posts_schedule_idx on social_posts(status, scheduled_for);
create index if not exists social_post_assets_asset_idx on social_post_assets(asset_id, created_at desc);
create index if not exists approvals_status_created_idx on approvals(status, created_at desc);
create index if not exists activity_log_created_idx on activity_log(created_at desc);
create index if not exists chat_messages_agent_created_idx on chat_messages(agent_id, created_at);

alter table agents enable row level security;
alter table content_assets enable row level security;
alter table social_posts enable row level security;
alter table social_post_assets enable row level security;
alter table creative_assets enable row level security;
alter table approvals enable row level security;
alter table activity_log enable row level security;
alter table chat_messages enable row level security;

-- Vibe OS uses the server-side service role only. No anonymous table policies are created.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-content',
  'social-content',
  false,
  52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into agents (id,name,purpose,make_scenario_id,status) values
('ceo','CEO Agent','Cross-functional business readout and priorities',6314159,'active'),
('social','Social Media Manager','Organic planning, captions, publishing and community',6333452,'active'),
('meta','Meta Growth','Paid-social planning and performance analysis',6312244,'active'),
('artwork','Artwork Designer','Apparel artwork generation workflow',6302036,'active'),
('product','Product Builder','Printify product-building workflow',6296470,'active'),
('merch','Merchandising + QA','Shopify merchandising and premium QA',6310648,'active'),
('support','Customer Service','Support triage and Gmail draft responses',6311362,'active'),
('retention','Retention','Customer retention and lifecycle opportunities',6312145,'active')
on conflict (id) do update set
  name=excluded.name,
  purpose=excluded.purpose,
  make_scenario_id=excluded.make_scenario_id,
  status=excluded.status;