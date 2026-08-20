(()=>{
  const $=s=>document.querySelector(s);
  const parseMoneyValue=value=>{
    const normalized=String(value??'').trim().replace(/\s/g,'').replace(',','.');
    const number=Number(normalized);
    return Number.isFinite(number)?number:0;
  };

  function distributeNegotiatedTotal(){
    const totalInput=$('#agreementTotal');
    if(!totalInput)return;
    const total=parseMoneyValue(totalInput.value);
    if(total<=0)return;

    const totalCents=Math.round(total*100);
    const base=Math.floor(totalCents/3);
    const remainder=totalCents-(base*3);
    const cents=[base,base,base];
    for(let i=0;i<remainder;i++)cents[i]+=1;

    cents.forEach((value,index)=>{
      const input=$(`[data-reneg-value="${index+1}"]`);
      if(input)input.value=(value/100).toFixed(2);
    });
  }

  const totalInput=$('#agreementTotal');
  if(totalInput){
    totalInput.addEventListener('input',distributeNegotiatedTotal);
    totalInput.addEventListener('change',distributeNegotiatedTotal);
  }

  const saveButton=$('#saveAgreement');
  if(saveButton){
    saveButton.addEventListener('click',event=>{
      const total=parseMoneyValue($('#agreementTotal')?.value);
      if(total<=0)return;
      const sum=[1,2,3].reduce((acc,n)=>acc+parseMoneyValue($(`[data-reneg-value="${n}"]`)?.value),0);
      if(Math.abs(sum-total)>0.009){
        event.preventDefault();
        event.stopImmediatePropagation();
        const toast=$('#financeToast');
        if(toast){
          toast.textContent=`A soma das parcelas (${sum.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}) precisa ser igual ao total negociado (${total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}).`;
          toast.classList.add('show');
          setTimeout(()=>toast.classList.remove('show'),3500);
        }
      }
    },true);
  }
})();
