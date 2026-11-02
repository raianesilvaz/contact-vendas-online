import json
from pathlib import Path
from shapely.geometry import shape,Point
P=Path('coverage-audit-work/data');cache={}
def read(n):
 if n not in cache:cache[n]=json.load(open(P/n if (P/n).exists() else Path('coverage-work/data')/n))
 return cache[n]
for name in ['spatial-index.json','claro-spatial-index.json']:
 rows=json.load(open(P/name))
 for r in rows:
  f=read(f'{r[0]}-{r[1]}.json')['features'][r[2]];g=shape(f['geometry'])
  if r[7] and r[0]!='alcans':assert g.is_valid and g.area>0 and g.geom_type in ['Polygon','MultiPolygon']
  assert all(abs(a-b)<1e-7 for a,b in zip(r[3:7],g.bounds))
idx=json.load(open('coverage-work/search-index.json'))
for e in idx:
 if e['operator']=='desktop':
  gs=[read(n)['features'][i]['geometry']['type'] for n,i in e['refs']]
  e['polygons']=sum(t in ['Polygon','MultiPolygon'] for t in gs);e['lines']=gs.count('LineString')
(P/'search-index.json').write_text(json.dumps(idx,ensure_ascii=False,separators=(',',':')))
for name in ['search-index.json','claro-search-index.json']:
 for e in json.load(open(P/name)):
  for n,i in e['refs']:assert not read(n)['features'][i]['properties'].get('restricted',False)
p=Point(-47.3520082,-23.40172)
assert shape(read('desktop-16.json')['features'][4]['geometry']).contains(p)
assert not any(shape(f['geometry']).contains(p) for n,d in cache.items() if n.startswith('claro-') for f in d['features'])
print('PASS: all spatial and search references, valid coverage geometries, restrictions and Itu regression')
