begin;
create table public.georadar_saved_views (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 160),
 kind text not null check (kind in ('view','research')),
 view_config jsonb not null check (jsonb_typeof(view_config)='object' and octet_length(view_config::text)<=100000),
 dataset jsonb check (dataset is null or (jsonb_typeof(dataset)='object' and jsonb_typeof(dataset->'records')='array' and jsonb_array_length(dataset->'records')<=10000 and octet_length(dataset::text)<=2200000)),
 record_count integer not null check (record_count between 0 and 10000),
 data_digest text not null check (data_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now(),
 check ((kind='view' and dataset is null and record_count=0) or (kind='research' and dataset is not null and record_count=jsonb_array_length(dataset->'records')))
);
create index georadar_saved_views_owner_created_idx on public.georadar_saved_views(owner_id,created_at desc,id);
alter table public.georadar_saved_views enable row level security;
revoke all on public.georadar_saved_views from public,anon,authenticated,service_role;
grant select,insert on public.georadar_saved_views to authenticated,service_role;
create policy georadar_saved_views_owner_read on public.georadar_saved_views for select to authenticated using ((select auth.uid())=owner_id);
create policy georadar_saved_views_owner_insert on public.georadar_saved_views for insert to authenticated with check ((select auth.uid())=owner_id);
comment on table public.georadar_saved_views is 'Private immutable named view/research snapshots, owner-only; view IDs are not authorization credentials.';
create table public.georadar_web_sessions (
 session_hash text primary key check (session_hash ~ '^[a-f0-9]{64}$'),
 owner_id uuid not null references auth.users(id) on delete cascade,
 token_ciphertext text not null check (char_length(token_ciphertext) between 20 and 8192),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index georadar_web_sessions_expires_idx on public.georadar_web_sessions(expires_at);
create index georadar_web_sessions_owner_idx on public.georadar_web_sessions(owner_id);
alter table public.georadar_web_sessions enable row level security;
revoke all on public.georadar_web_sessions from public,anon,authenticated,service_role;
grant select,insert,delete on public.georadar_web_sessions to service_role;
comment on table public.georadar_web_sessions is 'Server-only hashed opaque sessions; Auth access tokens encrypted, passwords/refresh tokens never persisted. Maximum lifetime one hour.';
commit;
