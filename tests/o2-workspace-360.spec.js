// @o2-runner switches=0b,1a,3a,3b
/* O2 Step 3b: Workspaces list and Workspace 360; every Account help and tenant page action from the new screens.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-workspace-360.spec.js */
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
  function main(){ return document.getElementById('main-content'); }
  function evCount(name){ return BOS.events.filter(function(e){ return e.name === name; }).length; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var sus = { id:'org-o2sus', name:'Suspended Example', status:'suspended', createdAt:new Date().toISOString(), internal:false }; PLATFORM_TENANTS.push(sus);

    await t('Workspaces: four number cards, three tabs, ten columns; filters and search', async function(){
      showView('oontu-workspaces'); await sleep(10); var m = main();
      eq(m.querySelectorAll('.o-numbers .o-num').length, 4, 'cards'); ok(/Active/.test(m.textContent) && /Trials ending in 7 days/.test(m.textContent) && /Read-only \(unpaid\)/.test(m.textContent) && /Suspended/.test(m.textContent));
      eq(Array.prototype.map.call(m.querySelectorAll('.o2-host-tab'), function(b){ return b.textContent.replace(/\d+/g, '').trim(); }).join('|'), 'All|Needs attention|Requests');
      var heads = Array.prototype.map.call(m.querySelectorAll('section[aria-labelledby="o2-ws-h"] th'), function(th){ return th.textContent; });
      eq(heads.join('|'), 'Workspace|Account|Owner|Plan|Lifecycle|Access level|Onboarding|Health|Last active|Created');
      eq(m.querySelectorAll('tr[data-ws]').length, PLATFORM_TENANTS.length, 'every workspace');
      o2WsSet('life', 'suspended'); await sleep(5); eq(main().querySelectorAll('tr[data-ws]').length, 1, 'lifecycle filter'); o2WsSet('life', '');
      o2WsSet('q', 'org-southline'); await sleep(5); eq(main().querySelectorAll('tr[data-ws]').length, 1, 'search by id'); o2WsSet('q', 'northstar'); await sleep(5); ok(main().querySelectorAll('tr[data-ws]').length >= 1, 'search by name'); o2WsSet('q', '');
      o2WsCard('suspended'); await sleep(5); eq(main().querySelectorAll('tr[data-ws]').length, 1, 'the Suspended card filters'); o2WsCard('');
      o2WsSet('tab', 'attention'); await sleep(5); ok(main().querySelector('tr[data-ws="org-o2sus"]'), 'suspended needs attention'); o2WsSet('tab', 'all');
      ok(main().querySelector('[data-o2-access="blocked"]'), 'access level shown');
    });
    await t('access-level badges match §3.2 on the list and on Workspace 360', async function(){
      showView('oontu-workspaces'); await sleep(5);
      PLATFORM_TENANTS.forEach(function(tn){ var cell = main().querySelector('tr[data-ws="' + tn.id + '"] [data-o2-access]'); ok(cell, tn.id); eq(cell.getAttribute('data-o2-access'), o2AccessLevel(tn).level, tn.id); });
      openOontuTenantDetail('org-o2sus'); await sleep(5); eq(state.activeNav, 'oontu-workspace'); eq(main().querySelector('.o2-ws-head [data-o2-access]').getAttribute('data-o2-access'), 'blocked');
    });
    await t('Workspace 360: head, Next step, eight tabs render with honest gaps', async function(){
      openOontuTenantDetail('org-northstar'); await sleep(5); var m = main();
      ok(/Northstar Talent Partners/.test(m.querySelector('h1').textContent), 'name'); ok(m.querySelector('.o2-ws-head [data-o2-life]'), 'lifecycle badge'); ok(/Account/.test(m.querySelector('.o2-ws-head').textContent), 'account link');
      ok(m.querySelector('.o-page-head .o-btn--primary, .o-page-head button'), 'Next step button');
      ['overview', 'users', 'billing', 'entitlements', 'usage', 'support', 'activity', 'configuration'].forEach(function(k){ o2WsTab(k); var txt = main().textContent; ok(txt.length > 80 && !/Something went wrong/.test(txt), k); });
      o2WsTab('usage'); ok(/Not held in this prototype/.test(main().textContent), 'AI runs not held'); o2WsTab('configuration'); ok(/Not held in this prototype/.test(main().textContent), 'SSO not held');
      o2WsTab('billing'); ok(/Subscription/.test(main().textContent) && /Billing customer/.test(main().textContent)); o2WsTab('overview');
      openOontuTenantDetail('org-o2sus'); await sleep(5); ok(/Restore/.test(main().querySelector('.o-page-head').textContent), 'next step for a suspended workspace');
    });
    await t('danger zone: typed-name confirm and a reason; uses the 3a commands', async function(){
      openOontuTenantDetail('org-southline'); o2WsTab('overview'); await sleep(5);
      document.getElementById('o2-dz-name').value = 'southline'; document.getElementById('o2-dz-why').value = 'Customer asked to pause in writing.'; o2WsDanger('org-southline', 'suspended');
      ok(/exactly/.test(document.getElementById('o2-dz-err').textContent), 'wrong name refused'); eq(o2Lifecycle(tenantById('org-southline')), 'active');
      document.getElementById('o2-dz-name').value = 'Southline Talent Group'; o2WsDanger('org-southline', 'suspended'); await sleep(5);
      ok(BOS.approvals.some(function(a){ return a.type === 'workspace-suspend' && a.payload.tenantId === 'org-southline' && a.status === 'pending'; }), 'second person asked');
    });
    await t('every tenant page action stays reachable inside Overview', async function(){
      openOontuTenantDetail('org-northstar'); o2WsTab('overview'); await sleep(5);
      var legacy = main().querySelector('.o2-ws-legacy'); ok(legacy, 'earlier tenant page kept'); ok(legacy.querySelectorAll('button').length >= 2, 'its actions are there: ' + legacy.querySelectorAll('button').length);
    });
    await t('Requests: every Account help action works from the new screen and runs as a command', async function(){
      showView('oontu-help'); eq(state.activeNav, 'oontu-workspaces'); ok(/Requests/.test(main().querySelector('.o2-host-tab.is-on').textContent));
      authApi._setWorkspace('infosys.com', { ownerName:'Anita Rao', ownerEmail:'anita.rao@infosys.com' });
      var mk = function(email, name){ return joinEscalate({ name:name || 'Ravi Kumar', email:email, reason:'The owner has left the company', domain:email.split('@')[1] }).escalation; };
      var e = mk('ravi@infosys.com'), before = BOS.events.length;
      ok(jnContactOwner(e.id, 'Asked Anita to approve or hand over').ok, 'contact owner'); ok(jnAssign(e.id, 'Farhan Ali') === true, 'assign keeps its return value');
      var ap = jnApproveJoin(e.id, 'Called him back on his work number', true); ok(ap.ok && e.status === 'resolved', 'approve join');
      e = mk('lia@infosys.com', 'Lia'); ok(jnTransferOwner(e.id, { name:'Lia Fernandes', email:'lia@infosys.com', note:'Owner left, HR confirmed by letter', verified:true }).ok, 'transfer owner');
      authApi._setWorkspace('infosys.com', { ownerName:'Anita Rao', ownerEmail:'anita.rao@infosys.com' });
      e = mk('no@infosys.com', 'No'); ok(jnDeclineJoin(e.id, 'Not an Infosys employee per HR').ok, 'decline');
      e = mk('sep@infosys.com', 'Sep'); ok(jnAllowSeparate(e.id, { note:'Separate legal entity with a shared domain', verified:true }).ok, 'allow separate');
      e = mk('fyi@infosys.com', 'Fyi'); ok(jnResolve(e.id, 'Answered the question by phone').ok, 'resolve');
      e = mk('free@legacyfree.example', 'Free'); authApi._setWorkspace('legacyfree.example', { status:'active', ownerName:'Old', ownerEmail:'old@legacyfree.example' }); var fr = jnFreeDomain(e.id, { note:'Workspace abandoned for two years, confirmed', verified:true }); ok(fr.ok || /domain|workspace/i.test(fr.reason || ''), 'free domain answered: ' + (fr.reason || 'ok'));
      var lead = SIGNUP_LEADS.find(function(l){ return l.email; }); var ask = jnAssistAsk({ leadId:lead.id }); ok(ask.ok, 'assist ask: ' + ask.reason); jnAssistAnswer(ask.perm.token, true);
      ok(jnAssistDo(ask.perm.id, 'companyName', 'Assist Talent').ok, 'assist do'); var fin = jnAssistFinish(ask.perm.id); ok(fin === undefined || fin === true || fin.ok !== false, 'assist finish');
      ok(BOS.events.length > before, 'events written'); ['contact-owner', 'assign', 'approve-join', 'transfer-owner', 'decline-join', 'allow-separate', 'resolve', 'assist-ask', 'assist-do'].forEach(function(k){ ok(evCount('workspace-request.' + k) >= 1, k + ' ran as a command'); });
      ok(AUDIT_LOG.some(function(x){ return /Account help · approve join/.test(x.action); }), 'audited');
      state.role = 'recruiter'; ok(!jnApproveJoin(mk('x@infosys.com').id, 'Called him back on his work number', true).ok, 'still the platform team only'); state.role = 'oontu';
    });
    await t('switch 3b off: the old Tenants and Account help screens', async function(){
      o2SetSwitch('3b', false); showView('oontu-workspaces'); await sleep(5); ok(!main().querySelector('tr[data-ws]'), 'old list'); openOontuTenantDetail('org-northstar'); await sleep(5); ok(!main().querySelector('.o2-ws-head'), 'old tenant page');
      var before = BOS.events.length; jnAssign(JN.escalations[0].id, 'Someone'); eq(BOS.events.length, before, 'no command while off'); o2SetSwitch('3b', true);
    });
    pub();
  }, 300); });
})();
