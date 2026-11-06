import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../../public/birth-date-mask.js';
const {format,toISO}=globalThis.ContactBirthDate;
test('birth date accepts numbers progressively and adds separators without Tab',()=>{
 assert.deepEqual(['2','22','220','2209','22091','22091995'].map(format),['2','22','22/0','22/09','22/09/1','22/09/1995']);
 assert.equal(format('22/09/1995'),'22/09/1995');assert.equal(format('22abc091995'),'22/09/1995');
 assert.equal(format('22091995123'),'22/09/1995');assert.equal(format(''),'');
});
test('birth date saves ISO without swapping day and month',()=>{
 assert.equal(toISO(format('22091995')),'1995-09-22');assert.equal(toISO('03/04/2000'),'2000-04-03');
 assert.equal(toISO('29/02/2000'),'2000-02-29');assert.equal(toISO('29/02/2024'),'2024-02-29');
});
test('birth date rejects impossible and incomplete dates',()=>{
 for(const value of ['', '22/09/199','31/02/1995','31/04/1995','29/02/1900','29/02/2023','00/09/1995','22/00/1995','22/13/1995','22/09/0000'])assert.equal(toISO(value),null,value);
});
