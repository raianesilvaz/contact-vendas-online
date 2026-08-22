(()=>{
  const form=document.querySelector('#saleForm');
  if(!form||!window.supabaseClient)return;

  const contactCard=[...form.querySelectorAll('.form-card')].find(card=>card.querySelector('.section-heading h2')?.textContent.trim()==='Endereço e contato');
  const grid=contactCard?.querySelector('.form-grid');
  if(grid&&!form.elements.seller_note){
    const label=document.createElement('label');
    label.className='field field-full seller-note-field';
    label.innerHTML='<span>Observação da venda <small>(opcional)</small></span><textarea name="seller_note" rows="4" maxlength="1000" placeholder="Informe aqui alguma observação importante para o BKO."></textarea><small class="seller-note-help">Use este campo apenas para informações importantes sobre esta venda.</small>';
    grid.appendChild(label);
    const style=document.createElement('style');
    style.textContent='.seller-note-field textarea{width:100%;min-height:96px;resize:vertical;border:1px solid #d9dee7;border-radius:9px;padding:12px 14px;font:inherit;color:#273349;background:#fff}.seller-note-field textarea:focus{outline:none;border-color:#ff8b55;box-shadow:0 0 0 3px rgba(255,100,45,.08)}.seller-note-help{display:block;margin-top:6px;color:#8993a6;font-size:10px;line-height:1.35}';
    document.head.appendChild(style);
  }

  const originalFrom=window.supabaseClient.from.bind(window.supabaseClient);
  window.supabaseClient.from=(table)=>{
    const builder=originalFrom(table);
    if(table!=='sales'||!builder?.insert)return builder;
    const originalInsert=builder.insert.bind(builder);
    builder.insert=(values,...args)=>{
      const note=form.elements.seller_note?.value?.trim()||null;
      if(Array.isArray(values)) values=values.map(item=>({...item,seller_note:note}));
      else if(values&&typeof values==='object') values={...values,seller_note:note};
      return originalInsert(values,...args);
    };
    return builder;
  };
})();