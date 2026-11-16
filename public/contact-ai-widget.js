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