(()=>{
'use strict';
const $=s=>document.querySelector(s),norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
let citiesPromise,sequence=0,timer;
async function cities(){citiesPromise??=fetch('coverage-data/vero-cities.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>d.cities).catch(e=>{citiesPromise=null;throw e});return citiesPromise}
function clear(){window.ContactCoverageResults.vero([])}
function render(rows){window.ContactCoverageResults.vero(rows)}
async function checkCity(city,uf){const token=++sequence;clear();try{const list=await cities();if(token!==sequence)return;render(list.filter(r=>norm(r.city)===norm(city)&&r.uf===String(uf).toUpperCase()))}catch{if(token===sequence){window.ContactCoverageResults.note('Lista de cidades da VERO indisponível. Tente novamente.')}}}
async function searchCity(){const q=$('#areaSearch').value.trim();if(!q||/^[\d\s-]+$/.test(q))return;const key=norm(q);if(key.length<3)return;const token=++sequence;try{const list=await cities();if(token!==sequence)return;const explicit=q.match(/^(.*?)\s*[/,-]\s*([a-z]{2})$/i);const rows=list.filter(r=>explicit?norm(r.city)===norm(explicit[1])&&r.uf===explicit[2].toUpperCase():norm(r.city).includes(key));render(rows.slice(0,8));if(rows.length>8){const note=document.createElement('p');note.textContent='Mais cidades encontradas. Refine o nome ou informe Cidade/UF.';window.ContactCoverageResults.note(note.textContent)}}catch{if(token===sequence)clear()}}
window.addEventListener('contact:coverage-address',e=>{clearTimeout(timer);checkCity(e.detail.city,e.detail.uf)});
$('#areaSearch').addEventListener('input',()=>{++sequence;clearTimeout(timer);clear();timer=setTimeout(searchCity,450)});
$('#coverageSearch').addEventListener('submit',()=>{clearTimeout(timer);searchCity()});
})();