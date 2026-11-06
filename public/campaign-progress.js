/* Reporting only: a stored running flag is not evidence of live sending. */
(function(root){
 const terminal=new Set(['sent','error','cancelled','canceled']);
 function summarize(items,quantity=items.length){
  const count=status=>items.filter(x=>x.status===status).length;
  const sent=count('sent'),errors=count('error'),cancelled=count('cancelled')+count('canceled'),sending=count('sending');
  const total=Math.max(Number(quantity)||0,items.length),unknown=Math.max(0,total-items.length)+items.filter(x=>!terminal.has(x.status)&&!['waiting','sending'].includes(x.status)).length;
  const waiting=count('waiting')+unknown,processed=sent+errors+cancelled;
  return {total,sent,errors,cancelled,sending,waiting,processed,percent:total?Math.round(processed/total*100):0,settled:total>0&&processed===total};
 }
 root.ContactCampaignProgress={summarize};
})(typeof window==='undefined'?globalThis:window);
