/* M4a · Approval routing (B4, part 1; flow map 05, 06, 07).
   approverFor(kind, requester, ctx): skip by rule, walk Reports to, skip inactive people, on leave → delegate, stop at the first
   person whose role approves the kind and who can see the work, else the Owner; never the requester (by person record).
   Each test builds its own reporting tree from new people, so the seed data is not touched.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m04a-approval-routing.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } finally { asAdmin(); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asAdmin(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function actAs(id){ state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; }
  function audit(re){ return AUDIT_LOG.some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '')); }); }
  var OWNER = 'RP-088', seq = 0;
  // A new person in the roster: role and Reports to.
  function person(name, roleId, reportsTo){ seq++; var u = { id:'M4-' + seq, name:name, email:'m4.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:reportsTo || null, organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }
  // A role for one test, already on the current model (so migrateRole leaves it as given).
  function role(id, name, base, approves, scopeJobs){ var b = CUSTOM_ROLES.find(function(r){ return r.id === base; }); migrateRole(b); var r = { id:id, name:name, __v2:true, permissions:JSON.parse(JSON.stringify(b.permissions)), scope:Object.assign({}, b.scope, { jobs:scopeJobs || b.scope.jobs }), approves:approves }; CUSTOM_ROLES.push(r); return r; }
  function mkJob(team, over){ seq++; var j = Object.assign({ id:'m4j' + seq, title:'Routing Role ' + seq, client:'Fintech Corp', clientId:'c1', loc:'Pune, IN', locations:['Pune, IN'], status:'Active', priority:'Medium', recruiter:'', recruiterId:null,
    assignedRecruiters:team.map(function(u){ return u.id; }), skills:['Java'], positions:2, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, salary:'₹10–20 LPA',
    submissionRules:{ approvalBeforeClient:true, hideContacts:true, maxProfiles:5, required:[] } }, over || {}); JOBS.push(j); return j; }
  function mkCand(){ seq++; var c = { id:98000 + seq, name:'Routed Candidate ' + seq, role:'Engineer', exp:'5 yrs', loc:'Pune, IN', skills:['Java'], email:'rc' + seq + '@example.com', phone:'+91 95000 ' + String(10000 + seq), salary:'₹14–16 LPA', notice:'30 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c); return c; }
  function submitAs(u, j){ actAs(u.id); var r = submitOneToJob(j, mkCand(), 'Test'); asAdmin(); return r; }
  function reviewOf(r){ return r && r.sub ? APPROVAL_REQUESTS.find(function(x){ return x.entityType === 'SubmissionReview' && x.entityId === r.sub.id; }) : null; }
  function reviewer(r){ var q = reviewOf(r); return q ? q.approverUserId : null; }
  function offerAs(u, j){ var c = mkCand(), sb = createSubmission(j.id, c.id, { source:'Manual', recruiterId:u.id, stage:'Feedback Given' }); actAs(u.id); var res = recordOffer(sb.id, { ctc:40, doj:'2026-12-15' }); asAdmin();
    var q = res.approval || null; return { res:res, approver:q ? q.approverUserId : null, req:q }; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); if(typeof FM !== 'undefined') FM.interactive = false;
    var WSX0 = JSON.stringify(WSX.approvals);
    function resetSettings(){ WSX.approvals = JSON.parse(WSX0); }

    await t('one roleHasPermission; agency approve powers; skip names map to roles', async function(){
      ok((Array.from(document.scripts).map(function(s){ return s.textContent; }).join('\n').match(/function roleHasPermission\(/g) || []).length === 1, 'one definition');
      ok(roleHasPermission('role_recruiter', 'ai', 'Use agents') === roleHasPermission('role_recruiter', 'kairo', 'Use agents'), 'ai still means kairo');
      var rm = CUSTOM_ROLES.find(function(r){ return r.id === 'role_recmgr'; }); migrateRole(rm);
      ok(JSON.stringify(defaultApproves(rm)) === JSON.stringify({ client:false, job:true, submission:true, offer:true, jobAccess:true }), 'agency RM: ' + JSON.stringify(defaultApproves(rm)));
      var was = ORG_STRUCTURE.profile.orgType; ORG_STRUCTURE.profile.orgType = 'Corporate'; try { ok(JSON.stringify(defaultApproves(rm)) === JSON.stringify({ job:true, submission:true, offer:{ maxBand:'B3' } }), 'corporate unchanged'); } finally { ORG_STRUCTURE.profile.orgType = was; }
      ok(roleApproves('role_recruiter', 'submission') === false && roleApproves('role_founder', 'jobAccess') === true, 'recruiter nothing, Owner everything');
      ok(roleIdForName('Owner') === 'role_founder' && roleIdForName('Recruiter Manager') === 'role_recmgr' && roleIdForName('TA Head') === 'role_recmgr' && roleIdForName('Nobody') === null, 'skip names');
    });

    await t('small: Owner → Recruiter. The review goes to the Owner; a job with review off needs none', async function(){
      var r = person('Small Recruiter', 'role_recruiter', OWNER), j = mkJob([r]);
      ok(reviewer(submitAs(r, j)) === OWNER, 'to the Owner');
      var off = mkJob([r], { submissionRules:{ approvalBeforeClient:false, hideContacts:true, maxProfiles:5, required:[] } }), res = submitAs(r, off);
      ok(res.ok && res.sub.stage === 'Ready to Send' && !reviewOf(res), 'review off: none');
    });

    await t('classic: Owner → RM → Recruiter. The RM when on the job; the Owner when not (submission and offer)', async function(){
      var m = person('Classic RM', 'role_recmgr', OWNER), r = person('Classic Recruiter', 'role_recruiter', m.id);
      ok(reviewer(submitAs(r, mkJob([r, m]))) === m.id, 'RM on the job');
      var sub = submitAs(r, mkJob([r])); ok(reviewer(sub) === OWNER, 'RM not on the job → Owner'); ok(reviewOf(sub).route.some(function(s){ return s.id === m.id && /not on the job/.test(s.result); }), 'the route says why');
      ok(offerAs(r, mkJob([r, m])).approver === m.id, 'offer → RM on the job'); ok(offerAs(r, mkJob([r])).approver === OWNER, 'offer → Owner when the RM is not on it');
    });

    await t('larger: Owner → Admin → RM → Recruiter. RM if on the job, else Admin (with the power and All scope), else Owner', async function(){
      var a = person('Larger Admin', 'role_admin', OWNER), m = person('Larger RM', 'role_recmgr', a.id), r = person('Larger Recruiter', 'role_recruiter', m.id);
      ok(reviewer(submitAs(r, mkJob([r, m]))) === m.id, 'RM on the job'); ok(reviewer(submitAs(r, mkJob([r]))) === a.id, 'Admin: All scope, can approve');
      role('role_m4_admin_np', 'Admin without approvals', 'role_admin', { submission:false, offer:false }, 'all');
      var a2 = person('Powerless Admin', 'role_m4_admin_np', OWNER), m2 = person('RM Two', 'role_recmgr', a2.id), r2 = person('Recruiter Two', 'role_recruiter', m2.id);
      ok(reviewer(submitAs(r2, mkJob([r2]))) === OWNER, 'Admin without the power → Owner');
      role('role_m4_admin_team', 'Admin, own jobs only', 'role_admin', { submission:true }, 'team');
      var a3 = person('Scoped Admin', 'role_m4_admin_team', OWNER), r3 = person('Recruiter Three', 'role_recruiter', a3.id);
      ok(reviewer(submitAs(r3, mkJob([r3]))) === OWNER && reviewer(submitAs(r3, mkJob([r3, a3]))) === a3.id, 'Admin without All scope only when on the job');
    });

    await t('mixed: one recruiter under the RM, one directly under the Owner; each by their own line', async function(){
      var m = person('Mixed RM', 'role_recmgr', OWNER), r1 = person('Under RM', 'role_recruiter', m.id), r2 = person('Under Owner', 'role_recruiter', OWNER), j = mkJob([r1, r2, m]);
      ok(reviewer(submitAs(r1, j)) === m.id && reviewer(submitAs(r2, j)) === OWNER, 'own lines');
    });

    await t('an RM without approves.submission is skipped; the request goes higher', async function(){
      role('role_m4_rm_noapprove', 'Team lead (no approvals)', 'role_recmgr', { submission:false, offer:false });
      var top = person('Top RM', 'role_recmgr', OWNER), lead = person('No-approve Lead', 'role_m4_rm_noapprove', top.id), r = person('Lead Recruiter', 'role_recruiter', lead.id);
      var sub = submitAs(r, mkJob([r, lead, top])); ok(reviewer(sub) === top.id, 'to the next one up');
      ok(reviewOf(sub).route[0].id === lead.id && /can’t approve submission/.test(reviewOf(sub).route[0].result), 'route: ' + JSON.stringify(reviewOf(sub).route));
    });

    await t('approver on leave → their delegate; inactive → skipped', async function(){
      var m = person('Away RM', 'role_recmgr', OWNER), cover = person('Cover RM', 'role_recmgr', OWNER), r = person('Leave Recruiter', 'role_recruiter', m.id), j = mkJob([r, m, cover]);
      APS.config.delegations.push({ fromUserId:m.id, toUserId:cover.id, from:new Date(Date.now() - 3600000).toISOString(), to:new Date(Date.now() + 86400000).toISOString(), reason:'Leave' });
      try {
        var sub = submitAs(r, j); ok(reviewer(sub) === cover.id, 'delegate: ' + reviewer(sub)); ok(reviewOf(sub).route.some(function(s){ return /on leave → Cover RM/.test(s.result); }), 'route says on leave');
        ok(delegateFor(m).id === cover.id, 'delegateFor reads the engine list');
        var notOn = mkJob([r, m]); ok(reviewer(submitAs(r, notOn)) === OWNER, 'a delegate who can’t see the work does not qualify');
      } finally { APS.config.delegations = APS.config.delegations.filter(function(d){ return d.fromUserId !== m.id; }); }
      m.userStatus = 'Suspended'; try { var s2 = submitAs(r, j); ok(reviewer(s2) === OWNER && reviewOf(s2).route[0].result === 'skipped: not active', 'inactive skipped'); } finally { m.userStatus = 'Active'; }
    });

    await t('never the requester; the Owner is approved by rule; the Owner’s own record in the Recruiter persona is approved by rule too', async function(){
      asAdmin(); var j = mkJob([rosterById(OWNER)]), n0 = APPROVAL_REQUESTS.length, res = submitOneToJob(j, mkCand(), 'Test');
      ok(res.ok && res.sub.stage === 'Ready to Send' && APPROVAL_REQUESTS.length === n0 && audit(/Submission approved by rule .*Owner, no one above/), 'Owner → by rule, audited');
      var a = approverFor('submission', rosterById(OWNER), { jobId:j.id }); ok(a.approvedByRule && a.reason === 'Owner, no one above', a.reason);
      state.role = 'recruiter'; viewingAsFromManager = false; previewAsRoleId = null; ok(effectiveRoleId() === 'role_recruiter' && currentActingUser().id === OWNER, 'Priya in the Recruiter persona');
      var lone = mkJob([rosterById(OWNER)]); var b = approverFor('submission', currentActingUser(), { jobId:lone.id });
      ok(b.approvedByRule && b.reason === 'Requester is the only Owner' && !b.user, 'nobody on her line qualifies → by rule: ' + JSON.stringify([b.reason, b.route]));
      var res2 = submitOneToJob(lone, mkCand(), 'Test'); ok(res2.ok && !reviewOf(res2) && audit(/Submission approved by rule .*Requester is the only Owner/), 'audited, never sent to herself');
      var withArjun = mkJob([rosterById(OWNER), rosterById('RP-092')]); var w = approverFor('submission', currentActingUser(), { jobId:withArjun.id }); ok(w.approvedByRule && w.reason === 'Requester is the only Owner' && !w.user, 'the Owner reports to nobody, so even with Arjun on the job she is never sent to someone below');
    });

    await t('job access from the Owner’s own record in the Recruiter persona is approved by rule, never sent to herself', async function(){
      var j = mkJob([rosterById('RP-092')]); state.role = 'recruiter'; viewingAsFromManager = false; previewAsRoleId = null;
      var n0 = APPROVAL_REQUESTS.length, res = requestJobAccess(j.id);
      ok(res.ok && res.approvedByRule && res.reason === 'Requester is the only Owner' && APPROVAL_REQUESTS.length === n0, 'by rule: ' + JSON.stringify(res));
      ok(j.assignedRecruiters.indexOf(OWNER) > -1 && audit(/Job access approved by rule .*Requester is the only Owner/), 'mapped and audited');
    });

    await t('the skip role from Settings is respected', async function(){
      var m = person('Skip RM', 'role_recmgr', OWNER), j = mkJob([m]);
      try {
        ok(WSX.approvals.submission.skip === 'Recruiter Manager', 'default skip'); var r1 = submitAs(m, j); ok(r1.ok && !reviewOf(r1) && r1.sub.stage === 'Ready to Send', 'RM skips');
        WSX.approvals.submission.skip = 'Nobody'; var r2 = submitAs(m, mkJob([m])); ok(reviewer(r2) === OWNER, 'with no skip, the RM’s own submission goes up');
        WSX.approvals.offer.skip = 'Recruiter Manager'; var o = offerAs(m, mkJob([m])); ok(o.res.ok && o.res.offer.status === 'Made' && !o.req, 'offer skip role: no request');
      } finally { resetSettings(); }
    });

    await t('the request records its route', async function(){
      var m = person('Route RM', 'role_recmgr', OWNER), r = person('Route Recruiter', 'role_recruiter', m.id), q = reviewOf(submitAs(r, mkJob([r]))).route;
      ok(Array.isArray(q) && q.length === 2 && q[0].id === m.id && /skipped: not on the job/.test(q[0].result) && q[1].id === OWNER && q[1].result === 'approver', JSON.stringify(q));   // the Owner is next up the line
      var o = offerAs(r, mkJob([r, m])); ok(o.req && o.req.route && o.req.route[0].result === 'approver' && o.req.routeReason === 'Reports to', 'offer route: ' + JSON.stringify(o.req && o.req.route));
    });

    await t('job access and new client use the same rule', async function(){
      var m = person('Access RM', 'role_recmgr', OWNER), r = person('Access Recruiter', 'role_recruiter', m.id);
      ok(jobAccessApproverFor(r.id, mkJob([m])).userId === m.id, 'access: RM on the job'); ok(jobAccessApproverFor(r.id, mkJob([])).userId === OWNER, 'access: else the Owner');
      actAs(r.id); try { ok(clientApprover() && clientApprover().id === OWNER, 'client: RM has no client power (agency) → Owner'); } finally { asAdmin(); }
      ok(clientApprover() === null, 'the Owner adds a client with no approver');
    });

    await t('SLA notices go to the Reports to manager', async function(){
      var m = person('Notice RM', 'role_recmgr', OWNER), r = person('Notice Recruiter', 'role_recruiter', m.id); r.teamId = 'team-2';
      ok(fmManagerOf(r.id).id === m.id, 'Reports to, not the team: ' + (fmManagerOf(r.id) || {}).name);
      var j = mkJob([r, rosterById('RP-081')], { applicantRouting:'round_robin' }), sb = createSubmission(j.id, mkCand().id, { source:'Careers Page', recruiterId:r.id, stage:'Applied Directly' }); sb.recruiterId = r.id;
      var n0 = FM.notices.length; FM.offset = 25 * 3600000; fmSlaSweep(); FM.offset = 0;
      ok(FM.notices.slice(n0).some(function(n){ return n.subId === sb.id && n.to === m.id; }), 'the notice goes to ' + m.name);
    });

    await t('Settings › You › Delegation reads and writes the engine’s out-of-office list', async function(){
      var me = currentActingUser(), n0 = APS.config.delegations.length; sDelegSet('to', 'RP-092'); var d = APS.config.delegations.find(function(x){ return x.fromUserId === me.id; });
      ok(d && d.toUserId === 'RP-092' && APS.config.delegations.length === n0 + 1, 'written to APS.config.delegations');
      sDelegSet('until', '2030-06-30'); ok(sDelegView().until === '2030-06-30', 'until saved'); ok(delegateFor(me).id === 'RP-092', 'routing sees it');
      sDelegSet('to', ''); ok(!APS.config.delegations.some(function(x){ return x.fromUserId === me.id; }), 'cleared');
      ok(typeof DELEGATIONS === 'undefined', 'the old panel is gone');
    });

    asAdmin();
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M04A-ROUTING ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
