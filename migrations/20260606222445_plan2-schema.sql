-- Plan 2 schema: theses, deals, apify_runs, outreach + realtime publish on deal changes.
-- Single-VC v1: RLS left disabled. Server uses the admin key; anon may read/subscribe.

create table public.theses (
  id uuid primary key default gen_random_uuid(),
  sectors text[] not null default '{}',
  stage text not null default '',
  geo text[] not null default '{}',
  check_min bigint,
  check_max bigint,
  signal_weights jsonb not null default '{"money":1,"people":1,"press":1,"archive":1}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid references public.theses(id) on delete set null,
  company text not null,
  company_url text,
  founder text,
  candidate jsonb,
  stage_status text not null default 'queued',
  stage_error text,
  findings jsonb,
  verdict jsonb,
  founder_summary text,
  thesis_fit jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.apify_runs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  actor text not null,
  run_id text,
  status text not null default 'pending',
  dataset_id text,
  created_at timestamptz not null default now()
);

create table public.outreach (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  draft text,
  status text not null default 'draft',
  to_email text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index deals_thesis_id_idx on public.deals (thesis_id);
create index deals_stage_status_idx on public.deals (stage_status);
create index deals_created_at_idx on public.deals (created_at desc);
create index apify_runs_deal_id_idx on public.apify_runs (deal_id);
create index outreach_deal_id_idx on public.outreach (deal_id);

-- Keep deals.updated_at fresh on every update.
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger deals_touch_updated_at
  before update on public.deals
  for each row execute function public.touch_updated_at();

-- Publish a realtime event on the per-deal channel whenever a deal changes.
create or replace function public.notify_deal_change()
returns trigger as $$
begin
  perform realtime.publish(
    'deal:' || new.id::text,
    tg_op || '_deal',
    jsonb_build_object(
      'id', new.id,
      'stage_status', new.stage_status,
      'stage_error', new.stage_error,
      'company', new.company,
      'verdict', new.verdict,
      'thesis_fit', new.thesis_fit,
      'updated_at', new.updated_at
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger deals_realtime_publish
  after insert or update on public.deals
  for each row execute function public.notify_deal_change();

-- Register the per-deal channel pattern so the frontend can subscribe (Plan 3).
insert into realtime.channels (pattern, description, enabled)
values ('deal:%', 'Per-deal stage + verdict updates', true)
on conflict do nothing;
