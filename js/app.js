(function () {
'use strict';
var KEY = 'pharmacare_v2', TKEY = 'pharmacare_theme';
var S = { meds: [], sales: [], settings: { shop: 'PharmaCare', cur: 'Rs', tax: 0, low: 10 } };
try { var raw = JSON.parse(localStorage.getItem(KEY)); if (raw && raw.meds) S = raw; } catch (e) {}
var save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ---------- helpers ---------- */
var $ = function (s) { return document.querySelector(s); };
var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var fmt = function (n) { return S.settings.cur + ' ' + Math.round(n).toLocaleString('en-US'); };
var iso = function (d) { return d.toISOString().slice(0, 10); };
var today = function () { return iso(new Date()); };
var daysLeft = function (d) { return Math.ceil((new Date(d) - new Date(today())) / 864e5); };
var addDays = function (n) { var d = new Date(); d.setDate(d.getDate() + n); return d; };
var find = function (id) { return S.meds.find(function (m) { return m.id === +id; }); };
function toast(t) { var el = $('#toast'); el.textContent = t; el.classList.add('show'); setTimeout(function () { el.classList.remove('show'); }, 2200); }
function openModal(h) { $('#modal').innerHTML = h; $('#modal').showModal(); }
function closeModal() { $('#modal').close(); }
function download(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; a.click(); }
function csv(rows) { return rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'); }
function expTag(d) { var n = daysLeft(d); return n < 0 ? '<span class="tag t-bad">Expired</span>' : n <= 90 ? '<span class="tag t-warn">' + n + ' days left</span>' : '<span class="tag t-ok">Valid</span>'; }
function stockTag(m) { return m.qty <= 0 ? '<span class="tag t-bad">Out of stock</span>' : m.qty <= m.min ? '<span class="tag t-warn">Low stock</span>' : '<span class="tag t-ok">In stock</span>'; }
function profitOf(s) { return s.items.reduce(function (a, i) { return a + (i.price - i.cost) * i.qty; }, 0) - (s.disc || 0); }

/* ---------- views ---------- */
var V = {}, T = { dashboard: 'Dashboard', pos: 'Point of Sale', inventory: 'Inventory', sales: 'Sales History', settings: 'Settings' };
var view = function (h) { $('#view').innerHTML = h; };

V.dashboard = function () {
  var t = today(), y = iso(addDays(-1));
  var sum = function (day, f) { return S.sales.filter(function (s) { return s.date.slice(0, 10) === day; }).reduce(function (a, s) { return a + f(s); }, 0); };
  var rev = sum(t, function (s) { return s.total; }), prev = sum(y, function (s) { return s.total; }), prof = sum(t, profitOf);
  var delta = prev ? Math.round((rev - prev) / prev * 100) : null;
  var val = S.meds.reduce(function (a, m) { return a + m.qty * m.cost; }, 0);
  var low = S.meds.filter(function (m) { return m.qty <= m.min; });
  var exp = S.meds.filter(function (m) { return daysLeft(m.expiry) <= 90; }).sort(function (a, b) { return a.expiry < b.expiry ? -1 : 1; });
  var tally = {}; S.sales.filter(function (s) { return daysLeft(s.date.slice(0, 10)) >= -30; }).forEach(function (s) { s.items.forEach(function (i) { tally[i.name] = (tally[i.name] || 0) + i.qty; }); });
  var top = Object.keys(tally).map(function (k) { return [k, tally[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
  var days = [], max = 1;
  for (var k = 6; k >= 0; k--) { var d = iso(addDays(-k)); var v = sum(d, function (s) { return s.total; }); days.push([d, v]); if (v > max) max = v; }
  var bars = days.map(function (x, i) { var h = Math.round(x[1] / max * 130), X = 20 + i * 76; return '<rect class="b" x="' + X + '" y="' + (150 - h) + '" width="46" height="' + h + '" rx="6"/><text class="t" x="' + (X + 23) + '" y="' + (144 - h) + '" text-anchor="middle">' + (x[1] ? Math.round(x[1] / 1000 * 10) / 10 + 'k' : '') + '</text><text x="' + (X + 23) + '" y="170" text-anchor="middle">' + new Date(x[0]).toLocaleDateString('en-US', { weekday: 'short' }) + '</text>'; }).join('');
  var rows = function (a, f) { return a.length ? '<div class="list">' + a.slice(0, 6).map(f).join('') + '</div>' : '<div class="empty">All clear.</div>'; };
  view('<div class="kpis">' +
    '<div class="card kpi"><span>Today\'s revenue</span><b>' + fmt(rev) + '</b><small class="' + (delta >= 0 ? 'up' : 'down') + '">' + (delta === null ? 'No sales yesterday' : (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta) + '% vs yesterday') + '</small></div>' +
    '<div class="card kpi"><span>Today\'s profit</span><b>' + fmt(prof) + '</b><small class="muted">After discounts</small></div>' +
    '<div class="card kpi"><span>Inventory value</span><b>' + fmt(val) + '</b><small class="muted">' + S.meds.length + ' products</small></div>' +
    '<div class="card kpi"><span>Needs attention</span><b>' + (low.length + exp.length) + '</b><small class="muted">' + low.length + ' low stock, ' + exp.length + ' expiring</small></div></div>' +
    '<div class="grid2"><div class="card"><h2>Revenue, last 7 days</h2><svg class="chart" viewBox="0 0 560 180" role="img" aria-label="Revenue last 7 days">' + bars + '</svg></div>' +
    '<div class="card"><h2>Top sellers (30 days)</h2>' + rows(top, function (x) { return '<div class="li"><span>' + esc(x[0]) + '</span><b>' + x[1] + ' units</b></div>'; }) + '</div></div>' +
    '<div class="grid3"><div class="card"><h2>Low stock</h2>' + rows(low, function (m) { return '<div class="li"><span>' + esc(m.name) + '<small>' + esc(m.company) + '</small></span><span class="tag t-warn">' + m.qty + ' left</span></div>'; }) + '</div>' +
    '<div class="card"><h2>Expiry watch</h2>' + rows(exp, function (m) { return '<div class="li"><span>' + esc(m.name) + '<small>' + m.expiry + '</small></span>' + expTag(m.expiry) + '</div>'; }) + '</div>' +
    '<div class="card"><h2>Quick actions</h2><div class="list"><a class="btn block" href="#pos" style="text-decoration:none;text-align:center">New sale</a><button class="btn ghost block" data-a="medForm">Add medicine</button><button class="btn ghost block" data-a="sample">Load sample data</button></div></div></div>');
};

var iq = '', ifl = 'all';
V.inventory = function () {
  view('<div class="bar"><input id="iq" class="in" style="flex:1;min-width:200px" placeholder="Search by name, company or batch" value="' + esc(iq) + '"><select id="ifl" class="in"><option value="all">All items</option><option value="low">Low stock</option><option value="exp">Expiring in 90 days</option><option value="expired">Expired</option></select><button class="btn ghost" data-a="csvMeds">Export CSV</button><button class="btn" data-a="medForm">+ Add medicine</button></div><div class="card tw" id="itb"></div>');
  $('#ifl').value = ifl; $('#iq').oninput = function () { iq = this.value; invTable(); }; $('#ifl').onchange = function () { ifl = this.value; invTable(); }; invTable();
};
function invTable() {
  var l = S.meds.filter(function (m) {
    var ok = (m.name + ' ' + m.company + ' ' + m.batch).toLowerCase().indexOf(iq.toLowerCase()) > -1, n = daysLeft(m.expiry);
    return ok && (ifl === 'all' || (ifl === 'low' && m.qty <= m.min) || (ifl === 'exp' && n >= 0 && n <= 90) || (ifl === 'expired' && n < 0));
  });
  $('#itb').innerHTML = l.length ? '<table><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Stock</th><th>Cost</th><th>Price</th><th>Margin</th><th></th></tr>' + l.map(function (m) {
    var mg = m.price ? Math.round((m.price - m.cost) / m.price * 100) : 0;
    return '<tr><td><b>' + esc(m.name) + '</b><div class="muted">' + esc(m.company) + '</div></td><td>' + esc(m.batch) + '</td><td>' + m.expiry + '<div>' + expTag(m.expiry) + '</div></td><td><b>' + m.qty + '</b><div>' + stockTag(m) + '</div></td><td>' + fmt(m.cost) + '</td><td>' + fmt(m.price) + '</td><td>' + mg + '%</td><td><button class="btn ghost sm" data-a="medForm" data-id="' + m.id + '">Edit</button> <button class="btn red sm" data-a="delMed" data-id="' + m.id + '">Delete</button></td></tr>';
  }).join('') + '</table>' : '<div class="empty">No medicines match. Add one, or load sample data from the Dashboard.</div>';
}

var cart = [], pq = '';
V.pos = function () {
  view('<div class="pos"><div class="card"><h2>Select medicines</h2><input id="pq" class="in" style="width:100%" placeholder="Search medicine" value="' + esc(pq) + '"><div class="plist" id="plist"></div></div><div class="card" id="cart"></div></div>');
  $('#pq').oninput = function () { pq = this.value; plist(); }; plist(); drawCart();
};
function plist() {
  var l = S.meds.filter(function (m) { return m.qty > 0 && daysLeft(m.expiry) >= 0 && m.name.toLowerCase().indexOf(pq.toLowerCase()) > -1; }).slice(0, 40);
  $('#plist').innerHTML = l.length ? l.map(function (m) { return '<button class="prod" data-a="add" data-id="' + m.id + '"><span><b>' + esc(m.name) + '</b><small>' + m.qty + ' in stock</small></span><b>' + fmt(m.price) + '</b></button>'; }).join('') : '<div class="empty">No sellable stock found.</div>';
}
function totals() {
  var sub = cart.reduce(function (a, i) { return a + i.qty * i.price; }, 0), dp = +(($('#disc') || {}).value || 0);
  var disc = sub * Math.min(Math.max(dp, 0), 100) / 100, tax = (sub - disc) * S.settings.tax / 100;
  return { sub: sub, disc: disc, tax: tax, total: sub - disc + tax };
}
function drawCart() {
  var keep = $('#disc') ? $('#disc').value : 0, c = $('#cart');
  c.innerHTML = '<h2>Current bill</h2>' + (cart.length ? cart.map(function (i) { return '<div class="cl"><span><b>' + esc(i.name) + '</b><div class="muted">' + fmt(i.price) + ' each</div></span><span class="qty"><button data-a="dec" data-id="' + i.id + '">−</button>' + i.qty + '<button data-a="inc" data-id="' + i.id + '">+</button></span><b>' + fmt(i.qty * i.price) + '</b></div>'; }).join('') +
    '<div class="fg" style="margin-top:14px"><label>Customer<input id="cust" class="in" placeholder="Walk-in"></label><label>Discount %<input id="disc" class="in" type="number" min="0" max="100" value="' + keep + '"></label><label class="w">Payment<select id="pay" class="in"><option>Cash</option><option>Card</option><option>Mobile wallet</option></select></label></div><div class="sum" id="sum"></div><button class="btn block" data-a="checkout">Complete sale</button>' : '<div class="empty">Select medicines to start a bill.</div>');
  if (cart.length) { sumDraw(); $('#disc').oninput = sumDraw; }
}
function sumDraw() { var t = totals(); $('#sum').innerHTML = '<div><span>Subtotal</span><span>' + fmt(t.sub) + '</span></div><div><span>Discount</span><span>− ' + fmt(t.disc) + '</span></div>' + (S.settings.tax ? '<div><span>Tax (' + S.settings.tax + '%)</span><span>' + fmt(t.tax) + '</span></div>' : '') + '<div class="g"><span>Total</span><span>' + fmt(t.total) + '</span></div>'; }

var sq = '';
V.sales = function () {
  var tot = S.sales.reduce(function (a, s) { return a + s.total; }, 0);
  view('<div class="bar"><input id="sq" class="in" style="flex:1;min-width:200px" placeholder="Search bill number or customer" value="' + esc(sq) + '"><button class="btn ghost" data-a="csvSales">Export CSV</button></div><div class="card tw"><h2>' + S.sales.length + ' bills &middot; ' + fmt(tot) + ' total</h2><div id="stb"></div></div>');
  $('#sq').oninput = function () { sq = this.value; salesTable(); }; salesTable();
};
function salesTable() {
  var l = S.sales.filter(function (s) { return (s.no + ' ' + s.customer).toLowerCase().indexOf(sq.toLowerCase()) > -1; }).slice(0, 200);
  $('#stb').innerHTML = l.length ? '<table><tr><th>Bill</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th></th></tr>' + l.map(function (s) { return '<tr><td>#' + s.no + '</td><td>' + new Date(s.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) + '</td><td>' + esc(s.customer || 'Walk-in') + '</td><td>' + s.items.reduce(function (a, i) { return a + i.qty; }, 0) + '</td><td>' + esc(s.pay) + '</td><td><b>' + fmt(s.total) + '</b></td><td><button class="btn ghost sm" data-a="receipt" data-id="' + s.no + '">Receipt</button></td></tr>'; }).join('') + '</table>' : '<div class="empty">No sales recorded yet.</div>';
}

V.settings = function () {
  var s = S.settings;
  view('<div class="grid2"><form class="card" data-f="settings"><h2>Business profile</h2><div class="fg"><label class="w">Pharmacy name<input class="in" name="shop" required value="' + esc(s.shop) + '"></label><label>Currency symbol<input class="in" name="cur" required value="' + esc(s.cur) + '"></label><label>Tax %<input class="in" name="tax" type="number" min="0" step="0.1" value="' + s.tax + '"></label><label class="w">Default low-stock level<input class="in" name="low" type="number" min="0" value="' + s.low + '"></label></div><br><button class="btn">Save settings</button></form>' +
    '<div class="card"><h2>Data management</h2><div class="list"><button class="btn ghost block" data-a="backup">Download full backup</button><label class="btn ghost block" style="text-align:center;cursor:pointer">Restore from backup<input type="file" accept=".json" id="rf" hidden></label><button class="btn ghost block" data-a="sample">Load sample data</button><button class="btn red block" data-a="reset">Erase all data</button></div></div></div>');
  $('#rf').onchange = function () { var f = this.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { try { var d = JSON.parse(r.result); if (!d.meds || !d.sales) throw 0; S = d; save(); render(); toast('Backup restored'); } catch (e) { toast('Invalid backup file'); } }; r.readAsText(f); };
};

/* ---------- forms ---------- */
function medForm(id) {
  var m = id ? find(id) : { name: '', company: '', batch: '', expiry: '', qty: '', cost: '', price: '', min: S.settings.low };
  openModal('<form data-f="med" data-id="' + (id || '') + '"><h2>' + (id ? 'Edit medicine' : 'Add medicine') + '</h2><div class="fg"><label class="w">Medicine name<input class="in" name="name" required value="' + esc(m.name) + '"></label><label>Company<input class="in" name="company" value="' + esc(m.company) + '"></label><label>Batch number<input class="in" name="batch" value="' + esc(m.batch) + '"></label><label>Expiry date<input class="in" type="date" name="expiry" required value="' + m.expiry + '"></label><label>Quantity<input class="in" type="number" min="0" name="qty" required value="' + m.qty + '"></label><label>Cost price<input class="in" type="number" min="0" step="0.01" name="cost" required value="' + m.cost + '"></label><label>Selling price<input class="in" type="number" min="0" step="0.01" name="price" required value="' + m.price + '"></label><label class="w">Reorder level<input class="in" type="number" min="0" name="min" value="' + m.min + '"></label></div><div class="bar" style="margin:18px 0 0;justify-content:flex-end"><button type="button" class="btn ghost" data-a="close">Cancel</button><button class="btn">Save medicine</button></div></form>');
}
function receipt(no) {
  var s = S.sales.find(function (x) { return x.no === +no; }); if (!s) return;
  openModal('<div class="rc"><h2>' + esc(S.settings.shop) + '</h2><p class="muted">Bill #' + s.no + ' &middot; ' + new Date(s.date).toLocaleString('en-GB') + '<br>Customer: ' + esc(s.customer || 'Walk-in') + ' &middot; ' + esc(s.pay) + '</p><table>' + s.items.map(function (i) { return '<tr><td>' + esc(i.name) + '</td><td>' + i.qty + ' × ' + fmt(i.price) + '</td><td>' + fmt(i.qty * i.price) + '</td></tr>'; }).join('') + '</table><div class="sum"><div><span>Subtotal</span><span>' + fmt(s.sub) + '</span></div><div><span>Discount</span><span>− ' + fmt(s.disc) + '</span></div>' + (s.tax ? '<div><span>Tax</span><span>' + fmt(s.tax) + '</span></div>' : '') + '<div class="g"><span>Total</span><span>' + fmt(s.total) + '</span></div></div><p class="muted">Thank you. Get well soon.</p><div class="bar noprint" style="justify-content:center"><button class="btn" onclick="window.print()">Print</button><button class="btn ghost" data-a="close">Close</button></div></div>');
}

/* ---------- actions ---------- */
var A = {
  close: closeModal, medForm: medForm, receipt: receipt,
  theme: function () { var d = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = d; try { localStorage.setItem(TKEY, d); } catch (e) {} },
  delMed: function (id) { if (confirm('Delete this medicine permanently?')) { S.meds = S.meds.filter(function (m) { return m.id !== +id; }); save(); render(); toast('Medicine deleted'); } },
  add: function (id) { var m = find(id), c = cart.find(function (i) { return i.id === m.id; }); if (c) { if (c.qty < m.qty) c.qty++; else toast('Only ' + m.qty + ' in stock'); } else cart.push({ id: m.id, name: m.name, qty: 1, price: m.price, cost: m.cost }); drawCart(); },
  inc: function (id) { A.add(id); },
  dec: function (id) { var c = cart.find(function (i) { return i.id === +id; }); c.qty--; if (c.qty <= 0) cart = cart.filter(function (i) { return i !== c; }); drawCart(); },
  checkout: function () {
    var t = totals(), no = S.sales.reduce(function (a, s) { return Math.max(a, s.no); }, 1000) + 1;
    var sale = { no: no, date: new Date().toISOString(), customer: $('#cust').value.trim(), pay: $('#pay').value, items: cart.slice(), sub: t.sub, disc: t.disc, tax: t.tax, total: t.total };
    cart.forEach(function (i) { var m = find(i.id); if (m) m.qty -= i.qty; });
    S.sales.unshift(sale); save(); cart = []; render(); receipt(no); toast('Sale completed');
  },
  csvMeds: function () { download('inventory-' + today() + '.csv', csv([['Name', 'Company', 'Batch', 'Expiry', 'Qty', 'Cost', 'Price']].concat(S.meds.map(function (m) { return [m.name, m.company, m.batch, m.expiry, m.qty, m.cost, m.price]; }))), 'text/csv'); },
  csvSales: function () { download('sales-' + today() + '.csv', csv([['Bill', 'Date', 'Customer', 'Payment', 'Total']].concat(S.sales.map(function (s) { return [s.no, s.date, s.customer, s.pay, s.total]; }))), 'text/csv'); },
  backup: function () { download('pharmacare-backup-' + today() + '.json', JSON.stringify(S), 'application/json'); },
  reset: function () { if (confirm('This erases every medicine and sale. Continue?')) { S = { meds: [], sales: [], settings: S.settings }; save(); render(); toast('All data erased'); } },
  sample: function () {
    if (S.meds.length && !confirm('Sample data will replace your current data. Continue?')) return;
    var base = [['Panadol 500mg', 'GSK', 14, 22, 300], ['Augmentin 625mg', 'GSK', 310, 380, 40], ['Brufen 400mg', 'Abbott', 24, 34, 120], ['Risek 20mg', 'Getz Pharma', 95, 130, 60], ['Calpol Syrup 120ml', 'GSK', 120, 155, 8], ['Flagyl 400mg', 'Sanofi', 38, 52, 90], ['Arinac Forte', 'Abbott', 28, 40, 150], ['Ventolin Inhaler', 'GSK', 420, 520, 25], ['Mixtard 30 Insulin', 'Novo Nordisk', 980, 1150, 6], ['Surbex Z', 'Abbott', 160, 205, 70], ['Zyrtec 10mg', 'GSK', 45, 65, 110], ['Disprin', 'Reckitt', 6, 9, 400]];
    var offs = [420, 300, 520, 35, 200, 610, 150, -12, 260, 480, 330, 700], seed = 7, rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    S.meds = base.map(function (b, i) { return { id: 1000 + i, name: b[0], company: b[1], batch: 'B' + (2400 + i * 13), expiry: iso(addDays(offs[i])), qty: b[4], cost: b[2], price: b[3], min: 15 }; });
    S.sales = []; var no = 1001;
    for (var d = 29; d >= 0; d--) { var n = 4 + Math.floor(rnd() * 7); for (var k = 0; k < n; k++) {
      var items = [], c = 1 + Math.floor(rnd() * 3); for (var j = 0; j < c; j++) { var m = S.meds[Math.floor(rnd() * S.meds.length)], q = 1 + Math.floor(rnd() * 3); items.push({ id: m.id, name: m.name, qty: q, price: m.price, cost: m.cost }); }
      var sub = items.reduce(function (a, i) { return a + i.qty * i.price; }, 0), dt = addDays(-d); dt.setHours(9 + Math.floor(rnd() * 11), Math.floor(rnd() * 60));
      S.sales.push({ no: no++, date: dt.toISOString(), customer: '', pay: ['Cash', 'Card', 'Mobile wallet'][Math.floor(rnd() * 3)], items: items, sub: sub, disc: 0, tax: 0, total: sub }); } }
    S.sales.reverse(); save(); render(); toast('Sample data loaded');
  }
};
document.addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (b && A[b.dataset.a]) { e.preventDefault(); A[b.dataset.a](b.dataset.id); } });
document.addEventListener('submit', function (e) {
  var f = e.target.closest('form[data-f]'); if (!f) return; e.preventDefault(); var o = {}; new FormData(f).forEach(function (v, k) { o[k] = v; });
  if (f.dataset.f === 'med') {
    var rec = { name: o.name.trim(), company: o.company.trim(), batch: o.batch.trim(), expiry: o.expiry, qty: +o.qty, cost: +o.cost, price: +o.price, min: +o.min || 0 };
    if (f.dataset.id) Object.assign(find(f.dataset.id), rec); else { rec.id = Date.now(); S.meds.push(rec); }
    closeModal(); toast('Medicine saved');
  } else { S.settings = { shop: o.shop.trim(), cur: o.cur.trim(), tax: +o.tax || 0, low: +o.low || 0 }; toast('Settings saved'); }
  save(); render();
});

/* ---------- boot ---------- */
function render() {
  var v = (location.hash || '#dashboard').slice(1); if (!V[v]) v = 'dashboard';
  document.querySelectorAll('#nav a').forEach(function (a) { a.classList.toggle('on', a.dataset.v === v); });
  $('#title').textContent = T[v]; $('#brand-name').textContent = S.settings.shop; document.title = S.settings.shop + ' | ' + T[v];
  $('#date').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var n = S.meds.filter(function (m) { return m.qty <= m.min || daysLeft(m.expiry) <= 90; }).length; $('#badge').hidden = !n; $('#badge').textContent = n;
  V[v]();
}
try { var th = localStorage.getItem(TKEY); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
window.addEventListener('hashchange', render); render();
})();
