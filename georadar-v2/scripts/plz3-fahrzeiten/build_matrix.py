"""PLZ3-Fahrzeitmatrix: OSM-Straßennetz (Autobahn bis Kreisstraße) -> gerichteter Graph -> Dijkstra je Zentrum."""
import sys, json, re, time, math
import numpy as np, osmium
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra, connected_components
from scipy.spatial import cKDTree

PBF = sys.argv[1]
OUT = sys.argv[2]
CENTERS = json.load(open('/home/claude/work/matrix/centers.json'))

# Reisegeschwindigkeiten km/h (angelehnt an das OSRM-Pkw-Profil, Autobahn etwas höher für DE)
SPEED = {'motorway': 100, 'motorway_link': 45, 'trunk': 85, 'trunk_link': 40, 'primary': 65, 'primary_link': 30,
         'secondary': 55, 'secondary_link': 25, 'tertiary': 40, 'tertiary_link': 20, 'unclassified': 25}
BAD_ACCESS = {'no', 'private', 'agricultural', 'forestry', 'delivery', 'destination_only'}

def maxspeed(v):
    if not v: return None
    v = v.strip().lower()
    if v in ('none', 'signals', 'variable'): return None
    if v.endswith(':urban') or v == 'de:urban': return 50
    if v.endswith(':rural') or v == 'de:rural': return 100
    if v.endswith(':motorway'): return None
    m = re.match(r'^(\d+)', v)
    if not m: return None
    n = int(m.group(1))
    return n * 1.609 if 'mph' in v else n

t0 = time.time()
ways = []  # (refs np.array, speed, oneway: 0 both, 1 forward, -1 backward)
needed = []
fp = osmium.FileProcessor(PBF, osmium.osm.WAY).with_filter(osmium.filter.KeyFilter('highway'))
for w in fp:
    hw = w.tags.get('highway')
    if hw not in SPEED: continue
    if w.tags.get('access') in BAD_ACCESS or w.tags.get('motor_vehicle') in BAD_ACCESS or w.tags.get('motorcar') in BAD_ACCESS: continue
    if w.tags.get('area') == 'yes': continue
    sp = SPEED[hw]
    ms = maxspeed(w.tags.get('maxspeed'))
    if ms: sp = min(sp, ms * 0.85) if hw.startswith('motorway') else min(max(sp * 0.6, ms * 0.8), ms)
    ow = w.tags.get('oneway')
    one = -1 if ow == '-1' else 1 if (ow in ('yes', 'true', '1') or hw in ('motorway', 'motorway_link') or w.tags.get('junction') == 'roundabout') else 0
    if ow == 'no': one = 0
    refs = np.fromiter((n.ref for n in w.nodes), dtype=np.int64)
    if len(refs) < 2: continue
    ways.append((refs, sp, one)); needed.append(refs)
print('ways', len(ways), round(time.time() - t0), 's', flush=True)

allrefs = np.concatenate(needed); del needed
ids, counts = np.unique(allrefs, return_counts=True); del allrefs
keep = counts > 1
for refs, sp, one in ways:
    keep[np.searchsorted(ids, refs[0])] = True; keep[np.searchsorted(ids, refs[-1])] = True
del counts
print('nodes needed', len(ids), 'kept (Kreuzungen/Enden)', int(keep.sum()), flush=True)
lon = np.full(len(ids), np.nan, dtype=np.float32); lat = np.full(len(ids), np.nan, dtype=np.float32)
fp = osmium.FileProcessor(PBF, osmium.osm.NODE).with_filter(osmium.filter.IdFilter(ids.tolist()))
for n in fp:
    i = np.searchsorted(ids, n.id)
    lon[i] = n.location.lon; lat[i] = n.location.lat
print('coords', int(np.isfinite(lon).sum()), round(time.time() - t0), 's', flush=True)
kept_idx = np.cumsum(keep) - 1  # alter Index -> neuer Index
src = []; dst = []; cost = []
for refs, sp, one in ways:
    idx = np.searchsorted(ids, refs)
    ok = np.isfinite(lon[idx])
    idx = idx[ok]
    if len(idx) < 2: continue
    la = lat[idx].astype(np.float64); lo = lon[idx].astype(np.float64)
    seg = np.hypot((lo[1:] - lo[:-1]) * np.cos(np.radians((la[1:] + la[:-1]) / 2)) * 111320, (la[1:] - la[:-1]) * 110540) / (sp / 3.6)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    kpos = np.where(keep[idx])[0]
    if kpos[0] != 0: kpos = np.concatenate([[0], kpos])
    if kpos[-1] != len(idx) - 1: kpos = np.concatenate([kpos, [len(idx) - 1]])
    a = kept_idx[idx[kpos[:-1]]]; b = kept_idx[idx[kpos[1:]]]; c = cum[kpos[1:]] - cum[kpos[:-1]]
    if one >= 0: src.append(a); dst.append(b); cost.append(c)
    if one <= 0: src.append(b); dst.append(a); cost.append(c)
del ways
lon = lon[keep].astype(np.float64); lat = lat[keep].astype(np.float64); del ids, keep, kept_idx
src = np.concatenate(src); dst = np.concatenate(dst); cost = np.concatenate(cost) + 1e-3
N = len(lon)
G = csr_matrix((cost, (src, dst)), shape=(N, N)); del src, dst, cost
G.sum_duplicates()
print('contracted nodes', N, 'edges', G.nnz, round(time.time() - t0), 's', flush=True)

# größte stark zusammenhängende Komponente
ncomp, label = connected_components(G, directed=True, connection='strong')
main = np.bincount(label).argmax(); inmain = label == main
print('main component nodes', int(inmain.sum()), 'of', N, flush=True)

cand = np.where(inmain & np.isfinite(lon))[0]
xy = np.column_stack([lon[cand] * np.cos(np.radians(51)) * 111.32, lat[cand] * 110.54])
tree = cKDTree(xy)
snap = []
for c in CENTERS:
    d, j = tree.query([c['lon'] * np.cos(np.radians(51)) * 111.32, c['lat'] * 110.54])
    snap.append((int(cand[j]), float(d)))
access = np.array([d * 1.3 / 30 * 3600 for _, d in snap])  # Zufahrt Zentrum -> Netz, 30 km/h, Umwegfaktor 1.3
nodes = np.array([n for n, _ in snap])

K = len(CENTERS)
M = np.zeros((K, K), dtype=np.float64)
B = 4
for start in range(0, K, B):
    part = nodes[start:start + B]
    dist = dijkstra(G, directed=True, indices=part)
    M[start:start + B] = dist[:, nodes]
    del dist
    print('dijkstra', start + len(part), '/', K, round(time.time() - t0), 's', flush=True)
M = M + access[:, None] + access[None, :]
np.fill_diagonal(M, 0)
# Luftlinie für Plausibilitätsprüfung
lo = np.array([c['lon'] for c in CENTERS]); la = np.array([c['lat'] for c in CENTERS])
dx = (lo[None, :] - lo[:, None]) * np.cos(np.radians((la[None, :] + la[:, None]) / 2)) * 111.32
dy = (la[None, :] - la[:, None]) * 110.54
air = np.hypot(dx, dy)
np.savez_compressed(OUT, M=M, air=air, snap_km=np.array([d for _, d in snap]), codes=np.array([c['plz3'] for c in CENTERS]))
print('done', round(time.time() - t0), 's', 'inf:', int(np.isinf(M).sum()), flush=True)
