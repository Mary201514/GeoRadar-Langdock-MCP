"""Erzeugt ein einziges SQL-Skript für den Supabase SQL Editor: geteilte Karten + PLZ3-Zentren + Fahrzeitmatrix."""
import json, numpy as np, datetime

REPO = '/home/claude/work/repo/georadar-v2'
centers = json.load(open('/home/claude/work/matrix/centers.json'))
z = np.load('/home/claude/work/matrix/matrix.npz')
M, snap = z['M'], z['snap_km']
codes = [str(c) for c in z['codes']]
assert codes == [c['plz3'] for c in centers]
order = sorted(range(len(codes)), key=lambda i: codes[i])
codes = [codes[i] for i in order]; centers = [centers[i] for i in order]
M = M[np.ix_(order, order)]; snap = snap[order]
assert np.isfinite(M).all(), 'nicht erreichbare Paare'
S = np.rint(M).astype(int)

def q(v):
    return 'null' if v is None else "'" + str(v).replace("'", "''") + "'"

shared = open(REPO + '/supabase/migrations/20261109_georadar_shared_maps.sql').read()
shared = shared.replace('begin;\n', '').replace('\ncommit;\n', '\n')

out = []
out.append(f"""-- =====================================================================================
-- Mangold GeoRadar 4 – komplettes Setup für den Supabase SQL Editor
-- Erstellt {datetime.date.today():%d.%m.%Y}. Einmal vollständig ausführen (Run). Wiederholbar: Tabellen werden nur
-- angelegt, wenn sie fehlen; die PLZ3-Daten werden bei jedem Lauf vollständig neu geschrieben.
-- Bestehende Tabellen (georadar_research_runs, georadar_saved_views, …) bleiben unverändert.
--
--  Teil 1  Geteilte Karten: georadar_maps, georadar_map_points, georadar_geocode_cache
--  Teil 2  PLZ3-Zentren:    georadar_plz3_zentren   ({len(codes)} dreistellige PLZ-Bereiche mit Ortszentrum)
--  Teil 3  Fahrzeiten:      georadar_plz3_fahrzeiten ({len(codes)**2:,} Paare, Pkw, freie Fahrt)
-- =====================================================================================
begin;

-- ---------- Teil 1: geteilte Karten ----------
{shared.strip()}

-- ---------- Teil 2: PLZ3-Zentren ----------
create table if not exists public.georadar_plz3_zentren (
  plz3 text primary key check (plz3 ~ '^[0-9]{{3}}$'),
  ort text not null,
  lon double precision not null,
  lat double precision not null,
  einwohner integer,
  methode text not null check (methode in ('geonames_place','geonames_place_unconfirmed','postal_place','polylabel')),
  abstand_flaechenmitte_km numeric(6,1),
  abstand_strassennetz_km numeric(6,2)
);
comment on table public.georadar_plz3_zentren is 'Bezugspunkt je dreistelligem PLZ-Bereich: Zentrum des einwohnerstärksten Orts im Bereich (GeoNames, bestätigt über die Ortsnamen der Postleitzahlen). methode: geonames_place = größter Ort, durch PLZ-Ortsliste bestätigt; geonames_place_unconfirmed = größter Ort/Stadtteil ohne eigene Nennung in der PLZ-Liste (meist Großstadt-Stadtteile); postal_place = Ortspunkt der GeoNames-Postleitzahl. Quellen: GeoNames (CC BY 4.0), PLZ-Flächen OpenStreetMap (ODbL).';

-- ---------- Teil 3: Fahrzeiten ----------
create table if not exists public.georadar_plz3_fahrzeiten (
  von_plz3 text not null references public.georadar_plz3_zentren(plz3) on delete cascade,
  nach_plz3 text not null references public.georadar_plz3_zentren(plz3) on delete cascade,
  fahrzeit_s integer not null check (fahrzeit_s >= 0),
  fahrzeit_mittel_s integer,
  luftlinie_km numeric(7,1),
  primary key (von_plz3, nach_plz3)
);
create index if not exists georadar_plz3_fahrzeiten_nach on public.georadar_plz3_fahrzeiten (nach_plz3, von_plz3);
comment on table public.georadar_plz3_fahrzeiten is 'Pkw-Fahrzeit zwischen den Zentren zweier dreistelliger PLZ-Bereiche bei freier Fahrt (kein Verkehr). fahrzeit_s = Richtung von→nach, fahrzeit_mittel_s = Mittel aus Hin- und Rückweg. Berechnet aus OpenStreetMap (Stand {datetime.date.today():%d.%m.%Y}, ODbL): Straßen von Autobahn bis Kreisstraße, Geschwindigkeit nach Tempolimit bzw. Straßenklasse, plus Zufahrt vom Ortszentrum zum Netz (30 km/h). Fähren und Autozüge sind nicht enthalten (z. B. Weser-Querungen länger als mit Fähre; Sylt/259 nur über die Zufahrt zum Festland angenähert, siehe abstand_strassennetz_km). Eher vorsichtig gerechnet; für Planung und Vergleich gedacht, nicht minutengenau.';

alter table public.georadar_plz3_zentren enable row level security;
alter table public.georadar_plz3_fahrzeiten enable row level security;
revoke all on table public.georadar_plz3_zentren, public.georadar_plz3_fahrzeiten from public, anon, authenticated;
grant select, insert, update, delete on table public.georadar_plz3_zentren, public.georadar_plz3_fahrzeiten to service_role;

-- Bequem abfragen, auch mit 5-stelliger PLZ: select * from public.georadar_fahrzeit('88046','80331');
create or replace function public.georadar_fahrzeit(von text, nach text)
returns table (von_plz3 text, von_ort text, nach_plz3 text, nach_ort text, fahrzeit_min numeric, fahrzeit_mittel_min numeric, luftlinie_km numeric)
language sql stable security invoker set search_path = public as $$
  select f.von_plz3, a.ort, f.nach_plz3, b.ort, round(f.fahrzeit_s/60.0,1), round(f.fahrzeit_mittel_s/60.0,1), f.luftlinie_km
  from public.georadar_plz3_fahrzeiten f
  join public.georadar_plz3_zentren a on a.plz3=f.von_plz3
  join public.georadar_plz3_zentren b on b.plz3=f.nach_plz3
  where f.von_plz3=left(regexp_replace(von,'\\D','','g'),3) and f.nach_plz3=left(regexp_replace(nach,'\\D','','g'),3)
$$;
revoke all on function public.georadar_fahrzeit(text,text) from public, anon, authenticated;
grant execute on function public.georadar_fahrzeit(text,text) to service_role;

-- Daten neu schreiben
delete from public.georadar_plz3_fahrzeiten;
delete from public.georadar_plz3_zentren;
insert into public.georadar_plz3_zentren (plz3, ort, lon, lat, einwohner, methode, abstand_flaechenmitte_km, abstand_strassennetz_km) values""")
out.append(',\n'.join(f"({q(c['plz3'])},{q(c['name'])},{c['lon']},{c['lat']},{c['population'] if c['population'] else 'null'},{q(c['method'])},{c['centroid_offset_km']},{snap[i]:.2f})" for i, c in enumerate(centers)) + ';')
out.append(f"""
-- Matrix kompakt: je Startbereich eine Zeile mit {len(codes)} Fahrzeiten in Sekunden (Reihenfolge = ziele)
with ziele as (select array[{','.join(q(c) for c in codes)}]::text[] as plz),
zeilen(von_plz3, sekunden) as (values""")
out.append(',\n'.join(f"({q(codes[i])},'{{{','.join(map(str, S[i]))}}}'::int[])" for i in range(len(codes))))
out.append(""")
insert into public.georadar_plz3_fahrzeiten (von_plz3, nach_plz3, fahrzeit_s)
select z.von_plz3, ziele.plz[u.i], u.s
from zeilen z cross join ziele cross join lateral unnest(z.sekunden) with ordinality as u(s, i);

update public.georadar_plz3_fahrzeiten f
set fahrzeit_mittel_s = round((f.fahrzeit_s + r.fahrzeit_s) / 2.0),
    luftlinie_km = round((2 * 6371 * asin(sqrt(power(sin(radians(b.lat - a.lat) / 2), 2) + cos(radians(a.lat)) * cos(radians(b.lat)) * power(sin(radians(b.lon - a.lon) / 2), 2))))::numeric, 1)
from public.georadar_plz3_fahrzeiten r, public.georadar_plz3_zentren a, public.georadar_plz3_zentren b
where r.von_plz3 = f.nach_plz3 and r.nach_plz3 = f.von_plz3 and a.plz3 = f.von_plz3 and b.plz3 = f.nach_plz3;

commit;

-- Kontrolle (optional, nach dem Lauf):
-- select count(*) from public.georadar_plz3_zentren;            -- erwartet """ + str(len(codes)) + """
-- select count(*) from public.georadar_plz3_fahrzeiten;         -- erwartet """ + f"{len(codes)**2}" + """
-- select * from public.georadar_fahrzeit('88046','80331');       -- Friedrichshafen → München
""")
path = '/home/claude/work/matrix/GeoRadar4-Supabase-komplett.sql'
open(path, 'w').write('\n'.join(out))
import os; print(path, os.path.getsize(path))
