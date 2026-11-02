import json, hashlib, random
from pathlib import Path
from shapely.geometry import shape,Polygon,Point,mapping
from shapely import make_valid

source=Path('coverage-work/data/desktop-16.json')
feature=json.loads(source.read_text())['features'][4]
assert feature['properties']['name'].startswith('FASTERNET - Itú -')
geometry=shape(feature['geometry'])
original=Polygon(geometry.coords)
assert not original.is_valid and geometry.is_closed
repaired=make_valid(original)
assert repaired.is_valid and repaired.geom_type=='MultiPolygon'
assert original.bounds==repaired.bounds
assert repaired.covers(Point(-47.3520082,-23.40172))
def inside(point,ring):
    x,y=point;result=False
    for a,b in zip(ring,ring[1:]+ring[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:result=not result
    return result
ring=[list(p) for p in geometry.coords]
random.seed(13308505)
for _ in range(10000):
    p=(random.uniform(original.bounds[0],original.bounds[2]),random.uniform(original.bounds[1],original.bounds[3]))
    assert inside(p,ring)==repaired.contains(Point(p))
out=Path('coverage-itu-repair');out.mkdir(exist_ok=True)
(out/'geometry-overrides.json').write_text(json.dumps({'desktop-16.json:4':mapping(repaired)},separators=(',',':')))
report={'source':'desktop-16.json:4','name':feature['properties']['name'],'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'method':'Shapely make_valid linework; no buffer or expansion','reason':'Closed line self-intersects; convert into valid polygon components','resultType':repaired.geom_type,'boundsUnchanged':True,'evenOddSamplesVerified':10000,'testCep':'13308-505','testPoint':[-47.3520082,-23.40172]}
(out/'repair-report.json').write_text(json.dumps(report,ensure_ascii=False,separators=(',',':')))
print(json.dumps(report,ensure_ascii=False))
