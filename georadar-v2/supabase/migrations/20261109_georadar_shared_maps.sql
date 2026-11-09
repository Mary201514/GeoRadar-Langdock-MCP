-- GeoRadar 4: geteilte Karten mit kryptischem Link, Punkte und Geocoding-Cache.
-- Additiv: bestehende Tabellen (georadar_research_runs, georadar_saved_views, ...) bleiben unverändert.
-- Zugriff ausschließlich serverseitig über service_role (Vercel-Funktionen). Kein anon/authenticated-Zugriff.
begin;

create table if not exists public.georadar_maps (
  id uuid primary key default gen_random_uuid(),
  -- Zufälliger Link-Schlüssel (mind. 128 Bit). Wer den Link kennt, sieht die Karte.
  share_key text not null unique check (share_key ~ '^[A-Za-z0-9_-]{22,64}$'),
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.georadar_map_points (
  map_id uuid not null references public.georadar_maps(id) on delete cascade,
  point_id text not null check (char_length(point_id) between 1 and 300),
  -- Geprüfter Datensatz im Format mangold-georadar/companies/v1 (inkl. type, address, attributes).
  record jsonb not null check (jsonb_typeof(record) = 'object') check (octet_length(record::text) <= 60000),
  -- pending = Adresse wartet auf Geocoding, ok = Position vorhanden, not_found = Adresse nicht gefunden, none = weder Adresse noch Position
  geocode_status text not null default 'none' check (geocode_status in ('pending','ok','not_found','none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (map_id, point_id)
);
create index if not exists georadar_map_points_pending on public.georadar_map_points (map_id) where geocode_status = 'pending';

create table if not exists public.georadar_geocode_cache (
  query_hash text primary key check (query_hash ~ '^[a-f0-9]{64}$'),
  query text not null check (char_length(query) <= 1000),
  status text not null check (status in ('ok','not_found')),
  lon double precision,
  lat double precision,
  formatted_address text,
  source text not null default 'serpapi:google_maps',
  created_at timestamptz not null default now(),
  check (status <> 'ok' or (lon between -180 and 180 and lat between -90 and 90))
);

alter table public.georadar_maps enable row level security;
alter table public.georadar_map_points enable row level security;
alter table public.georadar_geocode_cache enable row level security;

revoke all on table public.georadar_maps, public.georadar_map_points, public.georadar_geocode_cache from public, anon, authenticated;
revoke all on table public.georadar_maps, public.georadar_map_points, public.georadar_geocode_cache from service_role;
grant select, insert, update on table public.georadar_maps to service_role;
grant select, insert, update, delete on table public.georadar_map_points to service_role;
grant select, insert, update on table public.georadar_geocode_cache to service_role;

comment on table public.georadar_maps is 'GeoRadar 4: geteilte Karten. share_key ist das Link-Geheimnis; nur serverseitig lesbar.';
comment on table public.georadar_map_points is 'GeoRadar 4: Punkte je Karte, per MCP-Bulk geschrieben.';
comment on table public.georadar_geocode_cache is 'GeoRadar 4: Ergebnisse der Adresssuche (SerpApi), damit jede Adresse nur einmal abgefragt wird.';

commit;
