// Shared help widget. No privileged actions or customer data access.
(()=>{if(window.__contactAiMounted)return;window.__contactAiMounted=true;
const style=document.createElement('link');style.rel='stylesheet';style.href='contact-ai-widget.css?v=1';document.head.append(style);
function mount(){
 if(document.getElementById('contactAiLauncher'))return;
 const button=document.createElement('button');button.id='contactAiLauncher';button.type='button';button.textContent='✦ Ajuda IA';button.setAttribute('aria-label','Abrir CONTACT IA');
 const panel=document.createElement('section');panel.id='contactAiPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','CONTACT IA — ajuda');
 panel.innerHTML='<header id="contactAiHeader"><strong>✦ CONTACT IA · Ajuda</strong><button id="contactAiClose" type="button" aria-label="Fechar">×</button></header><div id="contactAiMessages" role="log" aria-live="polite"></div><form id="contactAiForm"><input id="contactAiInput" maxlength="600" autocomplete="off" placeholder="Como posso te ajudar?" aria-label="Sua pergunta" required><button id="contactAiSubmit" type="submit">Enviar</button></form>';
 document.body.append(button,panel);
 const log=panel.querySelector('#contactAiMessages'),input=panel.querySelector('#contactAiInput'),send=panel.querySelector('#contactAiSubmit');
 // Do not overlay CONTACT dialogs, sales details, or pop-ups.
 const isBlockingOverlay=element=>{
  if(element===panel||element===button||panel.contains(element)||button.contains(element))return false;
  if(element.closest('#contactAiPanel,#contactAiLauncher'))return false;
  if(element.hidden||element.getAttribute('aria-hidden')==='true'||element.inert)return false;
  const style=getComputedStyle(element);
  if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
  if(element.matches('dialog[open], [role="dialog"], [aria-modal="true"], .modal.show, .modal.active, .modal.open, .modal.is-open, .modal[style*="display: block"], .modal[style*="display:flex"], .modal-overlay, .modal-backdrop, .popup-overlay, .popup.active, .drawer.open, .drawer.active, [class*="modal-overlay"], [class*="modal-backdrop"]'))return true;
  if(element.matches('[id*="modal" i], [id*="popup" i], [class*="modal" i], [class*="popup" i]')){
   const rect=element.getBoundingClientRect();
   return rect.width>180&&rect.height>120&&(style.position==='fixed'||style.position==='absolute')&&rect.bottom>0&&rect.top<innerHeight;
  }
  return false;
 };
 let scheduled=false;
 function updateVisibility(){scheduled=false;const blocked=Array.from(document.querySelectorAll('dialog,[role="dialog"],[aria-modal="true"],.modal,.modal-overlay,.modal-backdrop,.popup,.popup-overlay,.drawer,[id*="modal" i],[id*="popup" i],[class*="modal" i],[class*="popup" i]')).some(isBlockingOverlay);button.hidden=blocked;if(blocked)panel.hidden=true;}
 function scheduleVisibility(){if(scheduled)return;scheduled=true;requestAnimationFrame(updateVisibility);}
 const overlayObserver=new MutationObserver(scheduleVisibility);
 overlayObserver.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','open','aria-hidden','aria-modal']});
 document.addEventListener('click',scheduleVisibility,true);
 document.addEventListener('keydown',scheduleVisibility,true);
 scheduleVisibility();

 function add(text,who){const p=document.createElement('p');p.className=who;p.textContent=text;log.append(p);log.scrollTop=log.scrollHeight;}
 add('Olá! Posso orientar você sobre Minhas Vendas, Contatos, Cobranças, Indicações e outras telas do CONTACT. Não consigo executar tarefas nesta fase.','assistant');
 button.addEventListener('click',()=>{panel.hidden=!panel.hidden;if(!panel.hidden)input.focus();});
 panel.querySelector('#contactAiClose').addEventListener('click',()=>{panel.hidden=true;button.focus();});
 panel.querySelector('#contactAiForm').addEventListener('submit',async event=>{
  event.preventDefault();const question=input.value.trim();if(!question||send.disabled)return;input.value='';add(question,'user');send.disabled=true;
  try{
   const session=await window.supabaseClient?.auth?.getSession();const token=session?.data?.session?.access_token;
   if(!token){add('Entre no CONTACT para usar a ajuda.','assistant');return;}
   const response=await fetch('/api/contact-ai/help',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({message:question})});
   if(!response.ok)throw Error('unavailable');
   const data=await response.json();add(data.answer||'Não consegui encontrar uma orientação.','assistant');
  }catch{add('Não foi possível consultar a ajuda agora. Tente novamente mais tarde.','assistant');}finally{send.disabled=false;input.focus();}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();