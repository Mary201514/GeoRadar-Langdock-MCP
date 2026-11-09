import json,csv,collections
from shapely.geometry import shape,Point
from shapely.strtree import STRtree
from shapely.ops import polylabel
plz3=json.load(open('/home/claude/work/plz/plz3.geojson'))['features']
geoms=[shape(f['geometry']) for f in plz3];codes=[f['properties']['plz3'] for f in plz3]
print('codes not 3 digits:',[c for c in codes if not (len(c)==3 and c.isdigit())])
tree=STRtree(geoms)
def area_of(lon,lat):
    p=Point(lon,lat)
    for i in tree.query(p,predicate='intersects'):return int(i)
    return None
# GeoNames Orte (Feature-Klasse P) mit Einwohnern
best={};pnames=set()
with open('/home/claude/work/geonames/DE.txt',encoding='utf8') as fh:
    for row in csv.reader(fh,delimiter='\t',quoting=csv.QUOTE_NONE):
        if row[6]!='P':continue
        pnames.add(row[1]);pnames.update(a for a in row[3].split(',') if a)
        pop=int(row[14] or 0)
        if pop<=0:continue
        lat,lon=float(row[4]),float(row[5]);i=area_of(lon,lat)
        if i is None:continue
        best.setdefault(i,[]).append((pop,row[1],lon,lat,row[7],set([row[1]]+[a for a in row[3].split(',') if a])))
# Fallback: häufigster Ortspunkt der GeoNames-Postleitzahlen
post=collections.defaultdict(collections.Counter)
with open('/home/claude/work/geonames/z/DE.txt',encoding='utf8') as fh:
    for row in csv.reader(fh,delimiter='\t'):
        post[row[1][:3]][(row[2],round(float(row[10]),4),round(float(row[9]),4))]+=1
out=[]
for i,c in enumerate(codes):
    g=geoms[i]
    postal_names=set(n for (n,lo,la) in post[c])
    cands=sorted(best.get(i,[]),key=lambda t:-t[0])
    confirmed=[t for t in cands if t[5]&postal_names]
    pick=confirmed[0] if confirmed else (cands[0] if cands else None)
    if pick:
        pop,name,lon,lat,fc,alts=pick;method='geonames_place' if confirmed else 'geonames_place_unconfirmed'
        de=[n for (n,lo,la),k in post[c].most_common() if n in alts];name=de[0] if de else name
    else:
        method='postal_place';pop=None;name=lon=lat=None
        import re
        bad=re.compile(r'GmbH|\bAG\b|\bKG\b|Agentur|Postfach|Gro.kunde|Verlag|Bank|Versicherung|Finanzamt|Universit|Beh.rde|Amt\b|Bundes|Stiftung|e\.V\.|Sparkasse|Klinik|Service',re.I)
        for (n,lo,la),k in post[c].most_common():
            if bad.search(n) or n not in pnames:continue
            if g.contains(Point(lo,la)):name,lon,lat=n,lo,la;break
        if lon is None:
            p=polylabel(max(g.geoms,key=lambda x:x.area) if g.geom_type=='MultiPolygon' else g,tolerance=0.001);lon,lat=p.x,p.y;name='Flächenmittelpunkt';method='polylabel'
    display=name
    c0=g.centroid
    out.append({'plz3':c,'name':display,'geonames_name':name,'population':pop,'lon':round(lon,6),'lat':round(lat,6),'method':method,'area_km2':round(g.area*111.32*111.32*0.66,1),'centroid_offset_km':round(((lon-c0.x)*75)**2**0.5 if False else (((lon-c0.x)*75)**2+((lat-c0.y)*111.2)**2)**0.5,1)})
json.dump(out,open('/home/claude/work/matrix/centers.json','w'),ensure_ascii=False,indent=0)
print(collections.Counter(o['method'] for o in out))
for o in sorted(out,key=lambda o:o['population'] or 0)[:8]:print(o)
for c in ['101','803','880','889','014']:print([o for o in out if o['plz3']==c])
