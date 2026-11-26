// @o2-runner switches=0b,0c,0d
/* O2 Step 0d: one visible invoice model (OON/… only), overdue from tax invoices, grandfathered plans.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-invoice-view.spec.js */
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
  function mainText(){ return document.getElementById('main-content').innerText; }
  function dlgText(){ var r = document.getElementById('bos-dialog-root'); var s = r ? r.innerText : ''; if(typeof bosDialogClose === 'function') bosDialogClose(); return s; }
  /* every platform screen, every finance tab, the subscription page: text that shows an internal invoice id */
  function crawl(){
    var hits = [];
    var look = function(where){ var m = mainText().match(/\binv-\d+\b/g); if(m) hits.push(where + ': ' + m.join(',')); };
    Object.keys(BOS_VIEW_ACCESS).forEach(function(v){ if(v === 'oontu-subscription-detail') oontuSubDetailId = subscriptionForTenant('org-northstar').id; if(v === 'oontu-tenant-detail') oontuTenantDetailId = 'org-northstar'; showView(v); look(v); });
    for(var i = 0; i < 7; i++){ showView('oontu-finance'); bosTab('oontu-finance', i); look('oontu-finance tab ' + i); }
    return hits;
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var gN = generateInvoiceForSubscription(subscriptionForTenant('org-northstar').id), gS = generateInvoiceForSubscription(subscriptionForTenant('org-southline').id);
    var invN = gN.invoice, invS = gS.invoice, taxN = gN.taxInvoice, taxS = gS.taxInvoice;

    await t('the internal row is still created and linked to its tax invoice', async function(){
      ok(/^inv-\d+$/.test(invN.id), 'internal id kept'); eq(invN.taxInvoiceNo, taxN.no); eq(taxN.sourceRef, invN.id); eq(o2InvoiceLabel(invN.id), taxN.no);
    });

    await t('acceptance 1: no inv-N number visible on any platform screen; tax numbers shown instead', async function(){
      var hits = crawl(); eq(hits.length, 0, hits.join(' | '));
      showView('oontu-finance'); bosTab('oontu-finance', 2); var txt = mainText(); ok(txt.indexOf(taxN.no) > -1 && txt.indexOf(taxS.no) > -1, 'OON numbers in Invoices');
      var btn = document.querySelector('#main-content [onclick*="bosOpenVerifyPayment(\'' + invN.id + '\')"]'); ok(btn, 'actions still carry the internal id');
    });
    await t('dialogs show tax numbers too (verify payment, refund request)', async function(){
      bosOpenVerifyPayment(invN.id); var d = dlgText(); ok(d.indexOf(taxN.no) > -1 && !/\binv-\d+\b/.test(d), d.slice(0, 160));
      as('PU-106'); var r = markInvoicePaid(invS.id, { reference:'UTR123456789', note:'Bank transfer' }); ok(r.ok, r.reason); as('PU-001');
      bosRefundDialog(null); d = dlgText(); ok(d.indexOf(taxS.no) > -1 && !/\binv-\d+\b/.test(d), 'refund picker: ' + d.slice(0, 200));
    });

    await t('acceptance 2: overdue follows the tax invoice’s due date and settlement', async function(){
      var past = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10), future = new Date(Date.now() + 9 * 864e5).toISOString().slice(0, 10);
      invN.dueDate = past; taxN.dueDate = future; ok(!isInvoiceOverdue(invN), 'tax invoice not due yet → not overdue (the internal date is ignored)');
      o2SetSwitch('0d', false); ok(isInvoiceOverdue(invN), 'with 0d off the internal date decides, as before'); o2SetSwitch('0d', true);
      taxN.dueDate = past; ok(isInvoiceOverdue(invN), 'tax invoice past due → overdue');
      var items = o2OverdueTaxInvoices(); eq(items.length, 1); eq(items[0].tax.no, taxN.no);
      showView('oontu-dashboard'); var txt = mainText(); ok(txt.indexOf(taxN.no) > -1, 'overview names the tax invoice'); ok(!/\binv-\d+\b/.test(txt));
      taxN.dueDate = null; ok(isInvoiceOverdue(invN), 'no due date on the tax invoice: the internal one is used');
      taxS.dueDate = past; ok(!isInvoiceOverdue(invS), 'paid is never overdue');
    });

    await t('acceptance 3: legacy plans labelled “Grandfathered — not for sale” and not offered for new sales', async function(){
      var legacy = PLATFORM_PLANS.filter(function(p){ return p.legacy; }).map(function(p){ return p.id; }); eq(legacy.join(','), 'plan-starter,plan-growth,plan-enterprise');
      showView('oontu-plans'); var txt = mainText(); eq((txt.match(/Grandfathered — not for sale/g) || []).length, 3, 'one label per legacy plan');
      showView('oontu-tenants'); openCreateTenantModal(); await sleep(10);
      var sel = document.getElementById('ct-plan'); ok(sel, 'plan picker'); var opts = Array.prototype.map.call(sel.options, function(o){ return o.value; });
      ok(legacy.every(function(id){ return opts.indexOf(id) < 0; }), 'no legacy plan in Create workspace: ' + opts.join(',')); ok(legacy.indexOf(ctSheet.planId) < 0, 'default is a plan for sale: ' + ctSheet.planId);
      closeCreateTenantModal();
      as('PU-102'); bosProposalDialog(BOS.opps[0].id); var pr = document.getElementById('bos-pr-plan'); var po = Array.prototype.map.call(pr.options, function(o){ return o.value; }); bosDialogClose(); as('PU-001');
      ok(legacy.every(function(id){ return po.indexOf(id) < 0; }), 'no legacy plan in New proposal: ' + po.join(','));
      oontuSubDetailId = subscriptionForTenant('org-northstar').id; showView('oontu-subscription-detail'); var sp = Array.prototype.slice.call(document.querySelectorAll('#main-content select option')).map(function(o){ return o.value + (o.selected ? '*' : ''); });
      ok(sp.indexOf('plan-growth*') > -1, 'the current legacy plan stays shown as selected: ' + sp.join(',')); ok(sp.indexOf('plan-starter') < 0 && sp.indexOf('plan-enterprise') < 0, 'other legacy plans not offered');
      eq(subscriptionForTenant('org-northstar').planId, 'plan-growth', 'the demo tenant is not moved');
    });

    await t('switch 0d off: the old screens again (inv-N visible in Invoices, no labels); nothing was written', async function(){
      var before = JSON.stringify([PLATFORM_INVOICES, BOS.taxInvoices.length, PLATFORM_PLANS]);
      o2SetSwitch('0d', false); showView('oontu-finance'); bosTab('oontu-finance', 2); ok(/\binv-\d+\b/.test(mainText()), 'old ids visible when off');
      showView('oontu-plans'); ok(mainText().indexOf('Grandfathered') < 0, 'no label when off');
      o2SetSwitch('0d', true); eq(JSON.stringify([PLATFORM_INVOICES, BOS.taxInvoices.length, PLATFORM_PLANS]), before, 'no record changed by turning it off and on');
    });
    pub();
  }, 300); });
})();
