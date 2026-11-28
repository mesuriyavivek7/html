// @o2-runner switches=1a
/* O2 Step 1a: §5 navigation, redirects from every old id, one access table, home per role.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-nav-redirect.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  /* Cowork v2 (CX_SWITCH) retires LinkedIn automation (rotation, checkpoints, GoLogin, proxies); tests of it run with CX off */
  function offCx(fn){ return async function(){ var was = typeof cxOn === 'function' && cxOn(); if(was) cxSetSwitch(false); try { return await fn.apply(this, arguments); } finally { if(was) cxSetSwitch(true); } }; }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function vis(){ var v = []; filterNavForPermissions(NAV.oontu).forEach(function(g){ (g.items || [g]).forEach(function(i){ v.push(i.id); }); }); return v; }
  function main(){ return document.getElementById('main-content').textContent; }
  async function login(email){
    var r = await authApi.passwordSignIn({ email:email, password:'demo1234' }); if(!r.ok) return r;
    var s = await authApi.selectWorkspace({ workspaceId:r.workspaces[0].id }); authEnter(s, 'signin'); if(typeof o2MfaPending === 'function' && o2MfaPending()) o2MfaSubmit(o2MfaCode()); await sleep(40); return s;
  }
  /* §5 lists per login, derived from the strict rules: each old screen becomes its new id (Sign-ups joins Pipeline,
     Tenants and Account help become Workspaces, Billing and payments becomes Approvals + Invoices & payments + Tax & reports,
     Tickets brings Incidents, Insights becomes Reports, Employees and access becomes People & access). */
  var WANT = {
    'arjun@oontu.internal':'oontu-mywork,oontu-accounts,oontu-revenue',
    'kavya@oontu.internal':'oontu-mywork,oontu-team,oontu-reports,oontu-accounts,oontu-revenue',
    'leela@oontu.internal':'oontu-mywork,oontu-approvals,oontu-reports,oontu-accounts,oontu-revenue,oontu-invoices,oontu-tax,oontu-integrity',
    'rohan@oontu.internal':'oontu-mywork,oontu-accounts,oontu-service,oontu-incidents',
    'nisha@oontu.internal':'oontu-mywork,oontu-team,oontu-reports,oontu-accounts,oontu-service,oontu-incidents,oontu-integrity',
    'aditi@oontu.internal':'oontu-mywork,oontu-accounts,oontu-workspaces,oontu-custops,oontu-service,oontu-incidents',
    'sana@oontu.internal':'oontu-mywork,oontu-team,oontu-reports,oontu-accounts,oontu-revenue,oontu-workspaces,oontu-custops,oontu-integrity',
    'vikram@oontu.internal':'oontu-mywork,oontu-approvals,oontu-team,oontu-reports,oontu-accounts,oontu-service,oontu-incidents,oontu-subscriptions,oontu-invoices,oontu-plans,oontu-tax,oontu-integrity',
    'dev@oontu.internal':'oontu-mywork,oontu-reports,oontu-people,oontu-audit,oontu-integrity'
  };
  var OLD_IDS = ['oontu-dashboard', 'oontu-signups', 'oontu-help', 'oontu-tenants', 'oontu-tenant-detail', 'oontu-insights', 'oontu-agents', 'oontu-feature-controls', 'oontu-notifications', 'oontu-platform-users', 'oontu-finance'];

  window.addEventListener('load', function(){ setTimeout(async function(){
    try { localStorage.removeItem('oontu.o2.switches.v1'); } catch(e){}

    await t('the Super Admin’s menu follows §5: Home · Work · Customers · Service · Billing · Admin (folding)', async function(){
      var s = await login('meera@oontu.internal'); ok(s.ok, s.reason);
      eq(state.activeNav, 'oontu-home', 'lands on Home');
      var groups = filterNavForPermissions(NAV.oontu).map(function(g){ return (g.group || '·') + ':' + g.items.map(function(i){ return i.id; }).join('|'); });
      eq(groups.join(' / '), '·:oontu-home / Work:oontu-mywork|oontu-approvals|oontu-team|oontu-reports / Customers:oontu-accounts|oontu-revenue|oontu-workspaces|oontu-custops / Service:oontu-service|oontu-incidents|oontu-announcements / Billing:oontu-subscriptions|oontu-invoices|oontu-plans|oontu-tax / Admin:oontu-people|oontu-audit|oontu-integrity|oontu-ai|oontu-controls|oontu-settings');
      ok(NAV.oontu.find(function(g){ return g.group === 'Admin'; }).collapsible, 'Admin folds');
      var labels = []; NAV.oontu.forEach(function(g){ g.items.forEach(function(i){ labels.push(i.label); }); });
      ok(['Home','My work','Approvals','Reports','Accounts','Pipeline','Workspaces','Onboarding & success','Tickets','Incidents','Announcements','Subscriptions','Invoices & payments','Plans & pricing','Tax & reports','People & access','Audit & security','Integrity','AI agents','Product controls','Platform settings'].every(function(l){ return labels.indexOf(l) > -1; }), labels.join(','));
      var icons = []; NAV.oontu.forEach(function(g){ g.items.forEach(function(i){ icons.push(i.icon); }); }); eq(icons.length, new Set(icons).size, 'no two items share an icon');
    });

    await t('every old id redirects to its new screen and renders (no blank or denied screen for the Super Admin)', async function(){
      var want = { 'oontu-dashboard':'oontu-home', 'oontu-signups':'oontu-revenue', 'oontu-help':'oontu-workspaces', 'oontu-tenants':'oontu-workspaces', 'oontu-tenant-detail':'oontu-workspace', 'oontu-insights':'oontu-reports', 'oontu-agents':'oontu-ai', 'oontu-feature-controls':'oontu-controls', 'oontu-notifications':'oontu-announcements', 'oontu-platform-users':'oontu-people' };
      oontuTenantDetailId = 'org-northstar';
      OLD_IDS.forEach(function(id){
        if(id === 'oontu-finance') return; showView(id); eq(state.activeNav, want[id], id);
        var txt = main(); ok(txt.trim().length > 40, id + ' renders something'); ok(!/Not available|Something went wrong/.test(txt), id + ' not denied: ' + txt.slice(0, 80));
      });
      showView('oontu-signups'); ok(document.querySelector('.o2-host-tab.is-on') && /Sign-ups/.test(document.querySelector('.o2-host-tab.is-on').textContent), 'Sign-ups tab selected');
      showView('oontu-help'); ok(/Requests/.test(document.querySelector('.o2-host-tab.is-on').textContent), 'Requests tab selected');
      showView('oontu-tenants'); ok(/All/.test(document.querySelector('.o2-host-tab.is-on').textContent), 'All tab selected');
    });
    await t('Billing and payments redirects by tab: approvals, invoices & payments, tax & reports', async function(){
      BOS_UI.tab['oontu-finance'] = 0; showView('oontu-finance'); eq(state.activeNav, 'oontu-approvals');
      BOS_UI.tab['oontu-finance'] = 3; showView('oontu-finance'); eq(state.activeNav, 'oontu-invoices'); eq(BOS_UI.tab['oontu-finance'], 3, 'Reconciliation stays selected');
      BOS_UI.tab['oontu-finance'] = 5; showView('oontu-finance'); eq(state.activeNav, 'oontu-tax');
      showView('oontu-invoices'); eq(BOS_UI.tab['oontu-finance'], 2, 'Invoices & payments opens on Invoices'); ok(/Invoices/.test(main()));
      showView('oontu-tax'); eq(BOS_UI.tab['oontu-finance'], 5); showView('oontu-approvals'); eq(BOS_UI.tab['oontu-finance'], 0);
      showView('oontu-incidents'); eq(BOS_UI.tab['oontu-service'], 2, 'Incidents opens the incidents tab'); ok(!/Not available/.test(main()));
    });
    await t('host tabs switch between the screens a new id holds', async function(){
      showView('oontu-workspaces'); o2NavTab('oontu-workspaces', 'requests'); await sleep(10); ok(/Requests/.test(document.querySelector('.o2-host-tab.is-on').textContent));
      o2NavTab('oontu-revenue', 'pipeline'); if(o2On('5')) o2PipeTab('deals'); await sleep(10); eq(state.activeNav, 'oontu-revenue'); ok((o2On('5') ? /Deals/ : /Pipeline/).test(document.querySelector('.o2-host-tab.is-on').textContent), 'pipeline tab');   /* step 5 names the tabs */
    });

    await t('acceptance 1: each seeded login sees exactly its §5 screens; home per role', async function(){
      var keys = Object.keys(WANT);
      for(var i = 0; i < keys.length; i++){
        var s = await login(keys[i]); ok(s.ok, keys[i]);
        var want = WANT[keys[i]].split(','); if(o2On('1b') && want.indexOf('oontu-approvals') < 0) want.push('oontu-approvals');   /* 1b opens Approvals to everyone */
        eq(vis().sort().join(), want.slice().sort().join(), keys[i]);
        eq(o2NavScreens().sort().join(), want.slice().sort().join(), keys[i] + ' (one access table)');
        eq(state.activeNav, canPlatform('platform-tenant', 'update') ? 'oontu-home' : 'oontu-mywork', keys[i] + ' home');
        ok(!/Not available/.test(main()), keys[i] + ' home is usable');
        var card = bosLoginDetails(platformUserById(ACTIVE_PLATFORM_USER_ID)); ok(card.sees.indexOf('Billing and payments') < 0 && card.sees.indexOf('Tenants') < 0, 'login card lists new names: ' + card.sees.join(', '));
      }
    });
    await t('acceptance 2: every old id opens its new screen for each permitted person (no blank or denied screen)', async function(){
      var keys = Object.keys(WANT);
      for(var i = 0; i < keys.length; i++){
        await login(keys[i]);
        for(var j = 0; j < OLD_IDS.length; j++){
          var tg = o2NavTarget(OLD_IDS[j]); if(!tg || !BOS_VIEW_ACCESS[tg.id] || !BOS_VIEW_ACCESS[tg.id]()) continue;
          showView(OLD_IDS[j]); ok(!/Not available|Something went wrong/.test(main()), keys[i] + ' ' + OLD_IDS[j] + ' → ' + state.activeNav);
        }
      }
    });
    await t('acceptance 3: a screen outside the role sends the person home, as today', async function(){
      await login('arjun@oontu.internal'); showView('oontu-people'); eq(state.activeNav, 'oontu-mywork'); showView('oontu-platform-users'); eq(state.activeNav, 'oontu-mywork', 'old id too');
      showView('oontu-invoices'); eq(state.activeNav, 'oontu-mywork'); showView('oontu-workspaces'); eq(state.activeNav, 'oontu-mywork');
      ok(/Not available/.test(RENDERERS['oontu-tax']()), 'the renderer refuses too');
    });
    await t('Settings › Platform keeps LinkedIn infrastructure and AI models only', offCx(async function(){
      await login('meera@oontu.internal');
      var plat = SETTINGS_SECTIONS.filter(function(s){ return s.group === 'platform' && (!s.can || s.can()); }).map(function(s){ return s.label; });
      ok(plat.indexOf('LinkedIn infrastructure') > -1 && plat.indexOf('AI models') > -1, plat.join(',')); ok(plat.every(function(l){ return l === 'LinkedIn infrastructure' || l === 'AI models'; }), 'no duplicate links: ' + plat.join(','));
    }));
    await t('switch 1a off: the old menu, ids and home come back; on again: the new ones', async function(){
      o2SetSwitch('1a', false); ok(vis().indexOf('oontu-dashboard') > -1 && vis().indexOf('oontu-home') < 0, 'old menu'); eq(bosHomeView(), 'oontu-dashboard');
      showView('oontu-tenants'); eq(state.activeNav, 'oontu-tenants', 'no redirect'); ok(SETTINGS_SECTIONS.some(function(s){ return s.group === 'platform' && s.go && (!s.can || s.can()); }), 'old Settings links back');
      o2SetSwitch('1a', true); ok(vis().indexOf('oontu-home') > -1, 'new menu'); eq(bosHomeView(), 'oontu-home');
    });
    pub();
  }, 300); });
})();
