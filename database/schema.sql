-- NetPulse Maroc database schema (PostgreSQL / Supabase)
-- Run this whole file once in Supabase: SQL Editor > New query > paste > Run.
-- It is safe to run again: it only creates what is missing.

-- ---------- Zones (neighbourhoods) ----------
create table if not exists zones (
  id    serial primary key,
  city  text not null,
  name  text not null,
  unique (city, name)
);
insert into zones (city, name) values
  ('Agadir', 'Hay Mohammadi'),
  ('Agadir', 'Dakhla'),
  ('Agadir', 'Talborjt')
on conflict do nothing;

-- ---------- Measurements (speed test results: strong evidence) ----------
create table if not exists measurements (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  zone_id         int not null references zones(id),
  operator        text not null check (operator in ('maroc_telecom','orange','inwi')),
  connection_type text not null check (connection_type in ('fibre','adsl','4g_home','mobile_4g','5g')),
  network_path    text not null default 'unknown' check (network_path in ('wifi','ethernet','unknown')),
  download_mbps   real not null check (download_mbps between 0 and 10000),
  upload_mbps     real not null check (upload_mbps   between 0 and 10000),
  ping_ms         real not null check (ping_ms       between 0 and 5000),
  jitter_ms       real check (jitter_ms between 0 and 5000),
  device_token    text
);
create index if not exists measurements_zone_time on measurements (zone_id, created_at desc);

-- ---------- Reports (user complaints: weaker evidence) ----------
-- lat/lng are already snapped to a ~500 m grid by the API; exact positions are never stored.
create table if not exists reports (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  lat             double precision not null check (lat between 20.5 and 36.1),
  lng             double precision not null check (lng between -17.3 and -0.9),
  operator        text not null check (operator in ('maroc_telecom','orange','inwi')),
  connection_type text not null check (connection_type in ('fibre','adsl','4g_home','mobile_4g','5g')),
  issue_type      text not null check (issue_type in ('no_internet','very_slow','disconnects','high_ping','mobile_signal')),
  started         text not null default 'now' check (started in ('now','hour','today','days')),
  scope           text not null default 'unknown' check (scope in ('just_me','building','neighbourhood','unknown')),
  device_token    text not null
);
create index if not exists reports_time on reports (created_at desc);
create index if not exists reports_device on reports (device_token, operator, created_at desc);

-- ---------- Statistics: medians per zone, operator, connection and time of day ----------
create or replace function zone_stats(p_zone_id int, p_days int default 30)
returns table (
  operator text, connection_type text, time_bucket text,
  tests bigint, median_down double precision, median_up double precision, median_ping double precision
)
language sql stable as $$
  select
    m.operator, m.connection_type,
    case
      when extract(hour from m.created_at at time zone 'Africa/Casablanca') between 6  and 11 then 'morning'
      when extract(hour from m.created_at at time zone 'Africa/Casablanca') between 12 and 18 then 'afternoon'
      when extract(hour from m.created_at at time zone 'Africa/Casablanca') between 19 and 22 then 'evening'
      else 'night'
    end as time_bucket,
    count(*),
    percentile_cont(0.5) within group (order by m.download_mbps),
    percentile_cont(0.5) within group (order by m.upload_mbps),
    percentile_cont(0.5) within group (order by m.ping_ms)
  from measurements m
  where m.zone_id = p_zone_id
    and m.created_at > now() - make_interval(days => p_days)
  group by 1, 2, 3
  order by 1, 2, 3;
$$;

-- ---------- Security ----------
-- Row Level Security ON with NO policies = the public/anon key can read and write nothing.
-- Only your backend (which uses the secret service_role key) can touch the data.
alter table zones        enable row level security;
alter table measurements enable row level security;
alter table reports      enable row level security;

revoke all on function zone_stats(int, int) from public, anon, authenticated;
grant execute on function zone_stats(int, int) to service_role;