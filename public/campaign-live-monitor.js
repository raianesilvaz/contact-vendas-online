/* Read-only monitoring. Restored runs never restart or send automatically. */
(()=>{
 const host=document.querySelector('#campaignLiveMonitor');if(!host)return;
 const $=s=>host.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const progress=window.ContactCampaignProgress;let runs=[],items=[],busy=false,enabled=false,selected=null,lastRead=null,finishing=null;
 const labels={running:'Em andamento no registro',paused:'Pausada',completed:'Finalizada',cancelled:'Cancelada',canceled:'Cancelada',failed:'Falhou',error:'Erro',pending:'Pendente'};
 function when(v){return v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Nenhum envio registrado';}
 function local(){return window.contactCampaignExecution?.get()||null;}
 function reports(){
  const current=local(),list=runs.map(r=>({...r,name:r.campaign?.name||'Campanha',items:items.filter(i=>i.run_id===r.id)}));
  if(current){const own={id:current.id,name:current.name||'Campanha desta aba',status:current.cancelled?'cancelled':current.done?(current.completionConfirmed?'completed':'paused'):current.paused?'paused':'running',started_at:current.started_at,quantity:current.items.length,interval_seconds:current.interval,items:current.items,own:true,completionPending:current.done&&!current.completionConfirmed&&!current.cancelled,processing:current.processing,nextAt:current.nextAt,syncError:current.syncError};const index=list.findIndex(r=>r.id===own.id);if(index>=0)list.splice(index,1);list.unshift(own);}
  return list.map(r=>({...r,stats:progress.summarize(r.items,r.quantity),lastSent:r.items.map(i=>i.sent_at).filter(Boolean).sort().at(-1)}));
 }
 function phase(r){if(r.completionPending)return 'Fila processada · finalizar';if(r.own)return r.status==='completed'?'Envio finalizado':r.status==='cancelled'?'Cancelada':r.status==='paused'?'Pausada nesta aba':r.processing?'Enviando nesta aba':'Aguardando próximo envio';return labels[r.status]||r.status;}
 function explanation(r){
  if(r.syncError)return r.syncError;
  if(r.stats.settled&&['paused','running'].includes(r.status))return 'Todos os destinatários foram processados; o encerramento ainda não foi registrado. Não há mensagem pendente nesta fila.';
  if(r.own&&!['completed','cancelled'].includes(r.status))return r.status==='paused'?'Envio pausado. Use Acompanhar para continuar ou cancelar.':'Mantenha esta aba aberta. O andamento permanece visível mesmo com o painel minimizado.';
  if(['running','paused'].includes(r.status))return 'Consulta ao status salvo. Esta aba não conduz essa execução; confirme se ela está aberta em outra aba ou sessão. Nada será retomado automaticamente.';
  return 'Consulte os destinatários para conferir os envios e os motivos dos erros.';
 }
 function card(r){const s=r.stats;return `<article class="campaign-live-card"><div class="campaign-live-title"><div><small>${r.own?'EXECUÇÃO DESTA ABA':'ACOMPANHAMENTO'}</small><h3>${esc(r.name)}</h3></div><span class="campaign-live-status is-${esc(r.status)}">${esc(phase(r))}</span></div><div class="campaign-live-counts"><span><b>${s.sent}</b> enviados</span><span class="has-error"><b>${s.errors}</b> erros</span><span><b>${s.waiting}</b> aguardando</span>${s.sending?`<span><b>${s.sending}</b> enviando agora</span>`:''}${s.cancelled?`<span><b>${s.cancelled}</b> cancelados</span>`:''}<strong>${s.processed} / ${s.total} processados</strong></div><progress max="100" value="${s.percent}" aria-label="Progresso de ${esc(r.name)}"></progress><p class="campaign-live-note ${r.syncError?'campaign-live-error':''}">${esc(explanation(r))}</p><div class="campaign-live-bottom"><span>Último envio: ${esc(when(r.lastSent))}</span><span>Intervalo: ${Number(r.interval_seconds)||0}s <b data-campaign-countdown="${esc(r.id)}"></b></span>${r.stats.settled&&['running','paused','pending'].includes(r.status)?`<button type="button" data-finish-run="${esc(r.id)}" ${finishing===r.id?'disabled':''}>${finishing===r.id?'Finalizando...':'Finalizar campanha'}</button>`:''}<button type="button" data-monitor-run="${esc(r.id)}">${r.own?'Acompanhar campanha':'Ver detalhes'}</button></div></article>`;}
 function render(){
  const data=reports(),list=$('#campaignLiveCards'),expanded=list.querySelector('details')?.open;
  list.innerHTML=data.length?card(data[0])+(data.length>1?`<details ${expanded?'open':''}><summary>Outras execuções (${data.length-1})</summary>${data.slice(1).map(card).join('')}</details>`:''):'<p class="campaign-live-note">Nenhuma execução encontrada. As campanhas aparecerão aqui quando forem iniciadas.</p>';
  countdown();
 }
 function countdown(){const own=local();host.querySelectorAll('[data-campaign-countdown]').forEach(el=>{el.textContent=own?.id===el.dataset.campaignCountdown&&own.nextAt&&!own.paused&&!own.done?`· próxima tentativa em ${Math.max(0,Math.ceil((own.nextAt-Date.now())/1000))}s`:'';});}
 async function refresh(){
  if(busy||!enabled)return;busy=true;$('#campaignLiveRefresh').disabled=true;
  try{
   const r=await window.supabaseClient.from('campaign_runs').select('id,status,quantity,interval_seconds,started_at,finished_at,campaign:campaigns(name)').order('started_at',{ascending:false}).limit(12);if(r.error)throw r.error;
   const next=[];if(r.data.length){for(let start=0;;start+=1000){const rec=await window.supabaseClient.from('campaign_recipients').select('id,run_id,status,sent_at').in('run_id',r.data.map(x=>x.id)).order('id').range(start,start+999);if(rec.error)throw rec.error;next.push(...rec.data);if(rec.data.length<1000)break;}}
   runs=r.data;items=next;lastRead=new Date();$('#campaignLiveRead').textContent='Atualizado às '+lastRead.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · consulta automática a cada 5s';$('#campaignLiveError').textContent='';render();
   if(selected)await loadDetails(selected);
  }catch(e){$('#campaignLiveError').textContent='Não foi possível atualizar o acompanhamento: '+e.message+(lastRead?' · mantendo os dados da última consulta.':'');}
  finally{busy=false;$('#campaignLiveRefresh').disabled=false;}
 }
 function detailsOverlay(){let box=document.querySelector('#campaignMonitorDetails');if(!box){box=document.createElement('div');box.id='campaignMonitorDetails';box.className='campaign-overlay';box.innerHTML='<section class="campaign-modal" role="dialog" aria-labelledby="campaignMonitorDetailsTitle"><header><div><h2 id="campaignMonitorDetailsTitle">Detalhes da execução</h2><p id="campaignMonitorDetailsMeta"></p></div><button type="button" id="campaignMonitorDetailsClose" aria-label="Fechar detalhes">×</button></header><div class="prepare-body"><p class="campaign-live-note">Consulta somente. Este painel não inicia nem retoma envios.</p><div id="campaignMonitorDetailsRows" class="run-log"></div></div></section>';document.body.appendChild(box);box.querySelector('#campaignMonitorDetailsClose').onclick=()=>{selected=null;box.hidden=true;};}return box;}
 async function loadDetails(id){
  const box=detailsOverlay();box.hidden=false;const report=reports().find(r=>r.id===id);box.querySelector('#campaignMonitorDetailsTitle').textContent=report?.name||'Detalhes da execução';
  const target=box.querySelector('#campaignMonitorDetailsRows');if(selected!==id)target.textContent='Carregando destinatários...';selected=id;
  try{const all=[];for(let start=0;;start+=1000){const r=await window.supabaseClient.from('campaign_recipients').select('id,customer_name,status,sent_at,error_message').eq('run_id',id).order('created_at').order('id').range(start,start+999);if(r.error)throw r.error;all.push(...r.data);if(r.data.length<1000)break;}if(selected!==id)return;
   const s=progress.summarize(all,report?.quantity);box.querySelector('#campaignMonitorDetailsMeta').textContent=`${s.sent} enviados · ${s.errors} erros · ${s.waiting} aguardando`;
   const statuses={sent:'✓ Enviado',error:'✕ Erro',waiting:'◷ Aguardando',sending:'➤ Enviando',cancelled:'Cancelado',canceled:'Cancelado'};
   target.innerHTML=all.map(r=>`<div class="collections-run-row"><span class="collections-run-badge is-${esc(r.status)}">${esc(statuses[r.status]||r.status)}</span><span class="collections-run-name">${esc(r.customer_name||'Cliente')}<small>${esc(r.status==='error'?r.error_message||'Erro sem descrição':r.sent_at?when(r.sent_at):'')}</small></span></div>`).join('')||'Nenhum destinatário registrado nesta execução.';
  }catch(e){if(selected===id)target.textContent='Não foi possível consultar os destinatários: '+e.message;}
 }
 host.addEventListener('click',async e=>{const finish=e.target.closest('[data-finish-run]');if(finish){if(finishing)return;finishing=finish.dataset.finishRun;render();try{if(local()?.id===finishing)await window.contactCampaignExecution.finish();else await window.ContactCampaignFinalizer.finish(finishing);await refresh();}catch(error){$('#campaignLiveError').textContent='Não foi possível finalizar: '+error.message;}finally{finishing=null;render();}return;}const button=e.target.closest('[data-monitor-run]');if(!button)return;const id=button.dataset.monitorRun;if(local()?.id===id)window.contactCampaignExecution.open();else loadDetails(id);});
 $('#campaignLiveRefresh').onclick=refresh;
 window.addEventListener('contact-campaign-progress',()=>{if(enabled)render();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('focus',refresh);
 setInterval(()=>{if(!document.hidden)refresh();},5000);setInterval(()=>{if(!document.hidden)countdown();},1000);
 Promise.resolve(window.authReady).then(user=>{if(!user||!['admin','financeiro'].includes(user.profile?.role)){host.hidden=true;return;}enabled=true;refresh();});
})();
