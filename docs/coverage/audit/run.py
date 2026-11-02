import sys,json,hashlib
from pathlib import Path
from collections import Counter
from shapely.geometry import shape
sys.path.insert(0,str(Path(__file__).parent))
from geometry_tools import normalize_area
OUT=Path('coverage-audit-work/data');OUT.mkdir(parents=True,exist_ok=True)
stats=Counter();index=json.load(open('coverage-work/spatial-index.json'));lookup={(r[0],r[1],r[2]):r for r in index}
for p in sorted(Path('coverage-work/data').glob('desktop-*.json')):
 d=json.loads(p.read_text());chunk=int(p.stem.split('-')[1])
 for i,f in enumerate(d['features']):
  g,ok,status=normalize_area(f['geometry']);stats[status]+=1
  if ok:f['geometry']=g
  lookup['desktop',chunk,i][7]=int(ok)
 (OUT/p.name).write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')))
(OUT/'spatial-index.json').write_text(json.dumps(index,separators=(',',':')))
print(dict(stats))
(OUT/'desktop-audit.json').write_text(json.dumps(dict(stats)))
