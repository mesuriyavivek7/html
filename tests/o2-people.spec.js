// @o2-runner switches=0b,1a,7a,7c
/* O2 Step 7c: People & access (tabs, old actions kept), access reviews, Audit & security with approved export,
   policy changes signed by Security and Finance.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-people.spec.js */
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
  function clicks(html){ var out = [], re = /onclick="([^"]+)"/g, m; while((m = re.exec(html))){ if(!/^bosTab\(|^o2PeopleTab|^o2NavTab/.test(m[1])) out.push(m[1]); } return out.filter(function(c, i, a){ return a.indexOf(c) === i; }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);

    await t('People & access: People · Teams · Roles · Temporary access · Access reviews · Advanced', async function(){
      showView('oontu-people'); await sleep(5); eq(Array.prototype.map.call(main().querySelectorAll('.o2-host-tab'), function(b){ return b.textContent; }).join('|'), 'People|Teams|Roles|Temporary access|Access reviews|Advanced');
      ['people', 'teams', 'roles', 'temporary', 'reviews', 'advanced'].forEach(function(k){ o2PeopleTab(k); ok(main().textContent.length > 60, k); });
      o2PeopleTab('people'); var heads = Array.prototype.map.call(main().querySelectorAll('section[aria-labelledby="o2-people-h"] th'), function(x){ return x.textContent; }).join('|'); eq(heads, 'Name|Roles|Team|Status|Two-step|Last sign-in|Last access review|');
      o2PeopleTab('roles'); eq(main().querySelectorAll('section[aria-labelledby="o2-roles-h"] tbody tr').length, 12, '12 starter roles first'); ok(/Specialist roles/.test(main().textContent), 'specialists folded');
      o2PeopleTab('teams'); ok(BOS.teams.length >= 3 && /rev west/i.test(main().textContent), 'teams as records');
    });
    await t('acceptance: every old Employees and access action is available', async function(){
      var old = []; [0, 1, 2, 3].forEach(function(i){ old = old.concat(clicks(o2EmpTabBody(i))); });
      var now = []; ['people', 'teams', 'roles', 'temporary', 'reviews', 'advanced'].forEach(function(k){ now = now.concat(clicks(o2PeopleTabHTML(k))); });
      var missing = old.filter(function(c, i, a){ return a.indexOf(c) === i && now.indexOf(c) < 0; }); eq(missing.length, 0, 'missing: ' + missing.slice(0, 3).join(' | '));
    });
    await t('Advanced is read-only except for a Security Administrator', async function(){
      as('PU-106'); var h = o2PeopleTabHTML('advanced'); ok(/Read-only/.test(h) && !/<button/.test(h.replace(/<details[\s\S]*?<\/details>/g, '')), 'no buttons'); as('PU-108'); ok(!/Read-only: only a Security/.test(o2PeopleTabHTML('advanced')), 'security admin edits'); as('PU-001');
    });
    await t('quarterly access review: started, each manager’s people, completed by confirming', async function(){
      var r = o2StartAccessReview(); ok(r.ok, r.reason); var c = r.campaign; ok(c.items.length >= 9); ok(!o2StartAccessReview().ok, 'one per quarter');
      c.items.slice().forEach(function(i){ as(i.managerId === i.userId ? 'PU-001' : (i.managerId || 'PU-001')); if(i.userId === ACTIVE_PLATFORM_USER_ID) as('PU-108'); bosReviewAccess(i.userId, true); }); as('PU-001');
      ok(c.items.filter(function(i){ return i.done; }).length >= 1, 'progress recorded');
    });
    await t('Audit & security: filters and tabs; export needs the data-export approval (another person)', async function(){
      showView('oontu-audit'); await sleep(5); ok(/Audit & security/.test(main().textContent)); o2AuditSet('tab', 'refusals'); o2AuditSet('outcome', 'refused'); ok(o2AuditRows().every(function(e){ return (e.meta || e).outcome === 'refused'; }), 'filter works'); o2AuditSet('outcome', ''); o2AuditSet('tab', 'all');
      var r = o2RequestAuditExport({}, 'Quarterly compliance review'); ok(r.ok && r.pending, r.reason); ok(!bosCanDecide(r.approval, currentPlatformUser()).ok, 'not by the requester');
      as('PU-108'); var d = bosDecide(r.approval.id, true, 'Compliance review requested by the auditors in writing this quarter.', 'Evidence checked and valid'); ok(d.ok, d.reason); as('PU-001');
      var x = BOS.exports.slice(-1)[0]; ok(x && x.approvalId === r.approval.id && new Date(x.expiresAt) - new Date(x.createdAt) === o2Policy('exportLinkHours') * 36e5, 'export with an expiring link');
    });
    await t('policy edits need both a Security Administrator and a Finance Manager', async function(){
      as('PU-101'); ok(!o2RequestPolicyChange('closedRetentionDays', 120, 'Longer keeping for audits').ok, 'Sales can’t'); as('PU-108');
      var r = o2RequestPolicyChange('closedRetentionDays', 120, 'Customers asked for longer retention'); ok(r.ok, r.reason); ok(!o2SignPolicyChange(r.change.id).ok, 'not the requester');
      as('PU-106'); ok(o2SignPolicyChange(r.change.id).ok, 'finance signs'); eq(o2Policy('closedRetentionDays'), 90, 'not yet applied'); ok(!o2SignPolicyChange(r.change.id).ok, 'not twice');
      as('PU-001'); ok(o2SignPolicyChange(r.change.id).ok, 'security side signed'); eq(o2Policy('closedRetentionDays'), 120, 'applied after both'); eq(r.change.status, 'applied');
    });
    await t('switch 7c off: the old Employees and access screen', async function(){ o2SetSwitch('7c', false); showView('oontu-people'); await sleep(5); ok(main().querySelector('.bos-tabs'), 'old tabs'); o2SetSwitch('7c', true); });
    pub();
  }, 300); });
})();
