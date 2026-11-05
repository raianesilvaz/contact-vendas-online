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

import '../../public/fpd-grid.js';
const grid=globalThis.contactFpdGrid;
const sheetRows=[
 {id:1,contract_number:'10',seller_name:'Luana',treatment_status:'',days_open:9,due_date_text:'25/10/2026',customer_name:'Márcia'},
 {id:2,contract_number:'20',seller_name:'Luana',treatment_status:'Pago',days_open:61,due_date_text:'01/11/2026'},
 {id:3,contract_number:'30',seller_name:'Ana',treatment_status:'',days_open:2,due_date_text:'03/09/2026'}
];
test('spreadsheet combines column filters across all records and accepts blanks',()=>{
 const result=grid.filter(sheetRows,{filters:{seller_name:new Set(['Luana']),treatment_status:new Set([''])}});
 assert.deepEqual(result.map(r=>r.id),[1]);
 assert.deepEqual(grid.filter(sheetRows,{filters:{seller_name:new Set()}}),[]);
 assert.equal(grid.filter(Array.from({length:540},(_,i)=>({...sheetRows[0],id:i})),{filters:{seller_name:new Set(['Luana'])}}).length,540);
});
test('spreadsheet filters use exact cell values and preserve zero in choices',()=>{
 assert.equal(grid.filter(sheetRows,{filters:{seller_name:new Set(['Luan'])}}).length,0);
 assert.deepEqual(grid.choices([{days_open:0},{days_open:null},{days_open:9}],'days_open'),['0','9','']);
});
test('spreadsheet orders numbers and Brazilian dates, with accent-insensitive search',()=>{
 assert.deepEqual(grid.filter(sheetRows,{sort:{key:'days_open',direction:'asc'}}).map(r=>r.days_open),[2,9,61]);
 assert.deepEqual(grid.filter(sheetRows,{sort:{key:'due_date_text',direction:'asc'}}).map(r=>r.id),[3,1,2]);
 assert.deepEqual(grid.filter(sheetRows,{search:'marcia'}).map(r=>r.id),[1]);
 assert.deepEqual(grid.filter(sheetRows,{sort:{key:'contract_number',direction:'desc'}}).map(r=>r.id),[3,2,1]);
});
