import test from 'node:test';
import assert from 'node:assert/strict';
import { groupLphInvoices, allLphInvoicesChecked } from '../src/utils/lphHandover.js';

test('parent invoice reviewed once; printed LPH amount not repeated for child orders', () => {
  const rows = groupLphInvoices([
    { id: 1, jumlah_tagihan_lph: 200000, jumlah_tagihan: 150000, sisa_tagihan: 80000, total_bayar: 70000 },
    { id: 1, jumlah_tagihan_lph: 200000, jumlah_tagihan: 150000, sisa_tagihan: 120000, total_bayar: 30000 },
    { id: 2, jumlah_tagihan_lph: 100000, jumlah_tagihan: 100000, sisa_tagihan: 0, total_bayar: 100000 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].jumlah_tagihan, 200000);
  assert.equal(rows[0].sisa_tagihan, 200000);
  assert.equal(rows[0].total_bayar, 100000);
});

test('all selected by default enables accept; any unchecked invoice blocks it', () => {
  const rows = [{ id: 1 }, { id: 2 }];
  assert.equal(allLphInvoicesChecked(rows, { 1: true, 2: true }), true);
  assert.equal(allLphInvoicesChecked(rows, { 1: true, 2: false }), false);
  assert.equal(allLphInvoicesChecked(rows, {}), false);
  assert.equal(allLphInvoicesChecked([], {}), false);
});

test('legacy API fallback sums child gross totals and retains zero printed amount', () => {
  assert.equal(groupLphInvoices([{id:1,jumlah_tagihan:10},{id:1,jumlah_tagihan:20}])[0].jumlah_tagihan,30);
  assert.equal(groupLphInvoices([{id:1,jumlah_tagihan_lph:0,jumlah_tagihan:100}])[0].jumlah_tagihan,0);
});
