// @o2-runner switches=0b,0c,0d,1a,4a,4b,4c,4d
/* O2 Step 4d: payments, allocations, bank reconciliation, TDS (§3.4), acceptance 1–9.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-allocation.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function near(a, b, m){ if(Math.abs(a - b) > 0.011) throw new Error((m ? m + ': ' : '') + 'expected ' + b + ', got ' + a); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; try { bosActAs(id); } catch(e){} }
  var DAY = 864e5, n = 0;
  /* a fresh INR invoice for Southline (Delhi, IGST) */
  function invoice(){ var s = subscriptionForTenant('org-southline'); var g = generateInvoiceForSubscription(s.id); ok(g.ok && g.taxInvoice, g.reason); return g; }
  function credit(amount, ref, payer, extra){ n++; var r = o2RecordBankCredit(Object.assign({ amount:amount, currency:'INR', reference:ref || ('UTR' + (100000 + n)), payerName:payer || 'Southline Talent Group' }, extra || {})); ok(r.ok, r.reason); return r; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-106'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var sub = subscriptionForTenant('org-southline'); sub.planId = 'plan-floor'; sub.seats = 2; sub.price = 5998; sub.currency = 'INR'; sub.billingInterval = 'monthly';

    await t('1. one bank credit allocated across two invoices settles both; payment allocated', async function(){
      var a = invoice().taxInvoice, b = invoice().taxInvoice, total = a.total + b.total;
      var c = credit(total).payment; eq(c.status, 'unallocated');
      ok(o2Allocate(c.id, a.no, null).ok); eq(c.status, 'partly_allocated'); ok(o2Allocate(c.id, b.no, null).ok);
      eq(o2Settlement(a).status, 'paid'); eq(o2Settlement(b).status, 'paid'); eq(c.status, 'allocated'); eq(a.status, 'paid', 'old flag dual-written');
    });
    await t('2. two payments allocated to one invoice settle it', async function(){
      var a = invoice().taxInvoice, p1 = credit(r2h(a.total / 2)).payment, p2 = credit(a.total - r2h(a.total / 2)).payment;
      ok(o2Allocate(p1.id, a.no).ok); eq(o2Settlement(a).status, 'partly_paid'); ok(o2Allocate(p2.id, a.no).ok); eq(o2Settlement(a).status, 'paid');
    });
    function r2h(x){ return Math.round(x * 100) / 100; }
    await t('3. a partial payment leaves partly_paid; the subscription does not activate until paid', async function(){
      sub.status = 'past_due'; sub.dunning = { since:new Date(bosNow() - 2 * DAY).toISOString().slice(0, 10), step:1, reason:'The automatic charge failed' };
      var g = invoice(), a = g.taxInvoice, p = credit(1000).payment; ok(o2Allocate(p.id, a.no).ok);
      eq(o2Settlement(a).status, 'partly_paid'); eq(a.status, 'issued', 'old flag stays unpaid'); eq(o2SubStatus(sub), 'past_due', 'not activated');
      var p2 = credit(o2Settlement(a).outstanding).payment; ok(o2Allocate(p2.id, a.no).ok); eq(o2Settlement(a).status, 'paid'); eq(o2SubStatus(sub), 'active', 'activated once paid'); eq(g.invoice.status, 'paid', 'internal row');
    });
    await t('4. cash + TDS equal to the outstanding make it paid; an overdue certificate raises tds-certificate-overdue', async function(){
      sub.status = 'past_due'; sub.dunning = { since:new Date(bosNow()).toISOString().slice(0, 10), step:0, reason:'x' };
      var a = invoice().taxInvoice, tds = r2h(a.amount * 0.10), cash = r2h(a.total - tds);
      ok(!o2RecordTds(a.no, { amount:tds }).ok, 'section required (never assumed)');
      ok(o2Allocate(credit(cash).payment.id, a.no).ok); eq(o2Settlement(a).status, 'partly_paid');
      var r = o2RecordTds(a.no, { amount:tds, section:'194J', date:'2026-05-10' }); ok(r.ok, r.reason); eq(o2Settlement(a).status, 'paid'); eq(o2SubStatus(sub), 'active');
      eq(r.allocation.certificateStatus, 'expected'); eq(r.allocation.quarter, 'Q1');
      bosIntegrityScan(); ok(BOS.exceptions.some(function(e){ return e.rule === 'tds-certificate-overdue' && e.title.indexOf(a.no) > -1; }), 'overdue certificate found (Q1 ended 30 June, +60 days)');
      ok(o2UpdateTdsCertificate(r.allocation.id, 'received', 'TDS-CERT-881').ok); eq(r.allocation.certificateRef, 'TDS-CERT-881');
    });
    await t('5. no reference match and no exact amount + payer match: stays unallocated, never auto-assigned, flagged after the policy days', async function(){
      var a = invoice().taxInvoice; var c = credit(777.77, 'NEFT-XYZ-1', 'Someone Unknown Pvt Ltd').payment;
      eq(o2SuggestMatches(c.id).length, 0, 'no suggestion'); eq(c.status, 'unallocated'); eq(o2Settlement(a).status, 'open', 'nothing assigned');
      c.receivedAt = new Date(bosNow() - (o2Policy('unmatchedCreditDays') + 1) * DAY).toISOString(); bosIntegrityScan();
      ok(BOS.exceptions.some(function(e){ return e.rule === 'unmatched-credit' && e.key === 'unmatched:' + c.id; }), 'unmatched-credit raised');
      showView('oontu-invoices'); o2BillTab('inv', 'reconciliation'); await sleep(5); var m = document.getElementById('main-content').textContent; ok(/Unmatched/.test(m) && /Partly paid/.test(m) && /TDS receivable/.test(m), 'three reconciliation lists');
    });
    await t('6. a suggestion is never applied without Finance confirmation', async function(){
      var a = invoice().taxInvoice, c = credit(a.total, 'UTR REF ' + a.no, 'Southline Talent Group Pvt Ltd').payment;
      var s = o2SuggestMatches(c.id); eq(s.length, 1); eq(s[0].invoiceNo, a.no); eq(s[0].rule, 'reference'); eq(o2Settlement(a).status, 'open', 'not applied'); eq(c.status, 'unallocated');
      var b = invoice().taxInvoice, c2 = credit(o2Settlement(b).outstanding, 'NO-REF', 'Southline Talent Group').payment, s2 = o2SuggestMatches(c2.id);
      eq(s2.length, 0, 'several open invoices share that amount: no guess');
      var acc = BOS.accounts.find(function(x){ return x.tenantIds.indexOf('org-southline') > -1; }); var u = bosTaxIssue({ account:acc, tenantId:'org-southline', amount:1234.56, currency:'INR', description:'One-off setup' });
      var c3 = credit(o2Settlement(u).outstanding, 'NO-REF-2', 'Southline Talent Group').payment, s3 = o2SuggestMatches(c3.id); ok(s3.length === 1 && s3[0].rule === 'amount' && s3[0].invoiceNo === u.no, 'unique amount + payer: suggested'); eq(o2Settlement(u).status, 'open', 'still not applied');
      as('PU-101'); ok(!o2Allocate(c.id, a.no).ok, 'Sales cannot confirm'); as('PU-106'); ok(o2Allocate(c.id, a.no).ok, 'Finance confirms'); eq(o2Settlement(a).status, 'paid');
    });
    await t('7. an overpayment becomes customer credit only on confirmation and pays a later invoice', async function(){
      var a = invoice().taxInvoice, c = credit(a.total + 500).payment; ok(o2Allocate(c.id, a.no).ok); eq(c.status, 'partly_allocated'); eq(BOS.customerCredits.length, 0, 'no credit by itself');
      var cr = o2ConfirmCredit(c.id, 'Customer paid ahead'); ok(cr.ok, cr.reason); near(cr.credit.amount, 500); eq(c.status, 'allocated');
      var b = invoice().taxInvoice; var ap = o2ApplyCredit(cr.credit.id, b.no); ok(ap.ok, ap.reason); near(o2Settlement(b).allocated, 500); eq(o2Settlement(b).status, 'partly_paid');
    });
    await t('8. reversing an allocation reopens the invoice and keeps both rows', async function(){
      var a = invoice().taxInvoice, c = credit(a.total).payment, al = o2Allocate(c.id, a.no).allocation; eq(o2Settlement(a).status, 'paid');
      ok(!o2Unallocate(al.id, 'x').ok, 'a reason is needed'); var r = o2Unallocate(al.id, 'Allocated to the wrong invoice'); ok(r.ok, r.reason);
      eq(o2Settlement(a).status, 'open'); eq(a.status, 'issued', 'reopened'); ok(BOS.allocations.indexOf(al) > -1 && al.amount > 0, 'original row kept'); eq(r.allocation.amount, -al.amount); eq(r.allocation.reversalOf, al.id);
      ok(!o2Unallocate(al.id, 'Allocated to the wrong invoice').ok, 'not twice');
    });
    await t('9. a repeated provider event creates no second invoice and no second allocation', async function(){
      as('PU-001'); var ck = bosCheckoutStart({ tenantId:'org-southline', planId:'plan-floor', seats:2, interval:'monthly', currency:'INR' }); ok(ck.ok, ck.reason);
      var ev = { id:ck.link.id, amount:ck.link.amount, currency:ck.link.currency, version:1 }; var r1 = BOS_PAY.simulate('payment.captured', ev); ok(r1.applied, 'paid');
      var docs = BOS.taxInvoices.length, allocs = BOS.allocations.length, pays = BOS.payments.length;
      var doc = bosTaxInvoice(ck.link.docNo); ok(doc && o2Settlement(doc).status === 'paid', 'checkout invoice allocated'); ok(BOS.allocations.some(function(a){ return a.invoiceNo === doc.no && a.by === 'provider'; }), 'provider allocation');
      var raw = BOS.payEvents.slice(-1)[0]; if(raw && raw.raw) BOS_PAY.receive(raw.raw, raw.sig); BOS_PAY.simulate('payment.captured', ev);
      eq(BOS.taxInvoices.length, docs, 'no second invoice'); eq(BOS.allocations.length, allocs, 'no second allocation'); eq(BOS.payments.length, pays, 'no second payment');
      as('PU-106');
    });
    await t('manual verification = bank credit + full allocation in one step; switch off keeps the old mark-paid', async function(){
      var g = invoice(); var r = markInvoicePaid(g.invoice.id, { reference:'UTR5556667778', note:'Bank transfer' }); ok(r.ok, r.reason);
      var p = BOS.payments.slice(-1)[0]; eq(p.source, 'bank'); eq(p.bank.reference, 'UTR5556667778'); eq(o2Settlement(g.taxInvoice).status, 'paid'); eq(p.status, 'allocated');
      o2SetSwitch('4d', false); var g2 = invoice(), n0 = BOS.payments.length; ok(markInvoicePaid(g2.invoice.id, { reference:'UTR1112223334' }).ok); eq(BOS.payments.length, n0, 'no payment record while off'); eq(g2.invoice.status, 'paid', 'old flag'); o2SetSwitch('4d', true);
    });
    pub();
  }, 300); });
})();
