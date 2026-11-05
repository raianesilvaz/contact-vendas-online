import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../../public/fpd-data.js';
const {parse}=globalThis.contactFpdData;
const header=['NUM_FATURA','NUM_CONTRATO','DIAS_EM_ABERTO','DAT_VENCIMENTO','CLIENTE','STATUS','VENDEDOR','OBS'];
test('accepts the actual workbook headers, formatted invoices and leading zeros',()=>{
 const [r]=parse([['Relatório FPD'],header,['1°FATURA','001234',9,'25/10/2026','Ignored','Ignored','Ignored','Ignored']]);
 assert.equal(r.contract_number,'001234');assert.equal(r.invoice_no,1);assert.equal(r.days_open,9);assert.equal(r.due_date_text,'25/10/2026');
 assert.equal(r.notes,undefined);assert.equal(r.treatment_status,undefined);assert.equal(r.customer_name,undefined);
});
test('rejects duplicate contract/invoice pairs before any replacement',()=>assert.throws(()=>parse([header,['1°FATURA','123'],['1','123']]),/duplicados/));
test('same contract may contain separate invoices',()=>assert.equal(parse([header,['1','123'],['2ª FATURA','123']]).length,2));
test('rejects empty, missing-column, invalid invoice and invalid day inputs',()=>{
 for(const grid of [[],[header],[header,['5','123']],[header,['1','']],[header,['1','123','NaN']],[header,['1','123','1e99']]])assert.throws(()=>parse(grid));
});


// The API role preloads safeupdate, unlike the SQL management connection.
// Regress the exact SQL shape that caused production imports to fail.
test('replacement deletes use explicit FPD ID predicates under the import lock',async()=>{
 const {readFileSync,readdirSync}=await import('node:fs');
 const folder=new URL('../../supabase/migrations/',import.meta.url);
 const file=readdirSync(folder).find(p=>p.endsWith('_fpd_safeupdate_import.sql'));
 const sql=readFileSync(new URL(file,folder),'utf8');
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/delete from public\.fpd_records where id = any\(v_record_ids\)/i);
 assert.match(sql,/delete from public\.fpd_imports where id = any\(v_import_ids\)/i);
 assert.doesNotMatch(sql,/delete from public\.\w+\s*;/i);
 assert.doesNotMatch(sql,/security definer|safeupdate\.enabled\s*=\s*(?:off|false)/i);
 assert.doesNotMatch(sql,/(?:delete from|update|insert into) public\.(?:sales|profiles)\b/i);
});
