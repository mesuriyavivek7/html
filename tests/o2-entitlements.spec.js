// @o2-runner switches=1a,8a
/* O2 Step 8a: availability identical with 8a on and off for every seed (and for gated / disabled controls);
   an override with an expiry stops at its expiry; Product controls screen.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-entitlements.spec.js */
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
  function matrix(){ var out = []; PLATFORM_TENANTS.forEach(function(tn){ var s = subscriptionForTenant(tn.id), plan = (s && s.planId) || tn.planId; PLATFORM_FEATURE_CONTROLS.forEach(function(fc){ out.push(tn.id + ':' + fc.key + '=' + isFeaturePlatformAvailable(fc.key, plan)); }); PLATFORM_PLANS.forEach(function(p){ PLATFORM_FEATURE_CONTROLS.forEach(function(fc){ out.push(p.id + ':' + fc.key + '=' + isFeaturePlatformAvailable(fc.key, p.id)); }); }); }); return out.join('|'); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);

    await t('acceptance: availability identical with 8a on and off for all seeds', async function(){ var a = matrix(); o2SetSwitch('8a', false); var b = matrix(); o2SetSwitch('8a', true); eq(a, b); });
    await t('identical for plan-gated and temporarily disabled controls too', async function(){
      setFeatureControlStatus('advancedAnalytics', 'plan-gated', ['plan-enterprise', 'plan-network']); setFeatureControlStatus('ipWhitelisting', 'disabled-temporarily');
      var a = matrix(); o2SetSwitch('8a', false); var b = matrix(); o2SetSwitch('8a', true); eq(a, b);
      eq(o2OpsFlag('ipWhitelisting').on, false, 'disabled row → ops flag off'); eq(JSON.stringify(o2PlanEntitlements('advancedAnalytics')), '["plan-enterprise","plan-network"]', 'gated row → entitlement');
      setFeatureControlStatus('advancedAnalytics', 'available'); setFeatureControlStatus('ipWhitelisting', 'available');
    });
    await t('acceptance: an override with an expiry stops applying at its expiry', async function(){
      ok(o2FeatureAvailable('org-southline', 'advancedAnalytics'), 'available before');
      ok(!o2SetOverride('org-southline', 'advancedAnalytics', false, 'Abuse under review', null).ok, 'an end date is required');
      var r = o2SetOverride('org-southline', 'advancedAnalytics', false, 'Abuse under review this week', new Date(bosNow() + 2 * 864e5).toISOString()); ok(r.ok, r.reason);
      ok(!o2FeatureAvailable('org-southline', 'advancedAnalytics'), 'off while the override runs'); ok(o2FeatureAvailable('org-northstar', 'advancedAnalytics'), 'other workspaces untouched');
      r.override.expiresAt = new Date(bosNow() - 1000).toISOString(); ok(o2FeatureAvailable('org-southline', 'advancedAnalytics'), 'back after expiry');
    });
    await t('ops flag kill switch with a reason; the platform check follows', async function(){
      ok(!o2SetFlag('linkedinOutreach', false, 'x').ok, 'reason needed'); ok(o2SetFlag('linkedinOutreach', false, 'Provider outage, pausing sends').ok);
      eq(isFeaturePlatformAvailable('linkedinOutreach', 'plan-growth'), false); ok(!o2FeatureAvailable('org-northstar', 'linkedinOutreach'));
      ok(o2SetFlag('linkedinOutreach', true, 'Provider back, resuming').ok); eq(isFeaturePlatformAvailable('linkedinOutreach', 'plan-growth'), true);
    });
    await t('Product controls: Flags · Entitlements · Maintenance', async function(){
      showView('oontu-feature-controls'); await sleep(5); eq(state.activeNav, 'oontu-controls'); var m = document.getElementById('main-content');
      eq(Array.prototype.map.call(m.querySelectorAll('.o2-host-tab'), function(b){ return b.textContent; }).join('|'), 'Flags|Entitlements|Maintenance');
      o2CtrlTab('entitlements'); ok(/Workspace overrides/.test(m.textContent)); o2CtrlTab('maintenance'); ok(m.textContent.length > 80);
      if(o2On('3b')){ openOontuTenantDetail('org-southline'); o2WsTab('entitlements'); await sleep(5); ok(/Overrides/.test(document.getElementById('main-content').textContent), 'Workspace 360 shows overrides'); }
    });
    pub();
  }, 300); });
})();
