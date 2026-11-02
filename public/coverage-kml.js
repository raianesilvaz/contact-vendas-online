/* Only polygon coordinates and explicit restrictions are imported; descriptions and links are discarded. */
(()=>{'use strict';
const children=(el,tag)=>Array.from(el.children).filter(c=>c.localName===tag),desc=(el,tag)=>Array.from(el.getElementsByTagNameNS('*',tag));
function coordinates(el){const text=el?.textContent||'';const points=text.trim().split(/\s+/).filter(Boolean).map(p=>p.split(',').slice(0,2).map(Number));if(points.some(p=>p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90))throw Error('O arquivo contém coordenadas inválidas.');return points}
function closed(points){return points.length>=4&&points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1]}
function parse(text){if(text.length>80*1024*1024)throw Error('KML descompactado deve ter até 80 MB.');if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Este formato de XML não é aceito.');const xml=new DOMParser().parseFromString(text,'text/xml');if(desc(xml,'parsererror').length)throw Error('Não foi possível ler o KML.');if(xml.documentElement.localName!=='kml')throw Error('Escolha um arquivo KML válido.');if(desc(xml,'NetworkLink').length)throw Error('O arquivo contém links externos. Exporte as áreas completas em KML/KMZ.');const features=[],stats={areas:0,restricted:0,openLines:0,points:desc(xml,'Point').length,vertices:0};
for(const pm of desc(xml,'Placemark')){const labels=[];for(let p=pm;p&&p!==xml;p=p.parentElement){if(['Placemark','Folder','Document'].includes(p.localName))labels.push(children(p,'name')[0]?.textContent||'')}const restricted=/bloq|restri|não atend|nao atend|inviável|inviavel/i.test(labels.join(' / '));const name=(children(pm,'name')[0]?.textContent||'Área de cobertura').slice(0,180);
for(const poly of desc(pm,'Polygon')){const outer=children(poly,'outerBoundaryIs')[0],inners=children(poly,'innerBoundaryIs');const rings=[outer,...inners].map(n=>coordinates(n&&desc(n,'coordinates')[0]));if(rings.some(r=>!closed(r)))throw Error('Existe um polígono aberto ou incompleto. Corrija o contorno antes de importar.');add(rings)}
for(const line of desc(pm,'LineString')){const pts=coordinates(desc(line,'coordinates')[0]);if(closed(pts))add([pts]);else stats.openLines++}
function add(rings){stats.vertices+=rings.reduce((a,r)=>a+r.length,0);if(stats.vertices>1000000||features.length>=20000)throw Error('Divida o arquivo: limite de 20 mil áreas ou 1 milhão de vértices por importação.');features.push({type:'Feature',properties:{name,restricted,validArea:true},geometry:{type:'Polygon',coordinates:rings}});stats.areas++;if(restricted)stats.restricted++}
}
return {features,stats}}
window.CoverageKml={parse};
})();
