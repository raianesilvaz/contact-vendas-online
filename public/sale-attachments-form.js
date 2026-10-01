(()=>{
  const input=document.querySelector('#saleAttachments');
  const list=document.querySelector('#saleAttachmentSelection');
  const allowed=new Set(['application/pdf','image/jpeg','image/png','image/webp']);
  const limit=10*1024*1024;
  let pending=[];
  function render(){list.replaceChildren();pending.forEach(file=>{const item=document.createElement('li');item.textContent=`${file.name} · ${(file.size/1048576).toFixed(1).replace('.',',')} MB`;list.appendChild(item)})}
  input.addEventListener('change',()=>{
    const files=[...input.files];
    if(files.length>5||files.some(file=>!allowed.has(file.type)||!file.size||file.size>limit)){
      input.value='';
      pending=[];
      render();
      window.showSaleAttachmentError?.('Escolha até 5 arquivos PDF, JPG, PNG ou WEBP, com até 10 MB cada.');
      return;
    }
    pending=files;
    render();
  });
  window.saleAttachments={
    hasFiles:()=>pending.length>0,
    count:()=>pending.length,
    reset:()=>{pending=[];input.value='';render()},
    async upload(saleId){
      const failed=[];
      for(const file of pending){
        const safeName=file.name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'arquivo';
        const path=`${saleId}/${crypto.randomUUID()}-${safeName}`;
        const{error}=await window.supabaseClient.storage.from('sale-attachments').upload(path,file,{contentType:file.type,upsert:false});
        if(error)failed.push(file);
      }
      pending=failed;
      input.value='';
      render();
      return{failed:failed.length};
    }
  };
})();
