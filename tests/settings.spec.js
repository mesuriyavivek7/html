/* Settings: who sees what (by permission), the agent subscription model, the redirects and every section rendering.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\settings.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.message) || String(a); }).join(' ').slice(0, 160)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length>before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:e.message }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function ids(){ return sVisible().map(function(s){ return s.id; }); }
  function as(role, preview){ state.role = role; previewAsRoleId = preview || null; settingsSection = 'account'; settingsTabs = {}; renderSidebar(); }
  function has(list){ list.forEach(function(i){ ok(ids().indexOf(i)>-1, 'should see ' + i + ' but sees ' + ids().join(',')); }); }
  function hasNot(list){ list.forEach(function(i){ ok(ids().indexOf(i)===-1, 'should not see ' + i); }); }
  function tabIds(sec){ return sTabsFor(SETTINGS_SECTIONS.find(function(s){ return s.id===sec; })).map(function(x){ return x.id; }); }
  async function everySection(label){
    var vis = sVisible().filter(function(s){ return !s.go; }), n = 0;
    for(var i = 0; i < vis.length; i++){
      var tabs = sTabsFor(vis[i]); var list = tabs.length ? tabs.map(function(x){ return x.id; }) : [null];
      for(var j = 0; j < list.length; j++){
        settingsSection = vis[i].id; if(list[j]) settingsTabs[vis[i].id] = list[j]; showView('settings'); await sleep(25); n++;
        var c = q('#settings-content'); ok(c && c.innerHTML.length > 150, label + ': ' + vis[i].id + '/' + list[j] + ' is empty');
        ok(!/Something went wrong/.test(q('#main-content').textContent), label + ': ' + vis[i].id + '/' + list[j] + ' failed to render');
      }
    }
    return n;
  }
  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'recruiter'; enterApp(); await sleep(100);

    await t('recruiter: only "You", read-only hiring rules and templates; LinkedIn in My connections because the agent is on', async function(){
      as('recruiter'); has(['account','notifications','connections','approvals','templates']);
      hasNot(['workspace','people','integrations','cowork','security','billing','danger','p-tenants']);
      ok(tabIds('approvals').join()==='hiring', 'only hiring rules for a recruiter: ' + tabIds('approvals'));
      ok(!sCanEdit('hiring') && !sCanEdit('templates'), 'hiring rules and templates are read-only');
      settingsSection = 'connections'; showView('settings'); ok(/LinkedIn/.test(q('#settings-content').textContent), 'LinkedIn row for a recruiter');
      await everySection('recruiter');
    });
    await t('recruiter manager: my team in People, read-only roles, Cowork usage only, audit only, no billing', async function(){
      as('manager'); has(['workspace','people','approvals','cowork','security']); hasNot(['billing','integrations','danger']);
      ok(tabIds('cowork').join()==='usage', 'cowork tabs ' + tabIds('cowork')); ok(tabIds('security').join()==='audit', 'security tabs ' + tabIds('security'));
      ok(!sCanEdit('roles') && !sCanEdit('approvals') && !sCanEdit('cowork'), 'read-only');
      var me = currentActingUser(); var mine = sPeopleScope().map(function(u){ return u.id; });
      ok(mine.every(function(id){ return recruitersManagedBy(me.id).some(function(r){ return r.id===id; }); }), 'People shows only my team');
      await everySection('manager');
    });
    await t('admin: edits almost everything, sees plan and billing read-only, never the danger zone or the Owner role', async function(){
      as('admin', 'role_admin'); has(['workspace','people','approvals','templates','integrations','cowork','billing','security']);
      hasNot(['danger']); ok(!sCanEdit('billing'), 'billing is read-only for an admin'); ok(sCanEdit('people') && sCanEdit('roles'), 'people and roles are editable');
      ok(!sCan('kairo','Manage subscription'), 'an admin cannot subscribe agents');
      previewAsRoleId = null;
    });
    await t('owner: everything, including plan and billing and the danger zone; every section and tab renders', async function(){
      as('admin'); has(['workspace','people','billing','danger','cowork','security','integrations']); ok(sCanEdit('billing') && sCanEdit('danger'), 'owner edits billing');
      var n = await everySection('owner'); ok(n >= 20, 'owner sections and tabs ' + n);
    });
    await t('hiring manager: only "You", plus their own approval powers and delegation', async function(){
      as('hm'); has(['account','notifications','approvals']); hasNot(['workspace','people','templates','integrations','cowork','billing']);
      ok(tabIds('approvals').indexOf('approvals')>-1 && tabIds('approvals').indexOf('delegation')>-1, 'tabs ' + tabIds('approvals'));
      settingsSection = 'approvals'; settingsTabs.approvals = 'approvals'; showView('settings'); ok(/Your approval powers/.test(q('#settings-content').textContent), 'a hiring manager sees only their own approval powers');
      await everySection('hm');
    });
    await t('candidate: only their own privacy, consent and sign-in', async function(){
      as('candidate'); has(['cand-account']); hasNot(['people','billing','account','connections']);
      ok(tabIds('cand-account').join()==='contact,consent,signin', 'tabs ' + tabIds('cand-account'));
      ok(anyAgentOn()===false, 'no agents for a candidate'); await everySection('candidate');
    });
    await t('Oontu Super Admin: platform group with Cowork agents, LinkedIn infrastructure and AI models, never mixed with tenant settings', async function(){
      as('oontu'); has(['account','p-tenants','p-plans','p-agents','p-linkedin','p-ai','p-audit']); hasNot(['people','billing','workspace','cowork']); await everySection('oontu');
      settingsSection = 'p-linkedin'; showView('settings'); ok(/GoLogin/.test(q('#settings-content').textContent) && /••••/.test(q('#settings-content').textContent), 'GoLogin token shown masked');
      showView('oontu-agents'); await sleep(30); ok(/Talent Discovery/.test(q('#main-content').textContent) && /LinkedIn outreach/.test(q('#main-content').textContent), 'agents catalog page'); showView('oontu-settings'); ok(/AI models/.test(q('#main-content').textContent), 'AI models only in platform settings');
    });
    await t('owner starts a trial; surfaces appear, both audit logs record it; cancelling is recorded', async function(){
      as('admin'); TENANT_AGENT_SUBSCRIPTIONS[CURRENT_ORGANIZATION_ID].engagement = { state:'none', usedThisMonth:0 }; ok(!agentAccess('engagement').on, 'engagement is off');
      var auditBefore = AUDIT_LOG.length; ok(agentSubscribe('engagement','trial'), 'trial started');
      ok(agentSub('engagement').state==='trial' && /Trial · 14 days left/.test(agentStateLabel('engagement')[1]), 'label ' + agentStateLabel('engagement')[1]);
      ok(agentAccess('engagement').on, 'engagement is on'); ok(AUDIT_LOG.slice(0, AUDIT_LOG.length-auditBefore+2).some(function(a){ return a.module==='Billing'; }), 'tenant audit'); ok(AUDIT_LOG.some(function(a){ return a.module==='Platform' && /Tenant agent trial/.test(a.action); }), 'platform audit');
      ok(PLATFORM_ADDON_LEDGER.some(function(l){ return l.agentId==='engagement' && l.mode==='trial'; }), 'ledger');
      ok(aiDestAgentOn('engagement'), 'Cowork shows the Engagement tab');
      agentSubscribe('engagement','subscribe');
      agentSubscribe('engagement','cancel'); ok(agentSub('engagement').state==='cancelling', 'cancel at period end'); agentSubscribe('engagement','resume');
      as('recruiter'); ok(!agentSubscribe('talent-discovery','cancel'), 'a recruiter cannot cancel an agent');
    });
    await t('an agent step switched off in the workspace cannot be raised by a person; "always a person" is never loosened', async function(){
      as('admin'); TENANT_AGENT_CONFIG['engagement'].steps['followup'] = 'off';
      var uid = currentUserId(); USER_AGENT_PREFS[uid] = { engagement:{ enabled:true, steps:{ followup:'auto', ack:'auto' } } };
      ok(agentStepLevel('engagement','followup', uid)==='off', 'workspace off wins'); ok(agentStepLevel('engagement','ack', uid)==='auto', 'allowed level kept');
      TENANT_AGENT_CONFIG['talent-discovery'].steps['reject'] = 'auto'; ok(agentStepLevel('talent-discovery','reject', uid)==='person', 'reject stays always a person');
      TENANT_AGENT_CONFIG['talent-discovery'].steps['reject'] = 'person'; TENANT_AGENT_CONFIG['engagement'].steps['followup'] = 'auto'; USER_AGENT_PREFS[uid] = {};
    });
    await t('a global kill switch removes an agent from every workspace and shows "Paused by Oontu" to the owner', async function(){
      as('oontu'); ok(platformAgentSet('talent-discovery', { status:'disabled' }, 'Incident 42'), 'switch set');
      as('admin'); ok(!agentAccess('talent-discovery').on && agentAccess('talent-discovery').why==='disabled-by-oontu', 'off for the tenant'); ok(agentStateLabel('talent-discovery')[1]==='Paused by Oontu', 'owner sees Paused by Oontu');
      as('oontu'); ok(!platformAgentSet('talent-discovery', { status:'available' }, ''), 'a reason is required'); ok(platformAgentSet('talent-discovery', { status:'available' }, 'Incident over'), 'restored');
      ok(platformTenantAgent(CURRENT_ORGANIZATION_ID, 'interviews', 'pause', 'Billing check'), 'tenant pause'); ok(agentSub('interviews').state==='paused', 'paused'); platformTenantAgent(CURRENT_ORGANIZATION_ID, 'interviews', 'resume', 'Resolved');
    });
    await t('corporate workspace: role rules, vendors, requisition approvals and the matrix; no Clients', async function(){
      var prev = ORG_STRUCTURE.profile.orgType; ORG_STRUCTURE.profile.orgType = 'Corporate';
      as('admin'); renderSidebar(); await sleep(20);
      settingsSection = 'people'; settingsTabs.people = 'rules'; showView('settings'); ok(/Role rules/.test(q('#settings-content').textContent), 'role rules');
      settingsSection = 'approvals'; settingsTabs.approvals = 'approvals'; showView('settings'); ok(/Requisition/.test(q('#settings-content').textContent) && /Approval matrix/.test(q('#settings-content').textContent) && !/>Client</.test(q('#settings-content').innerHTML), 'requisition approvals and matrix, no client row');
      settingsSection = 'integrations'; settingsTabs.integrations = 'careers'; showView('settings'); ok(/Use vendors/.test(q('#settings-content').textContent), 'vendors');
      ok(!q('.nav-item[data-nav=client-management]'), 'no Clients in the sidebar');
      await everySection('corporate'); ORG_STRUCTURE.profile.orgType = prev; renderSidebar();
    });
    await t('old routes open the right Settings section, and the sidebar keeps one Settings item', async function(){
      as('admin');
      [['roles-permissions','people','roles'],['integrations','integrations',null],['feature-flags','billing',null],['security-settings','security',null],['audit-center','security','audit'],['setup-hub','workspace','profile'],['org-structure','workspace','profile'],['user-management','people',null],['scheduled-jobs','cowork','agents'],['master-data','templates',null]].forEach(function(p){
        showView(p[0]); sCurrent(); ok(state.activeNav==='settings' && settingsSection===p[1], p[0] + ' -> ' + settingsSection); if(p[2]) ok(settingsTabs[p[1]]===p[2], p[0] + ' tab ' + settingsTabs[p[1]]);
      });
      var items = Array.prototype.map.call(document.querySelectorAll('#sidebar-nav .nav-item'), function(b){ return b.getAttribute('data-nav'); });
      ok(items.indexOf('settings')>-1 && items.indexOf('setup-hub')===-1 && items.indexOf('roles-permissions')===-1 && items.indexOf('audit-center')===-1 && items.indexOf('feature-flags')===-1, 'sidebar: ' + items.join(','));
      ['manager','recruiter','hm','candidate'].forEach(function(r){ state.role = r; renderSidebar(); ok(!!q('.nav-item[data-nav=settings]'), r + ' has Settings'); });
      ['agents','workflow-studio','workflow-wizard'].forEach(function(r){ state.role = 'admin'; showView(r); ok(!!q('#cwb-root') || !!q('#cw-agent'), r + ' renders something'); });
    });
    await t('the section list uses the lean pill, tabs use the under pill, keyed per section', async function(){
      as('admin'); settingsSection = 'people'; showView('settings'); await sleep(60);
      ok(q('#settings-nav > .o-pill.o-pill--lean'), 'section list pill'); ok(q('#settings-tabs > .o-pill.o-pill--under'), 'section tabs pill');
      ok(Array.prototype.every.call(document.querySelectorAll('#settings-nav .o-nav-item'), function(b){ return b.getAttribute('aria-current')==='page' || b.getAttribute('aria-current')==='false'; }), 'aria-current page|false');
      var before = q('#settings-nav > .o-pill').style.transform; sGo('templates'); await sleep(40); ok(q('#settings-nav > .o-pill').style.transform !== before, 'pill moved to the new item');
      ok(q('#settings-nav') === document.getElementById('settings-nav'), 'nav kept');
      settingsSection = 'people'; showView('settings'); await sleep(40); sTab('roles'); await sleep(40); ok(q('#settings-tabs [aria-selected=true]').textContent==='Roles', 'tab changed'); ok(!!(window.__oPillLast || __oPillLast)['settings-tabs:people'], 'tab pill remembered per section');
    });
    await t('changes are saved with Undo and audited; read-only rows are locked', async function(){
      as('admin'); var before = AUDIT_LOG.length; sTog('hiring.sameJobBlock'); ok(AUDIT_LOG.length>before, 'audited'); sTog('hiring.sameJobBlock');
      as('recruiter'); settingsSection = 'approvals'; showView('settings'); ok(/Rules that affect your work/.test(q('#settings-content').textContent), 'read-only summary for a recruiter');
    });
    await t('integrations list only what a person can use', async function(){
      as('admin'); settingsSection = 'integrations'; settingsTabs.integrations = 'connections'; showView('settings'); var txt = q('#settings-content').textContent;
      ['Google Workspace','Microsoft 365','WhatsApp Business','Naukri','Indeed'].forEach(function(n){ ok(txt.indexOf(n)>-1, 'has ' + n); });
      ['Slack','Telegram','RCS','Greenhouse','Workday','Cloud storage','Bring your own model key','Coming later','Social share'].forEach(function(n){ ok(txt.indexOf(n)===-1, 'should not show ' + n); });
      ok(/Email domain health/.test(txt) && /WhatsApp Business number/.test(txt), 'domain health and WhatsApp number cards');
    });
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();
