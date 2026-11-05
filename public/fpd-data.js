/* Pure import validation; no CONTACT writes. SheetJS 0.20.3 is vendored locally. */
(function(root){
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  const fields = {
    invoice_no:['NUM_FATURA','FATURA','NUMERO DA FATURA'], contract_number:['NUM_CONTRATO','CONTRATO','NUMERO DO CONTRATO'],
    collection_type:['DSC_TIPO_COBRANCA','TIPO COBRANCA'], installation_date_text:['DAT_INSTALACAO','DATA INSTALACAO'],
    due_date_text:['DAT_VENCIMENTO','VENCIMENTO'], payment_date_text:['DAT_PAGAMENTO','PAGAMENTO'],
    collection_situation:['DSC_SITUACAO_COBRANCA','SITUACAO COBRANCA'], installation_month:['NR_ANO_MES_INST','MES INSTALACAO'],
    days_open:['DIAS_EM_ABERTO','DIAS EM ABERTO'], follow_up:['ACOMPANHAMENTO']
  };
  function parse(grid){
    const headerIndex=grid.findIndex(row=>fields.contract_number.some(a=>row.some(v=>normalize(v)===normalize(a))));
    if(headerIndex<0) throw Error('Coluna de contrato não encontrada. Use NUM_CONTRATO ou Número do contrato.');
    const header=grid[headerIndex].map(normalize), indexes={};
    for(const [field,aliases] of Object.entries(fields)) indexes[field]=header.findIndex(v=>aliases.some(a=>normalize(a)===v));
    if(indexes.invoice_no<0) throw Error('Coluna de fatura não encontrada. Use NUM_FATURA.');
    const rows=[],keys=new Set();
    for(let i=headerIndex+1;i<grid.length;i++){
      const raw=grid[i]; if(!raw.some(v=>String(v??'').trim())) continue;
      const r={};for(const [f,index] of Object.entries(indexes)) r[f]=index<0?'':String(raw[index]??'').trim();
      r.contract_number=r.contract_number.toUpperCase();
      const invoice=r.invoice_no.match(/^([1-4])(?:\s*[°ºªo.]?\s*(?:FATURA)?)?$/i);
      if(!r.contract_number||r.contract_number.length>100||!invoice) throw Error(`Linha ${i+1}: informe um contrato e uma fatura de 1 a 4 válidos.`);
      r.invoice_no=Number(invoice[1]);
      if(r.days_open!==''&&!/^-?\d+$/.test(r.days_open)) throw Error(`Linha ${i+1}: dias em aberto inválidos.`);
      r.days_open=r.days_open===''?null:Number(r.days_open);
      if(r.days_open!==null&&(!Number.isSafeInteger(r.days_open)||Math.abs(r.days_open)>2147483647)) throw Error(`Linha ${i+1}: dias em aberto fora do limite.`);
      const key=JSON.stringify([r.contract_number,r.invoice_no]);
      if(keys.has(key)) throw Error(`Linha ${i+1}: contrato ${r.contract_number}, fatura ${r.invoice_no} duplicados. Revise a planilha.`);
      keys.add(key);rows.push(r);
    }
    if(!rows.length||rows.length>10000) throw Error('A planilha deve conter de 1 a 10.000 linhas.');
    return rows;
  }
  root.contactFpdData={parse,normalize};
})(typeof window==='undefined'?globalThis:window);
