"""Build schematic two-digit postal reference points, never postal boundaries."""
import io, json, pathlib, urllib.request, zipfile

root = pathlib.Path(__file__).resolve().parents[1]
result = {}
for country in ('DE', 'AT'):
    url = f'https://download.geonames.org/export/zip/{country}.zip'
    with urllib.request.urlopen(url, timeout=45) as response:
        archive = zipfile.ZipFile(io.BytesIO(response.read()))
    codes = {}
    for line in archive.read(country + '.txt').decode('utf-8').splitlines():
        row = line.split('\t')
        if len(row) < 11 or not row[1].isdigit() or len(row[1]) != (5 if country == 'DE' else 4):
            continue
        try:
            lat, lon = float(row[9]), float(row[10])
        except ValueError:
            continue
        if 46 <= lat <= 56 and 5 <= lon <= 18:
            codes.setdefault(row[1], []).append((lon, lat))
    groups = {}
    for code, points in codes.items():
        groups.setdefault(code[:2], []).append(tuple(sum(p[i] for p in points) / len(points) for i in (0, 1)))
    result[country] = {prefix: {'coordinates': [round(sum(p[i] for p in points) / len(points), 5) for i in (0, 1)], 'postalCodeCount': len(points)} for prefix, points in sorted(groups.items())}
    print(country, len(codes), 'postal codes,', len(groups), 'two-digit reference points')
data = {'source': 'GeoNames postal codes, https://download.geonames.org/export/zip/', 'retrieved': '2026-11-02', 'method': 'Unweighted mean of per-postcode mean coordinates; schematic reference, not a company address or boundary.', 'countries': result}
header = '/* Postal reference points derived from GeoNames, CC BY 4.0. See licenses/postal-prefixes-SOURCES.txt. */\n'
script = "(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GeoRadarPostalPrefixes=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){return " + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';});\n'
(root / 'dist/postal-prefixes.js').write_text(header + script, encoding='utf-8')
