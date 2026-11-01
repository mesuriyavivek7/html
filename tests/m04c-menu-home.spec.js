/* M4c · Menu and Home from permissions (B5; flow map 04, 21).
   Agency staff get one layout filtered by the acting role's permissions; Home comes from homeFor(role); one To do, Team,
   Home and PayTrack entry per person; a screen the role can't use shows the blocked state; money on client screens needs
   Clients · View Contracts. Corporate, hiring manager, candidate and Oontu menus are unchanged.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m04c-menu-home.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } finally { reset(); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function reset(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; ORG_STRUCTURE.profile.orgType = 'Agency'; closeBlockedState(); renderSidebar(); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function actAs(id){ state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; renderSidebar(); }
  function shown(){ NAV_GROUP_OPEN = { Insights:true }; sidebarMoreOpen = true; renderSidebar(); return [].map.call(document.querySelectorAll('#sidebar-nav .nav-item'), function(b){ return b.getAttribute('data-nav'); }).join(','); }
  var toasts = [], t0 = window.toast; window.toast = function(m){ toasts.push(String(m)); return t0.apply(this, arguments); };
  var seq = 0;
  // Fixture roles from flow 04 (spec only, not product templates).
  function role(id, name, perms, scope){ var r = { id:id, name:name, __v2:true, permissions:{}, scope:Object.assign({ jobs:'own', journeys:'own', talentpool:'own', candidates:'own', clients:'own', interviews:'own', approvals:'own', reports:'own' }, scope || {}), approves:{} };
    PERMISSION_MODULES.forEach(function(m){ r.permissions[m.id] = []; }); Object.keys(perms).forEach(function(k){ r.permissions[k] = perms[k].slice(); }); CUSTOM_ROLES.push(r); return r; }
  function person(name, roleId){ seq++; var u = { id:'C4-' + seq, name:name, email:'c4.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:'RP-088', organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100);
    var AM = role('role_c4_am', 'Account manager', { clients:['View','Create','Edit'], jobs:['View','Create','Edit'], interviews:['View','Schedule'], approvals:['Request','Approve','View'] }, { clients:'own', jobs:'own' });
    var ACC = role('role_c4_acc', 'Accounts', { billing:['View'] });
    var SRC = role('role_c4_src', 'Sourcer', { talentpool:['View','Add','Move'], candidates:['View','Edit'], kairo:['Use agents'] }, { talentpool:'all' });
    var NOMONEY = role('role_c4_nomoney', 'Client viewer', { clients:['View'], jobs:['View'] });

    await t('Owner, Recruiter Manager and Recruiter: menus and Homes as today (Recruiter gains Clients; the manager’s Intelligence and Team change groups)', async function(){
      as('admin'); ok(shown() === 'admin-dashboard,approval-center,all-tasks,jobs,talent-pool,interviews,client-management,kairo-team,li-uni-box,admin-revenue,admin-paytrack,payroll-billing,reports,recruiter-analytics,admin-recruiters,intelligence,team-members,settings', shown());
      ok(homeFor('role_founder') === 'admin-dashboard' && homeForMe() === 'admin-dashboard', 'Owner Home');
      as('manager'); ok(shown() === 'manager-dashboard,approval-center,manager-todo,jobs,talent-pool,interviews,client-management,kairo-team,li-uni-box,intelligence,manager-team,settings', shown());
      ok(homeFor('role_recmgr') === 'manager-dashboard' && homeForMe() === 'manager-dashboard', 'RM Home');
      as('recruiter'); ok(shown() === 'dashboard,my-todo,jobs,talent-pool,interviews,client-management,kairo-team,li-uni-box,intelligence,paytrack,settings', shown());
      ok(homeFor('role_recruiter') === 'dashboard' && homeForMe() === 'dashboard', 'Recruiter Home'); ok(homeFor('role_admin') === 'admin-dashboard', 'Admin Home');
      ['recruiter','manager','admin'].forEach(function(r){ ok(DEFAULT_VIEW[r] === (r === 'recruiter' ? homeFor('role_recruiter') : r === 'manager' ? homeFor('role_recmgr') : homeFor('role_founder')), r + ': the same Home as before'); });
      as('recruiter'); switchRole('manager'); ok(state.activeNav === 'manager-dashboard', 'switchRole uses homeFor');
    });

    await t('custom Account manager (clients, jobs, interviews, approvals; no team, no money) sees exactly those and lands on My day', async function(){
      var u = person('Account Person', AM.id); actAs(u.id);
      ok(shown() === 'dashboard,approval-center,my-todo,jobs,interviews,client-management,settings', shown()); ok(homeFor(AM.id) === 'dashboard' && homeForMe() === 'dashboard', 'My day');
      ok(!clCanSeeMoney(), 'no money');
    });

    await t('custom Accounts role (billing only) sees only PayTrack and Billing and lands on PayTrack; Sourcer sees the talent pool, Cowork and LinkIt', async function(){
      var u = person('Accounts Person', ACC.id); actAs(u.id); ok(homeFor(ACC.id) === 'admin-paytrack', 'Home is PayTrack'); ok(shown() === 'admin-paytrack,payroll-billing,settings', shown());
      ok(document.querySelector('#sidebar-nav .nav-item[data-nav="admin-paytrack"]').textContent.trim() === 'Home', 'PayTrack is their Home entry');
      var s = person('Sourcer Person', SRC.id); actAs(s.id); ok(homeFor(SRC.id) === 'dashboard', 'Sourcer: My day'); ok(navItemAllowed(SRC, 'kairo-team') && !navItemAllowed(SRC, 'jobs'), 'the role allows Cowork, not Jobs');
      ok(shown() === (oAgentsOn() ? 'dashboard,my-todo,talent-pool,kairo-team,li-uni-box,settings' : 'dashboard,my-todo,talent-pool,li-uni-box,settings'), 'Cowork follows the agents switch as before: ' + shown());
    });

    await t('removing Clients · View from a role removes Clients at once, and its people on Clients go to Home', async function(){
      as('manager'); showView('client-management'); ok(state.activeNav === 'client-management', 'on Clients');
      togglePermission('role_recmgr', 'clients', 'View');
      try {
        ok(shown().indexOf('client-management') < 0, 'gone from the menu'); ok(state.activeNav === 'manager-dashboard', 'sent Home: ' + state.activeNav);
        ok(/no longer opens Clients, so you’re back on Home/.test(toasts.join(' | ')), 'told why');
        showView('client-management'); ok(/Your role can’t open this page/.test(q('#blocked-modal-root').textContent), 'and blocked by link');
      } finally { togglePermission('role_recmgr', 'clients', 'View'); }
      as('manager'); ok(shown().indexOf('client-management') > -1, 'back when restored');
    });

    await t('one To do entry per role, never two', async function(){
      var todo = /(^|,)(my-todo|manager-todo|all-tasks)(,|$)/g;
      [['admin', null], ['manager', null], ['recruiter', null], [null, AM.id], [null, SRC.id], [null, ACC.id]].forEach(function(x){ if(x[0]) as(x[0]); else actAs(person('Todo ' + x[1], x[1]).id); var m = shown().match(todo) || []; ok(m.length <= 1, (x[0] || x[1]) + ': ' + m.join()); });
      as('admin'); ok(/all-tasks/.test(shown()), 'Owner: Tasks'); as('manager'); ok(/manager-todo/.test(shown()), 'RM: team To do'); as('recruiter'); ok(/my-todo/.test(shown()), 'Recruiter: own To do');
    });

    await t('opening a screen the role can’t use shows the blocked state with the new wording', async function(){
      as('recruiter'); showView('dashboard'); var before = state.activeNav; showView('admin-revenue');
      var b = q('#blocked-modal-root').textContent; ok(/You don’t have access to this/.test(b) && /Your role can’t open this page\./.test(b), b); ok(!/Your team/.test(b), 'no team box for a role block'); ok(state.activeNav === before, 'stays where it was');
      closeBlockedState(); showBlockedState({ allowed:false, reason:'This belongs to another organisation.', scopeBlocked:'organization' }); ok(/Your organization/.test(q('#blocked-modal-root').textContent), 'the box only for organisation blocks');
    });

    await t('money on client screens needs View Contracts: a role with Clients · View only sees none; the recruiter mirror sees none; the RM as today', async function(){
      var u = person('No Money Person', NOMONEY.id); actAs(u.id); ok(!clCanSeeMoney(), 'View only: no money'); showView('client-management'); await sleep(30);
      ok(!/[₹£$€]|AED|Revenue|Outstanding/.test(q('#main-content').textContent), 'the list has no money');
      actAs('RP-081'); ok(!clCanSeeMoney(), 'the View as recruiter mirror: no money'); as('manager'); ok(clCanSeeMoney(), 'RM: as today'); as('admin'); ok(clCanSeeMoney(), 'Owner');
      ok(navRole('role_recruiter').permissions.clients.join() === 'View' && navRole('role_recmgr').permissions.clients.indexOf('View Contracts') > -1, 'defaults');
    });

    await t('role preview uses the role’s menu and Home', async function(){
      as('admin'); startPreviewAsRole(AM.id); ok(state.activeNav === 'dashboard', 'Home: ' + state.activeNav); ok(shown() === 'dashboard,approval-center,my-todo,jobs,interviews,client-management,settings', shown());
      exitPreviewAsRole(); ok(state.activeNav === 'admin-dashboard' && /admin-revenue/.test(shown()), 'back to the Owner');
    });

    await t('corporate, hiring manager, candidate and Oontu menus are unchanged', async function(){
      ORG_STRUCTURE.profile.orgType = 'Corporate';
      as('recruiter'); ok(shown() === 'dashboard,my-todo,jobs,talent-pool,interviews,kairo-team,li-uni-box,intelligence,paytrack,settings', 'corp recruiter: ' + shown());
      as('manager'); ok(shown() === 'manager-dashboard,approval-center,manager-todo,jobs,talent-pool,interviews,requisitions,vendors,marketplace,contract-hiring,kairo-team,li-uni-box,manager-team,intelligence,settings', 'corp manager: ' + shown());
      as('admin'); ok(shown() === 'admin-dashboard,approval-center,all-tasks,jobs,talent-pool,interviews,requisitions,vendors,marketplace,contract-hiring,kairo-team,li-uni-box,admin-revenue,reports,recruiter-analytics,admin-recruiters,intelligence,team-members,settings', 'corp owner: ' + shown());
      ok(homeForMe() === DEFAULT_VIEW.admin, 'corporate Home unchanged');
      as('hm'); ok(shown() === 'hm-dashboard,hm-interviews,hm-feedback,hm-decisions,hm-jobs,requisitions,settings', 'corp hm: ' + shown());
      ORG_STRUCTURE.profile.orgType = 'Agency';
      as('hm'); ok(shown() === 'hm-dashboard,hm-interviews,hm-feedback,hm-decisions,hm-jobs,settings', 'hm: ' + shown());
      as('candidate'); ok(shown() === 'candidate-home,candidate-opportunities,candidate-interviews,candidate-profile-self,settings', 'candidate: ' + shown());
      as('oontu'); var o = shown(); ok(o.split(',')[0] === 'oontu-dashboard' && /oontu-settings$/.test(o), 'oontu: ' + o);
    });

    reset();
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M04C-MENU ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
