// A batch invoice can contain several principal orders. Review the printed
// invoice once, while adding the balances of its child orders.
export function groupLphInvoices(details = []) {
  const grouped = new Map();
  for (const line of details) {
    const key = String(line.id);
    if (!grouped.has(key)) grouped.set(key, { ...line, sisa_tagihan: 0, jumlah_tagihan: 0, total_bayar: 0 });
    const invoice = grouped.get(key);
    for (const field of ['sisa_tagihan', 'jumlah_tagihan', 'total_bayar']) invoice[field] += Number(line[field] || 0);
  }
  return [...grouped.values()].map((invoice) => ({
    ...invoice,
    // The LPH print uses the outstanding amount captured at issue time,
    // not today's gross invoice total; count the header amount only once.
    jumlah_tagihan: invoice.jumlah_tagihan_lph == null ? invoice.jumlah_tagihan : Number(invoice.jumlah_tagihan_lph),
  }));
}

export function allLphInvoicesChecked(details, checked) {
  return details.length > 0 && details.every((line) => checked[String(line.id)] === true);
}
