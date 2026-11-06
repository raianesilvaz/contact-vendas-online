/* Idempotent metadata finalization only; no sending endpoint is used here. */
(function(root){
 async function finish(runId){
  let timer;
  try{
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('A confirmação demorou. Atualize o acompanhamento e tente Finalizar novamente; nenhuma mensagem será reenviada.')),12000);});
   const result=await Promise.race([root.supabaseClient.rpc('finish_processed_campaign',{p_run_id:runId}),timeout]);
   if(result.error)throw result.error;
   return result.data;
  }finally{clearTimeout(timer);}
 }
 root.ContactCampaignFinalizer={finish};
})(typeof window==='undefined'?globalThis:window);
