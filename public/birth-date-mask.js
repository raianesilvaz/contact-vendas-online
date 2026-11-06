/* Numeric typing for birth date on the new-sale form only. */
(function(root){
  function format(value){
    const digits=String(value??'').replace(/\D/g,'').slice(0,8);
    return digits.slice(0,2)+(digits.length>2?'/'+digits.slice(2,4):'')+(digits.length>4?'/'+digits.slice(4):'');
  }
  function toISO(value){
    const match=String(value??'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!match)return null;
    const [,dd,mm,yyyy]=match,day=Number(dd),month=Number(mm),year=Number(yyyy);
    if(year<1||month<1||month>12||day<1||day>31)return null;
    const date=new Date(0);date.setUTCHours(0,0,0,0);date.setUTCFullYear(year,month-1,day);
    if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return null;
    return `${yyyy}-${mm}-${dd}`;
  }
  root.ContactBirthDate={format,toISO};
  if(typeof document==='undefined')return;
  const field=document.querySelector('#saleForm input[name="nascimento"]');
  if(!field)return;
  function update(caretDigits){
    field.value=format(field.value);
    field.setCustomValidity(!field.value||toISO(field.value)?'':'Informe uma data válida no formato DD/MM/AAAA.');
    if(caretDigits!==undefined){let position=0,count=0;while(position<field.value.length&&count<caretDigits){if(/\d/.test(field.value[position]))count++;position++;}field.setSelectionRange(position,position);}
  }
  field.addEventListener('input',()=>{const count=field.value.slice(0,field.selectionStart??field.value.length).replace(/\D/g,'').length;update(count);});
  field.addEventListener('beforeinput',event=>{
    const pos=field.selectionStart;if(pos!==field.selectionEnd)return;
    if(event.inputType==='deleteContentBackward'&&pos>0&&field.value[pos-1]==='/'){
      event.preventDefault();const prefix=field.value.slice(0,pos-2);field.value=prefix+field.value.slice(pos);update(prefix.replace(/\D/g,'').length);field.dispatchEvent(new Event('input',{bubbles:true}));
    }
  });
  field.addEventListener('change',()=>update());
  field.form.addEventListener('reset',()=>field.setCustomValidity(''));
  update();
})(typeof window==='undefined'?globalThis:window);
