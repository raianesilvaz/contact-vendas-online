(()=>{
  const panel=document.querySelector('#collectionsFpd');if(!panel)return;
  const $=s=>panel.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let db,rows=[],meta=null,preview=null,page=0,busy=false,dirty=new Set();const size=50;
  function message(text,error=false){$('#fpdMessage').textContent=text;$('#fpdMessage').classList.toggle('is-error',error);}
  function lock(value){busy=value;panel.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value);}
  function filtered(){const q=$('#fpdSearch').value.trim().toLocaleLowerCase('pt-BR'),filter=$('#fpdFilter').value;return rows.filter(r=>(!q||[r.contract_number,r.customer_name,r.seller_name,r.treatment_status,r.notes].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q)))&&(!filter||(filter==='pending'?!r.treatment_status:filter==='unmatched'?r.match_status!=='matched':!!r.treatment_status)));}
  function render(){
    $('#fpdTotal').textContent=rows.length;$('#fpdTreated').textContent=rows.filter(r=>r.treatment_status).length;$('#fpdUnmatched').textContent=rows.filter(r=>r.match_status!=='matched').length;
    $('#fpdMeta').textContent=meta?`${meta.file_name} · Importada em ${new Date(meta.imported_at).toLocaleString('pt-BR')} · Os tratamentos ficam salvos até a próxima importação.`:'Nenhuma planilha importada.';
    const list=filtered();page=Math.min(page,Math.max(0,Math.ceil(list.length/size)-1));
    $('#fpdRows').innerHTML=list.slice(page*size,(page+1)*size).map(r=>`<tr data-id="${esc(r.id)}"><td><b>${esc(r.contract_number)}</b><br>${r.invoice_no}ª fatura</td><td>${esc(r.customer_name||'—')}${r.match_status!=='matched'?`<small>${r.match_status==='ambiguous'?'Contrato com mais de uma venda':'Contrato não encontrado'}</small>`:''}</td><td>${esc(r.seller_name||'—')}</td><td><label><span class="sr-only">Status do contrato ${esc(r.contract_number)}</span><input data-field="treatment_status" maxlength="100" list="fpdStatuses" value="${esc(r.treatment_status)}" placeholder="Definir status"></label></td><td><label><span class="sr-only">Observação do contrato ${esc(r.contract_number)}</span><textarea data-field="notes" maxlength="5000" placeholder="Escrever observação">${esc(r.notes)}</textarea></label><button type="button" class="fpd-save" data-save="${esc(r.id)}">${dirty.has(r.id)?'Salvar alterações':'Salvo'}</button></td><td>${esc(r.due_date_text||'—')}</td><td>${esc(r.payment_date_text||'—')}</td><td>${esc(r.days_open??'—')}</td><td>${esc(r.collection_situation||'—')}</td><td>${esc(r.follow_up||'—')}</td><td>${esc(r.collection_type||'—')}</td><td>${esc(r.installation_date_text||'—')}</td><td>${esc(r.installation_month||'—')}</td></tr>`).join('');
    $('#fpdEmpty').hidden=!!list.length;$('#fpdTable').hidden=!list.length;$('#fpdEmpty').innerHTML=rows.length?'Nenhum registro encontrado nos filtros.':'<strong>Sua tabela FPD começa aqui</strong>Importe a planilha Excel para buscar os clientes e vendedores e iniciar o tratamento.';
    $('#fpdPage').textContent=list.length?`${page*size+1}–${Math.min((page+1)*size,list.length)} de ${list.length} registros`:'0 registros';$('#fpdPrev').disabled=page===0;$('#fpdNext').disabled=(page+1)*size>=list.length;
  }
  async function load(){
    lock(true);message('Carregando tabela FPD...');
    try{
      const m=await db.from('fpd_imports').select('id,file_name,imported_at').order('imported_at',{ascending:false}).limit(1);if(m.error)throw m.error;
      const next=[];
      for(let start=0;start<10000;start+=1000){const r=await db.from('fpd_records').select('*').order('contract_number').order('invoice_no').range(start,start+999);if(r.error)throw r.error;next.push(...r.data);if(r.data.length<1000)break;}
      rows=next;meta=m.data[0]||null;dirty.clear();message('');
    }catch(e){message('Não foi possível carregar o FPD. '+e.message,true);}finally{lock(false);render();}
  }
  async function pick(file){
    if(!file)return;if(dirty.size){message('Salve as alterações pendentes antes de importar outra planilha.',true);return;}
    preview=null;$('#fpdPreview').hidden=true;
    if(!/\.(xlsx|xls)$/i.test(file.name)||file.size>10*1024*1024){message('Selecione um arquivo Excel (.xlsx ou .xls) de até 10 MB.',true);return;}
    lock(true);message('Conferindo arquivo...');
    try{
      const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
      const sheets=[];for(const name of book.SheetNames){const grid=XLSX.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false});if(grid.some(row=>row.some(v=>['NUMCONTRATO','CONTRATO','NUMERODOCONTRATO'].includes(contactFpdData.normalize(v)))))sheets.push({name,grid});}
      if(sheets.length!==1)throw Error(sheets.length?'O arquivo contém mais de uma aba com contratos. Deixe apenas a aba que deseja importar.':'Nenhuma aba com a coluna de contrato foi encontrada.');
      const records=contactFpdData.parse(sheets[0].grid);
      preview={records,name:file.name,requestId:crypto.randomUUID()};
      $('#fpdPreviewSummary').textContent=`${file.name} · ${records.length} registros · Aba ${sheets[0].name}`;
      $('#fpdPreviewRows').textContent=records.slice(0,3).map(r=>`Contrato ${r.contract_number} · ${r.invoice_no}ª fatura · Vencimento ${r.due_date_text||'—'}`).join('\n');
      $('#fpdPreview').hidden=false;message('Arquivo validado. Confirme a importação abaixo.');
    }catch(e){message(e.message,true);}finally{lock(false);render();$('#fpdFile').value='';}
  }
  async function importFile(){
    if(busy||!preview)return;lock(true);message('Importando e buscando Cliente e Vendedor...');
    let success=false;
    try{const r=await db.rpc('import_fpd_records',{p_file_name:preview.name,p_records:preview.records,p_request_id:preview.requestId});if(r.error)throw r.error;success=true;preview=null;$('#fpdPreview').hidden=true;}
    catch(e){message('Importação não confirmada: '+e.message+'. Você pode tentar novamente. A tabela anterior é preservada se houver erro na operação.',true);}
    finally{lock(false);render();}
    if(success){await load();if(!$('#fpdMessage').classList.contains('is-error'))message('Planilha importada. Cliente e Vendedor consultados; Status e Observação prontos para preenchimento.');}
  }
  async function save(id){
    if(busy||!dirty.has(id))return;const row=rows.find(r=>r.id===id);lock(true);message('Salvando tratamento...');
    try{const r=await db.rpc('save_fpd_treatment',{p_id:id,p_version:row.annotation_version,p_status:row.treatment_status,p_notes:row.notes});if(r.error)throw r.error;Object.assign(row,Array.isArray(r.data)?r.data[0]:r.data);dirty.delete(id);message('Tratamento salvo.');}
    catch(e){message('Não foi possível salvar: '+e.message+' Suas alterações continuam nesta tela.',true);}
    finally{lock(false);render();}
  }
  $('#fpdRows').addEventListener('input',e=>{const field=e.target.dataset.field;if(!field)return;const id=e.target.closest('tr').dataset.id;rows.find(r=>r.id===id)[field]=e.target.value;dirty.add(id);e.target.closest('tr').querySelector('[data-save]').textContent='Salvar alterações';});
  $('#fpdRows').addEventListener('click',e=>{const b=e.target.closest('[data-save]');if(b)save(b.dataset.save);});
  $('#fpdImport').onclick=()=>$('#fpdFile').click();$('#fpdFile').onchange=e=>pick(e.target.files[0]);$('#fpdConfirm').onclick=importFile;
  $('#fpdCancel').onclick=()=>{preview=null;$('#fpdPreview').hidden=true;message('');};
  $('#fpdReload').onclick=()=>{if(dirty.size&&!confirm('Descartar alterações ainda não salvas e recarregar a tabela?'))return;load();};
  for(const id of ['#fpdSearch','#fpdFilter'])$(id).addEventListener('input',()=>{page=0;render();});
  $('#fpdPrev').onclick=()=>{page--;render();};$('#fpdNext').onclick=()=>{page++;render();};
  window.addEventListener('beforeunload',e=>{if(dirty.size||busy){e.preventDefault();e.returnValue='';}});
  lock(true);Promise.resolve(window.authReady).then(user=>{if(!user||user.profile?.role!=='admin'){panel.innerHTML='<p class="fpd-message">O FPD está disponível somente para administradores.</p>';return;}db=window.supabaseClient;load();}).catch(()=>message('Não foi possível validar seu acesso. Atualize a página.',true));
})();
