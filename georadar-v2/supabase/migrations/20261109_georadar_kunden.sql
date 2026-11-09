-- =====================================================================================
-- Mangold GeoRadar – Bestandskundenliste mit semantischer Suche
-- Migration: Tabelle, Indizes und Funktionen der Bestandskundenliste. Die Kundendaten selbst liegen NICHT im Repository.
-- Erstellt 09.11.2026. Quelle: Mangold_Kundenstamm_LeadRadar_GeoRadar_3_1.xlsx, Blatt Kundenstamm_3_0 (1.040 Sätze:
-- 1.000 aus Vorlage, ungeprüft gegen ERP; 40 fiktive Testdatensätze, ist_fiktiv = true).
-- Wiederholbar: Tabellen/Funktionen werden nur angelegt bzw. ersetzt, Daten per id aktualisiert.
-- Embeddings (1536 Dim., text-embedding-ada-002 über die Langdock-API, EU) füllt der Server nach
-- (MCP-Werkzeug kunden_embeddings_aktualisieren). Zugriff nur serverseitig (service_role).
-- =====================================================================================
create extension if not exists vector with schema extensions;
set search_path = public, extensions;

create table if not exists public.georadar_kunden (
  id text primary key check (char_length(id) between 1 and 100),
  erp_kundennummer text,
  firmenname text not null,
  plz text not null,
  ort text not null,
  land text not null,
  vertreter text,
  vertriebsgebiet text,
  kundenstatus text not null,
  ist_fiktiv boolean not null default false,
  lon double precision,
  lat double precision,
  positionsquelle text,
  daten jsonb not null,
  record jsonb not null,
  such_text text not null,
  such_tsv tsvector generated always as (to_tsvector('german', such_text)) stored,
  embedding vector(1536),
  embedding_modell text,
  embedding_text_hash text,
  embedding_am timestamptz,
  quelle text,
  importiert_am timestamptz not null default now(),
  aktualisiert_am timestamptz not null default now()
);
create index if not exists georadar_kunden_embedding on public.georadar_kunden using hnsw (embedding vector_cosine_ops);
create index if not exists georadar_kunden_such_tsv on public.georadar_kunden using gin (such_tsv);
create index if not exists georadar_kunden_plz on public.georadar_kunden (plz);
create index if not exists georadar_kunden_erp on public.georadar_kunden (erp_kundennummer);

comment on table public.georadar_kunden is 'Bestandskundenliste Mangold (Kundenstamm 3.1). daten = alle Originalspalten, record = GeoRadar-Kartenformat, such_text = Grundlage für Embedding und Volltextsuche. Positionen ungefähr (PLZ-Gebiet bzw. Ortsmitte). Vertreter sind Test-/Altzuordnungen, nicht ERP-bestätigt.';

alter table public.georadar_kunden enable row level security;
revoke all on table public.georadar_kunden from public, anon, authenticated;
grant select, insert, update, delete on table public.georadar_kunden to service_role;

-- Semantische Suche: Ähnlichkeit 0–1 (Kosinus), höchstens 200 Treffer
create or replace function public.georadar_kunden_suche(abfrage vector(1536), anzahl integer default 20, mit_fiktiven boolean default false)
returns table (id text, firmenname text, plz text, ort text, land text, vertreter text, kundenstatus text, ist_fiktiv boolean, aehnlichkeit double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select k.id, k.firmenname, k.plz, k.ort, k.land, k.vertreter, k.kundenstatus, k.ist_fiktiv, 1 - (k.embedding <=> abfrage)
  from public.georadar_kunden k
  where k.embedding is not null and (mit_fiktiven or not k.ist_fiktiv)
  order by k.embedding <=> abfrage
  limit least(greatest(coalesce(anzahl, 20), 1), 200)
$$;

-- Volltextsuche als Ergänzung (ohne Embeddings nutzbar)
create or replace function public.georadar_kunden_volltext(suchtext text, anzahl integer default 20, mit_fiktiven boolean default false)
returns table (id text, firmenname text, plz text, ort text, land text, vertreter text, kundenstatus text, ist_fiktiv boolean, rang real)
language sql stable security invoker set search_path = public, extensions as $$
  select k.id, k.firmenname, k.plz, k.ort, k.land, k.vertreter, k.kundenstatus, k.ist_fiktiv, ts_rank(k.such_tsv, websearch_to_tsquery('german', suchtext))
  from public.georadar_kunden k
  where k.such_tsv @@ websearch_to_tsquery('german', suchtext) and (mit_fiktiven or not k.ist_fiktiv)
  order by 9 desc
  limit least(greatest(coalesce(anzahl, 20), 1), 200)
$$;

-- Embeddings setzen: [{"id":"…","embedding":[…1536…],"modell":"…","hash":"<md5 des such_text>"}]
create or replace function public.georadar_kunden_embeddings_setzen(daten jsonb)
returns integer language plpgsql security invoker set search_path = public, extensions as $$
declare n integer;
begin
  update public.georadar_kunden k
     set embedding = (e->>'embedding')::vector, embedding_modell = e->>'modell', embedding_text_hash = e->>'hash', embedding_am = now()
    from jsonb_array_elements(daten) e
   where k.id = e->>'id' and md5(k.such_text) = e->>'hash';
  get diagnostics n = row_count;
  return n;
end $$;

-- Sätze ohne aktuelles Embedding (fehlend oder Text seitdem geändert)
create or replace function public.georadar_kunden_ohne_embedding(anzahl integer default 100)
returns table (id text, such_text text, hash text)
language sql stable security invoker set search_path = public, extensions as $$
  select k.id, k.such_text, md5(k.such_text) from public.georadar_kunden k
  where k.embedding is null or k.embedding_text_hash is distinct from md5(k.such_text)
  order by k.id limit least(greatest(coalesce(anzahl, 100), 1), 500)
$$;

revoke all on function public.georadar_kunden_suche(vector, integer, boolean), public.georadar_kunden_volltext(text, integer, boolean),
  public.georadar_kunden_embeddings_setzen(jsonb), public.georadar_kunden_ohne_embedding(integer) from public, anon, authenticated;
grant execute on function public.georadar_kunden_suche(vector, integer, boolean), public.georadar_kunden_volltext(text, integer, boolean),
  public.georadar_kunden_embeddings_setzen(jsonb), public.georadar_kunden_ohne_embedding(integer) to service_role;
