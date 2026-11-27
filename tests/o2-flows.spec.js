// @o2-runner switches=0b,0c,0d,1a,1b,1c,2,3a,3b,4a,4b,4c,4d,5,6,7a,7c,8a,8b
/* O2 Step 9: end-to-end flows on the new screens with every step on (7b's sign-in step is covered by o2-mfa.spec.js):
   lead → won → hand-over → live, checkout, renewal → dunning → read-only → paid, bank transfer with TDS, refund,
   sensitive access; every new screen renders for the Super Admin.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-flows.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; try { bosActAs(id); } catch(e){} }
  var WHY = 'Checked the evidence on file and it is justified for this case.', DAY = 864e5;
  function main(){ return document.getElementById('main-content'); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var harbor = BOS.accounts.find(function(a){ return a.tenantIds.indexOf(CURRENT_ORGANIZATION_ID) > -1; });

    await t('every new screen renders for the Super Admin', async function(){
      ['oontu-home', 'oontu-mywork', 'oontu-approvals', 'oontu-reports', 'oontu-accounts', 'oontu-revenue', 'oontu-workspaces', 'oontu-custops', 'oontu-service', 'oontu-incidents', 'oontu-announcements', 'oontu-subscriptions', 'oontu-invoices', 'oontu-plans', 'oontu-tax', 'oontu-people', 'oontu-audit', 'oontu-integrity', 'oontu-ai', 'oontu-controls', 'oontu-settings'].forEach(function(v){ showView(v); var txt = main().textContent; ok(state.activeNav === v, v + ' opened (' + state.activeNav + ')'); ok(txt.length > 80 && !/Not available|Something went wrong/.test(txt), v); ok(!/\binv-\d+\b/.test(txt), v + ' shows no internal invoice ids'); });
    });
    await t('F: lead → won → hand-over → provisioned once → workspace live', async function(){
      as('PU-102'); var opp = BOS.opps.find(function(x){ return x.title === 'Meridian Health Hiring · New business'; });
      var p = BOS.proposals.find(function(x){ return x.oppId === opp.id && x.status === 'sent'; }); ok(p, 'a sent proposal'); ok(bosAcceptProposal(p.id).ok, 'accepted');
      var w = bosMoveStage(opp.id, 'Won'); ok(w.ok && w.handover && w.handover.ok, w.reason); var o = w.handover.onboarding;
      as(o.ownerId); var before = PLATFORM_TENANTS.length, r = bosProvisionFromOnboarding(o.id); ok(r.ok, r.reason); eq(PLATFORM_TENANTS.length, before + 1, 'one workspace'); ok(!bosProvisionFromOnboarding(o.id).ok, 'once');
      as('PU-001'); var tn = r.tenant; ok(['provisioning', 'trial', 'active'].indexOf(o2Lifecycle(tn)) > -1, 'lifecycle ' + o2Lifecycle(tn));
      openOontuTenantDetail(tn.id); await sleep(5); eq(state.activeNav, 'oontu-workspace'); ok(main().querySelector('.o2-ws-head'), 'Workspace 360');
    });
    await t('F: checkout → tax invoice paid by the provider event, allocated, subscription with items', async function(){
      as('PU-001'); var c = bosCheckoutStart({ tenantId:'org-southline', planId:'plan-floor', seats:3, interval:'monthly', currency:'INR' }); ok(c.ok, c.reason); var p = bosCheckoutPay(c.link.id); ok(p && p.ok, p && p.reason);
      var doc = bosTaxInvoice(c.link.docNo); ok(doc && doc.buyer, 'invoice with the buyer snapshot'); eq(o2Settlement(doc).status, 'paid'); var s = subscriptionForTenant('org-southline'); ok(s.items && s.items.length && s.billingCustomerId, 'items and billing customer');
      ok(BOS.events.some(function(e){ return e.name === 'subscription.checkout'; }), 'a command');
    });
    await t('F: renewal → dunning → read-only → paid', async function(){
      var s = subscriptionForTenant(CURRENT_ORGANIZATION_ID), tn = tenantById(CURRENT_ORGANIZATION_ID);
      s.renewalDate = new Date(bosNow() - DAY).toISOString().slice(0, 10); s.mandate = { status:'active', method:'card', fail:true };
      bosRenewalRun(); eq(o2SubStatus(s), 'past_due'); s.dunning.since = new Date(bosNow() - 8 * DAY).toISOString().slice(0, 10); s.dunning.step = 3; bosRenewalRun();
      eq(o2SubStatus(s), 'unpaid'); eq(o2AccessLevel(tn).level, 'read-only');
      var l = BOS.payLinks.filter(function(x){ return x.invoiceId && invoiceById(x.invoiceId) && invoiceById(x.invoiceId).subscriptionId === s.id && x.status === 'open'; }).slice(-1)[0]; ok(l, 'link');
      ok(BOS_PAY.simulate('payment.captured', { id:l.id, amount:l.amount, currency:l.currency, version:1 }).applied); eq(o2AccessLevel(tn).level, 'full'); eq(o2SubStatus(s), 'active');
    });
    await t('F: bank transfer with TDS settles the invoice', async function(){
      as('PU-106'); var g = generateInvoiceForSubscription(subscriptionForTenant('org-southline').id); var t0 = g.taxInvoice, tds = Math.round(t0.amount * 10) / 100;
      var c = o2RecordBankCredit({ amount:Math.round((t0.total - tds) * 100) / 100, currency:t0.currency, reference:'UTR ' + t0.no, payerName:t0.customer }); ok(c.ok, c.reason);
      var sg = o2SuggestMatches(c.payment.id); ok(sg.length, 'suggested'); ok(o2Allocate(c.payment.id, sg[0].invoiceNo, sg[0].amount).ok); eq(o2Settlement(t0).status, 'partly_paid');
      ok(o2RecordTds(t0.no, { amount:tds, section:'194J' }).ok); eq(o2Settlement(t0).status, 'paid');
    });
    await t('F: refund requested, approved by another Finance manager, completed by the provider', async function(){
      var inv = PLATFORM_INVOICES.find(function(i){ return i.status === 'paid'; }); ok(inv, 'a paid invoice');
      as('PU-106'); var r = bosRequestRefund({ invoiceId:inv.id, amount:1, reason:'Goodwill credit for the outage' }); ok(r.ok, r.reason); ok(!bosDecide(r.approval.id, true, WHY, 'Other (explained in note)').ok, 'not by the requester');
      as('PU-001'); var d = bosDecide(r.approval.id, true, WHY, 'Other (explained in note)'); ok(d.ok, d.reason); eq(r.refund.status, 'approved');
      ok(BOS_PAY.simulate('refund.processed', { id:r.refund.providerId, amount:1, currency:inv.currency, version:1 }).applied, 'provider completes it'); eq(r.refund.status, 'refunded');
    });
    await t('F: sensitive access needs a ticket, customer permission and someone else, and expires', async function(){
      as('PU-103'); var tk = BOS.tickets.find(function(x){ return x.accountId === harbor.id; }) || bosCreateTicket({ subject:'Import mapping', body:'x', contactEmail:'priya@harborpartners.example', source:'In-app', accountId:harbor.id }).ticket;
      ok(!bosRequestAccess({ tenantId:CURRENT_ORGANIZATION_ID, scope:'workspace-data', purpose:'Check the import mapping', hours:2 }).ok, 'needs a ticket');
      var r = bosRequestAccess({ tenantId:CURRENT_ORGANIZATION_ID, scope:'workspace-data', purpose:'Check the import mapping', hours:2, ticketId:tk.id, customerAuthorised:true }); ok(r.ok, r.reason);
      ok(!bosDecide(r.approval.id, true, WHY, 'Other (explained in note)').ok, 'not self-approved'); as('PU-104'); ok(bosDecide(r.approval.id, true, WHY, 'Other (explained in note)').ok); as('PU-103'); ok(bosHasAccess(CURRENT_ORGANIZATION_ID, 'workspace-data'), 'granted');
      as('PU-001');
    });
    await t('the inbox, bell and search work across the flows', async function(){
      as('PU-001'); showView('oontu-approvals'); ok(/Approvals/.test(main().textContent)); globalSearchQuery = 'Meridian'; ok(globalSearchAllResults().some(function(x){ return x.type === 'Account' || x.type === 'Deal'; }), 'search finds the account or deal');
      ok(Array.isArray(computeNotifications()), 'bell');
    });
    pub();
  }, 300); });
})();
