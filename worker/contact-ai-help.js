// CONTACT IA fase 1: ajuda sobre navegação, sem consultar dados pessoais nem executar ações.
const FAQ=[
 {terms:['cadastrar venda','lançar venda','nova venda','registrar venda'],answer:'Para cadastrar uma venda, abra Minhas Vendas e procure a opção de novo cadastro. Preencha os dados solicitados e confirme antes de salvar.'},
 {terms:['consultar venda','buscar venda','ver venda','minhas vendas'],answer:'Acesse Minhas Vendas. Use os filtros e a busca da tela para localizar e acompanhar os cadastros permitidos ao seu perfil.'},
 {terms:['indicação','indicar','indicacoes'],answer:'Abra Central de Indicações no menu para acompanhar as indicações às quais seu perfil tem acesso. A página pública permite que clientes enviem novas indicações.'},
 {terms:['contatos','prospecção','prospectar'],answer:'Acesse Contatos para consultar a base de prospecção, aplicar filtros e registrar as tratativas disponíveis ao seu perfil.'},
 {terms:['cobrança','boleto','fpd'],answer:'Abra Cobranças no menu. A área FPD reúne o acompanhamento dos boletos e das tratativas, conforme suas permissões.'},
 {terms:['meta','vendas do dia'],answer:'A meta diária da equipe aparece no cabeçalho do CONTACT para os perfis autorizados. Consulte o indicador para acompanhar o progresso.'},
 {terms:['campanha sms','sms'],answer:'Campanhas SMS fica na área de Cobranças. A disponibilidade de envio depende da configuração e das permissões do sistema.'},
 {terms:['analítico','relatório','produtividade'],answer:'Acesse Analítico para consultar indicadores comerciais, como cidades e planos mais vendidos, conforme seu acesso.'}
];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export async function contactAiHelp(request,env,fetchApi=fetch){
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return json({error:'service_unavailable'},503);
 const token=request.headers.get('authorization')||'';
 if(!/^Bearer [^\s]+$/i.test(token))return json({error:'authentication_required'},401);
 let user;
 try{
  const auth=await fetchApi(env.SUPABASE_URL+'/auth/v1/user',{headers:{authorization:token,apikey:env.SUPABASE_PUBLISHABLE_KEY}});
  if(!auth.ok)return json({error:'invalid_session'},401);
  user=await auth.json();
  if(!user?.id)return json({error:'invalid_session'},401);
 }catch{return json({error:'authentication_unavailable'},503);}
 let body;
 try{body=await request.json()}catch{return json({error:'invalid_json'},400)}
 const message=typeof body?.message==='string'?body.message.trim():'';
 if(!message||message.length>600)return json({error:'invalid_message'},400);
 const query=normalize(message);
 const found=FAQ.find(entry=>entry.terms.some(term=>query.includes(normalize(term))));
 const fallback=found?.answer||'Posso ajudar com Minhas Vendas, Contatos, Cobranças, FPD, Central de Indicações, Analítico e Campanhas SMS. Qual dessas áreas você quer conhecer?';
 // Explicit opt-in to OpenAI by configuring a secret. Never forward conversation history or contact records.
 if(!env.OPENAI_API_KEY)return json({answer:fallback,mode:'guide'});
 try{
  const response=await fetchApi('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify({model:env.CONTACT_AI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:350,instructions:'Você é a CONTACT IA, assistente de ajuda em português brasileiro. Responda somente sobre navegação e uso do CONTACT. Não afirme ter realizado ações, não solicite senhas, CPFs ou dados pessoais. Se não souber, admita e oriente a procurar o administrador. Use apenas estas informações verificadas: '+FAQ.map(x=>x.answer).join(' '),input:message})});
  if(!response.ok)return json({answer:fallback,mode:'guide'});
  const result=await response.json();
  const answer=(result.output||[]).flatMap(item=>item.content||[]).filter(part=>part.type==='output_text').map(part=>part.text).join('\n').trim();
  return json({answer:answer||fallback,mode:answer?'ai':'guide'});
 }catch{return json({answer:fallback,mode:'guide'});}
}
