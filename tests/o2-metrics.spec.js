// @o2-runner switches=0b
/* O2 Step 0b: policy store, internal flag, MRR (§3.8) and access level (§3.2).
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-metrics.spec.js */
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
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; }
  function html(id){ return RENDERERS[id](); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);

    await t('switch 0b is on for this spec; every other step off', async function(){ ok(o2On('0b'), '0b on'); var forced = window.__O2_SWITCHES__ || {}; ok((!o2On('0c') || forced['0c']) && (!o2On('1a') || forced['1a']), 'others off unless the runner turned them on'); eq(O2_SWITCH_DEFAULTS['0b'], false, 'default off in code'); });

    await t('policy: every §4.1 key with its placeholder value', async function(){
      var p = PLATFORM_SETTINGS.policy;
      var want = { trialGraceDays:7, readOnlyAfterDays:7, closedRetentionDays:90, suspendNeedsSecondPerson:true, suspendedOwnerExport:'after-review', downgradeTiming:'next-renewal', cancelDefault:'period-end', legacyPlans:'grandfathered', marketRule:'gstin-then-billing-country', exportLinkHours:24, incompleteAbandonHours:24, unmatchedCreditDays:7, tdsCertificateDueDays:60, tdsExpectedPercent:null, stepUpMinutes:15 };
      Object.keys(want).forEach(function(k){ eq(p[k], want[k], k); });
      eq(JSON.stringify(p.dunningReminderDays), '[1,3,7]'); ok(/246810/.test(p.mfaMethod), 'mfa code');
      eq(JSON.stringify(p.discountAndTrial), JSON.stringify(BOS_POLICY), 'B9 thresholds are today’s BOS_POLICY');
      eq(O2_POLICY_KEYS.length, 18); eq(o2Policy('closedRetentionDays'), 90);
    });

    await t('internal flag: every seeded workspace is false (none is Oontu’s own or a test workspace)', async function(){
      ok(PLATFORM_TENANTS.length >= 2); ok(PLATFORM_TENANTS.every(function(x){ return x.internal === false; }), JSON.stringify(PLATFORM_TENANTS.map(function(x){ return [x.id, x.internal]; })));
    });

    var south = tenantById('org-southline');
    await t('MRR case 1, annual subscription: Northstar Growth USD 499 a year = 499 ÷ 12', async function(){
      var s = subscriptionForTenant('org-northstar'); eq(s.billingInterval, 'annual'); eq(s.currency, 'USD');
      near(o2Mrr(s), Math.round(499 / 12 * 100) / 100, 'annual');
    });
    await t('MRR case 2, monthly subscription by checkout: Southline Floor, 3 licences, INR monthly = 2,999 × 3', async function(){
      var c = bosCheckoutStart({ tenantId:'org-southline', planId:'plan-floor', seats:3, interval:'monthly', currency:'INR' }); ok(c.ok, c.reason);
      var p = bosCheckoutPay(c.link.id); ok(p && p.ok, p && p.reason);
      var s = subscriptionForTenant('org-southline'); eq(s.planId, 'plan-floor'); eq(s.billingInterval, 'monthly');
      near(o2Mrr(s), 2999 * 3, 'monthly'); near(oSubMrr(s), 2999 * 3, 'old calculation agrees when nothing is prorated');
    });
    await t('MRR case 3, upgrade by checkout with proration: Scale, 5 licences, annual INR = 3,999 × 5 (credit not in MRR)', async function(){
      var s0 = subscriptionForTenant('org-southline');
      var c = bosCheckoutStart({ tenantId:'org-southline', planId:'plan-scale', seats:5, interval:'annual', currency:'INR', current:{ paidFrom:s0.paidFrom, paidThrough:s0.paidThrough, amount:s0.paidAmount } }); ok(c.ok, c.reason);
      ok(c.quote.credit > 0, 'the upgrade carries a proration credit: ' + c.quote.credit);
      var p = bosCheckoutPay(c.link.id); ok(p && p.ok, p && p.reason);
      var s = subscriptionForTenant('org-southline'); eq(s.planId, 'plan-scale'); eq(s.seats, 5);
      near(o2Mrr(s), 3999 * 5, 'list price × licences'); ok(Math.abs(oSubMrr(s) - 3999 * 5) > 1, 'the old figure includes the credit, the new one does not');
    });
    await t('totals: INR and USD separately, never summed; internal workspaces left out', async function(){
      var tot = o2MrrTotals(); near(tot.byCurrency.USD, Math.round(499 / 12 * 100) / 100); near(tot.byCurrency.INR, 3999 * 5); eq(Object.keys(tot.byCurrency).sort().join(','), 'INR,USD');
      south.internal = true; var t2 = o2MrrTotals(); ok(!t2.byCurrency.INR, 'internal excluded'); eq(t2.internalExcluded, 1); south.internal = false;
      ok(/INR 19,995/.test(o2MoneyByCurrency(tot.byCurrency)) && /USD 42/.test(o2MoneyByCurrency(tot.byCurrency)), o2MoneyByCurrency(tot.byCurrency));
      var s = subscriptionForTenant('org-southline'); s.status = 'paused'; eq(o2Mrr(s), 0, 'paused is not MRR'); s.status = 'past_due'; near(o2Mrr(s), 19995, 'past_due counts'); s.status = 'active';
    });

    await t('access level matches §3.2 for every workspace state × subscription status', async function(){
      var future = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10), past = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
      var W = { trial:{ id:'x-trial', status:'trial' }, active:{ id:'x-act', status:'active' }, suspended:{ id:'x-sus', status:'suspended' }, closed:{ id:'x-clo', status:'cancelled' }, archived:{ id:'x-arc', status:'archived' } };
      var S = { incomplete:{ status:'incomplete', o2Status:'incomplete' }, trialing:{ status:'trial' }, active:{ status:'active' }, activeCancelAt:{ status:'active', cancelAt:future }, past_due:{ status:'past_due' }, unpaid:{ status:'active', readOnly:true }, paused:{ status:'paused' }, canceledLater:{ status:'cancelled', paidThrough:future }, canceledOver:{ status:'cancelled', paidThrough:past } };
      var table = [
        ['trial', 'incomplete', 'full', false], ['trial', 'trialing', 'full', false],
        ['active', 'incomplete', 'full', false], ['active', 'active', 'full', false], ['active', 'activeCancelAt', 'full', false], ['active', 'past_due', 'full', true],
        ['active', 'unpaid', 'read-only', true], ['active', 'paused', 'read-only', false], ['active', 'canceledLater', 'full', false], ['active', 'canceledOver', 'read-only', false],
        ['trial', 'canceledOver', 'read-only', false]
      ];
      Object.keys(S).forEach(function(k){ table.push(['suspended', k, 'blocked', false]); table.push(['closed', k, 'read-only', false]); table.push(['archived', k, 'blocked', false]); });
      table.forEach(function(r){ var a = o2AccessLevel(W[r[0]], S[r[1]]); eq(a.level + '/' + a.banner, r[2] + '/' + r[3], r[0] + ' × ' + r[1]); });
      eq(o2AccessLevel(W.closed, S.active).ownerExport, true, 'closed: owner export'); eq(o2AccessLevel(W.suspended, S.active).ownerExport, 'after-review', 'suspended: policy');
      eq(o2AccessLevel({ id:'x-inv', status:'invited' }, null).level, 'blocked', 'provisioning');
      PLATFORM_TENANTS.forEach(function(x){ eq(o2AccessLevel(x).level, 'full', x.id + ' seeded'); });
    });

    await t('screens with 0b on: MRR card, access badge, policy card', async function(){
      var d = html('oontu-dashboard'); ok(d.indexOf('INR 19,995') > -1 && d.indexOf('USD 42') > -1, 'new MRR in the card'); ok(/old calculation/.test(d), 'old figure kept for comparison');
      oontuTenantDetailId = 'org-northstar'; var td = html('oontu-tenant-detail'); ok(td.indexOf('data-o2-access="full"') > -1, 'badge'); ok(/Shown only; not enforced/.test(td));
      var st = html('oontu-settings'); ok(st.indexOf('id="o2-policy"') > -1 && /pending B1/.test(st) && /closedRetentionDays/.test(st), 'policy card');
      showView('oontu-dashboard'); await sleep(30); ok(document.getElementById('main-content').textContent.indexOf('INR 19,995') > -1, 'rendered on screen');
    });
    await t('switch 0b off: the old MRR card, no badge, no policy card (nothing else changes)', async function(){
      o2SetSwitch('0b', false);
      var d = html('oontu-dashboard'); ok(d.indexOf('old calculation') < 0, 'no comparison note'); ok(d.indexOf('INR ' + Math.round(oSubMrr(subscriptionForTenant('org-southline'))).toLocaleString()) > -1, 'old MRR figure');
      oontuTenantDetailId = 'org-northstar'; ok(html('oontu-tenant-detail').indexOf('o2-access') < 0, 'no badge'); ok(html('oontu-settings').indexOf('o2-policy') < 0, 'no policy card');
      o2SetSwitch('0b', true); ok(html('oontu-dashboard').indexOf('old calculation') > -1, 'on again');
    });
    pub();
  }, 300); });
})();
