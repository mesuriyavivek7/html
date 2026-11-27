// @o2-runner switches=7a
/* O2 Step 7a: refused and failed commands and failed sign-ins are audited once, with the §7.3 fields; nothing else changes.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-audit.spec.js */
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
  function rowsSince(n){ return AUDIT_LOG.slice(0).filter(function(e){ return e.id > n; }); }
  function maxId(){ return Math.max.apply(null, AUDIT_LOG.map(function(e){ return e.id || 0; }).concat([0])); }
  function meta(e){ return e.meta || e; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);

    await t('a refused bosRun command writes exactly one audit row (outcome refused, reason)', async function(){
      as('PU-101'); var m0 = maxId(); var r = bosTaxExport('sales', bosFyOf(new Date().toISOString()), 'all'); ok(!r.ok, 'refused for Sales');
      var rows = rowsSince(m0).filter(function(e){ return meta(e).outcome === 'refused'; }); eq(rows.length, 1, 'one row'); ok(meta(rows[0]).command === 'tax.export' && meta(rows[0]).reason, JSON.stringify(meta(rows[0])).slice(0, 200)); eq(meta(rows[0]).actorId, 'PU-101'); as('PU-001');
    });
    await t('an older platform command refused outside bosRun writes one row', async function(){
      as('PU-101'); var m0 = maxId(); var r = changeTenantStatus('org-northstar', 'suspended', 'test'); ok(!r.ok); var rows = rowsSince(m0).filter(function(e){ return meta(e).outcome === 'refused'; }); eq(rows.length, 1); ok(/platform-tenant:suspend/.test(meta(rows[0]).command)); as('PU-001');
    });
    await t('a failed command writes one row with outcome failed', async function(){
      var m0 = maxId(); var r = bosRun('spec.fail', null, function(){ throw new Error('boom'); }); ok(!r.ok); var rows = rowsSince(m0).filter(function(e){ return meta(e).outcome === 'failed'; }); eq(rows.length, 1); eq(meta(rows[0]).command, 'spec.fail');
    });
    await t('nested refusals are logged once (the outer command)', async function(){
      as('PU-101'); var m0 = maxId(); var r = bosRun('spec.outer', null, function(){ return bosRun('spec.inner', null, function(){ return { ok:false, reason:'Inner refusal' }; }); }); ok(!r.ok); eq(rowsSince(m0).filter(function(e){ return meta(e).outcome === 'refused'; }).length, 1); as('PU-001');
    });
    await t('failed sign-ins are logged without passwords or codes', async function(){
      var m0 = maxId(); var r = await authApi.passwordSignIn({ email:'arjun@oontu.internal', password:'WrongPassword!9' }); ok(!r.ok);
      var rows = rowsSince(m0).filter(function(e){ return e.action === 'Sign-in failed'; }); eq(rows.length, 1); ok(!/WrongPassword/.test(JSON.stringify(rows[0])), 'no password'); ok(/arjun@oontu\.internal/.test(rows[0].detail) && /password/.test(rows[0].detail), rows[0].detail);
      if(typeof authApi.verifyCode === 'function'){ var m1 = maxId(); var v = await authApi.verifyCode({ email:'kavya@oontu.internal', code:'000000' }); if(v && v.ok === false){ var r2 = rowsSince(m1).filter(function(e){ return e.action === 'Sign-in failed'; }); eq(r2.length, 1); ok(!/000000/.test(JSON.stringify(r2[0])), 'no code'); } }
      var m2 = maxId(); await authApi.passwordSignIn({ email:'someone@customer.example', password:'x' }); eq(rowsSince(m2).filter(function(e){ return e.action === 'Sign-in failed'; }).length, 0, 'customers are not in the platform log');
    });
    await t('allowed rows carry the §7.3 fields', async function(){
      var m0 = maxId(); updatePlatformSetting('supportPhone', '+91 80 1111 2222'); var row = rowsSince(m0)[0]; ok(row, 'row'); var m = meta(row);
      ['actorType', 'actorId', 'onBehalfOf', 'command', 'resourceType', 'resourceId', 'workspaceId', 'outcome', 'reason', 'approvalId', 'mfaAt'].forEach(function(k){ ok(k in m, k); }); eq(m.outcome, 'allowed'); eq(m.actorId, 'PU-001');
    });
    await t('behaviour identical with 7a off: the same refusals and results', async function(){
      as('PU-101'); var on1 = JSON.stringify(bosTaxExport('sales', bosFyOf(new Date().toISOString()), 'all')); o2SetSwitch('7a', false); var m0 = maxId(); var off1 = JSON.stringify(bosTaxExport('sales', bosFyOf(new Date().toISOString()), 'all'));
      eq(on1, off1); eq(rowsSince(m0).filter(function(e){ return meta(e).outcome === 'refused'; }).length, 0, 'not logged while off'); o2SetSwitch('7a', true); as('PU-001');
    });
    pub();
  }, 300); });
})();
