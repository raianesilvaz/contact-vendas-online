(()=>{
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  let scheduled=false;

  // Corrige a busca de Minhas Vendas / Minhas Indicações para considerar o contrato.
  // Mantém exatamente os mesmos filtros de responsável, período e status da tela original.
  if(typeof render==='function'){
    render=function(){
      const term=normalize(search.value.trim());
      const responsibleSales=responsibleFilter==='all'?sales:sales.filter(s=>s.seller_id===responsibleFilter);
      const periodSales=responsibleSales.filter(matchesSalesPeriod);
      const visible=periodSales.filter(s=>(filter==='todos'||s.status===filter)&&normalize(`${s.customer_name} ${s.cpf} ${s.plan_name} ${s.protocol} ${s.contract_number||''}`).includes(term));
      list.innerHTML=visible.map(card).join('');
      list.hidden=!visible.length;
      emptyList.hidden=!!visible.length;
      document.querySelector('#totalCount').textContent=periodSales.length;
      document.querySelector('#pendingCount').textContent=periodSales.filter(s=>['pendente','em_analise','aguardando_hp','pendente_aceite','pendente_instalacao'].includes(s.status)).length;
      document.querySelector('#connectedCount').textContent=periodSales.filter(s=>s.status==='conectado').length;
      document.querySelector('#rejectedCount').textContent=periodSales.filter(s=>['reprovada','cancelada'].includes(s.status)).length;
      document.querySelector('#emptyListMessage').textContent=periodSales.length?'Tente alterar a busca ou o filtro selecionado.':sales.length?'Nenhuma venda foi lançada no período selecionado.':'Cadastre a primeira venda para começar o acompanhamento.';
    };
  }

  function sync(){
    scheduled=false;
    const panel=document.querySelector('#detailPanel');
    if(!panel?.classList.contains('open'))return;

    const headerText=panel.querySelector('.detail-header p')?.textContent||'';
    const match=headerText.match(/Venda\s*#(\d+)/i);
    if(!match)return;

    const installationSection=[...panel.querySelectorAll('.detail-section')].find(section=>/endere[cç]o de instala[cç][aã]o/i.test(section.querySelector('h3')?.textContent||''));
    const grid=installationSection?.querySelector('.detail-grid');
    if(!grid)return;

    [...grid.querySelectorAll('.detail-item > span')].forEach(label=>{
      if(label.textContent.trim().toLowerCase()==='complemento')label.textContent='Complemento do endereço';
    });

    const protocol=Number(match[1]);
    const sale=typeof sales!=='undefined'&&Array.isArray(sales)?sales.find(item=>Number(item.protocol)===protocol):null;
    const note=sale?.seller_note?.trim()||'';
    const existing=grid.querySelector('.seller-note-sale');

    if(!note){
      if(existing)existing.remove();
      return;
    }

    if(existing){
      const current=existing.querySelector('strong')?.textContent||'';
      if(current===note)return;
      existing.innerHTML=`<span>Observação da venda</span><strong>${escapeHtml(note)}</strong>`;
      return;
    }

    const box=document.createElement('div');
    box.className='seller-note-sale detail-item wide';
    box.innerHTML=`<span>Observação da venda</span><strong>${escapeHtml(note)}</strong>`;
    grid.appendChild(box);
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(sync);
  }

  new MutationObserver(schedule).observe(document.querySelector('#detailPanel')||document.body,{childList:true,subtree:true});
  schedule();
})();