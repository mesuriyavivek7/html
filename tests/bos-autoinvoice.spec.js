/* Automatic invoicing (prototype, 2026-11-25): every verified payment creates (or completes) exactly one GST invoice,
   stores a frozen copy in the invoice vault and sends it, with no manual step.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\bos-autoinvoice.spec.js */
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
  function pay(l){ return BOS_PAY.simulate('payment.captured', { id:l.id, amount:l.amount, currency:l.currency, version:1 }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    state.role = 'oontu'; as('PU-001'); renderSidebar(); await sleep(30);
    var harbor = BOS.accounts.find(function(a){ return a.tenantIds.indexOf(CURRENT_ORGANIZATION_ID) > -1; });

    await t('customer checkout: payment → invoice created, stored, sent, with no manual step', async function(){
      var s = bosCheckoutStart({ planId:'plan-floor', seats:3, interval:'monthly', currency:'INR' }); ok(s.ok, s.reason);
      var r = bosCheckoutPay(s.link.id); ok(r.ok, r.reason);
      var run = BOS.autoRuns.find(function(x){ return x.linkId === s.link.id; }); ok(run && run.ok, 'pipeline ran');
      eq(run.steps.map(function(x){ return x.step; }).join(' > '), 'Payment verified > Invoice ready > Stored > Sent to customer');
      var v = bosVaultFor(run.docNo); ok(v && /Tax invoice/.test(v.html) && /PAID/.test(v.html) && /GSTIN/.test(v.html), 'a stored tax invoice');
      ok(BOS.outbox.filter(function(m){ return m.subject.indexOf(run.docNo) > -1; }).length === 1, 'sent once');
      ok(AUDIT_LOG.some(function(e){ return e.action === 'Invoice created automatically' && e.detail.indexOf(run.docNo) > -1; }), 'audited');
    });
    await t('a paid subscription invoice link: the existing invoice is completed, not duplicated', async function(){
      var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID); var g = generateInvoiceForSubscription(sub.id); ok(g.ok, g.reason);
      var before = BOS.taxInvoices.length, l = bosCreatePayLink(null, g.invoice.id).link, r = pay(l); ok(r.applied, 'paid');
      eq(BOS.taxInvoices.length, before, 'no second invoice'); eq(g.taxInvoice.status, 'paid'); ok(bosVaultFor(g.taxInvoice.no), 'stored');
    });
    await t('a repeated payment event never makes a second invoice', async function(){
      var d = bosDraftInvoice({ accountId:harbor.id, currency:'INR', lines:[{ desc:'Data migration', qty:1, unitPrice:12000 }] }); var i = bosIssueDraft(d.draft.id);
      var raw = JSON.stringify({ id:'evt_repeat_1', type:'payment.captured', object:{ id:i.link.id, amount:i.link.amount, currency:i.link.currency, version:1 } });
      ok(BOS_PAY.receive(raw, BOS_PAY.sign(raw)).applied, 'first'); var n = BOS.vault.length, docs = BOS.taxInvoices.length, mails = BOS.outbox.length;
      ok(BOS_PAY.receive(raw, BOS_PAY.sign(raw)).duplicate, 'repeat ignored'); eq(BOS.vault.length, n); eq(BOS.taxInvoices.length, docs); eq(BOS.outbox.length, mails, 'no second email');
    });
    await t('a paid link with no invoice behind it gets one, tax worked back from what was paid', async function(){
      var l = { id:bosId('PL', 4), proposalId:null, invoiceId:null, docNo:null, accountId:harbor.id, amount:11800, currency:'INR', status:'open', url:'x', createdAt:new Date().toISOString(), expiresAt:new Date(Date.now() + 864e5).toISOString(), version:0, shares:[], reminders:[] };
      BOS.payLinks.push(l); var r = pay(l); ok(r.applied && r.autoInvoice && r.autoInvoice.ok, 'ran');
      var doc = bosTaxInvoice(r.autoInvoice.docNo); eq(doc.total, 11800, 'total equals what was paid'); eq(doc.amount, 10000, 'taxable worked back (IGST 18%)'); eq(doc.status, 'paid');
    });
    await t('a payment that doesn’t match is not invoiced; it becomes a Finance exception', async function(){
      var d = bosDraftInvoice({ accountId:harbor.id, currency:'INR', lines:[{ desc:'Training', qty:1, unitPrice:5000 }] }); var i = bosIssueDraft(d.draft.id);
      var r = BOS_PAY.simulate('payment.captured', { id:i.link.id, amount:1, currency:'INR', version:1 }); ok(r.mismatch && !r.autoInvoice, 'no invoice'); eq(i.doc.status, 'issued');
      ok(BOS.exceptions.some(function(e){ return e.rule === 'payment-discrepancy'; }), 'exception raised');
    });
    await t('a bank transfer verified by Finance runs the same pipeline', async function(){
      var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID); var g = generateInvoiceForSubscription(sub.id);
      as('PU-106'); var r = markInvoicePaid(g.invoice.id, { reference:'UTR4455667788' }); ok(r.ok && r.autoInvoice && r.autoInvoice.ok, 'ran'); ok(/Bank transfer UTR4455667788/.test(r.autoInvoice.via), 'via the bank reference');
      ok(bosVaultFor(g.taxInvoice.no), 'stored'); as('PU-001');
    });
    await t('renewals and proposal checkouts are invoiced the same way', async function(){
      var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID); sub.status = 'active'; sub.dunning = null; sub.readOnly = false; sub.currency = 'INR'; sub.price = 5000; sub.mandate = { status:'active' }; sub.renewalDate = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      var n = BOS.vault.length; var r = bosRenewalRun(); ok(r.charged.indexOf(sub.id) > -1, JSON.stringify(r)); ok(BOS.vault.length === n + 1, 'renewal invoice stored');
      as('PU-102'); var o = BOS.opps.find(function(x){ return x.title === 'Northstar Talent UK · New business'; }); var p = bosCreateProposal({ oppId:o.id, planId:'plan-scale', seats:3 }); bosSendProposal(p.proposal.id); var l = bosCreatePayLink(p.proposal.id).link;
      var pr = pay(l); ok(pr.autoInvoice && pr.autoInvoice.ok && bosVaultFor(pr.autoInvoice.docNo), 'proposal payment invoiced and stored'); eq(bosTaxInvoice(pr.autoInvoice.docNo).segment.code, 'EXPWOP', 'export under LUT'); as('PU-001');
    });
    await t('the stored copy is a proper GST invoice and never changes', async function(){
      var v = BOS.vault[0], doc = bosTaxInvoice(v.docNo);
      ok(/Place of supply/.test(v.html) && /SAC/.test(v.html) && /Rupees|Dollars|Pounds/.test(v.html) && /only/.test(v.html), 'required details, amount in words');
      ok(bosVaultVerify(v.docNo), 'fingerprint matches'); v.html = v.html.replace('PAID', 'UNPAID'); ok(!bosVaultVerify(v.docNo), 'a change is detected'); v.html = v.html.replace('UNPAID', 'PAID');
      eq(bosAmountInWords(118000.5, 'INR'), 'Rupees one lakh eighteen thousand and fifty paise only');
      eq(bosAmountInWords(1499, 'USD'), 'Dollars one thousand four hundred and ninety-nine only');
    });
    await t('Finance sees the vault with each run; customers open and save their invoices', async function(){
      as('PU-106'); bosActAs('PU-106'); renderSidebar(); showView('oontu-finance'); bosTab('oontu-finance', 6); await sleep(20);
      var m = document.getElementById('main-content').textContent;
      if(typeof o2On === 'function' && o2On('4c')){ var d4 = document.createElement('div'); d4.innerHTML = o2InvoicesTabHTML('vault'); m = d4.textContent; }   /* O2 4c: the vault is its own tab */ ok(/Invoice vault/.test(m) && /Stored/.test(m) && /Sent to customer/.test(m), m.slice(0, 160));
      bosInvoiceView(BOS.vault[0].docNo); ok(/Stored copy/.test(document.getElementById('bos-dialog-root').textContent) && /unchanged since it was sent/.test(document.getElementById('bos-dialog-root').textContent), 'view'); bosDialogClose();
      bosActAs('PU-001'); state.role = 'admin'; renderSidebar(); var html = sec_billing(true); ok(/bosInvoiceView\('OON\//.test(html), 'the customer can open each invoice');
    });
    pub();
  }, 300); });
})();
