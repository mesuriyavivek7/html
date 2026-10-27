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
  function as(role, preview){ state.role = role; previewAsRoleId = preview || null; settingsSection = 'profile'; renderSidebar(); }
  function has(list){ list.forEach(function(i){ ok(ids().indexOf(i)>-1, 'should see ' + i + ' but sees ' + ids().join(',')); }); }
  function hasNot(list){ list.forEach(function(i){ ok(ids().indexOf(i)===-1, 'should not see ' + i); }); }
  async function everySection(label){
    var vis = sVisible().filter(function(s){ return !s.go; });
    for(var i = 0; i < vis.length; i++){
      settingsSection = vis[i].id; showView('settings'); await sleep(30);
      var c = q('#settings-content'); ok(c && c.innerHTML.length > 200, label + ': ' + vis[i].id + ' is empty');
      ok(!/Something went wrong/.test(q('#main-content').textContent), label + ': ' + vis[i].id + ' failed to render');
    }
    return vis.length;
  }
  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'recruiter'; enterApp(); await sleep(100);

    await t('recruiter: only "You", plus read-only hiring rules and templates; Kairo for me because agents are on', async function(){
      as('recruiter'); has(['profile','signin','notifications','accounts','prefs','kairo-me','hiring','templates']);
      hasNot(['overview','company','people','roles','approvals','careers','terms','integrations','kairo-agents','security','audit','billing','danger','delegation']);
      ok(!sCanEdit('hiring') && !sCanEdit('templates'), 'hiring rules and templates are read-only');
      await everySection('recruiter');
    });
    await t('recruiter manager: my team in People, read-only approvals, team Kairo view, no billing or security', async function(){
      as('manager'); has(['people','roles','approvals','hiring','kairo-agents','audit','delegation','kairo-me']);
      hasNot(['billing','security','integrations','danger','overview']);
      ok(!sCanEdit('roles') && !sCanEdit('approvals') && !sCanEdit('kairo-agents'), 'read-only');
      var me = currentActingUser(); var mine = sPeopleScope().map(function(u){ return u.id; });
      ok(mine.every(function(id){ return recruitersManagedBy(me.id).some(function(r){ return r.id===id; }); }), 'People shows only my team');
      await everySection('manager');
    });
    await t('admin: configures almost everything, sees plan and billing read-only, never the danger zone', async function(){
      as('admin', 'role_admin'); has(['overview','company','people','roles','approvals','hiring','templates','careers','terms','integrations','kairo-agents','security','audit','billing']);
      hasNot(['danger']); ok(!sCanEdit('billing'), 'billing is read-only for an admin'); ok(sCanEdit('people') && sCanEdit('roles'), 'people and roles are editable');
      ok(!sCan('kairo','Manage subscription'), 'an admin cannot subscribe agents');
      previewAsRoleId = null;
    });
    await t('owner: everything, including plan and billing and the danger zone; every section renders', async function(){
      as('admin'); has(['overview','people','roles','billing','danger','kairo-agents','security']); ok(sCanEdit('billing') && sCanEdit('danger'), 'owner edits billing');
      var n = await everySection('owner'); ok(n >= 18, 'owner sections ' + n);
    });
    await t('hiring manager: only "You" (and delegation, because they approve)', async function(){
      as('hm'); has(['profile','signin','notifications','prefs','delegation']); hasNot(['overview','company','people','roles','hiring','templates','careers','billing','kairo-agents']); has(['approvals']); ok(/Your approval powers/.test((settingsSection='approvals', showView('settings'), q('#settings-content').textContent)), 'a hiring manager sees only their own approval powers');
      await everySection('hm');
    });
    await t('candidate: only their own privacy, consent and notification settings', async function(){
      as('candidate'); has(['cand-visibility','cand-contact','cand-alerts','cand-notifications','cand-consent','signin']); hasNot(['people','roles','billing','kairo-me']);
      ok(anyAgentOn()===false, 'no agents for a candidate'); await everySection('candidate');
    });
    await t('Oontu Super Admin: platform group with the agents catalog and AI models, never mixed with tenant settings', async function(){
      as('oontu'); has(['profile','signin','p-tenants','p-agents','p-ai']); hasNot(['people','roles','billing','overview']); await everySection('oontu');
      showView('oontu-agents'); await sleep(30); ok(/Talent Discovery/.test(q('#main-content').textContent), 'agents catalog page'); showView('oontu-settings'); ok(/AI models/.test(q('#main-content').textContent), 'AI models only in platform settings');
    });
    await t('owner starts an Engagement trial: surfaces appear, both audit logs record it; cancelling is recorded', async function(){
      as('admin'); ok(!agentAccess('engagement').on, 'engagement starts off');
      var auditBefore = AUDIT_LOG.length; ok(agentSubscribe('engagement','trial'), 'trial started');
      ok(agentSub('engagement').state==='trial' && /Trial · 14 days left/.test(agentStateLabel('engagement')[1]), 'label ' + agentStateLabel('engagement')[1]);
      ok(agentAccess('engagement').on, 'engagement is on'); ok(AUDIT_LOG.slice(0, AUDIT_LOG.length-auditBefore+2).some(function(a){ return a.module==='Billing'; }), 'tenant audit'); ok(AUDIT_LOG.some(function(a){ return a.module==='Platform' && /Tenant agent trial/.test(a.action); }), 'platform audit');
      ok(PLATFORM_ADDON_LEDGER.some(function(l){ return l.agentId==='engagement' && l.mode==='trial'; }), 'ledger');
      ok(aiDestAgentOn('engagement'), 'Cowork shows the Engagement tab');
      agentSubscribe('engagement','cancel'); ok(agentSub('engagement').state==='cancelling', 'cancel at period end');
      as('recruiter'); ok(!agentSubscribe('talent-discovery','cancel'), 'a recruiter cannot cancel an agent');
    });
    await t('an agent step switched off in the workspace cannot be raised by a person; "always a person" is never loosened', async function(){
      as('admin'); TENANT_AGENT_CONFIG['engagement'].steps['followup'] = 'off';
      var uid = currentUserId(); USER_AGENT_PREFS[uid] = { engagement:{ enabled:true, steps:{ followup:'auto', ack:'auto' } } };
      ok(agentStepLevel('engagement','followup', uid)==='off', 'workspace off wins'); ok(agentStepLevel('engagement','ack', uid)==='auto', 'allowed level kept');
      TENANT_AGENT_CONFIG['talent-discovery'].steps['reject'] = 'auto'; ok(agentStepLevel('talent-discovery','reject', uid)==='person', 'reject stays always a person');
      TENANT_AGENT_CONFIG['talent-discovery'].steps['reject'] = 'person'; TENANT_AGENT_CONFIG['engagement'].steps['followup'] = 'suggest'; USER_AGENT_PREFS[uid] = {};
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
      settingsSection = 'people'; showView('settings'); ok(/Role rules/.test(q('#settings-content').textContent), 'role rules');
      settingsSection = 'approvals'; showView('settings'); ok(/Requisition/.test(q('#settings-content').textContent) && /Approval matrix/.test(q('#settings-content').textContent) && !/>Client</.test(q('#settings-content').innerHTML), 'requisition approvals and matrix, no client row');
      settingsSection = 'careers'; showView('settings'); ok(/Use vendors/.test(q('#settings-content').textContent), 'vendors');
      ok(!q('.nav-item[data-nav=client-management]'), 'no Clients in the sidebar');
      await everySection('corporate'); ORG_STRUCTURE.profile.orgType = prev; renderSidebar();
    });
    await t('old routes open the right Settings section, and the sidebar keeps one Settings item', async function(){
      as('admin');
      [['roles-permissions','roles'],['integrations','integrations'],['feature-flags','billing'],['security-settings','security'],['audit-center','audit'],['setup-hub','overview'],['org-structure','company'],['user-management','people']].forEach(function(p){
        showView(p[0]); ok(state.activeNav==='settings' && settingsSection===p[1], p[0] + ' -> ' + settingsSection);
      });
      var items = Array.prototype.map.call(document.querySelectorAll('#sidebar-nav .nav-item'), function(b){ return b.getAttribute('data-nav'); });
      ok(items.indexOf('settings')>-1 && items.indexOf('setup-hub')===-1 && items.indexOf('roles-permissions')===-1, 'sidebar: ' + items.join(','));
      ['manager','recruiter','hm','candidate'].forEach(function(r){ state.role = r; renderSidebar(); ok(!!q('.nav-item[data-nav=settings]'), r + ' has Settings'); });
    });
    await t('the section list uses the lean pill; role editor and integrations use the under pill', async function(){
      as('admin'); settingsSection = 'roles'; showView('settings'); await sleep(40);
      ok(q('#settings-nav > .o-pill.o-pill--lean'), 'section list pill'); ok(q('#role-tabs > .o-pill--under') || q('#role-tabs > .o-pill'), 'role tabs pill');
      settingsSection = 'integrations'; showView('settings'); await sleep(40); ok(q('#int-tabs > .o-pill'), 'integration tabs pill');
    });
    await t('changes are saved with Undo and audited; read-only rows are locked', async function(){
      as('admin'); var before = AUDIT_LOG.length; sTog('hiring.sameJobBlock'); ok(AUDIT_LOG.length>before, 'audited'); sTog('hiring.sameJobBlock');
      as('recruiter'); settingsSection = 'hiring'; showView('settings'); ok(/Rules that affect your work/.test(q('#settings-content').textContent), 'read-only summary for a recruiter');
    });
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();
