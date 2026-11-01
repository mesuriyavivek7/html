/* M4d · Team actions and suspend hand-over (B17, B11; flow map 04, 05, 21).
   canTeamAction gates every Team action by permission; suspending always opens the hand-over; handOverWork moves jobs,
   journeys (with owner history), approvals (re-routed), campaigns, client accounts and reports, each to its own target.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m04d-team-handover.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } finally { asAdmin(); if(typeof hoClose === 'function') hoClose(); if(typeof tmCloseModal === 'function') tmCloseModal(); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asAdmin(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function actAs(id){ state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; }
  function audit(re){ return AUDIT_LOG.some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '')); }); }
  var toasts = [], t0 = window.toast; window.toast = function(m){ toasts.push(String(m)); return t0.apply(this, arguments); };
  var OWNER = 'RP-088', seq = 0;
  function person(name, roleId, reportsTo){ seq++; var u = { id:'D4-' + seq, name:name, email:'d4.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:reportsTo || null, organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }
  function mkJob(team, over){ seq++; var j = Object.assign({ id:'d4j' + seq, title:'Hand-over Role ' + seq, client:'Fintech Corp', clientId:'c1', loc:'Pune, IN', status:'Active', priority:'Medium', recruiter:'', recruiterId:null,
    assignedRecruiters:team.map(function(u){ return u.id; }), skills:['Java'], positions:2, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, salary:'₹10–20 LPA' }, over || {}); JOBS.push(j); return j; }
  function journey(j, ownerId, stage){ seq++; var c = { id:97500 + seq, name:'Handed Candidate ' + seq, skills:['Java'], email:'hc' + seq + '@example.com', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c);
    var sb = createSubmission(j.id, c.id, { source:'Manual', recruiterId:ownerId, stage:stage || 'Submitted' }); sb.recruiterId = ownerId; return sb; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100);

    await t('Admin invites and suspends; the Recruiter Manager changes reports to inside their tree only; the Recruiter does none; buttons follow', async function(){
      var admin = person('Ops Admin', 'role_admin', OWNER), rm = person('Tree Manager', 'role_recmgr', OWNER), inTree = person('In Tree', 'role_recruiter', rm.id), deep = person('Deep In Tree', 'role_recruiter', inTree.id), outside = person('Outside Tree', 'role_recruiter', OWNER), rec = person('Plain Recruiter', 'role_recruiter', rm.id);
      actAs(admin.id); ok(canTeamAction('invite') && canTeamAction('suspend', rec) && canTeamAction('editRole', rec), 'Admin: invite, suspend, manage roles'); ok(!canTeamAction('suspend', rosterById(OWNER)) && !canTeamAction('edit', rosterById(OWNER)), 'only an Owner acts on an Owner');
      showView('team-members'); ok(q('button[onclick="tmOpenInvite()"]') && q('button[onclick*="tmAskSuspend(\'' + rec.id + '\')"]'), 'Admin sees Invite and Suspend');
      actAs(rm.id); ok(!canTeamAction('invite') && !canTeamAction('suspend', inTree) && !canTeamAction('delete', inTree), 'RM: no invite, suspend or delete');
      ok(canTeamAction('reportsTo', inTree) && canTeamAction('reportsTo', deep) && !canTeamAction('reportsTo', outside), 'RM: reports to inside the tree only');
      showView('team-members'); ok(!q('button[onclick="tmOpenInvite()"]'), 'no Invite button for the RM'); ok(!q('button[onclick*="tmAskSuspend("]'), 'no Suspend buttons for the RM');
      ok(q('button[onclick*="tmOpenEdit(\'' + inTree.id + '\')"]') && !q('button[onclick*="tmOpenEdit(\'' + outside.id + '\')"]'), 'Edit only for people in the tree');
      tmOpenEdit(deep.id); ok(tmModal && tmModal.limited, 'the RM edits reports to only'); ok(q('#member-modal-root select[onchange*="managerId"]:not([disabled])') && q('#member-modal-root input[disabled]'), 'other fields locked');
      tmModal.form.managerId = outside.id; tmSubmit(); ok(tmModal && /your team/.test(tmModal.errors.managerId || ''), 'not to someone outside the tree');
      tmModal.form.managerId = rm.id; tmSubmit(); ok(!tmModal && tmManagerIdOf(deep) === rm.id, 'moved under the RM'); ok(audit(/Member updated.*Deep In Tree: reports to → Tree Manager/), 'audited');
      actAs(rec.id); ['invite','suspend','reactivate','editRole','delete','reportsTo'].forEach(function(a){ ok(!canTeamAction(a, inTree), 'Recruiter: no ' + a); });
      tmAskSuspend(inTree.id); ok(!hoState, 'refused when not allowed');
    });

    await t('suspend from Team and from Settings opens the same hand-over; the plain confirm is gone', async function(){
      var r = person('Two Paths', 'role_recruiter', OWNER); asAdmin();
      tmAskSuspend(r.id); ok(hoState && hoState.id === r.id && /Hand over before suspending Two Paths/.test(q('#settings-modal-root').textContent), 'from Team'); hoClose();
      sHandover(r.id); ok(hoState && hoState.id === r.id && q('#ho-h'), 'from Settings'); hoClose();
      ok(typeof tmConfirmSuspend === 'undefined' && typeof tmRenderSuspend === 'undefined' && typeof sConfirmHandover === 'undefined', 'one path only');
    });

    await t('the hand-over moves every category to its own target, with owner history, re-routed approvals and audit lines; nothing stays', async function(){
      var x = person('Leaving Manager', 'role_recmgr', OWNER), rep = person('Their Report', 'role_recruiter', x.id), t1 = person('Target One', 'role_recmgr', OWNER), t2 = person('Target Two', 'role_recruiter', OWNER), t3 = person('Target Three', 'role_recruiter', OWNER);
      var onJob = mkJob([x, rep]), leads = mkJob([rep], { jobLeadId:x.id }), owns = mkJob([rep], { recruiterId:x.id, recruiter:x.name });
      var open = journey(onJob, x.id), closed = journey(onJob, x.id, 'Rejected');
      var reviewMe = { id:97999, name:'Review Me', skills:['Java'], email:'rm@example.com', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(reviewMe);
      actAs(rep.id); var sub = submitOneToJob(onJob, reviewMe, 'Test'); asAdmin();
      var rq = APPROVAL_REQUESTS.find(function(r){ return r.entityType === 'SubmissionReview' && r.entityId === sub.sub.id; }); ok(rq && rq.approverUserId === x.id, 'an approval waits on them');
      var camp = { id:'cmp-d4', ownerId:x.id, status:'running', title:'Leaving campaign', message:{ senderId:x.id } }; CAMPAIGNS.push(camp);
      var cl = CLIENTS.find(function(c){ return c.name === 'CloudNova'; }), wasOwner = cl.ownerId; cl.ownerId = x.id;
      try {
        asAdmin(); openHandOver(x.id); var list = q('#ho-list').textContent;
        ok(/3 jobs they’re on or lead/.test(list) && /1 candidate journey they own/.test(list) && /1 approval waiting on them/.test(list) && /1 Cowork campaign/.test(list) && /1 client account/.test(list) && /1 direct report/.test(list), 'every category listed: ' + list);
        ok(Object.keys(hoState.targets).every(function(k){ return hoState.targets[k] === OWNER; }), 'defaults: their Reports to manager (the Owner)'); ok(q('#ho-list').querySelectorAll('select').length === 6, 'a select per category');
        hoSet('jobs', t1.id); hoSet('journeys', t2.id); hoSet('approvals', t3.id); hoSet('campaigns', t1.id); hoSet('clients', t2.id); hoSet('reports', t1.id); hoConfirm();
        ok(x.userStatus === 'Suspended' && !hoState, 'suspended');
        ok(onJob.assignedRecruiters.indexOf(x.id) < 0 && onJob.assignedRecruiters.indexOf(t1.id) > -1 && leads.jobLeadId === t1.id && owns.recruiterId === t1.id && owns.recruiter === 'Target One', 'jobs: on, lead and owner');
        ok(open.recruiterId === t2.id && open.ownerHistory.slice(-1)[0].reason === 'Hand-over from Leaving Manager', 'journey with owner history');
        ok(closed.recruiterId === x.id, 'history stays: a closed journey keeps the old name');
        ok(rq.approverUserId !== t3.id && rq.approverUserId !== x.id && rq.route && rq.route.length, 'the approval is re-routed (Target Three can’t approve): ' + rq.approverName);
        ok(camp.ownerId === t1.id && camp.message.senderId === t1.id, 'campaign'); ok(cl.ownerId === t2.id, 'client account'); ok(tmManagerIdOf(rep) === t1.id, 'direct report');
        var left = handOverItems(x); ok(Object.keys(left).every(function(k){ return !left[k].length; }), 'nothing left: ' + JSON.stringify(Object.keys(left).map(function(k){ return k + ':' + left[k].length; })));
        ['jobs they’re on or lead','candidate journeys they own','approvals waiting on them','Cowork campaigns','client accounts','direct reports'].forEach(function(k){ ok(audit(new RegExp('Hand-over: ' + k + ' Leaving Manager')), 'audit: ' + k); });
        ok(audit(/Member suspended after hand-over Leaving Manager/), 'audit: suspended');
      } finally { cl.ownerId = wasOwner; CAMPAIGNS.splice(CAMPAIGNS.indexOf(camp), 1); }
    });

    await t('the last active Owner can’t be suspended; nobody suspends themselves', async function(){
      asAdmin(); var me = currentActingUser(); ok(!canTeamAction('suspend', me), 'not yourself'); toasts = []; tmAskSuspend(me.id); ok(!hoState, 'no hand-over for yourself');
      ok(/only active Super Admin|your own account/.test(tmSuspendBlocker(me)), 'blocker: ' + tmSuspendBlocker(me));
      var r = handOverWork(me, {}); ok(!r.ok && me.userStatus !== 'Suspended', 'handOverWork refuses too');
      var second = person('Second Owner', 'role_founder', null); ok(canTeamAction('suspend', second) && !tmSuspendBlocker(second), 'another Owner can be suspended while one stays');
      second.userStatus = 'Suspended'; ok(/only active Super Admin/.test(tmSuspendBlocker(rosterById(OWNER))) || tmSuspendBlocker(rosterById(OWNER)), 'the last active Owner is blocked');
    });

    await t('People in Settings shows my Reports to tree; team_manager routes like reports_to', async function(){
      var rm = person('People Manager', 'role_recmgr', OWNER), a = person('Under A', 'role_recruiter', rm.id), b = person('Under B', 'role_recruiter', a.id), o = person('Not Mine', 'role_recruiter', OWNER);
      actAs(rm.id); var ids = sPeopleScope().map(function(u){ return u.id; }); ok(ids.indexOf(a.id) > -1 && ids.indexOf(b.id) > -1 && ids.indexOf(o.id) < 0, 'tree: ' + ids.join(','));
      asAdmin(); var was = JOB_APPROVAL_POLICY.reviewer; JOB_APPROVAL_POLICY.reviewer = 'team_manager';
      try { var r1 = jobReviewerFor(a); JOB_APPROVAL_POLICY.reviewer = 'reports_to'; var r2 = jobReviewerFor(a); ok(r1.user.id === rm.id && r2.user.id === rm.id && r1.route, 'both go to the Reports to manager'); }
      finally { JOB_APPROVAL_POLICY.reviewer = was; }
    });

    asAdmin();
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M04D-TEAM ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
