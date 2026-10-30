import xml.etree.ElementTree as E,json,re,os,gzip
ns={'k':'http://www.opengis.net/kml/2.2'};r=E.parse('upload/cobertura desktop.kml').getroot()
os.makedirs('coverage-work/data',exist_ok=True)
def coords(el):
 return [[round(float(v),7) for v in t.split(',')[:2]] for t in (el.text or '').split()]
def plain(s):return re.sub('<[^>]+>',' ',s or '').strip()
manifest={}
for key,folder in zip(['alcans','desktop'],r.findall('.//k:Document/k:Folder',ns)):
 features=[];poly=0;line=0
 for p in folder.findall('.//k:Placemark',ns):
  prop={'name':p.findtext('k:name','Área sem nome',ns).strip(),'note':plain(p.findtext('k:description','',ns))}
  for g in p.findall('.//k:Polygon',ns):
   outer=g.find('k:outerBoundaryIs/k:LinearRing/k:coordinates',ns)
   if outer is None:continue
   rings=[coords(outer)]+[coords(c) for c in g.findall('k:innerBoundaryIs/k:LinearRing/k:coordinates',ns)]
   if any(len(a)<4 for a in rings):continue
   for a in rings:
    if a[0]!=a[-1]:a.append(a[0])
   features.append({'type':'Feature','properties':prop,'geometry':{'type':'Polygon','coordinates':rings}});poly+=1
  for g in p.findall('.//k:LineString/k:coordinates',ns):
   a=coords(g)
   if len(a)<2:continue
   features.append({'type':'Feature','properties':prop,'geometry':{'type':'LineString','coordinates':a}});line+=1
 files=[]
 for i in range(0,len(features),300):
  name=f'{key}-{i//300}.json';files.append(name)
  with open('coverage-work/data/'+name,'w') as out:json.dump({'type':'FeatureCollection','features':features[i:i+300]},out,ensure_ascii=False,separators=(',',':'))
 manifest[key]={'files':files,'polygons':poly,'lines':line}
with open('coverage-work/data/manifest.json','w') as out:json.dump(manifest,out,separators=(',',':'))
print(json.dumps(manifest));print('bytes',sum(os.path.getsize('coverage-work/data/'+f) for f in os.listdir('coverage-work/data')))
