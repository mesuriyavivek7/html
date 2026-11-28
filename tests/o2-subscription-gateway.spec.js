// @o2-runner switches=0b,0c,4a
/* O2 Step 4a: subscriptions on the gateway — every change is a command (audit row + domain event), items[] and
   history[], no subscription field written outside a command, MRR unchanged.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-subscription-gateway.spec.js */
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
  /* watch: every subscription becomes a Proxy that records writes made while no command is running */
  var depth = 0, violations = [];
  function watch(){
    var baseRun = window.bosRun; window.bosRun = function(){ depth++; try { return baseRun.apply(this, arguments); } finally { depth--; } };
    Object.keys(baseRun).forEach(function(k){ window.bosRun[k] = baseRun[k]; });
    for(var i = 0; i < PLATFORM_SUBSCRIPTIONS.length; i++) PLATFORM_SUBSCRIPTIONS[i] = guard(PLATFORM_SUBSCRIPTIONS[i]);
    var push = PLATFORM_SUBSCRIPTIONS.push; PLATFORM_SUBSCRIPTIONS.push = function(){ if(depth === 0) violations.push('push outside a command'); var args = Array.prototype.map.call(arguments, guard); return push.apply(this, args); };
  }
  function guard(s){ if(s.__watched) return s; return new Proxy(s, { get:function(o, k){ return k === '__watched' ? true : o[k]; }, set:function(o, k, v){ if(depth === 0 && ['items', 'history'].indexOf(k) < 0) violations.push(o.id + '.' + String(k)); o[k] = v; return true; } }); }
  function evs(name){ return BOS.events.filter(function(e){ return e.name === name; }).length; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);

    await t('items[] reproduce today’s prices; MRR unchanged for every seed', async function(){
      PLATFORM_SUBSCRIPTIONS.forEach(function(s){ ok(Array.isArray(s.items) && s.items.length, s.id + ' items'); ok(Array.isArray(s.history), s.id + ' history'); });
      var withItems = JSON.stringify(o2MrrTotals().byCurrency);
      var saved = PLATFORM_SUBSCRIPTIONS.map(function(s){ var it = s.items; delete s.items; return it; }); var without = JSON.stringify(o2MrrTotals().byCurrency);
      PLATFORM_SUBSCRIPTIONS.forEach(function(s, i){ s.items = saved[i]; }); eq(withItems, without, 'same MRR');
      var n = subscriptionForTenant('org-northstar'); eq(n.items[0].quantity, 1); eq(n.items[0].unitPrice, 499); eq(n.items[0].interval, 'annual');
    });
    watch();
    await t('acceptance: every subscription change is a command with an audit row and a domain event; no direct writes', async function(){
      var a0 = AUDIT_LOG.length, n = subscriptionForTenant('org-northstar'), s = subscriptionForTenant('org-southline');
      ok(setSubscriptionRenewalDate(n.id, '2027-04-01').ok); eq(evs('subscription.set-renewal-date'), 1);
      ok(changeSubscriptionPlan(s.id, 'plan-floor').ok); eq(evs('subscription.change-plan'), 1); eq(s.items[0].priceRef.indexOf('plan-floor'), 0, 'items follow the plan');
      ok(changeSubscriptionStatus(s.id, 'paused', 'Customer asked for a pause').ok); eq(evs('subscription.change-status'), 1); ok(changeSubscriptionStatus(s.id, 'active').ok);
      var g = generateInvoiceForSubscription(n.id); ok(g.ok && g.taxInvoice, 'invoice keeps its shape'); eq(evs('subscription.invoice'), 1);
      var tn = { id:'org-gw', name:'Gateway Co', status:'active', createdAt:new Date().toISOString(), planId:null, internal:false }; PLATFORM_TENANTS.push(tn);
      var c = createSubscriptionRecord(tn.id, 'plan-desk', { status:'trial' }); ok(c.ok, c.reason); eq(evs('subscription.create'), 1); ok(Array.isArray(c.subscription.items), 'new subscription has items');
      ok(extendSubscriptionTrial(c.subscription.id, 7).ok); eq(evs('subscription.extend-trial'), 1);
      var ck = bosCheckoutStart({ tenantId:'org-southline', planId:'plan-scale', seats:4, interval:'annual', currency:'INR' }); ok(ck.ok, ck.reason); var p = bosCheckoutPay(ck.link.id); ok(p && p.ok, p && p.reason); eq(evs('subscription.checkout'), 1, 'checkout completion is a command');
      var hs = subscriptionForTenant('org-southline').history.map(function(h){ return h.command; }); ok(hs.indexOf('subscription.change-plan') > -1 && hs.indexOf('subscription.checkout') > -1, 'history: ' + hs.join(','));
      ok(AUDIT_LOG.length - a0 >= 8, 'audit rows: ' + (AUDIT_LOG.length - a0));
      eq(violations.length, 0, 'writes outside a command: ' + violations.slice(0, 5).join(', '));
    });
    await t('refusals stay refusals and change nothing', async function(){
      var n = subscriptionForTenant('org-northstar'), before = JSON.stringify(n.history);
      ok(!changeSubscriptionStatus(n.id, 'trial').ok, 'not an allowed transition'); ok(!extendSubscriptionTrial(n.id, 5).ok, 'not a trial'); eq(JSON.stringify(n.history), before);
      as('PU-101'); ok(!changeSubscriptionPlan(n.id, 'plan-floor').ok, 'Sales can’t'); as('PU-001'); eq(violations.length, 0);
    });
    await t('self-service (no Oontu employee signed in) still creates its subscription, as the system', async function(){
      var prev = ACTIVE_PLATFORM_USER_ID; ACTIVE_PLATFORM_USER_ID = null; var tn = { id:'org-gw2', name:'Self Serve Co', status:'active', createdAt:new Date().toISOString(), internal:false }; PLATFORM_TENANTS.push(tn);
      var r = createSubscriptionRecord(tn.id, 'plan-desk', { status:'trial' }, PROVISION_CTX); ACTIVE_PLATFORM_USER_ID = prev;
      ok(r.ok, r.reason); var ev = BOS.events.filter(function(e){ return e.name === 'subscription.create'; }).slice(-1)[0]; ok(ev && ev.actor === 'o2-gateway', 'run by the system: ' + (ev && ev.actor));
    });
    await t('switch 4a off: the old functions run directly (no command events)', async function(){
      o2SetSwitch('4a', false); var n = subscriptionForTenant('org-northstar'), e0 = BOS.events.length; ok(setSubscriptionRenewalDate(n.id, '2027-05-01').ok); eq(BOS.events.length, e0, 'no event while off'); o2SetSwitch('4a', true);
    });
    pub();
  }, 300); });
})();
