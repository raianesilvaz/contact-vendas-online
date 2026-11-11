(()=>{'use strict';
const db=window.supabaseClient,form=document.querySelector('#claroCepForm'),info=document.querySelector('#claroCepProgress'),button=document.querySelector('#claroCepSubmit');
const set=(message,bad=false)=>{info.textContent=message;info.style.color=bad?'#b42318':'#087f7a'};
const wait=()=>new Promise(r=>setTimeout(r,0));
function parse(text){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/),head=lines.shift().split(/[;,]/).map(v=>v.trim().toUpperCase()),i=head.indexOf('CEP'),j=head.indexOf('DSC_CIDADE'),k=head.indexOf('COD_UF');
 if(i<0||j<0||k<0)throw Error('CSV inválido. Colunas esperadas: CEP, DSC_CIDADE, COD_UF.');
 const seen=new Map();let rejected=0;
 for(const line of lines){if(!line.trim())continue;const cells=line.split(/[;,]/),cep=(cells[i]||'').trim().replace(/\D/g,''),city=(cells[j]||'').trim(),uf=(cells[k]||'').trim().toUpperCase();
 if(!/^\d{8}$/.test(cep)||cep==='00000000'||!city||!/^[A-Z]{2}$/.test(uf)){rejected++;continue}
 if(!seen.has(cep))seen.set(cep,{cep,city,uf});
 }
 return {records:[...seen.values()],rejected};
}
form?.addEventListener('submit',async e=>{
 e.preventDefault();const file=form.elements.file.files[0];if(!file)return;
 if(!confirm('Importar a nova base de CEPs da Claro? A base atual continuará disponível até o fim da importação.'))return;
 button.disabled=true;
 try{
  const user=await window.authReady;if(user?.profile?.role!=='admin')throw Error('Apenas administradores podem importar.');
  set('Lendo e validando CSV…');await wait();const {records,rejected}=parse(await file.text());
  if(records.length<100)throw Error('Arquivo contém poucos CEPs válidos. Importação cancelada.');
  const batch=crypto.randomUUID(),size=1000;
  set('Preparando '+records.length.toLocaleString('pt-BR')+' CEPs…');await wait();
  for(let i=0;i<records.length;i+=size){
   const rows=records.slice(i,i+size).map(r=>({...r,batch_id:batch}));
   const {error}=await db.from('claro_cep_coverage').insert(rows);
   if(error)throw Error('Falha no lote '+(Math.floor(i/size)+1)+': '+error.message);
   if(i%(size*5)===0||i+size>=records.length){set('Importando Claro: '+Math.min(i+size,records.length).toLocaleString('pt-BR')+' de '+records.length.toLocaleString('pt-BR')+' CEPs…');await wait()}
  }
  const {data,error}=await db.from('claro_cep_import_state').update({active_batch:batch,total:records.length,updated_at:new Date().toISOString()}).eq('id',true).select('total').single();
  if(error||!data)throw Error('CEPs enviados, mas não foi possível ativar a base: '+(error?.message||'permissão'));
  set('Base da Claro ativada: '+records.length.toLocaleString('pt-BR')+' CEPs únicos. '+rejected+' linhas inválidas ignoradas.');form.reset();
 }catch(error){set(error.message||'Erro na importação. A base anterior foi preservada.',true)}
 finally{button.disabled=false}
});
})();