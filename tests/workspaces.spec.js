/* Step 4 · More than one workspace: the switcher, Add a workspace (copy or fresh), data kept apart, roles per workspace, sign-in.
   Run: node runall.js workspaces */
(function(){
  var results = [], errs = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.stack || e).slice(0, 700) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var q = function(s, r){ return (r || document).querySelector(s); }, qa = function(s, r){ return [].slice.call((r || document).querySelectorAll(s)); };
  function by(n){ return RECRUITER_ROSTER.find(function(u){ return u.name === n; }); }
  function main(){ return q('#main-content').textContent; }
  async function addWs(name, o){
    o = o || {}; toggleRoleMenu(); await sleep(10); q('[data-add-ws]').click(); await sleep(10); ok(q('#wsm-g-root .ca-g[role=dialog]'), 'the guide opens');
    var inp = q('#wsm-name'); inp.value = name; inp.dispatchEvent(new Event('input')); ok(q('#wsm-slug').textContent === wsmSlug(name) + '.oontu.app', 'the address follows the name');
    q('[data-g=next]').click(); await sleep(5); if(o.fresh){ q('#wsm-g-root [role=radio][data-value=fresh]').click(); await sleep(5); } q('[data-g=next]').click(); await sleep(5);
    if(!o.fresh){ if(o.team){ q('[data-copy=team] input').click(); await sleep(5); o.team.forEach(function(id){ var c = q('[data-person="' + id + '"] input'); c.checked = true; c.dispatchEvent(new Event('change')); }); } q('[data-g=next]').click(); await sleep(5); }
    q('[data-g=next]').click(); await sleep(5); ok(q('[data-g=open]') && new RegExp('^' + name + ' is ready$').test(q('#wsm-q').textContent), 'done: ' + q('#wsm-q').textContent); return WSM_G.done.id;
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    document.getElementById('onboarding').classList.add('hidden'); state.role = 'admin'; enterApp(); await sleep(100); demoAct(by('Priya Sharma').id); renderSidebar(); window.__noReload = 1;

    await t('the workspace card opens the switcher: your workspaces with your role and a tick, Add a workspace, Workspace settings; demo controls only under Prototype tools; the account menu keeps Your settings and Sign out', async function(){
      toggleRoleMenu(); await sleep(10); var rows = qa('#ws-switch .wsm-row'); ok(rows.length >= 3 && /Northstar Talent Partners\s*Owner/.test(rows[0].textContent) && rows[0].getAttribute('aria-checked') === 'true' && /✓/.test(rows[0].textContent), 'rows: ' + rows.map(function(r){ return r.textContent; }).join(' | '));
      ok(q('[data-add-ws]') && /Workspace settings/.test(q('#ws-switch').textContent), 'add and settings'); var pt = q('#proto-tools'); ok(pt && pt.tagName === 'DETAILS' && !pt.open && /Prototype tools/.test(q('summary', pt).textContent) && q('#demo-menu', pt), 'Prototype tools, folded, with the demo controls');
      ok(!qa('#role-menu > *').some(function(x){ return x.id === 'demo-menu' || /switchRole/.test(x.getAttribute('onclick') || ''); }), 'nothing of the prototype outside it'); toggleRoleMenu(true);
      oOpenAccountMenu(q('#topbar-avatar')); await sleep(10); var vis = qa('#role-menu > *').filter(function(x){ return x.offsetParent !== null && x.textContent.trim(); }).map(function(x){ return x.textContent.trim(); }); ok(vis.join('|') === 'Your settings|Sign out', 'account menu: ' + vis.join('|')); toggleRoleMenu(true);
    });

    var ns0 = { c:CANDIDATES.length, j:JOBS.length, roles:JSON.stringify(CUSTOM_ROLES.map(function(r){ return [r.name, r.permissions]; })), ap:JSON.stringify(WSX.approvals), tp:JSON.stringify(WSX.templates), cw:JSON.stringify(Object.keys(TENANT_AGENT_CONFIG).map(function(k){ return [k, TENANT_AGENT_CONFIG[k].enabled, TENANT_AGENT_CONFIG[k].settings]; })) }, A;
    await t('Add a workspace from Northstar, copying my setup with the team off: same roles, approval rules, templates and Cowork settings; no candidates, jobs, clients, invoices or activity; only the Owner', async function(){
      A = await addWs('Brightpath Pune'); var s = WSM.stores[A];
      ok(JSON.stringify(s.roles.map(function(r){ return [r.name, r.permissions]; })) === ns0.roles, 'the same roles and permissions'); ok(JSON.stringify(s.setup.WSX.approvals) === ns0.ap, 'the same approval rules'); ok(JSON.stringify(s.setup.WSX.templates) === ns0.tp, 'the same templates');
      ok(JSON.stringify(Object.keys(s.setup.TENANT_AGENT_CONFIG).map(function(k){ return [k, s.setup.TENANT_AGENT_CONFIG[k].enabled, s.setup.TENANT_AGENT_CONFIG[k].settings]; })) === ns0.cw, 'the same Cowork settings');
      ['CANDIDATES','JOBS','CLIENTS','SUBMISSIONS','hmInterviews','PAYTRACK_JOINED','PAYTRACK_COMPLETED','SEND_LEDGER','CW_APPROVALS','APPROVAL_REQUESTS'].forEach(function(k){ ok(!s.arr[k].length, k + ' is empty'); }); ok(s.arr.AUDIT_LOG.length === 1 && /Workspace created/.test(s.arr.AUDIT_LOG[0].action), 'one audit line: created');
      ok(s.arr.RECRUITER_ROSTER.length === 1 && s.arr.RECRUITER_ROSTER[0].name === 'Priya Sharma' && s.roles.find(function(r){ return r.id === s.arr.RECRUITER_ROSTER[0].assignedRoleId; }).name === 'Owner', 'only the Owner'); ok(s.setup.ORG_STRUCTURE.profile.gstin === '', 'GST left blank');
      q('[data-g=open]').click(); await sleep(60);
      ok(ORG_STRUCTURE.profile.brandName === 'Brightpath Pune' && CANDIDATES.length === 0 && JOBS.length === 0 && CLIENTS.length === 0 && RECRUITER_ROSTER.length === 1, 'inside it: empty'); ok(state.activeNav === homeForMe() && q('#ws-card') && /Complete your workspace/.test(main()), 'Home with Complete your workspace');
      ok(wsSetup && wsSetup.done['jobs-site'] && wsSetup.done['agency-profile'], 'copied items are ticked'); ok(q('#ws-name').textContent === 'Brightpath Pune', 'the card says so');
      wsSwitch('w-northstar'); await sleep(40); ok(CANDIDATES.length === ns0.c && JOBS.length === ns0.j && ORG_STRUCTURE.profile.brandName === 'Northstar Talent Partners', 'Northstar is untouched');
    });

    await t('the same, with the team on and 3 people picked: they are Invited, with the same roles and reporting lines', async function(){
      var picks = ['Arjun Kapoor', 'Divya Menon', 'Neha Kulkarni'].map(function(n){ return by(n); }), B = await addWs('Northstar Contract', { team:picks.map(function(u){ return u.id; }) }), s = WSM.stores[B];
      ok(s.arr.RECRUITER_ROSTER.length === 4, 'Owner and 3: ' + s.arr.RECRUITER_ROSTER.map(function(u){ return u.name; }));
      picks.forEach(function(u){ var nu = s.arr.RECRUITER_ROSTER.find(function(x){ return x.email === u.email; }), oldRole = CUSTOM_ROLES.find(function(r){ return r.id === u.assignedRoleId; }).name, newRole = s.roles.find(function(r){ return r.id === nu.assignedRoleId; }).name;
        ok(nu.userStatus === 'Invited' && nu.inviteState === 'pending', u.name + ' invited, not an account'); ok(newRole === oldRole, u.name + ' role ' + newRole);
        var m = rosterById(tmManagerIdOf(u)), nm = s.arr.RECRUITER_ROSTER.find(function(x){ return x.id === nu.reportingManagerId; }); ok(nm && (m && picks.indexOf(m) > -1 ? nm.email === m.email : nm.name === 'Priya Sharma'), u.name + ' reports to ' + (nm || {}).name); });
      ok(!wsAuthMemberships(picks[1].email).some(function(m){ return m.name === 'Northstar Contract'; }), 'an invitation is not membership until accepted');
      q('[data-g=back-to]').click(); ok(ORG_STRUCTURE.profile.brandName === 'Northstar Talent Partners', 'Back to Northstar stays');
    });

    await t('switching back and forth keeps each workspace’s data: a candidate added in one never shows in the other, in lists, search or Kairo', async function(){
      wsSwitch(A); await sleep(30); CANDIDATES.push({ id:9990001, name:'Zara Quill', skills:['Java'], loc:'Pune, IN', notice:'30 Days', role:'Java Developer', exp:'3 yrs', ownerId:currentActingUser().id, addedOn:new Date().toISOString() }); showView('talent-pool'); await sleep(20); var inA = CANDIDATES.some(function(c){ return c.name === 'Zara Quill'; });
      wsSwitch('w-northstar'); await sleep(40); ok(inA && !CANDIDATES.some(function(c){ return c.name === 'Zara Quill'; }), 'not in Northstar’s pool'); showView('talent-pool'); await sleep(20); ok(main().indexOf('Zara Quill') < 0, 'not in the list');
      globalSearchQuery = 'Zara'; ok(!(globalSearchAllResults() || []).some(function(r){ return /Zara Quill/.test(JSON.stringify(r)); }), 'not in search'); globalSearchQuery = ''; ok(!/Zara Quill/.test(kaAnswer('tell me about Zara Quill').text), 'not in Kairo');
      wsSwitch(A); await sleep(30); ok(CANDIDATES.some(function(c){ return c.name === 'Zara Quill'; }) && CANDIDATES.length === 1, 'still in Brightpath'); ok(/Zara Quill/.test(kaAnswer('tell me about Zara Quill').text), 'and Kairo finds her there');
      fmModal('<div class="p-4">Left open</div>'); wsSwitch('w-northstar'); await sleep(30); ok(!q('#fm-modal-root').innerHTML.trim(), 'nothing stays open from the other workspace');
    });

    await t('the same person is Owner in one workspace and Recruiter in another; the menu and Home follow the workspace', async function(){
      var div = by('Divya Menon'); wsmInvite(A, { name:div.name, email:div.email }, 'Owner'); demoAct(div.id); renderSidebar(); ok(state.role === 'recruiter' && homeForMe() === 'dashboard', 'Recruiter in Northstar');
      toggleRoleMenu(); await sleep(5); ok(q('#ws-switch [data-invite="' + A + '"]') && /Invited as Owner/.test(q('#ws-switch').textContent), 'the invitation shows'); q('#ws-switch [data-invite="' + A + '"] .wsm-acc').click(); await sleep(5); ok(q('#ws-switch [data-ws="' + A + '"]'), 'after accepting, it is in the switcher'); toggleRoleMenu(true);
      q('#role-trigger').click(); await sleep(5); q('#ws-switch [data-ws="' + A + '"]').click(); await sleep(40); ok(ORG_STRUCTURE.profile.brandName === 'Brightpath Pune' && currentActingUser().email === div.email && state.role === 'admin' && state.activeNav === homeForMe() && homeForMe() === 'admin-dashboard', 'Owner in Brightpath: ' + state.role);
      ok(q('#sidebar .nav-item[data-nav=settings]') && q('#sidebar .nav-item[data-nav=payroll-billing], #sidebar .nav-item[data-nav=admin-paytrack]'), 'the Owner’s menu');
      wsSwitch('w-northstar'); await sleep(30); ok(currentActingUser().email === div.email && state.role === 'recruiter' && state.activeNav === 'dashboard', 'back to Recruiter in Northstar'); demoAct(by('Priya Sharma').id); renderSidebar();
    });

    await t('a workspace that needs you shows a dot in the switcher', async function(){
      var me = currentActingUser(), st = WSM.stores[A], u = st.arr.RECRUITER_ROSTER.find(function(x){ return x.email === me.email; }); st.arr.APPROVAL_REQUESTS.push({ id:'ar-ws-test', status:'Pending', approverUserId:u.id, entityType:'Offer' });
      toggleRoleMenu(); await sleep(5); ok(q('#ws-switch [data-ws="' + A + '"] .wsm-dot') && !q('#ws-switch [data-ws="w-northstar"] .wsm-dot'), 'a dot on Brightpath'); toggleRoleMenu(true); st.arr.APPROVAL_REQUESTS.length = 0;
    });

    await t('sign-in: an account in more than one workspace chooses one, the last used first', async function(){
      var pri = by('Priya Sharma'); wsmRemember(wsmAccount(pri.email), A); try { performLogout(); } catch(e){} await sleep(60); authApi._latency = 0; OA.resetSignIn(); authSwitchIntent('signin'); await sleep(30);
      var e = q('#si-email'); e.value = pri.email; e.dispatchEvent(new Event('input', { bubbles:true })); q('form[data-form=si-email]').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); for(var i = 0; i < 100 && !q('.oa-otp__input'); i++) await sleep(20);
      var c = q('.oa-otp__input'); c.value = '123456'; c.dispatchEvent(new Event('input', { bubbles:true })); for(var k = 0; k < 150 && !q('.au-ws'); k++) await sleep(20);
      var list = qa('.au-ws'); ok(list.length >= 2 && /Choose a workspace/.test(document.body.textContent), 'the chooser: ' + list.length); ok(/Brightpath Pune\s*Owner/.test(list[0].textContent), 'the last used first, with the role: ' + list.map(function(b){ return b.textContent; }).join(' | '));
      list[0].click(); for(var m = 0; m < 150 && document.getElementById('app').classList.contains('hidden'); m++) await sleep(20); var en = q('[data-act=si-enter]'); if(en){ en.click(); await sleep(100); }
      ok(!document.getElementById('app').classList.contains('hidden') && ORG_STRUCTURE.profile.brandName === 'Brightpath Pune' && currentActingUser().email === pri.email, 'in Brightpath as Priya: ' + ORG_STRUCTURE.profile.brandName);
      wsSwitch('w-northstar'); await sleep(30);
    });

    await t('Kesar, Northstar and Vistaar switch without a reload', async function(){
      wsSwitch('w-kesar'); await sleep(50); ok(ORG_STRUCTURE.profile.brandName === 'Kesar Staffing' && currentActingUser().name === 'Meera Shah' && CANDIDATES.length === 60, 'Kesar: ' + ORG_STRUCTURE.profile.brandName + ' ' + CANDIDATES.length);
      wsSwitch('w-northstar'); await sleep(40); ok(ORG_STRUCTURE.profile.brandName === 'Northstar Talent Partners' && CANDIDATES.length === ns0.c, 'Northstar');
      wsSwitch('w-vistaar'); for(var i = 0; i < 600 && DEMO.loading; i++) await sleep(100); ok(ORG_STRUCTURE.profile.brandName === 'Vistaar HR Services' && CANDIDATES.length === 4000 && currentActingUser().name === 'Anil Desai', 'Vistaar: ' + CANDIDATES.length);
      wsSwitch('w-kesar'); await sleep(40); ok(ORG_STRUCTURE.profile.brandName === 'Kesar Staffing' && CANDIDATES.length === 60, 'Kesar again, as it was'); wsSwitch('w-northstar'); await sleep(40); ok(window.__noReload === 1, 'no reload');
    });

    await t('close a workspace (Owner, typing the name), then restore it within 30 days', async function(){
      wsSwitch(A); await sleep(30); settingsSection = 'danger'; showView('settings'); await sleep(20); var i = q('#close-confirm'); ok(i, 'Danger zone'); i.value = 'Brightpath Pune'; sCloseWorkspace(); await sleep(40);
      ok(wsmGet(A).status === 'closed' && ORG_STRUCTURE.profile.brandName === 'Northstar Talent Partners', 'closed, and back in Northstar'); toggleRoleMenu(); await sleep(5); ok(q('#ws-switch [data-closed="' + A + '"]') && /Closed · restore by/.test(q('#ws-switch').textContent) && !q('#ws-switch [data-ws="' + A + '"]'), 'listed as closed');
      q('#ws-switch [data-closed="' + A + '"] .wsm-acc').click(); await sleep(5); ok(wsmGet(A).status === 'active' && q('#ws-switch [data-ws="' + A + '"]'), 'restored'); toggleRoleMenu(true);
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();
