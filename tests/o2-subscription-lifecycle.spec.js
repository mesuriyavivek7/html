// @o2-runner switches=0b,3a,4a,4b
/* O2 Step 4b: subscription statuses (§3.5) with dual-write, cancel at period end / now, downgrade, manual activation.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-subscription-lifecycle.spec.js */
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
  var DAY = 864e5, n = 0, OLD = { incomplete:['trial', false], trialing:['trial', false], active:['active', false], past_due:['past_due', false], unpaid:['past_due', true], paused:['paused', false], canceled:['cancelled', false] };
  function sub(st){ n++; var tn = { id:'org-sl' + n, name:'Sub Life ' + n, status:'active', createdAt:new Date().toISOString(), internal:false }; PLATFORM_TENANTS.push(tn); var s = { id:'sub-sl' + n, tenantId:tn.id, planId:'plan-floor', status:OLD[st][0], readOnly:OLD[st][1], startDate:'2026-10-01', renewalDate:new Date(bosNow() + 20 * DAY).toISOString().slice(0, 10), billingInterval:'monthly', price:2999, currency:'INR', seats:1, createdAt:new Date().toISOString() }; if(st === 'incomplete') s.o2Status = 'incomplete'; PLATFORM_SUBSCRIPTIONS.push(s); tn.subscriptionId = s.id; return s; }
  function decide(a, who){ as(who); var r = bosDecide(a.id, true, 'Signed purchase order and the customer’s written request checked; this is justified.', 'Evidence checked and valid'); as('PU-001'); return r; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var fin = PLATFORM_USER_ROSTER.filter(function(u){ return u.id !== 'PU-001' && !u.system && u.status === 'Active' && bosCan('platform-finance', 'approve_refund', null, u) && bosCan('platform-finance', 'approve_correction', null, u); }).map(function(u){ return u.id; })[0];

    await t('every §3.5 transition works with dual-write; every other one is refused', async function(){
      var states = Object.keys(O2_SUB_TRANSITIONS), okCount = 0, refused = 0;
      states.forEach(function(from){ states.forEach(function(to){ if(from === to) return; var s = sub(from); eq(o2SubStatus(s), from, 'set up ' + from); var r = o2SubSetStatus(s.id, to, 'Spec transition check');
        var allowed = O2_SUB_TRANSITIONS[from].indexOf(to) > -1 && !(from === 'active' && to === 'canceled');
        if(allowed){ ok(r.ok, from + ' → ' + to + ': ' + r.reason); eq(o2SubStatus(s), to); eq(s.status, OLD[to][0], 'old status'); eq(!!s.readOnly, OLD[to][1], 'readOnly in step'); eq(s.statusLegacy, OLD[to][0]); okCount++; }
        else { ok(!r.ok && r.reason, from + ' → ' + to + ' refused'); eq(o2SubStatus(s), from); refused++; } }); });
      ok(okCount >= 12 && refused >= 25, okCount + ' allowed, ' + refused + ' refused');
    });
    await t('cancel at period end keeps full access until the paid-through date; then canceled and the workspace closed', async function(){
      var s = sub('active'); s.paidThrough = new Date(bosNow() + 10 * DAY).toISOString().slice(0, 10);
      ok(!o2SubCancel(s.id, { reason:'x' }).ok, 'a reason is needed'); var r = o2SubCancel(s.id, { reason:'Customer moving to another tool' }); ok(r.ok && !r.pending, r.reason); eq(s.cancelAt, s.paidThrough);
      eq(o2SubStatus(s), 'active', 'still active'); eq(o2AccessLevel(tenantById(s.tenantId)).level, 'full', 'full access until then');
      o2SubscriptionRun(new Date(bosNow() + 9 * DAY).toISOString().slice(0, 10)); eq(o2SubStatus(s), 'active', 'not before'); o2SubscriptionRun(s.paidThrough); eq(o2SubStatus(s), 'canceled'); eq(o2Lifecycle(tenantById(s.tenantId)), 'closed', 'workspace closed (3a)');
    });
    await t('cancel now needs the subscription-cancel-now approval (Finance, someone else)', async function(){
      var s = sub('active'); ok(!o2SubSetStatus(s.id, 'canceled', 'now').ok, 'no direct cancel of an active subscription');
      var r = o2SubCancel(s.id, { now:true, reason:'Customer insolvent, legal asked us to stop' }); ok(r.ok && r.pending, 'sent for approval'); eq(o2SubStatus(s), 'active');
      ok(fin, 'a Finance approver exists'); var d = decide(r.approval, fin); ok(d.ok, d.reason); eq(o2SubStatus(s), 'canceled'); eq(s.status, 'cancelled');
    });
    await t('downgrade applies at the next renewal and is refused when licences in use exceed the new count', async function(){
      var s = subscriptionForTenant('org-northstar'), used = tenantUserCount('org-northstar');
      if(used > 1){ var r0 = o2SubDowngrade(s.id, 'plan-desk', used - 1, 'Smaller team'); ok(!r0.ok && r0.field === 'seats', 'licence check: ' + r0.reason); }
      var s2 = sub('active'); s2.planId = 'plan-scale'; s2.seats = 5; var r = o2SubDowngrade(s2.id, 'plan-floor', 2, 'Team shrank'); ok(r.ok, r.reason); eq(r.from, s2.renewalDate, 'from the next renewal'); eq(s2.planId, 'plan-scale', 'unchanged now');
      o2SubscriptionRun(s2.renewalDate); eq(s2.planId, 'plan-floor'); eq(s2.seats, 2); ok(!s2.pendingChange);
    });
    await t('manual activation: approved by Finance, invoice still due, dunning applies', async function(){
      var s = sub('unpaid'); eq(o2AccessLevel(tenantById(s.tenantId)).level, 'read-only');
      var r = o2SubManualActivate(s.id, 'Signed purchase order PO-7781 received'); ok(r.ok && r.pending, r.reason); var d = decide(r.approval, fin); ok(d.ok, d.reason);
      eq(o2SubStatus(s), 'active'); eq(s.readOnly, false); ok(s.manualActivation && s.manualActivation.invoiceStillDue, 'invoice still due'); ok(s.dunning, 'dunning continues'); eq(o2AccessLevel(tenantById(s.tenantId)).level, 'full');
    });
    await t('switch 4b off: old statuses drive behaviour; the new commands refuse', async function(){
      o2SetSwitch('4b', false); var s = sub('active'); ok(!o2SubSetStatus(s.id, 'paused', 'x').ok, 'refused while off'); ok(changeSubscriptionStatus(s.id, 'paused', 'old path').ok, 'old function works'); eq(o2SubStatus(s), 'paused'); ok(!BOS_APPROVAL_TYPES['manual-activation'], 'types removed'); o2SetSwitch('4b', true);
    });
    pub();
  }, 300); });
})();
