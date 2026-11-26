/* GST, LUT and CA-ready reports (prototype, 2026-11-25): the tax treatment is chosen automatically from the customer's
   location; tax invoices are numbered per financial year; Razorpay collects the tax-inclusive total; refunds become credit
   notes; Finance exports five CA-ready CSV reports.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\bos-tax.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; }
  function party(country, state, gstin){ return bosTaxPartyOf({ name:'X', taxCountry:country, taxState:state, gstin:gstin || '' }); }
  function lines(csv){ return csv.replace(/^﻿/, '').split('\r\n'); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var harbor = BOS.accounts.find(function(a){ return a.tenantIds.indexOf(CURRENT_ORGANIZATION_ID) > -1; });

    await t('the tax treatment is chosen from the customer’s location', async function(){
      var s = bosTaxSegment(party('India', '', '29AABCV1111N1Z1'), '2026-11-25', 50000); eq(s.code, 'INTRA'); eq(s.cgst, 9); eq(s.sgst, 9); eq(s.igst, 0); eq(s.section, 'B2B');
      s = bosTaxSegment(party('India', '', '27AABCH1234K1Z2'), '2026-11-25', 50000); eq(s.code, 'INTER'); eq(s.igst, 18); eq(s.section, 'B2B');
      s = bosTaxSegment(party('United Kingdom'), '2026-11-25', 50000); eq(s.code, 'EXPWOP', 'export under LUT'); eq(s.igst, 0); ok(/LUT/.test(s.why));
      s = bosTaxSegment(party('United States'), '2027-05-01', 50000); eq(s.code, 'EXPWP', 'no LUT valid on that date → IGST paid'); eq(s.igst, 18);
      s = bosTaxSegment(party('India', 'Kerala'), '2026-11-25', 150000); eq(s.section, 'B2CL', 'unregistered, inter-state, over the limit'); eq(s.igst, 18);
      s = bosTaxSegment(party('India', 'Kerala'), '2026-11-25', 50000); eq(s.section, 'B2CS');
      s = bosTaxSegment(party('India', 'Karnataka'), '2026-11-25', 500000); eq(s.section, 'B2CS', 'intra-state B2C is B2CS'); eq(s.cgst, 9);
      s = bosTaxSegment(party('India', ''), '2026-11-25', 1); ok(!s.ok && s.section === 'Review', 'missing state flagged');
      s = bosTaxSegment(null, '2026-11-25', 1); ok(!s.ok, 'no customer flagged');
    });
    await t('amounts: INR values at the reference rate, tax split right, totals add up', async function(){
      var c = bosTaxCompute({ name:'A', taxCountry:'India', gstin:'29AABCV1111N1Z1' }, 10000, 'INR', '2026-11-25');
      eq(c.taxableINR, 10000); eq(c.cgstINR, 900); eq(c.sgstINR, 900); eq(c.igstINR, 0); eq(c.totalINR, 11800); eq(c.total, 11800);
      c = bosTaxCompute({ name:'B', taxCountry:'India', gstin:'27AABCH1234K1Z2' }, 499, 'USD', '2026-11-25');
      eq(c.taxableINR, Math.round(499 * BOS_TAX.rates.USD * 100) / 100); eq(c.igstINR, Math.round(c.taxableINR * 18) / 100); eq(c.total, Math.round(499 * 1.18 * 100) / 100);
      c = bosTaxCompute({ name:'C', taxCountry:'United States' }, 1499, 'USD', '2026-11-25'); eq(c.taxINR, 0); eq(c.total, 1499, 'zero-rated export: nothing added');
    });
    await t('a subscription invoice gets the tax and a numbered tax invoice; Razorpay collects the total', async function(){
      var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID); if(sub.status === 'trial') sub.status = 'active';
      var g = generateInvoiceForSubscription(sub.id); ok(g.ok && g.taxInvoice, g.reason); var inv = g.invoice, ti = g.taxInvoice;
      ok(/^OON\/\d\d-\d\d\/\d{4}$/.test(ti.no), 'number format ' + ti.no); eq(inv.taxInvoiceNo, ti.no);
      eq(ti.segment.code, 'INTER', 'Harbor in Maharashtra, Oontu in Karnataka'); ok(inv.total > inv.amount, 'tax added');
      var g2 = generateInvoiceForSubscription(sub.id); var n1 = Number(ti.no.slice(-4)), n2 = Number(g2.taxInvoice.no.slice(-4)); eq(n2, n1 + 1, 'consecutive in the year');
      var l = bosCreatePayLink(null, inv.id); ok(l.ok, l.reason); eq(l.link.amount, inv.total); ok(/IGST/.test(l.link.taxSegment), 'segment on the link');
      var r = BOS_PAY.simulate('payment.captured', { id:l.link.id, amount:l.link.amount, currency:l.link.currency, version:1 }); ok(r.applied, 'paid');
      eq(ti.status, 'paid'); ok(/^evt_/.test(ti.paymentId), 'payment id recorded');
    });
    await t('a checkout from a proposal issues an export tax invoice with an eFIRC', async function(){
      as('PU-102'); var o = BOS.opps.find(function(x){ return x.title === 'Northstar Talent UK · New business'; });
      var p = bosCreateProposal({ oppId:o.id, planId:'plan-growth', seats:5 }); ok(p.ok, p.reason); ok(bosSendProposal(p.proposal.id).ok, 'sent');
      var l = bosCreatePayLink(p.proposal.id); ok(l.ok, l.reason); eq(l.link.amount, p.proposal.net, 'export under LUT: no tax added'); ok(/LUT/.test(l.link.taxSegment));
      var r = BOS_PAY.simulate('payment.captured', { id:l.link.id, amount:l.link.amount, currency:l.link.currency, version:1 }); ok(r.applied, 'paid');
      var ti = bosTaxInvoice(l.link.taxInvoiceNo); ok(ti && ti.segment.code === 'EXPWOP' && ti.status === 'paid' && /^eFIRC/.test(ti.efirc), JSON.stringify(ti && ti.segment));
      as('PU-001');
    });
    await t('a refund becomes a credit note against the original invoice', async function(){
      var ti = BOS.taxInvoices.find(function(x){ return x.kind === 'invoice' && x.status === 'paid' && /^inv-/.test(x.sourceRef); }); var inv = invoiceById(ti.sourceRef);
      as('PU-106'); var rq = bosRequestRefund({ invoiceId:inv.id, amount:Math.round(inv.amount / 2), reason:'Downtime credit' }); ok(rq.ok, rq.reason);
      as('PU-001'); ok(bosDecide(rq.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)').ok, 'approved');
      ok(BOS_PAY.simulate('refund.processed', { id:rq.refund.providerId, amount:rq.refund.amount, currency:inv.currency, version:1 }).applied, 'processed');
      var cn = bosTaxInvoice(rq.refund.creditNoteNo); ok(cn && cn.kind === 'credit_note' && /^OON-CN\//.test(cn.no) && cn.originalNo === ti.no && cn.taxableINR < 0, JSON.stringify(cn && { no:cn.no, t:cn.taxableINR }));
    });
    await t('the CA-ready sales register has every column the CA needs, one row per document', async function(){
      var fy = bosFyOf(new Date().toISOString()), csv = bosTaxReportCSV('sales', fy, 'all'), L = lines(csv);
      ok(/^Supplier,/.test(L[0]) && L[0].indexOf(BOS_TAX.profile.gstin) > -1, 'supplier header with GSTIN');
      var head = L[2]; ['Document No','Customer GSTIN','Place of supply (state)','GSTR-1 section','Tax treatment','SAC','Exchange rate','Taxable value (INR)','CGST (INR)','SGST (INR)','IGST (INR)','LUT ARN','Gateway payment ID','eFIRC / BRC'].forEach(function(c){ ok(head.indexOf(c) > -1, 'column ' + c); });
      eq(L.length - 3, bosTaxRows(fy, 'all').length, 'one row per document');
      ok(L.some(function(l){ return /Export of services under LUT/.test(l); }) && L.some(function(l){ return /CGST 9% \+ SGST 9%/.test(l); }) && L.some(function(l){ return /IGST 18% \(inter-state\)/.test(l); }) && L.some(function(l){ return /Credit note/.test(l); }), 'every segment present');
      ok(csv.charCodeAt(0) === 0xFEFF, 'Excel-friendly UTF-8');
    });
    await t('GSTR-1 summary: sections add up to the total', async function(){
      var fy = bosFyOf(new Date().toISOString()), L = lines(bosTaxReportCSV('gstr1', fy, 'all')), s = bosTaxSummary(bosTaxRows(fy, 'all'));
      ['B2B','B2CL','B2CS','EXP (WOPAY)','CDNR'].forEach(function(k){ ok(L.some(function(l){ return l.indexOf(k + ',') === 0; }), 'section ' + k); });
      var sum = Object.keys(s.sections).reduce(function(a, k){ return a + s.sections[k].taxableINR; }, 0); ok(Math.abs(sum - s.taxableINR) < 0.05, 'sections = total');
      ok(/^Total,/.test(L[L.length - 1]), 'total row');
    });
    await t('payments, exports and credit-note reports; quarter and month filters', async function(){
      var fy = bosFyOf(new Date().toISOString());
      var P = lines(bosTaxReportCSV('payments', fy, 'all')); ok(P[0].indexOf('GST on fee') > -1 && P.length > 2, 'payments with gateway fee and GST');
      var X = lines(bosTaxReportCSV('exports', fy, 'all')); ok(X[0].indexOf('LUT ARN') > -1 && X.some(function(l){ return /eFIRC-SIM/.test(l); }), 'exports with eFIRC');
      var C = lines(bosTaxReportCSV('credits', fy, 'all')); ok(C.length >= 3, 'credit notes');
      var q = bosTaxRows(fy, 'Q2'), r = bosTaxRange(fy, 'Q2'); ok(q.every(function(x){ return x.date >= r[0] && x.date < r[1]; }), 'quarter filter');
      var m = bosTaxRows(fy, 'M05'); ok(m.length >= 1 && m.every(function(x){ return new Date(x.date).getUTCMonth() === 4; }), 'month filter (May)');
    });
    await t('only Finance can export; every export is audited', async function(){
      var fy = bosFyOf(new Date().toISOString());
      as('PU-101'); var r = bosTaxExport('sales', fy, 'all'); ok(!r.ok, 'sales can’t export');
      as('PU-106'); r = bosTaxExport('sales', fy, 'Q3'); ok(r.ok && /sales-register-FY20\d\d-\d\d-Q3\.csv$/.test(r.file), r.file || r.reason);
      ok(AUDIT_LOG[0].action === 'Tax report exported' && AUDIT_LOG[0].actor === 'Vikram Shah', JSON.stringify(AUDIT_LOG[0]).slice(0, 160));
      var all = bosTaxExportAll(fy, 'all'); ok(all.ok && all.files.length === 5, 'all five');
      as('PU-001');
    });
    await t('tax profile and customer tax details are validated; a new LUT changes the next export invoice', async function(){
      as('PU-101'); ok(!bosSetTaxProfile({ gstin:'29ABCDE1234F1Z5' }).ok, 'sales can’t change the tax profile');
      as('PU-106'); ok(!bosSetTaxProfile({ gstin:'BAD' }).ok, 'bad GSTIN');
      ok(bosSetTaxProfile({ gstin:'27ABCDE1234F1Z5', lutArn:'', lutFrom:'', lutTo:'' }).ok, 'moved to Maharashtra, no LUT');
      eq(BOS_TAX.profile.state, 'Maharashtra'); eq(bosTaxSegment(bosTaxPartyOf(harbor), '2026-11-25', 1).code, 'INTRA', 'Harbor is now intra-state');
      eq(bosTaxSegment(party('United Kingdom'), '2026-11-25', 1).code, 'EXPWP', 'no LUT → IGST on exports');
      ok(bosTaxChecks().some(function(c){ return /No valid LUT/.test(c[1]); }), 'check warns');
      ok(bosSetTaxProfile({ gstin:'29ABCDE1234F1Z5', lutArn:'AD2904260001234', lutFrom:'2026-04-01', lutTo:'2027-03-31' }).ok, 'restored');
      ok(!bosSetCustomerTax(harbor.id, { country:'India', gstin:'XYZ' }).ok, 'bad customer GSTIN');
      ok(bosSetCustomerTax(harbor.id, { country:'India', gstin:'29AABCH1234K1Z2' }).ok, 'customer moved to Karnataka');
      eq(bosTaxSegment(bosTaxPartyOf(harbor), '2026-11-25', 1).code, 'INTRA'); as('PU-001');
    });
    await t('the Tax and CA reports tab renders with the exports and checks', async function(){
      as('PU-106'); bosActAs('PU-106'); renderSidebar(); showView('oontu-finance'); bosTab('oontu-finance', 5); await sleep(20);
      var m = document.getElementById('main-content').textContent;
      ok(/Oontu tax profile/.test(m) && /How tax is chosen/.test(m) && /Compliance checks/.test(m) && /Sales register/.test(m) && /GSTR-1 summary/.test(m) && /Download all/.test(m), m.slice(0, 200));
      ok(/OON\/\d\d-\d\d\/0001/.test(m), 'documents listed');
      bosOpen('account', harbor.id); await sleep(20); ok(/Tax details/.test(document.getElementById('main-content').textContent), 'Account 360 shows tax details');
      bosActAs('PU-001');
    });
    pub();
  }, 300); });
})();
