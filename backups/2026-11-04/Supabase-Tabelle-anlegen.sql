begin;
create table if not exists public.georadar_research_runs (
 code text primary key check (code ~ '^[A-Z][A-Z0-9-]{2,31}$'),
 title text not null check (char_length(title) between 1 and 160),
 payload jsonb not null check (jsonb_typeof(payload) = 'object') check (payload ? 'records')
   check (jsonb_typeof(payload->'records') = 'array')
   check (jsonb_array_length(payload->'records') <= 10000)
   check (octet_length(payload::text) <= 2200000),
 digest text not null check (digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
alter table public.georadar_research_runs enable row level security;
revoke all on table public.georadar_research_runs from public, anon, authenticated;
revoke all on table public.georadar_research_runs from service_role;
grant select, insert on table public.georadar_research_runs to service_role;
comment on table public.georadar_research_runs is 'GeoRadar research runs. Server-side service access only. Codes are identifiers, not access secrets. Existing codes are never overwritten by the API.';
commit;
