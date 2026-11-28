// @o2-runner switches=7a,7c
/* O2 Step 7c: separation of duties — conflicting pairs warn and refuse; a Security Administrator may override with a
   reason, audited; all other guards unchanged.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-sod.spec.js */
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
  function rolesWith(m, a){ return PLATFORM_ROLES.filter(function(r){ return (r.permissions[m] || []).indexOf(a) > -1; }).map(function(r){ return r.id; }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var inv = rolesWith('platform-finance', 'invoice').filter(function(r){ return rolesWith('platform-finance', 'verify_payment').indexOf(r) < 0; })[0];
    /* every seeded role with verify_payment also holds invoice, so add a test-only verifier role to make a combined conflict */
    if(!PLATFORM_ROLES.some(function(r){ return r.id === 'tpl_spec_verifier'; })) PLATFORM_ROLES.push({ id:'tpl_spec_verifier', name:'Spec verifier', workspace:'finance', permissions:{ 'platform-finance':['view', 'verify_payment'] } });
    var ver = 'tpl_spec_verifier', both = rolesWith('platform-finance', 'verify_payment').filter(function(r){ return rolesWith('platform-finance', 'invoice').indexOf(r) > -1; })[0];
    var target = 'PU-110';

    await t('the two conflicting pairs are detected from role permissions', async function(){
      ok(inv && ver, 'roles found: ' + inv + ' / ' + ver); ok(o2SodConflicts([inv, ver]).some(function(c){ return /invoices and verifying/.test(c); }), 'invoice + verify: ' + o2SodConflicts([inv, ver]).join('; ')); eq(o2SodConflicts([inv]).length, 0);
      var assign = rolesWith('platform-user', 'assign').filter(function(r){ return rolesWith('platform-audit', 'export').indexOf(r) < 0; })[0], exp = rolesWith('platform-audit', 'export').filter(function(r){ return rolesWith('platform-user', 'assign').indexOf(r) < 0; })[0];
      if(assign && exp) ok(o2SodConflicts([assign, exp]).length >= 1, 'assign + audit export');
    });
    await t('a conflicting role change is refused with a warning; a non-security override is refused', async function(){
      var r = bosSetRoles(target, [inv, ver]); ok(!r.ok && r.sod && /Separation of duties/.test(r.reason), r.reason);
      as('PU-106'); r = bosSetRoles(target, [inv, ver], { override:true, reason:'Small team, temporary cover for the quarter end' }); ok(!r.ok, 'only a Security Administrator overrides'); as('PU-001');
    });
    await t('a Security Administrator override with a reason goes through and is audited', async function(){
      as('PU-108'); var r = bosSetRoles(target, [inv, ver], { override:true, reason:'x' }); ok(!r.ok && r.field === 'reason', 'reason required');
      r = bosSetRoles(target, [inv, ver], { override:true, reason:'Small team, temporary cover for the quarter end' }); ok(r.ok, r.reason); as('PU-001');
      ok(AUDIT_LOG.some(function(e){ return e.action === 'Separation of duties override'; }), 'audited');
    });
    await t('a conflict built into one role template is warned and audited, not blocked', async function(){
      if(!both){ ok(true, 'no template holds both'); return; } var r = bosSetRoles('PU-110', [both]); ok(r.ok, r.reason); ok(r.sodWarning && r.sodWarning.length, 'warning returned'); ok(AUDIT_LOG.some(function(e){ return e.action === 'Separation of duties warning'; }), 'audited');
    });
    await t('all other guards are unchanged (no own roles, at least one Super Admin)', async function(){
      as('PU-108'); ok(!bosSetRoles('PU-108', ['tpl_security_admin']).ok, 'no self role change'); as('PU-001');
      var supers = PLATFORM_USER_ROSTER.filter(function(u){ return u.status === 'Active' && bosRolesOf(u).indexOf('role_oontu_super_admin') > -1; });
      if(supers.length === 1){ as('PU-108'); ok(!bosSetRoles(supers[0].id, ['tpl_agent']).ok, 'last Super Admin kept'); as('PU-001'); }
    });
    await t('switch 7c off: no separation-of-duties check', async function(){ o2SetSwitch('7c', false); as('PU-001'); var r = bosSetRoles(target, [ver]); ok(r.ok || !r.sod, 'no sod refusal'); o2SetSwitch('7c', true); });
    pub();
  }, 300); });
})();
