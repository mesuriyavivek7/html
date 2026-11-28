// @o2-runner switches=0b,0c
/* O2 Step 0c: billing customer (R2/R4), market rule and lock, buyer snapshot, identical tax results.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-billing-customer.spec.js */
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
  /* everything tax decides, without the party's own bookkeeping fields */
  function taxOf(acc, amount, cur, date){ var c = bosTaxCompute(acc, amount, cur, date); var p = c.party || {}; return JSON.stringify({ seg:c.segment, party:[p.country, p.gstin, p.stateCode, p.state], n:[c.taxable, c.taxableINR, c.cgstINR, c.sgstINR, c.igstINR, c.taxINR, c.taxForeign, c.total, c.totalINR] }); }
  function allCases(){
    var out = [];
    BOS.accounts.forEach(function(a){ [['INR', 50000, '2026-11-25'], ['INR', 150000, '2026-11-25'], ['USD', 499, '2026-11-25'], ['USD', 1499, '2027-05-01'], ['INR', 500000, '2027-01-10']].forEach(function(k){ out.push(a.id + '|' + k.join('|') + '|' + taxOf(a, k[1], k[0], k[2])); }); });
    var party = function(country, state, gstin){ return bosTaxPartyOf({ name:'X', taxCountry:country, taxState:state, gstin:gstin || '' }); };
    [[party('India', '', '29AABCV1111N1Z1'), 50000], [party('India', '', '27AABCH1234K1Z2'), 50000], [party('United Kingdom'), 50000], [party('India', 'Kerala'), 150000], [party('India', 'Karnataka'), 500000], [party('India', ''), 1], [null, 1]].forEach(function(c, i){ out.push('case' + i + '|' + JSON.stringify(bosTaxSegment(c[0], '2026-11-25', c[1]))); });
    return out;
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var north = BOS.accounts.find(function(a){ return a.tenantIds.indexOf('org-northstar') > -1; }), south = BOS.accounts.find(function(a){ return a.tenantIds.indexOf('org-southline') > -1; });

    await t('seed: one billing customer per account with a subscription, copied from its tax details; subscriptions linked', async function(){
      eq(BOS.billingCustomers.length, 2, 'two accounts have subscriptions');
      [north, south].forEach(function(a){ var b = o2BillingCustomerOfAccount(a.id); ok(b, a.name); eq(b.legalName, a.name); eq(b.gstin, a.gstin); eq(b.country, a.taxCountry); eq(b.market, 'India'); eq(b.currency, 'INR'); ok(b.history.length >= 1); ok(!b.marketLockedAt, 'not locked before an invoice'); });
      PLATFORM_SUBSCRIPTIONS.forEach(function(s){ ok(s.billingCustomerId && o2BillingCustomer(s.billingCustomerId), s.id + ' linked'); });
      ok(!o2BillingCustomerOfAccount('ACC-1005'), 'no billing customer for an account without a subscription');
    });

    await t('acceptance 1: bosTaxSegment returns identical results with 0c on and off for every seed and every spec case', async function(){
      var on = allCases(); o2SetSwitch('0c', false); var off = allCases(); o2SetSwitch('0c', true);
      eq(on.length, off.length); var diff = on.filter(function(x, i){ return x !== off[i]; }); eq(diff.length, 0, 'differences: ' + diff.slice(0, 2).join(' / '));
      ok(on.length >= 40, 'cases compared: ' + on.length);
      ok(bosTaxPartyOf(north).billingCustomerId, 'with 0c on the facts come from the billing customer');
    });

    await t('switch on reads the billing customer; switch off reads the account (proved with a deliberate difference)', async function(){
      var b = o2BillingCustomerOfAccount(north.id), keep = { g:b.gstin, c:b.stateCode, s:b.state };
      b.gstin = '29AABCH1234K1Z2'; b.stateCode = '29'; b.state = 'Karnataka';
      eq(bosTaxCompute(north, 1000, 'INR', '2026-11-25').segment.code, 'INTRA', 'on: billing customer in Karnataka');
      o2SetSwitch('0c', false); eq(bosTaxCompute(north, 1000, 'INR', '2026-11-25').segment.code, 'INTER', 'off: account in Maharashtra'); o2SetSwitch('0c', true);
      b.gstin = keep.g; b.stateCode = keep.c; b.state = keep.s; eq(bosTaxCompute(north, 1000, 'INR', '2026-11-25').segment.code, 'INTER');
    });

    await t('dual-write: tax details edited on the account reach the billing customer (and back)', async function(){
      as('PU-106');
      var e0 = BOS.events.filter(function(e){ return e.name === 'billing-customer.sync'; }).length; var r = bosSetCustomerTax(south.id, { country:'India', gstin:'29AABCS5678L1Z3' }); ok(r.ok, r.reason); ok(BOS.events.filter(function(e){ return e.name === 'billing-customer.sync'; }).length === e0 + 1, 'the sync is its own command (O2 audit)');
      var b = o2BillingCustomerOfAccount(south.id); eq(b.gstin, '29AABCS5678L1Z3'); eq(b.stateCode, '29');
      r = o2BillingCustomerUpdate(b.id, { gstin:'07AABCS5678L1Z3' }); ok(r.ok, r.reason); eq(south.gstin, '07AABCS5678L1Z3', 'account kept current'); eq(b.stateCode, '07');
      as('PU-001');
    });

    await t('acceptance 2: market rule, lock by the first invoice, change only from the next renewal', async function(){
      var uk = o2EnsureBillingCustomer('ACC-1005'); eq(uk.market, 'International', 'no GSTIN, billing country UK'); eq(uk.currency, 'USD');
      as('PU-106'); var r = o2BillingChangeMarket(uk.id, 'India', 'Customer now invoiced from its India entity.'); ok(r.ok && r.immediate, 'before any invoice the change applies now'); eq(uk.market, 'India');
      var sub = subscriptionForTenant('org-northstar'), b = o2BillingCustomer(sub.billingCustomerId);
      as('PU-001'); var g = generateInvoiceForSubscription(sub.id); ok(g.ok && g.taxInvoice, g.reason); ok(b.marketLockedAt, 'locked by the first invoice');
      as('PU-101'); ok(!o2BillingChangeMarket(b.id, 'International', 'Sales should not be able to do this at all.').ok, 'a Sales Executive is refused');
      as('PU-106'); ok(!o2BillingChangeMarket(b.id, 'International', 'short').ok, 'a reason is required');
      r = o2BillingChangeMarket(b.id, 'International', 'Billing moves to the UK parent from the next term.'); ok(r.ok && !r.immediate, r.reason); eq(r.from, sub.renewalDate, 'from the next renewal');
      eq(b.market, 'India', 'unchanged until the renewal'); eq(o2BillingApplyDue(new Date(new Date(sub.renewalDate).getTime() - 864e5).toISOString()).length, 0, 'not the day before');
      eq(o2BillingApplyDue(sub.renewalDate + 'T00:00:00Z').indexOf(b.id) > -1, true, 'applied on the renewal date'); eq(b.market, 'International'); ok(!b.pendingMarket);
      as('PU-001');
    });

    await t('acceptance 3: editing the billing address leaves earlier invoices with the old address (R4 snapshot)', async function(){
      var sub = subscriptionForTenant('org-southline'), b = o2BillingCustomer(sub.billingCustomerId), oldAddr = b.address;
      var g1 = generateInvoiceForSubscription(sub.id); ok(g1.ok && g1.taxInvoice, g1.reason); var t1 = g1.taxInvoice;
      ok(t1.buyer && t1.buyer.billingCustomerId === b.id, 'snapshot stored'); eq(t1.buyer.address, oldAddr); ok(t1.buyer.taxDecision && t1.buyer.taxDecision.ruleVersion, 'tax decision and rule version frozen');
      as('PU-106'); var r = o2BillingCustomerUpdate(b.id, { address:'14 Barakhamba Road, New Delhi 110001', legalName:'Southline Talent Group Pvt Ltd' }); ok(r.ok, r.reason); as('PU-001');
      var g2 = generateInvoiceForSubscription(sub.id); ok(g2.ok, g2.reason); var t2 = g2.taxInvoice;
      eq(t2.buyer.address, '14 Barakhamba Road, New Delhi 110001'); eq(t2.buyer.legalName, 'Southline Talent Group Pvt Ltd');
      eq(t1.buyer.address, oldAddr, 'the earlier invoice keeps the old address'); eq(t1.buyer.legalName, 'Southline Talent Group');
      eq(Number(t2.no.slice(-4)), Number(t1.no.slice(-4)) + 1, 'numbering unchanged: consecutive in the year');
    });

    await t('invoices issued while 0c is off carry no snapshot; checkout links its subscription to the billing customer', async function(){
      o2SetSwitch('0c', false); var g = generateInvoiceForSubscription(subscriptionForTenant('org-northstar').id); ok(g.ok); ok(!g.taxInvoice.buyer, 'no snapshot while off'); o2SetSwitch('0c', true);
      var c = bosCheckoutStart({ tenantId:'org-southline', planId:'plan-floor', seats:2, interval:'monthly', currency:'INR' }); ok(c.ok, c.reason); ok(c.link.checkout.billingCustomerId, 'billing customer on the checkout');
      var p = bosCheckoutPay(c.link.id); ok(p && p.ok, p && p.reason); var doc = bosTaxInvoice(c.link.docNo); ok(doc && doc.buyer, 'checkout invoice has the snapshot'); eq(subscriptionForTenant('org-southline').billingCustomerId, c.link.checkout.billingCustomerId);
    });

    await t('Account 360 shows the billing customer card with 0c on, not with it off; every change audited', async function(){
      BOS_UI.sel.account = north.id; var h = RENDERERS['oontu-account'](); ok(h.indexOf('id="o2-bc"') > -1 && /Billing customer/.test(h), 'card'); ok(/locked by the first invoice/.test(h), 'lock shown: ' + (h.match(/<dt>Market<\/dt><dd>[^<]*/) || [''])[0]);
      o2SetSwitch('0c', false); ok(RENDERERS['oontu-account']().indexOf('id="o2-bc"') < 0, 'hidden when off'); o2SetSwitch('0c', true);
      ok(AUDIT_LOG.some(function(e){ return e.action === 'Billing customer changed'; }) && AUDIT_LOG.some(function(e){ return e.action === 'Billing market change scheduled'; }), 'audit rows');
      ok(BOS.events.some(function(e){ return e.name === 'billing-customer.change-market'; }), 'domain event');
    });
    pub();
  }, 300); });
})();
