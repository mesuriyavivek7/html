// @o2-runner switches=0b,4a,4b
/* O2 Step 4b: access level enforced where read-only is enforced today (support tier, workspace plan state):
   renewal → past_due → unpaid → read-only → paid → full; cancel at period end keeps full access.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-access-level.spec.js */
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
  var DAY = 864e5;

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var s = subscriptionForTenant(CURRENT_ORGANIZATION_ID), tn = tenantById(CURRENT_ORGANIZATION_ID);

    await t('§3.2 table: every seeded pair, and the constructed rows', async function(){
      PLATFORM_TENANTS.forEach(function(x){ var a = o2AccessLevel(x); eq(a.level, 'full', x.id); });
      var mk = function(st, extra){ return Object.assign({ status:st }, extra || {}); };
      eq(o2AccessLevel(tn, mk('past_due')).level + o2AccessLevel(tn, mk('past_due')).banner, 'fulltrue');
      eq(o2AccessLevel(tn, mk('past_due', { readOnly:true })).level, 'read-only'); eq(o2AccessLevel(tn, mk('paused')).level, 'read-only');
      eq(o2AccessLevel(tn, mk('active', { cancelAt:new Date(bosNow() + 9 * DAY).toISOString().slice(0, 10) })).level, 'full', 'cancel at period end');
    });
    await t('renewal fails → past_due (full + banner) → after 7 days unpaid (read-only, support limited)', async function(){
      s.renewalDate = new Date(bosNow() - DAY).toISOString().slice(0, 10); s.mandate = { status:'active', method:'card', fail:true };
      bosRenewalRun(); eq(o2SubStatus(s), 'past_due'); var a = o2AccessLevel(tn); eq(a.level + '/' + a.banner, 'full/true');
      eq(supportTierFor().readOnly, false, 'support not limited yet');
      s.dunning.since = new Date(bosNow() - 8 * DAY).toISOString().slice(0, 10); s.dunning.step = 3; bosRenewalRun();
      eq(s.readOnly, true, 'old flag'); eq(o2SubStatus(s), 'unpaid'); eq(o2AccessLevel(tn).level, 'read-only'); eq(supportTierFor().readOnly, true, 'support covers billing and account only'); eq(supportTierFor().accessLevel, 'read-only');
    });
    await t('paying the link clears read-only and restores full access', async function(){
      var l = BOS.payLinks.filter(function(x){ return x.invoiceId && invoiceById(x.invoiceId) && invoiceById(x.invoiceId).subscriptionId === s.id && x.status === 'open'; }).slice(-1)[0]; ok(l, 'reminder link');
      var r = BOS_PAY.simulate('payment.captured', { id:l.id, amount:l.amount, currency:l.currency, version:1 }); ok(r.applied, 'paid');
      eq(s.readOnly, false); eq(o2SubStatus(s), 'active'); eq(o2AccessLevel(tn).level, 'full'); eq(supportTierFor().readOnly, false);
    });
    await t('suspended workspace is blocked; support follows', async function(){
      tn.status = 'suspended'; eq(o2AccessLevel(tn).level, 'blocked'); eq(supportTierFor().readOnly, true); tn.status = 'active';
    });
    await t('switch 4b off: today’s read-only flag alone drives the support tier', async function(){
      o2SetSwitch('4b', false); tn.status = 'suspended'; eq(supportTierFor().readOnly, false, 'old rule ignores suspension'); tn.status = 'active'; o2SetSwitch('4b', true);
    });
    pub();
  }, 300); });
})();
