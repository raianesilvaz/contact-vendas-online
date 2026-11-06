(()=>{
  const panel=document.querySelector('#collectionsFpd');if(!panel)return;
  const $=s=>panel.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let db,rows=[],meta=null,preview=null,busy=false,dirty=new Set();
  function message(text,error=false){$('#fpdMessage').textContent=text;$('#fpdMessage').classList.toggle('is-error',error);}
  function lock(value){busy=value;panel.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value);}
  const grid=window.contactFpdGrid,filters={};let sort=null,menuState=null;
  function filtered(){return grid.filter(rows,{filters,sort,search:$('#fpdSearch').value,quick:$('#fpdFilter').value});}
  function controls(){
    $('#fpdSaveAll').disabled=busy||!dirty.size;
    $('#fpdSaveAll').textContent=dirty.size?`Salvar alterações (${dirty.size})`:'Tudo salvo';
    $('#fpdPending').textContent=dirty.size?`${dirty.size} linha(s) com alterações não salvas`:'Cliente, Status e Observação: edite na célula e salve. Enter salva a linha.';
  }
  function rowTone(r){const situation=grid.fold(r.collection_situation),status=grid.fold(r.treatment_status);return r.payment_date_text||situation.includes('pag')||situation.includes('renegociad')||status==='pago'?'fpd-paid':'';}
  function statusTone(v){const s=grid.fold(v);return s.includes('desabilitad')?'fpd-disabled':s==='conectado'||s==='pago'?'fpd-connected':s?'fpd-contacted':'';}
  function render(){
    $('#fpdTotal').textContent=rows.length;$('#fpdTreated').textContent=rows.filter(r=>r.treatment_status).length;$('#fpdUnmatched').textContent=rows.filter(r=>r.match_status!=='matched').length;
    $('#fpdMeta').textContent=meta?`${meta.file_name} · Importada em ${new Date(meta.imported_at).toLocaleString('pt-BR')}`:'Nenhuma planilha importada.';
    $('#fpdColumns').innerHTML='<col style="width:38px">'+grid.columns.map(c=>`<col style="width:${c.width}px">`).join('');
    $('#fpdHead').innerHTML='<tr class="fpd-letters"><th aria-hidden="true"></th>'+grid.columns.map((c,i)=>`<th class="${c.manual?'fpd-manual':''}" aria-hidden="true">${String.fromCharCode(65+i)}</th>`).join('')+'</tr><tr class="fpd-headers"><th scope="col" aria-label="Linha">#</th>'+grid.columns.map(c=>`<th scope="col" class="${c.manual?'fpd-manual':''} ${filters[c.key]?'fpd-filtered':''}" aria-sort="${sort?.key===c.key?(sort.direction==='asc'?'ascending':'descending'):'none'}"><button type="button" data-column="${c.key}" aria-label="Filtrar ${esc(c.label)}" aria-haspopup="dialog" aria-expanded="${menuState?.key===c.key}" title="Filtrar ou ordenar ${esc(c.label)}"><span>${esc(c.label)}</span><span class="fpd-filter-icon" aria-hidden="true">${sort?.key===c.key?(sort.direction==='asc'?'↑':'↓'):''}⌄${filters[c.key]?' •':''}</span></button></th>`).join('')+'</tr>';
    const list=filtered();
    $('#fpdRows').innerHTML=list.map((r,index)=>`<tr data-id="${esc(r.id)}" class="${rowTone(r)} ${dirty.has(r.id)?'fpd-dirty':''}"><th scope="row"><span>${index+1}</span><button type="button" data-save="${esc(r.id)}" aria-label="Salvar linha ${index+1}" title="Salvar esta linha" ${dirty.has(r.id)?'':'hidden'}>✓</button></th>`+grid.columns.map(c=>{
      const v=grid.value(r,c.key),label=`${c.label} do contrato ${r.contract_number}, fatura ${r.invoice_no}`;
      const warning=c.key==='customer_name'&&r.match_status!=='matched'?(r.match_status==='ambiguous'?'Contrato com mais de uma venda':'Contrato não encontrado'):'';
      return `<td class="${c.manual?'fpd-manual':''} ${c.key==='treatment_status'?statusTone(v):''} ${c.editable?'fpd-editable':''}" title="${esc(warning||v)}">${c.editable?`<input data-field="${c.key}" maxlength="${c.key==='notes'?5000:c.key==='customer_name'?300:100}" ${c.key==='treatment_status'?'list="fpdStatuses"':''} aria-label="${esc(label)}" value="${esc(v)}" placeholder="${c.key==='notes'?'Observação...':c.key==='customer_name'?'Nome do cliente...':'Definir status'}">`:c.key==='invoice_no'?`${esc(v)}ª FATURA`:esc(v||'—')}${warning?`<span class="fpd-match-warning" title="${esc(warning)}">⚠</span>`:''}</td>`;
    }).join('')+'</tr>').join('');
    $('#fpdEmpty').hidden=!!list.length;$('#fpdTable').hidden=!rows.length;
    $('#fpdEmpty').innerHTML=rows.length?'Nenhum registro encontrado. Ajuste os filtros das colunas ou limpe os filtros.':'<strong>Sua tabela FPD começa aqui</strong>Importe a planilha Excel para iniciar o tratamento.';
    $('#fpdRowCount').textContent=`${list.length} de ${rows.length} registros exibidos`;
    $('#fpdActiveFilters').innerHTML=Object.entries(filters).map(([key,values])=>`<button type="button" data-clear="${key}" title="Remover filtro">${esc(grid.columns.find(c=>c.key===key).label)}: ${values.size} valor(es) ×</button>`).join('')+(sort?`<button type="button" data-clear-sort>Ordem: ${esc(grid.columns.find(c=>c.key===sort.key).label)} ${sort.direction==='asc'?'↑':'↓'} ×</button>`:'');
    $('#fpdClearFilters').disabled=busy||(!Object.keys(filters).length&&!sort&&!$('#fpdSearch').value&&!$('#fpdFilter').value);
    controls();
  }
  function closeMenu(){const key=menuState?.key;const menu=$('#fpdColumnMenu');if(menu)menu.hidden=true;menuState=null;if(key)$('#fpdHead').querySelector(`[data-column="${key}"]`)?.setAttribute('aria-expanded','false');}
  function drawChoices(){
    const q=grid.fold($('#fpdValueSearch').value);
    $('#fpdValueOptions').innerHTML=menuState.values.map((v,i)=>({v,i})).filter(x=>grid.fold(x.v||'(Em branco)').includes(q)).map(({v,i})=>`<label><input type="checkbox" data-choice="${i}" ${menuState.selected.has(v)?'checked':''}><span>${esc(v||'(Em branco)')}</span></label>`).join('')||'<p>Nenhum valor encontrado.</p>';
    $('#fpdChoiceCount').textContent=`${menuState.selected.size} de ${menuState.values.length} valores selecionados`;
  }
  function openMenu(key,button){
    if(busy)return;closeMenu();const col=grid.columns.find(c=>c.key===key),values=grid.choices(rows,key);
    menuState={key,values,selected:new Set(filters[key]||values)};
    $('#fpdColumnTitle').textContent=`Filtrar ${col.label}`;$('#fpdValueSearch').value='';drawChoices();
    const menu=$('#fpdColumnMenu'),rect=button.getBoundingClientRect();menu.hidden=false;
    menu.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-296))+'px';
    menu.style.top=Math.max(8,Math.min(rect.bottom+5,window.innerHeight-Math.min(460,window.innerHeight-16)))+'px';
    button.setAttribute('aria-expanded','true');$('#fpdValueSearch').focus();
  }
  $('#fpdHead').onclick=e=>{const b=e.target.closest('[data-column]');if(b)openMenu(b.dataset.column,b);};
  $('#fpdCloseColumn').onclick=closeMenu;
  $('#fpdValueSearch').oninput=()=>{const q=grid.fold($('#fpdValueSearch').value);menuState.selected=q?new Set(menuState.values.filter(v=>grid.fold(v||'(Em branco)').includes(q))):new Set(filters[menuState.key]||menuState.values);drawChoices();};
  $('#fpdValueOptions').onchange=e=>{if(!e.target.matches('[data-choice]'))return;const value=menuState.values[Number(e.target.dataset.choice)];if(e.target.checked)menuState.selected.add(value);else menuState.selected.delete(value);$('#fpdChoiceCount').textContent=`${menuState.selected.size} de ${menuState.values.length} valores selecionados`;};
  $('#fpdSelectValues').onclick=()=>{const q=grid.fold($('#fpdValueSearch').value);menuState.values.filter(v=>grid.fold(v||'(Em branco)').includes(q)).forEach(v=>menuState.selected.add(v));drawChoices();};
  $('#fpdClearValues').onclick=()=>{const q=grid.fold($('#fpdValueSearch').value);menuState.values.filter(v=>grid.fold(v||'(Em branco)').includes(q)).forEach(v=>menuState.selected.delete(v));drawChoices();};
  $('#fpdApplyColumn').onclick=()=>{if(menuState.selected.size===menuState.values.length)delete filters[menuState.key];else filters[menuState.key]=new Set(menuState.selected);closeMenu();render();};
  $('#fpdRemoveColumn').onclick=()=>{delete filters[menuState.key];closeMenu();render();};
  for(const [id,direction] of [['#fpdSortAsc','asc'],['#fpdSortDesc','desc']])$(id).onclick=()=>{sort={key:menuState.key,direction};closeMenu();render();};
  $('#fpdActiveFilters').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-clear-sort'))sort=null;else delete filters[b.dataset.clear];render();};
  $('#fpdClearFilters').onclick=()=>{for(const k of Object.keys(filters))delete filters[k];sort=null;$('#fpdSearch').value='';$('#fpdFilter').value='';render();};
  $('#fpdExpand').onclick=()=>{panel.classList.toggle('fpd-expanded');const expanded=panel.classList.contains('fpd-expanded');$('#fpdExpand').textContent=expanded?'Reduzir planilha':'Ampliar planilha';$('#fpdExpand').setAttribute('aria-pressed',String(expanded));closeMenu();};
  document.addEventListener('click',e=>{if(menuState&&!e.target.closest('#fpdColumnMenu')&&!e.target.closest('[data-column]'))closeMenu();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(menuState)closeMenu();else if(panel.classList.contains('fpd-expanded'))$('#fpdExpand').click();}});
  window.addEventListener('resize',closeMenu);
  $('#fpdTableWrap').addEventListener('scroll',closeMenu);
  new MutationObserver(()=>{document.body.classList.toggle('fpd-sheet-active',!panel.hidden&&!!$('#fpdExpand'));if(!$('#fpdExpand'))return;if(panel.hidden){closeMenu();panel.classList.remove('fpd-expanded');$('#fpdExpand').textContent='Ampliar planilha';$('#fpdExpand').setAttribute('aria-pressed','false');}}).observe(panel,{attributes:true,attributeFilter:['hidden']});
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
  async function saveRows(ids){
    if(busy)return;ids=ids.filter(id=>dirty.has(id));if(!ids.length)return;closeMenu();lock(true);let saved=0;
    try{for(const id of ids){const row=rows.find(r=>r.id===id);message(`Salvando ${saved+1} de ${ids.length} linha(s)...`);const r=await db.rpc('save_fpd_row',{p_id:id,p_version:row.annotation_version,p_status:row.treatment_status,p_notes:row.notes,p_customer_name:row.customer_name??null});if(r.error)throw r.error;Object.assign(row,Array.isArray(r.data)?r.data[0]:r.data);dirty.delete(id);saved++;}message(`${saved} linha(s) salva(s).`);}
    catch(e){message(`Salvas: ${saved} de ${ids.length}. Não foi possível concluir: ${e.message} As alterações pendentes continuam na grade.`,true);}
    finally{lock(false);render();}
  }
  $('#fpdRows').addEventListener('input',e=>{const field=e.target.dataset.field;if(!field)return;const tr=e.target.closest('tr'),id=tr.dataset.id;rows.find(r=>r.id===id)[field]=e.target.value;dirty.add(id);tr.classList.add('fpd-dirty');tr.querySelector('[data-save]').hidden=false;if(field==='treatment_status')e.target.closest('td').className='fpd-manual fpd-editable '+statusTone(e.target.value);controls();});
  $('#fpdRows').addEventListener('keydown',e=>{if(!e.target.dataset.field)return;if(e.key==='Enter'){e.preventDefault();saveRows([e.target.closest('tr').dataset.id]);}if(e.key==='ArrowDown'||e.key==='ArrowUp'){const adjacent=e.key==='ArrowDown'?e.target.closest('tr').nextElementSibling:e.target.closest('tr').previousElementSibling;const input=adjacent?.querySelector(`[data-field="${e.target.dataset.field}"]`);if(input){e.preventDefault();input.focus();}}});
  $('#fpdRows').addEventListener('click',e=>{const b=e.target.closest('[data-save]');if(b)saveRows([b.dataset.save]);});
  $('#fpdSaveAll').onclick=()=>saveRows([...dirty]);
  $('#fpdImport').onclick=()=>$('#fpdFile').click();$('#fpdFile').onchange=e=>{const file=e.target.files[0];e.target.value='';pick(file);};$('#fpdConfirm').onclick=importFile;
  $('#fpdCancel').onclick=()=>{preview=null;$('#fpdPreview').hidden=true;message('');};
  $('#fpdReload').onclick=()=>{if(dirty.size&&!confirm('Descartar alterações ainda não salvas e recarregar a tabela?'))return;load();};
  for(const id of ['#fpdSearch','#fpdFilter'])$(id).addEventListener('input',()=>{render();});
  window.addEventListener('beforeunload',e=>{if(dirty.size||busy){e.preventDefault();e.returnValue='';}});
  lock(true);Promise.resolve(window.authReady).then(user=>{if(!user||user.profile?.role!=='admin'){panel.innerHTML='<p class="fpd-message">O FPD está disponível somente para administradores.</p>';return;}db=window.supabaseClient;load();}).catch(()=>message('Não foi possível validar seu acesso. Atualize a página.',true));
})();
