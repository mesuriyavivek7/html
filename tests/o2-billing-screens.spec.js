// @o2-runner switches=0b,0c,0d,1a,4a,4b,4c
/* O2 Step 4c: billing screens — every action of every old Business & finance tab is reachable from its new place
   with the same result; no "Mark paid" outside Invoices & payments; the Subscription page.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-billing-screens.spec.js */
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
  function main(){ return document.getElementById('main-content'); }
  function clicks(html){ var out = [], re = /onclick="([^"]+)"/g, m; while((m = re.exec(html))){ var c = m[1].replace(/&quot;/g, '"'); if(!/^bosTab\(|^o2BillTab\(|^o2ApprovalsTab|^o2NavTab/.test(c)) out.push(c); } return out; }
  function newScreens(){ var html = ''; ['invoices', 'payments', 'links', 'refunds', 'reconciliation', 'vault', 'customers'].forEach(function(k){ html += o2InvoicesTabHTML(k); }); ['plans', 'addons', 'promos', 'policy'].forEach(function(k){ html += o2PlansTabHTML(k); }); html += o2TaxHTML(); return html; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    /* data so every table has rows and actions */
    var g = generateInvoiceForSubscription(subscriptionForTenant('org-northstar').id); var l = bosCreatePayLink(null, g.invoice.id);
    var ck = bosCheckoutStart({ tenantId:'org-southline', planId:'plan-floor', seats:2, interval:'monthly', currency:'INR' }); bosCheckoutPay(ck.link.id);

    await t('the three billing screens and their tabs render', async function(){
      showView('oontu-invoices'); await sleep(5); eq(Array.prototype.map.call(main().querySelectorAll('.o2-host-tab'), function(b){ return b.textContent; }).join('|'), 'Invoices|Payments|Payment links|Refunds|Reconciliation|Vault|Billing customers');
      ['invoices', 'payments', 'links', 'refunds', 'reconciliation', 'vault', 'customers'].forEach(function(k){ o2BillTab('inv', k); ok(main().textContent.length > 100 && !/Something went wrong/.test(main().textContent), k); });
      showView('oontu-plans'); await sleep(5); eq(Array.prototype.map.call(main().querySelectorAll('.o2-host-tab'), function(b){ return b.textContent; }).join('|'), 'Plans|Add-ons|Promo codes|Discount policy');
      ['plans', 'addons', 'promos', 'policy'].forEach(function(k){ o2BillTab('plans', k); ok(main().textContent.length > 80, k); });
      showView('oontu-tax'); await sleep(5); ok(/Tax/.test(main().textContent) && main().querySelectorAll('button').length > 3, 'tax tab unchanged');
    });
    await t('acceptance: every action of every old finance tab (1–6) is reachable from its new place', async function(){
      var old = []; [1, 2, 3, 4, 5, 6].forEach(function(i){ old = old.concat(clicks(o2FinanceTabBody(i))); });
      var now = clicks(newScreens()); var missing = old.filter(function(c, i, a){ return a.indexOf(c) === i && now.indexOf(c) < 0; });
      ok(old.length >= 10, 'old actions found: ' + old.length); eq(missing.length, 0, 'missing: ' + missing.slice(0, 4).join(' | '));
    });
    await t('same result from the new place: verify a payment, create a promo code', async function(){
      as('PU-106'); showView('oontu-invoices'); o2BillTab('inv', 'invoices'); var b = main().querySelector('[onclick*="bosOpenVerifyPayment"]'); ok(b, 'Verify payment button'); b.click(); await sleep(5);
      ok(document.getElementById('bos-dialog-root').textContent.indexOf('Verify payment') > -1, 'the same dialog'); document.getElementById('bos-vp-ref').value = 'UTR998877665544'; document.getElementById('bos-vp-note').value = 'Bank transfer received'; var inv = g.invoice; bosVerifySubmit(inv.id); eq(inv.status, 'paid'); ok(/manual/.test(inv.verifiedBy), 'verified by hand with a reference');
      as('PU-001'); showView('oontu-plans'); o2BillTab('plans', 'promos'); ok(main().querySelector('[onclick*="bosPromoDialog"]'), 'New promo code is here');
    });
    await t('no “Mark paid” outside Invoices & payments; the Subscription page has no Mark paid', async function(){
      var sid = subscriptionForTenant('org-northstar').id; generateInvoiceForSubscription(sid);
      ok(!/submitMarkInvoicePaid/.test(oontuInvoicesSectionHTML(subscriptionById(sid))), 'old Subscriptions section: no Mark Paid'); ok(/Verify in Invoices/.test(oontuInvoicesSectionHTML(subscriptionById(sid))), 'links to Invoices & payments');
      openOontuSubDetail(sid); await sleep(5); var txt = main().textContent; ok(!/Mark paid|Mark Paid/.test(main().innerHTML), 'no Mark paid on the Subscription page');
      ok(/Items and price/.test(txt) && /Discount, payment method/.test(txt) && /Invoices/.test(txt) && /Dunning/.test(txt) && /Change history/.test(txt), 'sections'); ok(/per licence/.test(txt) && /Next renewal/.test(txt), 'head');
      ok(!/\binv-\d+\b/.test(txt), 'OON numbers only');
    });
    await t('Subscription page: change plan or licences with a preview (proration and tax) through the command', async function(){
      var s = subscriptionForTenant('org-southline'); openOontuSubDetail(s.id); await sleep(5); o2SubChangeDialog(s.id); await sleep(5);
      document.getElementById('o2-sc-plan').value = 'plan-scale'; document.getElementById('o2-sc-seats').value = '3'; var q = o2SubChangePreview(s.id); ok(q.ok, q.reason); ok(/tax/.test(document.getElementById('o2-sc-prev').textContent), 'preview shows tax');
      var e0 = BOS.events.filter(function(e){ return e.name === 'subscription.change-plan'; }).length; o2SubChangeConfirm(s.id); eq(s.planId, 'plan-scale'); eq(s.seats, 3); ok(BOS.events.filter(function(e){ return e.name === 'subscription.change-plan'; }).length > e0, 'a command');
    });
    await t('switch 4c off: the old Business & finance screen and the old subscription page', async function(){
      o2SetSwitch('4c', false); o2SetSwitch('1a', false); showView('oontu-finance'); await sleep(5); ok(main().querySelector('.bos-tabs'), 'old tabs'); openOontuSubDetail(subscriptionForTenant('org-northstar').id); await sleep(5); ok(!/Items and price/.test(main().textContent), 'old subscription page');
      o2SetSwitch('1a', true); o2SetSwitch('4c', true);
    });
    pub();
  }, 300); });
})();
