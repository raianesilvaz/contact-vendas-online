import xml.etree.ElementTree as ET
from pathlib import Path
from collections import Counter, defaultdict
from html import unescape
import json, re, hashlib
from shapely.geometry import Polygon

SOURCE=Path('upload/Claro.kml')
OUT=Path('coverage-claro-work/data');OUT.mkdir(parents=True,exist_ok=True)
NS={'k':'http://www.opengis.net/kml/2.2'}
root=ET.parse(SOURCE).getroot()
stats=Counter();features=[];source_geometries=[]
def plain(s):return ' '.join(unescape(re.sub('<[^>]*>',' ',s or '')).split())
def walk(node,path):
    if node.tag.endswith('Folder'):path=path+[node.findtext('k:name','',NS)]
    if node.tag.endswith('Placemark'):
        name=node.findtext('k:name','',NS)
        desc=node.findtext('k:description','',NS)
        fields={}
        for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>',desc,re.I|re.S):
            cells=re.findall(r'<t[dh]\b[^>]*>(.*?)</t[dh]>',row,re.I|re.S)
            if len(cells)>=2:fields[plain(cells[0]).upper()]=plain(cells[1])
        city=fields.get('CIDADE') or next((p for p in path[1:] if not re.search(r'POLIGONO|POLÍGONO|GPON|HFC|Meus lugares|LIMITE|Bloqueio|NODE|^doc$',p,re.I)),path[1] if len(path)>1 else 'Área Claro')
        city=re.sub(r'\.(kml|kmz)$','',city,flags=re.I)
        city=re.sub(r'\s*\(2023\)|\s*-\s*Bloqueios.*$','',city,flags=re.I).strip()
        uf=fields.get('UF') or fields.get('ESTADO') or ''
        restricted=bool(re.search(r'bloq|restri|não atend|nao atend|inviável|inviavel',' / '.join(path+[name]),re.I))
        for poly in node.findall('.//k:Polygon',NS):
            stats['sourcePolygons']+=1
            rings=[]
            try:
                for tag in ['outerBoundaryIs','innerBoundaryIs']:
                    for coordinates in poly.findall('k:'+tag+'/k:LinearRing/k:coordinates',NS):
                        rings.append([[round(float(v),7) for v in q.split(',')[:2]] for q in (coordinates.text or '').split()])
                g=Polygon(rings[0],rings[1:])
                if not g.is_valid or g.is_empty or g.area<=0:stats['invalidExcluded']+=1;continue
                assert all(-180<=p[0]<=180 and -90<=p[1]<=90 for ring in rings for p in ring)
                features.append({'type':'Feature','properties':{'name':city+('/'+uf if uf else ''),'restricted':restricted},'geometry':{'type':'Polygon','coordinates':rings}})
                source_geometries.append(g)
                stats['restricted' if restricted else 'coverage']+=1
            except (ValueError,IndexError,AssertionError):stats['invalidExcluded']+=1
    for ch in node:
        if ch.tag.split('}')[-1] in ['Document','Folder','Placemark']:walk(ch,path)
walk(root,[])
chunks=[];current=[];size=0
for feature in features:
    encoded=json.dumps(feature,ensure_ascii=False,separators=(',',':'))
    if current and size+len(encoded.encode())>300000:chunks.append(current);current=[];size=0
    current.append(feature);size+=len(encoded.encode())
if current:chunks.append(current)
index=[];search={}
for chunk,items in enumerate(chunks):
    filename=f'claro-{chunk}.json'
    (OUT/filename).write_text(json.dumps({'type':'FeatureCollection','features':items},ensure_ascii=False,separators=(',',':')))
    for i,f in enumerate(items):
        g=Polygon(f['geometry']['coordinates'][0],f['geometry']['coordinates'][1:]);assert g.is_valid
        index.append(['claro',chunk,i,*g.bounds,1,int(f['properties']['restricted'])])
        if not f['properties']['restricted']:
            entry=search.setdefault(f['properties']['name'],{'name':f['properties']['name'],'operator':'claro','refs':[],'polygons':0,'lines':0})
            entry['refs'].append([filename,i]);entry['polygons']+=1
(OUT/'claro-spatial-index.json').write_text(json.dumps(index,separators=(',',':')))
(OUT/'claro-search-index.json').write_text(json.dumps(list(search.values()),ensure_ascii=False,separators=(',',':')))
report={'source':'Claro.kml','sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'importedAt':'2026-11-02','counts':dict(stats),'files':[f'claro-{i}.json' for i in range(len(chunks))],'note':'Only valid polygons participate; blocked layers are restrictions, never positive coverage. Points and descriptions are not published.'}
(OUT/'claro-import.json').write_text(json.dumps(report,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'report':report,'bytes':sum(p.stat().st_size for p in OUT.glob('*.json')),'maxChunk':max((OUT/f'claro-{i}.json').stat().st_size for i in range(len(chunks)))},ensure_ascii=False))
