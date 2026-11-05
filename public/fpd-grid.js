/* Spreadsheet columns, exact-value column filters and typed ordering. */
(function(root){
  const columns=[
    {key:'invoice_no',label:'Fatura',width:76,type:'number'},
    {key:'contract_number',label:'Contrato',width:90},
    {key:'collection_type',label:'Tipo cobrança',width:80},
    {key:'installation_date_text',label:'Instalação',width:85,type:'date'},
    {key:'due_date_text',label:'Vencimento',width:85,type:'date'},
    {key:'payment_date_text',label:'Pagamento',width:85,type:'date'},
    {key:'collection_situation',label:'Situação cobrança',width:125},
    {key:'installation_month',label:'Ano / mês inst.',width:85,type:'number'},
    {key:'days_open',label:'Dias em aberto',width:80,type:'number'},
    {key:'follow_up',label:'Acompanhamento',width:110},
    {key:'customer_name',label:'Cliente',width:180,manual:true},
    {key:'treatment_status',label:'Status',width:110,manual:true,editable:true},
    {key:'seller_name',label:'Vendedor',width:110,manual:true},
    {key:'notes',label:'Observação',width:180,manual:true,editable:true}
  ];
  const text=v=>String(v??'');
  const fold=v=>text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
  const value=(row,key)=>text(row[key]);
  const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
  function dateValue(v){const br=v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(br)return Number(br[3]+br[2]+br[1]);const iso=v.match(/^(\d{4})-(\d{2})-(\d{2})/);return iso?Number(iso[1]+iso[2]+iso[3]):null;}
  function compare(a,b,col){
    if(a===''||b==='')return a===''?(b===''?0:1):-1;
    if(col.type==='number'&&Number.isFinite(Number(a))&&Number.isFinite(Number(b)))return Number(a)-Number(b);
    if(col.type==='date'){const x=dateValue(a),y=dateValue(b);if(x!==null&&y!==null)return x-y;}
    return collator.compare(a,b);
  }
  function filter(rows,{filters={},search='',quick='',sort=null}={}){
    const q=fold(search).trim();
    const out=rows.filter(r=>(!q||columns.some(c=>fold(value(r,c.key)).includes(q)))&&
      (!quick||(quick==='pending'?!r.treatment_status:quick==='unmatched'?r.match_status!=='matched':!!r.treatment_status))&&
      Object.entries(filters).every(([key,selected])=>selected.has(value(r,key))));
    if(sort){const col=columns.find(c=>c.key===sort.key);if(col)out.sort((a,b)=>compare(value(a,col.key),value(b,col.key),col)*(sort.direction==='desc'?-1:1));}
    return out;
  }
  function choices(rows,key){const col=columns.find(c=>c.key===key)||{};return [...new Set(rows.map(r=>value(r,key)))].sort((a,b)=>compare(a,b,col));}
  root.contactFpdGrid={columns,fold,value,filter,choices};
})(typeof window==='undefined'?globalThis:window);
