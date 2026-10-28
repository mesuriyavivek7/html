/* Sidebar: every role grouped by kind of work and ordered by daily use; folding groups remember their state; nothing is lost.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\sidebar.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); }
  function shown(){ return [].map.call(document.querySelectorAll('#sidebar-nav .nav-item'), function(b){ return b.getAttribute('data-nav'); }); }
  function heads(){ return [].map.call(document.querySelectorAll('#sidebar-nav .o-nav-head:not(.o-nav-head--blank)'), function(h){ return h.textContent.trim(); }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'recruiter'; enterApp(); await sleep(100);
    try { localStorage.removeItem('oontu.navGroups'); } catch(e){} NAV_GROUP_OPEN = {};

    await t('recruiter: start of day, Hiring, Outreach, Insights, then Settings at the bottom', async function(){
      as('recruiter'); ok(shown().join() === 'dashboard,my-todo,jobs,talent-pool,interviews,kairo-team,li-uni-box,intelligence,paytrack,settings', shown().join()); ok(heads().join() === 'Hiring,Outreach,Insights', heads().join());
      ok(!document.querySelector('#sidebar-nav .o-nav-fold'), 'nothing daily is folded away');
    });
    await t('recruiter manager: Approvals next to Home; Clients with hiring; Team with insights', async function(){
      as('manager'); ok(shown().join() === 'manager-dashboard,approval-center,manager-todo,jobs,talent-pool,interviews,client-management,kairo-team,li-uni-box,manager-team,intelligence,settings', shown().join());
      ok(heads().join() === 'Hiring,Outreach,Team and insights', heads().join());
    });
    await t('owner: Money visible, Insights folds and remembers, Workspace last; opening a page inside opens its group', async function(){
      as('admin'); ok(shown().join() === 'admin-dashboard,approval-center,all-tasks,jobs,talent-pool,interviews,client-management,kairo-team,li-uni-box,admin-revenue,admin-paytrack,payroll-billing,team-members,settings', shown().join());
      ok(heads().join() === 'Hiring,Outreach,Money,Workspace', heads().join()); var fold = document.querySelector('#sidebar-nav .o-nav-fold'); ok(fold && /Insights/.test(fold.textContent) && fold.getAttribute('aria-expanded') === 'false', 'Insights folded');
      toggleNavGroup('Insights'); ok(shown().indexOf('reports') > -1 && shown().indexOf('intelligence') > -1, 'opens'); ok(JSON.parse(localStorage.getItem('oontu.navGroups')).Insights === true, 'remembered'); toggleNavGroup('Insights'); ok(shown().indexOf('reports') === -1, 'closes');
      showView('reports'); ok(shown().indexOf('reports') > -1 && document.querySelector('.nav-item[data-nav=reports]').classList.contains('active'), 'its page opens the group'); showView('admin-dashboard');
      var icons = {}; NAV.admin.forEach(function(g){ g.items.forEach(function(i){ icons[i.icon] = (icons[i.icon] || 0) + 1; }); }); ok(icons.check === 1, 'Tasks and Approvals no longer share an icon');
    });
    await t('corporate owner: Clients and PayTrack leave the sidebar, the groups stay in order', async function(){
      var o = ORG_STRUCTURE.profile.orgType; ORG_STRUCTURE.profile.orgType = 'Corporate'; try { as('admin'); ok(shown().indexOf('client-management') === -1 && shown().indexOf('admin-paytrack') === -1, 'hidden'); ok(heads()[0] === 'Hiring', 'order'); } finally { ORG_STRUCTURE.profile.orgType = o; }
    });
    await t('hiring manager, candidate and Oontu: grouped and in daily order', async function(){
      as('hm'); ok(shown().join() === 'hm-dashboard,hm-interviews,hm-feedback,hm-decisions,hm-jobs,settings', shown().join()); ok(heads().join() === 'Your reviews,Requisitions', heads().join());
      as('candidate'); ok(shown().join() === 'candidate-home,candidate-opportunities,candidate-interviews,candidate-profile-self,settings', shown().join());
      as('oontu'); ok(shown()[0] === 'oontu-dashboard' && shown()[shown().length - 1] === 'oontu-settings', shown().join()); ok(heads().join() === 'Customers,Product,Operations', heads().join());
    });
    await t('nothing is lost: every page that had a sidebar entry still has one', async function(){
      Object.keys(NAV_LAYOUT).forEach(function(r){ var ids = []; NAV[r].forEach(function(g){ (g.items || [g]).forEach(function(i){ ids.push(i.id); }); }); ok(ids.length === new Set(ids).size, r + ' has no duplicates'); NAV_LAYOUT[r].forEach(function(g){ g[1].forEach(function(id){ ok(ids.indexOf(id) > -1 || ['oontu-agents'].indexOf(id) > -1, r + ' misses ' + id); }); }); });
      as('recruiter'); state.sidebarOpen = false; applySidebarVisibility(); ok(document.querySelectorAll('#sidebar-nav .nav-item').length === 10, 'all items reachable in the collapsed rail'); state.sidebarOpen = true; applySidebarVisibility();
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();
