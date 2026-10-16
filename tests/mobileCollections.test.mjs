import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionPayload } from '../src/utils/mobileCollections.js';
const form = { amount:'250.25',method:'CASH',payment_reference:'',giro_number:'',bank:'',due_date:'' };
const invoice = {id:7,available_to_collect:'500.00'};
test('same collection form supports call plan and outside visit with exact amounts',()=>{
  const outside=collectionPayload(form,invoice,'','uuid');
  assert.equal(outside.amount,250.25);assert.equal(outside.entry_origin,'OUTSIDE_CALL_PLAN');assert.equal(outside.id_kunjungan,null);
  const visit=collectionPayload(form,invoice,'19','uuid');
  assert.equal(visit.entry_origin,'CALL_PLAN');assert.equal(visit.id_kunjungan,19);
});
test('collection validates precision, availability, transfer and giro',()=>{
  for(const amount of ['0','-1','500.01','1.001','NaN'])assert.throws(()=>collectionPayload({...form,amount},invoice,'','key'));
  assert.throws(()=>collectionPayload({...form,method:'TRANSFER'},invoice,'','key'));
  assert.throws(()=>collectionPayload({...form,method:'GIRO'},invoice,'','key'));
  assert.throws(()=>collectionPayload(form,invoice,'x','key'));
  assert.equal(collectionPayload({...form,method:'GIRO',giro_number:'BG1',bank:'Bank',due_date:'2026-11-01'},invoice,'','key').bank,'Bank');
});
