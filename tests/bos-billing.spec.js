/* Billing engine (prototype, 2026-11-25): per-licence pricing, promo codes with maker-checker, invoice draft → issue →
   correction (cancel and re-issue, or credit/debit note), payment links shared by email/WhatsApp/copy with reminders,
   customer checkout with promo and proration, renewals with the RBI ₹15,000 rule and reminders, read-only after day 7.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\bos-billing.spec.js */
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
  var D = 86400000;

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var harbor = BOS.accounts.find(function(a){ return a.tenantIds.indexOf(CURRENT_ORGANIZATION_ID) > -1; });

    await t('per-licence plans are priced licences × price × months (the earlier bug)', async function(){
      var q = bosPrice({ planId:'plan-floor', seats:20, currency:'INR', interval:'monthly' }); ok(q.ok, q.reason); eq(q.listPrice, 2999 * 20); eq(q.net, 2999 * 20);
      q = bosPrice({ planId:'plan-floor', seats:20, currency:'INR', interval:'annual' }); eq(q.listPrice, 2999 * 20 * 12, 'annual = 12 months');
      q = bosPrice({ planId:'plan-scale', seats:10, currency:'USD' }); eq(q.listPrice, 49 * 10);
      ok(!bosPrice({ planId:'plan-group', seats:10 }).ok, 'Group is by quote');
      q = bosPrice({ planId:'plan-growth', seats:5 }); eq(q.listPrice, planById('plan-growth').price, 'legacy flat plans unchanged');
      as('PU-102'); var o = BOS.opps.find(function(x){ return x.title === 'Vistaar HR Services · New business'; });
      var p = bosCreateProposal({ oppId:o.id, planId:'plan-floor', seats:12 }); ok(p.ok, p.reason); eq(p.proposal.currency, 'INR', 'Indian customer priced in rupees'); eq(p.proposal.net, 2999 * 12); as('PU-001');
    });
    await t('promo codes: created, approved by someone else, then valid with limits', async function(){
      as('PU-101'); ok(!bosCreatePromo({ code:'SALES50', pct:5, validUntil:'2027-01-31' }).ok, 'a sales executive can’t create promos');
      as('PU-109'); ok(!bosCreatePromo({ code:'BIG', pct:5, validUntil:'2027-01-31' }).ok, 'code format');
      ok(!bosCreatePromo({ code:'DEEP40', pct:40, validUntil:'2027-01-31' }).ok, 'promo depth capped');
      ok(!bosCreatePromo({ code:'DIWALI15', pct:15, validUntil:'2027-01-31' }).ok, 'a promo needs a business purpose'); var r = bosCreatePromo({ code:'DIWALI15', pct:15, validUntil:'2027-01-31', maxUses:1, plans:['plan-floor'], reason:'Diwali campaign for agencies on Floor; budgeted in the Q3 marketing plan.' }); ok(r.ok, r.reason); eq(r.promo.status, 'pending_approval');
      ok(!bosPromoCheck('DIWALI15', 'plan-floor').ok, 'not usable before approval');
      ok(!bosDecide(r.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)').ok, 'creator can’t approve'); as('PU-106'); ok(bosDecide(r.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)').ok, 'finance approves');
      ok(bosPromoCheck('DIWALI15', 'plan-floor').ok, 'now valid'); ok(!bosPromoCheck('DIWALI15', 'plan-desk').ok, 'plan restriction');
      as('PU-001');
    });
    await t('invoice: draft is editable, issuing numbers it, adds tax and a payment link', async function(){
      as('PU-101'); ok(!bosDraftInvoice({ accountId:harbor.id, lines:[{ desc:'x', qty:1, unitPrice:1 }] }).ok, 'sales can’t raise invoices');
      as('PU-110'); var d = bosDraftInvoice({ accountId:harbor.id, currency:'INR', lines:[{ desc:'Setup and data import', qty:1, unitPrice:25000 }] }); ok(d.ok, d.reason);
      ok(!bosDraftInvoice({ accountId:harbor.id, lines:[{ desc:'', qty:1, unitPrice:5 }] }).ok, 'line validation');
      ok(bosEditDraft(d.draft.id, { lines:[{ desc:'Setup and data import', qty:1, unitPrice:20000 }, { desc:'Admin training (2 h)', qty:2, unitPrice:2500 }] }).ok, 'edited');
      var i = bosIssueDraft(d.draft.id); ok(i.ok, i.reason); var doc = i.doc;
      eq(doc.amount, 25000); ok(/^OON\//.test(doc.no) && doc.lines.length === 2, doc.no); eq(doc.segment.code, 'INTER', 'IGST for Maharashtra'); eq(doc.total, 29500);
      ok(i.link && i.link.amount === 29500 && i.link.docNo === doc.no, 'link for the total');
      ok(!bosEditDraft(d.draft.id, { notes:'x' }).ok, 'issued: no more editing');
      eq(bosLinkForDoc(doc.no).link.id, i.link.id, 'one open link per document');
      as('PU-001');
    });
    await t('payment links are shared by email, WhatsApp or copy, with reminders and tracking', async function(){
      as('PU-110'); var l = BOS.payLinks.find(function(x){ return x.docNo && x.status === 'open'; });
      ok(!bosShareLink(l.id, 'email', 'not-an-email').ok, 'email checked'); ok(!bosShareLink(l.id, 'whatsapp', '123').ok, 'number checked');
      ok(bosShareLink(l.id, 'email', 'priya@harborpartners.example').ok && bosShareLink(l.id, 'whatsapp', '+91 98200 00000').ok && bosShareLink(l.id, 'copy').ok, 'shared three ways');
      eq(l.shares.length, 3); ok(BOS.outbox.some(function(m){ return /WhatsApp/.test(m.subject) && /not sent/.test(m.note); }), 'nothing really sent');
      APS.clockOffsetMs = (APS.clockOffsetMs || 0) + 10 * D; bosLinkSweep(); ok(l.reminders.some(function(r){ return r.d === 5; }), 'reminder 5 days before'); APS.clockOffsetMs -= 10 * D;
      BOS_PAY.open(l.id); ok(l.openedAt, 'opened tracked');
      as('PU-001');
    });
    await t('correction this month, unpaid, not filed: cancel and re-issue with a new number', async function(){
      as('PU-106'); var d = bosDraftInvoice({ accountId:harbor.id, currency:'INR', lines:[{ desc:'Extra licences', qty:2, unitPrice:2999 }] }); var doc = bosIssueDraft(d.draft.id).doc;
      eq(bosCorrectionPath(doc).path, 'reissue');
      ok(!bosCorrectInvoice(doc.no, { lines:[{ desc:'Extra licences', qty:3, unitPrice:2999 }] }).ok, 'reason required');
      var r = bosCorrectInvoice(doc.no, { lines:[{ desc:'Extra licences', qty:3, unitPrice:2999 }], reason:'Customer added one more licence' }); ok(r.ok && r.result === 'reissued', JSON.stringify(r).slice(0, 160));
      eq(doc.status, 'cancelled'); eq(r.doc.revisedFrom, doc.no); eq(r.doc.amount, 8997);
      ok(BOS.payLinks.filter(function(l){ return l.docNo === doc.no; }).every(function(l){ return l.status !== 'open'; }), 'old link stopped');
      as('PU-001');
    });
    await t('paid or filed: credit note or debit note; big or paid corrections need a finance manager', async function(){
      as('PU-106'); var d = bosDraftInvoice({ accountId:harbor.id, currency:'INR', lines:[{ desc:'Training', qty:1, unitPrice:5000 }] }); var doc = bosIssueDraft(d.draft.id).doc;
      ok(bosMarkGstr1Filed(doc.date.slice(0, 7)).ok, 'GSTR-1 filed for the month'); eq(bosCorrectionPath(doc).path, 'note');
      as('PU-110'); ok(!bosCorrectInvoice(doc.no, { lines:[{ desc:'Training', qty:1, unitPrice:4000 }], reason:'x' }).ok, 'a commercial operator can’t correct');
      as('PU-106'); var r = bosCorrectInvoice(doc.no, { lines:[{ desc:'Training', qty:1, unitPrice:4000 }], reason:'Agreed rate was 4,000' }); ok(r.ok && r.result === 'credit_note', JSON.stringify(r).slice(0, 160));
      ok(/^OON-CN\//.test(r.doc.no) && r.doc.originalNo === doc.no && r.doc.taxableINR === -1000, 'credit note for the difference'); eq(doc.status, 'issued', 'original kept');
      var up = bosCorrectInvoice(doc.no, { lines:[{ desc:'Training', qty:1, unitPrice:25000 }], reason:'Full-day training, not two hours' }); ok(up.ok && up.pending, 'over ₹10,000: approval first');
      ok(!bosDecide(up.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)').ok, 'not by the requester'); as('PU-001'); ok(bosDecide(up.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)').ok, 'approved');
      ok(doc.adjustedBy.some(function(n){ return /^OON-DN\//.test(n); }), 'debit note issued'); var dn = bosTaxInvoice(doc.adjustedBy.filter(function(n){ return /DN/.test(n); })[0]); eq(dn.amount, 20000); ok(BOS.payLinks.some(function(l){ return l.docNo === dn.no; }), 'the debit note has its own payment link');
      var fy = bosFyOf(new Date().toISOString()); var csv = bosTaxReportCSV('credits', fy, 'all'); ok(/debit note/.test(csv) && /OON-CN\//.test(csv), 'both in the CA report');
    });
    await t('customer checkout: plan, licences, add-on, promo, tax, Razorpay → active, subscription, invoice, receipt', async function(){
      as('PU-001'); var acc = harbor;
      var q = bosCheckoutQuote({ planId:'plan-floor', seats:4, interval:'annual', boosts:['boost-insights'], promo:'DIWALI15', account:acc, accountId:acc.id, currency:'INR' }); ok(q.ok, q.reason);
      eq(q.subtotal, 2999 * 4 * 12 + 2499 * 12); eq(q.promoOff, Math.round(q.subtotal * 15) / 100); ok(q.tax.segment.code === 'INTER' && q.total > q.taxable, 'GST added');
      var bad = bosCheckoutStart({ planId:'plan-floor', seats:4, promo:'NOPE', currency:'INR' }); ok(!bad.ok && /isn’t valid/.test(bad.reason), 'bad promo refused');
      var s = bosCheckoutStart({ planId:'plan-floor', seats:4, interval:'annual', boosts:['boost-insights'], promo:'DIWALI15', currency:'INR' }); ok(s.ok, s.reason);
      var fail = bosCheckoutPay(s.link.id, true); ok(!fail.ok && fail.failed, 'declined card: nothing activated');
      eq(BOS.promos.find(function(p){ return p.code === 'DIWALI15'; }).used, 0, 'a declined payment doesn’t use up the promo');
      var s3 = bosCheckoutStart({ planId:'plan-floor', seats:4, interval:'annual', boosts:['boost-insights'], currency:'INR' }); ok(s3.ok, s3.reason);
      var r = bosCheckoutPay(s3.link.id); ok(r.ok, r.reason); var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID);
      eq(sub.planId, 'plan-floor'); eq(sub.status, 'active'); eq(sub.seats, 4); ok(r.doc && r.doc.status === 'paid' && r.doc.lines.length === 2, 'paid tax invoice with lines');
      ok(BOS.outbox.some(function(m){ return new RegExp('Your Oontu invoice ' + r.doc.no.replace(/\//g, '\\/')).test(m.subject); }), 'invoice sent automatically (simulated)');
    });
    await t('upgrade mid-term: the unused part of the current plan is credited', async function(){
      var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID); ok(sub.paidThrough, 'paid plan running');
      var q = bosCheckoutQuote({ planId:'plan-network', seats:4, interval:'annual', account:harbor, accountId:harbor.id, currency:'INR', current:{ paidFrom:sub.paidFrom, paidThrough:sub.paidThrough, amount:sub.paidAmount } });
      ok(q.ok && q.credit > 0 && q.credit <= sub.paidAmount, 'credit ' + q.credit); eq(q.taxable, Math.max(0, Math.round((q.subtotal - q.credit) * 100) / 100));
    });
    await t('renewals: charged on the date; above ₹15,000 the customer approves; failures get reminders, then read-only, nothing deleted', async function(){
      var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID); sub.renewalDate = new Date(Date.now() - D).toISOString().slice(0, 10); sub.currency = 'INR'; sub.price = 9000; sub.mandate = { status:'active' }; sub.dunning = null; sub.status = 'active';
      var r = bosRenewalRun(); ok(r.charged.indexOf(sub.id) > -1, 'charged: ' + JSON.stringify(r)); ok(sub.renewalDate > new Date().toISOString().slice(0, 10), 'next date moved');
      sub.renewalDate = new Date(Date.now() - D).toISOString().slice(0, 10); sub.price = 40000;
      r = bosRenewalRun(); ok(r.needsAuth.indexOf(sub.id) > -1 && sub.dunning, 'above ₹15,000: customer approval needed');
      var link = BOS.payLinks.filter(function(l){ return l.invoiceId && l.status === 'open'; }).slice(-1)[0]; ok(link && link.shares.length, 'link sent to the customer');
      ok(BOS_PAY.simulate('payment.captured', { id:link.id, amount:link.amount, currency:link.currency, version:1 }).applied, 'customer paid'); ok(!sub.dunning && sub.status === 'active', 'cleared');
      sub.renewalDate = new Date(Date.now() - D).toISOString().slice(0, 10); sub.price = 9000; sub.mandate = { status:'active', fail:true };
      r = bosRenewalRun(); ok(r.failed.indexOf(sub.id) > -1 && sub.status === 'past_due', 'failed charge');
      APS.clockOffsetMs = (APS.clockOffsetMs || 0) + 8 * D; r = bosRenewalRun(); APS.clockOffsetMs -= 8 * D;
      ok(sub.dunning.step === 4 && sub.readOnly, 'three reminders then read-only'); ok(BOS.outbox.filter(function(m){ return /Payment reminder/.test(m.subject); }).length >= 3, 'reminders 1–3');
      ok(tenantById(CURRENT_ORGANIZATION_ID), 'nothing deleted'); ok(AUDIT_LOG.some(function(e){ return /read-only for non-payment/.test(e.action); }), 'audited');
    });
    await t('the customer’s Plan & billing shows checkout and their invoices; Finance has the billing desk', async function(){
      state.role = 'admin'; renderSidebar(); var html = sec_billing(true); ok(/Choose a plan/.test(html) && /Invoices and receipts/.test(html) && /OON\//.test(html), 'customer view');
      state.role = 'oontu'; as('PU-106'); bosActAs('PU-106'); renderSidebar(); showView('oontu-finance'); bosTab('oontu-finance', 6); await sleep(20);
      var m = document.getElementById('main-content').textContent;
      if(typeof o2On === 'function' && o2On('4c')){ var d4 = document.createElement('div'); d4.innerHTML = o2InvoicesTabHTML('invoices') + o2InvoicesTabHTML('links') + o2PlansTabHTML('promos') + o2InvoicesTabHTML('payments'); m = d4.textContent; }   /* O2 4c splits the billing desk across Invoices & payments and Plans & pricing */ ok(/Drafts/.test(m) && /Payment links/.test(m) && /Promo codes/.test(m) && /Renewals and reminders/.test(m), m.slice(0, 200));
      bosDraftDialog(); ok(document.querySelector('#bos-dialog-root [role=dialog]'), 'new invoice dialog'); bosDialogClose(); bosActAs('PU-001');
    });
    pub();
  }, 300); });
})();
