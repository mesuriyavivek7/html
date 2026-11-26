/* Oontu platform sign-in (prototype, 2026-11-25): every active Oontu employee signs in on the normal sign-in screen with their
   work email and demo1234 (or the code), lands in the Oontu platform as themselves, and sees only what their roles allow.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\bos-login.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  /* with O2 step 1a on, each old screen id is shown under its new id (docs/O2-BUILD-BRIEF.md §5); same strictness */
  var NEW1A = { 'oontu-dashboard':['oontu-home'], 'oontu-signups':['oontu-revenue'], 'oontu-help':['oontu-workspaces'], 'oontu-tenants':['oontu-workspaces'], 'oontu-insights':['oontu-reports'], 'oontu-agents':['oontu-ai'], 'oontu-feature-controls':['oontu-controls'], 'oontu-notifications':['oontu-announcements'], 'oontu-platform-users':['oontu-people'], 'oontu-finance':['oontu-approvals','oontu-invoices','oontu-tax'], 'oontu-service':['oontu-service','oontu-incidents'] };
  function on1a(){ return typeof o2On === 'function' && o2On('1a'); }
  function ids(list){ if(!on1a()) return list; var out = []; list.forEach(function(id){ (NEW1A[id] || [id]).forEach(function(n){ if(out.indexOf(n) < 0) out.push(n); }); }); return out; }
  function vis(){ var v = []; filterNavForPermissions(NAV.oontu).forEach(function(g){ (g.items || [g]).forEach(function(i){ v.push(i.id); }); }); return v; }
  async function login(email, pw){
    var r = await authApi.passwordSignIn({ email:email, password:pw || 'demo1234' });
    if(!r.ok) return r;
    eq(r.workspaces.length, 1, 'one workspace'); eq(r.workspaces[0].role, 'oontu', 'platform membership');
    var s = await authApi.selectWorkspace({ workspaceId:r.workspaces[0].id }); ok(s.ok, 'select');
    authEnter(s, 'signin'); if(typeof o2MfaPending === 'function' && o2MfaPending()) o2MfaSubmit(o2MfaCode()); await sleep(40); return s;
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    try { localStorage.clear(); } catch(e){}
    var brand = ORG_STRUCTURE.profile.brandName;

    await t('“Prototype · simulated sign-in” opens a role dropdown with each login’s details', async function(){
      var cap = document.getElementById('au-proto-cap'); ok(cap && cap.querySelector('.au-proto-cap__chev'), 'the caption has an arrow');
      if(!authFlow.devOpen) authToggleDev(); await sleep(30);
      var pop = document.getElementById('au-dev-pop'); ok(pop, 'tools open'); var sel = pop.querySelector('#bos-dl-pick'); ok(sel, 'dropdown');
      eq(sel.querySelectorAll('option').length, bosLogins().length, 'one option per active employee'); ok(sel.querySelectorAll('optgroup').length >= 4, 'grouped by department');
      var card = pop.querySelector('#bos-dl-card'); ok(/meera@oontu\.internal/.test(card.textContent) && /demo1234/.test(card.textContent) && /Oontu Super Admin/.test(card.textContent) && /Opens on/.test(card.textContent), card.textContent.slice(0, 160));
      bosLoginShow('PU-106'); card = document.getElementById('bos-dl-card');
      ok(/vikram@oontu\.internal/.test(card.textContent) && /Finance Manager/.test(card.textContent) && /My work/.test(card.textContent) && /refund/.test(card.textContent), 'details follow the role: ' + card.textContent.slice(0, 200));
      bosLoginUse('PU-106'); await sleep(120);
      ok(!document.getElementById('au-dev-pop'), 'tools closed'); var pw = document.getElementById('si-pw'), em = document.getElementById('si-pw-email');
      ok(pw && pw.value === 'demo1234' && em && em.value === 'vikram@oontu.internal', 'the password step is filled in');
    });
    await t('the Super Admin signs in with email and password and lands on the platform overview', async function(){
      var s = await login('meera@oontu.internal'); ok(s.ok, s.reason);
      eq(state.role, 'oontu'); eq(ACTIVE_PLATFORM_USER_ID, 'PU-001'); eq(state.activeNav, ids(['oontu-dashboard'])[0]);
      eq(ORG_STRUCTURE.profile.brandName, brand, 'the tenant profile is untouched');
      ok(AUDIT_LOG.some(function(e){ return e.action === 'Employee signed in' && /Meera/.test(e.detail); }), 'audited');
    });
    await t('each role lands as themselves and sees only their workspaces', async function(){
      var cases = [['arjun@oontu.internal','PU-101','oontu-revenue','oontu-finance'], ['rohan@oontu.internal','PU-103','oontu-service','oontu-revenue'], ['vikram@oontu.internal','PU-106','oontu-finance','oontu-platform-users'], ['aditi@oontu.internal','PU-105','oontu-custops','oontu-finance'], ['dev@oontu.internal','PU-108','oontu-platform-users','oontu-revenue']];
      for(var i = 0; i < cases.length; i++){
        var c = cases[i]; var s = await login(c[0]); ok(s.ok, c[0] + ' ' + s.reason);
        eq(ACTIVE_PLATFORM_USER_ID, c[1], c[0]); eq(ROLE_META.oontu.name, platformUserById(c[1]).name);
        var v = vis(); ok(ids([c[2]]).every(function(x){ return v.indexOf(x) > -1; }), c[0] + ' sees ' + c[2] + ': ' + v.join()); ok(ids([c[3]]).every(function(x){ return v.indexOf(x) === -1; }), c[0] + ' does not see ' + c[3]);
        ok(!/Not available|Something went wrong/.test(document.getElementById('main-content').textContent), c[0] + ' home renders');
      }
    });
    await t('strict: each of the ten logins sees exactly the screens of its own work', async function(){
      var want = {
        'meera@oontu.internal':'*',
        'arjun@oontu.internal':'oontu-mywork,oontu-revenue,oontu-accounts,oontu-signups',
        'kavya@oontu.internal':'oontu-team,oontu-mywork,oontu-revenue,oontu-accounts,oontu-signups,oontu-insights',
        'leela@oontu.internal':'oontu-mywork,oontu-revenue,oontu-accounts,oontu-signups,oontu-finance,oontu-integrity,oontu-insights',
        'rohan@oontu.internal':'oontu-mywork,oontu-accounts,oontu-service',
        'nisha@oontu.internal':'oontu-team,oontu-mywork,oontu-accounts,oontu-service,oontu-integrity,oontu-insights',
        'aditi@oontu.internal':'oontu-mywork,oontu-accounts,oontu-service,oontu-custops,oontu-tenants',
        'sana@oontu.internal':'oontu-team,oontu-mywork,oontu-revenue,oontu-accounts,oontu-signups,oontu-custops,oontu-tenants,oontu-integrity,oontu-insights',
        'vikram@oontu.internal':'oontu-team,oontu-mywork,oontu-accounts,oontu-service,oontu-finance,oontu-subscriptions,oontu-plans,oontu-integrity,oontu-insights',
        'dev@oontu.internal':'oontu-mywork,oontu-platform-users,oontu-integrity,oontu-insights,oontu-audit'
      };
      var keys = Object.keys(want);
      for(var i = 0; i < keys.length; i++){
        var s = await login(keys[i]); ok(s.ok, keys[i]);
        var v = vis().sort().join(), w = want[keys[i]];
        if(w === '*') ok(v.split(',').length >= 18, 'super admin sees everything: ' + v);
        else eq(v, ids(w.split(',')).sort().join(), keys[i]);
        ok(!/Not available/.test(document.getElementById('main-content').textContent), keys[i] + ' home is usable');
        if(w !== '*'){ showView('oontu-platform-users'); await sleep(10); if(w.indexOf('oontu-platform-users') === -1) eq(state.activeNav, bosHomeView(), keys[i] + ': a screen outside the role sends you home'); }
      }
    });
    await t('a wrong password is refused with the usual message', async function(){
      var r = await authApi.passwordSignIn({ email:'arjun@oontu.internal', password:'nope' }); ok(!r.ok && r.error === 'invalid_credentials', JSON.stringify(r));
    });
    await t('a suspended or offboarded employee can’t sign in', async function(){
      ACTIVE_PLATFORM_USER_ID = 'PU-001'; var r = bosSuspendEmployee('PU-103', 'Security check'); ok(r.ok, r.reason);
      var x = await authApi.passwordSignIn({ email:'rohan@oontu.internal', password:'demo1234' }); ok(!x.ok, 'suspended refused');
      setPlatformUserStatus('PU-103', 'Active');
      var y = await authApi.passwordSignIn({ email:'rohan@oontu.internal', password:'demo1234' }); ok(y.ok, 'active again');
    });
    await t('a newly invited employee can sign in only after activation', async function(){
      ACTIVE_PLATFORM_USER_ID = 'PU-001'; var inv = bosInviteEmployee({ name:'Neha New', email:'neha@oontu.internal', roles:['tpl_trainer'] }); ok(inv.ok, inv.reason);
      var a = await authApi.passwordSignIn({ email:'neha@oontu.internal', password:'demo1234' }); ok(!a.ok, 'invited refused');
      ok(bosActivateEmployee(inv.user.id).ok, 'activated');
      var s = await login('neha@oontu.internal'); ok(s.ok, s.reason); eq(state.activeNav, 'oontu-mywork', 'no dashboard access → My work');
    });
    await t('the email code works for employees too', async function(){
      var c = await authApi.sendCode({ email:'kavya@oontu.internal', intent:'signin' }); ok(c.ok, JSON.stringify(c));
      var v = await authApi.verifyCode({ email:'kavya@oontu.internal', code:'123456', intent:'signin' }); ok(v.ok && v.workspaces[0].role === 'oontu', JSON.stringify(v).slice(0, 160));
    });
    pub();
  }, 300); });
})();
