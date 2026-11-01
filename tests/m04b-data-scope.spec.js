/* M4b · Data scope (B4, part 2; flow map 04, 21).
   canIOn is the one scope rule for lists, detail views and checkScope. team = my whole Reports to tree; assigned = on the job;
   own = mine. Agency defaults: Recruiter sees assigned jobs and own journeys, all of the talent pool and clients; the Recruiter
   Manager sees their tree's jobs and journeys; Owner and Admin see everything. Corporate workspaces are unchanged.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m04b-data-scope.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } finally { asAdmin(); var b = q('#blocked-modal-root'); if(b) b.innerHTML = ''; } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asAdmin(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function actAs(id){ state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; }
  var OWNER = 'RP-088', seq = 0;
  function person(name, roleId, reportsTo){ seq++; var u = { id:'S4-' + seq, name:name, email:'s4.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:reportsTo || null, organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }
  function mkJob(team, over){ seq++; var j = Object.assign({ id:'s4j' + seq, title:'Scope Role ' + seq, client:'Fintech Corp', clientId:'c1', loc:'Pune, IN', locations:['Pune, IN'], status:'Active', priority:'Medium', recruiter:'', recruiterId:null,
    assignedRecruiters:team.map(function(u){ return u.id; }), skills:['Java'], positions:2, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, salary:'₹10–20 LPA' }, over || {}); JOBS.push(j); return j; }
  function mkCand(){ seq++; var c = { id:99000 + seq, name:'Scoped Candidate ' + seq, role:'Engineer', exp:'5 yrs', loc:'Pune, IN', skills:['Java'], email:'sc' + seq + '@example.com', phone:'+91 96000 ' + String(10000 + seq), salary:'₹14–16 LPA', notice:'30 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c); return c; }
  function journey(j, ownerId, stage){ var sb = createSubmission(j.id, mkCand().id, { source:'Manual', recruiterId:ownerId, stage:stage || 'Submitted' }); sb.recruiterId = ownerId; sb.notes = [{ at:new Date().toISOString(), by:'x', text:'Secret note: expects ₹30L' }]; return sb; }
  function blocked(){ var b = q('#blocked-modal-root'); return !!b && /You don’t have access to this/.test(b.textContent) && /You’re not on this job\.|This belongs to another team\./.test(b.textContent); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); if(typeof FM !== 'undefined') FM.interactive = false;

    await t('agency defaults and the Owner at the top of every tree', async function(){
      var rec = CUSTOM_ROLES.find(function(r){ return r.id === 'role_recruiter'; }), rm = CUSTOM_ROLES.find(function(r){ return r.id === 'role_recmgr'; }), dr = defaultScope(rec), dm = defaultScope(rm);
      ok(dr.jobs === 'assigned' && dr.interviews === 'assigned' && dr.journeys === 'own' && dr.talentpool === 'all' && dr.candidates === 'all' && dr.clients === 'all', 'recruiter: ' + JSON.stringify(dr));
      ok(dm.jobs === 'team' && dm.journeys === 'team' && dm.interviews === 'team' && dm.approvals === 'team' && dm.talentpool === 'all' && dm.candidates === 'all' && dm.clients === 'all', 'RM: ' + JSON.stringify(dm));
      ok(tmManagerIdOf(rosterById(OWNER)) === null, 'the Owner reports to nobody');
      ok(SCOPE_ONLY_MODULES[0].id === 'journeys' && SCOPE_ONLY_MODULES[0].label === 'Pipeline', 'the scope key is labelled Pipeline');
    });

    await t('a recruiter sees only assigned jobs and own journeys, all of the talent pool, and who owns a locked candidate (owner, stage and date only)', async function(){
      var r = person('Scope Recruiter', 'role_recruiter', 'RP-092'), other = person('Other Recruiter', 'role_recruiter', 'RP-092');
      var mine = mkJob([r]), notMine = mkJob([other]), a = journey(mine, r.id), b = journey(mine, other.id, 'Interview Scheduled'), c = journey(notMine, other.id);
      actAs(r.id);
      ok(jobInScope(mine) && !jobInScope(notMine), 'assigned jobs only'); ok(jobsInScope('mine').indexOf(notMine) < 0, 'not in Mapped to me');
      var allTab = jobsInScope('all'); ok(allTab.indexOf(notMine) > -1, 'listed under All jobs to request access'); jobsScope = 'all'; jobsStatus = 'All'; jobSearch = notMine.title;
      var html = jobsListHTML(); ok(/You’re not on this job/.test(html) && html.indexOf("openJob('" + notMine.id + "')") < 0, 'a reduced row: no link, no candidates, no team'); jobSearch = '';
      var rows = jobJourneysInScope(mine); ok(rows.length === 1 && rows[0] === a, 'own journeys only on the job page: ' + rows.length);
      ok(submissionsForJob(mine.id).length === 2, 'the job still has both (job-level facts stay whole-job)');
      ok(CANDIDATES.every(function(x){ return canIOn('candidates', null, x) && canIOn('talentpool', null, x); }), 'the whole talent pool');
      var ex = existingProspectOwnership(b.candidateId, mine.id, b); ok(ex.visible && ex.limited && ex.ownerName === 'Other Recruiter', 'the lock names the owner');
      showDuplicateModal(ex, byId(b.candidateId), mine); var t1 = q('#duplicate-modal-root').textContent;
      ok(/Other Recruiter/.test(t1) && /Interview Scheduled/.test(t1) && /Since/.test(t1), 'owner, stage and date'); ok(!/Secret note|₹30L|Last activity|Entered via|Next step|Open journey/.test(t1), 'nothing else from that journey: ' + t1.slice(0, 300)); closeDuplicateModal();
    });

    await t('a Recruiter Manager sees their whole Reports to tree two levels down, not another manager’s team', async function(){
      var top = person('Top Manager', 'role_recmgr', OWNER), mid = person('Middle Manager', 'role_recmgr', top.id), low = person('Low Recruiter', 'role_recruiter', mid.id);
      var otherMgr = person('Other Manager', 'role_recmgr', OWNER), otherRec = person('Their Recruiter', 'role_recruiter', otherMgr.id);
      var j1 = mkJob([low]), j2 = mkJob([otherRec]), deep = journey(j1, low.id), theirs = journey(j2, otherRec.id);
      actAs(top.id); ok(scopeTreeIds(top).indexOf(low.id) > -1 && scopeTreeIds(top).indexOf(otherRec.id) < 0, 'tree: ' + scopeTreeIds(top).join(','));
      ok(journeyInScope(deep) && !journeyInScope(theirs), 'two levels down yes; another team no'); ok(jobInScope(j1) && !jobInScope(j2), 'jobs follow the tree');
      ok(!journeyInScope(SUBMISSIONS.find(function(s){ return s.recruiterId === OWNER; })), 'not the Owner’s journeys');
    });

    await t('the Owner sees everything', async function(){
      asAdmin(); ok(JOBS.every(jobInScope) && SUBMISSIONS.every(journeyInScope) && CLIENTS.every(clientVisibleTo) && hmInterviews.every(interviewInScope), 'everything');
    });

    await t('a custom “Account manager” role (clients: own, jobs: own clients) sees only their clients and those jobs', async function(){
      var base = CUSTOM_ROLES.find(function(r){ return r.id === 'role_recruiter'; }); migrateRole(base);
      CUSTOM_ROLES.push({ id:'role_s4_am', name:'Account manager', __v2:true, permissions:JSON.parse(JSON.stringify(base.permissions)), scope:Object.assign({}, base.scope, { clients:'own', jobs:'own', journeys:'assigned' }), approves:{} });
      var am = person('Account Manager', 'role_s4_am', OWNER), c = CLIENTS.find(function(x){ return x.name === 'RetailX'; }), was = c.ownerId; c.ownerId = am.id;
      try {
        actAs(am.id); var vis = CLIENTS.filter(clientVisibleTo); ok(vis.length === 1 && vis[0] === c, 'only their client: ' + vis.map(function(x){ return x.name; }).join(','));
        var js = JOBS.filter(jobInScope); ok(js.length > 0 && js.every(function(j){ return clientForJob(j) === c; }), 'only that client’s jobs: ' + js.map(function(j){ return j.client; }).join(','));
      } finally { c.ownerId = was; }
    });

    await t('changing a role’s scope in Settings changes what its people see at once', async function(){
      var r = person('Settings Recruiter', 'role_recruiter', 'RP-092'), j = mkJob([rosterById('RP-071')]); actAs(r.id); ok(!jobInScope(j), 'assigned: hidden');
      asAdmin(); sRoleScope('role_recruiter', 'jobs', 'all'); actAs(r.id);
      try { ok(jobInScope(j), 'all: visible at once'); ok(AUDIT_LOG.some(function(a){ return /Data scope changed/.test(a.action); }), 'audited'); }
      finally { asAdmin(); sRoleScope('role_recruiter', 'jobs', 'assigned'); }
    });

    await t('opening an out-of-scope job or journey by link shows the blocked state; the screen is left as it was', async function(){
      var r = person('Link Recruiter', 'role_recruiter', 'RP-092'), other = person('Link Other', 'role_recruiter', 'RP-092'), j = mkJob([other]), sb = journey(j, other.id);
      actAs(r.id); showView('jobs'); var before = q('#main-content').innerHTML;
      openJob(j.id); ok(blocked() && q('#main-content').innerHTML === before, 'job: blocked, screen unchanged'); q('#blocked-modal-root').innerHTML = '';
      pdSubId = null; openPipelineDetail(sb.id); ok(blocked() && pdSubId === null, 'journey: blocked, drawer not opened');
    });

    await t('an action on an out-of-scope record is refused by checkScope with the same answer as the list', async function(){
      var r = person('Act Recruiter', 'role_recruiter', 'RP-092'), other = person('Act Other', 'role_recruiter', 'RP-092'), j = mkJob([r, other]), mine = journey(j, r.id), theirs = journey(j, other.id), away = mkJob([other]);
      actAs(r.id);
      [mine, theirs].forEach(function(sb){ ok(checkScope({ submissionId:sb.id }).allowed === journeyInScope(sb), 'journey ' + sb.id + ' agrees'); });
      ok(checkScope({ jobId:away.id }).allowed === jobInScope(away) && !jobInScope(away), 'job agrees');
      var res = canPerformAction('ScheduleInterview', { submissionId:theirs.id }); ok(!res.allowed && res.scopeBlocked === 'team', 'refused: ' + JSON.stringify(res));
      ok(canPerformAction('ScheduleInterview', { submissionId:mine.id }).allowed, 'own journey allowed');
      var foreign = Object.assign({}, rosterById('RP-081'), { id:'S4-X', organizationId:'org-other' }); RECRUITER_ROSTER.push(foreign); actAs('S4-X');
      try { ok(checkScope({ submissionId:mine.id }).scopeBlocked === 'organization', 'the organisation boundary is unchanged'); } finally { asAdmin(); RECRUITER_ROSTER.pop(); }
    });

    await t('corporate roles see exactly what they saw before', async function(){
      var was = ORG_STRUCTURE.profile.orgType; ORG_STRUCTURE.profile.orgType = 'Corporate';
      try {
        ['admin','manager','recruiter'].forEach(function(r){ state.role = r; viewingAsFromManager = false; managerViewAsRecruiterId = null; ok(!scopeApplies() && JOBS.every(jobInScope) && SUBMISSIONS.every(journeyInScope), r + ': not filtered'); });
        state.role = 'recruiter'; var me = currentActingUser(); ok(CLIENTS.filter(clientVisibleTo).length === CLIENTS.filter(function(c){ return clientJobs(c).some(function(j){ return isRecruiterMappedToJob(j.id, me.id); }); }).length, 'the old client rule');
      } finally { ORG_STRUCTURE.profile.orgType = was; asAdmin(); }
    });

    await t('screens still render for each agency persona', async function(){
      ['recruiter','manager','admin'].forEach(function(r){ state.role = r; viewingAsFromManager = false; ['jobs','talent-pool','interviews','approval-center','client-management'].forEach(function(v){ showView(v); ok(!/Something went wrong/.test(q('#main-content').textContent), r + ' ' + v); }); });
    });

    asAdmin();
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M04B-SCOPE ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
